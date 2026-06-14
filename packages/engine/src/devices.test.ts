import { describe, expect, it } from 'vitest';
import { applyEvent, computePending, reduce } from './index';
import { minesTouched, nextBombDetonation, placementPos } from './devices';
import type { Device, GameState, Maneuver, Ship, ShipDevice } from './types';

const proton: ShipDevice = { xws: 'protonbombs', name: 'Proton Bombs', kind: 'bomb' };

const mk = (id: string, ownerId: string, x: number, y: number, extra: Partial<Ship> = {}): Ship => ({
  id,
  ownerId,
  shipType: 't',
  pilot: id,
  initiative: 1,
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
  pos: { x, y, angle: 0 },
  actionBar: [],
  dialOptions: [],
  tokens: [],
  dialRevealed: false,
  hasMoved: true,
  hasActed: true,
  hasEngaged: true,
  ...extra,
});

function game(phase: GameState['phase'], ships: Ship[], devices: Device[] = []): GameState {
  const s: GameState = {
    id: 'g',
    rng: { seed: 's', cursor: 0 },
    round: 1,
    phase,
    players: [
      { id: 'p', name: 'P' },
      { id: 'q', name: 'Q' },
    ],
    ships,
    obstacles: [],
    devices,
    pending: [],
    gameOver: false,
  };
  return { ...s, pending: computePending(s) };
}

const apply = (s: GameState, events: { type: string }[]): GameState =>
  events.reduce((st, e) => applyEvent(st, e as never), s);

describe('devices', () => {
  it('offers a System-Phase drop, spends a charge, places on the rear template', () => {
    const a = mk('a', 'p', 0, 0, {
      devices: [proton],
      hasMoved: false,
      hasActed: false,
      hasEngaged: false,
      upgradeCharges: { protonbombs: { charges: 2, max: 2, recovers: 0 } },
    });
    const s = game('system', [a, mk('b', 'q', 0, 600)]);
    const p = s.pending[0];
    expect(p?.type).toBe('drop-device');

    const r = reduce(s, { type: 'DropDevice', playerId: 'p', shipId: 'a', xws: 'protonbombs', choice: 0 });
    expect(r.events.some((e) => e.type === 'ChargeChanged' && e.source === 'protonbombs')).toBe(true);
    const next = apply(s, r.events);
    expect(next.devices).toHaveLength(1);
    expect(next.devices![0]!.pos).toEqual(placementPos(a, 'drop')); // behind the ship
    expect(next.ships.find((x) => x.id === 'a')!.upgradeCharges!.protonbombs!.charges).toBe(1);
  });

  it('a bomb detonates against ships at range 0-1, not distant ones, then is removed', () => {
    const bomb: Device = { id: 'd1', ownerId: 'p', xws: 'protonbombs', name: 'Proton Bombs', kind: 'bomb', pos: { x: 0, y: 0, angle: 0 } };
    const near = mk('near', 'q', 0, 100);
    const far = mk('far', 'q', 0, 500);
    const s = game('activation', [near, far], [bomb]);
    const det = nextBombDetonation(s)!;
    expect(det.some((e) => e.type === 'DeviceDetonated')).toBe(true);
    const dmg = det.filter((e) => e.type === 'DamageDealt') as { shipId: string; crits: number }[];
    expect(dmg.map((d) => d.shipId)).toEqual(['near']);
    expect(dmg[0]!.crits).toBe(1); // proton bomb = 1 crit
    const after = apply(s, det);
    expect(after.devices).toHaveLength(0);
  });

  it('detonates every armed bomb at the end of the Activation Phase via the FSM', () => {
    const bomb: Device = { id: 'd1', ownerId: 'p', xws: 'protonbombs', name: 'Proton Bombs', kind: 'bomb', pos: { x: 0, y: 100, angle: 0 } };
    const actor = mk('a', 'p', -300, 0, { hasActed: false }); // still owes an action
    const victim = mk('b', 'q', 0, 100);
    const s = game('activation', [actor, victim], [bomb]);
    expect(s.pending[0]?.type).toBe('perform-action');
    const r = reduce(s, { type: 'SkipAction', playerId: 'p', shipId: 'a' });
    expect(r.events.some((e) => e.type === 'DeviceDetonated')).toBe(true);
    const after = apply(s, r.events);
    expect(after.devices ?? []).toHaveLength(0);
    expect(after.ships.find((x) => x.id === 'b')!.hull).toBe(4); // took 1
    expect(after.phase).not.toBe('activation'); // detonation ran, phase advanced
  });

  it('a mine detonates when a ship moves through it, and only then', () => {
    const net: Device = { id: 'm1', ownerId: 'q', xws: 'connernets', name: 'Conner Net', kind: 'mine', pos: { x: 0, y: 90, angle: 0 } };
    const mover = mk('a', 'p', 0, 0, {
      hasMoved: false,
      hasActed: false,
      hasEngaged: false,
      dial: { speed: 2, bearing: 'straight', difficulty: 'white' } as Maneuver,
      dialOptions: [{ speed: 2, bearing: 'straight', difficulty: 'white' } as Maneuver],
    });
    const s = game('activation', [mover], [net]);
    expect(minesTouched(s, mover, { x: 0, y: 200, angle: 0 }).map((m) => m.id)).toEqual(['m1']);
    const r = reduce(s, { type: 'ExecuteManeuver', playerId: 'p', shipId: 'a' });
    expect(r.events.some((e) => e.type === 'DeviceDetonated')).toBe(true);
    const after = apply(s, r.events);
    expect(after.devices ?? []).toHaveLength(0);
    const a2 = after.ships.find((x) => x.id === 'a')!;
    expect(a2.hull).toBe(4); // 1 damage
    expect(a2.tokens.filter((t) => t.kind === 'ion')).toHaveLength(3); // + 3 ion
  });

  it('does not offer a drop with no charge left', () => {
    const a = mk('a', 'p', 0, 0, {
      devices: [proton],
      hasMoved: false,
      hasActed: false,
      hasEngaged: false,
      upgradeCharges: { protonbombs: { charges: 0, max: 2, recovers: 0 } },
    });
    const s = game('system', [a]);
    expect(s.pending[0]?.type).not.toBe('drop-device');
  });

  it('places a launch on the front template', () => {
    const a = mk('a', 'p', 0, 0);
    expect(placementPos(a, 'launch').y).toBeGreaterThan(0); // ahead
    expect(placementPos(a, 'drop').y).toBeLessThan(0); // behind
  });
});
