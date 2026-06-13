import { inRange } from './arcs';
import type { AttackContext } from './combat';
import { type AttackFace, type DefenceFace, rollAttack, rollDefence } from './dice';
import type { GameEvent } from './events';
import type { GameState, Ship, ShipId, TokenKind } from './types';

/**
 * Ergonomic, correct building blocks for card abilities. Attack-window helpers
 * mutate the AttackContext (drawing fresh dice through `ctx.cursor` and recording
 * a DiceRolled event so replays stay exact); game-window helpers return events.
 */

const drawAttack = (ctx: AttackContext, n: number): AttackFace[] => {
  const faces = rollAttack(ctx.state.rng.seed, ctx.cursor, n);
  ctx.cursor += n;
  ctx.events.push({ type: 'DiceRolled', kind: 'attack', shipId: ctx.attacker.id, faces });
  return faces;
};
const drawDefence = (ctx: AttackContext, n: number): DefenceFace[] => {
  const faces = rollDefence(ctx.state.rng.seed, ctx.cursor, n);
  ctx.cursor += n;
  ctx.events.push({ type: 'DiceRolled', kind: 'defence', shipId: ctx.target.id, faces });
  return faces;
};

/** Roll `n` extra attack dice and add them. */
export function addAttackDice(ctx: AttackContext, n = 1): void {
  ctx.attack = [...ctx.attack, ...drawAttack(ctx, n)];
}
/** Roll `n` extra defence dice and add them. */
export function addDefenceDice(ctx: AttackContext, n = 1): void {
  ctx.defence = [...ctx.defence, ...drawDefence(ctx, n)];
}

/** Reroll up to `max` attack dice showing `face` (rerolls happen before changes). */
export function rerollAttack(ctx: AttackContext, face: AttackFace, max = Infinity): void {
  const count = Math.min(max, ctx.attack.filter((f) => f === face).length);
  if (count === 0) return;
  let dropped = 0;
  const kept = ctx.attack.filter((f) => !(f === face && dropped++ < count));
  ctx.attack = [...kept, ...drawAttack(ctx, count)];
}
/** Reroll up to `max` defence dice showing `face`. */
export function rerollDefence(ctx: AttackContext, face: DefenceFace, max = Infinity): void {
  const count = Math.min(max, ctx.defence.filter((f) => f === face).length);
  if (count === 0) return;
  let dropped = 0;
  const kept = ctx.defence.filter((f) => !(f === face && dropped++ < count));
  ctx.defence = [...kept, ...drawDefence(ctx, count)];
}

/** Change up to `max` attack results from `from` to `to` (no dice rolled). */
export function changeAttack(
  ctx: AttackContext,
  from: AttackFace,
  to: AttackFace,
  max = Infinity,
): void {
  let changed = 0;
  ctx.attack = ctx.attack.map((f) => (f === from && changed++ < max ? to : f));
}
/** Change up to `max` defence results from `from` to `to`. */
export function changeDefence(
  ctx: AttackContext,
  from: DefenceFace,
  to: DefenceFace,
  max = Infinity,
): void {
  let changed = 0;
  ctx.defence = ctx.defence.map((f) => (f === from && changed++ < max ? to : f));
}

// --- game-window / optional-ability event builders ---
export const gainToken = (self: Ship, kind: TokenKind, targetId?: ShipId): GameEvent => ({
  type: 'TokenGained',
  shipId: self.id,
  kind,
  targetId,
});
/** Charges in a pool: an upgrade's own pool when `source` is its xws, else the
 *  ship's intrinsic pool. */
export const chargesFrom = (self: Ship, source?: string): number =>
  source ? (self.upgradeCharges?.[source]?.charges ?? 0) : self.charges;

export const spendCharge = (self: Ship, source?: string, n = 1): GameEvent => ({
  type: 'ChargeChanged',
  shipId: self.id,
  delta: -n,
  source,
});
export const recoverCharge = (self: Ship, source?: string, n = 1): GameEvent => ({
  type: 'ChargeChanged',
  shipId: self.id,
  delta: n,
  source,
});
export const spendForce = (self: Ship, n = 1): GameEvent => ({
  type: 'ForceChanged',
  shipId: self.id,
  delta: -n,
});
export const addStress = (self: Ship, delta = 1): GameEvent => ({
  type: 'StressChanged',
  shipId: self.id,
  delta,
});

/** Living friendly ships (excluding self) within range `max`. */
export const friendliesInRange = (state: GameState, self: Ship, max: number): Ship[] =>
  state.ships.filter(
    (s) => s.id !== self.id && s.ownerId === self.ownerId && s.hull > 0 && inRange(self, s, max),
  );

/** Offer to grant one of `candidates` a free action (optionally spending the
 *  granter's Force); the granter then picks the recipient or declines. */
export const offerActionGrant = (
  self: Ship,
  candidates: ShipId[],
  spendForce = false,
): GameEvent => ({ type: 'GrantOffered', granterId: self.id, candidates, spendForce });

/** Grant `self` a bonus attack (optionally restricted to `targets`); it reuses the
 *  normal attack flow but does not count as the ship's engagement. */
export const offerBonusAttack = (self: Ship, targets?: ShipId[]): GameEvent => ({
  type: 'BonusAttackOffered',
  shipId: self.id,
  targets,
});
