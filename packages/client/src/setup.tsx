import {
  buildConfig,
  FACTIONS,
  FACTION_IDS,
  type FactionId,
  getUpgrade,
  parseXws,
  type PilotChoice,
  PRESETS,
  presetConfig,
  pilotChoices,
  slotKey,
  SQUAD_POINT_CAP,
  type Side,
  squadPoints,
  upgradeOptions,
  validateSquad,
  type XwsSquad,
  XWS_FACTION,
} from '@xwing/data';
import { type ReactElement, useEffect, useState } from 'react';
import { useAuth } from './auth';
import { useOnline } from './online-store';
import { type SavedSquad, deleteSquad, listSquads, saveSquad } from './squads';
import { useGame } from './store';

const FACTION_BY_XWS: Record<string, FactionId> = Object.fromEntries(
  FACTION_IDS.map((f) => [XWS_FACTION[f], f]),
);

const MAX_SHIPS = 8;
const seed = (): string => String(Date.now());

/** A chosen pilot plus its equipped upgrades, aligned index-for-index to its slots. */
interface Pick {
  choice: PilotChoice;
  equip: (string | null)[];
}

const newPick = (choice: PilotChoice): Pick => ({ choice, equip: choice.slots.map(() => null) });

const equipCost = (equip: (string | null)[]): number =>
  equip.reduce((s, x) => s + (x ? (getUpgrade(x).cost ?? 0) : 0), 0);

/** Group a pick's equipped upgrades into the XWS `upgrades` shape (slot key → xws[]). */
function toUpgrades(pick: Pick): Record<string, string[]> | undefined {
  const out: Record<string, string[]> = {};
  pick.choice.slots.forEach((slot, i) => {
    const x = pick.equip[i];
    if (x) (out[slotKey(slot)] ??= []).push(x);
  });
  return Object.keys(out).length ? out : undefined;
}

const toSquad = (faction: FactionId, picks: Pick[]): XwsSquad => ({
  faction: XWS_FACTION[faction],
  pilots: picks.map((p) => ({
    id: p.choice.pilotXws,
    ship: p.choice.shipXws,
    upgrades: toUpgrades(p),
  })),
});

const exportXws = (faction: FactionId, picks: Pick[]): string =>
  JSON.stringify(
    {
      faction: XWS_FACTION[faction],
      points: squadPoints(toSquad(faction, picks)),
      version: '2.5.0',
      vendor: { 'xwing-online': {} },
      pilots: toSquad(faction, picks).pilots,
    },
    null,
    2,
  );

/** Parse an XWS list into builder picks (faction-, roster-, and upgrade-checked). */
function picksFromXws(text: string, faction: FactionId): { picks?: Pick[]; error?: string } {
  let squad: XwsSquad;
  try {
    squad = parseXws(text);
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (squad.faction !== XWS_FACTION[faction]) {
    return { error: `That list is ${squad.faction}, not ${XWS_FACTION[faction]}.` };
  }
  const choices = pilotChoices(FACTIONS[faction]);
  const picks: Pick[] = [];
  for (const p of squad.pilots) {
    const choice = choices.find((ch) => ch.pilotXws === p.id && ch.shipXws === p.ship);
    if (!choice) return { error: `Not in the roster: ${p.id} (${p.ship}).` };
    const pick = newPick(choice);
    const used: Record<string, number> = {};
    for (let i = 0; i < choice.slots.length; i++) {
      const k = slotKey(choice.slots[i]!);
      const arr = p.upgrades?.[k];
      if (!arr) continue;
      const at = used[k] ?? 0;
      const x = arr[at];
      if (!x) continue;
      try {
        getUpgrade(x);
      } catch {
        return { error: `Unknown upgrade: ${x}.` };
      }
      pick.equip[i] = x;
      used[k] = at + 1;
    }
    picks.push(pick);
  }
  return { picks };
}

function XwsTools({
  faction,
  picks,
  setPicks,
}: {
  faction: FactionId;
  picks: Pick[];
  setPicks: (p: Pick[]) => void;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  return (
    <div className="xws">
      <button
        className="btn sm ghost"
        onClick={() => {
          setText(exportXws(faction, picks));
          setError('');
          setOpen((o) => !o);
        }}
      >
        {open ? 'Hide XWS' : 'Import / export XWS'}
      </button>
      {open && (
        <>
          <textarea
            className="xwsBox"
            spellCheck={false}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {error && <div className="reject">{error}</div>}
          <div className="grid">
            <button className="btn sm" onClick={() => void navigator.clipboard?.writeText(text)}>
              Copy
            </button>
            <button
              className="btn sm primary"
              onClick={() => {
                const res = picksFromXws(text, faction);
                if (res.error) setError(res.error);
                else {
                  setPicks(res.picks ?? []);
                  setError('');
                  setOpen(false);
                }
              }}
            >
              Import
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** The equipped-upgrade slot bar + per-slot upgrade picker for one pilot. */
function Loadout({
  pick,
  onEquip,
}: {
  pick: Pick;
  onEquip: (slot: number, x: string | null) => void;
}) {
  const [slot, setSlot] = useState<number | null>(null);
  const { choice, equip } = pick;
  if (choice.slots.length === 0) return null;
  const used = equipCost(equip);
  const over = used > choice.loadout;

  return (
    <>
      <div className="slots">
        {choice.slots.map((s, i) => {
          const x = equip[i];
          return (
            <button
              key={i}
              className={`slotChip${x ? ' filled' : ''}${slot === i ? ' active' : ''}`}
              onClick={() => setSlot(slot === i ? null : i)}
            >
              <span className="slotName">{s}</span>
              <span className="slotVal">{x ? getUpgrade(x).name : '—'}</span>
            </button>
          );
        })}
      </div>
      <div className={`loadoutMeter${over ? ' over' : ''}`}>
        loadout {used}/{choice.loadout}
      </div>
      {slot !== null && (
        <div className="picker">
          <div className="pickerHead">
            <span className="muted">{choice.slots[slot]}</span>
            <button className="btn sm ghost" onClick={() => setSlot(null)}>
              Done
            </button>
          </div>
          <div className="opts">
            <button
              className="btn sm"
              onClick={() => {
                onEquip(slot, null);
                setSlot(null);
              }}
            >
              — Empty
            </button>
            {upgradeOptions(choice.slots[slot]!, choice.shipXws).map((u) => {
              const slotCost = equip[slot] ? (getUpgrade(equip[slot]!).cost ?? 0) : 0;
              const avail = choice.loadout - used + slotCost;
              const cost = u.cost ?? 0;
              return (
                <button
                  key={u.xws}
                  className="btn sm"
                  disabled={cost > avail}
                  onClick={() => {
                    onEquip(slot, u.xws);
                    setSlot(null);
                  }}
                >
                  {u.name} <span className="muted">{u.cost ?? '?'}p</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

/** Save/load the signed-in user's squads (shown only when authenticated). */
function SavedSquads({
  faction,
  picks,
  onLoad,
}: {
  faction: FactionId;
  picks: Pick[];
  onLoad: (f: FactionId, picks: Pick[]) => void;
}): ReactElement | null {
  const user = useAuth((s) => s.user);
  const [list, setList] = useState<SavedSquad[]>([]);
  const refresh = () => void listSquads().then(setList);
  useEffect(() => {
    if (user) refresh();
    else setList([]);
  }, [user]);
  if (!user) return null;

  const save = async () => {
    const name = prompt('Name this squad');
    if (!name?.trim()) return;
    await saveSquad(name.trim(), XWS_FACTION[faction], toSquad(faction, picks));
    refresh();
  };
  const load = (sq: SavedSquad) => {
    const fid = FACTION_BY_XWS[sq.xws.faction] ?? faction;
    const res = picksFromXws(JSON.stringify(sq.xws), fid);
    if (res.picks) onLoad(fid, res.picks);
  };

  return (
    <div className="savedSquads">
      <button className="btn sm" disabled={picks.length === 0} onClick={save}>
        Save squad
      </button>
      {list.map((sq) => (
        <div key={sq.id} className="rosterRow">
          <button className="btn sm ghost" onClick={() => load(sq)}>
            {sq.name} <span className="muted">{sq.faction}</span>
          </button>
          <button
            className="x"
            aria-label="Delete"
            onClick={() => void deleteSquad(sq.id).then(refresh)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

function SquadColumn({
  faction,
  setFaction,
  picks,
  setPicks,
}: {
  faction: FactionId;
  setFaction: (f: FactionId) => void;
  picks: Pick[];
  setPicks: (p: Pick[]) => void;
}): ReactElement {
  const [adding, setAdding] = useState(false);
  const [shipPick, setShipPick] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const v = validateSquad(toSquad(faction, picks));
  const full = picks.length >= MAX_SHIPS;

  const all = pilotChoices(FACTIONS[faction]);
  const ships: { xws: string; name: string }[] = [];
  const seen = new Set<string>();
  for (const o of all) {
    if (!seen.has(o.shipXws)) {
      seen.add(o.shipXws);
      ships.push({ xws: o.shipXws, name: o.shipName });
    }
  }
  const needle = q.trim().toLowerCase();
  const shipList = ships.filter((s) => !needle || s.name.toLowerCase().includes(needle));
  const pilots = shipPick ? all.filter((o) => o.shipXws === shipPick) : [];

  const reset = () => {
    setAdding(false);
    setShipPick(null);
    setQ('');
  };
  const add = (o: PilotChoice) => {
    setPicks([...picks, newPick(o)]);
    reset();
  };
  const equip = (pickIdx: number, slot: number, x: string | null) =>
    setPicks(
      picks.map((p, idx) =>
        idx !== pickIdx ? p : { ...p, equip: p.equip.map((e, j) => (j === slot ? x : e)) },
      ),
    );

  return (
    <div className="col">
      <div className="colHead">
        <select
          className="factionSel"
          value={faction}
          onChange={(e) => {
            setFaction(e.target.value as FactionId);
            setPicks([]);
            reset();
          }}
        >
          {FACTION_IDS.map((f) => (
            <option key={f} value={f}>
              {FACTIONS[f]}
            </option>
          ))}
        </select>
        <span className="muted">
          ({v.points}/{SQUAD_POINT_CAP})
        </span>
      </div>

      <div className="roster">
        {picks.length === 0 && <div className="muted empty">No ships yet.</div>}
        {picks.map((p, i) => (
          <div key={i} className="pickCard">
            <div className="pickHead">
              <span>
                {p.choice.shipName} · {p.choice.pilotName}{' '}
                <span className="ini">I{p.choice.initiative}</span>
              </span>
              <span className="rosterEnd">
                <span className="muted">{p.choice.cost}p</span>
                <button
                  className="x"
                  aria-label="Remove"
                  onClick={() => setPicks(picks.filter((_, j) => j !== i))}
                >
                  ×
                </button>
              </span>
            </div>
            <Loadout pick={p} onEquip={(slot, x) => equip(i, slot, x)} />
          </div>
        ))}
      </div>

      {!adding ? (
        <button className="btn addShip" disabled={full} onClick={() => setAdding(true)}>
          {full ? 'Squad full' : '+ Add a ship'}
        </button>
      ) : (
        <div className="picker">
          <div className="pickerHead">
            <button
              className="btn sm ghost"
              onClick={() => (shipPick ? (setShipPick(null), setQ('')) : reset())}
            >
              ← {shipPick ? 'Ships' : 'Cancel'}
            </button>
            <span className="muted">
              {shipPick ? ships.find((s) => s.xws === shipPick)?.name : 'Choose a ship'}
            </span>
          </div>
          {!shipPick ? (
            <>
              <input
                className="joinInput"
                placeholder="search ships"
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <div className="opts">
                {shipList.map((s) => (
                  <button key={s.xws} className="btn sm" onClick={() => setShipPick(s.xws)}>
                    {s.name}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="opts">
              {pilots.map((o) => (
                <button key={o.pilotXws} className="btn sm" onClick={() => add(o)}>
                  + {o.pilotName} <span className="ini">I{o.initiative}</span>{' '}
                  <span className="muted">{o.cost}p</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <SavedSquads
        faction={faction}
        picks={picks}
        onLoad={(f, p) => {
          setFaction(f);
          setPicks(p);
        }}
      />
      <XwsTools faction={faction} picks={picks} setPicks={setPicks} />
    </div>
  );
}

/** A single-faction squad builder used for online host/join. */
function OnlineSquad({
  side,
  label,
  disabled,
  onSubmit,
}: {
  side: Side;
  label: string;
  disabled?: boolean;
  onSubmit: (squad: XwsSquad) => void;
}): ReactElement {
  const [faction, setFaction] = useState<FactionId>(side === 'rebel' ? 'rebel' : 'imperial');
  const [picks, setPicks] = useState<Pick[]>([]);
  const squad = toSquad(faction, picks);
  const v = validateSquad(squad);
  return (
    <div className="panelStack">
      <SquadColumn faction={faction} setFaction={setFaction} picks={picks} setPicks={setPicks} />
      {picks.length > 0 &&
        !v.valid &&
        v.errors.map((e, i) => (
          <div key={i} className="reject">
            {e}
          </div>
        ))}
      <button
        className="btn primary"
        disabled={disabled || !v.valid}
        onClick={() => onSubmit(squad)}
      >
        {label}
      </button>
    </div>
  );
}

/** Game tab (no game): quick presets, then one online builder toggled host/join. */
export function QuickPlay(): ReactElement {
  const startGame = useGame((s) => s.startGame);
  const host = useOnline((s) => s.host);
  const join = useOnline((s) => s.join);
  const initialCode = new URLSearchParams(location.search).get('game') ?? '';
  const [mode, setMode] = useState<'host' | 'join'>(initialCode ? 'join' : 'host');
  const [code, setCode] = useState(initialCode);
  const joining = mode === 'join';

  return (
    <div className="panelStack">
      <div className="section">Quick match (hot-seat)</div>
      <div className="presetList">
        {PRESETS.map((p) => (
          <button key={p.id} className="preset" onClick={() => startGame(presetConfig(p, seed()))}>
            <div className="presetName">{p.name}</div>
            <div className="presetDesc">{p.description}</div>
          </button>
        ))}
      </div>

      <div className="section">Play online</div>
      <div className="segmented">
        <button className={mode === 'host' ? 'active' : ''} onClick={() => setMode('host')}>
          Host
        </button>
        <button className={joining ? 'active' : ''} onClick={() => setMode('join')}>
          Join
        </button>
      </div>
      {joining && (
        <input
          className="joinInput"
          placeholder="enter game code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      )}
      <OnlineSquad
        key={mode}
        side={joining ? 'imperial' : 'rebel'}
        label={joining ? (code.trim() ? 'Join game' : 'Enter a code first') : 'Host game'}
        disabled={joining && !code.trim()}
        onSubmit={(s) => (joining ? void join(code.trim(), s) : void host(s))}
      />
    </div>
  );
}

/** Squad tab (no game): build both squads for a custom hot-seat match. */
export function SquadBuilder(): ReactElement {
  const startGame = useGame((s) => s.startGame);
  const [aFaction, setAFaction] = useState<FactionId>('rebel');
  const [bFaction, setBFaction] = useState<FactionId>('imperial');
  const [a, setA] = useState<Pick[]>([]);
  const [b, setB] = useState<Pick[]>([]);
  const aSquad = toSquad(aFaction, a);
  const bSquad = toSquad(bFaction, b);
  const canStart = validateSquad(aSquad).valid && validateSquad(bSquad).valid;

  return (
    <div className="panelStack">
      <div className="section">Custom hot-seat — both squads, 3–8 ships, ≤50 pts each</div>
      <div className="builder">
        <SquadColumn faction={aFaction} setFaction={setAFaction} picks={a} setPicks={setA} />
        <SquadColumn faction={bFaction} setFaction={setBFaction} picks={b} setPicks={setB} />
      </div>
      <button
        className="btn primary start"
        disabled={!canStart}
        onClick={() => startGame(buildConfig(aSquad, bSquad, seed()))}
      >
        {canStart ? 'Start battle' : 'Each side needs a legal squad'}
      </button>
    </div>
  );
}
