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
      pilots: j.pilots.map((p) => ({
        name: p.name,
        xws: p.xws,
        initiative: p.initiative,
        limited: p.limited ?? 0,
        cost: p.cost ?? 0,
        loadout: p.loadout ?? 0,
        slots: p.slots ?? [],
      })),
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
    upgrades.push({
      xws: u.xws,
      name: side.title ?? u.name,
      slot: side.type,
      slots: side.slots ?? [side.type],
      cost: fixed,
      variableCost: fixed === null ? (u.cost ?? null) : null,
      limited: u.limited ?? 0,
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
      generatedAt: new Date().toISOString().slice(0, 10),
      ships: ships.length,
      upgrades: upgrades.length,
    },
    null,
    2,
  ) + '\n',
);
console.log(`generated ${ships.length} ships, ${upgrades.length} upgrades (xwing-data2 ${commit})`);
