import { describe, expect, it } from 'vitest';
import { createGame, demoConfig, dispatch } from './index';
import type { Game } from './game';
import { autoPlay, type Chooser, firstChoice } from './harness';

const owner = (id: string): string => (id.startsWith('x') ? 'rebel' : 'imperial');
const ok = (r: { game: Game; rejection?: string }): Game => {
  if (r.rejection) throw new Error(r.rejection);
  return r.game;
};

const blue = { speed: 1, bearing: 'straight', difficulty: 'blue' } as const;
const redK = { speed: 3, bearing: 'koiogran', difficulty: 'red' } as const;

describe('pending decisions', () => {
  it('owes a dial from every ship in parallel during planning', () => {
    const g = createGame(demoConfig());
    expect(g.state.pending.map((p) => p.shipId).sort()).toEqual(['t1', 't2', 'x1', 'x2']);
  });

  it('activates one ship at a time in ascending initiative', () => {
    const g = autoPlay(
      createGame(demoConfig()),
      firstChoice,
      (gg) => gg.state.phase !== 'planning',
    );
    expect(g.state.phase).toBe('activation');
    expect(g.state.pending).toHaveLength(1);
    expect(g.state.pending[0]!.type).toBe('execute-maneuver');
    expect(g.state.pending[0]!.shipId).toBe('t2'); // initiative 1, lowest
  });

  it('stress bars actions, and persists to bar red maneuvers the next round', () => {
    let g = createGame(demoConfig());
    for (const [id, m] of [
      ['x1', blue],
      ['x2', blue],
      ['t1', blue],
      ['t2', redK],
    ] as const) {
      g = ok(dispatch(g, { type: 'SetDial', playerId: owner(id), shipId: id, maneuver: m }));
    }

    // t2 (init 1) activates first and flies the red K-turn → gains stress.
    expect(g.state.pending[0]!.shipId).toBe('t2');
    g = ok(dispatch(g, { type: 'ExecuteManeuver', playerId: 'imperial', shipId: 't2' }));

    const action = g.state.pending[0]!;
    expect(action.type).toBe('perform-action');
    if (action.type === 'perform-action') {
      expect(action.options.actions).toEqual([]); // stressed: no actions offered
      expect(action.options.canSkip).toBe(true);
    }

    g = ok(dispatch(g, { type: 'SkipAction', playerId: 'imperial', shipId: 't2' }));
    // pass all attacks so no ship dies and stress survives into the next round
    const peaceful: Chooser = (p, game) =>
      p.type === 'declare-attack'
        ? { type: 'PassAttack', playerId: p.playerId, shipId: p.shipId }
        : firstChoice(p, game);
    g = autoPlay(g, peaceful, (gg) => gg.state.round > 1);

    expect(g.state.phase).toBe('planning');
    const dial = g.state.pending.find((p) => p.shipId === 't2');
    expect(dial?.type).toBe('set-dial');
    if (dial?.type === 'set-dial') {
      expect(dial.options.maneuvers.some((m) => m.difficulty === 'red')).toBe(false);
    }
  });

  it('engages in descending initiative during engagement', () => {
    const g = autoPlay(
      createGame(demoConfig()),
      firstChoice,
      (gg) => gg.state.phase === 'engagement',
    );
    expect(g.state.pending[0]!.type).toBe('declare-attack');
    expect(g.state.pending[0]!.shipId).toBe('x1'); // initiative 4, highest
  });
});
