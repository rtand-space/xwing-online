import type { ActionType, BaseSize, Position, ShipInit } from '@xwing/engine';
import { parseDial } from './dial';
import { getPilot, getShip } from './loaders';
import type { ShipData } from './types';

const SIZES: Record<string, BaseSize> = { Small: 'small', Medium: 'medium', Large: 'large' };

const ACTIONS: Record<string, ActionType> = {
  Focus: 'focus',
  'Target Lock': 'lock',
  'Barrel Roll': 'barrel-roll',
  Boost: 'boost',
  Evade: 'evade',
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
): ShipInit {
  const ship = getShip(shipXws);
  const pilot = getPilot(shipXws, pilotXws);
  return {
    id,
    ownerId,
    shipType: ship.xws,
    pilot: pilot.name,
    initiative: pilot.initiative,
    base: SIZES[ship.size] ?? 'small',
    primaryAttack: statValue(ship, 'attack'),
    agility: statValue(ship, 'agility'),
    hull: statValue(ship, 'hull'),
    shields: statValue(ship, 'shields'),
    pos,
    actionBar: actionBar(ship),
    dialOptions: parseDial(ship.dial),
  };
}
