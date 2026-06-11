import { rangeBand } from './arcs';
import { type AttackFace, type DefenceFace, rollAttack, rollDefence } from './dice';
import type { GameEvent } from './events';
import type { GameState, Ship } from './types';

/**
 * The ordered attack pipeline. Every resolution walks these windows in order.
 * R1 has no subscribers — but each is a real extension point, so the R3 ability
 * engine bolts on as data registering hooks rather than reshaping the engine.
 */
export const ATTACK_WINDOWS = [
  'onDeclare',
  'onRollAttack',
  'onModifyAttack',
  'onRollDefence',
  'onModifyDefence',
  'onCompare',
  'onDealDamage',
  'onAfterAttack',
] as const;
export type AttackWindow = (typeof ATTACK_WINDOWS)[number];

export interface AttackContext {
  state: GameState;
  attacker: Ship;
  target: Ship;
  range: number;
  attack: AttackFace[];
  defence: DefenceFace[];
  cursor: number;
  result: { hits: number; crits: number };
  events: GameEvent[];
}

export type AttackHook = (ctx: AttackContext) => void;

const countFace = <T>(arr: T[], f: T): number => arr.filter((x) => x === f).length;
const hasToken = (s: Ship, kind: 'focus' | 'evade'): boolean =>
  s.tokens.some((t) => t.kind === kind);

function drawAttack(ctx: AttackContext, n: number): AttackFace[] {
  const faces = rollAttack(ctx.state.rng.seed, ctx.cursor, n);
  ctx.cursor += n;
  ctx.events.push({ type: 'DiceRolled', kind: 'attack', shipId: ctx.attacker.id, faces });
  return faces;
}

function drawDefence(ctx: AttackContext, n: number): DefenceFace[] {
  const faces = rollDefence(ctx.state.rng.seed, ctx.cursor, n);
  ctx.cursor += n;
  ctx.events.push({ type: 'DiceRolled', kind: 'defence', shipId: ctx.target.id, faces });
  return faces;
}

const BUILTINS: Record<AttackWindow, AttackHook> = {
  onDeclare(ctx) {
    ctx.events.push({
      type: 'AttackDeclared',
      shipId: ctx.attacker.id,
      targetId: ctx.target.id,
      range: ctx.range,
    });
  },

  onRollAttack(ctx) {
    const n = ctx.attacker.primaryAttack + (ctx.range === 1 ? 1 : 0);
    ctx.attack = drawAttack(ctx, n);
  },

  onModifyAttack(ctx) {
    // rerolls resolve before changes
    const lock = ctx.attacker.tokens.find((t) => t.kind === 'lock' && t.targetId === ctx.target.id);
    const blanks = countFace(ctx.attack, 'blank');
    if (lock && blanks > 0) {
      const rerolled = drawAttack(ctx, blanks);
      ctx.attack = [...ctx.attack.filter((f) => f !== 'blank'), ...rerolled];
      ctx.events.push({
        type: 'TokenSpent',
        shipId: ctx.attacker.id,
        kind: 'lock',
        targetId: ctx.target.id,
      });
    }
    if (hasToken(ctx.attacker, 'focus') && countFace(ctx.attack, 'focus') > 0) {
      ctx.attack = ctx.attack.map((f) => (f === 'focus' ? 'hit' : f));
      ctx.events.push({ type: 'TokenSpent', shipId: ctx.attacker.id, kind: 'focus' });
    }
  },

  onRollDefence(ctx) {
    const n = ctx.target.agility + (ctx.range === 3 ? 1 : 0);
    ctx.defence = drawDefence(ctx, n);
  },

  onModifyDefence(ctx) {
    if (hasToken(ctx.target, 'focus') && countFace(ctx.defence, 'focus') > 0) {
      ctx.defence = ctx.defence.map((f) => (f === 'focus' ? 'evade' : f));
      ctx.events.push({ type: 'TokenSpent', shipId: ctx.target.id, kind: 'focus' });
    }
  },

  onCompare(ctx) {
    let evades = countFace(ctx.defence, 'evade');
    let hits = countFace(ctx.attack, 'hit');
    let crits = countFace(ctx.attack, 'crit');
    const cancelHits = Math.min(hits, evades);
    hits -= cancelHits;
    evades -= cancelHits;
    crits -= Math.min(crits, evades); // evades cancel hits before crits
    ctx.result = { hits, crits };
  },

  onDealDamage(ctx) {
    const total = ctx.result.hits + ctx.result.crits;
    if (total <= 0) return;
    const shieldsAfter = Math.max(0, ctx.target.shields - total);
    const hullDamage = Math.max(0, total - ctx.target.shields);
    const hullAfter = Math.max(0, ctx.target.hull - hullDamage);
    ctx.events.push({
      type: 'DamageDealt',
      shipId: ctx.target.id,
      amount: total,
      shieldsAfter,
      hullAfter,
      crits: ctx.result.crits,
    });
    if (hullAfter === 0 && ctx.target.hull > 0) {
      ctx.events.push({ type: 'ShipDestroyed', shipId: ctx.target.id });
    }
  },

  onAfterAttack() {
    // tokens already spent in the modify windows; nothing further in R1
  },
};

/** Resolve one attack, walking every timing window and returning the resulting events. */
export function resolveAttack(
  state: GameState,
  attackerId: string,
  targetId: string,
  hooks: Partial<Record<AttackWindow, AttackHook>> = {},
): GameEvent[] {
  const attacker = state.ships.find((s) => s.id === attackerId)!;
  const target = state.ships.find((s) => s.id === targetId)!;
  const ctx: AttackContext = {
    state,
    attacker,
    target,
    range: rangeBand(attacker, target) ?? 3,
    attack: [],
    defence: [],
    cursor: state.rng.cursor,
    result: { hits: 0, crits: 0 },
    events: [],
  };
  for (const w of ATTACK_WINDOWS) {
    BUILTINS[w](ctx);
    hooks[w]?.(ctx);
  }
  return ctx.events;
}
