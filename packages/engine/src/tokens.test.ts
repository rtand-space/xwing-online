import { describe, expect, it } from 'vitest';
import {
  applyEvent,
  computePending,
  createGame,
  dispatch,
  reduce,
  resolveAttack,
  tieln,
  xwing,
} from './index';
import type { GameConfig, GameState, Ship, Token, TokenKind } from './index';

const ship = (id: string, owner: string, x: number, y: number, angle: number, tokens: Token[]): Ship => ({
  ...xwing(id, owner, 1, { x, y, angle }),
  maxHull: 4,
  maxShields: 0,
  shields: 0,
  agility: 3,
  charges: 0,
  maxCharges: 0,
  recurring: 0,
  tokens,
  dialRevealed: false,
  hasMoved: false,
  hasActed: false,
  hasEngaged: false,
});

const stateWith = (ships: Ship[]): GameState => ({
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
});

const tok = (kind: TokenKind, n = 1): Token[] => Array.from({ length: n }, () => ({ kind }));

const defenceDice = (events: ReturnType<typeof resolveAttack>): number => {
  const e = events.find((ev) => ev.type === 'DiceRolled' && ev.kind === 'defence');
  return e && e.type === 'DiceRolled' ? e.faces.length : -1;
};

const attack = (def: Ship): ReturnType<typeof resolveAttack> =>
  resolveAttack(stateWith([ship('a', 'p', 0, 0, 0, []), def]), 'a', 'd');

describe('tractor (threshold by base size)', () => {
  it('a tractored small ship rolls one fewer defence die', () => {
    expect(defenceDice(attack(ship('d', 'q', 0, 180, 180, tok('tractor'))))).toBe(2); // 3 - 1
  });

  it('a large ship needs three tractor tokens to be tractored', () => {
    const large = (n: number): Ship => ({
      ...ship('d', 'q', 0, 180, 180, tok('tractor', n)),
      base: 'large',
    });
    expect(defenceDice(attack(large(2)))).toBe(3); // below threshold: no reduction
    expect(defenceDice(attack(large(3)))).toBe(2); // tractored
  });

  it('is cleared in the End Phase', () => {
    let s = stateWith([ship('a', 'p', 0, 0, 0, tok('tractor', 2))]);
    s = applyEvent(s, { type: 'RoundEnded' });
    expect(s.ships[0]!.tokens).toEqual([]);
  });
});

describe('strain', () => {
  it('removes one defence die and is spent by defending', () => {
    const events = attack(ship('d', 'q', 0, 180, 180, tok('strain')));
    expect(defenceDice(events)).toBe(2);
    expect(events.some((e) => e.type === 'TokenSpent' && e.kind === 'strain')).toBe(true);
  });

  it('sheds one token after a blue maneuver', () => {
    const config: GameConfig = {
      id: 'c',
      seed: 's',
      players: [
        { id: 'p', name: 'P' },
        { id: 'q', name: 'Q' },
      ],
      ships: [
        xwing('x', 'p', 1, { x: -300, y: 0, angle: 0 }),
        xwing('y', 'q', 2, { x: 300, y: 0, angle: 180 }),
      ],
    };
    let g = createGame(config);
    g = { ...g, state: applyEvent(g.state, { type: 'TokenGained', shipId: 'x', kind: 'strain' }) };
    const blue = { speed: 1 as const, bearing: 'straight' as const, difficulty: 'blue' as const };
    g = dispatch(g, { type: 'SetDial', playerId: 'p', shipId: 'x', maneuver: blue }).game;
    g = dispatch(g, { type: 'SetDial', playerId: 'q', shipId: 'y', maneuver: blue }).game;
    g = dispatch(g, { type: 'ExecuteManeuver', playerId: 'p', shipId: 'x' }).game;
    expect(g.state.ships.find((s) => s.id === 'x')!.tokens.some((t) => t.kind === 'strain')).toBe(
      false,
    );
  });

  it('is not removed by the End Phase (red token)', () => {
    let s = stateWith([ship('a', 'p', 0, 0, 0, tok('strain'))]);
    s = applyEvent(s, { type: 'RoundEnded' });
    expect(s.ships[0]!.tokens.filter((t) => t.kind === 'strain')).toHaveLength(1);
  });
});

describe('deplete', () => {
  it('removes one attack die and is spent by attacking', () => {
    const atk = ship('a', 'p', 0, 0, 0, tok('deplete'));
    const def = ship('d', 'q', 0, 180, 180, []);
    const events = resolveAttack(stateWith([atk, def]), 'a', 'd');
    const rolled = events.find((e) => e.type === 'DiceRolled' && e.kind === 'attack');
    expect(rolled && rolled.type === 'DiceRolled' && rolled.faces.length).toBe(2); // 3 attack - 1
    expect(events.some((e) => e.type === 'TokenSpent' && e.kind === 'deplete')).toBe(true);
  });

  it('is not removed by the End Phase (red token)', () => {
    let s = stateWith([ship('a', 'p', 0, 0, 0, tok('deplete'))]);
    s = applyEvent(s, { type: 'RoundEnded' });
    expect(s.ships[0]!.tokens.filter((t) => t.kind === 'deplete')).toHaveLength(1);
  });
});

describe('disarm', () => {
  it('cannot declare an attack', () => {
    const s = stateWith([ship('a', 'p', 0, 0, 0, tok('disarm')), ship('d', 'q', 0, 180, 180, [])]);
    const decl = computePending(s).find((p) => p.type === 'declare-attack' && p.shipId === 'a');
    expect(decl && decl.type === 'declare-attack' && decl.options.targets).toEqual([]);
  });

  it('is cleared in the End Phase', () => {
    let s = stateWith([ship('a', 'p', 0, 0, 0, tok('disarm', 2))]);
    s = applyEvent(s, { type: 'RoundEnded' });
    expect(s.ships[0]!.tokens.filter((t) => t.kind === 'disarm')).toHaveLength(0);
  });
});

describe('jam', () => {
  it('strips one green token when the ship has one', () => {
    let s = stateWith([ship('a', 'p', 0, 0, 0, [...tok('focus'), ...tok('evade')])]);
    s = applyEvent(s, { type: 'TokenGained', shipId: 'a', kind: 'jam' });
    const kinds = s.ships[0]!.tokens.map((x) => x.kind);
    expect(kinds).not.toContain('jam');
    expect(kinds.filter((k) => k === 'focus' || k === 'evade')).toHaveLength(1);
  });

  it('lingers when there is nothing to strip, then eats the next green token', () => {
    let s = stateWith([ship('a', 'p', 0, 0, 0, [])]);
    s = applyEvent(s, { type: 'TokenGained', shipId: 'a', kind: 'jam' });
    expect(s.ships[0]!.tokens.map((t) => t.kind)).toEqual(['jam']);
    s = applyEvent(s, { type: 'TokenGained', shipId: 'a', kind: 'focus' });
    expect(s.ships[0]!.tokens).toEqual([]); // focus consumed, jam cleared
  });
});

describe('ion', () => {
  const cfg = (): GameConfig => ({
    id: 'c',
    seed: 's',
    players: [
      { id: 'p', name: 'P' },
      { id: 'q', name: 'Q' },
    ],
    ships: [
      tieln('i', 'p', 1, { x: 0, y: 0, angle: 0 }),
      tieln('j', 'q', 2, { x: 0, y: 600, angle: 180 }),
    ],
  });

  const turnRight = { speed: 2 as const, bearing: 'turn-right' as const, difficulty: 'white' as const };

  it('plans normally but executes a blue 1-bank in the dial direction', () => {
    let g = createGame(cfg());
    g = { ...g, state: applyEvent(g.state, { type: 'TokenGained', shipId: 'i', kind: 'ion' }) };
    expect(g.state.pending.some((p) => p.shipId === 'i' && p.type === 'set-dial')).toBe(true);
    g = dispatch(g, { type: 'SetDial', playerId: 'p', shipId: 'i', maneuver: turnRight }).game;
    g = dispatch(g, { type: 'SetDial', playerId: 'q', shipId: 'j', maneuver: turnRight }).game;
    g = dispatch(g, { type: 'ExecuteManeuver', playerId: 'p', shipId: 'i' }).game;
    const moved = g.log.find((e) => e.type === 'ShipMoved' && e.shipId === 'i');
    expect(moved && moved.type === 'ShipMoved' && moved.maneuver).toEqual({
      speed: 1,
      bearing: 'bank-right',
      difficulty: 'blue',
    });
  });

  it('may perform only the calculate action, then sheds its ion tokens', () => {
    let g = createGame(cfg());
    g = { ...g, state: applyEvent(g.state, { type: 'TokenGained', shipId: 'i', kind: 'ion' }) };
    g = dispatch(g, { type: 'SetDial', playerId: 'p', shipId: 'i', maneuver: turnRight }).game;
    g = dispatch(g, { type: 'SetDial', playerId: 'q', shipId: 'j', maneuver: turnRight }).game;
    g = dispatch(g, { type: 'ExecuteManeuver', playerId: 'p', shipId: 'i' }).game;
    const act = g.state.pending.find((p) => p.shipId === 'i' && p.type === 'perform-action');
    expect(act && act.type === 'perform-action' && act.options.actions).toEqual(['calculate']);
    expect(g.state.ships.find((s) => s.id === 'i')!.tokens.some((t) => t.kind === 'ion')).toBe(true);
    g = dispatch(g, { type: 'PerformAction', playerId: 'p', shipId: 'i', action: 'calculate' }).game;
    expect(g.state.ships.find((s) => s.id === 'i')!.tokens.some((t) => t.kind === 'ion')).toBe(false);
  });

  it('needs two ion tokens to ionise a medium base', () => {
    const med: Ship = { ...ship('m', 'p', 0, 0, 0, tok('ion')), base: 'medium' };
    let s = stateWith([med]);
    // 1 ion on a medium base: not ionised, full action bar offered at activation
    s = { ...s, phase: 'activation', ships: [{ ...med, hasMoved: true }] };
    let act = computePending(s).find((p) => p.type === 'perform-action');
    expect(act && act.type === 'perform-action' && act.options.actions).not.toEqual(['calculate']);
    // 2 ion: ionised, calculate only
    s = { ...s, ships: [{ ...med, tokens: tok('ion', 2), hasMoved: true }] };
    act = computePending(s).find((p) => p.type === 'perform-action');
    expect(act && act.type === 'perform-action' && act.options.actions).toEqual(['calculate']);
  });

  it('breaks the locks it maintains when it becomes ionised', () => {
    let s = stateWith([ship('a', 'p', 0, 0, 0, [{ kind: 'lock', targetId: 'd' }])]);
    s = applyEvent(s, { type: 'TokenGained', shipId: 'a', kind: 'ion' });
    expect(s.ships[0]!.tokens.some((t) => t.kind === 'lock')).toBe(false);
    expect(s.ships[0]!.tokens.some((t) => t.kind === 'ion')).toBe(true);
  });
});

describe('cloak', () => {
  it('a cloaked ship rolls +2 agility on defence', () => {
    const plain = defenceDice(attack(ship('d', 'q', 0, 180, 180, [])));
    const cloaked = defenceDice(attack(ship('d', 'q', 0, 180, 180, tok('cloak'))));
    expect(cloaked).toBe(plain + 2);
  });

  it('a cloaked ship is disarmed and cannot attack', () => {
    const s = stateWith([ship('a', 'p', 0, 0, 0, tok('cloak')), ship('d', 'q', 0, 180, 180, [])]);
    const decl = computePending(s).find((p) => p.type === 'declare-attack' && p.shipId === 'a');
    expect(decl && decl.type === 'declare-attack' && decl.options.targets).toEqual([]);
  });

  it('survives the End Phase (blue token)', () => {
    let s = stateWith([ship('a', 'p', 0, 0, 0, tok('cloak'))]);
    s = applyEvent(s, { type: 'RoundEnded' });
    expect(s.ships[0]!.tokens.some((t) => t.kind === 'cloak')).toBe(true);
  });

  it('is offered a decloak in the System Phase and spends the token to move', () => {
    let s = stateWith([
      { ...ship('a', 'p', 0, 0, 0, tok('cloak')), initiative: 2 },
      ship('d', 'q', 0, 800, 180, []),
    ]);
    s = { ...s, phase: 'system' };
    s = { ...s, pending: computePending(s) };
    expect(s.pending.find((p) => p.type === 'decloak')?.shipId).toBe('a');
    const r = reduce(s, { type: 'Decloak', playerId: 'p', shipId: 'a' });
    const moved = r.events.find((e) => e.type === 'Decloaked');
    expect(moved && moved.type === 'Decloaked' && moved.to.y).toBeCloseTo(120); // 80 boost + 40 base
    expect(r.events.some((e) => e.type === 'TokenSpent' && e.kind === 'cloak')).toBe(true);
  });
});
