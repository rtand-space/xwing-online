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
  /** Reverse maneuvers slide the ship backward (template seats at the front). */
  reverse?: boolean;
}

/** A template (or its leading fraction `t`) as a local displacement + heading change. */
function arcAt(radius: number, phiDeg: number, dir: 1 | -1, t: number): Local {
  const phi = phiDeg * t * DEG;
  return {
    dx: dir * radius * (1 - Math.cos(phi)),
    dy: radius * Math.sin(phi),
    drive: dir * phiDeg * t,
    post: 0,
  };
}

/** The maneuver's leading fraction `t` (t=1 is the full template). Arcs scale along
 *  their curve, so collision back-off follows the real path, not a chord. A trailing
 *  in-place flip (K-turn / Segnor's) only happens once the template is fully traced. */
function localAt(m: Maneuver, t: number): Local {
  const flip = (deg: number): number => (t >= 1 ? deg : 0);
  switch (m.bearing) {
    case 'stationary':
      return { dx: 0, dy: 0, drive: 0, post: 0 };
    case 'straight':
      return { dx: 0, dy: STRAIGHT_MM[m.speed] * t, drive: 0, post: 0 };
    case 'koiogran':
      return { dx: 0, dy: STRAIGHT_MM[m.speed] * t, drive: 0, post: flip(180) };
    case 'bank-left':
      return arcAt(BANK_RADIUS[m.speed], 45, -1, t);
    case 'bank-right':
      return arcAt(BANK_RADIUS[m.speed], 45, 1, t);
    case 'turn-left':
      return arcAt(TURN_RADIUS[m.speed], 90, -1, t);
    case 'turn-right':
      return arcAt(TURN_RADIUS[m.speed], 90, 1, t);
    // Segnor's Loop: bank, then flip 180° in place.
    case 'segnors-loop-left':
      return { ...arcAt(BANK_RADIUS[m.speed], 45, -1, t), post: flip(180) };
    case 'segnors-loop-right':
      return { ...arcAt(BANK_RADIUS[m.speed], 45, 1, t), post: flip(180) };
    // Tallon Roll: approximated as a hard turn pending full R4 maneuver geometry.
    case 'tallon-roll-left':
      return arcAt(TURN_RADIUS[m.speed], 90, -1, t);
    case 'tallon-roll-right':
      return arcAt(TURN_RADIUS[m.speed], 90, 1, t);
    // Reverse: slide backward; banks add the bank's turn. Approximate pending R4.
    case 'reverse-straight':
      return { dx: 0, dy: STRAIGHT_MM[m.speed] * t, drive: 0, post: 0, reverse: true };
    case 'reverse-bank-left':
      return { ...arcAt(BANK_RADIUS[m.speed], 45, -1, t), reverse: true };
    case 'reverse-bank-right':
      return { ...arcAt(BANK_RADIUS[m.speed], 45, 1, t), reverse: true };
  }
}

const norm360 = (deg: number): number => ((deg % 360) + 360) % 360;

/** Rigid placement of a local template displacement: the template seats against the
 *  front of the base and the ship's rear ends at the template's end. */
function place(pos: Position, l: Local, base: BaseSize): Position {
  const half = BASE_MM[base] / 2;
  const a0 = pos.angle * DEG;
  const fwd0 = { x: Math.sin(a0), y: Math.cos(a0) };
  const right0 = { x: Math.cos(a0), y: -Math.sin(a0) };
  const a1 = (pos.angle + l.drive) * DEG;
  const fwd1 = { x: Math.sin(a1), y: Math.cos(a1) };
  const s = l.reverse ? -1 : 1;
  return {
    x: pos.x + s * (half * fwd0.x + l.dx * right0.x + l.dy * fwd0.x + half * fwd1.x),
    y: pos.y + s * (half * fwd0.y + l.dx * right0.y + l.dy * fwd0.y + half * fwd1.y),
    angle: norm360(pos.angle + l.drive + l.post),
  };
}

/**
 * Full placement: the centre advances by the template plus half a base on entry and
 * exit (one full base for a straight move). A stationary 0-speed maneuver doesn't move.
 */
export function applyManeuver(pos: Position, m: Maneuver, base: BaseSize): Position {
  const l = localAt(m, 1);
  if (l.dx === 0 && l.dy === 0 && l.drive === 0 && l.post === 0) return { ...pos };
  return place(pos, l, base);
}

/** Placement at the leading fraction `t` of the maneuver — for collision back-off
 *  (the "railroad" method: slide the ship back along the template's actual path). */
export function pathAt(pos: Position, m: Maneuver, t: number, base: BaseSize): Position {
  if (t <= 0) return { ...pos };
  const l = localAt(m, t);
  if (l.dx === 0 && l.dy === 0 && l.drive === 0 && l.post === 0) return { ...pos };
  return place(pos, l, base);
}
