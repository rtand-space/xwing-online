import { gatherAttackHooks, getAbility, shipAbilitySources } from './abilities';
import { attackValue, rangeBand } from './arcs';
import { type AttackFace, type DefenceFace, rollAttack, rollDefence } from './dice';
import type { GameEvent } from './events';
import { lineObstructed } from './obstacles';
import { agilityBonus, attackPenalty, defencePenalty } from './tokens';
import type { CombatState, GameState, Ship, SpendKind, TokenKind } from './types';

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
  obstructed: boolean;
  /** True for a bonus attack — recorded on AttackDeclared so it doesn't engage. */
  bonus?: boolean;
  attack: AttackFace[];
  defence: DefenceFace[];
  cursor: number;
  result: { hits: number; crits: number };
  events: GameEvent[];
}

export type AttackHook = (ctx: AttackContext) => void;

const countFace = <T>(arr: T[], f: T): number => arr.filter((x) => x === f).length;
const hasToken = (s: Ship, kind: TokenKind): boolean => s.tokens.some((t) => t.kind === kind);
const countTokens = (s: Ship, kind: TokenKind): number =>
  s.tokens.filter((t) => t.kind === kind).length;

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
      bonus: ctx.bonus,
    });
  },

  onRollAttack(ctx) {
    // dice come from the arc bearing on the target (falls back to the front value);
    // deplete removes one and is then spent
    const value = attackValue(ctx.attacker, ctx.target) ?? ctx.attacker.primaryAttack;
    const n = Math.max(0, value + (ctx.range === 1 ? 1 : 0) - attackPenalty(ctx.attacker));
    ctx.attack = drawAttack(ctx, n);
    if (hasToken(ctx.attacker, 'deplete')) {
      ctx.events.push({ type: 'TokenSpent', shipId: ctx.attacker.id, kind: 'deplete' });
    }
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
    } else {
      // calculate is a weaker focus: each token converts one focus result.
      const n = Math.min(countTokens(ctx.attacker, 'calculate'), countFace(ctx.attack, 'focus'));
      let changed = 0;
      ctx.attack = ctx.attack.map((f) => {
        if (f === 'focus' && changed < n) {
          changed++;
          return 'hit';
        }
        return f;
      });
      for (let i = 0; i < n; i++) {
        ctx.events.push({ type: 'TokenSpent', shipId: ctx.attacker.id, kind: 'calculate' });
      }
      // a Force user can spend Force the same way, for any remaining focus results
      const f = Math.min(ctx.attacker.force ?? 0, countFace(ctx.attack, 'focus'));
      if (f > 0) {
        let spent = 0;
        ctx.attack = ctx.attack.map((face) => {
          if (face === 'focus' && spent < f) {
            spent++;
            return 'hit';
          }
          return face;
        });
        ctx.events.push({ type: 'ForceChanged', shipId: ctx.attacker.id, delta: -f });
      }
    }
  },

  onRollDefence(ctx) {
    // cloak adds agility dice; tractor/strain remove them (strain then spent)
    const n = Math.max(
      0,
      ctx.target.agility +
        agilityBonus(ctx.target) -
        defencePenalty(ctx.target) +
        (ctx.range === 3 ? 1 : 0) +
        (ctx.obstructed ? 1 : 0),
    );
    ctx.defence = drawDefence(ctx, n);
    if (hasToken(ctx.target, 'strain')) {
      ctx.events.push({ type: 'TokenSpent', shipId: ctx.target.id, kind: 'strain' });
    }
  },

  onModifyDefence(ctx) {
    if (hasToken(ctx.target, 'focus') && countFace(ctx.defence, 'focus') > 0) {
      ctx.defence = ctx.defence.map((f) => (f === 'focus' ? 'evade' : f));
      ctx.events.push({ type: 'TokenSpent', shipId: ctx.target.id, kind: 'focus' });
    } else {
      const n = Math.min(countTokens(ctx.target, 'calculate'), countFace(ctx.defence, 'focus'));
      let changed = 0;
      ctx.defence = ctx.defence.map((f) => {
        if (f === 'focus' && changed < n) {
          changed++;
          return 'evade';
        }
        return f;
      });
      for (let i = 0; i < n; i++) {
        ctx.events.push({ type: 'TokenSpent', shipId: ctx.target.id, kind: 'calculate' });
      }
      const f = Math.min(ctx.target.force ?? 0, countFace(ctx.defence, 'focus'));
      if (f > 0) {
        let spent = 0;
        ctx.defence = ctx.defence.map((face) => {
          if (face === 'focus' && spent < f) {
            spent++;
            return 'evade';
          }
          return face;
        });
        ctx.events.push({ type: 'ForceChanged', shipId: ctx.target.id, delta: -f });
      }
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
    // Reinforce: while reinforced, an attack of 2+ uncancelled results deals 1 less.
    if (hasToken(ctx.target, 'reinforce') && ctx.result.hits + ctx.result.crits >= 2) {
      if (ctx.result.hits > 0) ctx.result.hits--;
      else ctx.result.crits--;
    }
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
    obstructed: lineObstructed(state, attacker, target),
    attack: [],
    defence: [],
    cursor: state.rng.cursor,
    result: { hits: 0, crits: 0 },
    events: [],
  };
  const registered = gatherAttackHooks(state, attacker, target);
  for (const w of ATTACK_WINDOWS) {
    BUILTINS[w](ctx);
    for (const h of registered[w] ?? []) h(ctx);
    hooks[w]?.(ctx);
  }
  return ctx.events;
}

// --- Interactive resolution (R4-M8): the same windows, but token spends are the
// owner's choice, so resolution pauses for a modify step instead of auto-applying.

function makeCtx(state: GameState, c: CombatState): AttackContext {
  return {
    state,
    attacker: state.ships.find((s) => s.id === c.attackerId)!,
    target: state.ships.find((s) => s.id === c.targetId)!,
    range: c.range,
    obstructed: c.obstructed,
    attack: [...c.attack],
    defence: [...c.defence],
    cursor: state.rng.cursor,
    result: { hits: 0, crits: 0 },
    events: [],
  };
}

function changeOne<T>(arr: T[], from: T, to: T): T[] {
  let done = false;
  return arr.map((f) => (!done && f === from ? ((done = true), to) : f));
}

/** Declare the attack and roll its dice (incl. bonus-die abilities). No spends. */
export function beginAttack(
  state: GameState,
  attackerId: string,
  targetId: string,
  bonus = false,
): { events: GameEvent[]; attack: AttackFace[]; range: number; obstructed: boolean } {
  const attacker = state.ships.find((s) => s.id === attackerId)!;
  const target = state.ships.find((s) => s.id === targetId)!;
  const ctx: AttackContext = {
    state,
    attacker,
    target,
    range: rangeBand(attacker, target) ?? 3,
    obstructed: lineObstructed(state, attacker, target),
    bonus,
    attack: [],
    defence: [],
    cursor: state.rng.cursor,
    result: { hits: 0, crits: 0 },
    events: [],
  };
  const reg = gatherAttackHooks(state, attacker, target);
  for (const w of ['onDeclare', 'onRollAttack'] as const) {
    BUILTINS[w](ctx);
    for (const h of reg[w] ?? []) h(ctx);
  }
  return { events: ctx.events, attack: ctx.attack, range: ctx.range, obstructed: ctx.obstructed };
}

/** True if `suppressedId`'s dice modifications are prevented by the opponent's
 *  lock-down ability (e.g. Midnight). */
function lockedDown(state: GameState, c: CombatState, suppressedId: string): boolean {
  const opponent = state.ships.find(
    (s) => s.id === (suppressedId === c.attackerId ? c.targetId : c.attackerId),
  );
  if (!opponent || opponent.hull <= 0) return false;
  const ctx = makeCtx(state, c);
  return shipAbilitySources(opponent).some((xws) => getAbility(xws)?.lockdown?.(ctx, opponent));
}

/** The ship who owns the current modify step, and which window its abilities use. */
function stepOwner(state: GameState, c: CombatState): { ship: Ship; window: AttackWindow } {
  const id = c.step === 'defence' ? c.targetId : c.attackerId;
  return {
    ship: state.ships.find((s) => s.id === id)!,
    window: c.step === 'attack' ? 'onModifyAttack' : 'onModifyDefence',
  };
}

/** Optional token spends available to whoever owns the current modify step. */
export function combatSpends(state: GameState, c: CombatState): SpendKind[] {
  if (c.step === 'after-defence') return []; // attacker spent its tokens in the attack step
  const ownerId = c.step === 'defence' ? c.targetId : c.attackerId;
  if (lockedDown(state, c, ownerId)) return []; // dice can't be modified
  const ship = state.ships.find((s) => s.id === (c.step === 'attack' ? c.attackerId : c.targetId))!;
  const pool: (AttackFace | DefenceFace)[] = c.step === 'attack' ? c.attack : c.defence;
  const opts: SpendKind[] = [];
  if (hasToken(ship, 'focus') && pool.includes('focus')) opts.push('focus');
  // a lock reroll is only offered before any result has been changed
  if (
    c.step === 'attack' &&
    !c.changed &&
    ship.tokens.some((t) => t.kind === 'lock' && t.targetId === c.targetId) &&
    pool.includes('blank')
  )
    opts.push('lock');
  if (countTokens(ship, 'calculate') > 0 && pool.includes('focus')) opts.push('calculate');
  if ((ship.force ?? 0) > 0 && pool.includes('focus')) opts.push('force');
  return opts;
}

/** The step owner's available optional ("may") abilities for the current modify step. */
export function combatAbilities(
  state: GameState,
  c: CombatState,
): { xws: string; label: string }[] {
  const { ship: owner, window } = stepOwner(state, c);
  if (lockedDown(state, c, owner.id)) return []; // dice can't be modified
  const ctx = makeCtx(state, c);
  const out: { xws: string; label: string }[] = [];
  for (const xws of shipAbilitySources(owner)) {
    const opt = getAbility(xws)?.optionalAttack?.[window];
    if (!opt || (opt.reroll && c.changed)) continue; // rerolls only before changes
    if (c.usedAbilities?.includes(xws)) continue; // each offered at most once per attack
    if (opt.available(ctx, owner)) out.push({ xws, label: opt.label });
  }
  return out;
}

/** Apply one optional ability to the active pool; returns the new pool + events. */
export function applyOptionalAbility(
  state: GameState,
  c: CombatState,
  xws: string,
): { attack?: AttackFace[]; defence?: DefenceFace[]; events: GameEvent[]; changed: boolean } {
  const { ship: owner, window } = stepOwner(state, c);
  const opt = getAbility(xws)!.optionalAttack![window]!;
  const ctx = makeCtx(state, c);
  opt.apply(ctx, owner);
  return c.step === 'attack'
    ? { attack: ctx.attack, events: ctx.events, changed: !opt.reroll }
    : { defence: ctx.defence, events: ctx.events, changed: !opt.reroll };
}

/** Apply one optional spend to the active pool; returns the new pool + events. */
export function applySpend(
  state: GameState,
  c: CombatState,
  kind: SpendKind,
): { attack?: AttackFace[]; defence?: DefenceFace[]; events: GameEvent[] } {
  const events: GameEvent[] = [];
  const shipId = c.step === 'attack' ? c.attackerId : c.targetId;
  const to = c.step === 'attack' ? 'hit' : 'evade';
  if (c.step === 'attack' && kind === 'lock') {
    const rerolled = rollAttack(state.rng.seed, state.rng.cursor, countFace(c.attack, 'blank'));
    events.push({ type: 'DiceRolled', kind: 'attack', shipId, faces: rerolled });
    events.push({ type: 'TokenSpent', shipId, kind: 'lock', targetId: c.targetId });
    return { attack: [...c.attack.filter((f) => f !== 'blank'), ...rerolled], events };
  }
  const spend: GameEvent =
    kind === 'focus' || kind === 'calculate'
      ? { type: 'TokenSpent', shipId, kind }
      : { type: 'ForceChanged', shipId, delta: -1 };
  events.push(spend);
  if (c.step === 'attack') {
    const attack =
      kind === 'focus'
        ? c.attack.map((f) => (f === 'focus' ? 'hit' : f))
        : changeOne(c.attack, 'focus', to as AttackFace);
    return { attack, events };
  }
  const defence =
    kind === 'focus'
      ? c.defence.map((f) => (f === 'focus' ? 'evade' : f))
      : changeOne(c.defence, 'focus', 'evade');
  return { defence, events };
}

/** Run the registered (auto, for now) onModifyAttack abilities against the pool. */
export function applyAttackAbilities(
  state: GameState,
  c: CombatState,
): { attack: AttackFace[]; events: GameEvent[] } {
  // a locked-down attacker can't modify its attack dice
  if (lockedDown(state, c, c.attackerId)) return { attack: [...c.attack], events: [] };
  const ctx = makeCtx(state, c);
  for (const h of gatherAttackHooks(state, ctx.attacker, ctx.target).onModifyAttack ?? []) h(ctx);
  return { attack: ctx.attack, events: ctx.events };
}

/** Roll the defence dice (builtin + registered onRollDefence). No spends. */
export function rollDefenceStage(
  state: GameState,
  c: CombatState,
): { defence: DefenceFace[]; events: GameEvent[] } {
  const ctx = makeCtx(state, c);
  const reg = gatherAttackHooks(state, ctx.attacker, ctx.target);
  BUILTINS.onRollDefence(ctx);
  for (const h of reg.onRollDefence ?? []) h(ctx);
  return { defence: ctx.defence, events: ctx.events };
}

/** Resolve registered onModifyDefence, then compare and deal damage. */
export function finishCombat(state: GameState, c: CombatState): GameEvent[] {
  const ctx = makeCtx(state, c);
  const reg = gatherAttackHooks(state, ctx.attacker, ctx.target);
  // a locked-down defender's dice can't be modified (by either side)
  if (!lockedDown(state, c, c.targetId)) for (const h of reg.onModifyDefence ?? []) h(ctx);
  for (const w of ['onCompare', 'onDealDamage', 'onAfterAttack'] as const) {
    BUILTINS[w](ctx);
    for (const h of reg[w] ?? []) h(ctx);
  }
  return ctx.events;
}
