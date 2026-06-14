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

## R4-M4 — Ability scope + full action system ✅
- ☑ **T4-S1** **Auras / broader scope.** `gatherAttackHooks` now collects hooks from
  *every* living ship (attacker + defender first, then the rest by id), so an aura on
  a nearby ship reads the attack via its own `self` plus a friendly/enemy-at-range
  condition. Existing self-scoped abilities are unaffected (they already guard on
  `self` = attacker/target). Adds `inRange(a,b,max)` and registers **Howlrunner** (a
  friendly attacker at range 0–1 rerolls a die) as the first aura. (Game-window/
  action-grant "leader" auras are the coordinate mechanic in T4-S2, not passive
  `afterMove` hooks, so the self-scoped game windows were left intact.)
- ☑ **T4-S2** **Full action bar.**
  - **boost & barrel-roll** as real repositions (`reposition.ts` candidate geometry
    + a `reposition` pending decision; boost = 1-speed straight/both banks, barrel
    roll = lateral one template + base; collision-pruned, action hidden if no legal
    placement).
  - **jam** (enemy at range 1 gains a jam token) and **reload** (recover a charge +
    gain disarm).
  - **coordinate** (grant a friendly at range 1–2 a free self-action via a
    `grantedAction` pause; doesn't consume the target's own activation action).
  - **SLAM** (reuses the reposition FSM — any dial maneuver at the executed speed,
    then move + disarm + the red-action stress).
  - **red / purple action costs** from card data (`actionDifficulty`): a red action
    gains stress; a purple action spends a Force and is hidden without it.
  - **linked actions** — the generator now captures the `linked` field (`actionLinks`
    on the ship). After a base action the FSM pauses (LinkOffered/LinkResolved) to
    offer its one linked follow-up (use or skip); the follow-up runs the full action
    path (linked repositions take the placement choice, linked locks target an enemy)
    and is charged at the link's own difficulty (usually a red stress). Links don't chain.
  - *Deferred: coordinate-granted repositions/locks, and reusing the reposition system
    for decloak's barrel-roll + the tractor reposition.*

## R4-M8 — Interactive combat (optional spends)
Rules correction (user): a "may" is the default — spending focus/evade/calculate/
Force/charges and using "may" abilities are the player's **choice**, not automatic.
The old engine auto-applied them all. Staged fix (chosen: **tokens first**).
- ☑ **T4-C1** Combat is now **event-sourced and interactive**: `resolveAttack` (atomic
  auto-resolve) is kept for tests/AI, but real play holds an in-progress attack in
  `state.combat` and pauses for a **modify** decision — the attacker's step, then the
  defender's. The built-in token spends (focus → hits/evades, calculate, Force,
  lock-reroll) are offered as discrete `Modify` choices with a `ModifyDone`; the dice
  pool is carried in `CombatBegan`/`CombatDiceSet`/`CombatAdvanced`/`CombatEnded`
  events so it folds deterministically (golden-master tests still pass). Client gets a
  modify panel showing the rolled dice + spends. *Bonus-die and dice-mod **abilities**
  (Crack Shot, Predator, …) still resolve automatically for now.*
- ☑ **T4-C2** Optionality is driven by **cost**, not the word "may": only abilities
  that cost the owner a resource (spend a focus/Force/charge) are offered; cost-free
  effects (extra/fewer dice, cost-free rerolls/changes) auto-trigger, for a lightweight
  feel. New `optionalAttack` ability section: cost abilities are offered during the
  modify step (each ≤ once/attack), with **rerolls only before any result changes**
  (`changed` flag) and `UseModifyAbility`. An **`after-defence`** combat step lets the
  *attacker* use cost abilities that modify the defender's dice (e.g. **Crack Shot**,
  now an offer). **Auto-skip**: `trivialCommand` resolves empty steps (no target →
  pass, no action → skip, nothing to spend → proceed); the client applies it so players
  are never prompted for a non-choice (the engine FSM stays pure). Predator/Marksmanship/
  Fanatical reverted to auto (they cost nothing). *Heroic / Juke / Howlrunner are
  cost-free → stay auto, correctly.*

## R4-M9 — Missing ability mechanics (unblocks the sweep)
Working through the hooks the sweep needs, highest-leverage first.
- ☑ **T4-R1** **Reactive windows** — fire ability windows when an attack resolves:
  `afterAttack` (attacker), then the defender's `onShieldLost` / `onDamaged` /
  `afterDefend`. `appendWindow` queues at most one optional offer at a time.
  Reactive abilities reuse existing machinery — **Lieutenant Tavson** (after damage,
  spend a charge to act) emits `ActionGranted` and rides the coordinate flow.
- ☑ **T4-R2** **Bonus attacks** — `offerBonusAttack` → `BonusAttackOffered` → a
  declare-attack that reuses the whole interactive-combat flow but, via a `bonus` flag
  on `AttackDeclared`, doesn't count as the ship's engagement. **Quickdraw** rides it
  (onShieldLost → spend charge → bonus attack).
- ◐ **T4-R3** More hooks.
  - ☑ **Dynamic initiative** — `initiative` ability hook + `effectiveInitiative`;
    activation/engagement order use it. Null (7 while undamaged) / Rush (6 while damaged).
  - ☑ **Attacker context in reactive windows** — thread the attacker id through the
    optional-ability path, so a defender's afterDefend/onDamaged ability knows who shot
    it. Dengar returns fire (afterDefend → charge → bonus attack vs the attacker).
  - ☑ **Deplete token** — the attack-side strain (−1 attack die, spent on attack, shed
    by a blue maneuver). Foundational for deplete-granting cards/weapons.
  - ☑ **After-destroyed window** — when a ship dies, fire `onDestroyed` for each living
    friendly of it. "Avenger" rides it (free action via ActionGranted).
  - ☑ **Dice lockdown** — a `lockdown` ability hook; a locked-down ship's modify step
    is fully suppressed (spends, offered abilities, and its auto cost-free abilities).
    "Midnight" rides it. *Ember (a more specific "can't spend focus/calc") would reuse
    this with a narrower predicate.*
  - ☑ **Target-select effect** — `offerTargetEffect` + a `select-target` decision +
    serialisable `EffectSpec` (transfer/grant/remove token) applied to the chosen ship.
    Axe rides it (pass a green token to a side-arc wingmate). Unlocks the whole
    choose-a-ship-and-move/grant/remove-a-token class.
  - ☑ **Phase-start ability windows** — `nextPhaseOffer` offers `onSystemPhase` /
    `onEngagementStart` abilities in initiative order (one at a time, tracked done per
    phase). Major von Reg (System → strain a bullseye enemy) and Muse (engagement start
    → clear a wingmate's stress) ride it via target-select.
  - ☑ **Condition cards (subsystem).** Assignable markers that carry their own abilities:
    `Ship.conditions` is folded into `shipAbilitySources`, so an assigned condition's
    registered ability is live on the ship. `ConditionAssigned`/`ConditionRemoved` events
    (apply is idempotent); the `EffectSpec` union gained `assign-condition`/`remove-condition`
    so the existing target-select offer can hand them out. A demonstration condition
    (`rattled`, original-named: −1 defence die) proves it end-to-end; roster shows condition
    chips. Specific condition cards register in the sweep (original paraphrases).
  - ☐ Still to build (lower-leverage): **setup window** (most setup abilities also need
    repositioning); **"moved through a ship"** triggers (only final placement + bump tracked
    today). **10 reusable hooks** built so far.

# R4b — secondary weapons · devices · damage deck

## R4-M5 — Secondary weapons & devices
- ☑ **T4-W1** Secondary-weapon attacks from slots (torpedo/missile/cannon/turret)
  with their own attack value, arc, range, lock/charge requirements. Weapon stats
  captured in the snapshot (`generate.mjs` reads `side.attack`; 41 weapons) and bridged
  engine-ward as `ShipWeapon[]` by `build.ts` (engine stays pure). The engagement
  `declare-attack` offer now lists primary **plus** each equipped weapon that bears on a
  target (`weaponReaches` = arc + min/max range); **ordnance requires a lock** and
  declaring **spends a charge**. `combat.ts` rolls the weapon's value (no range-1 bonus
  die for secondaries). Per-card ordnance modify-effects (hit→crit spends) deferred to
  the card sweep via the existing `onModifyAttack` hooks.
- ☑ **T4-W2** Devices / bombs (curated core set). `Device` board entity + `devices` on
  `GameState`; equipped devices bridged engine-ward as `ShipDevice[]` (`build.ts`), with
  behaviour in a pure engine registry (`devices.ts`, original paraphrases — never the
  card `effect` text). **Drop** (rear [1-straight]) and **launch** (front) placement, in
  the **System Phase** and **after-maneuver** (a `drop-device` pending, charge-gated).
  **Bombs** detonate at the end of Activation (one at a time in the reduce loop so each
  resolves against the updated board); **mines** detonate on move-through (`minesTouched`,
  damage aggregated like obstacles). Curated: Proton/Ion/Thermal bombs, Proximity Mine,
  Conner Net. `devices.test.ts` (6). Deferred: Seismic Charge (obstacle removal),
  generators, remotes, curved launch templates.

## R4-M6 — Damage deck
- ◐ **T4-D1** A faceup critical-damage deck. `damage.ts`: a deck of **original-named,
  behaviour-only** crit cards (never the real card text/art) — `Weapon Malfunction`
  (−1 attack), `Stabiliser Damage` (−1 agility), `Critical Breach` (raw) — shuffled
  deterministically from the seed (own `:deck` rng stream), stored on `GameState`
  (`damageDeck` + `damageDrawn`, redacted from the view). Crit results that reach the hull
  draw faceup cards (`onDealDamage`, `Math.min(crits, hullDamage)`); faceup cards reduce
  the matching combat stat (`cardPenalty` in `onRollAttack`/`onRollDefence`).
  `DamageCardDealt` / `DamageCardRemoved` (repair) events; roster shows the crit chips.
  `damage.test.ts` (5). **Remaining:** more crit effect kinds (action loss, recurring
  stress), facedown cards + the expose ability, deck reshuffle on exhaustion, and wiring
  the actual repair/expose card abilities in the sweep.

# Sweep

## R4-M7 — Sweep & cleanup
- ◐ **T4-X1** The card-implementation sweep (behaviour-only paraphrases, never card
  text). Scale: **~970 cards** carry an ability (522 pilots + 446 available upgrades).
  Decision (user): **build the missing ability-engine hooks first**, then sweep.
  - **Quick builds:** xwing-data2 ships preset pilot+upgrade combos; **69** of the
    upgrades they use aren't in the XWA points feed (quick-build-only / scenario
    reprints). The generator now flags each upgrade `available`; `upgradeOptions`
    hides the non-available ones so only XWA-legal cards fill normal slots.
  - **First batch registered:** Gideon Hask, Graz, Ahhav, Lt. Blount, Laetin A'shera,
    "Night Beast" (clean attack/defence modifiers + a blue-maneuver focus).
  - **Hook built — cross-ship action grants:** an ability can offer "choose a friendly
    at range N; it performs a free action" (optional Force cost) via a `grantOffer` +
    `grant-target` decision reusing the coordinate `grantedAction` flow. Unlocks the
    ~27 "after X, a friendly may act" cards; **Ahsoka Tano** + **Airen Cracken** ride it.
  - *Hooks still to build to unlock more: a **setup window**; confirm **Force-spend
    attack/defence** abilities work as auto-spend mandatory hooks (like Crack Shot) so
    they need no new hook. Suffix-variant pilot xws need separate registration.*
- ☐ **T4-X2** Exact geometry for the advanced bearings (Tallon Roll / reverse, which
  are approximated today).
