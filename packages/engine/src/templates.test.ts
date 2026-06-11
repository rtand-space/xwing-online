import { describe, expect, it } from 'vitest';
import { applyManeuver, pathAt } from './templates';
import type { Maneuver, Position } from './types';

const origin: Position = { x: 0, y: 0, angle: 0 };
const m = (speed: Maneuver['speed'], bearing: Maneuver['bearing']): Maneuver => ({
  speed,
  bearing,
  difficulty: 'white',
});

const expectPos = (actual: Position, expected: Position) => {
  expect(actual.x).toBeCloseTo(expected.x);
  expect(actual.y).toBeCloseTo(expected.y);
  expect(actual.angle).toBeCloseTo(expected.angle);
};

describe('maneuver templates', () => {
  it('straight keeps facing and advances along +y', () => {
    expectPos(applyManeuver(origin, m(3, 'straight')), { x: 0, y: 120, angle: 0 });
  });

  it('hard turns sweep 90° with a clean radius', () => {
    expectPos(applyManeuver(origin, m(1, 'turn-right')), { x: 40, y: 40, angle: 90 });
    expectPos(applyManeuver(origin, m(1, 'turn-left')), { x: -40, y: 40, angle: 270 });
  });

  it('banks sweep 45°', () => {
    const p = applyManeuver(origin, m(1, 'bank-right'));
    expect(p.x).toBeCloseTo(80 * (1 - Math.cos(Math.PI / 4)));
    expect(p.y).toBeCloseTo(80 * Math.sin(Math.PI / 4));
    expect(p.angle).toBeCloseTo(45);
  });

  it('koiogran goes straight then flips 180°', () => {
    expectPos(applyManeuver(origin, m(2, 'koiogran')), { x: 0, y: 80, angle: 180 });
  });

  it('applies the rigid transform relative to current facing', () => {
    const facingEast: Position = { x: 100, y: 200, angle: 90 };
    expectPos(applyManeuver(facingEast, m(2, 'straight')), { x: 180, y: 200, angle: 90 });
    expectPos(applyManeuver(facingEast, m(1, 'turn-right')), { x: 140, y: 160, angle: 180 });
  });

  it('pathAt(t=1) equals the full maneuver', () => {
    expect(pathAt(origin, m(2, 'bank-left'), 1)).toEqual(applyManeuver(origin, m(2, 'bank-left')));
  });
});
