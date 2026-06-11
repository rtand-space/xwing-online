import { describe, expect, it } from 'vitest';
import { basePolygon, polygonDistance, polygonsOverlap } from './geometry';

const small = (x: number, y: number, angle = 0) => basePolygon({ x, y, angle }, 'small');

describe('geometry', () => {
  it('computes a centred 40mm square base', () => {
    const poly = small(0, 0);
    expect(poly).toContainEqual({ x: -20, y: -20 });
    expect(poly).toContainEqual({ x: 20, y: 20 });
  });

  it('detects overlap, treats touching as clear', () => {
    expect(polygonsOverlap(small(0, 0), small(30, 0))).toBe(true);
    expect(polygonsOverlap(small(0, 0), small(40, 0))).toBe(false); // edges touch
    expect(polygonsOverlap(small(0, 0), small(50, 0))).toBe(false);
  });

  it('measures edge-to-edge distance, 0 when overlapping', () => {
    expect(polygonDistance(small(0, 0), small(50, 0))).toBeCloseTo(10);
    expect(polygonDistance(small(0, 0), small(30, 0))).toBe(0);
  });
});
