import rz1awing from './cards/rz1awing.json';
import t65xwing from './cards/t65xwing.json';
import tieinterceptor from './cards/tieinterceptor.json';
import tieln from './cards/tieln.json';
import type { PilotData, ShipData } from './types';

const SHIPS: ShipData[] = [t65xwing, tieln, rz1awing, tieinterceptor].map(
  (s) => s as unknown as ShipData,
);
const byXws = new Map(SHIPS.map((s) => [s.xws, s]));

export function allShips(): ShipData[] {
  return SHIPS;
}

export function getShip(xws: string): ShipData {
  const ship = byXws.get(xws);
  if (!ship) throw new Error(`Unknown ship: ${xws}`);
  return ship;
}

export function getPilot(shipXws: string, pilotXws: string): PilotData {
  const pilot = getShip(shipXws).pilots.find((p) => p.xws === pilotXws);
  if (!pilot) throw new Error(`Unknown pilot ${pilotXws} on ${shipXws}`);
  return pilot;
}
