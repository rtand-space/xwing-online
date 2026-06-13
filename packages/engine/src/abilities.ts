import type { AttackContext, AttackWindow } from './combat';
import type { GameEvent } from './events';
import type { GameState, GameWindow, Ship } from './types';

export type { GameWindow } from './types';

/**
 * A card ability = handlers registered on named timing windows. R3-M1 covers the
 * attack pipeline; later milestones add game-wide windows (afterReveal, …).
 * `self` is the ship the ability belongs to, so a handler can tell whether it is
 * the attacker or the defender in the current attack.
 */
export type AttackAbilityHook = (ctx: AttackContext, self: Ship) => void;

export interface GameContext {
  state: GameState;
  /** The ship the ability belongs to (and, for self-triggered windows, the actor). */
  self: Ship;
  /** The triggering event, when relevant (e.g. the ActionPerformed for onPerformAction). */
  event?: GameEvent;
}
/** Returns extra events to append to the stream. */
export type GameAbilityHook = (ctx: GameContext) => GameEvent[];

/** An optional ("may") ability: offered to its owner when available. */
export interface OptionalAbility {
  label: string;
  available: (ctx: GameContext) => boolean;
  resolve: (ctx: GameContext) => GameEvent[];
}

export interface Ability {
  /** A short, original paraphrase (never the card's printed text). */
  note?: string;
  attack?: Partial<Record<AttackWindow, AttackAbilityHook>>;
  /** Mandatory game-window effects, auto-applied. */
  game?: Partial<Record<GameWindow, GameAbilityHook>>;
  /** Optional game-window effects, offered to the owner to use or skip. */
  optional?: Partial<Record<GameWindow, OptionalAbility>>;
}

const REGISTRY = new Map<string, Ability>();

export function registerAbility(xws: string, ability: Ability): void {
  REGISTRY.set(xws, ability);
}
export function getAbility(xws: string): Ability | undefined {
  return REGISTRY.get(xws);
}
/** Test seam: drop all registrations. */
export function clearAbilities(): void {
  REGISTRY.clear();
}
/** xws ids whose abilities are active on a ship: ship type, pilot, equipped upgrades. */
export function shipAbilitySources(ship: Ship): string[] {
  return [ship.shipType, ship.pilotXws, ...(ship.upgrades ?? [])].filter((x): x is string =>
    Boolean(x),
  );
}

/** First available optional ability for a ship at a window, or null. */
export function findOffer(
  state: GameState,
  window: GameWindow,
  self: Ship,
): { abilityXws: string; label: string } | null {
  for (const xws of shipAbilitySources(self)) {
    const opt = REGISTRY.get(xws)?.optional?.[window];
    if (opt && opt.available({ state, self })) return { abilityXws: xws, label: opt.label };
  }
  return null;
}

/** Resolve a used optional ability into events. */
export function resolveOptional(
  state: GameState,
  self: Ship,
  abilityXws: string,
  window: GameWindow,
): GameEvent[] {
  const opt = REGISTRY.get(abilityXws)?.optional?.[window];
  return opt ? opt.resolve({ state, self }) : [];
}

/** Run a ship's own abilities for a non-combat window; returns events to append. */
export function fireWindow(
  state: GameState,
  window: GameWindow,
  self: Ship,
  event?: GameEvent,
): GameEvent[] {
  const events: GameEvent[] = [];
  for (const xws of shipAbilitySources(self)) {
    const handler = REGISTRY.get(xws)?.game?.[window];
    if (handler) events.push(...handler({ state, self, event }));
  }
  return events;
}

/**
 * Collect attack-window hooks for one attack, bound to their owning ship.
 * Hooks come from *every* living ship — attacker and defender first (their
 * abilities resolve before bystanders'), then the rest by id — so aura abilities
 * on nearby ships (e.g. a reroll leader) can read the attack via their own `self`
 * and a friendly/enemy-at-range condition. Self-scoped abilities simply guard on
 * `self` being the attacker or target. Within a ship, in source order.
 */
export function gatherAttackHooks(
  state: GameState,
  attacker: Ship,
  target: Ship,
): Partial<Record<AttackWindow, ((ctx: AttackContext) => void)[]>> {
  const others = state.ships
    .filter((s) => s.hull > 0 && s.id !== attacker.id && s.id !== target.id)
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  const out: Partial<Record<AttackWindow, ((ctx: AttackContext) => void)[]>> = {};
  for (const ship of [attacker, target, ...others]) {
    for (const xws of shipAbilitySources(ship)) {
      const ability = REGISTRY.get(xws);
      if (!ability?.attack) continue;
      for (const w of Object.keys(ability.attack) as AttackWindow[]) {
        const handler = ability.attack[w]!;
        (out[w] ??= []).push((ctx) => handler(ctx, ship));
      }
    }
  }
  return out;
}
