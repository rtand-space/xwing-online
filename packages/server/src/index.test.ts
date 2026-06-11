import { demoConfig } from '@xwing/engine';
import { describe, expect, it } from 'vitest';
import { applyCommand, createLog, viewFromLog } from './game-store';

const blue = { speed: 1, bearing: 'straight', difficulty: 'blue' } as const;

describe('game-store (Durable Object core)', () => {
  it('creates a log starting with GameCreated', () => {
    const log = createLog(demoConfig('s'));
    expect(log[0]!.type).toBe('GameCreated');
  });

  it('appends events for a valid command and rejects unauthorized ones', () => {
    const log = createLog(demoConfig('s'));

    const ok = applyCommand(log, {
      type: 'SetDial',
      playerId: 'rebel',
      shipId: 'x1',
      maneuver: blue,
    });
    expect(ok.rejection).toBeUndefined();
    expect(ok.log.length).toBeGreaterThan(log.length);

    const bad = applyCommand(log, {
      type: 'SetDial',
      playerId: 'imperial',
      shipId: 'x1',
      maneuver: blue,
    });
    expect(bad.rejection).toBeTruthy();
    expect(bad.log).toBe(log); // unchanged on rejection
  });

  it('redacts an opponent unrevealed dial in the projected view', () => {
    const created = createLog(demoConfig('s'));
    const { log } = applyCommand(created, {
      type: 'SetDial',
      playerId: 'rebel',
      shipId: 'x1',
      maneuver: blue,
    });
    expect(viewFromLog(log, 'imperial').ships.find((s) => s.id === 'x1')!.dial).toBeUndefined();
    expect(viewFromLog(log, 'rebel').ships.find((s) => s.id === 'x1')!.dial).toBeDefined();
  });
});
