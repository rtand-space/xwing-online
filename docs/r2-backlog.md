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
- ☑ **T-D1** Squad/loadout points model in `@xwing/data`: pilots gain `loadout` + slot bar; `squadPoints()` and `validateSquad()` (single faction, 3–8 ships, ≤20 pts, limited rules). _Loadout-cost validation lands with T-B2 (upgrade data)._
- ☐ **T-D2** Roster expansion: vendor a broader set of **ability-less, front-arc** ships/pilots from xwing-data2 (real stats/dials/points) so lists are meaningful.
- ☐ **T-D3** Versioned points snapshot: pull XWA community points on a schedule, cache a pinned version, surface the data version; pin each game to its version.

## R2-M2 — Squad builder UI
- ☑ **T-B1** Faction pilot list with a squad-point meter + live `validateSquad` errors.
- ☐ **T-B2** Per-pilot loadout: slot bar, equip upgrades against the loadout meter (effects deferred to R3/R4), limited/unique enforcement.
- ☑ **T-B3** Start a game from built squads — **each side brings its own**: hot-seat builds both; online is a lobby (host=Rebel opens with their squad, joiner=Imperial brings theirs, the DO assembles the game once both are in). _Save/name squads + host-picks-side are follow-ons._

## R2-M3 — XWS interop
- ☐ **T-X1** Paste-import an XWS squad (validate, surface errors).
- ☐ **T-X2** Export / copy XWS + shareable link; round-trips with YASB / Launch Bay Next.

## R2-M4 — Accounts
- ☐ **T-A1** Guest→account sign-in (auth provider TBD); migrate the guest id.
- ☐ **T-A2** Saved squads + match history in D1, keyed to the account.

## R2-M5 — Obstacles
- ☐ **T-O1** Asteroids/debris in the engine (placement, overlap, effects on move/attack).
- ☐ **T-O2** Setup placement UI.

## R2-M6 — Sandbox (basic)
- ☐ **T-S1** Free-place ships + dry-run maneuvers/arcs from the builder (spec §14), then drop into a real game. Cheap given the geometry tools are already FSM-independent.
