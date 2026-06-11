# X-Wing Online — R1 Architecture

The build plan for the MVP (R1), designed so the foundation carries all the way to the full rules engine, scenarios, and community layer without being rebuilt. Companion to the Game & Data Spec.

---

## 1. The one idea everything hangs on

**A pure, deterministic, event-sourced rules engine that knows nothing about networking, storage, or UI.** Everything else plugs into it.

```
            ┌─────────────────────────────┐
            │   @xwing/engine  (pure TS)   │   ← rules live here, nowhere else
            │   commands → events → state  │
            └──────────────┬──────────────┘
        runs on server ────┼──── runs on client
   (authoritative truth)   │   (optimistic prediction, validation)
            ┌──────────────┴──────────────┐
            │ transport · storage · UI     │   ← swappable infrastructure
            └─────────────────────────────┘
```

The engine is one TypeScript package with no I/O. It runs **server-side as the source of truth** and **client-side for instant feedback**. Because both sides run the same code, rules never drift, the client can predict deterministic outcomes, and the whole rulebook is unit-testable in isolation. This single boundary is what lets you grow from two ships to hundreds of cards without touching the plumbing.

---

## 2. Engine core

### Commands → Events → State

Three distinct concepts, kept strictly separate:

- **Commands** are player *intent*: `SetDial`, `ExecuteManeuver`, `PerformAction`, `DeclareAttack`, `ModifyDice`, `Confirm`. They can be rejected.
- **Events** are immutable *facts* that happened: `DialSet`, `ShipMoved`, `DiceRolled`, `DamageDealt`, `ShipDestroyed`, `PhaseAdvanced`. They are the source of truth, append-only.
- **State** is a left-fold over events: `state = events.reduce(apply, initial)`. The materialised state is just a cache.

```ts
type Reduce = (state: GameState, cmd: Command, ctx: Ctx)
  => { events: GameEvent[]; rejection?: string };

const apply = (state: GameState, e: GameEvent): GameState => { /* pure */ };
```

A command is validated against current state, produces events, and the events are applied. Nothing mutates state directly.

### Determinism (this is what makes replays free)

The only randomness is dice. **The server rolls and records the *results* as events** (`DiceRolled: ["hit","focus","blank"]`), not a seed to be re-derived. Replaying a game is therefore pure event-folding — no RNG re-run, no dependence on engine version for past outcomes. Store the PRNG seed too, for audit, but never depend on re-rolling it.

Make events **fat enough to reconstruct the timeline on their own** (record resulting positions, damage applied, tokens changed). That way the replay viewer never needs to re-run rules logic, so a future rules change can't corrupt an old replay. The rules engine is needed only to generate the *next* event during live play.

### The round as a state machine

The phases are an explicit FSM: `Planning → System → Activation → Engagement → End → (next round)`. The attack resolution is a nested sub-machine (declare → roll → modify → compare → damage). Model these as named states so timing is unambiguous.

### Pending decisions — the backbone of async *and* live

After every event, the engine recomputes **who owes what input**:

```ts
interface PendingDecision {
  playerId: string;
  type: "set-dial" | "choose-action" | "modify-dice" | "declare-attack" | ...;
  options: unknown;   // legal choices, precomputed server-side
}
state.pending: PendingDecision[]
```

In Planning both players owe a dial (parallel). In Activation it's one ship at a time in ascending initiative. The client renders *only* the current player's pending decisions; the server advances the machine until it needs input, then waits. **Async falls out naturally**: a player resolves their pending decisions whenever they show up; if the next decision belongs to the other player, the game simply parks and a notification fires. Live play is the same loop with both players connected.

### Hidden information — per-player view projection

The secret simultaneous dial is handled by **redaction, not cryptography**. The server holds the full authoritative state; it computes a **filtered view per recipient** before sending. Your set-but-unrevealed dial is in your view and absent from your opponent's until the `DialRevealed` event.

```ts
const projectView = (state: GameState, viewerId: string): PlayerView => { /* redact */ };
```

Because the server is the trusted authority, this is sufficient and far simpler than commit-reveal hashing. (Commit-reveal is only worth it if you ever want a trustless server — note it and move on.) This same mechanism generalises to anything hidden you add later.

---

## 3. Geometry (movement, arcs, range)

Represent the board in **real-world millimetres**, exactly like the tabletop (the mat is ~915 mm square; ranges and templates are physical). Ships have a position `{ x, y, angle }` and a rectangular base.

- **Maneuver templates** are fixed parametric shapes (straight 1–5, bank, turn, K-turn). Precompute each as a rigid transform (translation + rotation) applied to the ship's front guides. Execution is deterministic: pick template → apply transform → that's the new placement.
- **Collisions:** test base-polygon overlap with the **Separating Axis Theorem**. On overlap, back the ship along the template until clear and skip its action (the real rule).
- **Firing arc:** the target is in arc if the bearing to it falls within the ship's arc half-angle relative to its facing — a vector-angle test.
- **Range:** measure nearest-point distance between bases, bucket into bands 1/2/3. Band drives the attack/defence die bonus.

All of this is pure math, lives in the engine, and is covered by golden-case tests.

---

## 4. Data model (shape, not the whole thing)

```ts
interface GameState {
  id: string;
  seed: string;
  round: number;
  phase: Phase;
  players: Player[];
  ships: Ship[];
  obstacles: Obstacle[];   // empty in R1
  pending: PendingDecision[];
  log: GameEvent[];        // the source of truth
}

interface Ship {
  id: string;
  ownerId: string;
  shipXws: string;         // e.g. "t65xwing"  → looked up in xwing-data2
  pilotXws: string;
  pos: { x: number; y: number; angle: number };
  base: "small" | "medium" | "large";
  shields: number;
  hull: number;
  tokens: Token[];         // focus | lock | evade | stress (R1)
  dial?: Maneuver;         // PRIVATE — redacted from opponents until reveal
  upgrades: string[];      // xws ids; empty-ish in R1
}
```

Ship/pilot **stats are derived from xwing-data2 by `xws` id**, never hardcoded. Squads are stored and exchanged as **XWS** so they interoperate with existing builders from day one. Commands and events are TypeScript discriminated unions — exhaustive `switch` handling keeps the compiler enforcing completeness as you add cards.

---

## 5. The forward hook for R3 (do this now, use it later)

R1 has no card abilities, but build the movement and combat pipelines as a sequence of **named timing windows** that fire hooks — even though nothing subscribes yet:

```
attack: onDeclare → onRollAttack → onModifyAttack → onRollDefence
      → onModifyDefence → onCompare → onDealDamage → onAfterAttack
```

When R3 adds the ability engine, a card is just data that **registers handlers on these windows** (`"after rolling attack dice, you may spend a focus to…"`). If the windows exist now, abilities bolt on without reshaping the engine. If they don't, R3 is a rewrite. This is the single most important piece of future-proofing in R1 — it costs almost nothing today.

### A second cheap hook: free positioning (sandbox)

Keep the **geometry tools (templates, arcs, range, placement) callable independently of the turn FSM**, and make **`GameState` constructible from arbitrary ship placements**, not just standard setup. Both are the natural shape anyway, so do them in R1. A future **sandbox mode** — free-place ships, dry-run maneuvers and arcs, then drop into a real turn-based game from the current board, or pause a game to experiment — then becomes a thin UI layer over the same engine rather than a parallel system. Free positioning is just placement commands without the phase machine gating them; "drop into a game" is constructing a real `GameState` from the sandbox board. (See spec §14.)

---

## 6. Technology choices

### Language & shared code
- **TypeScript end-to-end**, in a monorepo (pnpm workspaces or Turborepo). Packages: `engine` (pure rules), `data` (xwing-data2 access + XWS), `client` (UI), `server` (transport/persistence). The engine and data packages are shared by both client and server.

### Frontend
- **React + Vite + TypeScript**, shipped as a **PWA** (installable, offline shell, web-push for "your turn"). React keeps the door open to a React Native wrap later.
- **Board renderer: 3D miniatures from the start, via react-three-fiber (Three.js)**, behind a `BoardRenderer` interface. X-Wing's appeal is *physical models on a table*, so render ships as 3D objects on a tabletop mat with soft lighting and real shadows — not flat tokens. Keep R1 cheap with **placeholder/low-poly models** and improve the art later; the staging (camera, lighting, materials, shadows) is what sells the miniatures feel, not finished sculpts. The interface keeps the engine renderer-agnostic, so model and effect quality climb release over release without touching game logic. (A 2D SVG renderer stays a valid fallback behind the same interface, but visuals are a core differentiator here, so 3D leads.)
- **Ship assets:** glTF/GLB models loaded at runtime and cached on R2; matte "painted-plastic" materials, basing, and soft shadows for the tabletop look. Source original or community-made models (as Fly Casual does) and keep them non-commercial, consistent with the fan-project IP posture.
- **Client state: Zustand** (light). The server-projected view is the truth; local-only UI state (drag in progress, selection) is ephemeral. No Redux ceremony.
- **Interactions:** pan/pinch-zoom board, tap-to-set dial, drag-to-place templates with snapping. Predict deterministic results locally with the shared engine; **await the server for dice** (never fake a roll) — show the dice animating while the authoritative `DiceRolled` event arrives.

### Backend, realtime & hosting — primary recommendation
- **Cloudflare Workers + Durable Objects**, one **Durable Object per game**. A DO is a single-threaded, strongly-consistent actor that holds the game in memory, coordinates both players' WebSockets, and persists its own event log transactionally. With the **WebSocket Hibernation API**, an idle async game costs essentially nothing while still holding connections — which is exactly the shape of turn-based play that may sit untouched for hours or days. This pattern is almost purpose-built for an authoritative online board game, and Cloudflare's pricing is friendly to a free, non-commercial project.
- **Persistence:** the event log is append-only in the game's DO storage. Cross-game data — users, squads, replay index, matchmaking — in **D1** (serverless SQLite). Static card data (xwing-data2) and images served from **R2 + KV** at the edge.
- **Commands arrive two ways into the same DO:** over **WebSocket** when the player is live, or via **HTTPS POST** when they're async (PWA sends the move, DO processes it identically). Reconnect = request a fresh redacted snapshot (or events since last-seen index); trivial because state is a fold over events.

### Alternatives (and when to prefer them)
- **Colyseus on Fly.io** — a room-based authoritative Node framework. Choose it if the team strongly prefers a conventional always-on Node mental model over the actor/edge model. Tradeoff: you manage scaling and pay for idle rooms.
- **Supabase / Postgres + a realtime channel** — fine for the *data* (accounts, squads, replays) and you may use it for those regardless, but it's an awkward home for the authoritative, secret-keeping game loop. Don't put the rules engine behind row-level security.

### Identity (R1)
- **Guest identity**: a signed JWT carrying a stable anonymous id, stored client-side. Enough for ownership, async, and notifications with zero signup friction. R2's account system reuses the same id so a guest upgrades without losing games.

---

## 7. Networking protocol (concise)

1. Client sends a **Command** (WS or HTTPS) with its identity token.
2. The game's DO **validates** it against authoritative state and the actor's `pending` decisions — the client is never trusted about whose turn it is or what's legal.
3. Valid commands produce **Events**, appended to the log; state is updated.
4. The DO recomputes **per-player views** and **pending decisions**, pushes redacted view-diffs to connected clients, and **enqueues web-push notifications** for any offline player who now owes a decision.
5. On reconnect, a client pulls the current redacted snapshot and resumes.

---

## 8. Build order within R1

Front-loaded so "is it fun?" is answered before networking complexity — matching the spec's "hot-seat prototype before networking."

1. **Engine skeleton** — types, phase FSM, event log + reducer, seeded RNG, view projection. Unit-tested with no UI.
2. **Geometry** — templates, execution transforms, SAT overlap, arc/range, with golden tests.
3. **Combat pipeline** — dice as events, the named timing windows, focus/lock modification, shields→hull→damage, a small crit set.
4. **Hot-seat client** — SVG board, dial UI, drag templates, engine running locally. Pass-and-play on one device. *Validate the fun here.*
5. **Transport + persistence** — Durable Object wrapper, WebSocket sync, HTTPS command intake, redacted views, reconnection.
6. **Invite codes + guest identity + async + web-push.**
7. **Preset squads, win condition, mobile polish.**

---

## 9. Cross-cutting concerns

- **Testing:** the pure engine invites golden-master and property-based tests; capture real games as fixtures and replay them in CI. A rules engine you can't test will rot.
- **Events are a forever contract:** version event payloads and keep changes additive; pin replays to a data version. You can change the engine; you can't change history.
- **Security:** authority + redaction means clients literally cannot see secret state or forge turns. Validate every command against identity and `pending`.
- **Observability:** the event log doubles as your audit trail and time-travel debugger — when a game desyncs or a rule misfires, you replay the exact sequence.

---

## 10. Why this scales

| Concern | How the foundation absorbs it |
|---|---|
| Hundreds of cards (R3) | Abilities are data registering on existing timing windows; infra untouched |
| Replays, spectating, reconnection | All fall out of the event log for free |
| Async games idle for days | One Durable Object per game, hibernating at near-zero cost |
| Rules never drifting client vs server | One shared TypeScript engine runs on both |
| Board perf later | SVG renderer sits behind a swappable interface |
| Content staying current | Stats/points are data from xwing-data2 + community points, never code |

The shape to hold onto: **pure engine in the middle, dumb infrastructure around it, data feeding it from the side.**
