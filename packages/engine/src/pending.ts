import { inArc, rangeBand } from './arcs';
import type { ActionType, GameState, PendingDecision, Ship, ShipId } from './types';

const alive = (s: Ship): boolean => s.hull > 0;
const isStressed = (s: Ship): boolean => s.tokens.some((t) => t.kind === 'stress');

function enemies(state: GameState, ship: Ship): Ship[] {
  return state.ships.filter((s) => s.ownerId !== ship.ownerId && alive(s));
}

/** Lowest initiative first; deterministic id tie-break. Undefined once all activated. */
function activationShip(state: GameState): Ship | undefined {
  return [...state.ships]
    .filter((s) => alive(s) && !(s.hasMoved && s.hasActed))
    .sort((a, b) => a.initiative - b.initiative || (a.id < b.id ? -1 : 1))[0];
}

/** Highest initiative first; deterministic id tie-break. Undefined once all engaged. */
function engagementShip(state: GameState): Ship | undefined {
  return [...state.ships]
    .filter((s) => alive(s) && !s.hasEngaged)
    .sort((a, b) => b.initiative - a.initiative || (a.id < b.id ? -1 : 1))[0];
}

function actionDecision(state: GameState, ship: Ship): PendingDecision {
  const actions: ActionType[] = isStressed(ship) ? [] : ship.actionBar;
  const lockTargets: ShipId[] = actions.includes('lock')
    ? enemies(state, ship).map((s) => s.id)
    : [];
  return {
    type: 'perform-action',
    playerId: ship.ownerId,
    shipId: ship.id,
    options: { actions, lockTargets, canSkip: true },
  };
}

/** Who owes what, with only legal options. Pure derivation from state. */
export function computePending(state: GameState): PendingDecision[] {
  if (state.gameOver) return [];
  switch (state.phase) {
    case 'planning':
      return state.ships
        .filter((s) => alive(s) && !s.dial)
        .map((s) => ({
          type: 'set-dial',
          playerId: s.ownerId,
          shipId: s.id,
          options: {
            // a stressed ship cannot select red maneuvers
            maneuvers: s.dialOptions.filter((m) => !(isStressed(s) && m.difficulty === 'red')),
          },
        }));
    case 'system':
      return [];
    case 'activation': {
      const ship = activationShip(state);
      if (!ship) return [];
      if (!ship.hasMoved) {
        return [{ type: 'execute-maneuver', playerId: ship.ownerId, shipId: ship.id }];
      }
      return [actionDecision(state, ship)];
    }
    case 'engagement': {
      const ship = engagementShip(state);
      if (!ship) return [];
      const targets = enemies(state, ship)
        .filter((t) => inArc(ship, t) && rangeBand(ship, t) !== null)
        .map((s) => s.id);
      return [
        {
          type: 'declare-attack',
          playerId: ship.ownerId,
          shipId: ship.id,
          options: { targets, canPass: true },
        },
      ];
    }
    case 'end':
      return [];
  }
}
