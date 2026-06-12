import { rollAttack } from './dice';
import type { GameEvent } from './events';
import { basePolygon, circleOverlapsPolygon, segmentCircleIntersect, type Vec } from './geometry';
import type { BaseSize, GameState, Obstacle, Position, Ship } from './types';

const centre = (o: Obstacle): Vec => ({ x: o.pos.x, y: o.pos.y });

/** Obstacles overlapping a base at `pos` — i.e. range 0. */
export function obstaclesAt(state: GameState, pos: Position, base: BaseSize): Obstacle[] {
  const poly = basePolygon(pos, base);
  return state.obstacles.filter((o) => circleOverlapsPolygon(centre(o), o.radius, poly));
}

/** Obstacles a ship moved through or ends overlapping (sampled start→end). */
function obstaclesTouched(state: GameState, ship: Ship, to: Position): Obstacle[] {
  if (state.obstacles.length === 0) return [];
  const hit = new Map<string, Obstacle>();
  const steps = 6;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const p: Position = {
      x: ship.pos.x + (to.x - ship.pos.x) * t,
      y: ship.pos.y + (to.y - ship.pos.y) * t,
      angle: ship.pos.angle + (to.angle - ship.pos.angle) * t,
    };
    for (const o of obstaclesAt(state, p, ship.base)) hit.set(o.id, o);
  }
  return [...hit.values()];
}

/**
 * XWA obstacle effects after a maneuver (Rules Reference v1.4.6):
 * - Asteroid: suffer 1 damage; roll 1 attack die, hit/crit ⇒ +1 damage.
 * - Debris cloud: gain 1 stress; roll 1 attack die, hit ⇒ 1 damage, crit ⇒ 1 crit damage.
 * (Gas clouds need strain/ion tokens — not yet modelled.)
 */
export function obstacleMoveEvents(state: GameState, ship: Ship, to: Position): GameEvent[] {
  const touched = obstaclesTouched(state, ship, to);
  if (touched.length === 0) return [];
  const events: GameEvent[] = [];
  let cursor = state.rng.cursor;
  let damage = 0;
  let crits = 0;
  let stress = 0;
  for (const o of touched) {
    events.push({ type: 'ObstacleHit', shipId: ship.id, obstacleId: o.id, kind: o.kind });
    const face = rollAttack(state.rng.seed, cursor, 1)[0]!;
    events.push({ type: 'DiceRolled', kind: 'attack', shipId: ship.id, faces: [face] });
    cursor++;
    if (o.kind === 'asteroid') {
      damage += 1;
      if (face === 'hit' || face === 'crit') damage += 1;
    } else {
      stress += 1;
      if (face === 'hit') damage += 1;
      else if (face === 'crit') {
        damage += 1;
        crits += 1;
      }
    }
  }
  if (stress > 0) events.push({ type: 'StressChanged', shipId: ship.id, delta: stress });
  if (damage > 0) {
    const shieldsAfter = Math.max(0, ship.shields - damage);
    const hullAfter = Math.max(0, ship.hull - Math.max(0, damage - ship.shields));
    events.push({
      type: 'DamageDealt',
      shipId: ship.id,
      amount: damage,
      shieldsAfter,
      hullAfter,
      crits,
    });
    if (hullAfter === 0 && ship.hull > 0) events.push({ type: 'ShipDestroyed', shipId: ship.id });
  }
  return events;
}

/** Is the line of fire between two ships obstructed by an obstacle? */
export function lineObstructed(state: GameState, a: Ship, b: Ship): boolean {
  return state.obstacles.some((o) => segmentCircleIntersect(a.pos, b.pos, centre(o), o.radius));
}
