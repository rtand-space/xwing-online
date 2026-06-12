import { describe, expect, it } from 'vitest';
import type { AttackContext } from './combat';
import { addAttackDice, changeAttack, gainToken, rerollAttack, spendCharge } from './effects';
import type { AttackFace } from './dice';
import type { GameState, Ship } from './types';

const ship = (id: string): Ship => ({
  id,
  ownerId: id,
  shipType: 'x',
  pilot: id,
  initiative: 1,
  base: 'small',
  primaryAttack: 2,
  agility: 2,
  hull: 3,
  shields: 0,
  maxHull: 3,
  maxShields: 0,
  charges: 2,
  maxCharges: 2,
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

const state: GameState = {
  id: 'g',
  rng: { seed: 'fx', cursor: 0 },
  round: 1,
  phase: 'engagement',
  players: [],
  ships: [],
  obstacles: [],
  pending: [],
  gameOver: false,
};

const ctx = (attack: AttackFace[]): AttackContext => ({
  state,
  attacker: ship('a'),
  target: ship('t'),
  range: 2,
  obstructed: false,
  attack,
  defence: [],
  cursor: 0,
  result: { hits: 0, crits: 0 },
  events: [],
});

describe('effect primitives', () => {
  it('addAttackDice rolls extras, records a DiceRolled, and advances the cursor', () => {
    const c = ctx(['hit']);
    addAttackDice(c, 2);
    expect(c.attack).toHaveLength(3);
    expect(c.cursor).toBe(2);
    expect(c.events.filter((e) => e.type === 'DiceRolled')).toHaveLength(1);
  });

  it('changeAttack changes up to max results and rolls nothing', () => {
    const c = ctx(['focus', 'focus', 'blank']);
    changeAttack(c, 'focus', 'hit', 1);
    expect(c.attack).toEqual(['hit', 'focus', 'blank']);
    expect(c.cursor).toBe(0);
    expect(c.events).toHaveLength(0);
  });

  it('rerollAttack replaces matching dice deterministically', () => {
    const c = ctx(['blank', 'blank', 'hit']);
    rerollAttack(c, 'blank');
    expect(c.attack).toHaveLength(3); // same count, blanks replaced
    expect(c.attack.filter((f) => f === 'hit')).not.toHaveLength(0); // 'hit' kept
    expect(c.cursor).toBe(2); // two rerolls drawn
    // identical seed/cursor ⇒ identical reroll
    const c2 = ctx(['blank', 'blank', 'hit']);
    rerollAttack(c2, 'blank');
    expect(c2.attack).toEqual(c.attack);
  });

  it('event builders produce the right events', () => {
    const s = ship('a');
    expect(gainToken(s, 'focus')).toEqual({ type: 'TokenGained', shipId: 'a', kind: 'focus' });
    expect(spendCharge(s, 1)).toEqual({ type: 'ChargeChanged', shipId: 'a', delta: -1 });
  });
});
