import { describe, expect, it } from 'vitest';
import { createGame, dispatch, resolveMovement, xwing } from './index';
import { offBoard } from './geometry';
import type { GameConfig } from './index';
import type { GameState, Maneuver, Ship } from './types';

const ship = (id: string, x: number, y: number, angle = 0): Ship => ({
  ...xwing(id, 'p', 1, { x, y, angle }),
  maxHull: 4,
  maxShields: 2,
  charges: 0,
  maxCharges: 0,
  recurring: 0,
  tokens: [],
  dialRevealed: false,
  hasMoved: false,
  hasActed: false,
  hasEngaged: false,
});

const stateWith = (ships: Ship[]): GameState => ({
  id: 'g',
  rng: { seed: 's', cursor: 0 },
  round: 1,
  phase: 'activation',
  players: [],
  ships,
  obstacles: [],
  pending: [],
  gameOver: false,
});

const straight = (speed: Maneuver['speed']): Maneuver => ({
  speed,
  bearing: 'straight',
  difficulty: 'white',
});

describe('movement collisions', () => {
  it('moves to the full placement when clear (template + base)', () => {
    const mover = ship('a', 0, 0);
    const result = resolveMovement(stateWith([mover, ship('b', 500, 500)]), mover, straight(2));
    expect(result.bumped).toBe(false);
    expect(result.to).toEqual({ x: 0, y: 120, angle: 0 }); // 80 template + 40 base
  });

  it('backs off and flags a bump on overlap', () => {
    const mover = ship('a', 0, 0);
    const blocker = ship('b', 0, 120); // sits at the move's end
    const result = resolveMovement(stateWith([mover, blocker]), mover, straight(2));
    expect(result.bumped).toBe(true);
    expect(result.to.y).toBeLessThan(120);
    expect(result.to.y).toBeGreaterThan(0);
  });
});

describe('movement wired into activation', () => {
  it('a bumped ship is offered only a red focus, which stresses it', () => {
    const config: GameConfig = {
      id: 'c',
      seed: 's',
      players: [
        { id: 'r', name: 'R' },
        { id: 'i', name: 'I' },
      ],
      ships: [
        xwing('x', 'r', 1, { x: 0, y: 0, angle: 0 }),
        xwing('t', 'i', 2, { x: 0, y: 120, angle: 180 }),
      ],
    };
    let g = createGame(config);
    g = dispatch(g, { type: 'SetDial', playerId: 'r', shipId: 'x', maneuver: straight(2) }).game;
    g = dispatch(g, { type: 'SetDial', playerId: 'i', shipId: 't', maneuver: straight(2) }).game;

    expect(g.state.phase).toBe('activation');
    expect(g.state.pending[0]!.shipId).toBe('x'); // initiative 1 moves first
    g = dispatch(g, { type: 'ExecuteManeuver', playerId: 'r', shipId: 'x' }).game;

    // x bumped into t: it backed off and may now perform only a focus
    const x = g.state.ships.find((s) => s.id === 'x')!;
    expect(x.bumped).toBe(true);
    expect(x.pos.y).toBeLessThan(120);
    const p = g.state.pending[0]!;
    expect(p.shipId).toBe('x');
    expect(p.type).toBe('perform-action');
    expect(p.type === 'perform-action' && p.options.actions).toEqual(['focus']);

    // performing it is a red action → gains stress
    g = dispatch(g, { type: 'PerformAction', playerId: 'r', shipId: 'x', action: 'focus' }).game;
    const x2 = g.state.ships.find((s) => s.id === 'x')!;
    expect(x2.tokens.some((t) => t.kind === 'focus')).toBe(true);
    expect(x2.tokens.some((t) => t.kind === 'stress')).toBe(true);
  });

  it('a ship that flies off the board is destroyed', () => {
    expect(offBoard({ x: 0, y: 480, angle: 0 }, 'small')).toBe(true); // corner past 498
    expect(offBoard({ x: 0, y: 400, angle: 0 }, 'small')).toBe(false);

    const config: GameConfig = {
      id: 'c',
      seed: 's',
      players: [
        { id: 'r', name: 'R' },
        { id: 'i', name: 'I' },
      ],
      ships: [
        xwing('x', 'r', 1, { x: 0, y: 430, angle: 0 }), // near the top edge, facing out
        xwing('t', 'i', 2, { x: 300, y: -300, angle: 180 }),
      ],
    };
    let g = createGame(config);
    g = dispatch(g, { type: 'SetDial', playerId: 'r', shipId: 'x', maneuver: straight(2) }).game;
    g = dispatch(g, { type: 'SetDial', playerId: 'i', shipId: 't', maneuver: straight(2) }).game;
    g = dispatch(g, { type: 'ExecuteManeuver', playerId: 'r', shipId: 'x' }).game;

    expect(g.state.ships.find((s) => s.id === 'x')!.hull).toBe(0); // fled the field
  });
});
