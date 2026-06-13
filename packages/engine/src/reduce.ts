import { fireWindow, findOffer, resolveOptional } from './abilities';
import { applyEvent } from './apply';
import {
  applyAttackAbilities,
  applyOptionalAbility,
  applySpend,
  beginAttack,
  combatAbilities,
  finishCombat,
  rollDefenceStage,
} from './combat';
import type { Command } from './commands';
import type { GameEvent } from './events';
import { nextFacing } from './arcs';
import { collides, resolveMovement } from './movement';
import { obstacleMoveEvents } from './obstacles';
import { repositionCandidates, slamCandidates } from './reposition';
import { autoStep } from './phases';
import { pathAt } from './templates';
import { countToken, hasToken, ionManeuver, isIonized } from './tokens';
import type {
  ActionType,
  Difficulty,
  GameState,
  GameWindow,
  Maneuver,
  PendingDecision,
  Ship,
  Speed,
} from './types';

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

/** A red action gains stress; a purple action spends Force. White costs nothing. */
function costFor(shipId: string, d: Difficulty): GameEvent[] {
  if (d === 'red') return [{ type: 'StressChanged', shipId, delta: 1 }];
  if (d === 'purple') return [{ type: 'ForceChanged', shipId, delta: -1 }];
  return [];
}

const actionDiff = (ship: Ship, action: ActionType): Difficulty =>
  ship.actionDifficulty?.[action] ?? 'white';

/** Offer a base action's linked follow-up, if it has one. */
function linkOffer(ship: Ship, action: ActionType): GameEvent[] {
  const link = ship.actionLinks?.[action];
  return link
    ? [{ type: 'LinkOffered', shipId: ship.id, action: link.action, difficulty: link.difficulty }]
    : [];
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
  // only queue one optional offer at a time — the FSM pauses until it resolves
  if (ship && ship.hull > 0 && !fold().offer) {
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
  GrantAction: 'grant-target',
  DeclineGrant: 'grant-target',
  Modify: 'modify',
  UseModifyAbility: 'modify',
  ModifyDone: 'modify',
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
        return {
          events: [
            ...freeActionEffects(ship, cmd.action),
            ...costFor(ship.id, actionDiff(ship, cmd.action)),
            { type: 'GrantResolved' },
          ],
        };
      }
      // boost/barrel-roll/SLAM pause for a placement choice instead of resolving now
      if (cmd.action === 'boost' || cmd.action === 'barrel-roll') {
        const candidates = repositionCandidates(state, ship, cmd.action);
        if (candidates.length === 0) return reject('No legal reposition');
        return {
          events: [{ type: 'RepositionOffered', shipId: ship.id, action: cmd.action, candidates }],
        };
      }
      if (cmd.action === 'slam') {
        const candidates = slamCandidates(state, ship);
        if (candidates.length === 0) return reject('No legal SLAM maneuver');
        return {
          events: [{ type: 'RepositionOffered', shipId: ship.id, action: 'slam', candidates }],
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
      // a linked follow-up charges the link's difficulty and ends the chain;
      // a base action charges its own difficulty and offers its link (if any)
      const isLinked = state.linkedAction?.shipId === ship.id;
      events.push(...costFor(ship.id, isLinked ? state.linkedAction!.difficulty : actionDiff(ship, cmd.action)));
      events.push(...(isLinked ? [{ type: 'LinkResolved' as const }] : linkOffer(ship, cmd.action)));
      const out = appendWindow(state, events, 'onPerformAction', ship.id, events[0]);
      if (isIonized(ship)) out.push(...ionShed(ship));
      return { events: out };
    }
    case 'SkipAction': {
      if (pending.type !== 'perform-action' || !pending.options.canSkip)
        return reject('Cannot skip');
      // declining a linked follow-up or a coordinate's free action just ends it
      if (state.linkedAction?.shipId === ship.id) return { events: [{ type: 'LinkResolved' }] };
      if (state.grantedAction?.shipId === ship.id) return { events: [{ type: 'GrantResolved' }] };
      const events: GameEvent[] = [{ type: 'ActionSkipped', shipId: ship.id }];
      if (isIonized(ship)) events.push(...ionShed(ship));
      return { events };
    }
    case 'DeclareAttack': {
      if (pending.type !== 'declare-attack') return reject('Wrong phase');
      if (!pending.options.targets.includes(cmd.targetId)) return reject('Invalid target');
      // roll the dice, then pause for the attacker's optional spends
      const bonus = state.bonusAttack?.shipId === ship.id;
      const { events, attack, range, obstructed } = beginAttack(state, ship.id, cmd.targetId, bonus);
      const out: GameEvent[] = [
        ...events,
        { type: 'CombatBegan', attackerId: ship.id, targetId: cmd.targetId, range, obstructed, attack },
      ];
      if (bonus) out.push({ type: 'BonusAttackResolved' });
      return { events: out };
    }
    case 'PassAttack': {
      if (pending.type !== 'declare-attack' || !pending.options.canPass)
        return reject('Cannot pass');
      // declining a granted bonus attack just clears it (no engagement spent)
      if (state.bonusAttack?.shipId === ship.id) return { events: [{ type: 'BonusAttackResolved' }] };
      return { events: [{ type: 'AttackPassed', shipId: ship.id }] };
    }
    case 'Modify': {
      if (pending.type !== 'modify' || !state.combat) return reject('No combat');
      if (!pending.options.spends.includes(cmd.spend)) return reject('Spend not available');
      const r = applySpend(state, state.combat, cmd.spend);
      // a lock is a reroll; focus/calculate/force change results (locking out rerolls)
      return {
        events: [
          ...r.events,
          { type: 'CombatDiceSet', attack: r.attack, defence: r.defence, changed: cmd.spend !== 'lock' },
        ],
      };
    }
    case 'UseModifyAbility': {
      if (pending.type !== 'modify' || !state.combat) return reject('No combat');
      if (!pending.options.abilities.some((a) => a.xws === cmd.xws)) return reject('Unavailable');
      const r = applyOptionalAbility(state, state.combat, cmd.xws);
      return {
        events: [
          ...r.events,
          {
            type: 'CombatDiceSet',
            attack: r.attack,
            defence: r.defence,
            changed: r.changed,
            usedAbility: cmd.xws,
          },
        ],
      };
    }
    case 'ModifyDone': {
      if (pending.type !== 'modify' || !state.combat) return reject('No combat');
      const c = state.combat;
      if (c.step === 'attack') {
        // run the auto (cost-free) attack abilities, then roll defence
        let s = state;
        const events: GameEvent[] = [];
        const ab = applyAttackAbilities(s, s.combat!);
        events.push(...ab.events, { type: 'CombatDiceSet', attack: ab.attack });
        for (const e of events) s = applyEvent(s, e);
        const rd = rollDefenceStage(s, s.combat!);
        events.push(...rd.events, { type: 'CombatAdvanced', defence: rd.defence });
        return { events };
      }
      // after the defender modifies, give the attacker a step for any cost ability
      // that modifies the defender's dice (e.g. Crack Shot); otherwise resolve.
      if (c.step === 'defence' && combatAbilities(state, { ...c, step: 'after-defence' }).length) {
        return { events: [{ type: 'CombatStep', step: 'after-defence' }] };
      }
      const events: GameEvent[] = [...finishCombat(state, c), { type: 'CombatEnded' }];
      // reactive windows: attacker first, then the defender's
      appendWindow(state, events, 'afterAttack', c.attackerId);
      const before = state.ships.find((sh) => sh.id === c.targetId)!;
      const dmg = events.find(
        (e): e is Extract<GameEvent, { type: 'DamageDealt' }> =>
          e.type === 'DamageDealt' && e.shipId === c.targetId,
      );
      if (dmg && dmg.shieldsAfter < before.shields) {
        appendWindow(state, events, 'onShieldLost', c.targetId);
      }
      if (dmg) appendWindow(state, events, 'onDamaged', c.targetId);
      appendWindow(state, events, 'afterDefend', c.targetId);
      return { events };
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
    case 'GrantAction': {
      if (pending.type !== 'grant-target' || !state.grantOffer) return reject('No grant offered');
      if (!pending.options.candidates.includes(cmd.targetId)) return reject('Invalid grant target');
      const events: GameEvent[] = [{ type: 'GrantOfferResolved' }];
      if (state.grantOffer.spendForce) events.push({ type: 'ForceChanged', shipId: ship.id, delta: -1 });
      events.push({ type: 'ActionGranted', shipId: cmd.targetId });
      return { events };
    }
    case 'DeclineGrant': {
      if (pending.type !== 'grant-target') return reject('No grant offered');
      return { events: [{ type: 'GrantOfferResolved' }] };
    }
    case 'Reposition': {
      if (pending.type !== 'reposition') return reject('Wrong phase');
      const cand = pending.options.candidates[cmd.choice];
      if (!cand) return reject('Invalid reposition choice');
      const action = pending.options.action;
      const events: GameEvent[] = [
        { type: 'Repositioned', shipId: ship.id, to: cand.to },
        { type: 'ActionPerformed', shipId: ship.id, action },
      ];
      if (action === 'slam') events.push({ type: 'TokenGained', shipId: ship.id, kind: 'disarm' });
      // a linked reposition charges the link's difficulty and ends the chain
      const isLinked = state.linkedAction?.shipId === ship.id && state.linkedAction.action === action;
      events.push(...costFor(ship.id, isLinked ? state.linkedAction!.difficulty : actionDiff(ship, action)));
      events.push(...(isLinked ? [{ type: 'LinkResolved' as const }] : linkOffer(ship, action)));
      return { events: appendWindow(state, events, 'onPerformAction', ship.id, events[1]) };
    }
  }
}

/**
 * A pending decision with no real choice — its only legal option, ready to apply.
 * Lets a driver (client/AI) skip empty steps without prompting: no target → pass,
 * no action → skip, nothing to spend → proceed. (A presentation concern, so it
 * lives here as a helper rather than baked into the FSM.)
 */
export function trivialCommand(p: PendingDecision): Command | null {
  if (
    p.type === 'perform-action' &&
    !p.options.actions.length &&
    !p.options.lockTargets.length &&
    !p.options.jamTargets.length &&
    !p.options.coordinateTargets.length
  ) {
    return { type: 'SkipAction', playerId: p.playerId, shipId: p.shipId };
  }
  if (p.type === 'declare-attack' && !p.options.targets.length) {
    return { type: 'PassAttack', playerId: p.playerId, shipId: p.shipId };
  }
  if (p.type === 'modify' && !p.options.spends.length && !p.options.abilities.length) {
    return { type: 'ModifyDone', playerId: p.playerId, shipId: p.shipId };
  }
  return null;
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
