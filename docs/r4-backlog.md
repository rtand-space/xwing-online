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

## Decisions (resolved)
1. **Sliced:** **R4a = M1–M4** (tokens, Force, arcs, auras, actions) ships first and
   unlocks the majority of cards; **R4b = M5–M6** (secondary weapons, devices, damage
   deck) follows. The card sweep (M7) runs against whatever is unlocked.
2. **Full rules effects** for status tokens — tokens actually do their thing (ion
   overrides movement, cloak changes agility, disarm blocks attacks…), enforced in the FSM.
3. **Start at M1** (resources / green tokens) — lowest-risk, highest-reuse foundation.

# R4a — tokens · Force · arcs · auras · actions

## R4-M1 — Resources & beneficial tokens ✅
- ☑ **T4-R1** Token/action unions extended; **calculate** (one focus result per
  token, in both attack & defence) and **reinforce** (a 2+ result attack deals 1
  less) implemented with real effects; the Calculate/Reinforce actions grant them;
  round-end clears them as green tokens; shown in the roster. Tested.
- ☑ **T4-R2** **Force** as a resource: `force`/`maxForce`/`forceRecovers` on the
  ship, seeded from the pilot's Force value (generator captures it); `ForceChanged`
  event (clamped); recovers per round. A Force user spends Force like a focus on
  any remaining results in attack/defence (after focus + calculate). Shown in the
  roster; `spendForce` helper for future Force-power abilities. Tested.
- ☑ **T4-R3** **Per-card charge pools** — each charge upgrade gets its own pool in
  `upgradeCharges` (keyed by xws); `ChargeChanged` carries a `source`; recovery is
  per-pool. `chargesFrom(ship, source)` reads a pool; `spendCharge(self, source)`
  spends it. So one card can't spend another's charges. (Intrinsic ship/pilot
  charges keep the flat pool.) Roster shows the combined total. Crack Shot now uses
  its own pool. Tested.

## R4-M2 — Negative status tokens (rules effects, not just markers)
- ☑ **T4-N1** Negative tokens with real FSM effects, centralised in `tokens.ts`,
  grounded in the **XWA Rules Reference v1.4.6** (xwing.life). **Ion** (red) —
  ionised at a base-size threshold (small 1 / med 2 / large 3); an ionised ship
  *plans normally* but, at activation, executes a **blue speed-1 straight/bank in
  its dial's direction** (stop → 1-straight), may then perform **only the calculate
  action**, and sheds **all** ion tokens at the **end of its activation**; becoming
  ionised **breaks the locks it maintains**. **Tractor** (orange) — tractored at the
  same base-size threshold; while tractored a ship rolls **1 fewer defence die** (no
  large-base exemption). **Disarm** (orange) — cannot declare attacks. **Strain**
  (red) — rolls 1 fewer defence die, spent by defending; also shed by a blue
  maneuver. **Jam** (orange) — strips one green token/lock if present, else lingers
  and consumes the next green/lock gained. **End Phase** clears every *circular*
  token (green then orange = focus/evade/calculate/reinforce + tractor/disarm/jam);
  red tokens (stress/strain/ion) and locks keep their own timing. Roster chips for
  the new tokens. Tested (`tokens.test.ts`). *Deferred: the opponent's
  boost/barrel-roll reposition when a tractor lands (needs M4's real repositions);
  the jam-applier's choice of which green token to strip (auto-picks the first).*
- ☑ **T4-N2** **Cloak** (blue token, RR-grounded). The **cloak action** grants a
  cloak token; while cloaked a ship rolls **+2 agility**, is **disarmed** (cannot
  attack), and cannot perform the cloak action again. **Decloak** is a System-Phase
  optional decision (new `decloak` pending + `Decloak`/`SkipDecloak` commands,
  sequenced low→high initiative via a `hasSystemActed` flag) that spends the cloak
  token and repositions; a decloak that would overlap a ship fails (stays put, keeps
  the token). Cloak is a blue token so it survives the End Phase. Client gets a
  decloak control + cloak chip/action label. Tested. *Deferred to M4: the full
  decloak menu (barrel-roll + bank/direction choice) — M2 ships only the forward
  boost, since real boost/barrel-roll geometry is T4-S2.*

## R4-M3 — Arcs ✅
- ☑ **T4-A1** Arc geometry + data. `arcs.ts` generalises the front wedge into
  `inArcAt(centre, half)` and adds front / rear / **full-front** (±90) /
  single-turret / double-turret (two opposite arcs) tests (bullseye already
  existed). `attackValue(attacker, target)` returns the **best value across the
  ship's arcs**, or null when none bears. Engine `Ship` carries `arcs: ShipArc[]`
  + `turretArc` (rotatable facing); `build.ts` populates them from the card's
  attack stats (one stat per arc, e.g. ARC-170 front 3 / rear 2; "mobile arc"
  ships are encoded as single-turret in xwing-data2, so they ride that path).
- ☑ **T4-A2** Selection + rotation. New **`rotate-arc` action** (mapped from the
  card's Rotate Arc) emits `ArcRotated`; `nextFacing` cycles a single turret through
  the four arcs and toggles a double turret between its two orientations. Setup
  defaults the indicator to `front`. Combat draws dice from the bearing arc and
  engagement only offers targets `attackValue` reaches, so attacks respect the
  chosen arc. Client gets the action label + a log line. Tested (`arcs.test.ts`).
  *Deferred: a setup UI to pick the initial facing, explicit "rotate to any arc"
  (currently cycles), and board rendering of non-front arcs.*

## R4-M4 — Ability scope + full action system
- ☐ **T4-S1** **Auras / broader scope:** gather ability hooks from *all* ships, not
  just attacker/target, with "friendly/enemy ship at range N" conditions — unlocks
  the large squad-synergy class (e.g. reroll auras, token-granting leaders).
- ☐ **T4-S2** **Full action bar:** coordinate, jam, reload, SLAM, rotate arc, plus
  barrel-roll/boost executed as real repositions (geometry); red/linked actions and
  action-granting abilities.

# R4b — secondary weapons · devices · damage deck

## R4-M5 — Secondary weapons & devices
- ☐ **T4-W1** Secondary-weapon attacks from slots (torpedo/missile/cannon/turret)
  with their own attack value, arc, range, lock/charge requirements.
- ☐ **T4-W2** Devices / bombs: drop & launch, placement, detonation timing, effects
  (reuses the obstacle geometry).

## R4-M6 — Damage deck
- ☐ **T4-D1** A faceup critical-damage deck (a small crit set with effects, drawn as
  events for determinism) so crit-manipulation abilities (expose/repair) work.

# Sweep

## R4-M7 — Sweep & cleanup
- ☐ **T4-X1** The card-implementation sweep — now that the mechanics exist, register
  the large batch of newly-implementable pilots/upgrades (behaviour-only, paraphrased).
- ☐ **T4-X2** Exact geometry for the advanced bearings (Tallon Roll / reverse, which
  are approximated today).
