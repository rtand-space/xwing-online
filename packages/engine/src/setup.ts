import type { GameConfig, ShipInit } from './events';
import type { GameState, Ship } from './types';

function initShip(init: ShipInit): Ship {
  return {
    ...init,
    upgrades: init.upgrades ?? [],
    maxHull: init.hull,
    maxShields: init.shields,
    tokens: [],
    dialRevealed: false,
    hasMoved: false,
    hasActed: false,
    hasEngaged: false,
  };
}

/** Build the round-1 Planning state from a config. Pending is filled by applyEvent. */
export function buildInitial(config: GameConfig): GameState {
  return {
    id: config.id,
    rng: { seed: config.seed, cursor: 0 },
    round: 1,
    phase: 'planning',
    players: config.players,
    ships: config.ships.map(initShip),
    obstacles: config.obstacles ?? [],
    pending: [],
    gameOver: false,
  };
}
