/**
 * The daily challenge (migration 0008 daily_results): a loss counts an attempt and no best; a win sets the best; a
 * slower win keeps it, a faster one replaces it, a tie keeps the earlier; days are separate; the leaderboard is the
 * day's winners, fewest turns first, then the earlier win, banned players left out; `winners` counts them.
 */
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AnyDb } from '../src/db';
import { dailyRepo } from '../src/repos/daily';
import { mkPlayer, openTestDb } from './helpers';

let db: AnyDb;
beforeAll(async () => {
  db = await openTestDb();
});
afterAll(async () => {
  await db.close();
});

const B1 = '00000000-0000-4000-8000-0000000000b1';
const B2 = '00000000-0000-4000-8000-0000000000b2';
const B3 = '00000000-0000-4000-8000-0000000000b3';
const t = (m: number): Date => new Date(Date.UTC(2026, 9, 20, 10, m));

describe('daily_results', () => {
  it('attempts count every try; the best win is the fewest turns, a tie keeping the earlier', async () => {
    await db.transaction(async (tx) => {
      const p = await mkPlayer(tx);
      expect(await dailyRepo.get(tx, p, '2026-10-20')).toEqual({ attempts: 0, best: null });
      expect(await dailyRepo.record(tx, p, '2026-10-20', null, t(1))).toEqual({ attempts: 1, best: null });
      expect((await dailyRepo.record(tx, p, '2026-10-20', { turns: 6, marks: '..K..K', battleId: B1 }, t(2))).best).toEqual({ turns: 6, marks: '..K..K', battleId: B1 });
      expect((await dailyRepo.record(tx, p, '2026-10-20', { turns: 7, marks: '.......', battleId: B2 }, t(3))).best?.battleId).toBe(B1);
      expect((await dailyRepo.record(tx, p, '2026-10-20', { turns: 6, marks: 'K.K...', battleId: B2 }, t(4))).best?.battleId).toBe(B1);
      const after = await dailyRepo.record(tx, p, '2026-10-20', { turns: 4, marks: 'KK.K', battleId: B3 }, t(5));
      expect(after).toEqual({ attempts: 5, best: { turns: 4, marks: 'KK.K', battleId: B3 } });
      expect(await dailyRepo.get(tx, p, '2026-10-21')).toEqual({ attempts: 0, best: null });
    });
  });

  it("the leaderboard is the day's winners, fewest turns then earliest; banned left out", async () => {
    await db.transaction(async (tx) => {
      const day = '2030-01-01';
      const a = await mkPlayer(tx, 'daily_a');
      const b = await mkPlayer(tx, 'daily_b');
      const c = await mkPlayer(tx, 'daily_c');
      const d = await mkPlayer(tx, 'daily_d');
      const e = await mkPlayer(tx, 'daily_e');
      await dailyRepo.record(tx, a, day, { turns: 5, marks: 'aaaaa', battleId: B1 }, t(10));
      await dailyRepo.record(tx, b, day, { turns: 4, marks: 'bbbb', battleId: B2 }, t(11));
      await dailyRepo.record(tx, c, day, { turns: 5, marks: 'ccccc', battleId: B3 }, t(9));
      await dailyRepo.record(tx, d, day, null, t(12));
      await dailyRepo.record(tx, e, day, { turns: 3, marks: 'eee', battleId: B1 }, t(13));
      await tx.execute(sql`update players set banned_at = now(), ban_reason = 'test' where id = ${e}`);
      const rows = await dailyRepo.leaderboard(tx, day, 1, 25);
      expect(rows.map((r) => [r.player.username, r.turns, r.marks])).toEqual([
        ['daily_b', 4, 'bbbb'],
        ['daily_c', 5, 'ccccc'],
        ['daily_a', 5, 'aaaaa'],
      ]);
      expect(await dailyRepo.winners(tx, day)).toBe(3);
    });
  });
});
