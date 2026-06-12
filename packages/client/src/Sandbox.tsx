import { FACTION_IDS, FACTIONS, type FactionId, getShip, pilotChoices } from '@xwing/data';
import type { GameConfig, ShipInit } from '@xwing/engine';
import { type ReactElement, useState } from 'react';
import { ManeuverDial } from './controls';
import { useSandbox } from './sandbox-store';
import { useGame } from './store';

/** Sandbox panel: add ships, fly maneuvers, eyeball arcs, then drop into a real game. */
export function Sandbox(): ReactElement {
  const ships = useSandbox((s) => s.ships);
  const selectedId = useSandbox((s) => s.selectedId);
  const showArcs = useSandbox((s) => s.showArcs);
  const add = useSandbox((s) => s.add);
  const execute = useSandbox((s) => s.execute);
  const rotate = useSandbox((s) => s.rotate);
  const remove = useSandbox((s) => s.remove);
  const toggleArcs = useSandbox((s) => s.toggleArcs);
  const exit = useSandbox((s) => s.exit);
  const startGame = useGame((s) => s.startGame);

  const [side, setSide] = useState<'rebel' | 'imperial'>('rebel');
  const [faction, setFaction] = useState<FactionId>('rebel');
  const [shipXws, setShipXws] = useState('');

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
  const sel = ships.find((s) => s.id === selectedId);

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

      {sel && (
        <div className="pickCard">
          <div className="pickHead">
            <span>
              {getShip(sel.shipType).name} · {sel.pilot}
            </span>
            <button className="x" aria-label="Remove" onClick={remove}>
              ×
            </button>
          </div>
          <ManeuverDial options={sel.dialOptions} onPick={execute} />
          <div className="grid">
            <button className="btn sm" onClick={() => rotate(-90)}>
              ⟲ 90
            </button>
            <button className="btn sm" onClick={() => rotate(-15)}>
              ⟲ 15
            </button>
            <button className="btn sm" onClick={() => rotate(15)}>
              15 ⟳
            </button>
            <button className="btn sm" onClick={() => rotate(90)}>
              90 ⟳
            </button>
          </div>
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
      <div className="muted">Tap a ship to select · drag to move · pick a maneuver to fly it.</div>
    </div>
  );
}
