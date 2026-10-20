/**
 * Challenge modes (flags the server passes in): the board lists the players holding the mode flag: cleared runs first
 * (earliest clear first), then runs still going, then failed ones, each by badges desc; another mode's players and
 * banned players are left out.
 */
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AnyDb } from '../src/db';
import { progressRepo } from '../src/repos/progress';
import { mkPlayer, openTestDb } from './helpers';

let db: AnyDb;
beforeAll(async () => {
  db = await openTestDb();
});
afterAll(async () => {
  await db.close();
});

const FLAGS = { mode: 'challenge:nuzlocke', cleared: 'challenge:cleared', failed: 'challenge:failed' };
const t = (m: number): Date => new Date(Date.UTC(2026, 9, 20, 10, m));

describe('the challenge board', () => {
  it('cleared first (earliest), then active, then failed, each by badges; other modes and banned left out', async () => {
    await db.transaction(async (tx) => {
      const mk = async (name: string, flags: string[], badgeIds: string[], at = t(0)) => {
        const id = await mkPlayer(tx, name);
        await progressRepo.setFlags(tx, id, flags, at);
        for (const b of badgeIds) await progressRepo.awardBadge(tx, id, b as never, at);
        return id;
      };
      await mk('nz_active2', [FLAGS.mode], ['bloom', 'tidal']);
      await mk('nz_active1', [FLAGS.mode], ['bloom']);
      await mk('nz_failed', [FLAGS.mode, FLAGS.failed], ['bloom', 'tidal', 'ember']);
      await mk('nz_cleared_late', [FLAGS.mode, FLAGS.cleared], ['bloom'], t(30));
      await mk('nz_cleared_early', [FLAGS.mode, FLAGS.cleared], [], t(10));
      await mk('hc_other', ['challenge:hardcore'], ['bloom']);
      const banned = await mk('nz_banned', [FLAGS.mode], ['bloom', 'tidal', 'ember', 'spark']);
      await tx.execute(sql`update players set banned_at = now(), ban_reason = 'test' where id = ${banned}`);
      const rows = await progressRepo.challengeBoard(tx, FLAGS, 1, 25);
      expect(rows.map((r) => [r.player.username, r.state, r.badges])).toEqual([
        ['nz_cleared_early', 'cleared', 0],
        ['nz_cleared_late', 'cleared', 1],
        ['nz_active2', 'active', 2],
        ['nz_active1', 'active', 1],
        ['nz_failed', 'failed', 3],
      ]);
    });
  });
});
