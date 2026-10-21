/**
 * The bounty board (migration 0019): a player's post and the board's own bounty on a ghost; one open game bounty per
 * ghost (raised, never doubled); a claim takes every open bounty on the target but the claimer's own post, at most
 * `max`, each once; expiry returns each lapsed post once; a ghost's record counts different trainers since its last
 * claim; nemesis records stay off the public lists.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AnyDb } from '../src/db';
import { bountyRepo } from '../src/repos/bounties';
import { ghostRepo } from '../src/repos/ghosts';
import { mkPlayer, openTestDb } from './helpers';

let db: AnyDb;
beforeAll(async () => {
  db = await openTestDb();
});
afterAll(async () => {
  await db.close();
});

const at = (h: number): Date => new Date(Date.UTC(2026, 9, 21, h));
const ghost = (targetId: string, targetName: string, reward: number, expiresAt: Date, wins = 0) => ({
  targetId,
  targetName,
  speciesId: 'dustcub',
  level: 20,
  zoneId: 'mire_route',
  wins,
  reward,
  expiresAt,
});

describe('bounties', () => {
  it('posts, lists, claims once and expires', async () => {
    await db.transaction(async (tx) => {
      const [g, poster, hunter, rival] = [await mkPlayer(tx, 'b_ghost'), await mkPlayer(tx, 'b_poster'), await mkPlayer(tx, 'b_hunter'), await mkPlayer(tx, 'b_rival')];
      const post = await bountyRepo.post(tx, { ...ghost(g, 'b_ghost', 1000, at(20)), posterId: poster, posterName: 'b_poster', fee: 250 }, at(1));
      expect(post).toMatchObject({ kind: 'player', status: 'open', reward: 1000, fee: 250, posterId: poster });
      await bountyRepo.upsertGame(tx, ghost(g, 'b_ghost', 625, at(30), 5), at(1));
      await bountyRepo.upsertGame(tx, ghost(g, 'b_ghost', 750, at(31), 6), at(2));
      const open = await bountyRepo.open(tx, at(3), 10);
      expect(open.map((b) => [b.kind, b.reward])).toEqual([
        ['player', 1000],
        ['game', 750],
      ]);
      expect(open.find((b) => b.kind === 'game')?.wins).toBe(6);
      expect(await bountyRepo.wanted(tx, [g, hunter], at(3))).toEqual(new Set([g]));
      expect((await bountyRepo.openBy(tx, poster, at(3))).length).toBe(1);

      // the poster cannot take their own post: only the game bounty is theirs to claim
      const own = await bountyRepo.claim(tx, { targetId: g, claimerId: poster, claimerName: 'b_poster', bonus: false, max: 3, payoutOf: (r) => r }, at(4));
      expect(own.map((b) => b.kind)).toEqual(['game']);
      // the hunter takes the rest, with the bonus; a second claim finds nothing
      const mine = await bountyRepo.claim(tx, { targetId: g, claimerId: hunter, claimerName: 'b_hunter', bonus: true, max: 3, payoutOf: (r) => r + Math.ceil(r / 4) }, at(5));
      expect(mine).toHaveLength(1);
      expect(mine[0]).toMatchObject({ kind: 'player', status: 'claimed', claimerId: hunter, payout: 1250, bonus: true });
      expect(await bountyRepo.claim(tx, { targetId: g, claimerId: rival, claimerName: 'b_rival', bonus: false, max: 3, payoutOf: (r) => r }, at(5))).toEqual([]);
      expect(await bountyRepo.claimsSince(tx, hunter, at(0))).toBe(1);
      expect(await bountyRepo.claimsSince(tx, hunter, at(6))).toBe(0);
      expect((await bountyRepo.recentClaims(tx, 10)).map((b) => b.claimerName)).toEqual(['b_hunter', 'b_poster']);
      expect(await bountyRepo.wanted(tx, [g], at(6))).toEqual(new Set());

      // at most `max`
      await bountyRepo.post(tx, { ...ghost(g, 'b_ghost', 600, at(20)), posterId: poster, posterName: 'b_poster', fee: 150 }, at(6));
      await bountyRepo.post(tx, { ...ghost(g, 'b_ghost', 900, at(20)), posterId: hunter, posterName: 'b_hunter', fee: 225 }, at(6));
      expect(await bountyRepo.claim(tx, { targetId: g, claimerId: rival, claimerName: 'b_rival', bonus: false, max: 0, payoutOf: (r) => r }, at(7))).toEqual([]);
      const one = await bountyRepo.claim(tx, { targetId: g, claimerId: rival, claimerName: 'b_rival', bonus: false, max: 1, payoutOf: (r) => r }, at(7));
      expect(one.map((b) => b.reward)).toEqual([900]);

      // expiry: once
      const gone = await bountyRepo.expireDue(tx, at(20));
      expect(gone.map((b) => [b.posterName, b.reward, b.fee])).toEqual([['b_poster', 600, 150]]);
      expect(await bountyRepo.expireDue(tx, at(21))).toEqual([]);
      expect((await bountyRepo.postedBy(tx, poster, 10)).map((b) => b.status)).toEqual(['expired', 'claimed']);

      // a nemesis record is claimed at once and never on the public lists
      const n = await bountyRepo.recordNemesis(tx, { targetName: 'Murkjaw the Drowned', speciesId: 'dustcub', level: 12, zoneId: 'mire_route', rank: 2, reward: 800, claimerId: hunter, claimerName: 'b_hunter', payout: 800, bonus: false }, at(22));
      expect(n).toMatchObject({ kind: 'nemesis', status: 'claimed', wins: 2 });
      expect((await bountyRepo.recentClaims(tx, 10)).some((b) => b.kind === 'nemesis')).toBe(false);
      expect(await bountyRepo.claimsSince(tx, hunter, at(21))).toBe(1);
    });
  });

  it("counts a ghost's different trainers beaten since its last claim", async () => {
    await db.transaction(async (tx) => {
      const g = await mkPlayer(tx, 'w_ghost');
      const hunter = await mkPlayer(tx, 'w_hunter');
      for (const [who, h, won] of [
        ['a', 1, true],
        ['a', 2, true],
        ['b', 3, true],
        ['c', 4, false],
        ['d', 0, true],
      ] as const)
        await ghostRepo.record(tx, g, who, 'mire_route', won, at(h));
      expect((await bountyRepo.ghostWins(tx, at(1))).get(g)).toBe(2);
      expect((await bountyRepo.ghostWins(tx, at(0))).get(g)).toBe(3);
      await bountyRepo.upsertGame(tx, ghost(g, 'w_ghost', 625, at(30), 5), at(5));
      await bountyRepo.claim(tx, { targetId: g, claimerId: hunter, claimerName: 'w_hunter', bonus: false, max: 1, payoutOf: (r) => r }, at(5));
      expect((await bountyRepo.ghostWins(tx, at(0))).get(g)).toBeUndefined();
      await ghostRepo.record(tx, g, 'e', 'mire_route', true, at(6));
      expect((await bountyRepo.ghostWins(tx, at(0))).get(g)).toBe(1);
    });
  });
});
