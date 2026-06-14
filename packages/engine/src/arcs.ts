import { basePolygon, heading, polygonDistance, type Vec } from './geometry';
import type { ArcKind, Position, Ship, ShipArc, ShipWeapon, TurretFacing } from './types';

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

/** Shortest signed difference a−b, in (−180, 180]. */
function angleDiff(a: number, b: number): number {
  let d = (a - b) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

/**
 * Arc test: any part of the target's base inside the wedge of half-width `halfAngleDeg`
 * centred `centreDeg` off the attacker's facing (0 = ahead, +90 = right, 180 = behind).
 * True if a base corner lies in the wedge, or an arc edge crosses the base.
 */
export function inArcAt(
  attacker: Ship,
  target: Ship,
  centreDeg = 0,
  halfAngleDeg = 45,
): boolean {
  const poly = basePolygon(target.pos, target.base);
  if (poly.some((v) => Math.abs(angleDiff(bearingDeg(attacker.pos, v), centreDeg)) <= halfAngleDeg))
    return true;

  const apex: Vec = { x: attacker.pos.x, y: attacker.pos.y };
  const left = heading(attacker.pos.angle + centreDeg - halfAngleDeg);
  const right = heading(attacker.pos.angle + centreDeg + halfAngleDeg);
  return poly.some((p, i) => {
    const q = poly[(i + 1) % poly.length]!;
    return rayHitsSegment(apex, left, p, q) || rayHitsSegment(apex, right, p, q);
  });
}

/** Front-arc test (kept for callers that only care about the standard ±45 arc). */
export function inArc(attacker: Ship, target: Ship, halfAngleDeg = 45): boolean {
  return inArcAt(attacker, target, 0, halfAngleDeg);
}

const FACING_DEG: Record<TurretFacing, number> = { front: 0, right: 90, rear: 180, left: -90 };

/** The ship's firing arcs, defaulting to a single front arc from primaryAttack. */
export function shipArcs(s: Ship): ShipArc[] {
  return s.arcs && s.arcs.length > 0 ? s.arcs : [{ kind: 'front', value: s.primaryAttack }];
}

export function arcContains(a: Ship, t: Ship, kind: ArcKind, facing: TurretFacing): boolean {
  switch (kind) {
    case 'front':
      return inArcAt(a, t, 0, 45);
    case 'rear':
      return inArcAt(a, t, 180, 45);
    case 'full-front':
      return inArcAt(a, t, 0, 90);
    case 'bullseye':
      return inBullseye(a, t);
    case 'single-turret':
      return inArcAt(a, t, FACING_DEG[facing], 45);
    case 'double-turret':
      return facing === 'left' || facing === 'right'
        ? inArcAt(a, t, 90, 45) || inArcAt(a, t, -90, 45)
        : inArcAt(a, t, 0, 45) || inArcAt(a, t, 180, 45);
  }
}

/** Best (max) primary attack value reaching `target` across the attacker's arcs,
 *  or null when no arc bears on it. */
export function attackValue(a: Ship, t: Ship): number | null {
  const facing = a.turretArc ?? 'front';
  let best: number | null = null;
  for (const arc of shipArcs(a)) {
    if (arcContains(a, t, arc.kind, facing)) best = Math.max(best ?? 0, arc.value);
  }
  return best;
}

/** Whether a secondary weapon bears on `target`: in its arc and within range band. */
export function weaponReaches(a: Ship, t: Ship, w: ShipWeapon): boolean {
  const band = rangeBand(a, t);
  if (band === null || band < w.minRange || band > w.maxRange) return false;
  return arcContains(a, t, w.arc, a.turretArc ?? 'front');
}

/** Whether the ship has a rotatable turret indicator. */
export function hasTurret(s: Ship): boolean {
  return shipArcs(s).some((arc) => arc.kind === 'single-turret' || arc.kind === 'double-turret');
}

/** The orientations a Rotate Arc may point this turret to (excluding the current one).
 *  A single turret can pick any of the four arcs; a double turret has two orientations
 *  (front/rear pair = 'front', left/right pair = 'right'). */
export function arcFacings(s: Ship): TurretFacing[] {
  if (!hasTurret(s)) return [];
  const cur = s.turretArc ?? 'front';
  if (shipArcs(s).some((arc) => arc.kind === 'double-turret')) {
    const orient = (f: TurretFacing): TurretFacing => (f === 'front' || f === 'rear' ? 'front' : 'right');
    return (['front', 'right'] as TurretFacing[]).filter((f) => f !== orient(cur));
  }
  return (['front', 'right', 'rear', 'left'] as TurretFacing[]).filter((f) => f !== cur);
}

/** Next turret orientation for the Rotate Arc action: double turrets toggle their
 *  two opposite arcs; single turrets cycle through the four arcs. */
export function nextFacing(s: Ship): TurretFacing {
  const cur = s.turretArc ?? 'front';
  if (shipArcs(s).some((arc) => arc.kind === 'double-turret')) {
    return cur === 'front' || cur === 'rear' ? 'right' : 'front';
  }
  const order: TurretFacing[] = ['front', 'right', 'rear', 'left'];
  return order[(order.indexOf(cur) + 1) % 4]!;
}

/** Edge-to-edge distance between two ships' bases, in millimetres. */
export function baseDistance(a: Ship, b: Ship): number {
  return polygonDistance(basePolygon(a.pos, a.base), basePolygon(b.pos, b.base));
}

/** Range band 1/2/3, or null if beyond range 3. */
export function rangeBand(a: Ship, b: Ship): number | null {
  const d = baseDistance(a, b);
  if (d < 1) return 0; // bases touching/overlapping = range 0 (a bump)
  const band = Math.floor(d / RANGE_BAND_MM) + 1;
  return band <= 3 ? band : null;
}

/** Whether `b` is within range `max` of `a` (inclusive). */
export function inRange(a: Ship, b: Ship, max: number): boolean {
  const band = rangeBand(a, b);
  return band !== null && band <= max;
}

/** Half-width of the bullseye corridor (≈ the range ruler's width), in mm. */
const BULLSEYE_HALF = 12;

/**
 * Bullseye arc: a narrow forward corridor the width of the range ruler, within
 * range 3 (per the Rules Reference). True if the target's base sits in the
 * corridor or straddles the attacker's centreline ahead of it.
 */
export function inBullseye(attacker: Ship, target: Ship): boolean {
  if (rangeBand(attacker, target) === null) return false;
  const a = attacker.pos.angle * DEG;
  const fwd: Vec = { x: Math.sin(a), y: Math.cos(a) };
  const right: Vec = { x: Math.cos(a), y: -Math.sin(a) };
  let near = false;
  let left = false;
  let rightSide = false;
  for (const v of basePolygon(target.pos, target.base)) {
    const dx = v.x - attacker.pos.x;
    const dy = v.y - attacker.pos.y;
    if (dx * fwd.x + dy * fwd.y <= 0) continue; // behind the attacker
    const lat = dx * right.x + dy * right.y;
    if (Math.abs(lat) <= BULLSEYE_HALF) near = true;
    if (lat <= 0) left = true;
    if (lat >= 0) rightSide = true;
  }
  return near || (left && rightSide);
}
