import { beforeEach, describe, expect, it } from 'vitest';
import { clearAbilities, fireWindow, registerAbility, shipAbilitySources } from './abilities';
import { resolveAttack } from './combat';
import type { Command } from './commands';
import type { GameConfig, GameEvent, ShipInit } from './events';
import { createGame, dispatch } from './game';
import type { GameState, Maneuver, Position, Ship } from './types';

const ship = (id: string, shipType: string, over: Partial<Ship> = {}): Ship => ({
  id,
  ownerId: id,
  shipType,
  pilot: id,
  initiative: 2,
  base: 'small',
  primaryAttack: 2,
  agility: 0,
  hull: 5,
  shields: 0,
  maxHull: 5,
  maxShields: 0,
  charges: 0,
  maxCharges: 0,
  recurring: 0,
  pos: { x: 0, y: 0, angle: 0 } as Position,
  actionBar: [],
  dialOptions: [],
  tokens: [],
  dialRevealed: false,
  hasMoved: false,
  hasActed: false,
  hasEngaged: false,
  ...over,
});

const stateWith = (ships: Ship[]): GameState => ({
  id: 'g',
  rng: { seed: 'abil', cursor: 0 },
  round: 1,
  phase: 'engagement',
  players: [
    { id: 'a', name: 'A' },
    { id: 't', name: 'T' },
  ],
  ships,
  obstacles: [],
  pending: [],
  gameOver: false,
});

describe('ability framework', () => {
  beforeEach(clearAbilities);

  it('lists a ship’s ability sources (ship, pilot, upgrades)', () => {
    const s = ship('a', 't65xwing', {
      pilotXws: 'lukeskywalker',
      upgrades: ['r2d2', 'protontorpedoes'],
    });
    expect(shipAbilitySources(s)).toEqual(['t65xwing', 'lukeskywalker', 'r2d2', 'protontorpedoes']);
  });

  it('runs a registered attacker ability inside the attack pipeline', () => {
    registerAbility('aceship', {
      attack: {
        onModifyAttack: (ctx, self) => {
          if (ctx.attacker.id === self.id) ctx.attack = ['hit', 'hit', 'hit'];
        },
      },
    });
    const a = ship('a', 'aceship');
    const t = ship('t', 'dummy', { pos: { x: 0, y: 60, angle: 0 }, hull: 5, agility: 0 });
    const events = resolveAttack(stateWith([a, t]), 'a', 't');
    const dmg = events.find(
      (e): e is Extract<GameEvent, { type: 'DamageDealt' }> => e.type === 'DamageDealt',
    );
    expect(dmg?.amount).toBe(3);
    expect(dmg?.hullAfter).toBe(2);
  });

  it('does not run an ability for a ship that lacks it', () => {
    registerAbility('aceship', {
      attack: { onModifyAttack: (ctx) => (ctx.attack = ['hit', 'hit', 'hit', 'hit', 'hit']) },
    });
    const a = ship('a', 'plain', { primaryAttack: 0 }); // no dice, no ability
    const t = ship('t', 'dummy', { pos: { x: 0, y: 260, angle: 0 }, agility: 0 }); // range 3, no bonus die
    const events = resolveAttack(stateWith([a, t]), 'a', 't');
    expect(events.some((e) => e.type === 'DamageDealt')).toBe(false);
  });

  it('fireWindow runs a non-combat window only for ships with the ability', () => {
    registerAbility('flyer', {
      game: { afterMove: ({ self }) => [{ type: 'TokenGained', shipId: self.id, kind: 'focus' }] },
    });
    const flyer = ship('a', 'flyer');
    expect(fireWindow(stateWith([flyer]), 'afterMove', flyer)).toEqual([
      { type: 'TokenGained', shipId: 'a', kind: 'focus' },
    ]);
    const plain = ship('b', 'plain');
    expect(fireWindow(stateWith([plain]), 'afterMove', plain)).toEqual([]);
  });

  it('afterMove fires when a ship executes its maneuver (FSM integration)', () => {
    registerAbility('flyer', {
      game: { afterMove: ({ self }) => [{ type: 'TokenGained', shipId: self.id, kind: 'focus' }] },
    });
    const mk = (id: string, ownerId: string, st: string, y: number): ShipInit => ({
      id,
      ownerId,
      shipType: st,
      pilot: id,
      initiative: ownerId === 'p' ? 1 : 2,
      base: 'small',
      primaryAttack: 2,
      agility: 2,
      hull: 3,
      shields: 0,
      pos: { x: 0, y, angle: 0 },
      actionBar: ['focus'],
      dialOptions: [{ speed: 1, bearing: 'straight', difficulty: 'white' }],
    });
    const config: GameConfig = {
      id: 'g',
      seed: 's',
      players: [
        { id: 'p', name: 'P' },
        { id: 'q', name: 'Q' },
      ],
      ships: [mk('a', 'p', 'flyer', -200), mk('b', 'q', 'plain', 200)],
    };
    const dial: Maneuver = { speed: 1, bearing: 'straight', difficulty: 'white' };
    let game = createGame(config);
    const send = (cmd: Command) => (game = dispatch(game, cmd).game);
    send({ type: 'SetDial', playerId: 'p', shipId: 'a', maneuver: dial });
    send({ type: 'SetDial', playerId: 'q', shipId: 'b', maneuver: dial });
    send({ type: 'ExecuteManeuver', playerId: 'p', shipId: 'a' });
    const a = game.state.ships.find((s) => s.id === 'a')!;
    expect(a.tokens.some((t) => t.kind === 'focus')).toBe(true);
  });
});
