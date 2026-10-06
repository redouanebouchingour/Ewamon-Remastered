/**
 * Phase D14 — `player_streaks` (migration 0004_player_streaks) and `streakRepo`: a win raises current and best, the end
 * of a run resets current and keeps best, the leaderboard ranks best desc (then current, then username) and leaves out
 * banned players and players who never won a tower fight.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import type { AnyDb } from '../src/db';
import { playerRepo } from '../src/repos/players';
import { streakRepo } from '../src/repos/streaks';
import { T0, at, mkPlayer, openTestDb } from './helpers';

let db: AnyDb;
beforeAll(async () => {
  db = await openTestDb();
});
afterAll(async () => {
  await db.close();
});

describe('Phase D14 player_streaks', () => {
  it('0004 creates player_streaks with the current ≥ 0 and best ≥ current checks', async () => {
    const r = await db.transaction(async (tx) => {
      const cols = await tx.execute<{ column_name: string }>(sql`select column_name from information_schema.columns where table_name = 'player_streaks' order by ordinal_position`);
      const ck = await tx.execute<{ conname: string }>(sql`select conname from pg_constraint where contype = 'c' and conname like 'player_streaks_%' order by conname`);
      return { cols: [...cols.rows].map((x) => x.column_name), ck: [...ck.rows].map((x) => x.conname) };
    });
    expect(r.cols).toEqual(['player_id', 'current', 'best', 'updated_at']);
    expect(r.ck).toEqual(['player_streaks_best_ck', 'player_streaks_current_ck']);
  });

  it('wins raise current and best; ending the run resets current and keeps best', async () => {
    await db.transaction(async (tx) => {
      const p = await mkPlayer(tx);
      expect(await streakRepo.get(tx, p)).toEqual({ current: 0, best: 0 });
      expect(await streakRepo.recordWin(tx, p, T0)).toEqual({ current: 1, best: 1 });
      expect(await streakRepo.recordWin(tx, p, at(1))).toEqual({ current: 2, best: 2 });
      expect(await streakRepo.recordWin(tx, p, at(2))).toEqual({ current: 3, best: 3 });
      expect(await streakRepo.endRun(tx, p, at(3))).toEqual({ current: 0, best: 3 });
      expect(await streakRepo.recordWin(tx, p, at(4))).toEqual({ current: 1, best: 3 });
      expect(await streakRepo.get(tx, p)).toEqual({ current: 1, best: 3 });
      // a run that ends before any win creates the row at 0 / 0
      const q = await mkPlayer(tx);
      expect(await streakRepo.endRun(tx, q, at(5))).toEqual({ current: 0, best: 0 });
      const m = await streakRepo.byPlayers(tx, [p, q, p]);
      expect(m.get(p)).toEqual({ current: 1, best: 3 });
      expect(m.get(q)).toEqual({ current: 0, best: 0 });
    });
  });

  it('the leaderboard ranks best desc, then current desc, then username; banned and zero-best players are left out', async () => {
    await db.transaction(async (tx) => {
      await tx.execute(sql`delete from player_streaks`);
      const a = await mkPlayer(tx, 'zz_alpha');
      const b = await mkPlayer(tx, 'aa_bravo');
      const c = await mkPlayer(tx, 'mm_charlie');
      const d = await mkPlayer(tx, 'dd_delta');
      const e = await mkPlayer(tx, 'ee_echo');
      for (let i = 0; i < 5; i++) await streakRepo.recordWin(tx, a, T0);
      await streakRepo.endRun(tx, a, T0); // best 5, current 0
      for (let i = 0; i < 5; i++) await streakRepo.recordWin(tx, b, T0); // best 5, current 5
      for (let i = 0; i < 9; i++) await streakRepo.recordWin(tx, c, T0); // best 9
      await streakRepo.endRun(tx, d, T0); // best 0
      for (let i = 0; i < 20; i++) await streakRepo.recordWin(tx, e, T0);
      await playerRepo.ban(tx, e, 'test', T0);
      const rows = await streakRepo.leaderboard(tx, 1, 25);
      expect(rows.map((r) => [r.player.username, r.best, r.current])).toEqual([
        ['mm_charlie', 9, 9],
        ['aa_bravo', 5, 5],
        ['zz_alpha', 5, 0],
      ]);
      expect((await streakRepo.leaderboard(tx, 2, 2)).map((r) => r.player.username)).toEqual(['zz_alpha']);
      void d;
    });
  });
});
