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
        name: p.name,
        subtitle: p.subtitle ?? '',
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
      actions: j.actions.map((a) =>
        a.linked
          ? {
              type: a.type,
              difficulty: a.difficulty,
              linked: { type: a.linked.type, difficulty: a.linked.difficulty },
            }
          : { type: a.type, difficulty: a.difficulty },
      ),
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
          force: p.force ? { value: p.force.value, recovers: p.force.recovers ?? 0 } : null,
        };
      }),
    });
  }
}
ships.sort((a, b) => a.faction.localeCompare(b.faction) || a.name.localeCompare(b.name));

// Append XWA-only reprint/variant pilots (suffix variants like "-battleofyavin"
// of pilots we already carry) to their base pilot's ship — same ship, same
// initiative as the base. XWA-original new pilots have no initiative in the
// points feed and aren't in xwing-data2, so they're deferred (not guessed).
const pilotShip = new Map();
const have = new Set();
for (const sh of ships) for (const p of sh.pilots) (pilotShip.set(p.xws, sh), have.add(p.xws));
let synthesized = 0;
const deferred = [];
for (const [xws, x] of Object.entries(xwaPilots)) {
  if (have.has(xws)) continue;
  const sh = pilotShip.get(xws.split('-')[0]);
  if (!sh) {
    deferred.push(xws);
    continue;
  }
  const base = sh.pilots.find((p) => p.xws === xws.split('-')[0]);
  sh.pilots.push({
    name: x.subtitle && x.subtitle !== x.name ? `${x.name} — ${x.subtitle}` : x.name,
    xws,
    initiative: base.initiative,
    limited: x.limited,
    cost: x.cost,
    loadout: x.loadout,
    slots: x.slots,
  });
  synthesized++;
}

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
      // Listed in the XWA points feed = buyable in normal list building. Upgrades
      // absent from the feed (e.g. quick-build-only cards) are kept for reference
      // but excluded from the squad builder's slot options.
      available: Boolean(xu),
      cost: xu ? xu.cost : fixed,
      variableCost: xu || fixed !== null ? null : (u.cost ?? null),
      limited: xu ? (xu.limited ?? 0) : (u.limited ?? 0),
      charges: side.charges
        ? { value: side.charges.value, recovers: side.charges.recovers ?? 0 }
        : null,
      // Secondary-weapon stats (torpedo/missile/cannon/turret): own dice, arc, range.
      weapon: side.attack
        ? {
            arc: side.attack.arc,
            value: side.attack.value,
            minRange: side.attack.minrange,
            maxRange: side.attack.maxrange,
            ordnance: Boolean(side.attack.ordnance),
          }
        : null,
      // Device (bomb/mine) — factual name + type only; effects are paraphrased in code.
      device: side.device ? { name: side.device.name, type: side.device.type } : null,
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
      pilots: ships.reduce((n, s) => n + s.pilots.length, 0),
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
console.log(
  `synthesized ${synthesized} XWA reprint variants; deferred ${deferred.length} (XWA-original / Epic-Huge, no card data)`,
);
