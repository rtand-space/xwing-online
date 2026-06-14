import type { GameEvent } from './events';
import { computePending } from './pending';
import { buildInitial } from './setup';
import { END_PHASE_CLEARED, GREEN_TOKENS, hasToken, isIonized } from './tokens';
import type { GameState, Ship, ShipId, Token, TokenKind } from './types';

export const EMPTY_STATE: GameState = {
  id: '',
  rng: { seed: '', cursor: 0 },
  round: 0,
  phase: 'planning',
  players: [],
  ships: [],
  obstacles: [],
  pending: [],
  gameOver: false,
};

function mapShip(state: GameState, id: string, fn: (s: Ship) => Ship): GameState {
  return { ...state, ships: state.ships.map((s) => (s.id === id ? fn(s) : s)) };
}

/** End Phase: remove every circular token (green then orange). Locks and the red
 *  stress/strain/ion tokens have their own timing and survive. */
function roundEndTokens(ship: Ship): Token[] {
  return ship.tokens.filter((t) => !END_PHASE_CLEARED.includes(t.kind));
}

const removeOne = (ship: Ship, kind: TokenKind): Ship => {
  let done = false;
  return {
    ...ship,
    tokens: ship.tokens.filter((t) => (!done && t.kind === kind ? ((done = true), false) : true)),
  };
};

/** Gaining a jam token strips one green token/lock if the ship has one; otherwise
 *  the jam token is held and consumes the next green token the ship gains. */
function gainJam(ship: Ship): Ship {
  const i = ship.tokens.findIndex((t) => GREEN_TOKENS.includes(t.kind));
  if (i >= 0) return { ...ship, tokens: ship.tokens.filter((_, k) => k !== i) };
  return { ...ship, tokens: [...ship.tokens, { kind: 'jam' }] };
}

/** Gaining a green token while jammed: the jam eats it instead, clearing one jam. */
function gainToken(ship: Ship, kind: TokenKind, targetId?: ShipId): Ship {
  if (GREEN_TOKENS.includes(kind) && hasToken(ship, 'jam')) return removeOne(ship, 'jam');
  // a ship may maintain only one lock (the limit is 1 unless a card raises it — later);
  // acquiring a new lock drops the old.
  const base = kind === 'lock' ? ship.tokens.filter((t) => t.kind !== 'lock') : ship.tokens;
  const tokens = [...base, { kind, targetId }];
  // becoming ionised breaks the locks the ship is maintaining
  if (kind === 'ion' && isIonized({ ...ship, tokens }))
    return { ...ship, tokens: tokens.filter((t) => t.kind !== 'lock') };
  return { ...ship, tokens };
}

function changeStress(ship: Ship, delta: number): Ship {
  if (delta >= 0) {
    const add: Token[] = Array.from({ length: delta }, () => ({ kind: 'stress' }));
    return { ...ship, tokens: [...ship.tokens, ...add] };
  }
  let toRemove = -delta;
  const tokens = ship.tokens.filter((t) => {
    if (t.kind === 'stress' && toRemove > 0) {
      toRemove--;
      return false;
    }
    return true;
  });
  return { ...ship, tokens };
}

function applyCore(state: GameState, e: GameEvent): GameState {
  switch (e.type) {
    case 'GameCreated':
      return buildInitial(e.config);
    case 'DialSet':
      return mapShip(state, e.shipId, (s) => ({ ...s, dial: e.maneuver }));
    case 'DialRevealed':
      return mapShip(state, e.shipId, (s) => ({ ...s, dialRevealed: true }));
    case 'ObstacleHit':
      return state; // log/UI marker; the damage/stress follow as their own events
    case 'DeviceDropped': {
      const ship = state.ships.find((s) => s.id === e.shipId)!;
      const device = {
        id: e.deviceId,
        ownerId: ship.ownerId,
        xws: e.xws,
        name: ship.devices?.find((d) => d.xws === e.xws)?.name ?? e.xws,
        kind: e.kind,
        pos: e.pos,
      };
      return mapShip(
        { ...state, devices: [...(state.devices ?? []), device] },
        e.shipId,
        (s) => ({ ...s, hasDropped: true }),
      );
    }
    case 'DropSkipped':
      return mapShip(state, e.shipId, (s) => ({ ...s, hasDropped: true }));
    case 'DeviceDetonated':
      return { ...state, devices: (state.devices ?? []).filter((d) => d.id !== e.deviceId) };
    case 'DamageCardDealt':
      return mapShip(
        { ...state, damageDrawn: (state.damageDrawn ?? 0) + 1 },
        e.shipId,
        (s) => ({ ...s, damageCards: [...(s.damageCards ?? []), e.card] }),
      );
    case 'DamageCardRemoved':
      return mapShip(state, e.shipId, (s) => ({
        ...s,
        damageCards: (s.damageCards ?? []).filter((c) => c.id !== e.cardId),
      }));
    case 'ConditionAssigned':
      return mapShip(state, e.shipId, (s) =>
        (s.conditions ?? []).includes(e.condition)
          ? s
          : { ...s, conditions: [...(s.conditions ?? []), e.condition] },
      );
    case 'ConditionRemoved':
      return mapShip(state, e.shipId, (s) => ({
        ...s,
        conditions: (s.conditions ?? []).filter((c) => c !== e.condition),
      }));
    case 'ShipMoved':
      // a bumped ship keeps its action step but may perform only a red focus
      return mapShip(state, e.shipId, (s) => ({
        ...s,
        pos: e.to,
        hasMoved: true,
        bumped: e.bumped === true,
      }));
    case 'Decloaked':
      return mapShip(state, e.shipId, (s) => ({ ...s, pos: e.to, hasSystemActed: true }));
    case 'DecloakPassed':
      return mapShip(state, e.shipId, (s) => ({ ...s, hasSystemActed: true }));
    case 'StressChanged':
      return mapShip(state, e.shipId, (s) => changeStress(s, e.delta));
    case 'ChargeChanged':
      return mapShip(state, e.shipId, (s) => {
        if (e.source) {
          const pools = { ...(s.upgradeCharges ?? {}) };
          const p = pools[e.source];
          if (p)
            pools[e.source] = { ...p, charges: Math.max(0, Math.min(p.max, p.charges + e.delta)) };
          return { ...s, upgradeCharges: pools };
        }
        return { ...s, charges: Math.max(0, Math.min(s.maxCharges, s.charges + e.delta)) };
      });
    case 'ForceChanged':
      return mapShip(state, e.shipId, (s) => ({
        ...s,
        force: Math.max(0, Math.min(s.maxForce ?? 0, (s.force ?? 0) + e.delta)),
      }));
    case 'ActionPerformed':
    case 'ActionSkipped':
      return mapShip(state, e.shipId, (s) => ({ ...s, hasActed: true }));
    case 'ArcRotated':
      return mapShip(state, e.shipId, (s) => ({ ...s, turretArc: e.to }));
    case 'RepositionOffered':
      return {
        ...state,
        reposition: { shipId: e.shipId, action: e.action, candidates: e.candidates },
      };
    case 'Repositioned':
      return { ...mapShip(state, e.shipId, (s) => ({ ...s, pos: e.to })), reposition: undefined };
    case 'GrantOffered':
      return {
        ...state,
        grantOffer: { granterId: e.granterId, candidates: e.candidates, spendForce: e.spendForce },
      };
    case 'GrantOfferResolved':
      return { ...state, grantOffer: undefined };
    case 'ActionGranted':
      return { ...state, grantedAction: { shipId: e.shipId } };
    case 'GrantResolved':
      return { ...state, grantedAction: undefined };
    case 'LinkOffered':
      return {
        ...state,
        linkedAction: { shipId: e.shipId, action: e.action, difficulty: e.difficulty },
      };
    case 'LinkResolved':
      return { ...state, linkedAction: undefined };
    case 'TokenGained':
      if (e.kind === 'jam') return mapShip(state, e.shipId, gainJam);
      return mapShip(state, e.shipId, (s) => gainToken(s, e.kind, e.targetId));
    case 'AttackDeclared':
      // a bonus attack is extra — it doesn't count as the ship's engagement
      return e.bonus ? state : mapShip(state, e.shipId, (s) => ({ ...s, hasEngaged: true }));
    case 'AttackPassed':
      return mapShip(state, e.shipId, (s) => ({ ...s, hasEngaged: true }));
    case 'BonusAttackOffered':
      return { ...state, bonusAttack: { shipId: e.shipId, targets: e.targets } };
    case 'BonusAttackResolved':
      return { ...state, bonusAttack: undefined };
    case 'TargetOffered':
      return {
        ...state,
        targetSelect: {
          byShip: e.byShip,
          candidates: e.candidates,
          effect: e.effect,
          canSkip: e.canSkip,
        },
      };
    case 'TargetResolved':
      return { ...state, targetSelect: undefined };
    case 'DiceRolled':
      return { ...state, rng: { ...state.rng, cursor: state.rng.cursor + e.faces.length } };
    case 'CombatBegan':
      return {
        ...state,
        combat: {
          attackerId: e.attackerId,
          targetId: e.targetId,
          range: e.range,
          obstructed: e.obstructed,
          attack: e.attack,
          defence: [],
          step: 'attack',
          weaponXws: e.weaponXws,
        },
      };
    case 'CombatDiceSet':
      return state.combat
        ? {
            ...state,
            combat: {
              ...state.combat,
              attack: e.attack ?? state.combat.attack,
              defence: e.defence ?? state.combat.defence,
              changed: e.changed || state.combat.changed,
              usedAbilities: e.usedAbility
                ? [...(state.combat.usedAbilities ?? []), e.usedAbility]
                : state.combat.usedAbilities,
            },
          }
        : state;
    case 'CombatAdvanced':
      return state.combat
        ? { ...state, combat: { ...state.combat, defence: e.defence, step: 'defence' } }
        : state;
    case 'CombatStep':
      return state.combat ? { ...state, combat: { ...state.combat, step: e.step } } : state;
    case 'CombatEnded':
      return { ...state, combat: undefined };
    case 'TokenSpent':
      return mapShip(state, e.shipId, (s) => {
        let removed = false;
        return {
          ...s,
          tokens: s.tokens.filter((t) => {
            if (!removed && t.kind === e.kind && (e.kind !== 'lock' || t.targetId === e.targetId)) {
              removed = true;
              return false;
            }
            return true;
          }),
        };
      });
    case 'DamageDealt':
      return mapShip(state, e.shipId, (s) => ({
        ...s,
        shields: e.shieldsAfter,
        hull: e.hullAfter,
      }));
    case 'ShipDestroyed':
      return mapShip(state, e.shipId, (s) => ({ ...s, hull: 0 }));
    case 'RoundEnded':
      return {
        ...state,
        round: state.round + 1,
        ships: state.ships.map((s) => ({
          ...s,
          tokens: roundEndTokens(s),
          charges: Math.min(s.maxCharges, s.charges + s.recurring),
          force: Math.min(s.maxForce ?? 0, (s.force ?? 0) + (s.forceRecovers ?? 0)),
          upgradeCharges: Object.fromEntries(
            Object.entries(s.upgradeCharges ?? {}).map(([k, p]) => [
              k,
              { ...p, charges: Math.min(p.max, p.charges + p.recovers) },
            ]),
          ),
          dial: undefined,
          dialRevealed: false,
          hasMoved: false,
          hasActed: false,
          hasEngaged: false,
          hasSystemActed: false,
          bumped: false,
        })),
      };
    case 'AbilityOffered':
      return {
        ...state,
        offer: {
          shipId: e.shipId,
          abilityXws: e.abilityXws,
          window: e.window,
          label: e.label,
          attackerId: e.attackerId,
        },
      };
    case 'AbilityResolved': {
      const w = state.offer?.window;
      const sid = state.offer?.shipId;
      const done =
        (w === 'onSystemPhase' || w === 'onEngagementStart') && sid
          ? [...(state.phaseAbilitiesDone ?? []), sid]
          : state.phaseAbilitiesDone;
      return { ...state, offer: undefined, phaseAbilitiesDone: done };
    }
    case 'PhaseAdvanced': {
      const next = { ...state, phase: e.to, phaseAbilitiesDone: [] };
      // the drop window reopens at the start of the System and Activation phases
      if (e.to === 'system' || e.to === 'activation')
        next.ships = next.ships.map((s) => (s.hasDropped ? { ...s, hasDropped: false } : s));
      return next;
    }
  }
}

/** A side is wiped once it has no ships with hull remaining. */
function isGameOver(s: GameState): boolean {
  if (s.round < 1 || s.players.length === 0) return false;
  return s.players.some((p) => !s.ships.some((sh) => sh.ownerId === p.id && sh.hull > 0));
}

/** Pure fold. Recomputes win state and pending after every event. */
export function applyEvent(state: GameState, e: GameEvent): GameState {
  const next = { ...applyCore(state, e) };
  next.gameOver = isGameOver(next);
  next.pending = computePending(next);
  return next;
}
