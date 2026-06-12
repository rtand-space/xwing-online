// Generates the committed xwing-data2 snapshot consumed by @xwing/data.
//
// Source: a xwing-data2 checkout (https://github.com/guidokessels/xwing-data2).
//   git clone --depth 1 --filter=blob:none --sparse https://github.com/guidokessels/xwing-data2.git
//   cd xwing-data2 && git sparse-checkout set data
// Then, from the repo root:  XWING_DATA2=/path/to/xwing-data2 node packages/data/scripts/generate.mjs
//
// Emits packages/data/src/generated/{ships,upgrades,meta}.json. Images and raw
// dataset are NOT vendored — only the fields the game needs. Huge ships and any
// ship without a maneuver dial are skipped (no engine support yet).

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = process.env.XWING_DATA2 || '/tmp/xwing-data2';
const OUT = join(process.cwd(), 'packages/data/src/generated');
if (!existsSync(join(SRC, 'data')))
  throw new Error(`xwing-data2 not found at ${SRC} (set XWING_DATA2)`);

const FACTION_NAMES = {
  rebelalliance: 'Rebel Alliance',
  galacticempire: 'Galactic Empire',
  scumandvillainy: 'Scum and Villainy',
  galacticrepublic: 'Galactic Republic',
  separatistalliance: 'Separatist Alliance',
  resistance: 'Resistance',
  firstorder: 'First Order',
};

const read = (p) => JSON.parse(readFileSync(p, 'utf8'));

// --- XWA community points overlay (github.com/eirikmun/xwing-points) ---
// xwing-data2 supplies card structure (stats/dials/slots); XWA supplies the
// authoritative cost/loadout/slots/limited for the current points revision.
const PTS = process.env.XWING_POINTS || '/tmp/xwing-points';
if (!existsSync(join(PTS, 'XWA')))
  throw new Error(`xwing-points not found at ${PTS} (set XWING_POINTS)`);
const revPath = read(join(PTS, 'XWA/points-revisions.json')).current_revision; // XWA/50P20/revision.json
const revDir = join(PTS, revPath, '..');
const revision = read(join(PTS, revPath));
const revId = revPath.split('/')[1];

const xwaPilots = {};
for (const file of readdirSync(revDir)) {
  if (!file.endsWith('.json') || file === 'revision.json' || file === 'upgrades.json') continue;
  const byShip = read(join(revDir, file));
  for (const ship of Object.keys(byShip)) {
    for (const [xws, p] of Object.entries(byShip[ship])) {
      xwaPilots[xws] = {
        cost: p.cost,
        loadout: p.loadout ?? 0,
        slots: p.slots ?? [],
        limited: p.limited ?? 0,
      };
    }
  }
}
const xwaUpgrades = read(join(revDir, 'upgrades.json'));
let pilotsPriced = 0;
let pilotsUnpriced = 0;
let upgradesPriced = 0;

const ships = [];
const pilotsDir = join(SRC, 'data/pilots');
for (const faction of readdirSync(pilotsDir)) {
  const dir = join(pilotsDir, faction);
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    const j = read(join(dir, file));
    if (j.size === 'Huge' || !Array.isArray(j.dial) || j.dial.length === 0) continue;
    ships.push({
      name: j.name,
      xws: j.xws,
      faction: FACTION_NAMES[j.faction] ?? j.faction,
      size: j.size,
      stats: j.stats.map((s) =>
        s.arc ? { type: s.type, arc: s.arc, value: s.value } : { type: s.type, value: s.value },
      ),
      actions: j.actions.map((a) => ({ type: a.type, difficulty: a.difficulty })),
      dial: j.dial,
      pilots: j.pilots.map((p) => {
        const x = xwaPilots[p.xws];
        if (x) pilotsPriced++;
        else pilotsUnpriced++;
        return {
          name: p.name,
          xws: p.xws,
          initiative: p.initiative,
          limited: x ? x.limited : (p.limited ?? 0),
          cost: x ? x.cost : (p.cost ?? 0),
          loadout: x ? x.loadout : (p.loadout ?? 0),
          slots: x ? x.slots : (p.slots ?? []),
        };
      }),
    });
  }
}
ships.sort((a, b) => a.faction.localeCompare(b.faction) || a.name.localeCompare(b.name));

const upgrades = [];
const upDir = join(SRC, 'data/upgrades');
for (const file of readdirSync(upDir)) {
  if (!file.endsWith('.json')) continue;
  for (const u of read(join(upDir, file))) {
    const side = u.sides[0];
    const fixed = typeof u.cost?.value === 'number' ? u.cost.value : null;
    const xu = xwaUpgrades[u.xws];
    if (xu) upgradesPriced++;
    upgrades.push({
      xws: u.xws,
      name: side.title ?? u.name,
      slot: side.type,
      slots: side.slots ?? [side.type],
      cost: xu ? xu.cost : fixed,
      variableCost: xu || fixed !== null ? null : (u.cost ?? null),
      limited: xu ? (xu.limited ?? 0) : (u.limited ?? 0),
      restrictions: u.restrictions ?? [],
    });
  }
}
upgrades.sort((a, b) => a.slot.localeCompare(b.slot) || a.name.localeCompare(b.name));

let commit = 'unknown';
try {
  commit = execSync('git rev-parse --short HEAD', { cwd: SRC }).toString().trim();
} catch {
  /* not a git checkout */
}

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'ships.json'), JSON.stringify(ships, null, 2) + '\n');
writeFileSync(join(OUT, 'upgrades.json'), JSON.stringify(upgrades, null, 2) + '\n');
writeFileSync(
  join(OUT, 'meta.json'),
  JSON.stringify(
    {
      source: 'xwing-data2',
      commit,
      points: `XWA ${revId}`,
      pointsDate: revision.effective_date,
      generatedAt: new Date().toISOString().slice(0, 10),
      ships: ships.length,
      upgrades: upgrades.length,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  `generated ${ships.length} ships, ${upgrades.length} upgrades ` +
    `(xwing-data2 ${commit}, points XWA ${revId} ${revision.effective_date})`,
);
console.log(
  `priced from XWA: ${pilotsPriced} pilots (${pilotsUnpriced} unpriced), ${upgradesPriced} upgrades`,
);
