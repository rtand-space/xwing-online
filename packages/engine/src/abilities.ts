import type { AttackContext, AttackWindow } from './combat';
import type { GameEvent } from './events';
import type { GameState, Ship } from './types';

/**
 * A card ability = handlers registered on named timing windows. R3-M1 covers the
 * attack pipeline; later milestones add game-wide windows (afterReveal, …).
 * `self` is the ship the ability belongs to, so a handler can tell whether it is
 * the attacker or the defender in the current attack.
 */
export type AttackAbilityHook = (ctx: AttackContext, self: Ship) => void;

/** Non-combat timing windows fired by the phase FSM. Extended as R3 grows. */
export type GameWindow = 'afterReveal' | 'afterMove' | 'onPerformAction' | 'onRoundEnd';

export interface GameContext {
  state: GameState;
  /** The ship the ability belongs to (and, for self-triggered windows, the actor). */
  self: Ship;
  /** The triggering event, when relevant (e.g. the ActionPerformed for onPerformAction). */
  event?: GameEvent;
}
/** Returns extra events to append to the stream. */
export type GameAbilityHook = (ctx: GameContext) => GameEvent[];

export interface Ability {
  /** A short, original paraphrase (never the card's printed text). */
  note?: string;
  attack?: Partial<Record<AttackWindow, AttackAbilityHook>>;
  game?: Partial<Record<GameWindow, GameAbilityHook>>;
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

/**
 * Collect attack-window hooks for one attack, bound to their owning ship.
 * Attacker's abilities resolve before the defender's (deterministic queue);
 * within a ship, in source order (ship type, pilot, then upgrades).
 */
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

export function gatherAttackHooks(
  attacker: Ship,
  target: Ship,
): Partial<Record<AttackWindow, ((ctx: AttackContext) => void)[]>> {
  const out: Partial<Record<AttackWindow, ((ctx: AttackContext) => void)[]>> = {};
  for (const ship of [attacker, target]) {
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
