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

// small base = 40mm, so a straight move advances template length + one base length.
describe('maneuver templates (rear-of-base seats at the template end)', () => {
  it('straight advances template length + one base, keeping facing', () => {
    expectPos(applyManeuver(origin, m(3, 'straight'), 'small'), { x: 0, y: 160, angle: 0 });
  });

  it('hard turns sweep 90° with the base offset on entry and exit', () => {
    expectPos(applyManeuver(origin, m(1, 'turn-right'), 'small'), { x: 60, y: 60, angle: 90 });
    expectPos(applyManeuver(origin, m(1, 'turn-left'), 'small'), { x: -60, y: 60, angle: 270 });
  });

  it('koiogran goes straight (+base) then flips 180°', () => {
    expectPos(applyManeuver(origin, m(2, 'koiogran'), 'small'), { x: 0, y: 120, angle: 180 });
  });

  it("Segnor's Loop banks then flips 180°", () => {
    const r = applyManeuver(origin, m(2, 'segnors-loop-left'), 'small');
    expect(r.x).toBeLessThan(0); // displaced left
    expect(r.y).toBeGreaterThan(0); // advanced forward
    expect(r.angle).toBeCloseTo(135); // bank-left (−45) then +180
  });

  it('reverse-straight slides backward without turning', () => {
    expectPos(applyManeuver(origin, m(1, 'reverse-straight'), 'small'), { x: 0, y: -80, angle: 0 });
  });

  it('applies the rigid transform relative to current facing', () => {
    const facingEast: Position = { x: 100, y: 200, angle: 90 };
    expectPos(applyManeuver(facingEast, m(2, 'straight'), 'small'), { x: 220, y: 200, angle: 90 });
    expectPos(applyManeuver(facingEast, m(1, 'turn-right'), 'small'), {
      x: 160,
      y: 140,
      angle: 180,
    });
  });

  it('pathAt(t=1) equals the full maneuver; t=0 is the start', () => {
    const full = applyManeuver(origin, m(2, 'bank-left'), 'small');
    expectPos(pathAt(origin, m(2, 'bank-left'), 1, 'small'), full);
    expectPos(pathAt(origin, m(2, 'bank-left'), 0, 'small'), origin);
  });

  it('a 0-speed stationary stop does not move the ship', () => {
    const start: Position = { x: 30, y: -20, angle: 90 };
    expectPos(applyManeuver(start, m(0, 'stationary'), 'large'), start);
  });

  it('pathAt follows the template arc, not the straight chord (railroad back-off)', () => {
    const turn = m(1, 'turn-right');
    const full = applyManeuver(origin, turn, 'small');
    const mid = pathAt(origin, turn, 0.5, 'small');
    // the heading rotates proportionally either way (half of 90°)
    expect(mid.angle).toBeCloseTo(full.angle / 2);
    // but the position bulges along the arc, well past the chord midpoint
    const chordY = (origin.y + full.y) / 2;
    expect(mid.y).toBeGreaterThan(chordY + 20);
  });
});
