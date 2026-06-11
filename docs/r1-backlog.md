# X-Wing Online — R1 Developer Backlog

R1 broken into sequenced, actionable tickets. Built from the R1 Architecture doc; follows the same build order (engine first, hot-seat before networking). Hand these to a developer (or work them yourself) top to bottom — within a milestone, tickets can often run in parallel, but milestones are mostly sequential.

**Conventions**
- Each ticket: **ID · title · size (S/M/L) · depends-on**, then a *Done when* acceptance line. Sizes are relative complexity, not time.
- **Global Definition of Done:** TypeScript strict passes, unit tests cover the logic, lint/format clean, no `any` in engine code, merged behind review.
- The engine (`@xwing/engine`) is **pure** — no network, storage, or DOM. If a ticket in M1–M3 reaches for I/O, it's in the wrong package.

**Critical path**

```
M0 setup ─▶ M1 engine core ─▶ M2 geometry ─▶ M3 combat ─▶ M4 hot-seat ◀── "is it fun?" gate
                                                              │
                                                              ▼
                                          M5 transport ─▶ M6 identity/invite/async ─▶ M7 ship it
```

M4 is the gate: don't start M5 networking until a hot-seat game feels good.

---

## M0 — Project setup

*Goal: an empty but correct skeleton everything drops into.*

- **T0.1 · Monorepo + tooling · M · —**
  pnpm workspaces (or Turborepo). Packages: `engine`, `data`, `client`, `server`. TS strict everywhere, shared tsconfig, ESLint + Prettier, Vitest, a CI workflow running typecheck + tests.
  *Done when:* `pnpm test` and `pnpm typecheck` run green across all packages in CI.

- **T0.2 · Data access layer (`@xwing/data`) · M · T0.1**
  Vendor or pull xwing-data2; typed loaders to fetch a ship/pilot/upgrade by `xws` id; parse and serialize the XWS squad format.
  *Done when:* given an `xws` id you get back typed stats; a sample XWS squad round-trips parse→serialize unchanged.

---

## M1 — Engine core (pure, no UI)

*Goal: drive a full round by commands, with movement/combat stubbed, and have it be deterministic and correctly redacted.*

- **T1.1 · Domain types · M · T0.1**
  `GameState`, `Ship`, `Player`, `Phase`, `Token`, `Maneuver`, `Position`. Discriminated unions for `Command` and `GameEvent` (R1 set only).
  *Done when:* types compile; an exhaustive `switch` over `Command`/`GameEvent` is enforced by the compiler.

- **T1.2 · Event log + reducer · L · T1.1**
  `apply(state, event)` pure fold; `reduce(state, cmd, ctx) → { events, rejection? }`; `initialState(squadA, squadB, seed)`.
  *Done when:* a scripted command list folds to a stable state; invalid commands return a rejection without mutating state.

- **T1.3 · Phase state machine · M · T1.2**
  Planning → System → Activation → Engagement → End → next round, with guards; emits `PhaseAdvanced`.
  *Done when:* the machine advances only when each phase's exit conditions are met; transitions covered by tests.

- **T1.4 · Pending-decisions engine · L · T1.3**
  After each event, compute `pending[]` — who owes what, with **legal options precomputed server-side**.
  *Done when:* in Planning both players owe a dial; in Activation exactly one ship (by ascending initiative) owes move+action; querying `pending` never reveals illegal options.

- **T1.5 · Seeded RNG + dice as events · S · T1.2**
  Deterministic PRNG; rolls recorded as `DiceRolled` result events (never re-derived on replay).
  *Done when:* replaying an event log reproduces identical outcomes without re-rolling.

- **T1.6 · Per-player view projection · M · T1.2**
  `projectView(state, viewerId)` redacts unrevealed dials and any future hidden state.
  *Done when:* opponent's view omits a set-but-unrevealed dial; owner's view includes it; reveal event exposes it to both.

- **T1.7 · Engine test harness · M · T1.2**
  Golden-master + property tests; record real games as fixtures and replay them in CI.
  *Done when:* a fixture game replays to a byte-identical final state in CI.

---

## M2 — Geometry

*Goal: ships move and shoot by real-world geometry.*

- **T2.1 · Coordinate system + bases · S · T1.1**
  Board in millimetres; `Position {x,y,angle}`; base rectangles per size (small/medium/large).
  *Done when:* positions and base polygons compute correctly for each base size.

- **T2.2 · Maneuver templates · L · T2.1**
  Straight 1–5, bank, turn, K-turn as rigid transforms; execute maneuver → new placement.
  *Done when:* golden cases match expected end positions/angles for each template+speed the two R1 ships use.

- **T2.3 · Collisions (SAT) · M · T2.2**
  Base-polygon overlap via Separating Axis Theorem; on overlap, back off along the template and skip the action.
  *Done when:* overlapping moves resolve to the last legal position and flag the skipped action.

- **T2.4 · Arcs + range bands · M · T2.1**
  In-arc test (bearing vs half-angle); range bands 1/2/3 by nearest-point distance.
  *Done when:* arc and range results match golden cases at boundary distances/angles.

- **T2.5 · Wire movement into Activation · M · T2.2, T1.4**
  Reveal dial → execute maneuver → apply stress for red → offer action.
  *Done when:* a stressed ship is barred from actions and red maneuvers; blue maneuvers clear stress.

---

## M3 — Combat pipeline

*Goal: attacks resolve correctly, with the R3 hook points already in place.*

- **T3.1 · Attack sub-FSM with named timing windows · M · T1.3**
  `onDeclare → onRollAttack → onModifyAttack → onRollDefence → onModifyDefence → onCompare → onDealDamage → onAfterAttack`. No subscribers yet — the windows just exist.
  *Done when:* an attack walks every window in order; each window is an extension point a future card could hook.

- **T3.2 · Dice + range bonuses · M · T3.1, T1.5, T2.4**
  Attack/defence dice faces; range-1 attacker bonus, range-3 defender bonus, obstruction die.
  *Done when:* dice pools reflect range and obstruction correctly.

- **T3.3 · Modification · M · T3.2**
  Focus token and target-lock reroll, with correct ordering (rerolls before changes).
  *Done when:* focus/lock change results in the right order; tokens are spent correctly.

- **T3.4 · Damage resolution · M · T3.3, T0.2**
  Hits/crits vs evades; shields→hull; a small crit set; `ShipDestroyed`.
  *Done when:* shields absorb first, crits hit hull face-up, a ship at 0 hull is destroyed.

- **T3.5 · Wire into Engagement + win condition · S · T3.4, T1.4**
  Descending-initiative attack order, one attack per ship; elimination → `GameOver`.
  *Done when:* a full round of move-then-shoot resolves and a wiped-out side ends the game.

---

## M4 — Hot-seat client (the "is it fun?" gate)

*Goal: a full game playable on one phone, no network. Validate the loop before building the hard part.*

- **T4.1 · App shell · M · T0.1**
  React + Vite + TS, PWA scaffold, Zustand store, engine running locally in the browser.
  *Done when:* the app boots, holds a game in memory, and applies commands through the real engine.

- **T4.2 · 3D board renderer · L · T4.1, T2.1**
  react-three-fiber (Three.js) behind a `BoardRenderer` interface: tabletop mat, ships as 3D models (placeholder/low-poly in R1), soft lighting + shadows, orbit/pan/pinch-zoom camera.
  *Done when:* ships render as 3D objects at correct positions/scale with shadows, and the camera pans/zooms smoothly on a phone.

- **T4.3 · Dial + template placement · L · T4.2, T2.2**
  Tap-to-set maneuver dial; template preview; drag-to-place with snapping.
  *Done when:* a player sets a dial and places the resulting move with snapping that matches the engine's result.

- **T4.4 · Actions + tokens UI · M · T4.2**
  Focus / lock / barrel roll / evade; token and stress display.
  *Done when:* available actions reflect the ship's bar and stress state; tokens show correctly.

- **T4.5 · Attack UI · M · T4.4, T3.5**
  Target selection, dice animation that **awaits** results (never fakes a roll), damage readout.
  *Done when:* an attack plays out visually and matches the engine's resolved outcome.

- **T4.6 · Pass-and-play round · M · T4.3, T4.5, T1.6**
  Hide the setting player's dial during Planning; full round on one device.
  *Done when:* two people can play a complete game hot-seat on a single phone. **← fun gate**

---

## M5 — Transport + persistence (Cloudflare)

*Goal: the same engine, now authoritative on the server, synced to clients.*

- **T5.1 · Durable Object per game · L · T1.2**
  One DO holds a game; event log in SQLite-backed DO storage; command intake validates against authoritative state and `pending`.
  *Done when:* a game lives in a DO, persists its log, and rejects illegal/unauthorized commands.

- **T5.2 · WebSocket sync + hibernation · L · T5.1, T1.6**
  Push redacted view-diffs to connected clients; use the hibernation API; handle connect/disconnect.
  *Done when:* two live clients stay in sync; an idle game hibernates and wakes on the next command.

- **T5.3 · HTTPS command intake (async) · S · T5.1**
  Same DO accepts commands via POST when a player isn't connected.
  *Done when:* a move submitted over HTTP advances the game identically to a WS move.

- **T5.4 · Reconnection · M · T5.2**
  On connect, send a redacted snapshot or events-since-index.
  *Done when:* a client that drops and rejoins resumes with correct, redacted state.

- **T5.5 · Client transport layer · M · T5.2, T4.6**
  Send commands (WS/HTTP); apply server view-diffs; optimistic prediction for deterministic commands; await server for dice.
  *Done when:* the hot-seat client now plays against the server with no client-side rule authority.

- **T5.6 · D1 cross-game schema · S · T0.1**
  Tables for games index, users, squads, replay index.
  *Done when:* a created game and its participants are queryable from D1.

---

## M6 — Identity, invites, async, notifications

*Goal: two strangers-with-a-link can start and finish a game across days.*

- **T6.1 · Guest identity · M · T5.6**
  Signed JWT with a stable anonymous id, stored client-side; server-side ownership checks.
  *Done when:* a guest has a durable id used for ownership, with no signup.

- **T6.2 · Invite-code system · M · T5.1, T6.1**
  Create game → short code + link; join by code.
  *Done when:* one player creates a game and shares a code; another joins into the same DO.

- **T6.3 · Async parking + resume · M · T5.3, T6.1**
  Park when waiting on an offline player; resume on any device.
  *Done when:* a game left mid-turn resumes correctly from a different device/session.

- **T6.4 · Web-push notifications · M · T1.4, T6.1**
  VAPID web push to whoever now owes the next decision.
  *Done when:* finishing your turn fires a "your turn" push to the opponent.

---

## M7 — Squads, polish, ship it

*Goal: soft-launch ready.*

- **T7.1 · Preset squads · S · T3.5, T0.2**
  A few balanced presets (e.g. 2 X-wings vs 3 TIEs) selectable at game start.
  *Done when:* players pick a preset per side and start a legal game.

- **T7.2 · Mobile polish + a11y · M · T4.2**
  Controls/perf pass; reduced motion; colour-blind-safe; scalable text; visible focus.
  *Done when:* the board is comfortable one-handed and passes a basic accessibility check.

- **T7.3 · End-to-end hardening · M · T5.5, T6.3**
  Full online async game across two devices; reconnection; replay-log integrity check.
  *Done when:* a complete cross-device async game plays through and its event log replays cleanly.

- **T7.4 · Launch surfaces · S · T7.1**
  "Fan project, not endorsed — buy the real models" disclaimer; error/empty states.
  *Done when:* the disclaimer is present and failure/empty screens read clearly.

---

## Where to be careful

Two tickets carry outsized risk; give them your strongest attention:

- **T3.1 (timing windows).** If the attack pipeline isn't built as ordered extension points now, the R3 ability engine becomes a rewrite. This is the cheapest insurance in the whole project — get the window names and order right.
- **T5.1 / T5.2 (Durable Object + sync).** The authority-and-redaction boundary is what keeps secret dials secret and turns un-forgeable. Test it adversarially: a client must never be able to read hidden state or act out of turn.

## Sequencing notes

- **Parallelizable:** T0.2 (data) and M4's app shell (T4.1) can proceed alongside M1; geometry (M2) and combat (M3) are sequential after the engine core.
- **Hold the line at M4.** Resist starting M5 until the hot-seat game is genuinely enjoyable — networking multiplies the cost of every gameplay change made after it lands.
