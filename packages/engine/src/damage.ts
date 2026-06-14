import type { GameEvent } from './events';
import { rngAt } from './rng';
import type { DamageCard, DamageEffect, GameState, Ship, ShipId } from './types';

// Original crit names + functional effects only (mechanics, never card text/art).
const TEMPLATE: { name: string; effect: DamageEffect; copies: number }[] = [
  { name: 'Weapon Malfunction', effect: { kind: 'stat', stat: 'attack', amount: 1 }, copies: 5 },
  { name: 'Stabiliser Damage', effect: { kind: 'stat', stat: 'agility', amount: 1 }, copies: 5 },
  { name: 'Critical Breach', effect: { kind: 'none' }, copies: 5 },
];

/** The ordered, unshuffled deck (one entry per card, with a stable id). */
function deckCards(): DamageCard[] {
  const out: DamageCard[] = [];
  for (const t of TEMPLATE)
    for (let i = 0; i < t.copies; i++) out.push({ id: `dmg-${out.length}`, name: t.name, effect: t.effect });
  return out;
}

/** Deterministically shuffle the damage deck from the game seed (own rng stream). */
export function buildDamageDeck(seed: string): DamageCard[] {
  const cards = deckCards();
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(rngAt(`${seed}:deck`, i) * (i + 1));
    [cards[i], cards[j]] = [cards[j]!, cards[i]!];
  }
  return cards;
}

/** Draw `n` faceup cards for a ship — events only; the deck cursor advances on apply. */
export function drawDamageCards(state: GameState, shipId: ShipId, n: number): GameEvent[] {
  const deck = state.damageDeck ?? [];
  const start = state.damageDrawn ?? 0;
  const events: GameEvent[] = [];
  for (let i = 0; i < n; i++) {
    const card = deck[start + i];
    if (!card) break; // deck exhausted (no reshuffle yet)
    events.push({ type: 'DamageCardDealt', shipId, card });
  }
  return events;
}

/** Total stat reduction from a ship's faceup damage cards. */
export function cardPenalty(ship: Ship, stat: 'attack' | 'agility'): number {
  return (ship.damageCards ?? []).reduce(
    (n, c) => n + (c.effect.kind === 'stat' && c.effect.stat === stat ? c.effect.amount : 0),
    0,
  );
}
