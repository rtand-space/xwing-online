import { describe, expect, it } from 'vitest';
import { rngAt } from './rng';

describe('rngAt', () => {
  it('is deterministic in (seed, index)', () => {
    expect(rngAt('a', 0)).toBe(rngAt('a', 0));
    expect(rngAt('a', 1)).not.toBe(rngAt('a', 0));
    expect(rngAt('a', 0)).not.toBe(rngAt('b', 0));
  });

  it('returns floats in [0, 1)', () => {
    for (let i = 0; i < 500; i++) {
      const v = rngAt('seed', i);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
