# R3 — Ability engine (backlog)

R3 is **the pivotal investment** (spec §137): generalise the upgrade/ability/effect
system so a card becomes *data that registers handlers on named timing windows*,
then implement a growing, curated set of ship / pilot / upgrade abilities. After
R3, new content is data, not engine code.

The forward hook already exists: the combat pipeline runs as `ATTACK_WINDOWS`
with a `hooks` seam that nothing subscribes to yet (r1-architecture §5). R3 turns
that seam on and extends it to the whole FSM.

## Roadmap boundary (what is R3 vs R4)

Per spec §137–138, **R4** owns the heavy new mechanics: ion, tractor, jam,
coordinate, reinforce, cloak, **Force users**, and turret/mobile/bullseye arcs.
So R3 implements abilities expressible with the **primitives we already have** —
dice (roll/reroll/add/change), focus/evade/lock/stress tokens, stat/dial tweaks,
and after-X triggers — plus the framework itself.

**Decided — charges in R3.** The spec files charges under R4, but they gate a
*large* share of otherwise-R3-simple abilities, so R3-M2 adds a **minimal** charge /
recurring-charge resource. Force and the status tokens (ion/tractor/jam/cloak)
stay R4. **Abilities are a code registry keyed by xws** (typed hook functions), not
a data DSL — a DSL for the simplest patterns can come later.

## Constraints (locked)

- **Never reproduce card text or art.** Abilities are implemented as *behaviour*,
  referenced by xws + our own one-line paraphrase. The data layer already avoids
  card text; keep it that way.
- **Engine stays pure & event-sourced.** Abilities are pure functions that read an
  ability context and emit events (or register dice/result modifications). Every
  ability-driven change is an event, so replay stays exact.
- **Testing is the gate.** Golden-master + property-based tests per primitive and
  per implemented card (a rules engine you can't test will rot).

Status: ☐ not started · ◐ in progress · ☑ done

## R3-M1 — The framework ✅
- ☑ **T3-F1** Non-combat timing windows: `fireWindow(state, window, self, event?)`
  runs a ship's `game` handlers and returns events to append. `afterMove` and
  `onPerformAction` are wired into the FSM (reduce); `afterReveal`/`onRoundEnd` are
  declared and get wired as cards need them. Engine-pure.
- ☑ **T3-F2** **Ability registry** keyed by xws → a typed `Ability` declaring
  handlers (`engine/abilities.ts`); `shipAbilitySources` reads ship type + pilot +
  upgrades. No card-specific code in the core engine.
- ☑ **T3-F3** **Equipped upgrades + pilot xws threaded into the engine.**
  `ShipInit`/`Ship` gain `pilotXws` + `upgrades`; `toShipInit`/`squadToShipInits`
  pass them through (connecting T-B2's loadouts to gameplay).
- ☑ **T3-F4** Registry wired into `resolveAttack` (`gatherAttackHooks`, attacker-
  then-defender order, after each builtin window) and into the FSM via `fireWindow`.
  _Ability-queue refinement (range/initiative tie-breaks) revisited when a card needs it._

## R3-M2 — Player choice + minimal charges ✅
- ☑ **T3-C1** Optional ("may") abilities: a `game.optional[window]` entry with
  `available`/`resolve` is offered after its window fires. The offer lives in
  `state.offer`, so `computePending` surfaces a **`trigger-ability`** decision
  (pausing the FSM) resolved by `UseAbility`/`SkipAbility`. Pure event-sourced
  (`AbilityOffered`/`AbilityResolved`), so the online DO serialises it like any
  command; the in-game HUD shows Use/Skip. Tested offer→use and offer→skip.
- ☑ **T3-C2** Minimal **charge** model: `charges`/`maxCharges`/`recurring` on
  `Ship` (+ optional on `ShipInit`); `ChargeChanged` event (clamped 0..max); ships
  start full; `recurring` charges recover at round end. Force + status tokens stay R4.
  _Card-supplied charge values arrive with the M4 cards._

## R3-M3 — Effect primitives ✅
- ☑ **T3-E1/E2/E3** `engine/effects.ts`: attack-window helpers `addAttackDice`/
  `addDefenceDice`, `rerollAttack`/`rerollDefence`, `changeAttack`/`changeDefence`
  (correct `cursor` + `DiceRolled` bookkeeping, rerolls-before-changes), and
  game-window event builders `gainToken`/`spendCharge`/`recoverCharge`/`addStress`.
  Card abilities compose these instead of hand-writing dice/cursor logic. Tested
  (add/change/deterministic reroll, event builders). _A bonus-die "+1 at range"
  is just `addAttackDice` in an `onModifyAttack` hook; dial edits land with the
  cards that need them in M4._

## R3-M4 — First card slice + honesty in the builder
- ◐ **T3-S1** Registration plumbing in place: `@xwing/data` `abilities.ts` holds
  behaviour-only implementations keyed by xws + `installAbilities()`, called at
  startup by the client (`main.tsx`) and server (`game-store.ts`). Live cards
  (edition-stable, arc/dice only): **Wedge Antilles** (defender −1 die),
  **Backstabber** (+1 attack die from outside the defender's arc), **Outmaneuver**
  (defender −1 die from outside its arc), **Juke**, **Fearless**, plus
  **Predator** + **Marksmanship** once the engine gained a **bullseye arc**
  (`inBullseye`, a range-ruler-width forward corridor). The curated set grows from here.
- ☑ **T3-S2** Builder honesty: `implementedAbility(xws)` badges pilots/upgrades the
  engine actually simulates, with a note that the rest aren't yet — so equipping an
  unimplemented card doesn't mislead.

## R3-M5 — Content-as-data expansion
- ☐ **T3-X1** Prove the thesis: add more named pilots/upgrades by registering
  abilities only — zero engine changes — and grow the implemented/coverage set.

## Sequencing & risk
- **M1 is the whole bet.** Get the window/registry/queue shape right; everything
  else is additive. Spend test budget here.
- **Hardest part: optional abilities + the ability queue across two networked
  players.** It's "just more pending decisions," but ordering and prompts compound —
  lean on the event log + golden replays.
- **Scope control:** never aim for all 700 pilots / 524 upgrades. Ship a curated,
  visibly-tracked set that grows; the `implemented` surface keeps it honest.

## Decisions (resolved)
1. **Charges:** minimal charge model in R3-M2 (Force/status tokens remain R4). ✓
2. **Ability style:** code registry keyed by xws. ✓
3. **Coverage:** curated, growing set with a visible `implemented` flag. ✓
