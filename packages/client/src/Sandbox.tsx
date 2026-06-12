import { FACTION_IDS, FACTIONS, type FactionId, pilotChoices } from '@xwing/data';
import type { GameConfig, ShipInit } from '@xwing/engine';
import { type ReactElement, useState } from 'react';
import { useSandbox } from './sandbox-store';
import { useSquads } from './squads-store';
import { useGame } from './store';

/** Sandbox panel: add ships or a saved squad, eyeball arcs, then drop into a real game. */
export function Sandbox(): ReactElement {
  const ships = useSandbox((s) => s.ships);
  const showArcs = useSandbox((s) => s.showArcs);
  const add = useSandbox((s) => s.add);
  const addSquad = useSandbox((s) => s.addSquad);
  const toggleArcs = useSandbox((s) => s.toggleArcs);
  const exit = useSandbox((s) => s.exit);
  const startGame = useGame((s) => s.startGame);
  const squads = useSquads((s) => s.squads);

  const [side, setSide] = useState<'rebel' | 'imperial'>('rebel');
  const [faction, setFaction] = useState<FactionId>('rebel');
  const [shipXws, setShipXws] = useState('');
  const [squadId, setSquadId] = useState('');

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

  const startFromSandbox = () => {
    const config: GameConfig = {
      id: 'sandbox',
      seed: String(Date.now()),
      players: [
        { id: 'rebel', name: 'Rebel' },
        { id: 'imperial', name: 'Imperial' },
      ],
      ships: ships.map(
        (s): ShipInit => ({
          id: s.id,
          ownerId: s.ownerId,
          shipType: s.shipType,
          pilot: s.pilot,
          pilotXws: s.pilotXws,
          upgrades: s.upgrades,
          initiative: s.initiative,
          base: s.base,
          primaryAttack: s.primaryAttack,
          agility: s.agility,
          hull: s.hull,
          shields: s.shields,
          pos: s.pos,
          actionBar: s.actionBar,
          dialOptions: s.dialOptions,
        }),
      ),
      obstacles: useSandbox.getState().obstacles,
    };
    exit();
    startGame(config);
  };

  return (
    <div className="panelStack">
      <div className="section">Sandbox — free play</div>

      <div className="segmented">
        <button className={side === 'rebel' ? 'active' : ''} onClick={() => setSide('rebel')}>
          Add to red
        </button>
        <button className={side === 'imperial' ? 'active' : ''} onClick={() => setSide('imperial')}>
          Add to blue
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

      <div className="grid">
        <button className="btn primary" disabled={ships.length === 0} onClick={startFromSandbox}>
          Start game
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
