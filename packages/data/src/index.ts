export const DATA_VERSION = '0.0.0';

export type { ActionData, PilotData, ShipData, Stat } from './types';
export { allShips, getPilot, getShip } from './loaders';
export { parseDial, parseManeuver } from './dial';
export { toShipInit } from './build';
export { parseXws, serializeXws, squadToShipInits } from './xws';
export type { XwsPilot, XwsSquad } from './xws';
export {
  buildConfig,
  FACTIONS,
  PRESETS,
  presetConfig,
  pilotChoices,
  sideShipInits,
  XWS_FACTION,
} from './presets';
export type { PilotChoice, Preset, Side } from './presets';
export { MAX_SHIPS, MIN_SHIPS, SQUAD_POINT_CAP, squadPoints, validateSquad } from './squad';
export type { SquadValidation } from './squad';
