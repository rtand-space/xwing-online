import {
  buildConfig,
  FACTIONS,
  type PilotChoice,
  PRESETS,
  presetConfig,
  pilotChoices,
  type XwsSquad,
  XWS_FACTION,
} from '@xwing/data';
import { type ReactElement, useState } from 'react';
import { useOnline } from './online-store';
import { useGame } from './store';

const MAX_SHIPS = 6;
const seed = (): string => String(Date.now());

function SquadColumn({
  title,
  options,
  picks,
  setPicks,
}: {
  title: string;
  options: PilotChoice[];
  picks: PilotChoice[];
  setPicks: (p: PilotChoice[]) => void;
}): ReactElement {
  return (
    <div className="col">
      <div className="colHead">
        {title} <span className="muted">({picks.length})</span>
      </div>
      <div className="opts">
        {options.map((o) => (
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
    </div>
  );
}

/** Quick start: preset hot-seat matches + online host/join. (Side panel → Game tab.) */
export function QuickPlay(): ReactElement {
  const startGame = useGame((s) => s.startGame);
  const hostOnline = useOnline((s) => s.host);
  const joinOnline = useOnline((s) => s.join);
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

      <div className="section">Online — share a code</div>
      <div className="presetList">
        {PRESETS.map((p) => (
          <button key={p.id} className="preset" onClick={() => hostOnline(presetConfig(p, seed()))}>
            <div className="presetName">Host: {p.name}</div>
            <div className="presetDesc">{p.description}</div>
          </button>
        ))}
      </div>
      <div className="joinRow">
        <input
          className="joinInput"
          placeholder="enter game code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button
          className="btn primary"
          disabled={!code.trim()}
          onClick={() => joinOnline(code.trim())}
        >
          Join
        </button>
      </div>
    </div>
  );
}

/** Build a custom hot-seat match. (Side panel → Squad tab; R2 grows this into the full builder.) */
export function SquadBuilder(): ReactElement {
  const startGame = useGame((s) => s.startGame);
  const [rebel, setRebel] = useState<PilotChoice[]>([]);
  const [imperial, setImperial] = useState<PilotChoice[]>([]);

  const toSquad = (faction: string, picks: PilotChoice[]): XwsSquad => ({
    faction,
    pilots: picks.map((c) => ({ id: c.pilotXws, ship: c.shipXws })),
  });
  const canStart = rebel.length > 0 && imperial.length > 0;

  return (
    <div className="panelStack">
      <div className="section">Build your own (hot-seat)</div>
      <div className="builder">
        <SquadColumn
          title="Rebel"
          options={pilotChoices(FACTIONS.rebel)}
          picks={rebel}
          setPicks={setRebel}
        />
        <SquadColumn
          title="Imperial"
          options={pilotChoices(FACTIONS.imperial)}
          picks={imperial}
          setPicks={setImperial}
        />
      </div>
      <button
        className="btn primary start"
        disabled={!canStart}
        onClick={() =>
          startGame(
            buildConfig(
              toSquad(XWS_FACTION.rebel, rebel),
              toSquad(XWS_FACTION.imperial, imperial),
              seed(),
            ),
          )
        }
      >
        {canStart ? 'Start battle' : 'Add a ship to each side'}
      </button>
    </div>
  );
}
