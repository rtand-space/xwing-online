import { describe, expect, it } from 'vitest';
import { applyEvent, computePending, reduce, xwing } from './index';
import type { GameState, Ship } from './index';

const ship = (id: string, owner: string, x: number, y: number, over: Partial<Ship> = {}): Ship => ({
  ...xwing(id, owner, 1, { x, y, angle: 0 }),
  maxHull: 4,
  maxShields: 0,
  shields: 0,
  charges: 0,
  maxCharges: 0,
  recurring: 0,
  actionBar: [],
  tokens: [],
  dialRevealed: false,
  hasMoved: true,
  hasActed: false,
  hasEngaged: false,
  ...over,
});

const stateWith = (ships: Ship[]): GameState => {
  const s: GameState = {
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
  };
  return { ...s, pending: computePending(s) };
};

const perform = (s: GameState, cmd: Parameters<typeof reduce>[1]): GameState => {
  const r = reduce(s, cmd);
  if (r.rejection) throw new Error(r.rejection);
  return r.events.reduce(applyEvent, s);
};

describe('jam action', () => {
  it('offers only enemies at range 1, and the target gains a jam token', () => {
    const a = ship('a', 'p', 0, 0, { actionBar: ['jam'] });
    const near = ship('e', 'q', 0, 60, { tokens: [{ kind: 'focus' }] }); // range 1
    const far = ship('f', 'q', 0, 600, {}); // out of range
    let s = stateWith([a, near, far]);
    const act = s.pending.find((p) => p.type === 'perform-action');
    expect(act?.type === 'perform-action' && act.options.jamTargets).toEqual(['e']);

    s = perform(s, { type: 'PerformAction', playerId: 'p', shipId: 'a', action: 'jam', targetId: 'e' });
    const e = s.ships.find((x) => x.id === 'e')!;
    expect(e.tokens.some((t) => t.kind === 'focus')).toBe(false); // jam stripped the green token
    expect(e.tokens.some((t) => t.kind === 'jam')).toBe(false);
  });

  it('is hidden when no enemy is in range', () => {
    const s = stateWith([ship('a', 'p', 0, 0, { actionBar: ['jam', 'focus'] }), ship('e', 'q', 0, 600)]);
    const act = s.pending.find((p) => p.type === 'perform-action');
    expect(act?.type === 'perform-action' && act.options.actions).toEqual(['focus']);
  });
});

describe('coordinate action', () => {
  it('grants a friendly ship at range 1–2 a free action without ending its activation', () => {
    const a = ship('a', 'p', 0, 0, { actionBar: ['coordinate'] });
    const friend = ship('b', 'p', 0, 150, { actionBar: ['focus'], hasMoved: false }); // range 2, not yet activated
    let s = stateWith([a, friend, ship('e', 'q', 0, 600)]);
    const act = s.pending.find((p) => p.type === 'perform-action' && p.shipId === 'a');
    expect(act?.type === 'perform-action' && act.options.coordinateTargets).toEqual(['b']);

    s = perform(s, {
      type: 'PerformAction',
      playerId: 'p',
      shipId: 'a',
      action: 'coordinate',
      targetId: 'b',
    });
    // the FSM now pauses for b's granted free action
    const granted = s.pending.find((p) => p.type === 'perform-action' && p.shipId === 'b');
    expect(granted?.type === 'perform-action' && granted.options.granted).toBe(true);

    s = perform(s, { type: 'PerformAction', playerId: 'p', shipId: 'b', action: 'focus' });
    const b = s.ships.find((x) => x.id === 'b')!;
    expect(b.tokens.some((t) => t.kind === 'focus')).toBe(true); // got the free focus
    expect(b.hasActed).toBe(false); // its own activation action is still available
    expect(s.grantedAction).toBeUndefined();
  });
});

describe('reload action', () => {
  it('recovers a charge on a depleted pool and gains a disarm token', () => {
    const a = ship('a', 'p', 0, 0, {
      actionBar: ['reload'],
      upgradeCharges: { protontorpedoes: { charges: 0, max: 1, recovers: 1 } },
    });
    let s = stateWith([a, ship('e', 'q', 0, 600)]);
    s = perform(s, { type: 'PerformAction', playerId: 'p', shipId: 'a', action: 'reload' });
    const ship2 = s.ships.find((x) => x.id === 'a')!;
    expect(ship2.upgradeCharges!.protontorpedoes!.charges).toBe(1);
    expect(ship2.tokens.some((t) => t.kind === 'disarm')).toBe(true);
  });
});

describe('action difficulty', () => {
  it('a red action gains a stress token', () => {
    const a = ship('a', 'p', 0, 0, {
      actionBar: ['barrel-roll'],
      actionDifficulty: { 'barrel-roll': 'red' },
    });
    let s = stateWith([a, ship('e', 'q', 0, 600)]);
    s = perform(s, { type: 'PerformAction', playerId: 'p', shipId: 'a', action: 'barrel-roll' });
    s = perform(s, { type: 'Reposition', playerId: 'p', shipId: 'a', choice: 0 });
    expect(s.ships[0]!.tokens.filter((t) => t.kind === 'stress')).toHaveLength(1);
  });

  it('a purple action is hidden without Force and spends Force when used', () => {
    const noForce = ship('a', 'p', 0, 0, {
      actionBar: ['focus'],
      actionDifficulty: { focus: 'purple' },
    });
    let s = stateWith([noForce, ship('e', 'q', 0, 600)]);
    let act = s.pending.find((p) => p.type === 'perform-action');
    expect(act?.type === 'perform-action' && act.options.actions).toEqual([]); // no Force → hidden

    const withForce = ship('a', 'p', 0, 0, {
      actionBar: ['focus'],
      actionDifficulty: { focus: 'purple' },
      force: 1,
      maxForce: 1,
    });
    s = stateWith([withForce, ship('e', 'q', 0, 600)]);
    act = s.pending.find((p) => p.type === 'perform-action');
    expect(act?.type === 'perform-action' && act.options.actions).toEqual(['focus']);
    s = perform(s, { type: 'PerformAction', playerId: 'p', shipId: 'a', action: 'focus' });
    expect(s.ships[0]!.force).toBe(0); // Force spent
  });
});

describe('linked actions', () => {
  it('offers a token link after the base action, charging the link difficulty', () => {
    // Focus, linked to a red Evade
    const a = ship('a', 'p', 0, 0, {
      actionBar: ['focus'],
      actionLinks: { focus: { action: 'evade', difficulty: 'red' } },
    });
    let s = stateWith([a, ship('e', 'q', 0, 600)]);
    s = perform(s, { type: 'PerformAction', playerId: 'p', shipId: 'a', action: 'focus' });
    // the base focus is done and a linked evade is now offered
    expect(s.ships[0]!.hasActed).toBe(true);
    expect(s.linkedAction?.action).toBe('evade');
    const link = s.pending.find((p) => p.type === 'perform-action' && p.shipId === 'a');
    expect(link?.type === 'perform-action' && link.options.actions).toEqual(['evade']);

    s = perform(s, { type: 'PerformAction', playerId: 'p', shipId: 'a', action: 'evade' });
    const ship2 = s.ships[0]!;
    expect(ship2.tokens.some((t) => t.kind === 'focus')).toBe(true);
    expect(ship2.tokens.some((t) => t.kind === 'evade')).toBe(true);
    expect(ship2.tokens.filter((t) => t.kind === 'stress')).toHaveLength(1); // red link → stress
    expect(s.linkedAction).toBeUndefined();
  });

  it('can decline the linked action', () => {
    const a = ship('a', 'p', 0, 0, {
      actionBar: ['focus'],
      actionLinks: { focus: { action: 'evade', difficulty: 'red' } },
    });
    let s = stateWith([a, ship('e', 'q', 0, 600)]);
    s = perform(s, { type: 'PerformAction', playerId: 'p', shipId: 'a', action: 'focus' });
    s = perform(s, { type: 'SkipAction', playerId: 'p', shipId: 'a' });
    expect(s.linkedAction).toBeUndefined();
    expect(s.ships[0]!.tokens.some((t) => t.kind === 'evade')).toBe(false);
    expect(s.ships[0]!.tokens.some((t) => t.kind === 'stress')).toBe(false);
  });

  it('runs a linked reposition through the placement choice', () => {
    // Focus, linked to a red Barrel Roll
    const a = ship('a', 'p', 0, 0, {
      actionBar: ['focus'],
      actionLinks: { focus: { action: 'barrel-roll', difficulty: 'red' } },
    });
    let s = stateWith([a, ship('e', 'q', 0, 600)]);
    s = perform(s, { type: 'PerformAction', playerId: 'p', shipId: 'a', action: 'focus' });
    s = perform(s, { type: 'PerformAction', playerId: 'p', shipId: 'a', action: 'barrel-roll' });
    // now paused on the reposition placement
    expect(s.pending[0]!.type).toBe('reposition');
    s = perform(s, { type: 'Reposition', playerId: 'p', shipId: 'a', choice: 0 });
    const ship2 = s.ships[0]!;
    expect(ship2.pos).not.toEqual({ x: 0, y: 0, angle: 0 }); // moved
    expect(ship2.tokens.filter((t) => t.kind === 'stress')).toHaveLength(1); // red link
    expect(s.linkedAction).toBeUndefined();
  });
});

describe('SLAM action', () => {
  it('offers maneuvers at the executed speed, then moves + disarms', () => {
    const a = ship('a', 'p', 0, 0, {
      actionBar: ['slam'],
      actionDifficulty: { slam: 'red' },
      dial: { speed: 2, bearing: 'straight', difficulty: 'white' },
      dialOptions: [
        { speed: 1, bearing: 'straight', difficulty: 'white' },
        { speed: 2, bearing: 'straight', difficulty: 'white' },
        { speed: 2, bearing: 'bank-left', difficulty: 'white' },
      ],
    });
    let s = stateWith([a, ship('e', 'q', 0, 600)]);
    s = perform(s, { type: 'PerformAction', playerId: 'p', shipId: 'a', action: 'slam' });
    const rep = s.pending.find((p) => p.type === 'reposition');
    expect(rep?.type === 'reposition' && rep.options.action).toBe('slam');
    expect(rep?.type === 'reposition' && rep.options.candidates.map((c) => c.label)).toEqual([
      '2 straight',
      '2 bank-left',
    ]); // only the speed-2 dial options

    s = perform(s, { type: 'Reposition', playerId: 'p', shipId: 'a', choice: 0 });
    const moved = s.ships[0]!;
    expect(moved.pos.y).toBeCloseTo(120); // 80 template + 40 base
    expect(moved.tokens.some((t) => t.kind === 'disarm')).toBe(true);
    expect(moved.tokens.some((t) => t.kind === 'stress')).toBe(true); // SLAM is red
    expect(moved.hasActed).toBe(true);
  });
});
