import { describe, expect, it } from 'vitest';
import { buildDamageDeck, cardPenalty, drawDamageCards } from './damage';
import { applyEvent, resolveAttack } from './index';
import type { DamageCard, GameState, Ship } from './types';

const mk = (id: string, ownerId: string, x: number, y: number, extra: Partial<Ship> = {}): Ship => ({
  id,
  ownerId,
  shipType: 't',
  pilot: id,
  initiative: 1,
  base: 'small',
  primaryAttack: 3,
  agility: 3,
  hull: 5,
  shields: 0,
  maxHull: 5,
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

function game(ships: Ship[], seed = 's'): GameState {
  return {
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
    damageDeck: buildDamageDeck(seed),
    damageDrawn: 0,
    pending: [],
    gameOver: false,
  };
}

const attackFaces = (events: ReturnType<typeof resolveAttack>, kind: 'attack' | 'defence'): number => {
  const e = events.find((ev) => ev.type === 'DiceRolled' && ev.kind === kind);
  return e && e.type === 'DiceRolled' ? e.faces.length : -1;
};

describe('damage deck', () => {
  it('shuffles deterministically from the seed', () => {
    expect(buildDamageDeck('s').map((c) => c.id)).toEqual(buildDamageDeck('s').map((c) => c.id));
    expect(buildDamageDeck('a')).not.toEqual(buildDamageDeck('b'));
    expect(buildDamageDeck('s')).toHaveLength(15);
  });

  it('drawing appends faceup cards and advances the deck cursor', () => {
    let s = game([mk('a', 'p', 0, 0)]);
    const events = drawDamageCards(s, 'a', 2);
    expect(events).toHaveLength(2);
    for (const e of events) s = applyEvent(s, e);
    expect(s.ships[0]!.damageCards).toHaveLength(2);
    expect(s.damageDrawn).toBe(2);
    expect(s.ships[0]!.damageCards![0]!.id).toBe(s.damageDeck![0]!.id); // top of deck
  });

  it('crits that reach the hull become faceup cards (shields absorb them first)', () => {
    const forceCrits = { onModifyAttack: (ctx: { attack: string[] }) => (ctx.attack = ['crit', 'crit']) };
    // 0-shield target: both crits reach the hull → 2 cards
    let s = game([mk('a', 'p', 0, 0), mk('b', 'q', 0, 150, { agility: 0 })]);
    let ev = resolveAttack(s, 'a', 'b', forceCrits as never);
    expect(ev.filter((e) => e.type === 'DamageCardDealt')).toHaveLength(2);

    // 2-shield target: shields soak both crits → no cards
    s = game([mk('a', 'p', 0, 0), mk('b', 'q', 0, 150, { agility: 0, shields: 2, maxShields: 2 })]);
    ev = resolveAttack(s, 'a', 'b', forceCrits as never);
    expect(ev.filter((e) => e.type === 'DamageCardDealt')).toHaveLength(0);
  });

  it('a faceup card reduces the matching stat in combat', () => {
    const atkCard: DamageCard = { id: 'c1', name: 'x', effect: { kind: 'stat', stat: 'attack', amount: 1 } };
    const agiCard: DamageCard = { id: 'c2', name: 'y', effect: { kind: 'stat', stat: 'agility', amount: 1 } };
    expect(cardPenalty(mk('a', 'p', 0, 0, { damageCards: [atkCard] }), 'attack')).toBe(1);

    // attacker -1 attack die (3 → 2) at range 2
    const s1 = game([mk('a', 'p', 0, 0, { damageCards: [atkCard] }), mk('b', 'q', 0, 150)]);
    expect(attackFaces(resolveAttack(s1, 'a', 'b'), 'attack')).toBe(2);

    // defender -1 agility die (3 → 2) at range 2
    const s2 = game([mk('a', 'p', 0, 0), mk('b', 'q', 0, 150, { damageCards: [agiCard] })]);
    expect(attackFaces(resolveAttack(s2, 'a', 'b'), 'defence')).toBe(2);
  });

  it('repair removes a faceup card', () => {
    const card: DamageCard = { id: 'c1', name: 'x', effect: { kind: 'none' } };
    let s = game([mk('a', 'p', 0, 0, { damageCards: [card] })]);
    s = applyEvent(s, { type: 'DamageCardRemoved', shipId: 'a', cardId: 'c1' });
    expect(s.ships[0]!.damageCards).toHaveLength(0);
  });
});
