# X-Wing Online — Project Brief (read first)

Orientation for this project. Read this, then the three detail docs. This file exists so any new chat can pick up with full context.

---

## What this is

A **free, non-commercial, web-first fan adaptation** of the X-Wing 2.5 miniatures game — turn-based, playable async in a browser on a phone — built to solve one problem: *it's hard to find people to play with locally.* If the online experience is good, people will play.

## Status snapshot

- **Concept phase complete.** Problem, target user, IP approach, and points standard are settled.
- **R1 (MVP) is fully planned** — spec, architecture, cost model, and a developer backlog all exist and are mutually consistent.
- **Not yet built.** Next action is starting the engine, or drafting the first ticket in code.
- **Project Two** (a second, separate idea) is on the tracker but not yet mapped.

## Locked decisions (respect these unless explicitly revisited)

- **Free fan project**, web-only, never monetized — carries a "fan project, not endorsed, buy the real models" disclaimer. (Going commercial would require original "spiritual-successor" ships; not the current path.)
- **Points standard: XWA (2.5 loadout)** first; 2.0 Legacy maybe later.
- **Data is community-sourced, never hand-maintained:** build on **xwing-data2** for cards, **XWS** as the native squad format (interop with YASB / Launch Bay Next), and pull **XWA community points** dynamically (versioned, cached).
- **Engine:** one pure, deterministic, **event-sourced** TypeScript package shared by client and server; dice results recorded as events; per-player view projection keeps dials secret; named timing windows so the future ability engine bolts on without a rewrite.
- **Hosting: Cloudflare** (Workers + one Durable Object per game + D1 + R2). **No AWS.** Free to start; ~$5/mo when traffic grows; domain (~$12/yr) is the only certain cost.
- **Experience-first + mobile-first**, and **3D "miniatures on a tabletop" visuals** (react-three-fiber, placeholder models in R1, quality climbing each release).
- **Invite codes, guest identity, and event-log recording** are in the MVP; full **accounts** at R2; **replay viewer** at R6.

## The documents in this project

- **launch-tracker** — interactive, space-themed board tracking both projects through their phases. Project One (X-Wing) is in the Web MVP phase.
- **xwing-game-spec** — the full game system (round loop, movement, combat, tokens, squad building/points), the data layer, the MVP definition, the R1–R8 roadmap, visual direction, and sandbox mode.
- **r1-architecture** — the concrete technical design: the pure engine, determinism, hidden-info handling, geometry, data model, tech stack with rationale, networking, and why it scales.
- **r1-backlog** — R1 broken into ~35 developer-ready tickets across 8 milestones, each with size, dependencies, and a "done when."

## Roadmap at a glance

R1 core dogfight (MVP) → R2 squad builder + data layer + accounts → R3 roster + ability engine → R4 full rules surface → R5 scenario play → R6 community + replays → R7 onboarding + solo AI → R8 sustain. *Sandbox mode lands with R2.*

## Open threads / next steps

1. Draft the first engine tickets (T0.1 / T1.1) in real code.
2. Give **Project Two** the same end-to-end treatment.
3. (Optional) add a dated cost section to the architecture doc.

---

## Suggested project instructions (paste into the project's custom instructions)

> You're helping build **X-Wing Online**, a free, non-commercial, web-first fan adaptation of the X-Wing 2.5 miniatures game. Before answering, ground yourself in the project docs (brief, spec, architecture, backlog). Honor the locked decisions in the brief: free fan project, XWA 2.5 points, build on xwing-data2 + XWS, a pure deterministic event-sourced TypeScript engine, Cloudflare hosting (no AWS), mobile-first 3D "miniatures" visuals. When one doc changes, keep the others consistent. Default to concise, opinionated, senior-engineer guidance; flag tradeoffs honestly; search the web for anything current (pricing, community data sources). Don't reproduce copyrighted card text or art.

## How to inject everything (one-time setup)

1. Create a new Project in the app, name it *X-Wing Online*.
2. Add these five files to the project's knowledge: this brief plus **xwing-game-spec**, **r1-architecture**, **r1-backlog**, and (optionally) the **launch-tracker** code.
3. Paste the suggested instructions above into the project's custom-instructions field.
4. Start a new chat inside the project — it'll begin with full context.
