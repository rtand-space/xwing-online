import { FACTION_IDS, FACTIONS, type FactionId, pilotChoices } from '@xwing/data';
import { type ReactElement, useState } from 'react';
import { NamesToggle } from './board-prefs';
import { Roster } from './roster';
import { useSandbox } from './sandbox-store';
import { useSquads } from './squads-store';
import { useGame } from './store';

/** Sandbox panel: build a local board, then toggle turn-based rules over it. */
export function Sandbox(): ReactElement {
  const ships = useSandbox((s) => s.ships);
  const turnBased = useSandbox((s) => s.turnBased);
  const showArcs = useSandbox((s) => s.showArcs);
  const add = useSandbox((s) => s.add);
  const addSquad = useSandbox((s) => s.addSquad);
  const toggleArcs = useSandbox((s) => s.toggleArcs);
  const clear = useSandbox((s) => s.clear);
  const exit = useSandbox((s) => s.exit);
  const enterTurnBased = useSandbox((s) => s.enterTurnBased);
  const leaveTurnBased = useSandbox((s) => s.leaveTurnBased);
  const squads = useSquads((s) => s.squads);
  const game = useGame((s) => s.game);

  const [side, setSide] = useState<'player1' | 'player2'>('player1');
  const [faction, setFaction] = useState<FactionId>('rebel');
  const [shipXws, setShipXws] = useState('');
  const [squadId, setSquadId] = useState('');

  if (turnBased) {
    return (
      <div className="panelStack">
        <div className="section">Turn-based — playing this board</div>
        <div className="muted">Play it out with full rules, then drop back to free editing.</div>
        {game && (
          <>
            <div className="section">Board state</div>
            <Roster view={game.state} />
          </>
        )}
        <NamesToggle />
        <button className="btn primary" onClick={leaveTurnBased}>
          Leave turn-based
        </button>
        <button className="btn ghost" onClick={exit}>
          Exit sandbox
        </button>
      </div>
    );
  }

  const all = pilotChoices(FACTIONS[faction]);
  const shipList: { xws: string; name: string }[] = [];
  const seen = new Set<string>();
  for (const o of all) {
    if (!seen.has(o.shipXws)) {
      seen.add(o.shipXws);
      shipList.push({ xws: o.shipXws, name: o.shipName });
    }
  }
  const pilots = shipXws ? all.filter((o) => o.shipXws === shipXws) : [];

  return (
    <div className="panelStack">
      <div className="section">Sandbox — free play</div>

      <div className="segmented">
        <button className={side === 'player1' ? 'active' : ''} onClick={() => setSide('player1')}>
          Add to P1
        </button>
        <button className={side === 'player2' ? 'active' : ''} onClick={() => setSide('player2')}>
          Add to P2
        </button>
      </div>

      {squads.length > 0 && (
        <>
          <div className="section">Add a saved squad</div>
          <select
            className="factionSel"
            value={squadId}
            onChange={(e) => setSquadId(e.target.value)}
          >
            <option value="">Choose a squad</option>
            {squads.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            className="btn"
            disabled={!squadId}
            onClick={() => {
              const sq = squads.find((s) => s.id === squadId);
              if (sq) addSquad(sq.xws, side);
            }}
          >
            Add squad
          </button>
        </>
      )}

      <div className="section">Add a single ship</div>
      <select
        className="factionSel"
        value={faction}
        onChange={(e) => {
          setFaction(e.target.value as FactionId);
          setShipXws('');
        }}
      >
        {FACTION_IDS.map((f) => (
          <option key={f} value={f}>
            {FACTIONS[f]}
          </option>
        ))}
      </select>
      <select className="factionSel" value={shipXws} onChange={(e) => setShipXws(e.target.value)}>
        <option value="">Choose a ship</option>
        {shipList.map((s) => (
          <option key={s.xws} value={s.xws}>
            {s.name}
          </option>
        ))}
      </select>
      {shipXws && (
        <div className="opts">
          {pilots.map((o) => (
            <button
              key={o.pilotXws}
              className="btn sm"
              onClick={() => add(o.shipXws, o.pilotXws, side)}
            >
              + {o.pilotName} <span className="ini">I{o.initiative}</span>
            </button>
          ))}
        </div>
      )}

      <label className="rosterRow">
        <span>Show firing arc</span>
        <input type="checkbox" checked={showArcs} onChange={toggleArcs} />
      </label>
      <NamesToggle />

      <button className="btn primary" disabled={ships.length === 0} onClick={enterTurnBased}>
        Enter turn-based
      </button>
      <div className="grid">
        <button className="btn ghost" disabled={ships.length === 0} onClick={clear}>
          Clear board
        </button>
        <button className="btn ghost" onClick={exit}>
          Exit sandbox
        </button>
      </div>
      <div className="muted">
        Tap a ship to select · drag to move · fly maneuvers from the dial below.
      </div>
    </div>
  );
}
