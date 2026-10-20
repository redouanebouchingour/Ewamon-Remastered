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

## Session 3 (2026-10-20): the sculpted terrain (00c83d6)
- First run on the sculpts (fixtures from session 2, no write): act3a PASS 274 s, act3b PASS 608 s, halls 9/9, but
  act1, act2 and act3c FAILED with `walker: no path`: a handover from Ash Route landed in Cinderhold at (58, -6) on the
  caldera rim (act1 at `forge_gratitude`, act3c on its way west), one from Tide Route landed in Stormrook at
  (-57.5, 11.5) on a pinnacle top (act2 at `grid_numbers`). Desyncs 0 in every leg.
- Cause: the sculpts, not the walker. A handover keeps the lateral coordinate (`entryPoint`), the routes' edges are
  open, and validate's rule 12 asks each handover band for one reachable sample only. A scan of every link found 14
  with stranding crossings. Fixed in content `data/sculpts.ts` (`shoulder` rock faces, three lake edits; content
  IMPLEMENTATION-NOTES "Handover landings"); guarded by `server/test/handover-landing.test.ts`.
- Re-recorded the chain on the fixed terrain with EWA_PROGRESSION_WRITE=1 in one `pnpm test:progression` run
  (6/6 files, 2583 s):
  - act1: PASS 563 s (2192 m, 89 handovers, 368 battles / 1315 turns, desyncs 0), act1.json re-written.
  - act2: PASS 803 s (3550 m, 96 handovers, 194 battles / 1151 turns, desyncs 0), act2.json re-written.
  - act3a: PASS 282 s (1300 m, 40 handovers, 77 battles / 522 turns, desyncs 0), act3a.json re-written.
  - act3b: PASS 472 s (2401 m, 50 handovers, 21 battles / 159 turns, desyncs 0), act3b.json re-written.
  - act3c: PASS 220 s (1471 m, 12 handovers, 2 battles / 5 turns, desyncs 0), act3c.json re-written.
  - progression-halls: 9/9 pass (197 s).

## State: DONE (nothing running). Fixtures act1, act2, act3a, act3b, act3c re-recorded on the sculpted terrain.
