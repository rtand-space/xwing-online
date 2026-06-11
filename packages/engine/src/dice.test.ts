import { describe, expect, it } from 'vitest';
import { rollAttack, rollDefence } from './dice';

const ATTACK = new Set(['hit', 'crit', 'focus', 'blank']);
const DEFENCE = new Set(['evade', 'focus', 'blank']);

describe('dice', () => {
  it('rolls the requested count with valid faces', () => {
    const a = rollAttack('s', 0, 3);
    expect(a).toHaveLength(3);
    expect(a.every((f) => ATTACK.has(f))).toBe(true);

    const d = rollDefence('s', 0, 2);
    expect(d).toHaveLength(2);
    expect(d.every((f) => DEFENCE.has(f))).toBe(true);
  });

  it('is deterministic — a replay reproduces identical results without re-rolling', () => {
    expect(rollAttack('s', 5, 4)).toEqual(rollAttack('s', 5, 4));
  });

  it('draws each die independently by absolute cursor', () => {
    const window = rollAttack('s', 0, 2);
    expect(rollAttack('s', 0, 1)[0]).toBe(window[0]);
    expect(rollAttack('s', 1, 1)[0]).toBe(window[1]);
  });

  it('has a roughly correct face distribution', () => {
    const faces = rollAttack('dist', 0, 8000);
    const hitRate = faces.filter((f) => f === 'hit').length / faces.length;
    expect(hitRate).toBeGreaterThan(0.3); // expected 3/8 = 0.375
    expect(hitRate).toBeLessThan(0.45);
  });
});
