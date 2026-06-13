import {
  abilityNote,
  FACTIONS,
  FACTION_IDS,
  type FactionId,
  getUpgrade,
  implementedAbility,
  parseXws,
  type PilotChoice,
  pilotChoices,
  slotKey,
  SQUAD_POINT_CAP,
  squadPoints,
  upgradeOptions,
  validateSquad,
  type XwsSquad,
  XWS_FACTION,
} from '@xwing/data';
import { type ReactElement, useEffect, useState } from 'react';
import { type Pick, newPick, useBuilder } from './builder-store';
import { useOnline } from './online-store';
import { useSandbox } from './sandbox-store';
import { useSetup } from './setup-store';
import type { SavedSquad } from './squads';
import { useSquads } from './squads-store';

const FACTION_BY_XWS: Record<string, FactionId> = Object.fromEntries(
  FACTION_IDS.map((f) => [XWS_FACTION[f], f]),
);
const factionLabel = (xws: string): string => FACTIONS[FACTION_BY_XWS[xws] ?? 'rebel'] ?? xws;

const MAX_SHIPS = 8;
const seed = (): string => String(Date.now());

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
                  {implementedAbility(u.xws) && (
                    <span className="abilityTag" title={abilityNote(u.xws)}>
                      ability
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

/** The squad-building column: faction, ship/pilot picker, per-pilot loadout, XWS import/export. */
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
                {p.choice.variant && <span className="variantTag">{p.choice.variant}</span>}{' '}
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
                  + {o.pilotName}{' '}
                  {o.variant && <span className="variantTag">{o.variant}</span>}{' '}
                  <span className="ini">I{o.initiative}</span> <span className="muted">{o.cost}p</span>
                  {implementedAbility(o.pilotXws) && (
                    <span className="abilityTag" title={abilityNote(o.pilotXws)}>
                      ability
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="muted abilityNote">
        Most card abilities aren’t simulated yet — “ability” marks the ones that are.
      </div>
      <XwsTools faction={faction} picks={picks} setPicks={setPicks} />
    </div>
  );
}

/** Squad tab — the single home for building, importing, and saving squads. */
export function SquadBuilder(): ReactElement {
  const squads = useSquads((s) => s.squads);
  const save = useSquads((s) => s.save);
  const remove = useSquads((s) => s.remove);
  const { editing, faction, picks, name, setEditing, setFaction, setPicks, setName } = useBuilder();

  useEffect(() => void useSquads.getState().refresh(), []);

  const edit = (entry?: SavedSquad) => {
    if (entry) {
      const fid = FACTION_BY_XWS[entry.xws.faction] ?? 'rebel';
      setFaction(fid);
      setName(entry.name);
      setPicks(picksFromXws(JSON.stringify(entry.xws), fid).picks ?? []);
      setEditing(entry.id);
    } else {
      setFaction('rebel');
      setName('');
      setPicks([]);
      setEditing('new');
    }
  };

  if (editing) {
    const squad = toSquad(faction, picks);
    const v = validateSquad(squad);
    return (
      <div className="panelStack">
        <input
          className="joinInput"
          placeholder="squad name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <SquadColumn faction={faction} setFaction={setFaction} picks={picks} setPicks={setPicks} />
        {picks.length > 0 &&
          !v.valid &&
          v.errors.map((e, i) => (
            <div key={i} className="reject">
              {e}
            </div>
          ))}
        <div className="grid">
          <button className="btn ghost" onClick={() => setEditing(null)}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={!name.trim() || !v.valid}
            onClick={async () => {
              await save(
                name.trim(),
                XWS_FACTION[faction],
                squad,
                editing === 'new' ? undefined : editing,
              );
              setEditing(null);
            }}
          >
            Save squad
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="panelStack">
      <div className="section">My squads</div>
      {squads.length === 0 && <div className="muted">No squads yet — build one to play.</div>}
      {squads.map((sq) => (
        <div key={sq.id} className="rosterRow">
          <button className="btn sm ghost" onClick={() => edit(sq)}>
            {sq.name} <span className="muted">{factionLabel(sq.faction)}</span>
          </button>
          <button className="x" aria-label="Delete" onClick={() => void remove(sq.id)}>
            ×
          </button>
        </div>
      ))}
      <button className="btn primary" onClick={() => edit()}>
        + New squad
      </button>
    </div>
  );
}

function SquadSelect({
  squads,
  value,
  onChange,
  placeholder,
}: {
  squads: SavedSquad[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
}): ReactElement {
  return (
    <select className="factionSel" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {squads.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name} — {factionLabel(s.faction)}
        </option>
      ))}
    </select>
  );
}

/** Game tab — online play, sandbox, and custom hot-seat, all from saved squads. */
export function QuickPlay(): ReactElement {
  const host = useOnline((s) => s.host);
  const join = useOnline((s) => s.join);
  const squads = useSquads((s) => s.squads);
  const initialCode = new URLSearchParams(location.search).get('game') ?? '';
  const [mode, setMode] = useState<'host' | 'join'>(initialCode ? 'join' : 'host');
  const [code, setCode] = useState(initialCode);
  const [online, setOnline] = useState('');
  const joining = mode === 'join';
  const byId = (id: string) => squads.find((s) => s.id === id);

  useEffect(() => void useSquads.getState().refresh(), []);

  return (
    <div className="panelStack">
      <div className="section">Play online</div>
      {squads.length === 0 && (
        <div className="muted">A squad is required — build one in the Squad tab.</div>
      )}
      <div className="segmented">
        <button className={mode === 'host' ? 'active' : ''} onClick={() => setMode('host')}>
          Host
        </button>
        <button className={joining ? 'active' : ''} onClick={() => setMode('join')}>
          Join
        </button>
      </div>
      <SquadSelect
        squads={squads}
        value={online}
        onChange={setOnline}
        placeholder={squads.length ? 'Choose your squad' : 'No squads yet'}
      />
      {joining && (
        <input
          className="joinInput"
          placeholder="enter game code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      )}
      <button
        className="btn primary"
        disabled={!byId(online) || (joining && !code.trim())}
        onClick={() => {
          const sq = byId(online)!;
          if (joining) {
            void join(code.trim(), sq.xws);
            return;
          }
          const s = seed();
          useSetup.getState().begin(s, (obs) => void host(sq.xws, obs));
        }}
      >
        {joining ? 'Join game' : 'Host game'}
      </button>

      <div className="section">Sandbox</div>
      <button className="btn primary" onClick={() => useSandbox.getState().open()}>
        Enter Sandbox
      </button>
    </div>
  );
}
