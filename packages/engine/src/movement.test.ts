import { describe, expect, it } from 'vitest';
import { createGame, dispatch, resolveMovement, xwing } from './index';
import type { GameConfig } from './index';
import type { GameState, Maneuver, Ship } from './types';

const ship = (id: string, x: number, y: number, angle = 0): Ship => ({
  ...xwing(id, 'p', 1, { x, y, angle }),
  maxHull: 4,
  maxShields: 2,
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
  pending: [],
  gameOver: false,
});

const straight = (speed: Maneuver['speed']): Maneuver => ({
  speed,
  bearing: 'straight',
  difficulty: 'white',
});

describe('movement collisions', () => {
  it('moves to the full placement when clear', () => {
    const mover = ship('a', 0, 0);
    const result = resolveMovement(stateWith([mover, ship('b', 500, 500)]), mover, straight(2));
    expect(result.bumped).toBe(false);
    expect(result.to).toEqual({ x: 0, y: 80, angle: 0 });
  });

  it('backs off along the template and flags a bump on overlap', () => {
    const mover = ship('a', 0, 0);
    const blocker = ship('b', 0, 80); // directly in the path's end
    const result = resolveMovement(stateWith([mover, blocker]), mover, straight(2));
    expect(result.bumped).toBe(true);
    expect(result.to.y).toBeLessThan(80);
    expect(result.to.y).toBeGreaterThan(0);
  });
});

describe('movement wired into activation', () => {
  it('a bumped ship forfeits its action', () => {
    const config: GameConfig = {
      id: 'c',
      seed: 's',
      players: [
        { id: 'r', name: 'R' },
        { id: 'i', name: 'I' },
      ],
      ships: [
        xwing('x', 'r', 1, { x: 0, y: 0, angle: 0 }),
        xwing('t', 'i', 2, { x: 0, y: 80, angle: 180 }),
      ],
    };
    let g = createGame(config);
    g = dispatch(g, { type: 'SetDial', playerId: 'r', shipId: 'x', maneuver: straight(2) }).game;
    g = dispatch(g, { type: 'SetDial', playerId: 'i', shipId: 't', maneuver: straight(2) }).game;

    expect(g.state.phase).toBe('activation');
    expect(g.state.pending[0]!.shipId).toBe('x'); // initiative 1 moves first
    g = dispatch(g, { type: 'ExecuteManeuver', playerId: 'r', shipId: 'x' }).game;

    // x bumped into t, so its action is skipped — control passes straight to t
    const x = g.state.ships.find((s) => s.id === 'x')!;
    expect(x.hasActed).toBe(true);
    expect(x.pos.y).toBeLessThan(80);
    expect(g.state.pending[0]!.shipId).toBe('t');
    expect(g.state.pending[0]!.type).toBe('execute-maneuver');
  });
});
