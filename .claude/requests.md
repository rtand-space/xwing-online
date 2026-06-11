# Request log

A running record of notable requests, the decisions made, and outcomes. Newest at top.

| Date | Request | Decision / outcome |
|------|---------|--------------------|
| 2026-06-10 | Drive M1–M3, clean per-milestone commits | Built the pure engine in `@xwing/engine`: **M1** core (event-sourced reducer, phase FSM, pending decisions, RNG, view projection), **M2** geometry (templates, SAT collisions, arcs/range), **M3** combat (named timing windows, dice/range, modification, damage, win condition). 56 tests; each milestone a separate commit. Launch-tracker Web-MVP flags updated for engine-complete items. Stops before M4 (fun gate / 3D art) and M5–M6 (Cloudflare account). |
| 2026-06-10 | Begin implementing R1; track progress | Tracking via `docs/r1-progress.md` (ticket source of truth), not the launch tracker (which is a coarse executive view). Completed **T0.1**: pnpm monorepo (engine/data/client/server), TS strict, ESLint 10 + Prettier, Vitest, GitHub Actions CI. All checks green. |
| 2026-06-10 | Set up a `.claude/` config folder to track and maintain requests | Created `.claude/settings.json`, root `CLAUDE.md` (project context + locked decisions), and this log. |
