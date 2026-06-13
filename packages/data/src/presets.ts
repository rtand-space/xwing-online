import type { GameConfig, Obstacle, ObstacleKind, Player, Position, ShipInit } from '@xwing/engine';
import { rngAt } from '@xwing/engine';
import { allShips } from './loaders';
import { squadToShipInits, type XwsSquad } from './xws';

// Placement bounds: the mat is ±498mm; obstacles stay beyond range 2 (200mm) of
// each edge and beyond range 1 (100mm, edge-to-edge) of each other.
const FIELD_HALF = 498;
const EDGE_KEEPOUT = 200;
const OBSTACLE_KINDS: ObstacleKind[] = [
  'asteroid',
  'asteroid',
  'asteroid',
  'debris',
  'debris',
  'debris',
];
const radiusFor = (k: ObstacleKind): number => (k === 'asteroid' ? 28 : 30);
const tooClose = (a: Obstacle, b: Obstacle): boolean =>
  Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y) <= 100 + a.radius + b.radius;

/** A legal 6-obstacle scatter (3 asteroids, 3 debris) seeded for determinism. */
export function randomObstacles(seed: string): Obstacle[] {
  const out: Obstacle[] = [];
  let n = 0;
  for (let i = 0; i < OBSTACLE_KINDS.length; i++) {
    const kind = OBSTACLE_KINDS[i]!;
    const radius = radiusFor(kind);
    const lim = FIELD_HALF - EDGE_KEEPOUT - radius;
    let pos: Position = { x: (i - 2.5) * 110, y: 0, angle: 0 };
    for (let t = 0; t < 300; t++) {
      const cand: Obstacle = {
        id: `obs-${i + 1}`,
        kind,
        radius,
        pos: {
          x: (rngAt(seed, n++) * 2 - 1) * lim,
          y: (rngAt(seed, n++) * 2 - 1) * lim,
          angle: Math.floor(rngAt(seed, n++) * 360),
        },
      };
      if (out.every((o) => !tooClose(o, cand))) {
        pos = cand.pos;
        break;
      }
    }
    out.push({ id: `obs-${i + 1}`, kind, radius, pos });
  }
  return out;
}

/** Per-obstacle legality (within bounds and not too close to another). */
export function obstacleValidity(obstacles: Obstacle[]): Record<string, boolean> {
  const v: Record<string, boolean> = {};
  for (const o of obstacles) {
    const lim = FIELD_HALF - EDGE_KEEPOUT - o.radius;
    v[o.id] =
      Math.abs(o.pos.x) <= lim &&
      Math.abs(o.pos.y) <= lim &&
      obstacles.every((p) => p.id === o.id || !tooClose(o, p));
  }
  return v;
}

export const placementOk = (obstacles: Obstacle[]): boolean =>
  obstacles.length > 0 && Object.values(obstacleValidity(obstacles)).every(Boolean);

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
  /** Short tag for scenario/alt-art reprints sharing a name, e.g. "BoY"; else undefined. */
  variant?: string;
}

const VARIANT_TAGS: Record<string, string> = {
  battleofyavin: 'BoY',
  battleoverendor: 'BoE',
  siegeofcoruscant: 'SoC',
  evacuationofdqar: 'Evac',
  armedanddangerous: 'A&D',
  legendsandrelics: 'L&R',
  wartime: 'Wartime',
};

/** A short reprint tag for a pilot xws (BoY etc., or a SWZ set code), or undefined. */
export function pilotVariant(xws: string): string | undefined {
  for (const t of xws.split('-')) {
    if (VARIANT_TAGS[t]) return VARIANT_TAGS[t];
    if (/^swz\d+$/.test(t)) return t.toUpperCase();
  }
  return undefined;
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
        variant: pilotVariant(p.xws),
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
  obstacles: Obstacle[] = randomObstacles(seed),
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
    obstacles,
  };
}

export function presetConfig(preset: Preset, seed: string, id = 'game'): GameConfig {
  return buildConfig(preset.rebel, preset.imperial, seed, id);
}

/** One squad → one side's ship inits, laid out for that side (for online assembly). */
export function sideShipInits(squad: XwsSquad, side: Side): ShipInit[] {
  return squadToShipInits(squad, side, layout(squad.pilots.length, side));
}
