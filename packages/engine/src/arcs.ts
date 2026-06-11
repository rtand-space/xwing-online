import { basePolygon, polygonDistance, type Vec } from './geometry';
import type { Position, Ship } from './types';

const DEG = Math.PI / 180;

/** One range band is one ruler segment. */
export const RANGE_BAND_MM = 100;

/** Signed bearing to a point relative to a facing: 0 = dead ahead, + = to the right. */
export function bearingDeg(from: Position, to: Vec): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const a = from.angle * DEG;
  const forward = dx * Math.sin(a) + dy * Math.cos(a);
  const right = dx * Math.cos(a) - dy * Math.sin(a);
  return Math.atan2(right, forward) / DEG;
}

/** Front-arc test: target centre within ±halfAngle of the attacker's facing. */
export function inArc(attacker: Ship, target: Ship, halfAngleDeg = 45): boolean {
  return Math.abs(bearingDeg(attacker.pos, target.pos)) <= halfAngleDeg;
}

/** Edge-to-edge distance between two ships' bases, in millimetres. */
export function baseDistance(a: Ship, b: Ship): number {
  return polygonDistance(basePolygon(a.pos, a.base), basePolygon(b.pos, b.base));
}

/** Range band 1/2/3, or null if beyond range 3. */
export function rangeBand(a: Ship, b: Ship): number | null {
  const band = Math.floor(baseDistance(a, b) / RANGE_BAND_MM) + 1;
  return band <= 3 ? band : null;
}
