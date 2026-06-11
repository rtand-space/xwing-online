# X-Wing Online

A free, non-commercial, web-first fan adaptation of the X-Wing 2.5 miniatures game — turn-based, playable async in a browser on a phone.

> Fan project. Not endorsed by or affiliated with Atomic Mass Games. Go buy the real models.

**Play:** https://xwing-online.pages.dev — host a game, share the `?game=…` link, and fly.

## Status

**R1 (core dogfight MVP) is shipped and live.** Two iconic ships (T-65 X-wing vs TIE/ln), the full round loop, real geometry, combat, hot-seat and online 1v1 with invite codes, async + "your turn" notifications, and refresh-resilient play. See [`docs/r1-progress.md`](docs/r1-progress.md). Next up: R2 (squad builder + full data layer).

## Monorepo

pnpm workspaces; TypeScript end-to-end. The rules engine is pure and shared by client and server.

| Package                            | What                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------ |
| [`@xwing/engine`](packages/engine) | Pure, deterministic, event-sourced rules engine (no I/O). Commands → events → state. |
| [`@xwing/data`](packages/data)     | Card data over an xwing-data2-shaped schema + the XWS squad format.                  |
| [`@xwing/client`](packages/client) | React + Vite PWA; SVG board, board-first shell.                                      |
| [`@xwing/server`](packages/server) | Cloudflare Worker: one Durable Object per game + D1 index.                           |

## Develop

```bash
pnpm install
pnpm test            # vitest across packages
pnpm typecheck       # strict TS
pnpm lint            # eslint
pnpm --filter @xwing/client dev    # client on :5173
pnpm --filter @xwing/server dev    # local Worker + DO + D1 on :8787 (no account)
```

Deploy steps: [`docs/deploy.md`](docs/deploy.md).

## Docs

- [`docs/project-brief.md`](docs/project-brief.md) — what this is, locked decisions
- [`docs/xwing-game-spec.md`](docs/xwing-game-spec.md) — game system, MVP scope, R1–R8 roadmap
- [`docs/r1-architecture.md`](docs/r1-architecture.md) — technical design
- [`docs/r1-backlog.md`](docs/r1-backlog.md) · [`docs/r1-progress.md`](docs/r1-progress.md) — tickets & live status
