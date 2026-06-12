import {
  buildConfig,
  FACTIONS,
  FACTION_IDS,
  type FactionId,
  parseXws,
  type PilotChoice,
  PRESETS,
  presetConfig,
  pilotChoices,
  SQUAD_POINT_CAP,
  type Side,
  squadPoints,
  validateSquad,
  type XwsSquad,
  XWS_FACTION,
} from '@xwing/data';
import { type ReactElement, useState } from 'react';
import { useOnline } from './online-store';
import { useGame } from './store';

const MAX_SHIPS = 8;
const seed = (): string => String(Date.now());

const toSquad = (faction: FactionId, picks: PilotChoice[]): XwsSquad => ({
  faction: XWS_FACTION[faction],
  pilots: picks.map((c) => ({ id: c.pilotXws, ship: c.shipXws })),
});

const exportXws = (faction: FactionId, picks: PilotChoice[]): string =>
  JSON.stringify(
    {
      faction: XWS_FACTION[faction],
      points: squadPoints(toSquad(faction, picks)),
      version: '2.5.0',
      vendor: { 'xwing-online': {} },
      pilots: picks.map((c) => ({ id: c.pilotXws, ship: c.shipXws })),
    },
    null,
    2,
  );

/** Parse an XWS list into builder picks for this faction (faction- and roster-checked). */
function picksFromXws(text: string, faction: FactionId): { picks?: PilotChoice[]; error?: string } {
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
  const picks: PilotChoice[] = [];
  for (const p of squad.pilots) {
    const c = choices.find((ch) => ch.pilotXws === p.id && ch.shipXws === p.ship);
    if (!c) return { error: `Not in the roster: ${p.id} (${p.ship}).` };
    picks.push(c);
  }
  return { picks };
}

function XwsTools({
  faction,
  picks,
  setPicks,
}: {
  faction: FactionId;
  picks: PilotChoice[];
  setPicks: (p: PilotChoice[]) => void;
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

function SquadColumn({
  faction,
  setFaction,
  picks,
  setPicks,
}: {
  faction: FactionId;
  setFaction: (f: FactionId) => void;
  picks: PilotChoice[];
  setPicks: (p: PilotChoice[]) => void;
}): ReactElement {
  const [q, setQ] = useState('');
  const v = validateSquad(toSquad(faction, picks));
  const needle = q.trim().toLowerCase();
  const choices = pilotChoices(FACTIONS[faction]).filter(
    (o) => !needle || `${o.shipName} ${o.pilotName}`.toLowerCase().includes(needle),
  );

  let lastShip = '';
  return (
    <div className="col">
      <div className="colHead">
        <select
          className="factionSel"
          value={faction}
          onChange={(e) => {
            setFaction(e.target.value as FactionId);
            setPicks([]);
            setQ('');
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
      <input
        className="joinInput"
        placeholder="search ships / pilots"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="opts">
        {choices.map((o) => {
          const head = o.shipName !== lastShip ? ((lastShip = o.shipName), o.shipName) : null;
          return (
            <div key={o.shipXws + o.pilotXws}>
              {head && <div className="shipGroup">{head}</div>}
              <button
                className="btn sm"
                disabled={picks.length >= MAX_SHIPS}
                onClick={() => setPicks([...picks, o])}
              >
                + {o.pilotName} <span className="ini">I{o.initiative}</span>
              </button>
            </div>
          );
        })}
      </div>
      <div className="roster">
        {picks.length === 0 && <div className="muted empty">No ships yet.</div>}
        {picks.map((c, i) => (
          <div key={i} className="rosterRow">
            <span>
              {c.shipName} · {c.pilotName}
            </span>
            <button
              className="x"
              aria-label="Remove"
              onClick={() => setPicks(picks.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </div>
        ))}
      </div>
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
  const [picks, setPicks] = useState<PilotChoice[]>([]);
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

/** Game tab (no game): quick presets, host online, join online. */
export function QuickPlay(): ReactElement {
  const startGame = useGame((s) => s.startGame);
  const host = useOnline((s) => s.host);
  const join = useOnline((s) => s.join);
  const [code, setCode] = useState(() => new URLSearchParams(location.search).get('game') ?? '');

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

      <div className="section">Host online — pick your faction</div>
      <OnlineSquad side="rebel" label="Host game" onSubmit={(s) => void host(s)} />

      <div className="section">Join online — pick your faction</div>
      <div className="joinRow">
        <input
          className="joinInput"
          placeholder="enter game code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      </div>
      <OnlineSquad
        side="imperial"
        label={code.trim() ? 'Join game' : 'Enter a code first'}
        disabled={!code.trim()}
        onSubmit={(s) => void join(code.trim(), s)}
      />
    </div>
  );
}

/** Squad tab (no game): build both squads for a custom hot-seat match. */
export function SquadBuilder(): ReactElement {
  const startGame = useGame((s) => s.startGame);
  const [aFaction, setAFaction] = useState<FactionId>('rebel');
  const [bFaction, setBFaction] = useState<FactionId>('imperial');
  const [a, setA] = useState<PilotChoice[]>([]);
  const [b, setB] = useState<PilotChoice[]>([]);
  const aSquad = toSquad(aFaction, a);
  const bSquad = toSquad(bFaction, b);
  const canStart = validateSquad(aSquad).valid && validateSquad(bSquad).valid;

  return (
    <div className="panelStack">
      <div className="section">Custom hot-seat — both squads, 3–8 ships, ≤20 pts each</div>
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
