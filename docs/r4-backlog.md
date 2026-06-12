# R4 — Full rules surface (backlog)

R4 is the largest release: it teaches the engine the remaining rules so it "handles
essentially any card" (spec §138). R3 built the ability framework; ~80% of cards
still can't be implemented because they need mechanics that don't exist yet. R4
adds those mechanics — and **each one unlocks dozens of cards at once**, which is
why the card sweep was deferred to here rather than hand-added in R3.

**In scope (spec §138):** status tokens (ion, tractor, jam, calculate, reinforce,
cloak, strain, disarm), **Force**, per-card charges, the full action bar, turret/
double/rear/mobile arcs, and ability scope beyond attacker/target (auras).

**Out of scope:** scenarios/objectives/scoring (R5), matchmaking/replay/spectate
(R6), AI/tutorial/solo (R7). R4 is rules, not modes.

## Principle: sequence by leverage

Order milestones so each adds a mechanic that flips the most cards and unblocks the
later ones. Ship incrementally — every milestone is independently valuable and ends
with a card batch newly implementable + a deployed checkpoint. (As in R3: a mechanic
is a one-time engine unlock; the cards that follow are pure data.)

Status: ☐ not started

## R4-M1 — Resources & beneficial tokens
- ☐ **T4-R1** Generalise the token model to the full taxonomy (green/red/orange);
  add **calculate** (focus-like for dice) and **reinforce** (reduce damage from an
  arc), plus the actions that grant them. Round-end cleanup of green tokens.
- ☐ **T4-R2** **Force** as a resource (spend to modify dice / trigger abilities,
  recover 1 per round); force-power upgrades and Force-using pilots.
- ☐ **T4-R3** **Per-card charge pools** — replace R3's per-ship pool so one card
  can't spend another's charges; charge-granting on pilots/ships too (not just upgrades).

## R4-M2 — Negative status tokens (rules effects, not just markers)
- ☐ **T4-N1** **Ion** (forced speed-1 straight + capped to one action; ionisation
  threshold for larger ships), **tractor** (reposition / agility effect), **disarm**
  (cannot attack), **strain**, **jam** (remove a green token). These change the
  movement/action/attack FSM, so they're the heavy part.
- ☐ **T4-N2** **Cloak** (the cloak token + decloak; agility bonus, attack/lock
  restrictions).

## R4-M3 — Arcs
- ☐ **T4-A1** Arc data from card stats: **turret** (rotatable single-turret),
  **double turret**, **rear arc**, **full-front**, **mobile arc** (bullseye exists).
- ☐ **T4-A2** Arc selection/rotation in setup + the Rotate Arc action; attacks and
  arc-conditional abilities respect the chosen arc.

## R4-M4 — Ability scope + full action system
- ☐ **T4-S1** **Auras / broader scope:** gather ability hooks from *all* ships, not
  just attacker/target, with "friendly/enemy ship at range N" conditions — unlocks
  the large squad-synergy class (e.g. reroll auras, token-granting leaders).
- ☐ **T4-S2** **Full action bar:** coordinate, jam, reload, SLAM, rotate arc, plus
  barrel-roll/boost executed as real repositions (geometry); red/linked actions and
  action-granting abilities.

## R4-M5 — Secondary weapons & devices
- ☐ **T4-W1** Secondary-weapon attacks from slots (torpedo/missile/cannon/turret)
  with their own attack value, arc, range, lock/charge requirements.
- ☐ **T4-W2** Devices / bombs: drop & launch, placement, detonation timing, effects
  (reuses the obstacle geometry).

## R4-M6 — Damage deck
- ☐ **T4-D1** A faceup critical-damage deck (a small crit set with effects, drawn as
  events for determinism) so crit-manipulation abilities (expose/repair) work.

## R4-M7 — Sweep & cleanup
- ☐ **T4-X1** The card-implementation sweep — now that the mechanics exist, register
  the large batch of newly-implementable pilots/upgrades (behaviour-only, paraphrased).
- ☐ **T4-X2** Exact geometry for the advanced bearings (Tallon Roll / reverse, which
  are approximated today).

## Decisions to confirm
1. **Slice R4?** It's huge. A natural cut is **R4a = M1–M4** (tokens, Force, arcs,
   auras, actions — unlocks the *majority* of cards) shipped first, then **R4b =
   M5–M6** (secondary weapons, devices, damage deck). Or run straight through.
2. **Token effect depth** — full rules enforcement (ion overrides movement, cloak
   changes agility, disarm blocks attacks) vs. markers only. "Handles any card"
   needs the real effects, but they touch the FSM.
3. **Starting milestone** — recommend **M1** (resources/green tokens) as the lowest-
   risk, highest-reuse foundation that later milestones build on.
