# Playtest backlog

Findings from a playtest session (2026-06-14), triaged. Priorities: **P0** correctness
that breaks the sim · **P1** important rules/UX/legality · **P2** polish & training aids.
The granular engine status still lives in the R1–R4 backlogs; this tracks playtest-driven
work.

## Fixed in the first quick pass (2026-06-14)

- ✅ **0-stop maneuver moved the ship** — `applyManeuver` added a base-length offset even
  for a stationary template; now returns the position unchanged. (`templates.ts`)
- ✅ **Locks stacked** — a ship could hold multiple locks; acquiring a new lock now drops
  the old (limit 1; raise-the-limit cards deferred). (`apply.ts` `gainToken`)
- ✅ **Wrong name when targeting** — lock / jam / coordinate / grant / select buttons showed
  the raw ship id; now the pilot name. (`controls.tsx`)
- ✅ **Lock indicator** — the roster lock chip now reads "lock → <pilot>". (`roster.tsx`)
- ✅ **No actions while overlapping an asteroid** — `actionDecision` now returns no actions
  for a ship on an asteroid. (`pending.ts`)

## P0 — correctness (do before more features)

- ☐ **Range calculation suspect with medium/large bases / new arcs.** Needs a focused audit
  of `baseDistance`/`rangeBand`/`attackValue` with mixed base sizes and the secondary-weapon
  arcs. Reproduce first. (`arcs.ts`, `geometry.ts`)
- ☐ **Multi-ship collision is "weird."** `resolveMovement` backs off by linear lerp; should
  use the "railroad" method (advance along the template until first contact). Affects 2+ ship
  pile-ups. (`movement.ts`)
- ☐ **Ship leaving the board is not destroyed.** Any part of the base leaving the play area
  should kill the ship — engine has no board-bounds concept yet (board is ~900mm; client
  draws ±498). Add bounds to the config/state + a destroy check after movement.
- ☐ **Range-0 (bump) attacks.** Overlap reads as range band 1, so a range-0 attack wrongly
  gets the range-1 bonus die and dice mods. Distinguish true range 0 (base contact) and
  forbid the bonus die / mods (and likely the primary attack). (`arcs.ts`, `combat.ts`)
- ☐ **Bumped ship → only a red focus action** (clarified). A ship that overlaps another ship
  does **not** lose its action entirely — it may perform only a **red Focus** (stress) action.
  Today the engine sets `hasActed = bumped`, forfeiting the action; change to offer a single
  red focus instead. (`apply.ts` `ShipMoved`, `pending.ts` `actionDecision`)

## P1 — rules, core UX, online, legality

**Rules**
- ☐ Verify obstacle effects against the xwing.life ruleset (asteroid/debris/gas) — audit;
  pairs with the geometry pass.
- ☐ **Rotate-arc has no "where to" choice** — it cycles today; add a facing/target picker
  (known deferred item from R4-M3). (`pending.ts`, `reduce.ts`, `controls.tsx`)
- ☐ Multi-lock cards (limit > 1) — re-enable stacking only for cards that grant it (the
  single-lock fix above is the common case).

**Squad legality** (some may partly exist via `validateSquad`'s `limited` check — confirm)
- ☐ Unique-pilot overstep tracker (no two of the same unique pilot).
- ☐ Restricted-list overshoot detection (per-list card caps).
- ☐ Illegal squads: savable, but blocked from **online** load (sandbox stays permissive).
- ☐ **Configuration slots leak across ships** — several config upgrades have empty
  `restrictions` in the data, so `upgradeOptions` shows them for any ship with a config slot.
  Needs a config→ship mapping (data-shaped, not a one-liner). (`squad.ts`, generator)

**Online / experience**
- ☐ **Own board edge at the bottom of the screen** (you fly "up" toward the opponent) —
  per-seat board orientation flip.
- ☐ Host picks a colour, joiner picks any other.

**Board visual**
- ☐ Map corners: the background overflows the rounded-corner clip.

## P2 — builder organization, polish, training aids

**Squad builder**
- ☐ Group pilots by variant tag in accordions (BoY/BoE…), default-closed, then by initiative
  (extends the existing tags + initiative sort).
- ☐ Group ship selection by base size, then alphabetical.
- ☐ Ship silhouette icon next to ship names (needs art/SVG silhouettes).
- ☐ Restyle the X / remove button.
- ⚠️ **Card display on click** (pilot/upgrade) via Infinite Arenas' printer — **conflicts with
  the locked "never reproduce card text/art" decision.** If wanted, scope to our own
  paraphrased ability blurbs, not card images.

**Sandbox / training wheels**
- ☐ Undo button in sandbox.
- ☐ Togglable ghost frame of the maneuver templates.
- ☐ Togglable projection of your end position. *(Build with the template ghost — same family.)*

## Needs clarification

- ❓ **"Road roll" — initiative roll at the start of each round.** XWA/2.5 sets first player by
  points (initiative token), not a per-round roll. Confirm intent (first-player step vs. a
  house rule) before building.
