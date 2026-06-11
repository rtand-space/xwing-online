# X-Wing Online

Free, non-commercial, web-first fan adaptation of the X-Wing 2.5 miniatures game — turn-based, async-playable in a browser on a phone. Concept phase complete, R1 (MVP) fully planned, **not yet built**.

## Read first

Ground every answer in the project docs before acting:

- [`docs/project-brief.md`](docs/project-brief.md) — orientation, locked decisions, open threads
- [`docs/xwing-game-spec.md`](docs/xwing-game-spec.md) — game system, MVP scope, R1–R8 roadmap, visuals
- [`docs/r1-architecture.md`](docs/r1-architecture.md) — concrete technical design for the MVP
- [`docs/r1-backlog.md`](docs/r1-backlog.md) — ~35 tickets across 8 milestones

## Locked decisions (respect unless explicitly revisited)

- **Free fan project**, web-only, never monetized; carries the "fan project, not endorsed, buy the real models" disclaimer. Never reproduce copyrighted card text or art.
- **Points standard: XWA (2.5 loadout)** first; 2.0 Legacy maybe later.
- **Data is community-sourced, never hand-maintained:** xwing-data2 for cards, XWS as the native squad format, XWA community points pulled dynamically (versioned, cached).
- **Engine:** one pure, deterministic, **event-sourced** TypeScript package shared by client and server. Commands → Events → State. Dice results recorded as events. Per-player view projection keeps dials secret. Named timing windows so the R3 ability engine bolts on without a rewrite.
- **Hosting: Cloudflare** (Workers + one Durable Object per game + D1 + R2). **No AWS.**
- **Mobile-first**, experience-first, **3D "miniatures on a tabletop"** visuals (react-three-fiber, placeholder models in R1).
- Invite codes, guest identity, event-log recording in MVP; full accounts at R2; replay viewer at R6.

## Stack

TypeScript end-to-end in a pnpm/Turborepo monorepo. Packages: `engine` (pure rules, no I/O), `data` (xwing-data2 + XWS), `client` (React + Vite PWA, Zustand, react-three-fiber), `server` (Cloudflare Workers + Durable Objects). The engine and data packages are shared by client and server.

## Working style

Concise, opinionated, senior-engineer guidance. Flag tradeoffs honestly. When one doc changes, keep the others consistent. The pure engine invites golden-master and property-based tests — a rules engine you can't test will rot. Events are a forever contract: version payloads, keep changes additive.

## Tracking requests

Log notable requests, decisions, and their outcomes in [`.claude/requests.md`](.claude/requests.md) so work stays traceable across sessions.
