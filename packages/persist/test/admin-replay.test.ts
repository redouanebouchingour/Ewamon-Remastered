/**
 * Server part 2 additions to persist: admin search (escapeLike + ESCAPE '\'), counts, leaderboard modes with
 * banned players excluded in SQL, byIds, synthetic quest pruning, and the battle_history replay columns
 * (migration 0001: `start`, `final_digest`).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AnyDb } from '../src/db';
import { historyRepo } from '../src/repos/history';
import { playerRepo } from '../src/repos/players';
import { progressRepo } from '../src/repos/progress';
import { T0, at, mkPlayer, openTestDb } from './helpers';

let db: AnyDb;
beforeAll(async () => {
  db = await openTestDb();
});
afterAll(async () => {
  await db.close();
});

describe('playerRepo.search / counts / byIds', () => {
  it('matches `%` and `_` literally (escapeLike + ESCAPE), pages, and counts', async () => {
    const ids = await db.transaction(async (tx) => {
      const a = await mkPlayer(tx, 'adm_under_1');
      const b = await mkPlayer(tx, 'admxunderx2');
      const c = await mkPlayer(tx, 'zzz_other');
      await playerRepo.ban(tx, c, 'test', T0);
      return { a, b, c };
    });
    await db.transaction(async (tx) => {
      // '_' would match any char without escaping: only the literal underscore names match
      const r = await playerRepo.search(tx, 'adm_under', 1, 50);
      expect(r.rows.map((p) => p.id)).toEqual([ids.a]);
      expect(r.total).toBe(1);
      // '%' is literal too: no username contains a percent sign
      expect((await playerRepo.search(tx, '%', 1, 50)).total).toBe(0);
      // empty query lists everyone, pageSize clamped
      const all = await playerRepo.search(tx, '', 1, 1000);
      expect(all.rows.length).toBeLessThanOrEqual(50);
      expect(all.total).toBeGreaterThanOrEqual(3);
      const counts = await playerRepo.counts(tx);
      expect(counts.total).toBe(all.total);
      expect(counts.banned).toBeGreaterThanOrEqual(1);
      const rows = await playerRepo.byIds(tx, [ids.a, ids.b, ids.a]);
      expect(rows.map((p) => p.id).sort()).toEqual([ids.a, ids.b].sort());
      expect(await playerRepo.byIds(tx, [])).toEqual([]);
    });
  });
});

describe('playerRepo.leaderboard', () => {
  it('orders by dex caught count, excludes banned players in SQL', async () => {
    const { top, banned } = await db.transaction(async (tx) => {
      const top = await mkPlayer(tx, 'lb_top');
      const banned = await mkPlayer(tx, 'lb_banned');
      for (const sp of ['aa', 'bb', 'cc', 'dd', 'ee', 'ff', 'gg', 'hh', 'ii', 'jj']) {
        await progressRepo.markCaught(tx, top, `sp_${sp}`, 'normal', false, T0);
        await progressRepo.markCaught(tx, banned, `sp_${sp}`, 'normal', false, T0);
      }
      await progressRepo.markCaught(tx, banned, 'sp_extra', 'normal', false, T0);
      await playerRepo.ban(tx, banned, 'test', T0);
      return { top, banned };
    });
    await db.transaction(async (tx) => {
      const rows = await playerRepo.leaderboard(tx, 'dex', 1, 25);
      expect(rows[0]!.id).toBe(top);
      expect(rows.some((r) => r.id === banned)).toBe(false);
      expect((await playerRepo.leaderboard(tx, 'rating', 1, 25)).some((r) => r.bannedAt !== null)).toBe(false);
      expect((await playerRepo.leaderboard(tx, 'trainerLevel', 1, 25)).some((r) => r.bannedAt !== null)).toBe(false);
    });
  });
});

describe('progressRepo.pruneSyntheticQuests', () => {
  it('deletes daily rows older than the cutoff key only', async () => {
    const p = await db.transaction((tx) => mkPlayer(tx));
    await db.transaction(async (tx) => {
      await progressRepo.advance(tx, p, 'daily:2026-09-01', 'm1', 1, true);
      await progressRepo.advance(tx, p, 'daily:2026-09-20', 'm1', 1, false);
      await progressRepo.advance(tx, p, 'weekly:2026-W30', 'w1', 1, false);
      await progressRepo.advance(tx, p, 'first_steps', 'o1', 1, false);
      const n = await progressRepo.pruneSyntheticQuests(tx, 'daily:', '2026-09-10');
      expect(n).toBe(1);
      expect(Object.keys(await progressRepo.allQuests(tx, p)).sort()).toEqual(['daily:2026-09-20', 'first_steps', 'weekly:2026-W30']);
    });
  });
});

describe('battle_history replay columns (migration 0001)', () => {
  it('round-trips the start snapshot and the final digest; both default to null', async () => {
    const p = await db.transaction((tx) => mkPlayer(tx));
    const start = { zoneId: 'mire_route', terrain: 'grove', sides: [{ kind: 'player', party: [] }, { kind: 'wild', party: [] }] as const };
    await db.transaction(async (tx) => {
      const base = { playerId: p, opponent: 'mossling', format: 'wild' as const, result: 'win' as const, turns: 2, ratingDelta: null, rewards: { money: 0, items: {}, trainerExp: 10, ratingDelta: null, badge: null }, seed: [1, 2, 3, 4] as const, actions: [[{ kind: 'flee' as const }, null]] as [{ kind: 'flee' }, null][] };
      await historyRepo.recordBattle(tx, { ...base, battleId: '00000000-0000-4000-8000-000000000001', start, finalDigest: 'deadbeef', happenedAt: at(1) });
      await historyRepo.recordBattle(tx, { ...base, battleId: '00000000-0000-4000-8000-000000000002', happenedAt: at(2) });
      const withStart = await historyRepo.battleById(tx, p, '00000000-0000-4000-8000-000000000001');
      expect(withStart!.start).toEqual(start);
      expect(withStart!.finalDigest).toBe('deadbeef');
      const legacy = await historyRepo.battleById(tx, p, '00000000-0000-4000-8000-000000000002');
      expect(legacy!.start).toBeNull();
      expect(legacy!.finalDigest).toBeNull();
    });
  });
});

describe('progressRepo.markSeen / claimObjective (live-ops)', () => {
  it('markSeen reports a new species once; claimObjective claims exactly one done objective once', async () => {
    const p = await db.transaction((tx) => mkPlayer(tx));
    await db.transaction(async (tx) => {
      expect(await progressRepo.markSeen(tx, p, 'sp_new', T0)).toBe(true);
      expect(await progressRepo.markSeen(tx, p, 'sp_new', T0)).toBe(false);
      await progressRepo.advance(tx, p, 'daily:2026-09-20', 'a', 1, true);
      await progressRepo.advance(tx, p, 'daily:2026-09-20', 'b', 0, false);
      expect(await progressRepo.claimObjective(tx, p, 'daily:2026-09-20', 'b', T0)).toBe(false); // not done
      expect(await progressRepo.claimObjective(tx, p, 'daily:2026-09-20', 'a', T0)).toBe(true);
      expect(await progressRepo.claimObjective(tx, p, 'daily:2026-09-20', 'a', T0)).toBe(false); // already
      const rows = await progressRepo.quest(tx, p, 'daily:2026-09-20');
      expect(rows.find((r) => r.objectiveId === 'a')!.claimedAt).not.toBeNull();
      expect(rows.find((r) => r.objectiveId === 'b')!.claimedAt).toBeNull();
    });
  });
});
