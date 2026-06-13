import { describe, expect, it } from 'vitest';
import { applyEvent, computePending, reduce, trivialCommand } from './index';
import type { GameState, Ship, ShipWeapon, Token } from './types';

const torpedo: ShipWeapon = {
  xws: 'protontorpedoes',
  name: 'Proton Torpedoes',
  value: 4,
  arc: 'front',
  minRange: 2,
  maxRange: 3,
  ordnance: true,
};
const cannon: ShipWeapon = {
  xws: 'ioncannon',
  name: 'Ion Cannon',
  value: 3,
  arc: 'front',
  minRange: 1,
  maxRange: 3,
  ordnance: false,
};

const mk = (id: string, ownerId: string, x: number, y: number, extra: Partial<Ship> = {}): Ship => ({
  id,
  ownerId,
  shipType: 't',
  pilot: id,
  initiative: 1,
  base: 'small',
  primaryAttack: 2,
  agility: 1,
  hull: 5,
  shields: 0,
  maxHull: 5,
  maxShields: 0,
  charges: 0,
  maxCharges: 0,
  recurring: 0,
  pos: { x, y, angle: 0 },
  actionBar: [],
  dialOptions: [],
  tokens: [],
  dialRevealed: false,
  hasMoved: true,
  hasActed: true,
  hasEngaged: false,
  ...extra,
});

/** attacker `a` (init 5) faces +y; target `b` sits in its front arc at range 2. */
function setup(aExtra: Partial<Ship>, bExtra: Partial<Ship> = {}): GameState {
  const a = mk('a', 'p', 0, 0, { initiative: 5, ...aExtra });
  const b = mk('b', 'q', 0, 200, bExtra);
  const s: GameState = {
    id: 'g',
    rng: { seed: 's', cursor: 0 },
    round: 1,
    phase: 'engagement',
    players: [
      { id: 'p', name: 'P' },
      { id: 'q', name: 'Q' },
    ],
    ships: [a, b],
    obstacles: [],
    pending: [],
    gameOver: false,
  };
  return { ...s, pending: computePending(s) };
}

const lock = (targetId: string): Token => ({ kind: 'lock', targetId });
const declarePending = (s: GameState) => s.pending[0] as Extract<
  GameState['pending'][number],
  { type: 'declare-attack' }
>;

describe('secondary weapons', () => {
  it('offers a non-ordnance weapon without a lock, but not ordnance', () => {
    const s = setup({ weapons: [torpedo, cannon], upgradeCharges: { protontorpedoes: { charges: 1, max: 2, recovers: 0 } } });
    const p = declarePending(s);
    const names = (p.options.weapons ?? []).map((w) => w.xws);
    expect(names).toContain('ioncannon');
    expect(names).not.toContain('protontorpedoes'); // ordnance needs a lock
  });

  it('offers ordnance once the target is locked', () => {
    const s = setup({
      weapons: [torpedo],
      tokens: [lock('b')],
      upgradeCharges: { protontorpedoes: { charges: 1, max: 2, recovers: 0 } },
    });
    const torp = declarePending(s).options.weapons?.find((w) => w.xws === 'protontorpedoes');
    expect(torp?.targets).toEqual(['b']);
  });

  it('declaring an ordnance attack spends its charge and rolls the weapon value', () => {
    let s = setup({
      weapons: [torpedo],
      tokens: [lock('b')],
      primaryAttack: 2,
      upgradeCharges: { protontorpedoes: { charges: 1, max: 2, recovers: 0 } },
    });
    const r = reduce(s, {
      type: 'DeclareAttack',
      playerId: 'p',
      shipId: 'a',
      targetId: 'b',
      weapon: 'protontorpedoes',
    });
    expect(r.events.some((e) => e.type === 'ChargeChanged' && e.source === 'protontorpedoes' && e.delta === -1)).toBe(true);
    const rolled = r.events.find((e) => e.type === 'DiceRolled' && e.kind === 'attack');
    expect(rolled && 'faces' in rolled && rolled.faces.length).toBe(4); // weapon value 4, not primary 2
    for (const e of r.events) s = applyEvent(s, e);
    expect(s.ships.find((x) => x.id === 'a')!.upgradeCharges!.protontorpedoes!.charges).toBe(0);
    expect(s.combat?.weaponXws).toBe('protontorpedoes');
  });

  it('excludes weapons whose target is out of range', () => {
    // target moved to range 1 (centres 110mm apart): the torpedo (range 2-3) can't reach
    const s = setup({ weapons: [torpedo], tokens: [lock('b')] }, { pos: { x: 0, y: 110, angle: 0 } });
    expect(declarePending(s).options.weapons ?? []).toEqual([]);
  });

  it('excludes weapons with no charge left', () => {
    const s = setup({
      weapons: [torpedo],
      tokens: [lock('b')],
      upgradeCharges: { protontorpedoes: { charges: 0, max: 2, recovers: 0 } },
    });
    expect(declarePending(s).options.weapons ?? []).toEqual([]);
  });

  it('auto-passes when neither the primary nor a weapon can fire', () => {
    // target directly behind the attacker: out of every front arc
    const s = setup({ weapons: [torpedo], tokens: [lock('b')] }, { pos: { x: 0, y: -200, angle: 0 } });
    const p = declarePending(s);
    expect(p.options.targets).toEqual([]);
    expect(trivialCommand(p)).toEqual({ type: 'PassAttack', playerId: 'p', shipId: 'a' });
  });
});
