import { describe, expect, it } from 'vitest';
import { applyEvent, computePending, reduce, repositionCandidates, xwing } from './index';
import type { GameState, Ship } from './index';

const ship = (id: string, owner: string, x: number, y: number, bar: Ship['actionBar']): Ship => ({
  ...xwing(id, owner, 1, { x, y, angle: 0 }),
  maxHull: 4,
  maxShields: 0,
  shields: 0,
  charges: 0,
  maxCharges: 0,
  recurring: 0,
  actionBar: bar,
  tokens: [],
  dialRevealed: false,
  hasMoved: true, // ready for its action step
  hasActed: false,
  hasEngaged: false,
});

const stateWith = (ships: Ship[]): GameState => ({
  id: 'g',
  rng: { seed: 's', cursor: 0 },
  round: 1,
  phase: 'activation',
  players: [
    { id: 'p', name: 'P' },
    { id: 'q', name: 'Q' },
  ],
  ships,
  obstacles: [],
  pending: [],
  gameOver: false,
});

describe('boost reposition', () => {
  it('offers straight + both banks when clear', () => {
    const c = repositionCandidates(stateWith([ship('a', 'p', 0, 0, ['boost'])]), {
      ...ship('a', 'p', 0, 0, ['boost']),
    }, 'boost');
    expect(c.map((x) => x.label)).toEqual(['straight', 'bank-left', 'bank-right']);
    expect(c[0]!.to.y).toBeCloseTo(80); // 40 template + 40 base
  });

  it('drops a placement that would overlap another ship', () => {
    const a = ship('a', 'p', 0, 0, ['boost']);
    const blocker = ship('b', 'q', 0, 80, []); // sits on the straight boost
    const c = repositionCandidates(stateWith([a, blocker]), a, 'boost');
    expect(c.map((x) => x.label)).not.toContain('straight');
  });
});

describe('barrel roll reposition', () => {
  it('slides one template + base to each clear side', () => {
    const a = ship('a', 'p', 0, 0, ['barrel-roll']);
    const c = repositionCandidates(stateWith([a]), a, 'barrel-roll');
    expect(c.map((x) => x.label)).toEqual(['left', 'right']);
    expect(c.find((x) => x.label === 'right')!.to.x).toBeCloseTo(80);
    expect(c.find((x) => x.label === 'right')!.to.angle).toBe(0); // facing unchanged
  });
});

describe('reposition wired into the action step', () => {
  it('boost pauses for a placement choice, then moves and ends the action', () => {
    let s = stateWith([ship('a', 'p', 0, 0, ['boost', 'focus']), ship('z', 'q', 0, 600, [])]);
    s = { ...s, pending: computePending(s) };
    expect(s.pending[0]!.type).toBe('perform-action');

    const r1 = reduce(s, { type: 'PerformAction', playerId: 'p', shipId: 'a', action: 'boost' });
    for (const e of r1.events) s = applyEvent(s, e);
    expect(s.pending[0]!.type).toBe('reposition'); // paused on the placement choice
    expect(s.ships[0]!.hasActed).toBe(false);

    const r2 = reduce(s, { type: 'Reposition', playerId: 'p', shipId: 'a', choice: 1 }); // bank-left
    for (const e of r2.events) s = applyEvent(s, e);
    const a = s.ships[0]!;
    expect(a.hasActed).toBe(true);
    expect(a.pos).not.toEqual({ x: 0, y: 0, angle: 0 });
    expect(s.reposition).toBeUndefined();
  });

  it('omits a reposition action with no legal placement', () => {
    const a = ship('a', 'p', 0, 0, ['barrel-roll', 'focus']);
    const left = ship('l', 'q', -80, 0, []);
    const right = ship('r', 'q', 80, 0, []);
    const pending = computePending(stateWith([a, left, right]));
    const act = pending.find((p) => p.type === 'perform-action');
    expect(act && act.type === 'perform-action' && act.options.actions).toEqual(['focus']);
  });
});
