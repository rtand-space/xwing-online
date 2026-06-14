import { buildDamageDeck } from './damage';
import type { GameConfig, ShipInit } from './events';
import type { GameState, Ship } from './types';

function initShip(init: ShipInit): Ship {
  const maxCharges = init.maxCharges ?? 0;
  const maxForce = init.maxForce ?? 0;
  return {
    ...init,
    upgrades: init.upgrades ?? [],
    maxHull: init.hull,
    maxShields: init.shields,
    maxCharges,
    charges: init.charges ?? maxCharges,
    recurring: init.recurring ?? 0,
    maxForce,
    force: init.force ?? maxForce,
    forceRecovers: init.forceRecovers ?? 0,
    upgradeCharges: init.upgradeCharges ?? {},
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
    damageDeck: buildDamageDeck(config.seed),
    damageDrawn: 0,
    pending: [],
    gameOver: false,
  };
}
