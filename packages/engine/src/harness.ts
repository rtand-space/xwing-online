import type { Command } from './commands';
import { dispatch, type Game } from './game';
import type { PendingDecision } from './types';

export type Chooser = (p: PendingDecision, game: Game) => Command;

/** A simple deterministic policy: always take the first legal option. */
export const firstChoice: Chooser = (p) => {
  switch (p.type) {
    case 'set-dial':
      return {
        type: 'SetDial',
        playerId: p.playerId,
        shipId: p.shipId,
        maneuver: p.options.maneuvers[0]!,
      };
    case 'execute-maneuver':
      return { type: 'ExecuteManeuver', playerId: p.playerId, shipId: p.shipId };
    case 'perform-action':
      return p.options.actions.length
        ? {
            type: 'PerformAction',
            playerId: p.playerId,
            shipId: p.shipId,
            action: p.options.actions[0]!,
          }
        : { type: 'SkipAction', playerId: p.playerId, shipId: p.shipId };
    case 'declare-attack':
      return p.options.targets.length
        ? {
            type: 'DeclareAttack',
            playerId: p.playerId,
            shipId: p.shipId,
            targetId: p.options.targets[0]!,
          }
        : { type: 'PassAttack', playerId: p.playerId, shipId: p.shipId };
    case 'trigger-ability':
      return { type: 'UseAbility', playerId: p.playerId, shipId: p.shipId };
    case 'decloak':
      return { type: 'SkipDecloak', playerId: p.playerId, shipId: p.shipId };
  }
};

/** Drive the game by answering its first pending decision until `stop` or a step cap. */
export function autoPlay(
  game: Game,
  choose: Chooser,
  stop: (g: Game) => boolean,
  maxSteps = 1000,
): Game {
  let g = game;
  let steps = 0;
  while (!stop(g) && g.state.pending.length > 0 && steps++ < maxSteps) {
    const { game: next, rejection } = dispatch(g, choose(g.state.pending[0]!, g));
    if (rejection) throw new Error(rejection);
    g = next;
  }
  return g;
}
