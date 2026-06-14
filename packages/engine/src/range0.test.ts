import { describe, expect, it } from 'vitest';
import { combatSpends } from './combat';
import { rangeBand, resolveAttack } from './index';
import type { CombatState, GameState, Ship } from './types';

const mk = (id: string, ownerId: string, x: number, y: number, extra: Partial<Ship> = {}): Ship => ({
  id,
  ownerId,
  shipType: 't',
  pilot: id,
  initiative: 1,
  base: 'small',
  primaryAttack: 3,
  agility: 0,
  hull: 6,
  shields: 0,
  maxHull: 6,
  maxShields: 0,
  charges: 0,
  maxCharges: 0,
  recurring: 0,
  pos: { x, y, angle: 0 },
  actionBar: [],
  dialOptions: [],
  tokens: [],
  dialRevealed: false,
  hasMoved: true,
  hasActed: true,
  hasEngaged: false,
  ...extra,
});

const game = (ships: Ship[]): GameState => ({
  id: 'g',
  rng: { seed: 's', cursor: 0 },
  round: 1,
  phase: 'engagement',
  players: [
    { id: 'p', name: 'P' },
    { id: 'q', name: 'Q' },
  ],
  ships,
  obstacles: [],
  pending: [],
  gameOver: false,
});

const attackDice = (events: ReturnType<typeof resolveAttack>): number => {
  const e = events.find((ev) => ev.type === 'DiceRolled' && ev.kind === 'attack');
  return e && e.type === 'DiceRolled' ? e.faces.length : -1;
};

describe('range 0 (a bump)', () => {
  it('two touching small bases are range 0', () => {
    expect(rangeBand(mk('a', 'p', 0, 0), mk('b', 'q', 0, 40))).toBe(0); // edges meet
    expect(rangeBand(mk('a', 'p', 0, 0), mk('b', 'q', 0, 100))).toBe(1); // 60mm apart
  });

  it('no range-1 bonus die at range 0', () => {
    const r0 = resolveAttack(game([mk('a', 'p', 0, 0), mk('b', 'q', 0, 40)]), 'a', 'b');
    expect(attackDice(r0)).toBe(3); // primary only, no +1

    const r1 = resolveAttack(game([mk('a', 'p', 0, 0), mk('b', 'q', 0, 100)]), 'a', 'b');
    expect(attackDice(r1)).toBe(4); // range 1 → +1 bonus die
  });

  it('the attacker may not modify at range 0, but the defender still can', () => {
    const state = game([
      mk('a', 'p', 0, 0, { tokens: [{ kind: 'focus' }] }),
      mk('b', 'q', 0, 40, { agility: 3, tokens: [{ kind: 'focus' }] }),
    ]);
    const base: Omit<CombatState, 'step' | 'attack' | 'defence'> = {
      attackerId: 'a',
      targetId: 'b',
      range: 0,
      obstructed: false,
    };
    // attacker's modify step: suppressed at range 0
    expect(combatSpends(state, { ...base, step: 'attack', attack: ['focus'], defence: [] })).toEqual([]);
    // defender's modify step: still allowed
    expect(
      combatSpends(state, { ...base, step: 'defence', attack: [], defence: ['focus'] }),
    ).toContain('focus');
  });
});
