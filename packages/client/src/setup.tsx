import {
  buildConfig,
  FACTIONS,
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

const factionName = (side: Side) => (side === 'rebel' ? FACTIONS.rebel : FACTIONS.imperial);
const xwsFaction = (side: Side) => (side === 'rebel' ? XWS_FACTION.rebel : XWS_FACTION.imperial);
const toSquad = (side: Side, picks: PilotChoice[]): XwsSquad => ({
  faction: xwsFaction(side),
  pilots: picks.map((c) => ({ id: c.pilotXws, ship: c.shipXws })),
});

/** Pretty XWS export for a side's current picks. */
const exportXws = (side: Side, picks: PilotChoice[]): string =>
  JSON.stringify(
    {
      faction: xwsFaction(side),
      points: squadPoints(toSquad(side, picks)),
      version: '2.5.0',
      vendor: { 'xwing-online': {} },
      pilots: picks.map((c) => ({ id: c.pilotXws, ship: c.shipXws })),
    },
    null,
    2,
  );

/** Parse an XWS list into builder picks for this side (faction-checked, roster-checked). */
function picksFromXws(text: string, side: Side): { picks?: PilotChoice[]; error?: string } {
  let squad: XwsSquad;
  try {
    squad = parseXws(text);
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (squad.faction !== xwsFaction(side)) {
    return { error: `That list is ${squad.faction}, not ${xwsFaction(side)}.` };
  }
  const choices = pilotChoices(factionName(side));
  const picks: PilotChoice[] = [];
  for (const p of squad.pilots) {
    const c = choices.find((ch) => ch.pilotXws === p.id && ch.shipXws === p.ship);
    if (!c) return { error: `Not in the R1 roster yet: ${p.id} (${p.ship}).` };
    picks.push(c);
  }
  return { picks };
}

function XwsTools({
  side,
  picks,
  setPicks,
}: {
  side: Side;
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
          setText(exportXws(side, picks));
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
                const res = picksFromXws(text, side);
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
  side,
  picks,
  setPicks,
}: {
  side: Side;
  picks: PilotChoice[];
  setPicks: (p: PilotChoice[]) => void;
}): ReactElement {
  const v = validateSquad(toSquad(side, picks));
  return (
    <div className="col">
      <div className="colHead">
        {side === 'rebel' ? 'Rebel' : 'Imperial'}{' '}
        <span className="muted">
          ({v.points}/{SQUAD_POINT_CAP})
        </span>
      </div>
      <div className="opts">
        {pilotChoices(factionName(side)).map((o) => (
          <button
            key={o.pilotXws}
            className="btn sm"
            disabled={picks.length >= MAX_SHIPS}
            onClick={() => setPicks([...picks, o])}
          >
            + {o.pilotName} <span className="ini">I{o.initiative}</span>
          </button>
        ))}
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
      <XwsTools side={side} picks={picks} setPicks={setPicks} />
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
  const [picks, setPicks] = useState<PilotChoice[]>([]);
  const squad = toSquad(side, picks);
  const v = validateSquad(squad);
  return (
    <div className="panelStack">
      <SquadColumn side={side} picks={picks} setPicks={setPicks} />
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

/** Game tab (no game): quick presets, host online (Rebel), join online (Imperial). */
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

      <div className="section">Host online — you play Rebel</div>
      <OnlineSquad side="rebel" label="Host game" onSubmit={(s) => void host(s)} />

      <div className="section">Join online — you play Imperial</div>
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
  const [rebel, setRebel] = useState<PilotChoice[]>([]);
  const [imperial, setImperial] = useState<PilotChoice[]>([]);
  const rebelSquad = toSquad('rebel', rebel);
  const imperialSquad = toSquad('imperial', imperial);
  const canStart = validateSquad(rebelSquad).valid && validateSquad(imperialSquad).valid;

  return (
    <div className="panelStack">
      <div className="section">Custom hot-seat — both squads, 3–8 ships, ≤20 pts each</div>
      <div className="builder">
        <SquadColumn side="rebel" picks={rebel} setPicks={setRebel} />
        <SquadColumn side="imperial" picks={imperial} setPicks={setImperial} />
      </div>
      <button
        className="btn primary start"
        disabled={!canStart}
        onClick={() => startGame(buildConfig(rebelSquad, imperialSquad, seed()))}
      >
        {canStart ? 'Start battle' : 'Each side needs a legal squad'}
      </button>
    </div>
  );
}
