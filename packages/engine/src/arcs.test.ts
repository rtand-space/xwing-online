import { describe, expect, it } from 'vitest';
import { baseDistance, bearingDeg, inArc, rangeBand } from './arcs';
import type { Ship } from './types';

const mk = (x: number, y: number, angle = 0): Ship => ({
  id: 's',
  ownerId: 'p',
  shipType: 't',
  pilot: '',
  initiative: 1,
  base: 'small',
  primaryAttack: 0,
  agility: 0,
  hull: 1,
  shields: 0,
  maxHull: 1,
  maxShields: 0,
  charges: 0,
  maxCharges: 0,
  recurring: 0,
  pos: { x, y, angle },
  actionBar: [],
  dialOptions: [],
  tokens: [],
  dialRevealed: false,
  hasMoved: false,
  hasActed: false,
  hasEngaged: false,
});

describe('arcs and range', () => {
  it('signs bearing positive to the right', () => {
    expect(bearingDeg({ x: 0, y: 0, angle: 0 }, { x: 0, y: 100 })).toBeCloseTo(0);
    expect(bearingDeg({ x: 0, y: 0, angle: 0 }, { x: 100, y: 100 })).toBeCloseTo(45);
    expect(bearingDeg({ x: 0, y: 0, angle: 0 }, { x: -100, y: 100 })).toBeCloseTo(-45);
  });

  it('tests the front arc against the half-angle', () => {
    const attacker = mk(0, 0, 0);
    expect(inArc(attacker, mk(0, 200))).toBe(true);
    expect(inArc(attacker, mk(200, 200))).toBe(true); // exactly 45°
    expect(inArc(attacker, mk(200, 50))).toBe(false);
    expect(inArc(attacker, mk(0, -200))).toBe(false); // behind
  });

  it('counts a target whose base clips the arc even if its centre is outside', () => {
    const attacker = mk(0, 0, 0);
    // centre at ~50° (outside the 45° line) but a near corner falls inside
    expect(inArc(attacker, mk(120, 100))).toBe(true);
    // fully off to the side: no part of the base in the wedge
    expect(inArc(attacker, mk(400, 80))).toBe(false);
  });

  it('buckets distance into range bands 1/2/3, null beyond', () => {
    const a = mk(0, 0);
    expect(baseDistance(a, mk(0, 90))).toBeCloseTo(50);
    expect(rangeBand(a, mk(0, 90))).toBe(1);
    expect(rangeBand(a, mk(0, 150))).toBe(2);
    expect(rangeBand(a, mk(0, 250))).toBe(3);
    expect(rangeBand(a, mk(0, 400))).toBeNull();
  });
});
