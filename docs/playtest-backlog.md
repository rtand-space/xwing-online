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
- ✅ **Multi-ship collision (railroad method).** `pathAt` was a straight-chord lerp; now it
  traces the template's actual arc (`localAt(m, t)` scales the arc/straight by `t`, a trailing
  K-turn/Segnor's flip only at t=1). Collision back-off slides the ship back along its real
  curved path, so banked/turned pile-ups resolve correctly. (`templates.ts`)
- ✅ **Ship leaving the board is destroyed.** `BOARD_HALF = 498` + `offBoard(pos, base)` in
  `geometry.ts`; `ExecuteManeuver` destroys a ship whose base leaves the play area.
  *(Repositions/SLAM pushing off-board still TODO — they go through the reposition FSM.)*
- ✅ **Range-0 (bump) attacks.** `rangeBand` now returns 0 for touching/overlapping bases.
  At range 0 the **attacker** gets no range-1 bonus die and may not modify its dice; the
  **defender modifies normally** (suppression is attacker-side only, in both the atomic and
  interactive paths). Secondary weapons (min range ≥ 1) aren't offered at range 0; primary is.
- ✅ **Bumped ship → only a red focus action.** A bump no longer forfeits the action: a
  `Ship.bumped` flag (set on `ShipMoved`, reset at round end) makes `actionDecision` offer
  only `focus`, and `PerformAction` charges it red (gains stress).

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
- ✅ Colour is decoupled from the seat: host and joiner each pick from an 8-colour palette
  (joiner can't share the host's). Seats renamed `rebel`/`imperial` → `player1`/`player2`
  (player1 = bottom, player2 = top); colours ride on `Player.color` and the board/roster
  render from it (`playerColor`).

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
