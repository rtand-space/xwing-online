import { describe, expect, it } from 'vitest';
import { applyEvent, createGame } from './index';
import type { GameConfig, ShipInit } from './index';

const base = (id: string, ownerId: string, extra: Partial<ShipInit>): ShipInit => ({
  id,
  ownerId,
  shipType: 'x',
  pilot: id,
  initiative: 1,
  base: 'small',
  primaryAttack: 2,
  agility: 2,
  hull: 3,
  shields: 0,
  pos: { x: 0, y: ownerId === 'p' ? -100 : 100, angle: 0 },
  actionBar: [],
  dialOptions: [],
  ...extra,
});

const cfg: GameConfig = {
  id: 'c',
  seed: 's',
  players: [
    { id: 'p', name: 'P' },
    { id: 'q', name: 'Q' },
  ],
  ships: [base('a', 'p', { maxCharges: 2, recurring: 1 }), base('b', 'q', {})],
};

describe('charges', () => {
  it('start full, spend clamps at 0, round-end recovers recurring up to max', () => {
    let s = createGame(cfg).state;
    const a = () => s.ships.find((sh) => sh.id === 'a')!;
    expect(a().charges).toBe(2); // starts full
    s = applyEvent(s, { type: 'ChargeChanged', shipId: 'a', delta: -3 });
    expect(a().charges).toBe(0); // clamped at 0
    s = applyEvent(s, { type: 'RoundEnded' });
    expect(a().charges).toBe(1); // +recurring
    s = applyEvent(s, { type: 'ChargeChanged', shipId: 'a', delta: 5 });
    expect(a().charges).toBe(2); // clamped at max
  });
});
