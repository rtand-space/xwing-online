import { fireWindow, findOffer, resolveOptional } from './abilities';
import { applyEvent } from './apply';
import { resolveAttack } from './combat';
import type { Command } from './commands';
import type { GameEvent } from './events';
import { resolveMovement } from './movement';
import { obstacleMoveEvents } from './obstacles';
import { autoStep } from './phases';
import type { GameState, GameWindow, Maneuver, PendingDecision, Ship } from './types';

export interface ReduceResult {
  events: GameEvent[];
  rejection?: string;
}

const reject = (rejection: string): ReduceResult => ({ events: [], rejection });

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
      const m = ship.dial;
      if (!m) return reject('No dial set');
      const move = resolveMovement(state, ship, m);
      const events: GameEvent[] = [
        { type: 'DialRevealed', shipId: ship.id, maneuver: m },
        { type: 'ShipMoved', shipId: ship.id, maneuver: m, to: move.to, bumped: move.bumped },
      ];
      if (m.difficulty === 'red') events.push({ type: 'StressChanged', shipId: ship.id, delta: 1 });
      else if (m.difficulty === 'blue') {
        events.push({ type: 'StressChanged', shipId: ship.id, delta: -1 });
      }
      events.push(...obstacleMoveEvents(state, ship, move.to));
      return { events: appendWindow(state, events, 'afterMove', ship.id) };
    }
    case 'PerformAction': {
      if (pending.type !== 'perform-action') return reject('Wrong phase');
      if (!pending.options.actions.includes(cmd.action)) return reject('Action not available');
      const events: GameEvent[] = [
        { type: 'ActionPerformed', shipId: ship.id, action: cmd.action, targetId: cmd.targetId },
      ];
      if (cmd.action === 'focus')
        events.push({ type: 'TokenGained', shipId: ship.id, kind: 'focus' });
      else if (cmd.action === 'evade') {
        events.push({ type: 'TokenGained', shipId: ship.id, kind: 'evade' });
      } else if (cmd.action === 'lock') {
        if (!cmd.targetId || !pending.options.lockTargets.includes(cmd.targetId)) {
          return reject('Invalid lock target');
        }
        events.push({ type: 'TokenGained', shipId: ship.id, kind: 'lock', targetId: cmd.targetId });
      }
      return { events: appendWindow(state, events, 'onPerformAction', ship.id, events[0]) };
    }
    case 'SkipAction': {
      if (pending.type !== 'perform-action' || !pending.options.canSkip)
        return reject('Cannot skip');
      return { events: [{ type: 'ActionSkipped', shipId: ship.id }] };
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
