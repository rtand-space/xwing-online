import meta from './generated/meta.json';

/** Pins the game to the xwing-data2 snapshot it was built from. */
export const DATA_VERSION = `xwing-data2@${meta.commit}`;
export const DATA_META = meta;

export type { ActionData, PilotData, ShipData, Stat, UpgradeData } from './types';
export { allShips, allUpgrades, getPilot, getShip, upgradesForSlot } from './loaders';
export { parseDial, parseManeuver } from './dial';
export { toShipInit } from './build';
export { parseXws, serializeXws, squadToShipInits } from './xws';
export type { XwsPilot, XwsSquad } from './xws';
export {
  buildConfig,
  FACTIONS,
  FACTION_IDS,
  PRESETS,
  presetConfig,
  pilotChoices,
  sideShipInits,
  XWS_FACTION,
} from './presets';
export type { FactionId, PilotChoice, Preset, Side } from './presets';
export { MAX_SHIPS, MIN_SHIPS, SQUAD_POINT_CAP, squadPoints, validateSquad } from './squad';
export type { SquadValidation } from './squad';
