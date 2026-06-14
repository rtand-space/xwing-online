import { describe, expect, it } from 'vitest';
import type { Command } from './commands';
import { createGame, demoConfig, dispatch, replay } from './index';
import { autoPlay, type Chooser, firstChoice } from './harness';
import { rngAt } from './rng';

function randomChoice(seedStr: string): Chooser {
  let n = 0;
  const pick = <T>(arr: T[]): T => arr[Math.floor(rngAt(seedStr, n++) * arr.length)]!;
  return (p): Command => {
    switch (p.type) {
      case 'set-dial':
        return {
          type: 'SetDial',
          playerId: p.playerId,
          shipId: p.shipId,
          maneuver: pick(p.options.maneuvers),
        };
      case 'execute-maneuver':
        return { type: 'ExecuteManeuver', playerId: p.playerId, shipId: p.shipId };
      case 'perform-action': {
        if (p.options.actions.length && pick([true, false])) {
          const action = pick(p.options.actions);
          if (action === 'lock') {
            return p.options.lockTargets.length
              ? {
                  type: 'PerformAction',
                  playerId: p.playerId,
                  shipId: p.shipId,
                  action,
                  targetId: pick(p.options.lockTargets),
                }
              : { type: 'SkipAction', playerId: p.playerId, shipId: p.shipId };
          }
          return { type: 'PerformAction', playerId: p.playerId, shipId: p.shipId, action };
        }
        return { type: 'SkipAction', playerId: p.playerId, shipId: p.shipId };
      }
      case 'declare-attack':
        return p.options.targets.length && pick([true, false])
          ? {
              type: 'DeclareAttack',
              playerId: p.playerId,
              shipId: p.shipId,
              targetId: pick(p.options.targets),
            }
          : { type: 'PassAttack', playerId: p.playerId, shipId: p.shipId };
      case 'trigger-ability':
        return pick([true, false])
          ? { type: 'UseAbility', playerId: p.playerId, shipId: p.shipId }
          : { type: 'SkipAbility', playerId: p.playerId, shipId: p.shipId };
      case 'decloak':
        return pick([true, false])
          ? { type: 'Decloak', playerId: p.playerId, shipId: p.shipId }
          : { type: 'SkipDecloak', playerId: p.playerId, shipId: p.shipId };
      case 'drop-device':
        if (p.options.devices.length && pick([true, false])) {
          const dev = pick(p.options.devices);
          return {
            type: 'DropDevice',
            playerId: p.playerId,
            shipId: p.shipId,
            xws: dev.xws,
            choice: pick(dev.placements.map((_, i) => i)),
          };
        }
        return { type: 'SkipDrop', playerId: p.playerId, shipId: p.shipId };
      case 'reposition':
        return {
          type: 'Reposition',
          playerId: p.playerId,
          shipId: p.shipId,
          choice: pick(p.options.candidates.map((_, i) => i)),
        };
      case 'grant-target':
        return p.options.candidates.length && pick([true, false])
          ? {
              type: 'GrantAction',
              playerId: p.playerId,
              shipId: p.shipId,
              targetId: pick(p.options.candidates),
            }
          : { type: 'DeclineGrant', playerId: p.playerId, shipId: p.shipId };
      case 'select-target':
        return p.options.candidates.length && pick([true, false])
          ? {
              type: 'SelectTarget',
              playerId: p.playerId,
              shipId: p.shipId,
              targetId: pick(p.options.candidates),
            }
          : { type: 'SkipTarget', playerId: p.playerId, shipId: p.shipId };
      case 'modify': {
        const moves = [
          ...p.options.spends.map((spend) => ({ kind: 'spend', spend }) as const),
          ...p.options.abilities.map((a) => ({ kind: 'ability', xws: a.xws }) as const),
        ];
        if (!moves.length || !pick([true, false]))
          return { type: 'ModifyDone', playerId: p.playerId, shipId: p.shipId };
        const m = pick(moves);
        return m.kind === 'spend'
          ? { type: 'Modify', playerId: p.playerId, shipId: p.shipId, spend: m.spend }
          : { type: 'UseModifyAbility', playerId: p.playerId, shipId: p.shipId, xws: m.xws };
      }
    }
  };
}

describe('replay & determinism', () => {
  it('folds a full game log back to a byte-identical final state (golden master)', () => {
    const final = autoPlay(createGame(demoConfig('golden')), firstChoice, (g) => g.state.round > 3);
    expect(replay(final.log)).toEqual(final.state);
  });

  it('produces identical logs for the same seed and policy', () => {
    const run = () =>
      autoPlay(createGame(demoConfig('s')), firstChoice, (g) => g.state.round > 2).log;
    expect(run()).toEqual(run());
  });

  it('records dice as events and never re-rolls on replay', () => {
    const g = autoPlay(createGame(demoConfig('dice')), firstChoice, (gg) => gg.state.round > 1);
    expect(g.log.filter((e) => e.type === 'DiceRolled').length).toBeGreaterThan(0);
    expect(replay(g.log)).toEqual(g.state);
  });

  it('any randomly-played game replays identically (property)', () => {
    for (let seed = 0; seed < 25; seed++) {
      const g = autoPlay(
        createGame(demoConfig(`p${seed}`)),
        randomChoice(`p${seed}`),
        (gg) => gg.state.round > 2,
      );
      expect(replay(g.log)).toEqual(g.state);
    }
  });

  it('rejects acting for a ship you do not own', () => {
    const g = createGame(demoConfig());
    const r = dispatch(g, {
      type: 'SetDial',
      playerId: 'imperial',
      shipId: 'x1',
      maneuver: { speed: 1, bearing: 'straight', difficulty: 'blue' },
    });
    expect(r.rejection).toBeTruthy();
    expect(r.game).toBe(g);
  });

  it('rejects an illegal maneuver not on the dial', () => {
    const r = dispatch(createGame(demoConfig()), {
      type: 'SetDial',
      playerId: 'rebel',
      shipId: 'x1',
      maneuver: { speed: 5, bearing: 'koiogran', difficulty: 'red' },
    });
    expect(r.rejection).toBeTruthy();
  });

  it('rejects acting out of turn', () => {
    // during planning there is no execute-maneuver pending
    const r = dispatch(createGame(demoConfig()), {
      type: 'ExecuteManeuver',
      playerId: 'rebel',
      shipId: 'x1',
    });
    expect(r.rejection).toBeTruthy();
  });
});
