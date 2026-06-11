import type { GameConfig, Player, Position } from '@xwing/engine';
import { squadToShipInits, type XwsSquad } from './xws';

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

/** Build a ready-to-play engine config from a preset matchup. */
export function presetConfig(preset: Preset, seed: string, id = 'game'): GameConfig {
  const players: Player[] = [
    { id: 'rebel', name: 'Rebel' },
    { id: 'imperial', name: 'Imperial' },
  ];
  return {
    id,
    seed,
    players,
    ships: [
      ...squadToShipInits(preset.rebel, 'rebel', layout(preset.rebel.pilots.length, 'rebel')),
      ...squadToShipInits(
        preset.imperial,
        'imperial',
        layout(preset.imperial.pilots.length, 'imperial'),
      ),
    ],
  };
}
