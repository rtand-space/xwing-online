import type {
  ActionLink,
  ActionType,
  ArcKind,
  BaseSize,
  Difficulty,
  Position,
  ShipArc,
  ShipInit,
} from '@xwing/engine';
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
  Cloak: 'cloak',
  'Rotate Arc': 'rotate-arc',
  Jam: 'jam',
  Reload: 'reload',
  Coordinate: 'coordinate',
  SLAM: 'slam',
};

const DIFFICULTY: Record<string, Difficulty> = {
  White: 'white',
  Red: 'red',
  Purple: 'purple',
};

const ARCS: Record<string, ArcKind> = {
  'Front Arc': 'front',
  'Rear Arc': 'rear',
  'Full Front Arc': 'full-front',
  'Bullseye Arc': 'bullseye',
  'Single Turret Arc': 'single-turret',
  'Double Turret Arc': 'double-turret',
};

function statValue(ship: ShipData, type: string): number {
  return ship.stats.find((s) => s.type === type)?.value ?? 0;
}

/** Primary-weapon firing arcs from the ship's attack stats. */
function shipArcs(ship: ShipData): ShipArc[] {
  const arcs: ShipArc[] = [];
  for (const s of ship.stats) {
    if (s.type !== 'attack') continue;
    const kind = ARCS[s.arc ?? 'Front Arc'];
    if (kind) arcs.push({ kind, value: s.value });
  }
  return arcs;
}

function actionBar(ship: ShipData): ActionType[] {
  const bar: ActionType[] = [];
  for (const a of ship.actions) {
    const mapped = ACTIONS[a.type];
    if (mapped && !bar.includes(mapped)) bar.push(mapped);
  }
  return bar;
}

function actionDifficulty(ship: ShipData): Partial<Record<ActionType, Difficulty>> {
  const out: Partial<Record<ActionType, Difficulty>> = {};
  for (const a of ship.actions) {
    const mapped = ACTIONS[a.type];
    if (mapped) out[mapped] = DIFFICULTY[a.difficulty] ?? 'white';
  }
  return out;
}

function actionLinks(ship: ShipData): Partial<Record<ActionType, ActionLink>> {
  const out: Partial<Record<ActionType, ActionLink>> = {};
  for (const a of ship.actions) {
    const base = ACTIONS[a.type];
    const linked = a.linked && ACTIONS[a.linked.type];
    if (base && a.linked && linked) {
      out[base] = { action: linked, difficulty: DIFFICULTY[a.linked.difficulty] ?? 'white' };
    }
  }
  return out;
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
  const arcs = shipArcs(ship);
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
    arcs,
    turretArc: arcs.some((a) => a.kind === 'single-turret' || a.kind === 'double-turret')
      ? 'front'
      : undefined,
    agility: statValue(ship, 'agility'),
    hull: statValue(ship, 'hull'),
    shields: statValue(ship, 'shields'),
    upgradeCharges,
    maxForce: pilot.force?.value ?? 0,
    force: pilot.force?.value ?? 0,
    forceRecovers: pilot.force?.recovers ?? 0,
    pos,
    actionBar: actionBar(ship),
    actionDifficulty: actionDifficulty(ship),
    actionLinks: actionLinks(ship),
    dialOptions: parseDial(ship.dial),
  };
}
