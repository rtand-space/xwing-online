import { fireWindow, findOffer, resolveOptional } from './abilities';
import { applyEvent } from './apply';
import { resolveAttack } from './combat';
import type { Command } from './commands';
import type { GameEvent } from './events';
import { nextFacing } from './arcs';
import { collides, resolveMovement } from './movement';
import { obstacleMoveEvents } from './obstacles';
import { repositionCandidates } from './reposition';
import { autoStep } from './phases';
import { pathAt } from './templates';
import { countToken, hasToken, ionManeuver, isIonized } from './tokens';
import type { GameState, GameWindow, Maneuver, PendingDecision, Ship, Speed } from './types';

export interface ReduceResult {
  events: GameEvent[];
  rejection?: string;
}

const reject = (rejection: string): ReduceResult => ({ events: [], rejection });

/** At the end of its activation an ionised ship sheds all of its ion tokens. */
const ionShed = (ship: Ship): GameEvent[] =>
  Array.from({ length: countToken(ship, 'ion') }, () => ({
    type: 'TokenSpent' as const,
    shipId: ship.id,
    kind: 'ion' as const,
  }));

/** Reload recovers one charge: an upgrade pool below its max first, else the
 *  intrinsic pool. (Ordnance-specific reloading lands with secondary weapons.) */
function reloadCharge(ship: Ship): GameEvent | null {
  for (const [source, p] of Object.entries(ship.upgradeCharges ?? {})) {
    if (p.charges < p.max) return { type: 'ChargeChanged', shipId: ship.id, delta: 1, source };
  }
  if (ship.charges < ship.maxCharges) return { type: 'ChargeChanged', shipId: ship.id, delta: 1 };
  return null;
}

/** Token/effect events for a self-targeted action — used both by the normal action
 *  step and by a coordinate's free action. */
function freeActionEffects(ship: Ship, action: string): GameEvent[] {
  switch (action) {
    case 'focus':
      return [{ type: 'TokenGained', shipId: ship.id, kind: 'focus' }];
    case 'evade':
      return [{ type: 'TokenGained', shipId: ship.id, kind: 'evade' }];
    case 'calculate':
      return [{ type: 'TokenGained', shipId: ship.id, kind: 'calculate' }];
    case 'reinforce':
      return [{ type: 'TokenGained', shipId: ship.id, kind: 'reinforce' }];
    case 'rotate-arc':
      return [{ type: 'ArcRotated', shipId: ship.id, to: nextFacing(ship) }];
    case 'reload': {
      const rc = reloadCharge(ship);
      return [...(rc ? [rc] : []), { type: 'TokenGained', shipId: ship.id, kind: 'disarm' }];
    }
    default:
      return [];
  }
}

/**
 * Fold the events so far, fire a non-combat ability window's mandatory effects,
 * then offer the first available optional ability (which pauses the FSM).
 */
function appendWindow(
  state: GameState,
  events: GameEvent[],
  window: GameWindow,
  shipId: string,
  trigger?: GameEvent,
): GameEvent[] {
  const fold = (): GameState => events.reduce((s, e) => applyEvent(s, e), state);
  let ship = fold().ships.find((sh) => sh.id === shipId);
  if (ship && ship.hull > 0) events.push(...fireWindow(fold(), window, ship, trigger));
  ship = fold().ships.find((sh) => sh.id === shipId);
  if (ship && ship.hull > 0) {
    const offer = findOffer(fold(), window, ship);
    if (offer) {
      events.push({ type: 'AbilityOffered', shipId, window, ...offer });
    }
  }
  return events;
}

const sameManeuver = (a: Maneuver, b: Maneuver): boolean =>
  a.speed === b.speed && a.bearing === b.bearing && a.difficulty === b.difficulty;

const PENDING_FOR: Record<Command['type'], PendingDecision['type']> = {
  SetDial: 'set-dial',
  ExecuteManeuver: 'execute-maneuver',
  PerformAction: 'perform-action',
  SkipAction: 'perform-action',
  DeclareAttack: 'declare-attack',
  PassAttack: 'declare-attack',
  UseAbility: 'trigger-ability',
  SkipAbility: 'trigger-ability',
  Decloak: 'decloak',
  SkipDecloak: 'decloak',
  Reposition: 'reposition',
};

function matchPending(state: GameState, cmd: Command): PendingDecision | undefined {
  return state.pending.find(
    (p) =>
      p.type === PENDING_FOR[cmd.type] && p.shipId === cmd.shipId && p.playerId === cmd.playerId,
  );
}

/** Validate one command against current state and produce its direct events. */
function reduceDirect(state: GameState, cmd: Command): ReduceResult {
  const pending = matchPending(state, cmd);
  if (!pending) return reject(`No pending ${cmd.type} for ${cmd.shipId} by ${cmd.playerId}`);
  const ship = state.ships.find((s) => s.id === cmd.shipId) as Ship;

  switch (cmd.type) {
    case 'SetDial': {
      if (pending.type !== 'set-dial') return reject('Wrong phase');
      if (!pending.options.maneuvers.some((m) => sameManeuver(m, cmd.maneuver))) {
        return reject('Illegal maneuver');
      }
      return { events: [{ type: 'DialSet', shipId: ship.id, maneuver: cmd.maneuver }] };
    }
    case 'ExecuteManeuver': {
      // An ionised ship reveals its dial as normal but executes a blue 1-straight/
      // bank in that direction instead.
      const ionized = isIonized(ship);
      if (!ship.dial) return reject('No dial set');
      const m = ionized ? ionManeuver(ship.dial) : ship.dial;
      const move = resolveMovement(state, ship, m);
      const events: GameEvent[] = [
        { type: 'DialRevealed', shipId: ship.id, maneuver: ship.dial },
        { type: 'ShipMoved', shipId: ship.id, maneuver: m, to: move.to, bumped: move.bumped },
      ];
      if (m.difficulty === 'red') events.push({ type: 'StressChanged', shipId: ship.id, delta: 1 });
      else if (m.difficulty === 'blue') {
        events.push({ type: 'StressChanged', shipId: ship.id, delta: -1 });
        // a blue maneuver also sheds one strain token
        if (hasToken(ship, 'strain'))
          events.push({ type: 'TokenSpent', shipId: ship.id, kind: 'strain' });
      }
      events.push(...obstacleMoveEvents(state, ship, move.to));
      // a bump ends the activation, so an ionised ship sheds its ion tokens now
      if (ionized && move.bumped) events.push(...ionShed(ship));
      return { events: appendWindow(state, events, 'afterMove', ship.id) };
    }
    case 'PerformAction': {
      if (pending.type !== 'perform-action') return reject('Wrong phase');
      if (!pending.options.actions.includes(cmd.action)) return reject('Action not available');
      // a coordinate's free action: apply the effect without ending the activation
      if (state.grantedAction?.shipId === ship.id) {
        return { events: [...freeActionEffects(ship, cmd.action), { type: 'GrantResolved' }] };
      }
      // boost/barrel-roll pause for a placement choice instead of resolving now
      if (cmd.action === 'boost' || cmd.action === 'barrel-roll') {
        const candidates = repositionCandidates(state, ship, cmd.action);
        if (candidates.length === 0) return reject('No legal reposition');
        return {
          events: [{ type: 'RepositionOffered', shipId: ship.id, action: cmd.action, candidates }],
        };
      }
      const events: GameEvent[] = [
        { type: 'ActionPerformed', shipId: ship.id, action: cmd.action, targetId: cmd.targetId },
      ];
      if (cmd.action === 'focus')
        events.push({ type: 'TokenGained', shipId: ship.id, kind: 'focus' });
      else if (cmd.action === 'evade') {
        events.push({ type: 'TokenGained', shipId: ship.id, kind: 'evade' });
      } else if (cmd.action === 'calculate') {
        events.push({ type: 'TokenGained', shipId: ship.id, kind: 'calculate' });
      } else if (cmd.action === 'reinforce') {
        events.push({ type: 'TokenGained', shipId: ship.id, kind: 'reinforce' });
      } else if (cmd.action === 'cloak') {
        events.push({ type: 'TokenGained', shipId: ship.id, kind: 'cloak' });
      } else if (cmd.action === 'rotate-arc') {
        events.push({ type: 'ArcRotated', shipId: ship.id, to: nextFacing(ship) });
      } else if (cmd.action === 'reload') {
        const rc = reloadCharge(ship);
        if (rc) events.push(rc);
        events.push({ type: 'TokenGained', shipId: ship.id, kind: 'disarm' });
      } else if (cmd.action === 'jam') {
        if (!cmd.targetId || !pending.options.jamTargets.includes(cmd.targetId)) {
          return reject('Invalid jam target');
        }
        events.push({ type: 'TokenGained', shipId: cmd.targetId, kind: 'jam' });
      } else if (cmd.action === 'coordinate') {
        if (!cmd.targetId || !pending.options.coordinateTargets.includes(cmd.targetId)) {
          return reject('Invalid coordinate target');
        }
        events.push({ type: 'ActionGranted', shipId: cmd.targetId });
      } else if (cmd.action === 'lock') {
        if (!cmd.targetId || !pending.options.lockTargets.includes(cmd.targetId)) {
          return reject('Invalid lock target');
        }
        events.push({ type: 'TokenGained', shipId: ship.id, kind: 'lock', targetId: cmd.targetId });
      }
      const out = appendWindow(state, events, 'onPerformAction', ship.id, events[0]);
      if (isIonized(ship)) out.push(...ionShed(ship));
      return { events: out };
    }
    case 'SkipAction': {
      if (pending.type !== 'perform-action' || !pending.options.canSkip)
        return reject('Cannot skip');
      // declining a coordinate's free action just ends the grant
      if (state.grantedAction?.shipId === ship.id) return { events: [{ type: 'GrantResolved' }] };
      const events: GameEvent[] = [{ type: 'ActionSkipped', shipId: ship.id }];
      if (isIonized(ship)) events.push(...ionShed(ship));
      return { events };
    }
    case 'DeclareAttack': {
      if (pending.type !== 'declare-attack') return reject('Wrong phase');
      if (!pending.options.targets.includes(cmd.targetId)) return reject('Invalid target');
      return { events: resolveAttack(state, ship.id, cmd.targetId) };
    }
    case 'PassAttack': {
      if (pending.type !== 'declare-attack' || !pending.options.canPass)
        return reject('Cannot pass');
      return { events: [{ type: 'AttackPassed', shipId: ship.id }] };
    }
    case 'UseAbility': {
      if (pending.type !== 'trigger-ability' || !state.offer) return reject('No ability offered');
      const events = resolveOptional(state, ship, state.offer.abilityXws, state.offer.window);
      events.push({ type: 'AbilityResolved' });
      return { events };
    }
    case 'SkipAbility': {
      if (pending.type !== 'trigger-ability') return reject('No ability offered');
      return { events: [{ type: 'AbilityResolved' }] };
    }
    case 'Decloak': {
      if (pending.type !== 'decloak') return reject('Wrong phase');
      // M2 supports the forward boost; the full barrel-roll/bank menu lands in M4.
      const speed: Speed = ship.base === 'small' ? 2 : 1;
      const to = pathAt(ship.pos, { speed, bearing: 'straight', difficulty: 'white' }, 1, ship.base);
      // a decloak that would overlap a ship fails: stay put and keep the token
      if (collides(state, ship, to)) return { events: [{ type: 'DecloakPassed', shipId: ship.id }] };
      return {
        events: [
          { type: 'Decloaked', shipId: ship.id, to },
          { type: 'TokenSpent', shipId: ship.id, kind: 'cloak' },
        ],
      };
    }
    case 'SkipDecloak': {
      if (pending.type !== 'decloak') return reject('Cannot skip');
      return { events: [{ type: 'DecloakPassed', shipId: ship.id }] };
    }
    case 'Reposition': {
      if (pending.type !== 'reposition') return reject('Wrong phase');
      const cand = pending.options.candidates[cmd.choice];
      if (!cand) return reject('Invalid reposition choice');
      const events: GameEvent[] = [
        { type: 'Repositioned', shipId: ship.id, to: cand.to },
        { type: 'ActionPerformed', shipId: ship.id, action: pending.options.action },
      ];
      return { events: appendWindow(state, events, 'onPerformAction', ship.id, events[1]) };
    }
  }
}

/**
 * Validate a command and return all resulting events, including the automatic
 * phase transitions that cascade until the game next needs player input.
 */
export function reduce(state: GameState, cmd: Command): ReduceResult {
  const direct = reduceDirect(state, cmd);
  if (direct.rejection) return direct;

  const events = [...direct.events];
  let s = state;
  for (const e of direct.events) s = applyEvent(s, e);
  for (;;) {
    const auto = autoStep(s);
    if (!auto) break;
    for (const e of auto) {
      events.push(e);
      s = applyEvent(s, e);
    }
  }
  return { events };
}
