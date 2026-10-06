# Phase B5/B6 progression walk — progress notes

Live notes so the work can resume after an interruption. Newest at the bottom.

## Setup (done)
- Restored from a6606df: `walker.ts`, `pathing.ts`, `progression.ts`, `progression-act{1,2,3a,3b,3c}.test.ts`.
  The old act1 fixture is kept as `act1.json.old` (pre-Phase-A gym flow) until act1 is re-recorded.
- Walker taught interiors: `walk()` leaves / enters halls through door warps automatically; `reachLeader()` plans
  the hall puzzle from content's `walkInterior` order, re-planned from real flags after each step; `hop()` takes warp
  tiles (Vesperveil); pathing honours the player's closed gates (`findPath(..., gates)`).
- `vitest.progression.config.ts` + root `pnpm test:progression`; default `vitest.config.ts` excludes
  `packages/server/test/progression-*.test.ts`.
- `progression-halls.test.ts`: smoke of all 8 gym halls + the league hall with a set-up account (minutes).
- `packages/server/scripts/seed-progression.ts` (B6) + `pnpm --filter @ewa/server seed:progression <leg> <user>`.

## Runs
- progression-halls (smoke): 9/9 pass (8 gyms 12–25 s each, league hall 22 s; ~200 s total).
- act1: PASS, 953 s wall (2233 m walked, 245 handovers, 534 battles / 4204 turns, desyncs 0).
  `act1.json` re-recorded (Phase A gym flow). Mira's pre-beat refusal dropped (unobservable on foot, see test).
- act2: PASS, 849 s wall (3314 m, 146 handovers, 220 battles / 1455 turns, desyncs 0). `act2.json` written.
  The suspected observatory stair / hollis_siege / reeve_observatory / ledger_read defects did not reproduce.
- act3a: PASS, 306 s wall (1277 m, 50 handovers, 74 battles / 492 turns, desyncs 0). `act3a.json` written
  (8 badges + Wardens + Champion).
- act3b: running (from act3a.json).
