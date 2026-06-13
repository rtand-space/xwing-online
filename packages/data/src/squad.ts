import { getPilot, getShip, getUpgrade, pilotFaction, upgradesForSlot } from './loaders';
import { FACTIONS, XWS_FACTION, type FactionId } from './presets';
import type { UpgradeData } from './types';
import type { XwsSquad } from './xws';

export const SQUAD_POINT_CAP = 50;
export const MIN_SHIPS = 3;
export const MAX_SHIPS = 8;

/** Slot display name → XWS slot key, e.g. "Force Power" → "forcepower". */
export const slotKey = (slot: string): string => slot.toLowerCase().replace(/[^a-z]/g, '');

const FACTION_XWS_BY_NAME: Record<string, string> = Object.fromEntries(
  (Object.keys(FACTIONS) as FactionId[]).map((id) => [FACTIONS[id], XWS_FACTION[id]]),
);

/** Loadout cost of an upgrade ("?" / unset costs count as 0). */
export const upgradeCost = (xws: string): number => getUpgrade(xws).cost ?? 0;

interface Restriction {
  factions?: string[];
  ships?: string[];
  sizes?: string[];
}

/**
 * Upgrades that legally equip into `slot` on `shipXws` — v1 enforces faction,
 * ship, and size restrictions on single-slot upgrades; other restriction types
 * (arcs, actions, keywords, …) are deferred.
 */
export function upgradeOptions(slot: string, shipXws: string): UpgradeData[] {
  const ship = getShip(shipXws);
  const facXws = FACTION_XWS_BY_NAME[ship.faction] ?? '';
  const size = ship.size.toLowerCase();
  return upgradesForSlot(slot).filter((u) => {
    if (!u.available) return false; // quick-build-only / non-XWA cards aren't buyable
    if (u.slots.length !== 1) return false;
    return (u.restrictions as Restriction[]).every((r) => {
      if (r.factions && !r.factions.includes(facXws)) return false;
      if (r.ships && !r.ships.includes(shipXws)) return false;
      if (r.sizes && !r.sizes.includes(size)) return false;
      return true;
    });
  });
}

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
  const upgradeCounts: Record<string, number> = {};
  let points = 0;
  for (const p of squad.pilots) {
    let pilot;
    try {
      pilot = getPilot(p.ship, p.id);
      factions.add(pilotFaction(p.ship, p.id));
    } catch (e) {
      errors.push((e as Error).message);
      continue;
    }
    points += pilot.cost;
    counts[p.id] = (counts[p.id] ?? 0) + 1;
    if (pilot.limited > 0 && counts[p.id]! > pilot.limited) {
      errors.push(`${pilot.name}: limited to ${pilot.limited} per squad.`);
    }

    let used = 0;
    for (const x of Object.values(p.upgrades ?? {}).flat()) {
      try {
        const u = getUpgrade(x);
        used += u.cost ?? 0;
        upgradeCounts[x] = (upgradeCounts[x] ?? 0) + 1;
        if (u.limited > 0 && upgradeCounts[x]! > u.limited) {
          errors.push(`${u.name}: limited to ${u.limited} per squad.`);
        }
      } catch (e) {
        errors.push((e as Error).message);
      }
    }
    if (used > pilot.loadout) {
      errors.push(`${pilot.name}: loadout ${used}/${pilot.loadout} over budget.`);
    }
  }

  if (factions.size > 1) errors.push('All ships must be from one faction.');
  if (points > SQUAD_POINT_CAP) errors.push(`Over the ${SQUAD_POINT_CAP}-point cap (${points}).`);

  // de-dupe (a limited pilot over its cap pushes once per extra copy above)
  const unique = [...new Set(errors)];
  return { valid: unique.length === 0, errors: unique, points };
}
