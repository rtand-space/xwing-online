import { inArc, rangeBand } from './arcs';
import { obstaclesAt } from './obstacles';
import { isCloaked, isDisarmed, isIonized } from './tokens';
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

/** Lowest initiative first: the next cloaked ship that may still decloak this phase. */
function decloakShip(state: GameState): Ship | undefined {
  return [...state.ships]
    .filter((s) => alive(s) && isCloaked(s) && !s.hasSystemActed)
    .sort((a, b) => a.initiative - b.initiative || (a.id < b.id ? -1 : 1))[0];
}

/** Highest initiative first; deterministic id tie-break. Undefined once all engaged. */
function engagementShip(state: GameState): Ship | undefined {
  return [...state.ships]
    .filter((s) => alive(s) && !s.hasEngaged)
    .sort((a, b) => b.initiative - a.initiative || (a.id < b.id ? -1 : 1))[0];
}

function actionDecision(state: GameState, ship: Ship): PendingDecision {
  // a stressed ship cannot act; an ionised ship may perform only calculate;
  // a cloaked ship cannot perform the cloak action (no second cloak token)
  const actions: ActionType[] = isStressed(ship)
    ? []
    : isIonized(ship)
      ? ['calculate']
      : isCloaked(ship)
        ? ship.actionBar.filter((a) => a !== 'cloak')
        : ship.actionBar;
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
  // A pending optional ability pauses the FSM until its owner uses or skips it.
  if (state.offer) {
    const ship = state.ships.find((s) => s.id === state.offer!.shipId);
    if (ship) {
      return [
        {
          type: 'trigger-ability',
          playerId: ship.ownerId,
          shipId: ship.id,
          options: { abilityXws: state.offer.abilityXws, label: state.offer.label },
        },
      ];
    }
  }
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
    case 'system': {
      const ship = decloakShip(state);
      if (!ship) return [];
      return [{ type: 'decloak', playerId: ship.ownerId, shipId: ship.id, options: { canSkip: true } }];
    }
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
      // A disarmed ship, or one at range 0 of an asteroid/debris cloud, cannot attack.
      const blocked = isDisarmed(ship) || obstaclesAt(state, ship.pos, ship.base).length > 0;
      const targets = blocked
        ? []
        : enemies(state, ship)
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
