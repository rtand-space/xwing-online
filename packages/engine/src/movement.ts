import { basePolygon, polygonsOverlap } from './geometry';
import { pathAt } from './templates';
import type { GameState, Maneuver, Position, Ship } from './types';

/** Would `ship` placed at `pos` overlap any other living ship? */
export function collides(state: GameState, ship: Ship, pos: Position): boolean {
  const poly = basePolygon(pos, ship.base);
  return state.ships.some(
    (o) => o.id !== ship.id && o.hull > 0 && polygonsOverlap(poly, basePolygon(o.pos, o.base)),
  );
}

export interface MovementResult {
  to: Position;
  /** True if the ship overlapped and had to back off — its action is forfeited. */
  bumped: boolean;
}

/** Execute a maneuver, backing off along the template if it would overlap a ship. */
export function resolveMovement(state: GameState, ship: Ship, m: Maneuver): MovementResult {
  const full = pathAt(ship.pos, m, 1, ship.base);
  if (!collides(state, ship, full)) return { to: full, bumped: false };
  for (let t = 0.95; t > 0; t -= 0.05) {
    const p = pathAt(ship.pos, m, t, ship.base);
    if (!collides(state, ship, p)) return { to: p, bumped: true };
  }
  return { to: ship.pos, bumped: true };
}
