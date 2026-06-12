import shipsData from './generated/ships.json';
import upgradesData from './generated/upgrades.json';
import type { PilotData, ShipData, UpgradeData } from './types';

const SHIPS = shipsData as unknown as ShipData[];

export function allShips(): ShipData[] {
  return SHIPS;
}

// Some hulls appear once per faction (faction-specific pilot lists). Stats/dial
// are faction-agnostic, so getShip returns the first entry; getPilot scans them all.
const byXws = new Map<string, ShipData>();
for (const s of SHIPS) if (!byXws.has(s.xws)) byXws.set(s.xws, s);

export function getShip(xws: string): ShipData {
  const ship = byXws.get(xws);
  if (!ship) throw new Error(`Unknown ship: ${xws}`);
  return ship;
}

export function getPilot(shipXws: string, pilotXws: string): PilotData {
  for (const s of SHIPS) {
    if (s.xws !== shipXws) continue;
    const pilot = s.pilots.find((p) => p.xws === pilotXws);
    if (pilot) return pilot;
  }
  throw new Error(`Unknown pilot ${pilotXws} on ${shipXws}`);
}

const UPGRADES = upgradesData as unknown as UpgradeData[];

export function allUpgrades(): UpgradeData[] {
  return UPGRADES;
}

/** Upgrades that can equip into the given slot. */
export function upgradesForSlot(slot: string): UpgradeData[] {
  return UPGRADES.filter((u) => u.slots.includes(slot));
}
