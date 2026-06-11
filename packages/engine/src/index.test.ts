import { describe, expect, it } from 'vitest';
import { createGame, demoConfig, ENGINE_VERSION } from './index';

describe('@xwing/engine', () => {
  it('exposes a version', () => {
    expect(ENGINE_VERSION).toBe('0.0.0');
  });

  it('starts a demo game in planning owing a dial from every ship', () => {
    const g = createGame(demoConfig());
    expect(g.state.phase).toBe('planning');
    expect(g.state.round).toBe(1);
    expect(g.state.pending).toHaveLength(4);
    expect(g.state.pending.every((p) => p.type === 'set-dial')).toBe(true);
  });
});
