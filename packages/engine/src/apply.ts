import type { GameEvent } from './events';
import { computePending } from './pending';
import { buildInitial } from './setup';
import type { GameState, Ship, Token, TokenKind } from './types';

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

function withoutTokens(ship: Ship, kinds: TokenKind[]): Ship {
  return { ...ship, tokens: ship.tokens.filter((t) => !kinds.includes(t.kind)) };
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
    case 'ShipMoved':
      // a bumped ship forfeits its action
      return mapShip(state, e.shipId, (s) => ({
        ...s,
        pos: e.to,
        hasMoved: true,
        hasActed: s.hasActed || e.bumped === true,
      }));
    case 'StressChanged':
      return mapShip(state, e.shipId, (s) => changeStress(s, e.delta));
    case 'ChargeChanged':
      return mapShip(state, e.shipId, (s) => ({
        ...s,
        charges: Math.max(0, Math.min(s.maxCharges, s.charges + e.delta)),
      }));
    case 'ForceChanged':
      return mapShip(state, e.shipId, (s) => ({
        ...s,
        force: Math.max(0, Math.min(s.maxForce ?? 0, (s.force ?? 0) + e.delta)),
      }));
    case 'ActionPerformed':
    case 'ActionSkipped':
      return mapShip(state, e.shipId, (s) => ({ ...s, hasActed: true }));
    case 'TokenGained':
      return mapShip(state, e.shipId, (s) => ({
        ...s,
        tokens: [...s.tokens, { kind: e.kind, targetId: e.targetId }],
      }));
    case 'AttackDeclared':
    case 'AttackPassed':
      return mapShip(state, e.shipId, (s) => ({ ...s, hasEngaged: true }));
    case 'DiceRolled':
      return { ...state, rng: { ...state.rng, cursor: state.rng.cursor + e.faces.length } };
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
          ...withoutTokens(s, ['focus', 'evade', 'calculate', 'reinforce']),
          charges: Math.min(s.maxCharges, s.charges + s.recurring),
          force: Math.min(s.maxForce ?? 0, (s.force ?? 0) + (s.forceRecovers ?? 0)),
          dial: undefined,
          dialRevealed: false,
          hasMoved: false,
          hasActed: false,
          hasEngaged: false,
        })),
      };
    case 'AbilityOffered':
      return {
        ...state,
        offer: { shipId: e.shipId, abilityXws: e.abilityXws, window: e.window, label: e.label },
      };
    case 'AbilityResolved':
      return { ...state, offer: undefined };
    case 'PhaseAdvanced':
      return { ...state, phase: e.to };
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
