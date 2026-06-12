import { beforeEach, describe, expect, it } from 'vitest';
import { clearAbilities, registerAbility, shipAbilitySources } from './abilities';
import { resolveAttack } from './combat';
import type { GameEvent } from './events';
import type { GameState, Position, Ship } from './types';

const ship = (id: string, shipType: string, over: Partial<Ship> = {}): Ship => ({
  id,
  ownerId: id,
  shipType,
  pilot: id,
  initiative: 2,
  base: 'small',
  primaryAttack: 2,
  agility: 0,
  hull: 5,
  shields: 0,
  maxHull: 5,
  maxShields: 0,
  pos: { x: 0, y: 0, angle: 0 } as Position,
  actionBar: [],
  dialOptions: [],
  tokens: [],
  dialRevealed: false,
  hasMoved: false,
  hasActed: false,
  hasEngaged: false,
  ...over,
});

const stateWith = (ships: Ship[]): GameState => ({
  id: 'g',
  rng: { seed: 'abil', cursor: 0 },
  round: 1,
  phase: 'engagement',
  players: [
    { id: 'a', name: 'A' },
    { id: 't', name: 'T' },
  ],
  ships,
  obstacles: [],
  pending: [],
  gameOver: false,
});

describe('ability framework', () => {
  beforeEach(clearAbilities);

  it('lists a ship’s ability sources (ship, pilot, upgrades)', () => {
    const s = ship('a', 't65xwing', {
      pilotXws: 'lukeskywalker',
      upgrades: ['r2d2', 'protontorpedoes'],
    });
    expect(shipAbilitySources(s)).toEqual(['t65xwing', 'lukeskywalker', 'r2d2', 'protontorpedoes']);
  });

  it('runs a registered attacker ability inside the attack pipeline', () => {
    registerAbility('aceship', {
      attack: {
        onModifyAttack: (ctx, self) => {
          if (ctx.attacker.id === self.id) ctx.attack = ['hit', 'hit', 'hit'];
        },
      },
    });
    const a = ship('a', 'aceship');
    const t = ship('t', 'dummy', { pos: { x: 0, y: 60, angle: 0 }, hull: 5, agility: 0 });
    const events = resolveAttack(stateWith([a, t]), 'a', 't');
    const dmg = events.find(
      (e): e is Extract<GameEvent, { type: 'DamageDealt' }> => e.type === 'DamageDealt',
    );
    expect(dmg?.amount).toBe(3);
    expect(dmg?.hullAfter).toBe(2);
  });

  it('does not run an ability for a ship that lacks it', () => {
    registerAbility('aceship', {
      attack: { onModifyAttack: (ctx) => (ctx.attack = ['hit', 'hit', 'hit', 'hit', 'hit']) },
    });
    const a = ship('a', 'plain', { primaryAttack: 0 }); // no dice, no ability
    const t = ship('t', 'dummy', { pos: { x: 0, y: 260, angle: 0 }, agility: 0 }); // range 3, no bonus die
    const events = resolveAttack(stateWith([a, t]), 'a', 't');
    expect(events.some((e) => e.type === 'DamageDealt')).toBe(false);
  });
});
