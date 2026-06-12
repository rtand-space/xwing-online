import meta from './generated/meta.json';

export { abilityNote, implementedAbility, installAbilities } from './abilities';

/** Pins the game to the points revision it was built from (cards: xwing-data2). */
export const DATA_VERSION = meta.points;
export const DATA_META = meta;

export type { ActionData, PilotData, ShipData, Stat, UpgradeData } from './types';
export { allShips, allUpgrades, getPilot, getShip, getUpgrade, upgradesForSlot } from './loaders';
export { parseDial, parseManeuver } from './dial';
export { toShipInit } from './build';
export { parseXws, serializeXws, squadToShipInits } from './xws';
export type { XwsPilot, XwsSquad } from './xws';
export {
  buildConfig,
  FACTIONS,
  FACTION_IDS,
  obstacleValidity,
  placementOk,
  PRESETS,
  presetConfig,
  pilotChoices,
  randomObstacles,
  sideShipInits,
  XWS_FACTION,
} from './presets';
export type { FactionId, PilotChoice, Preset, Side } from './presets';
export {
  MAX_SHIPS,
  MIN_SHIPS,
  slotKey,
  SQUAD_POINT_CAP,
  squadPoints,
  upgradeCost,
  upgradeOptions,
  validateSquad,
} from './squad';
export type { SquadValidation } from './squad';
