import type { Maneuver, Position, Speed } from './types';

const DEG = Math.PI / 180;

const STRAIGHT_MM: Record<Speed, number> = { 0: 0, 1: 40, 2: 80, 3: 120, 4: 160, 5: 200 };
const BANK_RADIUS: Record<Speed, number> = { 0: 0, 1: 80, 2: 120, 3: 160, 4: 200, 5: 240 };
const TURN_RADIUS: Record<Speed, number> = { 0: 0, 1: 40, 2: 80, 3: 120, 4: 160, 5: 200 };

/** Displacement in the ship's local frame (dx = right, dy = forward, dAngle clockwise). */
interface Local {
  dx: number;
  dy: number;
  dAngle: number;
}

function arc(radius: number, phiDeg: number, dir: 1 | -1): Local {
  const phi = phiDeg * DEG;
  return {
    dx: dir * radius * (1 - Math.cos(phi)),
    dy: radius * Math.sin(phi),
    dAngle: dir * phiDeg,
  };
}

/** The template's local displacement at progress t ∈ [0, 1]. */
function localAt(m: Maneuver, t: number): Local {
  switch (m.bearing) {
    case 'stationary':
      return { dx: 0, dy: 0, dAngle: 0 };
    case 'straight':
      return { dx: 0, dy: STRAIGHT_MM[m.speed] * t, dAngle: 0 };
    case 'koiogran':
      // straight forward, then a 180° flip applied at the end of the move
      return { dx: 0, dy: STRAIGHT_MM[m.speed] * t, dAngle: t >= 1 ? 180 : 0 };
    case 'bank-left':
      return arc(BANK_RADIUS[m.speed], 45 * t, -1);
    case 'bank-right':
      return arc(BANK_RADIUS[m.speed], 45 * t, 1);
    case 'turn-left':
      return arc(TURN_RADIUS[m.speed], 90 * t, -1);
    case 'turn-right':
      return arc(TURN_RADIUS[m.speed], 90 * t, 1);
  }
}

function place(pos: Position, l: Local): Position {
  const a = pos.angle * DEG;
  const fwd = { x: Math.sin(a), y: Math.cos(a) };
  const right = { x: Math.cos(a), y: -Math.sin(a) };
  return {
    x: pos.x + l.dx * right.x + l.dy * fwd.x,
    y: pos.y + l.dx * right.y + l.dy * fwd.y,
    angle: (((pos.angle + l.dAngle) % 360) + 360) % 360,
  };
}

/** Rigid transform: where a ship ends after fully executing a maneuver. */
export function applyManeuver(pos: Position, m: Maneuver): Position {
  return place(pos, localAt(m, 1));
}

/** Intermediate placement partway along the template — used for collision back-off. */
export function pathAt(pos: Position, m: Maneuver, t: number): Position {
  return place(pos, localAt(m, t));
}
