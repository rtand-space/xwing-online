# X-Wing Online — Game & Data Spec

A working reference for the build. Everything here describes the **game system** (mechanics aren't copyrightable) in our own words — no card text, no rules verbatim. This is the engine we have to model and the data we have to feed it.

---

## 1. Scope

A turn-based, browser-first adaptation of the X-Wing 2nd-edition system. Two players each fly a squad of starfighters on a play area, secretly plan maneuvers, then resolve movement and combat in initiative order. Because official development has ended, the card pool and points are **community-maintained**, so the app treats game data as a live feed rather than a hardcoded table.

---

## 2. The round — the core loop

Each round runs through ordered phases. Get this loop exactly right and you have the engine.

1. **Planning** — both players secretly assign a maneuver to each ship (set the dial). Hidden until reveal.
2. **System** — a short window where "start of round" / system-phase effects fire. Often empty; build the hook, defer most content.
3. **Activation** — ships activate in **ascending initiative** order. On activation a ship: reveals its dial → executes the maneuver via a movement template → may perform **one action**.
4. **Engagement** — ships attack in **descending initiative** order. Each engages once by default: pick a target in arc and range, roll and modify dice, resolve damage.
5. **End** — clear transient tokens, ready/recover as needed, then start the next round.

Ascending to move, descending to shoot — that ordering is load-bearing and must be precise.

---

## 3. Movement

Ships move using physical templates chosen on the dial.

- **Bearings:** straight, bank (gentle, 45°) left/right, turn (hard, 90°) left/right, plus specials — Koiogran/K-turn (180°), Segnor's Loop, Tallon Roll, reverse, and stationary (speed 0).
- **Speeds:** 0–5, depending on the ship's dial.
- **Difficulty colour:** blue clears one stress, white is neutral, red adds one stress.

**Stress:** a stressed ship can't perform actions and can't choose red maneuvers; it sheds stress by flying blue. Overlapping a ship or obstacle stops the move and forbids the action. Template placement is the soul of the game — model it precisely, with snapping.

---

## 4. Actions

Each ship has an **action bar**. On activation it may take one action (cards can grant more, or link two at the cost of stress). Common actions: Focus, Lock (acquire target lock), Barrel Roll, Boost, Evade, Reinforce, Calculate, Reload, Rotate arc, Coordinate, Jam, Cloak, SLAM. Red actions add stress.

MVP needs **Focus, Lock, Barrel Roll, Boost, Evade**. The rest are content layered onto the same action framework.

---

## 5. Combat

**Sequence:** confirm target in firing arc and range → roll attack dice → roll defence dice → modify → compare → deal damage.

- **Attack dice (red):** faces are Hit, Critical Hit, Focus, Blank.
- **Defence dice (green):** faces are Evade, Focus, Blank.
- **Range:** at range 1 the attacker rolls one extra die; at range 3 the defender rolls one extra die; obstruction adds a defence die.
- **Modifying:** a focus token turns focus results into hits (attacking) or evades (defending); a target lock allows a reroll; cards add their own modifiers. Order matters — rerolls resolve before changes.
- **Damage:** each uncancelled hit/crit deals 1 damage. Shields absorb first and ignore the crit distinction; once hull is exposed, criticals deal **face-up damage cards** with ongoing effects. Hull to zero destroys the ship.

---

## 6. Tokens, charges, Force

Per-ship state the engine must track: focus, evade, target lock (paired, with a lock identifier), stress, ion (forces a single speed-1 straight and caps actions; enough ion tokens ionise larger ships), tractor, jam, reinforce, disarm, cloak.

Resource pools: **charges** (some recur each round) and **Force charges** (spent to modify dice or trigger abilities, recovering one per round).

Build these as generic, stackable status objects so a new card just references them rather than needing engine changes.

---

## 7. Ship & card anatomy

A ship card carries: initiative, primary attack value(s) per arc, agility, hull, shields, an action bar, upgrade slots, and a maneuver dial. Firing arcs include front, rear, full-front, bullseye, single/double turret, and mobile arcs.

Upgrades attach to slots (talent, astromech, crew, modification, configuration, and so on) and can alter stats, dials, actions, and add abilities. Model ships and upgrades as **data plus a small effect/ability system**; keep nothing card-specific hardcoded in the engine.

---

## 8. Squad building & points — targeting XWA (2.5 loadout) first

The app builds for the **2.5 "loadout" system** maintained by The X-Wing Alliance. (2.0 Legacy from X2PO is the other community standard; we may add it later, but XWA is the first target.) The loadout system runs on **two separate currencies**:

- **Squad points** — a squad is built to a **20-point** total, **3–8 ships**, single faction. Each pilot has a fixed squad cost (roughly 2–11) that never changes based on upgrades equipped.
- **Loadout points** — each pilot has its own **loadout value**, a private budget spent only on that pilot's upgrades. Combined upgrade cost can't exceed the loadout value. Upgrade costs are fixed (not variable by ship). No two copies of the same-named upgrade on one pilot.

Slots and "builder keywords" gate which upgrades a pilot can take, and some upgrades require a minimum loadout. **Scoring:** unspent squad points are handed to the opponent (deficit scoring), so builders should spend all 20; unspent loadout points don't matter.

**Squad-builder implications:** model the two budgets independently — a squad-level 20-point meter, plus a per-pilot loadout meter that opens when a pilot is equipped. Validate faction, slot bars, loadout caps, and limited/solitary rules against the active XWA points set.

> **Game-mode note:** 2.5 made **scenario play** the standard — four scenarios with objectives that award Mission Points, not pure last-ship-standing. The MVP can ship a straight dogfight (one scenario is close to that), but design the win-condition layer so objective-based scenarios slot in later rather than being bolted on.

---

## 9. Data layer — the "stay 100% current" requirement

Don't hand-maintain card data. Build on the community stack:

- **xwing-data2** — canonical open JSON dataset of every ship, pilot, upgrade, and image (MIT-licensed). Use it as the card database.
- **XWS spec** — standard squad interchange format keyed by canonical `xws` ids. Adopt it as the native squad format so squads import/export with every other tool (YASB, Launch Bay Next, etc.).
- **Community points** — published as tools-friendly JSON (The X-Wing Alliance points repo; Legacy points from X2PO), referencing the same ids.

**Strategy:** pull these from source on a schedule, cache a **versioned snapshot**, and pin each game to a known data version so a mid-game points update can never corrupt a live match. Surface the data version in-app, and let advanced users point at an alternate points source.

---

## 10. MVP — the smallest genuinely-fun build

**Bar to clear:** flying two iconic ships against each other *feels great on a phone*. Rules fidelity serves that, not the reverse.

**Roster (content kept tiny):** the iconic starter matchup — **T-65 X-wing (Rebel)** vs **TIE/ln (Imperial)**. Generic pilots only, at two initiative values each so ordering matters. Both are front-arc, no Force, no charges — the cleanest pair that still teaches the whole game (tanky-vs-swarm, arc-dodging, the dial mind-game).

**Squads:** skip the full builder at first — ship a few **preset balanced squads** (e.g. 2 X-wings vs 3 TIEs). The real loadout builder is the very next release.

**Mechanics in:** the full round loop (planning → activation ascending → engagement descending → end); the templates these two ships use, including the K-turn and the stress it brings; collisions; **Focus, Target Lock, Barrel Roll, Evade**; front-arc primary attacks with range bonuses and focus/lock modification; shields → hull → damage deck (a simplified crit set is fine to start); tokens focus/lock/evade/stress; win by elimination.

**Mechanics out (deferred):** Force, charges, ion/tractor/jam/cloak, turret/mobile/bullseye arcs, upgrades beyond base, devices/bombs, obstacles, >2 players, epic, scenarios.

**Online & mobile (non-negotiable — the wedge):** server-authoritative state with hidden dials; an **invite-code** system (share a short code or link to start a 1v1 — no matchmaking yet); lightweight **guest identity** so anyone can play instantly without signing up; **async** turns with "your turn" notifications and resume-on-any-device, plus live play when both are present; mobile-first board — pan/pinch-zoom, tap-to-set dial, drag-to-place templates with snapping; safe reconnect. **Record every game as a deterministic event log from day one** — this costs little now and is the single thing that makes replays seamless later.

---

## 11. Experience principles — the wedge

The differentiator is feel, on a phone and online.

- **Mobile-first controls:** a thumb-reachable dial, drag-to-place templates with snapping, pinch-zoom board — no precise mouse work required.
- **Async that respects time:** a game can pause between turns; "your turn" notifications; resume on any device.
- **Trustworthy state:** server-authoritative; hidden dials never reach the opponent's client until reveal; reconnect without losing the game.
- **Zero friction:** shareable invite link, no install, fast load, readable at a glance.

---

## 12. Release roadmap — MVP to complete product

Each stage ships independently and unlocks the next. Roster and cards become "just data" after R3.

- **R1 — Core dogfight (MVP).** As section 10 — including invite-code play, guest identity, and event-log recording from the very first build. Goal: prove the loop is fun on a phone.
- **R2 — Squad builder + data layer.** Full XWA loadout builder on xwing-data2, XWS import/export, dynamic XWA points (versioned). Add a proper **account system** (sign-in, saved squads, history) with seamless guest→account migration. Add obstacles (asteroids/debris), since real list play assumes them. Players bring their own squads.
- **R3 — Roster expansion + ability engine.** Generalise the upgrade/ability/effect system, then add the next ship tier (Y-wing, A-wing, TIE Advanced, TIE Interceptor…), upgrades, and named pilots with abilities. The pivotal investment — after this, new content is data, not code.
- **R4 — Full rules surface.** Ion, tractor, jam, coordinate, reinforce, cloak, charges, Force users, and turret/mobile/bullseye arcs. The engine now handles essentially any card.
- **R5 — Scenario play + scoring.** The four 2.5 scenarios, objectives, Mission Points, deficit scoring. Brings play in line with how 2.5 is actually played.
- **R6 — Community & competition.** Matchmaking/ladder, profiles, rankings, spectating, a **seamless replay viewer** (scrub, step through, and share any past game), and organised-play/tournament support — the layer that actually solves "I can't find an opponent."
- **R7 — Onboarding & solo.** A simple AI opponent for practice and for when no human's around, an interactive tutorial, and full accessibility (reduced motion, colour-blind-safe, scalable text).
- **R8 — Sustain (ongoing).** Auto-track XWA points updates, optionally add 2.0 Legacy as a selectable format, open-source the code, cover hosting via donations.

**Built-in from R1, surfaced later:** identity, invite codes, and the deterministic event log are all foundations laid in the MVP, even though their richer forms — full accounts in R2, the replay viewer in R6 — ship later. Recording every game from day one is what lets the replay system be *seamless* rather than reconstructed after the fact.

**Definition of "complete":** any legal XWA squad — built in-app or imported via XWS — played through a 2.5 scenario, online or solo, on phone or desktop, with a community layer that reliably finds you a game.

---

## 13. Visual direction — it has to feel like miniatures

People love X-Wing for the models. A digital version built on flat tokens throws away the main reason the game is loved, so the visual target is **physical-looking miniatures on a tabletop**, not a 2D board.

- **Render in 3D.** Ships are objects on a mat, lit with soft directional light and ambient occlusion, casting real shadows. A gentle perspective camera (not flat top-down) so they read as physical things.
- **Painted-plastic materials.** Matte surfaces with painted detail and basing — the look of a pre-painted mini, not a glossy game asset.
- **Physical props.** Maneuver templates, range rulers, and the dial should look and move like the real components players already know.
- **Tactile motion.** Ships glide along templates; dials click; dice tumble — motion reinforces physicality (respect reduced-motion).
- **Quality climbs over time.** Behind the `BoardRenderer` interface (see architecture): placeholder/low-poly models in R1, with model, material, and effect quality improving each release — engine logic never changes.

**Assets & IP:** source original or community-made 3D models (as Fly Casual does), in glTF, kept non-commercial in line with the fan-project posture. If the project ever went commercial, the ships would need to become original "spiritual-successor" designs — the same fork as the rest of the IP question.

---

## 14. Sandbox mode (eventual feature)

A free-form mode, paired with squad building: drop your ships on the mat, position them freely, and experiment — dry-run maneuvers to see where a dial lands, check arcs and ranges, try options — then **toggle into a real turn-based game** from the current arrangement, or pause a live game to experiment and step back out.

**Where it lands:** the basic version ships with the **squad builder (R2)** — "build a list and try it on the table." A richer version (drop a sandbox setup straight into a full game; pause/experiment mid-game) follows once the engine handles arbitrary ships (R3+).

**Why it's cheap if planned:** it needs no separate engine. As long as the geometry tools are callable outside the turn FSM and `GameState` can be built from arbitrary placements (an R1 design note in the architecture), sandbox is a thin UI layer over the existing engine. It also doubles as a **learning tool** — try maneuvers without a live opponent — complementing the R7 tutorial and AI work.
