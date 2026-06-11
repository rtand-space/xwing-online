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
    case 'ShipMoved':
      return mapShip(state, e.shipId, (s) => ({ ...s, pos: e.to, hasMoved: true }));
    case 'StressChanged':
      return mapShip(state, e.shipId, (s) => changeStress(s, e.delta));
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
    case 'RoundEnded':
      return {
        ...state,
        round: state.round + 1,
        ships: state.ships.map((s) => ({
          ...withoutTokens(s, ['focus', 'evade']),
          dial: undefined,
          dialRevealed: false,
          hasMoved: false,
          hasActed: false,
          hasEngaged: false,
        })),
      };
    case 'PhaseAdvanced':
      return { ...state, phase: e.to };
  }
}

/** Pure fold. Recomputes pending after every event (the doc's "who owes what"). */
export function applyEvent(state: GameState, e: GameEvent): GameState {
  const next = applyCore(state, e);
  return { ...next, pending: computePending(next) };
}
