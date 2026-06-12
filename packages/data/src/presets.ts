import type { GameConfig, Obstacle, Player, Position, ShipInit } from '@xwing/engine';
import { allShips } from './loaders';
import { squadToShipInits, type XwsSquad } from './xws';

/** A standard scatter of obstacles in the central band (ships set up at y = ±150). */
export const STANDARD_OBSTACLES: Obstacle[] = [
  { id: 'ast-1', kind: 'asteroid', pos: { x: -170, y: -30, angle: 20 }, radius: 28 },
  { id: 'ast-2', kind: 'asteroid', pos: { x: 150, y: 40, angle: -35 }, radius: 28 },
  { id: 'deb-1', kind: 'debris', pos: { x: 0, y: 0, angle: 0 }, radius: 30 },
  { id: 'ast-3', kind: 'asteroid', pos: { x: 40, y: -90, angle: 60 }, radius: 26 },
  { id: 'deb-2', kind: 'debris', pos: { x: -60, y: 95, angle: -15 }, radius: 30 },
];

/** Board seats (player ids). Faction is chosen separately and baked into each ShipInit. */
export type Side = 'rebel' | 'imperial';

export type FactionId =
  | 'rebel'
  | 'imperial'
  | 'scum'
  | 'republic'
  | 'separatist'
  | 'resistance'
  | 'firstorder';

/** Display names as they appear in the card data, keyed by faction id. */
export const FACTIONS: Record<FactionId, string> = {
  rebel: 'Rebel Alliance',
  imperial: 'Galactic Empire',
  scum: 'Scum and Villainy',
  republic: 'Galactic Republic',
  separatist: 'Separatist Alliance',
  resistance: 'Resistance',
  firstorder: 'First Order',
};
export const XWS_FACTION: Record<FactionId, string> = {
  rebel: 'rebelalliance',
  imperial: 'galacticempire',
  scum: 'scumandvillainy',
  republic: 'galacticrepublic',
  separatist: 'separatistalliance',
  resistance: 'resistance',
  firstorder: 'firstorder',
};
export const FACTION_IDS: FactionId[] = [
  'rebel',
  'imperial',
  'scum',
  'republic',
  'separatist',
  'resistance',
  'firstorder',
];

export interface PilotChoice {
  shipXws: string;
  shipName: string;
  pilotXws: string;
  pilotName: string;
  initiative: number;
  cost: number;
  loadout: number;
  slots: string[];
  faction: string;
}

/** Flat list of selectable pilots, optionally filtered to one faction. */
export function pilotChoices(faction?: string): PilotChoice[] {
  const out: PilotChoice[] = [];
  for (const ship of allShips()) {
    if (faction && ship.faction !== faction) continue;
    for (const p of ship.pilots) {
      out.push({
        shipXws: ship.xws,
        shipName: ship.name,
        pilotXws: p.xws,
        pilotName: p.name,
        initiative: p.initiative,
        cost: p.cost,
        loadout: p.loadout,
        slots: p.slots,
        faction: ship.faction,
      });
    }
  }
  return out;
}

const twoXwings: XwsSquad = {
  faction: 'rebelalliance',
  name: 'Rogue Pair',
  pilots: [
    { id: 'bluesquadronescort', ship: 't65xwing' },
    { id: 'redsquadronveteran', ship: 't65xwing' },
  ],
};

const threeTies: XwsSquad = {
  faction: 'galacticempire',
  name: 'TIE Swarm',
  pilots: [
    { id: 'academypilot', ship: 'tielnfighter' },
    { id: 'academypilot', ship: 'tielnfighter' },
    { id: 'obsidiansquadronpilot', ship: 'tielnfighter' },
  ],
};

const twoTies: XwsSquad = {
  faction: 'galacticempire',
  name: 'TIE Patrol',
  pilots: [
    { id: 'academypilot', ship: 'tielnfighter' },
    { id: 'obsidiansquadronpilot', ship: 'tielnfighter' },
  ],
};

export interface Preset {
  id: string;
  name: string;
  description: string;
  rebel: XwsSquad;
  imperial: XwsSquad;
}

export const PRESETS: Preset[] = [
  {
    id: 'classic',
    name: 'Classic Duel',
    description: '2 X-wings vs 3 TIE fighters — the iconic tanky-vs-swarm matchup.',
    rebel: twoXwings,
    imperial: threeTies,
  },
  {
    id: 'skirmish',
    name: 'Skirmish',
    description: '2 X-wings vs 2 TIE fighters — a quick, even dogfight.',
    rebel: twoXwings,
    imperial: twoTies,
  },
];

/** Place a side's ships in a row, facing the centre. */
function layout(count: number, side: 'rebel' | 'imperial'): Position[] {
  const spacing = 130;
  const offset = (count - 1) / 2;
  const y = side === 'rebel' ? -150 : 150;
  const angle = side === 'rebel' ? 0 : 180;
  return Array.from({ length: count }, (_, i) => ({ x: (i - offset) * spacing, y, angle }));
}

/** Build a ready-to-play engine config from two squads. */
export function buildConfig(
  rebel: XwsSquad,
  imperial: XwsSquad,
  seed: string,
  id = 'game',
): GameConfig {
  const players: Player[] = [
    { id: 'rebel', name: 'Rebel' },
    { id: 'imperial', name: 'Imperial' },
  ];
  return {
    id,
    seed,
    players,
    ships: [
      ...squadToShipInits(rebel, 'rebel', layout(rebel.pilots.length, 'rebel')),
      ...squadToShipInits(imperial, 'imperial', layout(imperial.pilots.length, 'imperial')),
    ],
    obstacles: STANDARD_OBSTACLES,
  };
}

export function presetConfig(preset: Preset, seed: string, id = 'game'): GameConfig {
  return buildConfig(preset.rebel, preset.imperial, seed, id);
}

/** One squad → one side's ship inits, laid out for that side (for online assembly). */
export function sideShipInits(squad: XwsSquad, side: Side): ShipInit[] {
  return squadToShipInits(squad, side, layout(squad.pilots.length, side));
}
