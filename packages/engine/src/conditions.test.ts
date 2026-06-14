import { describe, expect, it } from 'vitest';
import { applyEvent } from './index';
import type { GameState, Ship } from './types';

const ship = (id: string): Ship => ({
  id,
  ownerId: 'p',
  shipType: 't',
  pilot: id,
  initiative: 1,
  base: 'small',
  primaryAttack: 2,
  agility: 2,
  hull: 3,
  shields: 0,
  maxHull: 3,
  maxShields: 0,
  charges: 0,
  maxCharges: 0,
  recurring: 0,
  pos: { x: 0, y: 0, angle: 0 },
  actionBar: [],
  dialOptions: [],
  tokens: [],
  dialRevealed: false,
  hasMoved: false,
  hasActed: false,
  hasEngaged: false,
});

const state = (s: Ship): GameState => ({
  id: 'g',
  rng: { seed: 's', cursor: 0 },
  round: 1,
  phase: 'engagement',
  players: [{ id: 'p', name: 'P' }],
  ships: [s],
  obstacles: [],
  pending: [],
  gameOver: false,
});

describe('conditions', () => {
  it('assigning adds the marker (idempotent) and removing clears it', () => {
    let s = state(ship('a'));
    s = applyEvent(s, { type: 'ConditionAssigned', shipId: 'a', condition: 'rattled' });
    s = applyEvent(s, { type: 'ConditionAssigned', shipId: 'a', condition: 'rattled' });
    expect(s.ships[0]!.conditions).toEqual(['rattled']); // no duplicate

    s = applyEvent(s, { type: 'ConditionRemoved', shipId: 'a', condition: 'rattled' });
    expect(s.ships[0]!.conditions).toEqual([]);
  });
});
