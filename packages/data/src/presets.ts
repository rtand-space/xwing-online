import type { GameConfig, Player, Position } from '@xwing/engine';
import { allShips } from './loaders';
import { squadToShipInits, type XwsSquad } from './xws';

/** Faction names as they appear in the card data, keyed by XWS side id. */
export const FACTIONS = { rebel: 'Rebel Alliance', imperial: 'Galactic Empire' } as const;
export const XWS_FACTION = { rebel: 'rebelalliance', imperial: 'galacticempire' } as const;

export interface PilotChoice {
  shipXws: string;
  shipName: string;
  pilotXws: string;
  pilotName: string;
  initiative: number;
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
    { id: 'academypilot', ship: 'tieln' },
    { id: 'academypilot', ship: 'tieln' },
    { id: 'obsidiansquadronpilot', ship: 'tieln' },
  ],
};

const twoTies: XwsSquad = {
  faction: 'galacticempire',
  name: 'TIE Patrol',
  pilots: [
    { id: 'academypilot', ship: 'tieln' },
    { id: 'obsidiansquadronpilot', ship: 'tieln' },
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
  };
}

export function presetConfig(preset: Preset, seed: string, id = 'game'): GameConfig {
  return buildConfig(preset.rebel, preset.imperial, seed, id);
}
