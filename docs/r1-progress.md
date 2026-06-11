# R1 Progress

Live status of the [R1 backlog](r1-backlog.md). Source of truth for ticket state — the launch tracker gets a coarse update only when a whole milestone closes.

Status: ☐ not started · ◐ in progress · ☑ done

## M0 — Project setup

- ☑ **T0.1** Monorepo + tooling — pnpm workspaces, 4 packages, TS strict, ESLint + Prettier, Vitest, CI. _green: typecheck, test, lint, format._
- ☑ **T0.2** Data access layer (`@xwing/data`) — typed loaders by xws id over a vendored xwing-data2-shaped subset, dial-code parser, card→`ShipInit` bridge, and XWS parse/serialize (round-trips). _Curated R1 subset (2 ships); full dataset pull is R2._

## M1 — Engine core

- ☑ **T1.1** Domain types — `types.ts`, `commands.ts`, `events.ts` (discriminated unions).
- ☑ **T1.2** Event log + reducer — `apply.ts` (pure fold), `reduce.ts`, `setup.ts`, `game.ts`.
- ☑ **T1.3** Phase state machine — `phases.ts` auto-transitions; planning→system→activation→engagement→end→next.
- ☑ **T1.4** Pending-decisions engine — `pending.ts`; legal options only, stress gating.
- ☑ **T1.5** Seeded RNG + dice as events — `rng.ts`, `dice.ts`; results recorded, never re-rolled.
- ☑ **T1.6** Per-player view projection — `view.ts`; redacts unrevealed dials.
- ☑ **T1.7** Engine test harness — `harness.ts` + golden/property/replay tests (25 passing).

_Movement (ExecuteManeuver) and combat (DeclareAttack) are stubbed: real geometry lands in M2, combat resolution in M3. The command/event shape is final._

## M2 — Geometry

- ☑ **T2.1** Coordinate system + bases — `geometry.ts`; mm coords, square base polygons per size.
- ☑ **T2.2** Maneuver templates — `templates.ts`; straight/bank/turn/koiogran as rigid transforms, golden-tested.
- ☑ **T2.3** Collisions (SAT) — `geometry.ts` SAT + `movement.ts` back-off along the template.
- ☑ **T2.4** Arcs + range bands — `arcs.ts`; front-arc bearing test, range bands 1/2/3.
- ☑ **T2.5** Wire movement into Activation — real placement in `ExecuteManeuver`; a bumped ship forfeits its action.

## M3 — Combat pipeline

- ☑ **T3.1** Attack sub-FSM with named timing windows — `combat.ts` `ATTACK_WINDOWS`; ordered, hookable extension points (R3-ready).
- ☑ **T3.2** Dice + range bonuses — range-1 attacker / range-3 defender extra die (obstruction stubbed, no R1 obstacles).
- ☑ **T3.3** Modification — focus change + lock reroll, rerolls before changes, tokens spent.
- ☑ **T3.4** Damage resolution — shields→hull, crit tracking, `ShipDestroyed` at 0 hull.
- ☑ **T3.5** Wire into Engagement + win condition — targets gated by arc+range; a wiped side sets `gameOver`.

_R1 modification is auto-resolved (no interactive `modify-dice` step yet); the windows make adding it — and card abilities — a hook registration in R3, not a rewrite._

## M4 — Hot-seat client (fun gate)

- ☑ **T4.1** App shell — Vite + React + TS, Zustand store, engine running locally, PWA manifest, setup screen, data-driven games (`@xwing/data` presets), starfield play area. _(offline SW + web-push deferred to M6.)_
- ◐ **T4.2** Board renderer — `BoardRenderer` interface + **SVG** renderer (the architecture's documented fallback). 3D react-three-fiber variant deferred (needs glTF ship assets).
- ◐ **T4.3** Dial + template placement — tap-to-set dial + a dashed landing-preview ghost of the revealed dial; drag-to-place with snapping still pending.
- ◐ **T4.4** Actions + tokens UI — action buttons + skip; focus/evade/stress/lock badges drawn under each ship.
- ◐ **T4.5** Attack UI — target selection + dice faces and damage shown as a log readout; no dice animation yet.
- ☑ **T4.6** Pass-and-play round — full hot-seat round on one device, with a pass-the-device screen that keeps dials secret.

_Playable end-to-end via a pending-decision-driven UI: `pnpm --filter @xwing/client dev`. The fun-gate verdict (and whether to invest in 3D) is yours._

## M5 — Transport + persistence (Cloudflare)

- ☑ **T5.1** Durable Object per game — `@xwing/server`: `GameDO` (SQLite-backed) persists the event log; HTTP intake creates a game, validates commands against authoritative state + `pending`, and serves redacted per-viewer snapshots. Verified locally via `wrangler dev` (no account). Engine logic stays pure in `game-store.ts`.
- ☑ **T5.2** WebSocket sync + hibernation — hibernatable WS (`acceptWebSocket`, handler methods, `serializeAttachment`, ping/pong auto-response); commands broadcast a redacted view per viewer. Verified: 2 live clients sync, opponent dial stays hidden. _Full snapshots, not yet diffs._
- ☑ **T5.3** HTTPS command intake (async) — same `applyAndBroadcast` path; an HTTP-posted command advances the game identically and updates live sockets.
- ☑ **T5.4** Reconnection — on WS connect (or GET) the DO sends a fresh redacted snapshot, so a dropped client resumes correct state. _Events-since-index is a later optimization._
- ☑ **T5.5** Client transport layer — `transport.ts` (REST host/join + WS), `online-store.ts`, `OnlineGame` view; commands go to the server, the server-projected view is the only truth (no client-side rule authority). Server-authoritative; optimistic prediction deferred.
- ☑ **T5.6** D1 cross-game schema — `migrations/0001_init.sql` (games + game_players); Worker `/index/:id` query; DO best-effort indexes on create. Verified locally (`wrangler d1 migrations apply --local`). Real `database_id` needed at deploy.

## M6 — Identity, invites, async, notifications

- ☑ **T6.1** Guest identity — durable per-device id (`identity.ts`, localStorage); server binds it to a seat and derives command ownership from it. _Signed JWT is a later hardening._
- ☑ **T6.2** Invite-code system — host creates a game → short code + shareable `?game=` link; join by code; seats fill in order.
- ◐ **T6.3** Async parking + resume — game lives in the DO and parks while the other side is offline; same-device reconnect resumes via snapshot-on-connect. _Cross-device resume needs portable identity (R2 accounts)._
- ☑ **T6.4** Web-push notifications — VAPID web push end to end: service worker (`public/sw.js`), client subscribe (`push.ts`), DO stores subscriptions per seat and sends a "your turn" push when the next player isn't connected. _Enable in prod: `wrangler secret put VAPID_PRIVATE_KEY` + redeploy; on-device delivery is verified by the user._

## M7 — Squads, polish, ship it

- ☑ **T7.1** Preset squads — XWS presets + a real per-side squad builder (`pilotChoices`/`buildConfig`) on the setup screen. Full loadout/points builder is still R2.
- ◐ **T7.4** Launch surfaces — fan-project disclaimer on setup + in-game footer; error boundary; empty-state hints in builder/controls. Polished error/empty copy ongoing.

## UX parking lot (tracked, not yet scheduled)

- ~~Clean ship-status display~~ ✅ Done: `roster.tsx` status panel (hull/shield pips + token chips) + tidy on-board hull/shield bar and token dots. Renderer-agnostic (reads `PlayerView`), so it survives the eventual 3D board.
- **Cards / upgrades display** — inherently **R2+** (R1 has no upgrades). Design alongside the R2 squad/loadout builder; damage-card UI with the R3/R4 crit deck.
- ◐ **T7.2** Mobile polish + a11y — clean roster status panel (hull/shield pips + token chips) replacing the cramped on-board text; board now shows a tidy hull/shield bar + token dots; focus-visible rings, reduced-motion, 44px touch targets. _Deeper perf/responsive pass ongoing._
- ☐ **T7.3** End-to-end hardening
- ☐ **T7.4** Launch surfaces
