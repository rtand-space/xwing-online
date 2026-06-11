import type { Position, ShipInit } from '@xwing/engine';
import { toShipInit } from './build';

/** The XWS squad interchange format (https://github.com/elistevens/xws-spec). */
export interface XwsPilot {
  id: string;
  ship: string;
  points?: number;
  upgrades?: Record<string, string[]>;
}

export interface XwsSquad {
  faction: string;
  name?: string;
  points?: number;
  version?: string;
  vendor?: unknown;
  pilots: XwsPilot[];
}

export function parseXws(input: string | unknown): XwsSquad {
  const obj: unknown = typeof input === 'string' ? JSON.parse(input) : input;
  if (!obj || typeof obj !== 'object') throw new Error('Invalid XWS: not an object');
  const squad = obj as XwsSquad;
  if (typeof squad.faction !== 'string' || !Array.isArray(squad.pilots)) {
    throw new Error('Invalid XWS: missing faction or pilots');
  }
  return squad;
}

export function serializeXws(squad: XwsSquad): string {
  return JSON.stringify(squad);
}

/** Turn a parsed squad into engine ship inits, one per pilot, at the given positions. */
export function squadToShipInits(
  squad: XwsSquad,
  ownerId: string,
  positions: Position[],
): ShipInit[] {
  return squad.pilots.map((p, i) =>
    toShipInit(
      p.ship,
      p.id,
      ownerId,
      positions[i] ?? { x: 0, y: 0, angle: 0 },
      `${ownerId}-${i + 1}`,
    ),
  );
}
