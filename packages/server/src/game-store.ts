import {
  type Command,
  createGame,
  dispatch,
  type GameConfig,
  type GameEvent,
  type PlayerView,
  projectView,
  replay,
} from '@xwing/engine';

/**
 * Pure server-side game operations on an event log. The Durable Object is a thin
 * wrapper that persists the log returned here; all rules logic stays in the engine.
 */

export function createLog(config: GameConfig): GameEvent[] {
  return createGame(config).log;
}

/** Validate a command against the authoritative log and append its events. */
export function applyCommand(
  log: GameEvent[],
  command: Command,
): { log: GameEvent[]; rejection?: string } {
  const { game, rejection } = dispatch({ state: replay(log), log }, command);
  return rejection ? { log, rejection } : { log: game.log };
}

/** Redacted view for one recipient — opponents' unrevealed dials are stripped. */
export function viewFromLog(log: GameEvent[], viewerId: string): PlayerView {
  return projectView(replay(log), viewerId);
}
