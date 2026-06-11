import { getPilot, getShip } from './loaders';
import type { XwsSquad } from './xws';

export const SQUAD_POINT_CAP = 20;
export const MIN_SHIPS = 3;
export const MAX_SHIPS = 8;

export interface SquadValidation {
  valid: boolean;
  errors: string[];
  /** Total squad-point cost; unspent points are handed to the opponent (deficit scoring). */
  points: number;
}

/** Total squad-point cost (fixed per pilot, never varies with upgrades). */
export function squadPoints(squad: XwsSquad): number {
  return squad.pilots.reduce((sum, p) => sum + getPilot(p.ship, p.id).cost, 0);
}

/** Validate an XWA squad: single faction, 3–8 ships, ≤20 points, limited rules. */
export function validateSquad(squad: XwsSquad): SquadValidation {
  const errors: string[] = [];
  const n = squad.pilots.length;
  if (n < MIN_SHIPS) errors.push(`Need at least ${MIN_SHIPS} ships (have ${n}).`);
  if (n > MAX_SHIPS) errors.push(`At most ${MAX_SHIPS} ships (have ${n}).`);

  const factions = new Set<string>();
  const counts: Record<string, number> = {};
  let points = 0;
  for (const p of squad.pilots) {
    let pilot;
    try {
      factions.add(getShip(p.ship).faction);
      pilot = getPilot(p.ship, p.id);
    } catch (e) {
      errors.push((e as Error).message);
      continue;
    }
    points += pilot.cost;
    counts[p.id] = (counts[p.id] ?? 0) + 1;
    if (pilot.limited > 0 && counts[p.id]! > pilot.limited) {
      errors.push(`${pilot.name}: limited to ${pilot.limited} per squad.`);
    }
  }

  if (factions.size > 1) errors.push('All ships must be from one faction.');
  if (points > SQUAD_POINT_CAP) errors.push(`Over the ${SQUAD_POINT_CAP}-point cap (${points}).`);

  // de-dupe (a limited pilot over its cap pushes once per extra copy above)
  const unique = [...new Set(errors)];
  return { valid: unique.length === 0, errors: unique, points };
}
