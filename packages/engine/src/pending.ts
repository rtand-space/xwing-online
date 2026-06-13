import { attackValue, rangeBand } from './arcs';
import { combatAbilities, combatSpends } from './combat';
import { obstaclesAt } from './obstacles';
import { repositionCandidates, slamCandidates } from './reposition';
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
  const bar = isStressed(ship)
    ? []
    : isIonized(ship)
      ? (['calculate'] as ActionType[])
      : isCloaked(ship)
        ? ship.actionBar.filter((a) => a !== 'cloak')
        : ship.actionBar;
  // a reposition is only offerable with a legal placement; a purple action needs Force
  const actions = bar.filter((a) => {
    if (a === 'boost' || a === 'barrel-roll') return repositionCandidates(state, ship, a).length > 0;
    if (a === 'slam') return slamCandidates(state, ship).length > 0;
    if ((ship.actionDifficulty?.[a] ?? 'white') === 'purple') return (ship.force ?? 0) >= 1;
    return true;
  });
  const lockTargets: ShipId[] = actions.includes('lock')
    ? enemies(state, ship).map((s) => s.id)
    : [];
  const jamTargets: ShipId[] = actions.includes('jam')
    ? enemies(state, ship)
        .filter((t) => rangeBand(ship, t) === 1)
        .map((s) => s.id)
    : [];
  const coordinateTargets: ShipId[] = actions.includes('coordinate')
    ? state.ships
        .filter((s) => s.id !== ship.id && s.ownerId === ship.ownerId && alive(s))
        .filter((s) => {
          const band = rangeBand(ship, s);
          return band !== null && band <= 2;
        })
        .map((s) => s.id)
    : [];
  const available = actions.filter(
    (a) => (a !== 'jam' || jamTargets.length > 0) && (a !== 'coordinate' || coordinateTargets.length > 0),
  );
  return {
    type: 'perform-action',
    playerId: ship.ownerId,
    shipId: ship.id,
    options: { actions: available, lockTargets, jamTargets, coordinateTargets, canSkip: true },
  };
}

/** Free actions a coordinate can grant (no nested targets/repositions for now). */
const GRANTABLE: ActionType[] = ['focus', 'evade', 'calculate', 'reinforce', 'rotate-arc', 'reload'];

/** The follow-up choice offered after a base action with a linked action. The
 *  single linked action is offered (gated by legality), with skip always allowed. */
function linkedDecision(state: GameState, ship: Ship, action: ActionType): PendingDecision {
  let actions: ActionType[] = [action];
  if (action === 'boost' || action === 'barrel-roll') {
    if (repositionCandidates(state, ship, action).length === 0) actions = [];
  } else if (action === 'slam' && slamCandidates(state, ship).length === 0) {
    actions = [];
  }
  const lockTargets = action === 'lock' ? enemies(state, ship).map((s) => s.id) : [];
  const jamTargets =
    action === 'jam'
      ? enemies(state, ship)
          .filter((t) => rangeBand(ship, t) === 1)
          .map((s) => s.id)
      : [];
  if (action === 'jam' && jamTargets.length === 0) actions = [];
  if (action === 'lock' && lockTargets.length === 0) actions = [];
  return {
    type: 'perform-action',
    playerId: ship.ownerId,
    shipId: ship.id,
    options: { actions, lockTargets, jamTargets, coordinateTargets: [], canSkip: true },
  };
}

/** The granted ship's free-action choice from a coordinate. */
function grantedDecision(ship: Ship): PendingDecision {
  const actions = isStressed(ship) ? [] : ship.actionBar.filter((a) => GRANTABLE.includes(a));
  return {
    type: 'perform-action',
    playerId: ship.ownerId,
    shipId: ship.id,
    options: {
      actions,
      lockTargets: [],
      jamTargets: [],
      coordinateTargets: [],
      granted: true,
      canSkip: true,
    },
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
  // An ability granting an action pauses for the granter to pick the recipient.
  if (state.grantOffer) {
    const ship = state.ships.find((s) => s.id === state.grantOffer!.granterId);
    if (ship) {
      return [
        {
          type: 'grant-target',
          playerId: ship.ownerId,
          shipId: ship.id,
          options: { candidates: state.grantOffer.candidates, canSkip: true },
        },
      ];
    }
  }
  // A coordinate's free action pauses the FSM for the granted ship's choice.
  if (state.grantedAction) {
    const ship = state.ships.find((s) => s.id === state.grantedAction!.shipId);
    if (ship) return [grantedDecision(ship)];
  }
  // A boost/barrel-roll mid-resolution pauses the FSM for the placement choice.
  if (state.reposition) {
    const ship = state.ships.find((s) => s.id === state.reposition!.shipId);
    if (ship) {
      return [
        {
          type: 'reposition',
          playerId: ship.ownerId,
          shipId: ship.id,
          options: { action: state.reposition.action, candidates: state.reposition.candidates },
        },
      ];
    }
  }
  // A linked follow-up action pauses the FSM for the ship's use/skip choice.
  if (state.linkedAction) {
    const ship = state.ships.find((s) => s.id === state.linkedAction!.shipId);
    if (ship) return [linkedDecision(state, ship, state.linkedAction.action)];
  }
  // An attack mid-resolution pauses for the current step's optional spends.
  if (state.combat) {
    const c = state.combat;
    const ship = state.ships.find((s) => s.id === (c.step === 'defence' ? c.targetId : c.attackerId));
    if (ship) {
      return [
        {
          type: 'modify',
          playerId: ship.ownerId,
          shipId: ship.id,
          options: { step: c.step, spends: combatSpends(state, c), abilities: combatAbilities(state, c) },
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
            .filter((t) => attackValue(ship, t) !== null && rangeBand(ship, t) !== null)
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
