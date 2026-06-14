import { RANGE_BAND_MM } from './arcs';
import { type AttackFace, rollAttack } from './dice';
import type { GameEvent } from './events';
import { BASE_MM, basePolygon, circleOverlapsPolygon } from './geometry';
import type {
  Device,
  DevicePlacement,
  GameState,
  Position,
  Ship,
  ShipId,
} from './types';

const DEG = Math.PI / 180;
const STRAIGHT1 = 40; // the [1 straight] template length, in mm
const MINE_RADIUS = 12.5; // a device token's collision radius for overlap (mines)

const alive = (s: Ship): boolean => s.hull > 0;
const countHits = (faces: AttackFace[]): number => faces.filter((f) => f === 'hit').length;
const countHitsCrits = (faces: AttackFace[]): number =>
  faces.filter((f) => f === 'hit' || f === 'crit').length;

/** What one detonation does to one ship — aggregated before becoming events. */
interface Effect {
  shipId: ShipId;
  damage: number;
  crits: number;
  ion: number;
  strain: number;
}

interface DeviceDef {
  kind: 'bomb' | 'mine';
  /** Windows in which the device may be dropped/launched. */
  timing: ('system' | 'after-move')[];
  /** Placement templates the device supports. */
  modes: ('drop' | 'launch')[];
  /** Effects on each target ship (dice rolled per target where noted). */
  detonate: (
    targets: Ship[],
    seed: string,
    cursor: number,
  ) => { effects: Effect[]; dice: GameEvent[]; cursor: number };
}

const blank = (shipId: ShipId): Effect => ({ shipId, damage: 0, crits: 0, ion: 0, strain: 0 });

/** Roll n attack dice for `shipId`, returning the faces + the log event. */
function roll(
  shipId: ShipId,
  seed: string,
  cursor: number,
  n: number,
): { faces: AttackFace[]; event: GameEvent } {
  const faces = rollAttack(seed, cursor, n);
  return { faces, event: { type: 'DiceRolled', kind: 'attack', shipId, faces } };
}

// Behaviour is original paraphrase only — never the card text.
const REGISTRY: Record<string, DeviceDef> = {
  protonbombs: {
    kind: 'bomb',
    timing: ['system'],
    modes: ['drop'],
    detonate: (targets, _seed, cursor) => ({
      effects: targets.map((t) => ({ ...blank(t.id), damage: 1, crits: 1 })),
      dice: [],
      cursor,
    }),
  },
  ionbombs: {
    kind: 'bomb',
    timing: ['system'],
    modes: ['drop'],
    detonate: (targets, _seed, cursor) => ({
      effects: targets.map((t) => ({ ...blank(t.id), ion: 3 })),
      dice: [],
      cursor,
    }),
  },
  thermaldetonators: {
    kind: 'bomb',
    timing: ['system'],
    modes: ['drop'],
    detonate: (targets, seed, cursor) => {
      const dice: GameEvent[] = [];
      const effects = targets.map((t) => {
        const r = roll(t.id, seed, cursor, 2);
        cursor += 2;
        dice.push(r.event);
        return { ...blank(t.id), damage: 1 + countHits(r.faces), strain: 1 };
      });
      return { effects, dice, cursor };
    },
  },
  proximitymines: {
    kind: 'mine',
    timing: ['system'],
    modes: ['drop'],
    detonate: (targets, seed, cursor) => {
      const dice: GameEvent[] = [];
      const effects = targets.map((t) => {
        const r = roll(t.id, seed, cursor, 2);
        cursor += 2;
        dice.push(r.event);
        return { ...blank(t.id), damage: 1 + countHitsCrits(r.faces) };
      });
      return { effects, dice, cursor };
    },
  },
  connernets: {
    kind: 'mine',
    timing: ['system'],
    modes: ['drop'],
    detonate: (targets, _seed, cursor) => ({
      effects: targets.map((t) => ({ ...blank(t.id), damage: 1, ion: 3 })),
      dice: [],
      cursor,
    }),
  },
};

export const deviceDef = (xws: string): DeviceDef | undefined => REGISTRY[xws];

/** A device's drop/launch placement: a [1 straight] from the rear or front guides. */
export function placementPos(ship: Ship, mode: 'drop' | 'launch'): Position {
  const a = ship.pos.angle * DEG;
  const fwd = { x: Math.sin(a), y: Math.cos(a) };
  const dist = (mode === 'launch' ? 1 : -1) * (BASE_MM[ship.base] / 2 + STRAIGHT1);
  return { x: ship.pos.x + dist * fwd.x, y: ship.pos.y + dist * fwd.y, angle: ship.pos.angle };
}

const placementsFor = (ship: Ship, def: DeviceDef): DevicePlacement[] =>
  def.modes.map((mode) => ({ mode, pos: placementPos(ship, mode) }));

const hasCharge = (ship: Ship, xws: string): boolean => {
  const pool = ship.upgradeCharges?.[xws];
  return !pool || pool.charges > 0;
};

/** Devices this ship may drop in `window`: known, charged, with a placement. */
export function droppableDevices(
  ship: Ship,
  window: 'system' | 'after-move',
): { xws: string; name: string; placements: DevicePlacement[] }[] {
  const out: { xws: string; name: string; placements: DevicePlacement[] }[] = [];
  for (const d of ship.devices ?? []) {
    const def = REGISTRY[d.xws];
    if (!def || !def.timing.includes(window) || !hasCharge(ship, d.xws)) continue;
    const placements = placementsFor(ship, def);
    if (placements.length) out.push({ xws: d.xws, name: d.name, placements });
  }
  return out;
}

/** Living ships within range 0–1 of a point (a bomb's blast). */
function shipsInBlast(state: GameState, pos: Position): Ship[] {
  return state.ships.filter(
    (s) => alive(s) && circleOverlapsPolygon(pos, RANGE_BAND_MM, basePolygon(s.pos, s.base)),
  );
}

/** Mines a ship overlapped or moved through (sampled start→end), like obstaclesTouched. */
export function minesTouched(state: GameState, ship: Ship, to: Position): Device[] {
  const mines = (state.devices ?? []).filter((d) => d.kind === 'mine' && REGISTRY[d.xws]);
  if (mines.length === 0) return [];
  const hit = new Map<string, Device>();
  const steps = 6;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p: Position = {
      x: ship.pos.x + (to.x - ship.pos.x) * t,
      y: ship.pos.y + (to.y - ship.pos.y) * t,
      angle: ship.pos.angle + (to.angle - ship.pos.angle) * t,
    };
    const poly = basePolygon(p, ship.base);
    for (const m of mines) if (circleOverlapsPolygon(m.pos, MINE_RADIUS, poly)) hit.set(m.id, m);
  }
  return [...hit.values()];
}

/** Turn aggregated effects into damage/token events, computed against `state`. */
function effectEvents(state: GameState, effects: Effect[]): GameEvent[] {
  const byShip = new Map<ShipId, Effect>();
  for (const e of effects) {
    const acc = byShip.get(e.shipId) ?? blank(e.shipId);
    acc.damage += e.damage;
    acc.crits += e.crits;
    acc.ion += e.ion;
    acc.strain += e.strain;
    byShip.set(e.shipId, acc);
  }
  const events: GameEvent[] = [];
  for (const e of byShip.values()) {
    const ship = state.ships.find((s) => s.id === e.shipId);
    if (!ship || !alive(ship)) continue;
    if (e.damage > 0) {
      const shieldsAfter = Math.max(0, ship.shields - e.damage);
      const hullAfter = Math.max(0, ship.hull - Math.max(0, e.damage - ship.shields));
      events.push({
        type: 'DamageDealt',
        shipId: e.shipId,
        amount: e.damage,
        shieldsAfter,
        hullAfter,
        crits: e.crits,
      });
      if (hullAfter === 0 && ship.hull > 0) events.push({ type: 'ShipDestroyed', shipId: e.shipId });
    }
    for (let i = 0; i < e.ion; i++) events.push({ type: 'TokenGained', shipId: e.shipId, kind: 'ion' });
    for (let i = 0; i < e.strain; i++)
      events.push({ type: 'TokenGained', shipId: e.shipId, kind: 'strain' });
  }
  return events;
}

/** The next bomb to detonate (end of Activation), or null. One at a time so each
 *  detonation resolves against the updated state in the reduce loop. */
export function nextBombDetonation(state: GameState): GameEvent[] | null {
  const bombs = (state.devices ?? [])
    .filter((d) => d.kind === 'bomb' && REGISTRY[d.xws])
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  const d = bombs[0];
  if (!d) return null;
  const { effects, dice } = REGISTRY[d.xws]!.detonate(
    shipsInBlast(state, d.pos),
    state.rng.seed,
    state.rng.cursor,
  );
  return [
    { type: 'DeviceDetonated', deviceId: d.id, xws: d.xws },
    ...dice,
    ...effectEvents(state, effects),
  ];
}

/** Detonate every mine a ship touched this move, aggregating damage so shields are
 *  only spent once. `cursor` continues the rng past any dice already rolled this move. */
export function mineDetonation(
  state: GameState,
  mines: Device[],
  ship: Ship,
  cursor: number,
): GameEvent[] {
  if (mines.length === 0) return [];
  const events: GameEvent[] = [];
  const allEffects: Effect[] = [];
  for (const m of mines) {
    events.push({ type: 'DeviceDetonated', deviceId: m.id, xws: m.xws, shipId: ship.id });
    const r = REGISTRY[m.xws]!.detonate([ship], state.rng.seed, cursor);
    cursor = r.cursor;
    events.push(...r.dice);
    allEffects.push(...r.effects);
  }
  return [...events, ...effectEvents(state, allEffects)];
}

/** A stable, replay-safe device id derived from state (no module-global counter). */
export function deviceId(state: GameState, ship: Ship, xws: string): string {
  const n = (state.devices ?? []).filter((d) => d.ownerId === ship.ownerId && d.xws === xws).length;
  return `dev-${ship.id}-${state.round}-${xws}-${n}`;
}
