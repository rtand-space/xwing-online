import { describe, expect, it } from 'vitest';
import { attackValue, baseDistance, bearingDeg, inArc, inBullseye, nextFacing, rangeBand } from './arcs';
import { applyEvent, computePending, reduce } from './index';
import type { GameState, Ship, ShipArc, TurretFacing } from './types';

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

  it('bullseye is a narrow forward corridor within range 3', () => {
    const a = mk(0, 0, 0);
    expect(inBullseye(a, mk(0, 100))).toBe(true); // dead ahead, straddles centreline
    expect(inBullseye(a, mk(8, 100))).toBe(true); // slightly off but within the corridor
    expect(inBullseye(a, mk(200, 100))).toBe(false); // off to the side
    expect(inBullseye(a, mk(0, -100))).toBe(false); // behind
    expect(inBullseye(a, mk(0, 400))).toBe(false); // beyond range 3
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

const withArcs = (x: number, y: number, arcs: ShipArc[], turretArc?: TurretFacing): Ship => ({
  ...mk(x, y, 0),
  arcs,
  turretArc,
});

describe('firing arcs and attack value', () => {
  const ahead = mk(0, 200);
  const behind = mk(0, -200);
  const right = mk(200, 0);
  const left = mk(-200, 0);

  it('defaults to a single front arc from primaryAttack', () => {
    const a: Ship = { ...mk(0, 0), primaryAttack: 3 };
    expect(attackValue(a, ahead)).toBe(3);
    expect(attackValue(a, behind)).toBeNull();
  });

  it('rear and full-front arcs bear where expected', () => {
    expect(attackValue(withArcs(0, 0, [{ kind: 'rear', value: 2 }]), behind)).toBe(2);
    expect(attackValue(withArcs(0, 0, [{ kind: 'rear', value: 2 }]), ahead)).toBeNull();
    const full = withArcs(0, 0, [{ kind: 'full-front', value: 3 }]);
    expect(attackValue(full, mk(220, 220))).toBe(3); // ~45° still within ±90
    expect(attackValue(full, behind)).toBeNull();
  });

  it('takes the best value across multiple arcs', () => {
    const a = withArcs(0, 0, [
      { kind: 'front', value: 3 },
      { kind: 'rear', value: 2 },
    ]);
    expect(attackValue(a, ahead)).toBe(3);
    expect(attackValue(a, behind)).toBe(2);
  });

  it('a single turret only bears where it points', () => {
    const a = withArcs(0, 0, [{ kind: 'single-turret', value: 2 }], 'right');
    expect(attackValue(a, right)).toBe(2);
    expect(attackValue(a, ahead)).toBeNull();
  });

  it('a double turret covers two opposite arcs and toggles', () => {
    const fr = withArcs(0, 0, [{ kind: 'double-turret', value: 3 }], 'front');
    expect(attackValue(fr, ahead)).toBe(3);
    expect(attackValue(fr, behind)).toBe(3);
    expect(attackValue(fr, right)).toBeNull();
    const lr = withArcs(0, 0, [{ kind: 'double-turret', value: 3 }], 'right');
    expect(attackValue(lr, right)).toBe(3);
    expect(attackValue(lr, left)).toBe(3);
    expect(attackValue(lr, ahead)).toBeNull();
  });

  it('rotate cycles single turrets and toggles double turrets', () => {
    const single = withArcs(0, 0, [{ kind: 'single-turret', value: 2 }], 'front');
    expect(nextFacing(single)).toBe('right');
    expect(nextFacing({ ...single, turretArc: 'left' })).toBe('front');
    const dbl = withArcs(0, 0, [{ kind: 'double-turret', value: 3 }], 'front');
    expect(nextFacing(dbl)).toBe('right');
    expect(nextFacing({ ...dbl, turretArc: 'right' })).toBe('front');
  });

  it('the rotate-arc action turns a turret toward a new target', () => {
    const a: Ship = {
      ...withArcs(0, 0, [{ kind: 'single-turret', value: 2 }], 'front'),
      id: 'a',
      ownerId: 'p',
      actionBar: ['rotate-arc'],
      hasMoved: true,
    };
    const d: Ship = { ...mk(200, 0), id: 'd', ownerId: 'q' };
    let s: GameState = {
      id: 'g',
      rng: { seed: 's', cursor: 0 },
      round: 1,
      phase: 'activation',
      players: [
        { id: 'p', name: 'P' },
        { id: 'q', name: 'Q' },
      ],
      ships: [a, d],
      obstacles: [],
      pending: [],
      gameOver: false,
    };
    s = { ...s, pending: computePending(s) };
    expect(attackValue(a, d)).toBeNull(); // turret points front, target is to the right
    const r = reduce(s, { type: 'PerformAction', playerId: 'p', shipId: 'a', action: 'rotate-arc' });
    for (const e of r.events) s = applyEvent(s, e);
    const a2 = s.ships.find((x) => x.id === 'a')!;
    expect(a2.turretArc).toBe('right');
    expect(attackValue(a2, s.ships.find((x) => x.id === 'd')!)).toBe(2);
  });
});
