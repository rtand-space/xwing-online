import { afterEach, describe, expect, it } from 'vitest';
import { clearAbilities, createGame, dispatch, registerAbility, xwing } from './index';
import type { GameConfig, Maneuver } from './index';

afterEach(() => clearAbilities());

const straight = (speed: Maneuver['speed']): Maneuver => ({
  speed,
  bearing: 'straight',
  difficulty: 'white',
});

const hasToken = (g: ReturnType<typeof createGame>, id: string, kind: string): boolean =>
  g.state.ships.find((s) => s.id === id)!.tokens.some((t) => t.kind === kind);

describe('setup window', () => {
  it('offers a ship its setup ability at game start, before any dials', () => {
    registerAbility('setupdemo', {
      optional: {
        onSetup: {
          label: 'Setup: gain a calculate token',
          available: () => true,
          resolve: ({ self }) => [{ type: 'TokenGained', shipId: self.id, kind: 'calculate' }],
        },
      },
    });
    const config: GameConfig = {
      id: 'c',
      seed: 's',
      players: [
        { id: 'p', name: 'P' },
        { id: 'q', name: 'Q' },
      ],
      ships: [
        { ...xwing('a', 'p', 1, { x: 0, y: -150, angle: 0 }), pilotXws: 'setupdemo' },
        xwing('b', 'q', 2, { x: 0, y: 150, angle: 180 }),
      ],
    };
    let g = createGame(config);
    expect(g.state.pending[0]?.type).toBe('trigger-ability'); // setup offer preempts planning
    expect(g.state.pending[0]?.shipId).toBe('a');

    g = dispatch(g, { type: 'UseAbility', playerId: 'p', shipId: 'a' }).game;
    expect(hasToken(g, 'a', 'calculate')).toBe(true);
    expect(g.state.phase).toBe('planning');
    expect(g.state.pending[0]?.type).toBe('set-dial'); // now the normal flow
  });
});

describe('moved-through trigger', () => {
  it('fires onMovedThrough when a ship flies over another and ends clear', () => {
    registerAbility('flybydemo', {
      optional: {
        onMovedThrough: {
          label: 'flew through — gain a focus',
          available: () => true,
          resolve: ({ self }) => [{ type: 'TokenGained', shipId: self.id, kind: 'focus' }],
        },
      },
    });
    const config: GameConfig = {
      id: 'c',
      seed: 's',
      players: [
        { id: 'p', name: 'P' },
        { id: 'q', name: 'Q' },
      ],
      ships: [
        { ...xwing('a', 'p', 1, { x: 0, y: 0, angle: 0 }), pilotXws: 'flybydemo' },
        xwing('b', 'q', 2, { x: 0, y: 60, angle: 0 }), // directly in a's path
      ],
    };
    let g = createGame(config);
    g = dispatch(g, { type: 'SetDial', playerId: 'p', shipId: 'a', maneuver: straight(2) }).game;
    g = dispatch(g, { type: 'SetDial', playerId: 'q', shipId: 'b', maneuver: straight(2) }).game;
    g = dispatch(g, { type: 'ExecuteManeuver', playerId: 'p', shipId: 'a' }).game;

    // a flew over b (ending past it) → its onMovedThrough ability is offered
    expect(g.state.pending[0]?.type).toBe('trigger-ability');
    expect(g.state.pending[0]?.shipId).toBe('a');
    g = dispatch(g, { type: 'UseAbility', playerId: 'p', shipId: 'a' }).game;
    expect(hasToken(g, 'a', 'focus')).toBe(true);
  });
});
