/**
 * NPC side quests (migration 0022): an offer is stored with its objective and reward; one open favour per player and
 * NPC (the partial unique index); accepting stamps `accepted_at`, closing `closed_at`; progress never passes the target;
 * offers past their time lapse; the journal reads open ones oldest first and the handed-in ones newest first; a
 * player's rows go with the player.
 */
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AnyDb } from '../src/db';
import { npcQuestRepo } from '../src/repos/npcQuests';
import { mkPlayer, openTestDb } from './helpers';

let db: AnyDb;
beforeAll(async () => {
  db = await openTestDb();
});
afterAll(async () => {
  await db.close();
});

const at = (m: number): Date => new Date(Date.UTC(2026, 9, 24, 12, m));
const base = { zoneId: 'mirevale', objective: { kind: 'defeat', zoneId: 'mire_route', count: 3 }, reward: { money: 300, item: { id: 'potion', qty: 1 } }, target: 3 };

describe('npc quests', () => {
  it('offers, accepts, advances (capped at the target) and claims', async () => {
    await db.transaction(async (tx) => {
      const p = await mkPlayer(tx, 'npcq_a');
      const q = await npcQuestRepo.offer(tx, { ...base, playerId: p, npcId: 'mirevale.gardener', seq: 0 }, at(1));
      expect(q).toMatchObject({ status: 'offered', progress: 0, target: 3, objective: base.objective, reward: base.reward, acceptedAt: null, closedAt: null });
      const active = await npcQuestRepo.setStatus(tx, q.id, 'active', at(2));
      expect(active).toMatchObject({ status: 'active', acceptedAt: at(2), closedAt: null });
      await npcQuestRepo.setProgress(tx, q.id, 9);
      expect((await npcQuestRepo.lock(tx, p, q.id))!.progress).toBe(3);
      expect(await npcQuestRepo.lock(tx, await mkPlayer(tx), q.id)).toBeNull();
      expect((await npcQuestRepo.open(tx, p)).map((x) => x.id)).toEqual([q.id]);
      const done = await npcQuestRepo.setStatus(tx, q.id, 'claimed', at(3));
      expect(done).toMatchObject({ status: 'claimed', closedAt: at(3) });
      expect(await npcQuestRepo.open(tx, p)).toEqual([]);
      expect((await npcQuestRepo.claimed(tx, p, 10)).map((x) => x.id)).toEqual([q.id]);
      // the NPC may ask again once closed
      const again = await npcQuestRepo.offer(tx, { ...base, playerId: p, npcId: 'mirevale.gardener', seq: 1 }, at(4));
      expect((await npcQuestRepo.ofNpc(tx, p, 'mirevale.gardener')).map((x) => x.id)).toEqual([again.id, q.id]);
    });
  });

  it('holds one open favour per player and NPC', async () => {
    await expect(
      db.transaction(async (tx) => {
        const p = await mkPlayer(tx, 'npcq_b');
        await npcQuestRepo.offer(tx, { ...base, playerId: p, npcId: 'mirevale.child', seq: 0 }, at(1));
        await npcQuestRepo.offer(tx, { ...base, playerId: p, npcId: 'mirevale.child', seq: 1 }, at(2));
      }),
    ).rejects.toThrow();
  });

  it("lets unanswered offers lapse and drops a player's rows with the player", async () => {
    await db.transaction(async (tx) => {
      const p = await mkPlayer(tx, 'npcq_c');
      const old = await npcQuestRepo.offer(tx, { ...base, playerId: p, npcId: 'mirevale.archivist', seq: 0 }, at(1));
      const fresh = await npcQuestRepo.offer(tx, { ...base, playerId: p, npcId: 'mirevale.child', seq: 0 }, at(20));
      expect(await npcQuestRepo.expireOffers(tx, p, at(10), at(30))).toBe(1);
      expect((await npcQuestRepo.lock(tx, p, old.id))).toMatchObject({ status: 'expired', closedAt: at(30) });
      expect((await npcQuestRepo.open(tx, p)).map((x) => x.id)).toEqual([fresh.id]);
      await tx.execute(sql`delete from players where id = ${p}`);
      expect(await npcQuestRepo.open(tx, p)).toEqual([]);
    });
  });
});
