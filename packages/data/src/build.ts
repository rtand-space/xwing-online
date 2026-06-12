import type { ActionType, BaseSize, Position, ShipInit } from '@xwing/engine';
import { parseDial } from './dial';
import { getPilot, getShip, getUpgrade } from './loaders';
import type { ShipData } from './types';

const SIZES: Record<string, BaseSize> = { Small: 'small', Medium: 'medium', Large: 'large' };

const ACTIONS: Record<string, ActionType> = {
  Focus: 'focus',
  Lock: 'lock',
  'Target Lock': 'lock',
  'Barrel Roll': 'barrel-roll',
  Boost: 'boost',
  Evade: 'evade',
  Calculate: 'calculate',
  Reinforce: 'reinforce',
};

function statValue(ship: ShipData, type: string): number {
  return ship.stats.find((s) => s.type === type)?.value ?? 0;
}

function actionBar(ship: ShipData): ActionType[] {
  const bar: ActionType[] = [];
  for (const a of ship.actions) {
    const mapped = ACTIONS[a.type];
    if (mapped && !bar.includes(mapped)) bar.push(mapped);
  }
  return bar;
}

/** Build an engine ShipInit from card data — the data→engine bridge. */
export function toShipInit(
  shipXws: string,
  pilotXws: string,
  ownerId: string,
  pos: Position,
  id: string,
  upgrades: string[] = [],
): ShipInit {
  const ship = getShip(shipXws);
  const pilot = getPilot(shipXws, pilotXws);
  // Each charge-granting upgrade gets its own pool (keyed by xws) so one card
  // can't spend another's charges.
  const upgradeCharges: Record<string, { charges: number; max: number; recovers: number }> = {};
  for (const x of upgrades) {
    const c = getUpgrade(x).charges;
    if (c) upgradeCharges[x] = { charges: c.value, max: c.value, recovers: c.recovers };
  }
  return {
    id,
    ownerId,
    shipType: ship.xws,
    pilot: pilot.name,
    pilotXws: pilot.xws,
    upgrades,
    initiative: pilot.initiative,
    base: SIZES[ship.size] ?? 'small',
    primaryAttack: statValue(ship, 'attack'),
    agility: statValue(ship, 'agility'),
    hull: statValue(ship, 'hull'),
    shields: statValue(ship, 'shields'),
    upgradeCharges,
    maxForce: pilot.force?.value ?? 0,
    force: pilot.force?.value ?? 0,
    forceRecovers: pilot.force?.recovers ?? 0,
    pos,
    actionBar: actionBar(ship),
    dialOptions: parseDial(ship.dial),
  };
}
