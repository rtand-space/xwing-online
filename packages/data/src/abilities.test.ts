import {
  type AttackContext,
  getAbility,
  type GameState,
  type Position,
  type Ship,
} from '@xwing/engine';
import { describe, expect, it } from 'vitest';
import { implementedAbility, installAbilities } from './abilities';

installAbilities();

const ship = (id: string, pos: Position): Ship => ({
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
  charges: 0,
  maxCharges: 0,
  recurring: 0,
  pos,
  actionBar: [],
  dialOptions: [],
  tokens: [],
  dialRevealed: false,
  hasMoved: false,
  hasActed: false,
  hasEngaged: false,
});

const state = { rng: { seed: 'ab', cursor: 0 } } as unknown as GameState;
const ctx = (attacker: Ship, target: Ship, attack: AttackContext['attack']): AttackContext => ({
  state,
  attacker,
  target,
  range: 2,
  obstructed: false,
  attack,
  defence: [],
  cursor: 0,
  result: { hits: 0, crits: 0 },
  events: [],
});

describe('card abilities', () => {
  it('flags which cards are simulated', () => {
    expect(implementedAbility('wedgeantilles')).toBe(true);
    expect(implementedAbility('outmaneuver')).toBe(true);
    expect(implementedAbility('academypilot')).toBe(false);
  });

  it('Wedge Antilles drops a defence die while he attacks', () => {
    const self = ship('a', { x: 0, y: 0, angle: 0 });
    const c = ctx(self, ship('t', { x: 0, y: 100, angle: 0 }), ['hit']);
    c.defence = ['evade', 'blank', 'focus'];
    getAbility('wedgeantilles')!.attack!.onRollDefence!(c, self);
    expect(c.defence).toHaveLength(2);
  });

  it('Backstabber adds an attack die only from outside the defender’s arc', () => {
    const atk = ship('a', { x: 0, y: 0, angle: 0 });
    const hook = getAbility('backstabber-battleofyavin')!.attack!.onRollAttack!;

    // target faces away (north) → attacker is behind it → outside its arc → +1 die
    const outside = ctx(atk, ship('t', { x: 0, y: 100, angle: 0 }), ['hit']);
    hook(outside, atk);
    expect(outside.attack).toHaveLength(2);

    // target faces the attacker → inside its arc → no bonus
    const inside = ctx(atk, ship('t', { x: 0, y: 100, angle: 180 }), ['hit']);
    hook(inside, atk);
    expect(inside.attack).toHaveLength(1);
  });

  it('Outmaneuver drops a defence die only from outside the defender’s arc', () => {
    const atk = ship('a', { x: 0, y: 0, angle: 0 });
    const hook = getAbility('outmaneuver')!.attack!.onRollDefence!;

    const outside = ctx(atk, ship('t', { x: 0, y: 100, angle: 0 }), ['hit']);
    outside.defence = ['evade', 'blank'];
    hook(outside, atk);
    expect(outside.defence).toHaveLength(1);

    const inside = ctx(atk, ship('t', { x: 0, y: 100, angle: 180 }), ['hit']);
    inside.defence = ['evade', 'blank'];
    hook(inside, atk);
    expect(inside.defence).toHaveLength(2);
  });
});
