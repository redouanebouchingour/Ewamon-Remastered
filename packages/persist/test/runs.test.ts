/**
 * Verified speedruns (migration 0009): the play clock runs only between start and stop (a second start keeps the
 * first, as across a handover); a split records the clock once; stopAll stops stale clocks without charging the gap;
 * the board ranks the finish of runs that hold the start split too, fastest first.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AnyDb } from '../src/db';
import { runRepo } from '../src/repos/runs';
import { mkPlayer, openTestDb } from './helpers';

let db: AnyDb;
beforeAll(async () => {
  db = await openTestDb();
});
afterAll(async () => {
  await db.close();
});

const at = (s: number): Date => new Date(Date.UTC(2026, 9, 20, 12, 0, s));

describe('the play clock', () => {
  it('runs between start and stop; a second start keeps the first; splits record it once', async () => {
    await db.transaction(async (tx) => {
      const p = await mkPlayer(tx);
      expect(await runRepo.clock(tx, p, at(0))).toEqual({ playMs: 0, running: false });
      await runRepo.start(tx, p, at(0));
      await runRepo.start(tx, p, at(5)); // a handover: the clock keeps its start
      expect(await runRepo.clock(tx, p, at(10))).toEqual({ playMs: 10_000, running: true });
      await runRepo.split(tx, p, 'beat:first_witness', at(10));
      await runRepo.split(tx, p, 'beat:first_witness', at(12));
      await runRepo.stop(tx, p, at(20));
      await runRepo.stop(tx, p, at(25)); // stopped already: nothing banked
      expect(await runRepo.clock(tx, p, at(60))).toEqual({ playMs: 20_000, running: false });
      await runRepo.start(tx, p, at(100));
      await runRepo.split(tx, p, 'champion', at(103));
      expect((await runRepo.splits(tx, p)).map((s) => [s.split, s.playMs])).toEqual([
        ['beat:first_witness', 10_000],
        ['champion', 23_000],
      ]);
    });
  });

  it('stopAll stops stale clocks without charging the gap', async () => {
    await db.transaction(async (tx) => {
      const p = await mkPlayer(tx);
      await runRepo.start(tx, p, at(0));
      expect(await runRepo.stopAll(tx)).toBeGreaterThanOrEqual(1);
      expect(await runRepo.clock(tx, p, at(50))).toEqual({ playMs: 0, running: false });
    });
  });

  it('the board ranks finishes of runs that hold the start split, fastest first', async () => {
    await db.transaction(async (tx) => {
      const mk = async (name: string, finishS: number | null, withStart: boolean) => {
        const p = await mkPlayer(tx, name);
        await runRepo.start(tx, p, at(0));
        if (withStart) await runRepo.split(tx, p, 'beat:zz_start', at(1));
        if (finishS !== null) await runRepo.split(tx, p, 'zz_finish', at(finishS));
        return p;
      };
      await mk('run_slow', 50, true);
      await mk('run_fast', 30, true);
      await mk('run_nostart', 10, false);
      await mk('run_unfinished', null, true);
      const rows = await runRepo.board(tx, 'beat:zz_start', 'zz_finish', 1, 25);
      expect(rows.map((r) => [r.player.username, r.playMs])).toEqual([
        ['run_fast', 30_000],
        ['run_slow', 50_000],
      ]);
    });
  });
});
