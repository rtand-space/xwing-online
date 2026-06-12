import { installAbilities } from '@xwing/data';
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

// Register card abilities into the engine registry before any game is built/replayed.
installAbilities();

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

/** The player who now owes the next decision (for "your turn" notifications). */
export function pendingPlayer(log: GameEvent[]): string | null {
  return replay(log).pending[0]?.playerId ?? null;
}

/** Log safe to share with both players — drops the only private event (a set dial). */
export function publicLog(log: GameEvent[]): GameEvent[] {
  return log.filter((e) => e.type !== 'DialSet');
}
