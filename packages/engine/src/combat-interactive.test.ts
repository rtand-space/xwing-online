import { describe, expect, it } from 'vitest';
import { applyEvent, clearAbilities, computePending, reduce, registerAbility } from './index';
import { applySpend, combatAbilities, combatSpends } from './combat';
import type { CombatState, GameState, Ship } from './index';
import { xwing } from './index';

const ship = (id: string, owner: string, x: number, y: number, over: Partial<Ship> = {}): Ship => ({
  ...xwing(id, owner, 1, { x, y, angle: 0 }),
  maxHull: 6,
  maxShields: 0,
  shields: 0,
  agility: 2,
  charges: 0,
  maxCharges: 0,
  recurring: 0,
  tokens: [],
  dialRevealed: false,
  hasMoved: true,
  hasActed: true,
  hasEngaged: false,
  ...over,
});

const stateWith = (ships: Ship[]): GameState => {
  const s: GameState = {
    id: 'g',
    rng: { seed: 's', cursor: 0 },
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
  };
  return { ...s, pending: computePending(s) };
};

const drive = (s: GameState, cmd: Parameters<typeof reduce>[1]): GameState => {
  const r = reduce(s, cmd);
  if (r.rejection) throw new Error(r.rejection);
  return r.events.reduce(applyEvent, s);
};

describe('combatSpends / applySpend (pure)', () => {
  const base = (over: Partial<CombatState>): CombatState => ({
    attackerId: 'a',
    targetId: 'd',
    range: 2,
    obstructed: false,
    attack: [],
    defence: [],
    step: 'attack',
    ...over,
  });

  it('offers focus only when the attacker has a focus token and a focus result', () => {
    const s = stateWith([
      ship('a', 'p', 0, 0, { tokens: [{ kind: 'focus' }] }),
      ship('d', 'q', 0, 200, {}),
    ]);
    expect(combatSpends(s, base({ attack: ['focus', 'blank'] }))).toContain('focus');
    expect(combatSpends(s, base({ attack: ['hit', 'blank'] }))).not.toContain('focus');
  });

  it('spending focus turns every focus result into a hit and spends the token', () => {
    const s = stateWith([
      ship('a', 'p', 0, 0, { tokens: [{ kind: 'focus' }] }),
      ship('d', 'q', 0, 200, {}),
    ]);
    const r = applySpend(s, base({ attack: ['focus', 'focus', 'blank'] }), 'focus');
    expect(r.attack).toEqual(['hit', 'hit', 'blank']);
    expect(r.events).toEqual([{ type: 'TokenSpent', shipId: 'a', kind: 'focus' }]);
  });

  it('the defender spends focus for evades', () => {
    const s = stateWith([ship('a', 'p', 0, 0, {}), ship('d', 'q', 0, 200, { tokens: [{ kind: 'focus' }] })]);
    const r = applySpend(s, base({ step: 'defence', defence: ['focus', 'blank'] }), 'focus');
    expect(r.defence).toEqual(['evade', 'blank']);
    expect(r.events).toEqual([{ type: 'TokenSpent', shipId: 'd', kind: 'focus' }]);
  });
});

describe('optional abilities + reroll ordering', () => {
  const cs = (over: Partial<CombatState> = {}): CombatState => ({
    attackerId: 'a',
    targetId: 'd',
    range: 2,
    obstructed: false,
    attack: ['hit', 'blank'],
    defence: [],
    step: 'attack',
    ...over,
  });

  it('offers an optional attack ability only while available, once per attack', () => {
    clearAbilities();
    registerAbility('mark', {
      optionalAttack: {
        onModifyAttack: {
          label: 'hit → crit',
          available: (ctx) => ctx.attack.includes('hit'),
          apply: (ctx) => {
            ctx.attack = ctx.attack.map((f) => (f === 'hit' ? 'crit' : f));
          },
        },
      },
    });
    const s = stateWith([
      ship('a', 'p', 0, 0, { pilotXws: 'mark' }),
      ship('d', 'q', 0, 200, {}),
    ]);
    expect(combatAbilities(s, cs()).map((x) => x.xws)).toEqual(['mark']);
    expect(combatAbilities(s, cs({ usedAbilities: ['mark'] }))).toEqual([]); // used up
    expect(combatAbilities(s, cs({ attack: ['blank'] }))).toEqual([]); // not available
    clearAbilities();
  });

  it('stops offering a lock reroll once a result has been changed', () => {
    const s = stateWith([
      ship('a', 'p', 0, 0, { tokens: [{ kind: 'lock', targetId: 'd' }] }),
      ship('d', 'q', 0, 200, {}),
    ]);
    expect(combatSpends(s, cs({ attack: ['blank'] }))).toContain('lock');
    expect(combatSpends(s, cs({ attack: ['blank'], changed: true }))).not.toContain('lock');
  });
});

describe('after-defence attacker step (cost ability on defender dice)', () => {
  it('gives the attacker a step when a cost ability can modify the defender dice', () => {
    clearAbilities();
    registerAbility('snipe', {
      optionalAttack: {
        onModifyDefence: {
          label: 'cancel evade (charge)',
          available: (ctx, self) => self.charges > 0 && ctx.defence.includes('evade'),
          apply: (ctx, self) => {
            ctx.defence = changeOneFace(ctx.defence, 'evade', 'blank');
            ctx.events.push({ type: 'ChargeChanged', shipId: self.id, delta: -1 });
          },
        },
      },
    });
    const s = stateWith([
      ship('a', 'p', 0, 0, { pilotXws: 'snipe', charges: 1, maxCharges: 1 }),
      ship('d', 'q', 0, 200, {}),
    ]);
    const c: CombatState = {
      attackerId: 'a',
      targetId: 'd',
      range: 2,
      obstructed: false,
      attack: ['hit'],
      defence: ['evade'],
      step: 'after-defence',
    };
    expect(combatAbilities(s, c).map((x) => x.xws)).toEqual(['snipe']);
    clearAbilities();
  });
});

const changeOneFace = <T,>(arr: T[], from: T, to: T): T[] => {
  let done = false;
  return arr.map((f) => (!done && f === from ? ((done = true), to) : f));
};

describe('reactive windows after combat', () => {
  it('fires onDestroyed for a living friendly of a destroyed ship', () => {
    clearAbilities();
    registerAbility('forcehit', {
      attack: {
        onModifyAttack: (ctx, self) => {
          if (ctx.attacker.id === self.id) ctx.attack = ['hit', 'hit'];
        },
      },
    });
    registerAbility('mourner', {
      game: { onDestroyed: ({ self }) => [{ type: 'TokenGained', shipId: self.id, kind: 'focus' }] },
    });
    let s = stateWith([
      ship('a', 'p', 0, 0, { primaryAttack: 2, pilotXws: 'forcehit' }),
      ship('d', 'q', 0, 200, { agility: 0, maxHull: 1, hull: 1 }),
      ship('f', 'q', 300, 300, { pilotXws: 'mourner' }),
    ]);
    s = drive(s, { type: 'DeclareAttack', playerId: 'p', shipId: 'a', targetId: 'd' });
    s = drive(s, { type: 'ModifyDone', playerId: 'p', shipId: 'a' });
    s = drive(s, { type: 'ModifyDone', playerId: 'q', shipId: 'd' });
    expect(s.ships.find((x) => x.id === 'd')!.hull).toBe(0); // destroyed
    expect(s.ships.find((x) => x.id === 'f')!.tokens.some((t) => t.kind === 'focus')).toBe(true);
    clearAbilities();
  });

  it('fires onDamaged for a defender that took damage', () => {
    clearAbilities();
    registerAbility('forcehit', {
      attack: {
        onModifyAttack: (ctx, self) => {
          if (ctx.attacker.id === self.id) ctx.attack = ['hit', 'hit'];
        },
      },
    });
    registerAbility('reactor', {
      game: { onDamaged: ({ self }) => [{ type: 'TokenGained', shipId: self.id, kind: 'focus' }] },
    });
    let s = stateWith([
      ship('a', 'p', 0, 0, { primaryAttack: 2, pilotXws: 'forcehit' }),
      ship('d', 'q', 0, 200, { agility: 0, pilotXws: 'reactor' }),
    ]);
    s = drive(s, { type: 'DeclareAttack', playerId: 'p', shipId: 'a', targetId: 'd' });
    s = drive(s, { type: 'ModifyDone', playerId: 'p', shipId: 'a' }); // attack step
    s = drive(s, { type: 'ModifyDone', playerId: 'q', shipId: 'd' }); // defence step → resolve
    const d = s.ships.find((x) => x.id === 'd')!;
    expect(d.hull).toBeLessThan(d.maxHull); // took damage
    expect(d.tokens.some((t) => t.kind === 'focus')).toBe(true); // onDamaged fired
    clearAbilities();
  });
});

describe('dice lockdown (Midnight)', () => {
  it('suppresses the enemy modify step when locked', () => {
    clearAbilities();
    registerAbility('lockjam', {
      lockdown: (ctx, self) => {
        const enemyId = self.id === ctx.attacker.id ? ctx.target.id : ctx.attacker.id;
        return self.tokens.some((t) => t.kind === 'lock' && t.targetId === enemyId);
      },
    });
    const c: CombatState = {
      attackerId: 'a',
      targetId: 'd',
      range: 2,
      obstructed: false,
      attack: ['focus', 'blank'],
      defence: [],
      step: 'attack',
    };
    const atk = ship('a', 'p', 0, 0, { tokens: [{ kind: 'focus' }] });
    const jammer = ship('d', 'q', 0, 200, {
      pilotXws: 'lockjam',
      tokens: [{ kind: 'lock', targetId: 'a' }],
    });
    expect(combatSpends(stateWith([atk, jammer]), c)).toEqual([]); // attacker can't spend focus
    expect(combatSpends(stateWith([atk, ship('d', 'q', 0, 200, {})]), c)).toContain('focus');
    clearAbilities();
  });
});

describe('target-select effects', () => {
  it('applies a transfer-token effect to the chosen ship', () => {
    let s = stateWith([
      ship('a', 'p', 0, 0, { tokens: [{ kind: 'focus' }] }),
      ship('b', 'p', 0, 100, {}),
      ship('e', 'q', 0, 600, {}),
    ]);
    s = applyEvent(s, {
      type: 'TargetOffered',
      byShip: 'a',
      candidates: ['b'],
      effect: { kind: 'transfer-token', fromId: 'a', token: 'focus' },
      canSkip: true,
    });
    expect(s.pending.find((p) => p.type === 'select-target')?.shipId).toBe('a');
    s = drive(s, { type: 'SelectTarget', playerId: 'p', shipId: 'a', targetId: 'b' });
    expect(s.ships.find((x) => x.id === 'a')!.tokens.some((t) => t.kind === 'focus')).toBe(false);
    expect(s.ships.find((x) => x.id === 'b')!.tokens.some((t) => t.kind === 'focus')).toBe(true);
    expect(s.targetSelect).toBeUndefined();
  });
});

describe('bonus attacks', () => {
  it('a granted bonus attack reuses combat and does not spend engagement', () => {
    let s = stateWith([ship('a', 'p', 0, 0, {}), ship('d', 'q', 0, 200, { agility: 0 })]);
    s = applyEvent(s, { type: 'BonusAttackOffered', shipId: 'a' });
    const dec = s.pending.find((p) => p.type === 'declare-attack' && p.shipId === 'a');
    expect(dec?.type === 'declare-attack' && dec.options.targets).toEqual(['d']);

    s = drive(s, { type: 'DeclareAttack', playerId: 'p', shipId: 'a', targetId: 'd' });
    expect(s.combat?.attackerId).toBe('a'); // a real attack is now in progress
    expect(s.bonusAttack).toBeUndefined();
    expect(s.ships.find((x) => x.id === 'a')!.hasEngaged).toBe(false); // not its engagement
  });

  it('declining a bonus attack just clears it', () => {
    let s = stateWith([ship('a', 'p', 0, 0, {}), ship('d', 'q', 0, 200, {})]);
    s = applyEvent(s, { type: 'BonusAttackOffered', shipId: 'a' });
    s = drive(s, { type: 'PassAttack', playerId: 'p', shipId: 'a' });
    expect(s.bonusAttack).toBeUndefined();
    expect(s.ships.find((x) => x.id === 'a')!.hasEngaged).toBe(false);
  });
});

describe('interactive attack FSM', () => {
  it('pauses for the attacker, then the defender, then resolves', () => {
    let s = stateWith([
      ship('a', 'p', 0, 0, { primaryAttack: 3, tokens: [{ kind: 'focus' }] }),
      ship('d', 'q', 0, 200, { agility: 2 }),
    ]);
    // a is higher in the engagement order (both init 1, id 'a' < 'd')
    expect(s.pending[0]!.type).toBe('declare-attack');
    s = drive(s, { type: 'DeclareAttack', playerId: 'p', shipId: 'a', targetId: 'd' });
    expect(s.combat?.step).toBe('attack');
    const atkStep = s.pending.find((x) => x.type === 'modify');
    expect(atkStep?.type === 'modify' && atkStep.shipId).toBe('a');

    s = drive(s, { type: 'ModifyDone', playerId: 'p', shipId: 'a' });
    expect(s.combat?.step).toBe('defence');
    expect(s.combat?.defence.length).toBe(2); // 2 agility dice rolled
    const defStep = s.pending.find((x) => x.type === 'modify');
    expect(defStep?.type === 'modify' && defStep.shipId).toBe('d');

    s = drive(s, { type: 'ModifyDone', playerId: 'q', shipId: 'd' });
    expect(s.combat).toBeUndefined(); // combat resolved
    expect(s.ships.find((x) => x.id === 'a')!.hasEngaged).toBe(true);
  });
});
