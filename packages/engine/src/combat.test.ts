import { describe, expect, it } from 'vitest';
import { applyEvent, ATTACK_WINDOWS, createGame, resolveAttack, tieln, xwing } from './index';
import type { GameConfig } from './index';
import type { GameState, Ship, Token } from './types';

interface Over {
  primaryAttack?: number;
  agility?: number;
  hull?: number;
  shields?: number;
  tokens?: Token[];
}

const mk = (id: string, x: number, y: number, angle: number, over: Over = {}): Ship => ({
  ...xwing(id, 'p', 1, { x, y, angle }),
  primaryAttack: over.primaryAttack ?? 3,
  agility: over.agility ?? 2,
  hull: over.hull ?? 4,
  shields: over.shields ?? 2,
  maxHull: 4,
  maxShields: 2,
  charges: 0,
  maxCharges: 0,
  recurring: 0,
  tokens: over.tokens ?? [],
  dialRevealed: false,
  hasMoved: false,
  hasActed: false,
  hasEngaged: false,
});

const stateWith = (ships: Ship[], seed = 'combat'): GameState => ({
  id: 'g',
  rng: { seed, cursor: 0 },
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

describe('combat pipeline', () => {
  it('walks every timing window in order (T3.1)', () => {
    const visited: string[] = [];
    const hooks = Object.fromEntries(ATTACK_WINDOWS.map((w) => [w, () => visited.push(w)]));
    const events = resolveAttack(
      stateWith([mk('a', 0, 0, 0), mk('b', 0, 90, 180)]),
      'a',
      'b',
      hooks,
    );
    expect(visited).toEqual([...ATTACK_WINDOWS]);
    expect(events[0]).toMatchObject({ type: 'AttackDeclared', shipId: 'a', targetId: 'b' });
    expect(events.some((e) => e.type === 'DiceRolled')).toBe(true);
  });

  it('adds a die at range 1 (attacker) and range 3 (defender) (T3.2)', () => {
    let atk = 0;
    let def = 0;
    const capture = {
      onRollAttack: (c: { attack: unknown[] }) => (atk = c.attack.length),
      onRollDefence: (c: { defence: unknown[] }) => (def = c.defence.length),
    };

    resolveAttack(stateWith([mk('a', 0, 0, 0), mk('b', 0, 90, 180)]), 'a', 'b', capture); // range 1
    expect(atk).toBe(4); // primary 3 + range-1 bonus
    expect(def).toBe(2);

    resolveAttack(stateWith([mk('a', 0, 0, 0), mk('b', 0, 250, 180)]), 'a', 'b', capture); // range 3
    expect(atk).toBe(3);
    expect(def).toBe(3); // agility 2 + range-3 bonus
  });

  it('resolves rerolls before changes, spending the right tokens (T3.3)', () => {
    const attacker = mk('a', 0, 0, 0, {
      tokens: [{ kind: 'focus' }, { kind: 'lock', targetId: 'b' }],
    });
    const events = resolveAttack(stateWith([attacker, mk('b', 0, 90, 180)]), 'a', 'b', {
      onRollAttack: (c) => {
        c.attack = ['focus', 'blank'];
      },
    });
    const spent = events.filter((e) => e.type === 'TokenSpent').map((e) => e.kind);
    expect(spent).toEqual(['lock', 'focus']); // lock reroll first, then focus change
  });

  it('applies damage shields-first, crits face-up on hull, and destroys at 0 (T3.4)', () => {
    const fixed = (faces: string[]) => ({
      onRollAttack: (c: { attack: string[] }) => {
        c.attack = faces;
      },
      onRollDefence: (c: { defence: string[] }) => {
        c.defence = [];
      },
    });

    // shields absorb, ignoring the crit distinction
    const a1 = resolveAttack(
      stateWith([mk('a', 0, 0, 0), mk('b', 0, 90, 180, { shields: 3, hull: 3 })]),
      'a',
      'b',
      fixed(['crit']),
    ).find((e) => e.type === 'DamageDealt');
    expect(a1).toMatchObject({ amount: 1, shieldsAfter: 2, hullAfter: 3, crits: 1 });

    // overflow past shields hits hull
    const a2 = resolveAttack(
      stateWith([mk('a', 0, 0, 0), mk('b', 0, 90, 180, { shields: 2, hull: 3 })]),
      'a',
      'b',
      fixed(['hit', 'hit', 'crit']),
    ).find((e) => e.type === 'DamageDealt');
    expect(a2).toMatchObject({ amount: 3, shieldsAfter: 0, hullAfter: 2, crits: 1 });

    // lethal
    const events = resolveAttack(
      stateWith([mk('a', 0, 0, 0), mk('b', 0, 90, 180, { shields: 0, hull: 1 })]),
      'a',
      'b',
      fixed(['hit']),
    );
    expect(events.some((e) => e.type === 'ShipDestroyed' && e.shipId === 'b')).toBe(true);
  });

  it('calculate converts one focus result per token', () => {
    const fix = { onRollDefence: (c: { defence: string[] }) => (c.defence = []) };
    const attacker = mk('a', 0, 0, 0, { tokens: [{ kind: 'calculate' }] });
    const dmg = resolveAttack(
      stateWith([attacker, mk('b', 0, 90, 180, { agility: 0 })]),
      'a',
      'b',
      {
        ...fix,
        onRollAttack: (c) => (c.attack = ['focus', 'focus']),
      },
    ).find((e) => e.type === 'DamageDealt');
    expect(dmg?.amount).toBe(1); // one calculate ⇒ one focus → hit
  });

  it('reinforce reduces a 2+ hit attack by one', () => {
    const fixed2 = {
      onRollAttack: (c: { attack: string[] }) => (c.attack = ['hit', 'hit']),
      onRollDefence: (c: { defence: string[] }) => (c.defence = []),
    };
    const tough = mk('b', 0, 90, 180, {
      agility: 0,
      shields: 0,
      hull: 5,
      tokens: [{ kind: 'reinforce' }],
    });
    const dmg = resolveAttack(stateWith([mk('a', 0, 0, 0), tough]), 'a', 'b', fixed2).find(
      (e) => e.type === 'DamageDealt',
    );
    expect(dmg?.amount).toBe(1); // 2 hits → reinforced → 1
  });

  it('ends the game when a side is wiped out (T3.5)', () => {
    const config: GameConfig = {
      id: 'c',
      seed: 's',
      players: [
        { id: 'r', name: 'R' },
        { id: 'i', name: 'I' },
      ],
      ships: [
        xwing('x', 'r', 2, { x: 0, y: -100, angle: 0 }),
        tieln('t', 'i', 1, { x: 0, y: 100, angle: 180 }),
      ],
    };
    const g = createGame(config);
    expect(g.state.gameOver).toBe(false);

    const dead = applyEvent(g.state, {
      type: 'DamageDealt',
      shipId: 't',
      amount: 3,
      shieldsAfter: 0,
      hullAfter: 0,
      crits: 0,
    });
    expect(dead.gameOver).toBe(true);
    expect(dead.pending).toEqual([]);
  });
});
