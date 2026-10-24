/**
 * NPC memory (migration 0021): the first contact creates the row; the standing is clamped to -10..10; the summary rolls
 * (older sentences drop off the front past the cap); the deeds keep the last five; a zone read lists only that zone's
 * NPCs, newest first; a player's rows go with the player.
 */
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AnyDb } from '../src/db';
import { NPC_MEMORY_LIMITS, npcMemoryRepo, rollSummary } from '../src/repos/npcMemory';
import { mkPlayer, openTestDb } from './helpers';

let db: AnyDb;
beforeAll(async () => {
  db = await openTestDb();
});
afterAll(async () => {
  await db.close();
});

const at = (m: number): Date => new Date(Date.UTC(2026, 9, 24, 12, m));

describe('npc memory', () => {
  it('remembers on first contact, clamps the standing and keeps the last deeds', async () => {
    await db.transaction(async (tx) => {
      const p = await mkPlayer(tx, 'npcmem_a');
      expect(await npcMemoryRepo.of(tx, p, 'mirevale.gardener')).toBeNull();
      const first = await npcMemoryRepo.remember(tx, p, 'mirevale.gardener', { zoneId: 'mirevale', note: 'The traveller slapped me.', delta: -3, deeds: ['hit'], talk: true }, at(1));
      expect(first).toMatchObject({ zoneId: 'mirevale', summary: 'The traveller slapped me.', standing: -3, talks: 1, deeds: [{ deed: 'hit', at: at(1).toISOString() }] });
      const low = await npcMemoryRepo.remember(tx, p, 'mirevale.gardener', { zoneId: 'mirevale', delta: -40, deeds: ['robbed', 'insulted', 'threatened', 'hit', 'robbed'] }, at(2));
      expect(low.standing).toBe(NPC_MEMORY_LIMITS.standingMin);
      expect(low.talks).toBe(1);
      expect(low.deeds.map((d) => d.deed)).toEqual(['robbed', 'insulted', 'threatened', 'hit', 'robbed']);
      expect((await npcMemoryRepo.remember(tx, p, 'mirevale.gardener', { zoneId: 'mirevale', delta: 99 }, at(3))).standing).toBe(NPC_MEMORY_LIMITS.standingMax);
    });
  });

  it('rolls the summary: the newest part fits the cap, cut at a sentence', () => {
    expect(rollSummary('', 'Hello there.')).toBe('Hello there.');
    expect(rollSummary('We talked.', ' They thanked me. ')).toBe('We talked. They thanked me.');
    const old = Array.from({ length: 30 }, (_, i) => `Sentence number ${i} is here.`).join(' ');
    const rolled = rollSummary(old, 'The newest one.');
    expect(rolled.length).toBeLessThanOrEqual(NPC_MEMORY_LIMITS.summaryMax);
    expect(rolled.endsWith('The newest one.')).toBe(true);
    expect(rolled).toMatch(/^Sentence number \d+ is here\./);
  });

  it('reads a zone: only its NPCs, most recent first; the rows go with the player', async () => {
    const p = await db.transaction(async (tx) => {
      const p = await mkPlayer(tx, 'npcmem_b');
      await npcMemoryRepo.remember(tx, p, 'mirevale.child', { zoneId: 'mirevale', delta: 1 }, at(1));
      await npcMemoryRepo.remember(tx, p, 'mirevale.archivist', { zoneId: 'mirevale', delta: -2 }, at(2));
      await npcMemoryRepo.remember(tx, p, 'cinderhold.smith', { zoneId: 'cinderhold', delta: 2 }, at(3));
      expect((await npcMemoryRepo.inZone(tx, p, 'mirevale')).map((m) => m.npcId)).toEqual(['mirevale.archivist', 'mirevale.child']);
      expect((await npcMemoryRepo.inZone(tx, p, 'cinderhold')).map((m) => m.standing)).toEqual([2]);
      return p;
    });
    await db.transaction(async (tx) => {
      await tx.execute(sql`delete from players where id = ${p}`);
      expect(await npcMemoryRepo.inZone(tx, p, 'mirevale')).toEqual([]);
    });
  });
});
