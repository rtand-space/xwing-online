import { applyEvent, EMPTY_STATE } from './apply';
import type { Command } from './commands';
import type { GameConfig, GameEvent } from './events';
import { reduce, settle } from './reduce';
import type { GameState } from './types';

/** Convenience pairing of folded state with its source-of-truth log. */
export interface Game {
  state: GameState;
  log: GameEvent[];
}

export function createGame(config: GameConfig): Game {
  const created: GameEvent = { type: 'GameCreated', config };
  let state = applyEvent(EMPTY_STATE, created);
  // settle the start-of-game cascade so setup-window abilities are offered
  const log: GameEvent[] = [created];
  for (const e of settle(state)) {
    log.push(e);
    state = applyEvent(state, e);
  }
  return { state, log };
}

export function dispatch(game: Game, cmd: Command): { game: Game; rejection?: string } {
  const { events, rejection } = reduce(game.state, cmd);
  if (rejection) return { game, rejection };
  let state = game.state;
  for (const e of events) state = applyEvent(state, e);
  return { game: { state, log: [...game.log, ...events] } };
}

/** Fold a complete log back to state — replays never re-run RNG. */
export function replay(log: GameEvent[]): GameState {
  return log.reduce(applyEvent, EMPTY_STATE);
}
