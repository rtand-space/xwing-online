import { describe, expect, it } from 'vitest';
import type { GameEvent } from './events';
import { lineObstructed, obstacleMoveEvents, obstaclesAt } from './obstacles';
import type { GameState, Obstacle, Position, Ship } from './types';

const ship = (pos: Position = { x: 0, y: 0, angle: 0 }): Ship => ({
  id: 's',
  ownerId: 'p',
  shipType: 'x',
  pilot: 'P',
  initiative: 1,
  base: 'small',
  primaryAttack: 2,
  agility: 2,
  hull: 3,
  shields: 1,
  maxHull: 3,
  maxShields: 1,
  pos,
  actionBar: [],
  dialOptions: [],
  tokens: [],
  dialRevealed: false,
  hasMoved: false,
  hasActed: false,
  hasEngaged: false,
});

const asteroid: Obstacle = {
  id: 'a1',
  kind: 'asteroid',
  pos: { x: 0, y: 0, angle: 0 },
  radius: 30,
};
const state = (obstacles: Obstacle[]): GameState => ({
  id: 'g',
  rng: { seed: 's', cursor: 0 },
  round: 1,
  phase: 'activation',
  players: [],
  ships: [],
  obstacles,
  pending: [],
  gameOver: false,
});

describe('obstacles', () => {
  it('detects range-0 overlap', () => {
    expect(obstaclesAt(state([asteroid]), { x: 0, y: 0, angle: 0 }, 'small')).toHaveLength(1);
    expect(obstaclesAt(state([asteroid]), { x: 500, y: 0, angle: 0 }, 'small')).toHaveLength(0);
  });

  it('an asteroid deals at least 1 damage on overlap (XWA)', () => {
    const ev = obstacleMoveEvents(state([asteroid]), ship(), { x: 0, y: 0, angle: 0 });
    expect(ev.some((e) => e.type === 'ObstacleHit')).toBe(true);
    const dmg = ev.find(
      (e): e is Extract<GameEvent, { type: 'DamageDealt' }> => e.type === 'DamageDealt',
    );
    expect(dmg).toBeDefined();
    expect(dmg!.amount).toBeGreaterThanOrEqual(1);
  });

  it('a debris cloud assigns 1 stress', () => {
    const debris: Obstacle = {
      id: 'd1',
      kind: 'debris',
      pos: { x: 0, y: 0, angle: 0 },
      radius: 30,
    };
    const ev = obstacleMoveEvents(state([debris]), ship(), { x: 0, y: 0, angle: 0 });
    expect(ev.some((e) => e.type === 'StressChanged' && e.delta === 1)).toBe(true);
  });

  it('no effect when nowhere near an obstacle', () => {
    const ev = obstacleMoveEvents(state([asteroid]), ship({ x: 500, y: 500, angle: 0 }), {
      x: 500,
      y: 560,
      angle: 0,
    });
    expect(ev).toHaveLength(0);
  });

  it('the line of fire is obstructed by an obstacle between two ships', () => {
    const a = ship({ x: -200, y: 0, angle: 0 });
    const b = { ...ship({ x: 200, y: 0, angle: 0 }), id: 'b' };
    expect(lineObstructed(state([asteroid]), a, b)).toBe(true);
    const offset: Obstacle = { ...asteroid, pos: { x: 0, y: 300, angle: 0 } };
    expect(lineObstructed(state([offset]), a, b)).toBe(false);
  });
});
