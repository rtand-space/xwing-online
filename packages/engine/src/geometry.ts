import type { BaseSize, Position } from './types';

export interface Vec {
  x: number;
  y: number;
}

/** Square base widths in millimetres. */
export const BASE_MM: Record<BaseSize, number> = { small: 40, medium: 60, large: 80 };

const DEG = Math.PI / 180;

/** Unit heading for an angle measured clockwise from +y (north). */
export function heading(angleDeg: number): Vec {
  const a = angleDeg * DEG;
  return { x: Math.sin(a), y: Math.cos(a) };
}

export function normalizeAngle(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** The four world-space corners of a ship's square base. */
export function basePolygon(pos: Position, base: BaseSize): Vec[] {
  const half = BASE_MM[base] / 2;
  const a = pos.angle * DEG;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const corners: Vec[] = [
    { x: -half, y: -half },
    { x: half, y: -half },
    { x: half, y: half },
    { x: -half, y: half },
  ];
  // rotate by clockwise-from-north angle, then translate
  return corners.map((c) => ({
    x: pos.x + c.x * cos + c.y * sin,
    y: pos.y - c.x * sin + c.y * cos,
  }));
}

function axes(poly: Vec[]): Vec[] {
  return poly.map((p, i) => {
    const q = poly[(i + 1) % poly.length]!;
    return { x: -(q.y - p.y), y: q.x - p.x };
  });
}

function project(poly: Vec[], axis: Vec): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const p of poly) {
    const d = p.x * axis.x + p.y * axis.y;
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return { min, max };
}

/** Separating Axis Theorem for two convex polygons. Touching is not overlap. */
export function polygonsOverlap(a: Vec[], b: Vec[]): boolean {
  for (const axis of [...axes(a), ...axes(b)]) {
    const pa = project(a, axis);
    const pb = project(b, axis);
    if (pa.max <= pb.min || pb.max <= pa.min) return false;
  }
  return true;
}

export function pointSegmentDistance(p: Vec, a: Vec, b: Vec): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  const t =
    len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2));
  return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby));
}

function pointInPolygon(p: Vec, poly: Vec[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/** Does a circle overlap a convex polygon? (Touching counts as overlap, like the tokens.) */
export function circleOverlapsPolygon(c: Vec, r: number, poly: Vec[]): boolean {
  if (pointInPolygon(c, poly)) return true;
  for (let i = 0; i < poly.length; i++) {
    if (pointSegmentDistance(c, poly[i]!, poly[(i + 1) % poly.length]!) <= r) return true;
  }
  return false;
}

/** Does the segment a→b pass within `r` of centre `c`? */
export function segmentCircleIntersect(a: Vec, b: Vec, c: Vec, r: number): boolean {
  return pointSegmentDistance(c, a, b) <= r;
}

/** Closest edge-to-edge distance between two convex polygons; 0 if overlapping. */
export function polygonDistance(a: Vec[], b: Vec[]): number {
  if (polygonsOverlap(a, b)) return 0;
  let min = Infinity;
  const edges = (poly: Vec[]): [Vec, Vec][] =>
    poly.map((p, i) => [p, poly[(i + 1) % poly.length]!]);
  for (const v of a)
    for (const [p, q] of edges(b)) min = Math.min(min, pointSegmentDistance(v, p, q));
  for (const v of b)
    for (const [p, q] of edges(a)) min = Math.min(min, pointSegmentDistance(v, p, q));
  return min;
}
