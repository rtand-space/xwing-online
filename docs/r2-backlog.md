# R2 — Squad builder + data layer (backlog)

R2 turns "preset squads" into "bring your own list." Per spec §8/§12: the XWA 2.5
**loadout system** (two budgets — squad points to a 20pt cap, 3–8 ships single
faction; per-pilot loadout points for upgrades), built on **xwing-data2** with
**XWS** import/export and **versioned dynamic points**; plus an **account system**
(guest→sign-in, saved squads) and **obstacles**.

Engine note: upgrade/pilot *abilities* don't take effect until R3 (the ability
engine). R2 is the building experience + data; ability-less ships are playable now.

Status: ☐ not started · ◐ in progress · ☑ done

## R2-M1 — Data layer & points
- ☑ **T-D1** Squad/loadout points model in `@xwing/data`: pilots gain `loadout` + slot bar; `squadPoints()` and `validateSquad()` (single faction, 3–8 ships, **≤50 pts**, loadout budgets, limited rules).
- ☑ **T-D2** Full xwing-data2 pull: `packages/data/scripts/generate.mjs` reads a xwing-data2 checkout and emits a committed snapshot (`src/generated/{ships,upgrades,meta}.json`) — **95 ships across all 7 factions, 524 upgrades, real stats/dials/points/slots**. No images/raw dataset vendored. Cross-faction shared hulls resolved in the loaders. A test parses every dial code in the snapshot (nothing dropped). Dial vocabulary made complete first (Segnor/Tallon/reverse/stationary + purple), verified against the source.
- ☑ **T-D3** Versioned XWA points: the generator overlays the authoritative **XWA community points** (github.com/eirikmun/xwing-points) onto the xwing-data2 cards — cost/loadout/slots/limited keyed by xws for the current revision (**50P 2.0, 2026-04-26**). All 659 pilots + 455 upgrades priced from XWA; `DATA_VERSION` = the points revision. The generator also synthesizes **41 XWA reprint variants** (suffix versions of pilots we carry — same ship + initiative as the base) → **700 pilots total**. _Deferred (34): 11 XWA-original pilots that aren't in xwing-data2 and have no initiative in the points feed (would require XWA card data), and 23 Epic/Huge-ship entries. Scheduled auto-refresh + per-game version pinning in engine state still to come._

Refresh the data: clone xwing-data2 (sparse `data/`) and eirikmun/xwing-points, then
`XWING_DATA2=/cards XWING_POINTS=/points node packages/data/scripts/generate.mjs`.

## R2-M2 — Squad builder UI
- ☑ **T-B1** Faction pilot list with a squad-point meter + live `validateSquad` errors.
- ☑ **T-B2** Per-pilot loadout: each pilot shows its slot bar; tapping a slot opens a restriction-filtered upgrade picker (faction/ship/size + single-slot in v1); a live loadout meter sums cost vs `pilot.loadout` and disables over-budget picks. `validateSquad` enforces loadout budgets + upgrade limited/unique; upgrades round-trip through XWS. _Effects deferred to R3; equipped upgrades aren't yet threaded into the engine state. Exotic restriction types (arc/action/keyword) and multi-slot upgrades deferred._
- ☑ **T-B3** Start a game from built squads — **each side brings its own**: hot-seat builds both; online is a lobby (host=Rebel opens with their squad, joiner=Imperial brings theirs, the DO assembles the game once both are in). _Save/name squads + host-picks-side are follow-ons._

## R2-M3 — XWS interop
- ☑ **T-X1** Paste-import an XWS squad into any builder (faction- and roster-checked; errors surfaced).
- ◐ **T-X2** Export / copy standard XWS (faction/points/version/pilots) from any builder — round-trips with YASB / Launch Bay Next. _Shareable squad link still to come._

## R2-M4 — Accounts
- ☐ **T-A1** Guest→account sign-in (auth provider TBD); migrate the guest id.
- ☐ **T-A2** Saved squads + match history in D1, keyed to the account.

## R2-M5 — Obstacles
- ☐ **T-O1** Asteroids/debris in the engine (placement, overlap, effects on move/attack).
- ☐ **T-O2** Setup placement UI.

## R2-M6 — Sandbox (basic)
- ☐ **T-S1** Free-place ships + dry-run maneuvers/arcs from the builder (spec §14), then drop into a real game. Cheap given the geometry tools are already FSM-independent.
