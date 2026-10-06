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
- act3b: PASS (first session), 346 s wall (1967 m, 28 handovers, 19 battles, desyncs 0). `act3b.json` is a
  COMPLETED leg (written by finishLeg at its end).
- act3c (first session): walked to the end (230 s) but FAILED one assertion: GET /me badge order
  [bloom ember circuit …] vs [bloom ember current …]. Cause: test harness, not the game — each leg's server clock
  starts at wall time while the previous leg's ran hours ahead (the walker advances it for rate-limit windows), so
  `circuit` (act2) got an earlier earned_at than `current` (act1). Fix: `startLeg` advances the new server's clock past
  the snapshot's latest timestamp (`latestTimestamp`). Needs act2 → act3b re-recorded.
- Session 2 (after checkpoint 9dc5b30 + D/E phases on main): re-running the whole chain act1 → act3c with
  EWA_PROGRESSION_WRITE=1 on current main (scratch logs: <scratchpad>/chain.log, chain.out).
  - act1: PASS 695 s (2169 m, 123 handovers, 164 battles / 1033 turns, desyncs 0) — act1.json re-written.
  - act2: PASS 810 s (3279 m, 74 handovers, 241 battles / 1648 turns, desyncs 0) — act2.json re-written.
  - act3a: PASS 331 s (1271 m, 38 handovers, 69 battles / 439 turns, desyncs 0) — act3a.json re-written.
  - act3b: PASS 393 s (1981 m, 56 handovers, 25 battles / 212 turns, desyncs 0) — act3b.json re-written.
  - act3c: PASS 229 s (1397 m, 12 handovers, 2 battles / 6 turns, desyncs 0) — act3c.json written. GET /me: the 8
    badges in earned order, elite:veil/aurelia/kirei:beaten, champion:zeon:beaten, all 33 beats, 8 statics.
  - chain total 2458 s (≈ 41 min), 5/5 passed in one `pnpm test:progression progression-act` run.
  - progression-halls re-run on current main: 9/9 pass (254 s).

## State: DONE (nothing running). Fixtures act1, act2, act3a, act3b, act3c on disk, uncommitted.
