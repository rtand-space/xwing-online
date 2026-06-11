export const DATA_VERSION = '0.0.0';

export type { ActionData, PilotData, ShipData, Stat } from './types';
export { allShips, getPilot, getShip } from './loaders';
export { parseDial, parseManeuver } from './dial';
export { toShipInit } from './build';
export { parseXws, serializeXws, squadToShipInits } from './xws';
export type { XwsPilot, XwsSquad } from './xws';
export { PRESETS, presetConfig } from './presets';
export type { Preset } from './presets';
