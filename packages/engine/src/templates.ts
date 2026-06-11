import { BASE_MM } from './geometry';
import type { BaseSize, Maneuver, Position, Speed } from './types';

const DEG = Math.PI / 180;

const STRAIGHT_MM: Record<Speed, number> = { 0: 0, 1: 40, 2: 80, 3: 120, 4: 160, 5: 200 };
const BANK_RADIUS: Record<Speed, number> = { 0: 0, 1: 80, 2: 120, 3: 160, 4: 200, 5: 240 };
const TURN_RADIUS: Record<Speed, number> = { 0: 0, 1: 40, 2: 80, 3: 120, 4: 160, 5: 200 };

/**
 * Template displacement in the ship's local frame (dx = right, dy = forward),
 * the heading change along the template (`drive`), and any in-place rotation
 * applied afterwards (`post`, e.g. a K-turn's 180° flip).
 */
interface Local {
  dx: number;
  dy: number;
  drive: number;
  post: number;
}

function arc(radius: number, phiDeg: number, dir: 1 | -1): Local {
  const phi = phiDeg * DEG;
  return {
    dx: dir * radius * (1 - Math.cos(phi)),
    dy: radius * Math.sin(phi),
    drive: dir * phiDeg,
    post: 0,
  };
}

function template(m: Maneuver): Local {
  switch (m.bearing) {
    case 'stationary':
      return { dx: 0, dy: 0, drive: 0, post: 0 };
    case 'straight':
      return { dx: 0, dy: STRAIGHT_MM[m.speed], drive: 0, post: 0 };
    case 'koiogran':
      return { dx: 0, dy: STRAIGHT_MM[m.speed], drive: 0, post: 180 };
    case 'bank-left':
      return arc(BANK_RADIUS[m.speed], 45, -1);
    case 'bank-right':
      return arc(BANK_RADIUS[m.speed], 45, 1);
    case 'turn-left':
      return arc(TURN_RADIUS[m.speed], 90, -1);
    case 'turn-right':
      return arc(TURN_RADIUS[m.speed], 90, 1);
  }
}

const norm360 = (deg: number): number => ((deg % 360) + 360) % 360;

/**
 * Rigid placement: the template seats against the front of the base and the ship
 * is replaced with its rear at the template's end, so the centre advances by the
 * template plus half a base on entry and exit (one full base for a straight move).
 */
export function applyManeuver(pos: Position, m: Maneuver, base: BaseSize): Position {
  const l = template(m);
  const half = BASE_MM[base] / 2;
  const a0 = pos.angle * DEG;
  const fwd0 = { x: Math.sin(a0), y: Math.cos(a0) };
  const right0 = { x: Math.cos(a0), y: -Math.sin(a0) };
  const a1 = (pos.angle + l.drive) * DEG;
  const fwd1 = { x: Math.sin(a1), y: Math.cos(a1) };
  return {
    x: pos.x + half * fwd0.x + l.dx * right0.x + l.dy * fwd0.x + half * fwd1.x,
    y: pos.y + half * fwd0.y + l.dx * right0.y + l.dy * fwd0.y + half * fwd1.y,
    angle: norm360(pos.angle + l.drive + l.post),
  };
}

const shortestTurn = (from: number, to: number): number => ((to - from + 540) % 360) - 180;

/** Intermediate placement (lerp from start to the final placement) — for collision back-off. */
export function pathAt(pos: Position, m: Maneuver, t: number, base: BaseSize): Position {
  const end = applyManeuver(pos, m, base);
  return {
    x: pos.x + (end.x - pos.x) * t,
    y: pos.y + (end.y - pos.y) * t,
    angle: norm360(pos.angle + shortestTurn(pos.angle, end.angle) * t),
  };
}
