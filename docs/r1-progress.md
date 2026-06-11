# R1 Progress

Live status of the [R1 backlog](r1-backlog.md). Source of truth for ticket state — the launch tracker gets a coarse update only when a whole milestone closes.

Status: ☐ not started · ◐ in progress · ☑ done

## M0 — Project setup

- ☑ **T0.1** Monorepo + tooling — pnpm workspaces, 4 packages, TS strict, ESLint + Prettier, Vitest, CI. _green: typecheck, test, lint, format._
- ☐ **T0.2** Data access layer (`@xwing/data`)

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

- ☐ **T2.1** Coordinate system + bases
- ☐ **T2.2** Maneuver templates
- ☐ **T2.3** Collisions (SAT)
- ☐ **T2.4** Arcs + range bands
- ☐ **T2.5** Wire movement into Activation

## M3 — Combat pipeline

- ☐ **T3.1** Attack sub-FSM with named timing windows
- ☐ **T3.2** Dice + range bonuses
- ☐ **T3.3** Modification
- ☐ **T3.4** Damage resolution
- ☐ **T3.5** Wire into Engagement + win condition

## M4 — Hot-seat client (fun gate)

- ☐ **T4.1** App shell
- ☐ **T4.2** 3D board renderer
- ☐ **T4.3** Dial + template placement
- ☐ **T4.4** Actions + tokens UI
- ☐ **T4.5** Attack UI
- ☐ **T4.6** Pass-and-play round

## M5 — Transport + persistence (Cloudflare)

- ☐ **T5.1** Durable Object per game
- ☐ **T5.2** WebSocket sync + hibernation
- ☐ **T5.3** HTTPS command intake (async)
- ☐ **T5.4** Reconnection
- ☐ **T5.5** Client transport layer
- ☐ **T5.6** D1 cross-game schema

## M6 — Identity, invites, async, notifications

- ☐ **T6.1** Guest identity
- ☐ **T6.2** Invite-code system
- ☐ **T6.3** Async parking + resume
- ☐ **T6.4** Web-push notifications

## M7 — Squads, polish, ship it

- ☐ **T7.1** Preset squads
- ☐ **T7.2** Mobile polish + a11y
- ☐ **T7.3** End-to-end hardening
- ☐ **T7.4** Launch surfaces
