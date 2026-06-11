import type { GameState, PlayerId } from './types';

/** Same shape as GameState, but redacted for one recipient. */
export type PlayerView = GameState;

/** Redact opponents' unrevealed dials and show only the viewer's pending decisions. */
export function projectView(state: GameState, viewerId: PlayerId): PlayerView {
  return {
    ...state,
    ships: state.ships.map((s) =>
      s.ownerId === viewerId || s.dialRevealed ? s : { ...s, dial: undefined },
    ),
    pending: state.pending.filter((p) => p.playerId === viewerId),
  };
}
