import {
  type AttackContext,
  effectiveInitiative,
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

const maneuver = (speed: number) =>
  ({ speed, bearing: 'straight', difficulty: 'white' }) as Ship['dial'];

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

  it('Juke turns a defender evade into a focus when the attacker is evading', () => {
    const hook = getAbility('juke')!.attack!.onModifyDefence!;
    const evading: Ship = { ...ship('a', { x: 0, y: 0, angle: 0 }), tokens: [{ kind: 'evade' }] };
    const c = ctx(evading, ship('t', { x: 0, y: 100, angle: 0 }), ['hit']);
    c.defence = ['evade', 'blank'];
    hook(c, evading);
    expect(c.defence.filter((f) => f === 'evade')).toHaveLength(0);
    expect(c.defence.filter((f) => f === 'focus')).toHaveLength(1);

    const plain = ship('a', { x: 0, y: 0, angle: 0 });
    const c2 = ctx(plain, ship('t', { x: 0, y: 100, angle: 0 }), ['hit']);
    c2.defence = ['evade'];
    hook(c2, plain);
    expect(c2.defence).toEqual(['evade']);
  });

  it('Fearless turns a result into a hit at range 1 inside the defender’s arc', () => {
    const atk = ship('a', { x: 0, y: 0, angle: 0 });
    const hook = getAbility('fearless')!.attack!.onModifyAttack!;

    const c = ctx(atk, ship('t', { x: 0, y: 100, angle: 180 }), ['blank', 'focus']);
    c.range = 1;
    hook(c, atk);
    expect(c.attack.filter((f) => f === 'hit')).toHaveLength(1);

    const far = ctx(atk, ship('t', { x: 0, y: 100, angle: 180 }), ['blank']);
    far.range = 3;
    hook(far, atk);
    expect(far.attack).toEqual(['blank']);
  });

  it('Marksmanship upgrades a hit to a crit against a bullseye target', () => {
    const atk = ship('a', { x: 0, y: 0, angle: 0 });
    const hook = getAbility('marksmanship')!.attack!.onModifyAttack!;

    const bull = ctx(atk, ship('t', { x: 0, y: 100, angle: 0 }), ['hit', 'blank']);
    hook(bull, atk);
    expect(bull.attack).toEqual(['crit', 'blank']);

    const offAxis = ctx(atk, ship('t', { x: 200, y: 100, angle: 0 }), ['hit', 'blank']);
    hook(offAxis, atk);
    expect(offAxis.attack).toEqual(['hit', 'blank']);
  });

  it('Predator rerolls a blank only against a bullseye target', () => {
    const atk = ship('a', { x: 0, y: 0, angle: 0 });
    const hook = getAbility('predator')!.attack!.onModifyAttack!;

    const bull = ctx(atk, ship('t', { x: 0, y: 100, angle: 0 }), ['blank', 'hit']);
    hook(bull, atk);
    expect(bull.attack).toHaveLength(2);
    expect(bull.cursor).toBe(1); // one reroll drawn

    const offAxis = ctx(atk, ship('t', { x: 200, y: 100, angle: 0 }), ['blank', 'hit']);
    hook(offAxis, atk);
    expect(offAxis.cursor).toBe(0);
  });

  it('Fanatical turns a focus into a hit only while unshielded', () => {
    const hook = getAbility('fanatical')!.attack!.onModifyAttack!;
    const bare = ship('a', { x: 0, y: 0, angle: 0 });
    const c = ctx(bare, ship('t', { x: 0, y: 100, angle: 0 }), ['focus', 'blank']);
    hook(c, bare);
    expect(c.attack).toEqual(['hit', 'blank']);

    const shielded: Ship = { ...ship('a', { x: 0, y: 0, angle: 0 }), shields: 1 };
    const c2 = ctx(shielded, ship('t', { x: 0, y: 100, angle: 0 }), ['focus']);
    hook(c2, shielded);
    expect(c2.attack).toEqual(['focus']);
  });

  it('Trick Shot adds a die only when the shot is obstructed', () => {
    const atk = ship('a', { x: 0, y: 0, angle: 0 });
    const hook = getAbility('trickshot')!.attack!.onRollAttack!;
    const c = ctx(atk, ship('t', { x: 0, y: 100, angle: 0 }), ['hit']);
    c.obstructed = true;
    hook(c, atk);
    expect(c.attack).toHaveLength(2);

    const clear = ctx(atk, ship('t', { x: 0, y: 100, angle: 0 }), ['hit']);
    hook(clear, atk);
    expect(clear.attack).toHaveLength(1);
  });

  it('Crack Shot is offered to spend a charge to cancel an evade against a bullseye target', () => {
    const opt = getAbility('crackshot')!.optionalAttack!.onModifyDefence!;
    const armed: Ship = {
      ...ship('a', { x: 0, y: 0, angle: 0 }),
      upgradeCharges: { crackshot: { charges: 1, max: 1, recovers: 0 } },
    };
    const c = ctx(armed, ship('t', { x: 0, y: 100, angle: 0 }), ['hit']);
    c.defence = ['evade', 'blank'];
    expect(opt.available(c, armed)).toBe(true);
    opt.apply(c, armed);
    expect(c.defence.filter((f) => f === 'evade')).toHaveLength(0);
    expect(c.events.some((e) => e.type === 'ChargeChanged' && e.delta === -1)).toBe(true);

    const empty = ship('a', { x: 0, y: 0, angle: 0 }); // 0 charges → not offered
    const c2 = ctx(empty, ship('t', { x: 0, y: 100, angle: 0 }), ['hit']);
    c2.defence = ['evade'];
    expect(opt.available(c2, empty)).toBe(false);
  });

  it('Heroic rerolls an all-blank attack of 2+ dice', () => {
    const atk = ship('a', { x: 0, y: 0, angle: 0 });
    const hook = getAbility('heroic')!.attack!.onModifyAttack!;
    const c = ctx(atk, ship('t', { x: 0, y: 100, angle: 0 }), ['blank', 'blank']);
    hook(c, atk);
    expect(c.cursor).toBe(2); // both rerolled
    expect(c.events.filter((e) => e.type === 'DiceRolled')).toHaveLength(1);

    const mixed = ctx(atk, ship('t', { x: 0, y: 100, angle: 0 }), ['blank', 'hit']);
    hook(mixed, atk);
    expect(mixed.cursor).toBe(0); // not all blanks → nothing
  });

  it('Gideon Hask adds a die against a damaged defender', () => {
    const hook = getAbility('gideonhask')!.attack!.onRollAttack!;
    const atk = ship('a', { x: 0, y: 0, angle: 0 });
    const damaged = { ...ship('t', { x: 0, y: 100, angle: 0 }), hull: 2 }; // maxHull 3
    const c = ctx(atk, damaged, ['hit']);
    hook(c, atk);
    expect(c.attack).toHaveLength(2);
    const healthy = ctx(atk, ship('t', { x: 0, y: 100, angle: 0 }), ['hit']);
    hook(healthy, atk);
    expect(healthy.attack).toHaveLength(1);
  });

  it('Graz adds an attack die from behind the defender', () => {
    const hook = getAbility('graz')!.attack!.onRollAttack!;
    const atk = ship('a', { x: 0, y: 0, angle: 0 });
    const behind = ctx(atk, ship('t', { x: 0, y: 100, angle: 0 }), ['hit']); // t faces +y, a is behind
    hook(behind, atk);
    expect(behind.attack).toHaveLength(2);
    const front = ctx(atk, ship('t', { x: 0, y: 100, angle: 180 }), ['hit']); // t faces a
    hook(front, atk);
    expect(front.attack).toHaveLength(1);
  });

  it('Ahhav adds a die against a larger ship', () => {
    const hook = getAbility('ahhav')!.attack!.onRollAttack!;
    const atk = ship('a', { x: 0, y: 0, angle: 0 }); // small
    const big = ctx(atk, { ...ship('t', { x: 0, y: 100, angle: 0 }), base: 'large' }, ['hit']);
    hook(big, atk);
    expect(big.attack).toHaveLength(2);
    const same = ctx(atk, ship('t', { x: 0, y: 100, angle: 0 }), ['hit']);
    hook(same, atk);
    expect(same.attack).toHaveLength(1);
  });

  it('Laetin A’shera gains an evade after a clean miss', () => {
    const hook = getAbility('laetinashera')!.attack!.onAfterAttack!;
    const atk = ship('a', { x: 0, y: 0, angle: 0 });
    const c = ctx(atk, ship('t', { x: 0, y: 100, angle: 0 }), []);
    c.result = { hits: 0, crits: 0 };
    hook(c, atk);
    expect(c.events.some((e) => e.type === 'TokenGained' && e.kind === 'evade')).toBe(true);
    const hit = ctx(atk, ship('t', { x: 0, y: 100, angle: 0 }), []);
    hit.result = { hits: 2, crits: 0 };
    hook(hit, atk);
    expect(hit.events).toHaveLength(0);
  });

  it('Null and Rush override initiative by damage state', () => {
    const base = (xws: string, init: number): Ship => ({
      ...ship('s', { x: 0, y: 0, angle: 0 }),
      pilotXws: xws,
      initiative: init,
      hull: 3,
      maxHull: 3,
    });
    const n = base('null', 1);
    expect(effectiveInitiative(n)).toBe(7); // undamaged
    expect(effectiveInitiative({ ...n, hull: 2 })).toBe(1); // damaged → printed
    const r = base('rush', 2);
    expect(effectiveInitiative(r)).toBe(2); // undamaged → printed
    expect(effectiveInitiative({ ...r, hull: 2 })).toBe(6); // damaged
  });

  it('Longshot adds an attack die at range 3 (automatic)', () => {
    const hook = getAbility('longshot')!.attack!.onRollAttack!;
    const atk = ship('a', { x: 0, y: 0, angle: 0 });
    const c = ctx(atk, ship('t', { x: 0, y: 100, angle: 0 }), ['hit']);
    c.range = 3;
    hook(c, atk);
    expect(c.attack).toHaveLength(2);
    const close = ctx(atk, ship('t', { x: 0, y: 100, angle: 0 }), ['hit']);
    close.range = 1;
    hook(close, atk);
    expect(close.attack).toHaveLength(1);
  });

  it('Blackout strips two defence dice on an obstructed shot (automatic)', () => {
    const hook = getAbility('blackout')!.attack!.onRollDefence!;
    const atk = ship('a', { x: 0, y: 0, angle: 0 });
    const c = ctx(atk, ship('t', { x: 0, y: 100, angle: 0 }), ['hit']);
    c.obstructed = true;
    c.defence = ['evade', 'focus', 'blank'];
    hook(c, atk);
    expect(c.defence).toEqual(['evade']);
  });

  it('DT-798 is offered to take strain for an extra die', () => {
    const opt = getAbility('dt798')!.optionalAttack!.onModifyAttack!;
    const atk = ship('a', { x: 0, y: 0, angle: 0 });
    const c = ctx(atk, ship('t', { x: 0, y: 100, angle: 0 }), ['hit']);
    expect(opt.available(c, atk)).toBe(true);
    opt.apply(c, atk);
    expect(c.attack).toHaveLength(2);
    expect(c.events.some((e) => e.type === 'TokenGained' && e.kind === 'strain')).toBe(true);
    const strained: Ship = { ...atk, tokens: [{ kind: 'strain' }] };
    expect(opt.available(ctx(strained, ship('t', { x: 0, y: 100, angle: 0 }), ['hit']), strained)).toBe(false);
  });

  it('Static is offered to spend a lock and focus to make every die a crit', () => {
    const opt = getAbility('static')!.optionalAttack!.onModifyAttack!;
    const loaded: Ship = {
      ...ship('a', { x: 0, y: 0, angle: 0 }),
      tokens: [{ kind: 'lock', targetId: 't' }, { kind: 'focus' }],
    };
    const c = ctx(loaded, ship('t', { x: 0, y: 100, angle: 0 }), ['hit', 'blank', 'focus']);
    expect(opt.available(c, loaded)).toBe(true);
    opt.apply(c, loaded);
    expect(c.attack).toEqual(['crit', 'crit', 'crit']);
    expect(c.events.filter((e) => e.type === 'TokenSpent')).toHaveLength(2);
    const noLock = ship('a', { x: 0, y: 0, angle: 0 });
    expect(opt.available(ctx(noLock, ship('t', { x: 0, y: 100, angle: 0 }), ['hit']), noLock)).toBe(false);
  });

  it('Ric Olié adds a die when his maneuver is faster (cost-free, automatic)', () => {
    const hook = getAbility('ricolie')!.attack!.onRollAttack!;
    const fast: Ship = { ...ship('a', { x: 0, y: 0, angle: 0 }), dial: maneuver(3) };
    const slow: Ship = { ...ship('t', { x: 0, y: 100, angle: 0 }), dial: maneuver(1) };
    const c = ctx(fast, slow, ['hit']);
    hook(c, fast);
    expect(c.attack).toHaveLength(2);
    const even = ctx(fast, { ...slow, dial: maneuver(3) }, ['hit']);
    hook(even, fast);
    expect(even.attack).toHaveLength(1);
  });

  it('Scorch is offered to take a stress for an extra die', () => {
    const opt = getAbility('scorch')!.optionalAttack!.onModifyAttack!;
    const a = ship('a', { x: 0, y: 0, angle: 0 });
    const c = ctx(a, ship('t', { x: 0, y: 100, angle: 0 }), ['hit']);
    expect(opt.available(c, a)).toBe(true);
    opt.apply(c, a);
    expect(c.attack).toHaveLength(2);
    expect(c.events.some((e) => e.type === 'StressChanged' && e.delta === 1)).toBe(true);
    const stressed: Ship = { ...a, tokens: [{ kind: 'stress' }] };
    expect(opt.available(ctx(stressed, ship('t', { x: 0, y: 100, angle: 0 }), ['hit']), stressed)).toBe(false);
  });

  it('Darth Vader (BoY) is offered to spend Force to turn a blank into a hit', () => {
    const opt = getAbility('darthvader-battleofyavin')!.optionalAttack!.onModifyAttack!;
    const forced: Ship = { ...ship('a', { x: 0, y: 0, angle: 0 }), force: 1, maxForce: 1 };
    const c = ctx(forced, ship('t', { x: 0, y: 100, angle: 0 }), ['blank', 'hit']);
    expect(opt.available(c, forced)).toBe(true);
    opt.apply(c, forced);
    expect(c.attack).toEqual(['hit', 'hit']);
    expect(c.events.some((e) => e.type === 'ForceChanged' && e.delta === -1)).toBe(true);
    const noForce = ship('a', { x: 0, y: 0, angle: 0 });
    expect(opt.available(ctx(noForce, ship('t', { x: 0, y: 100, angle: 0 }), ['blank']), noForce)).toBe(false);
  });

  it('Ezra Bridger only offers his defence Force-change while he is the defender and stressed', () => {
    const opt = getAbility('ezrabridger')!.optionalAttack!.onModifyDefence!;
    const ezra: Ship = {
      ...ship('e', { x: 0, y: 0, angle: 0 }),
      force: 1,
      maxForce: 1,
      tokens: [{ kind: 'stress' }],
    };
    const atk = ship('a', { x: 0, y: 100, angle: 0 });
    const defending = ctx(atk, ezra, ['hit']); // ezra is the target/defender
    defending.defence = ['focus', 'focus', 'blank'];
    expect(opt.available(defending, ezra)).toBe(true);
    opt.apply(defending, ezra);
    expect(defending.defence).toEqual(['evade', 'evade', 'blank']);

    const attacking = ctx(ezra, atk, ['hit']); // ezra is the attacker → not his defence ability
    attacking.defence = ['focus'];
    expect(opt.available(attacking, ezra)).toBe(false);
  });

  it('Dengar returns fire on an attacker in his front arc, spending a charge', () => {
    const opt = getAbility('dengar')!.optional!.afterDefend!;
    const dengar: Ship = { ...ship('d', { x: 0, y: 0, angle: 0 }), charges: 1, maxCharges: 1 };
    const attacker = ship('a', { x: 0, y: 100, angle: 180 }); // ahead → in Dengar's front arc
    const st = { ships: [dengar, attacker] } as unknown as GameState;
    expect(opt.available({ state: st, self: dengar, attackerId: 'a' })).toBe(true);
    const evs = opt.resolve({ state: st, self: dengar, attackerId: 'a' });
    expect(evs.some((e) => e.type === 'ChargeChanged' && e.delta === -1)).toBe(true);
    const bonus = evs.find((e) => e.type === 'BonusAttackOffered');
    expect(bonus && bonus.type === 'BonusAttackOffered' && bonus.targets).toEqual(['a']);
    expect(opt.available({ state: st, self: dengar })).toBe(false); // no attacker context
  });

  it('Lieutenant Tavson offers to spend a charge for a free action when damaged', () => {
    const opt = getAbility('lieutenanttavson')!.optional!.onDamaged!;
    const armed: Ship = { ...ship('a', { x: 0, y: 0, angle: 0 }), charges: 1, maxCharges: 1 };
    expect(opt.available({ state, self: armed })).toBe(true);
    const evs = opt.resolve({ state, self: armed });
    expect(evs.some((e) => e.type === 'ChargeChanged' && e.delta === -1)).toBe(true);
    expect(evs.some((e) => e.type === 'ActionGranted' && e.shipId === 'a')).toBe(true);
    const empty = ship('a', { x: 0, y: 0, angle: 0 }); // 0 charges
    expect(opt.available({ state, self: empty })).toBe(false);
  });

  it('Airen Cracken offers a friendly an action after attacking', () => {
    const hook = getAbility('airencracken')!.attack!.onAfterAttack!;
    const atk = ship('a', { x: 0, y: 0, angle: 0 }); // owner 'a'
    const friend = { ...ship('f', { x: 0, y: 60, angle: 0 }), ownerId: 'a' }; // friendly, range 1
    const target = ship('t', { x: 0, y: 200, angle: 0 });
    const c = ctx(atk, target, []);
    c.state = { ships: [atk, friend, target] } as unknown as GameState;
    hook(c, atk);
    const offered = c.events.find((e) => e.type === 'GrantOffered');
    expect(offered && offered.type === 'GrantOffered' && offered.candidates).toEqual(['f']);
  });

  it('Howlrunner rerolls a blank for a friendly ship at range 0–1 only', () => {
    const hook = getAbility('howlrunner')!.attack!.onModifyAttack!;
    const howl = ship('h', { x: 0, y: 0, angle: 0 }); // owner 'h'
    const enemy = ship('t', { x: 0, y: 100, angle: 0 });

    const friend = { ...ship('f', { x: 60, y: 0, angle: 0 }), ownerId: 'h' };
    const near = ctx(friend, enemy, ['blank', 'hit']);
    hook(near, howl);
    expect(near.cursor).toBe(1); // friendly + in range → reroll the blank

    const farFriend = { ...ship('g', { x: 0, y: 400, angle: 0 }), ownerId: 'h' };
    const far = ctx(farFriend, enemy, ['blank', 'hit']);
    hook(far, howl);
    expect(far.cursor).toBe(0); // out of range → no reroll

    const foe = ctx(ship('e', { x: 60, y: 0, angle: 0 }), enemy, ['blank', 'hit']);
    hook(foe, howl);
    expect(foe.cursor).toBe(0); // enemy ship → no reroll
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
