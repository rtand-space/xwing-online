import type { GameEvent } from './events';
import type { GameState } from './types';

/**
 * The phase FSM's automatic transitions: emitted whenever no one owes input.
 * Within-phase progression (next ship to move/shoot) is derived by computePending,
 * so only phase boundaries need explicit events here.
 */
export function autoStep(state: GameState): GameEvent[] | null {
  if (state.gameOver || state.pending.length > 0) return null;
  switch (state.phase) {
    case 'planning':
      return [{ type: 'PhaseAdvanced', to: 'system' }];
    case 'system':
      return [{ type: 'PhaseAdvanced', to: 'activation' }];
    case 'activation':
      return [{ type: 'PhaseAdvanced', to: 'engagement' }];
    case 'engagement':
      return [{ type: 'PhaseAdvanced', to: 'end' }];
    case 'end':
      return [{ type: 'RoundEnded' }, { type: 'PhaseAdvanced', to: 'planning' }];
  }
}
