import { basePolygon, heading, polygonDistance, type Vec } from './geometry';
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

/** Does a ray from `o` along `d` cross segment p1→p2? */
function rayHitsSegment(o: Vec, d: Vec, p1: Vec, p2: Vec): boolean {
  const ex = p2.x - p1.x;
  const ey = p2.y - p1.y;
  const denom = d.x * ey - d.y * ex;
  if (Math.abs(denom) < 1e-9) return false;
  const dfx = p1.x - o.x;
  const dfy = p1.y - o.y;
  const t = (dfx * ey - dfy * ex) / denom; // along the ray
  const u = (dfx * d.y - dfy * d.x) / denom; // along the segment
  return t >= 0 && u >= 0 && u <= 1;
}

/**
 * Front-arc test: any part of the target's base inside the ±halfAngle wedge from the
 * attacker's base centre. True if a base corner lies in the wedge, or an arc edge
 * crosses the base — so the slightest overlap counts, matching the drawn arc.
 */
export function inArc(attacker: Ship, target: Ship, halfAngleDeg = 45): boolean {
  const poly = basePolygon(target.pos, target.base);
  if (poly.some((v) => Math.abs(bearingDeg(attacker.pos, v)) <= halfAngleDeg)) return true;

  const apex: Vec = { x: attacker.pos.x, y: attacker.pos.y };
  const left = heading(attacker.pos.angle - halfAngleDeg);
  const right = heading(attacker.pos.angle + halfAngleDeg);
  return poly.some((p, i) => {
    const q = poly[(i + 1) % poly.length]!;
    return rayHitsSegment(apex, left, p, q) || rayHitsSegment(apex, right, p, q);
  });
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
