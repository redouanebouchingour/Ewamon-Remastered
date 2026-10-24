/**
 * The adventure journal (migration 0024): an entry per player per day, replaced by a second write, listed newest day
 * first; the reads behind a day's digest stay inside the window and the player (creature history of the creatures they
 * own, battles with their zone, chosen audit rows, badges, run splits, NPC memories); text too long is refused by the
 * table; a player's rows go with the player.
 */
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AnyDb } from '../src/db';
import { auditRepo } from '../src/repos/audit';
import { creatureRepo } from '../src/repos/creatures';
import { historyRepo } from '../src/repos/history';
import { journalRepo } from '../src/repos/journal';
import { npcMemoryRepo } from '../src/repos/npcMemory';
import { progressRepo } from '../src/repos/progress';
import { runRepo } from '../src/repos/runs';
import { creatureFixture, mkPlayer, openTestDb } from './helpers';

let db: AnyDb;
beforeAll(async () => {
  db = await openTestDb();
});
afterAll(async () => {
  await db.close();
});

const at = (h: number): Date => new Date(Date.UTC(2026, 9, 22, h));
const FROM = at(0);
const TO = at(24);
const FACT = { kind: 'caught', text: 'I caught a Mossling on Mire Route.', speciesId: 'mossling', zoneId: 'mire_route', type: 'Grass', count: 1 };

describe('journal entries', () => {
  it('keeps one entry a day, replaced by a second write, newest day first', async () => {
    await db.transaction(async (tx) => {
      const p = await mkPlayer(tx);
      expect(await journalRepo.entry(tx, p, '2026-10-22')).toBeNull();
      await journalRepo.write(tx, { playerId: p, day: '2026-10-21', dayNumber: 1, text: 'Day 1: I set out.', facts: [] }, at(1));
      const first = await journalRepo.write(tx, { playerId: p, day: '2026-10-22', dayNumber: 2, text: 'Day 2: I caught a Mossling.', facts: [FACT] }, at(2));
      expect(first).toMatchObject({ day: '2026-10-22', dayNumber: 2, facts: [FACT] });
      const again = await journalRepo.write(tx, { playerId: p, day: '2026-10-22', dayNumber: 2, text: 'Day 2: A Mossling joined me.', facts: [FACT] }, at(3));
      expect(again.text).toBe('Day 2: A Mossling joined me.');
      expect(again.writtenAt.getTime()).toBe(at(3).getTime());
      expect((await journalRepo.entries(tx, p, 10)).map((e) => e.day)).toEqual(['2026-10-22', '2026-10-21']);
      expect((await journalRepo.entries(tx, p, 10, '2026-10-22')).map((e) => e.day)).toEqual(['2026-10-21']);
    });
  });

  it('refuses a text over 600 characters or empty, and goes with the player', async () => {
    const p = await db.transaction((tx) => mkPlayer(tx));
    await expect(db.transaction((tx) => journalRepo.write(tx, { playerId: p, day: '2026-10-22', dayNumber: 1, text: '', facts: [] }, at(1)))).rejects.toThrow();
    await expect(db.transaction((tx) => journalRepo.write(tx, { playerId: p, day: '2026-10-22', dayNumber: 1, text: 'x'.repeat(601), facts: [] }, at(1)))).rejects.toThrow();
    await db.transaction(async (tx) => {
      await journalRepo.write(tx, { playerId: p, day: '2026-10-22', dayNumber: 1, text: 'Day 1.', facts: [] }, at(1));
      await tx.execute(sql`delete from players where id = ${p}`);
      expect(await journalRepo.entries(tx, p, 10)).toEqual([]);
    });
  });
});

describe("a day's reads", () => {
  it("stay inside the window and the player's own rows", async () => {
    await db.transaction(async (tx) => {
      const p = await mkPlayer(tx);
      const other = await mkPlayer(tx);
      const mine = await creatureRepo.insert(tx, creatureFixture(p, { speciesId: 'mossling', isShiny: true }), { kind: 'box', index: 0 });
      const theirs = await creatureRepo.insert(tx, creatureFixture(other, { speciesId: 'glimfin' }), { kind: 'box', index: 0 });
      await creatureRepo.addEvent(tx, [mine.id], { kind: 'met', how: 'caught', speciesId: 'mossling', level: 5, zoneId: 'mire_route', trainer: 'p' }, at(9));
      await creatureRepo.addEvent(tx, [mine.id], { kind: 'evolved', from: 'mossling', into: 'mossbeast' }, at(30));
      await creatureRepo.addEvent(tx, [theirs.id], { kind: 'met', how: 'caught', speciesId: 'glimfin', level: 5, zoneId: 'tide_route', trainer: 'o' }, at(9));
      const ev = await journalRepo.creatureEvents(tx, p, FROM, TO);
      expect(ev.map((e) => [e.kind, e.speciesId, e.isShiny, e.detail['zoneId']])).toEqual([['met', 'mossling', true, 'mire_route']]);

      const base = { playerId: p, format: 'trainer' as const, turns: 3, ratingDelta: null, rewards: { money: 0, items: {}, trainerExp: 0, ratingDelta: null, badge: null }, seed: [1, 2, 3, 4] as const, actions: [] };
      const start = { zoneId: 'mire_route', terrain: 'grove', sides: [{}, {}] as const };
      await historyRepo.recordBattle(tx, { ...base, battleId: '00000000-0000-4000-8000-0000000000a1', opponent: 'rival:Corin', result: 'win', start, happenedAt: at(10) });
      await historyRepo.recordBattle(tx, { ...base, battleId: '00000000-0000-4000-8000-0000000000a2', opponent: 'mossling', format: 'wild', result: 'loss', happenedAt: at(11) });
      await historyRepo.recordBattle(tx, { ...base, battleId: '00000000-0000-4000-8000-0000000000a3', opponent: 'x', result: 'win', happenedAt: at(-1) });
      expect(await journalRepo.battles(tx, p, FROM, TO)).toEqual([
        { opponent: 'rival:Corin', format: 'trainer', result: 'win', zoneId: 'mire_route', at: at(10) },
        { opponent: 'mossling', format: 'wild', result: 'loss', zoneId: null, at: at(11) },
      ]);

      await auditRepo.write(tx, { actorId: p, action: 'npc.quest.claim', subject: 'mirevale.archivist', detail: { zone: 'mirevale' } }, at(12));
      await auditRepo.write(tx, { actorId: p, action: 'shop.buy', subject: 'potion', detail: {} }, at(12));
      await auditRepo.write(tx, { actorId: other, action: 'npc.quest.claim', subject: 'x', detail: {} }, at(12));
      expect((await journalRepo.audit(tx, p, ['npc.quest.claim', 'shop.haggle'], FROM, TO)).map((a) => [a.action, a.subject])).toEqual([['npc.quest.claim', 'mirevale.archivist']]);
      expect(await journalRepo.audit(tx, p, [], FROM, TO)).toEqual([]);

      await progressRepo.awardBadge(tx, p, 'bloom', at(13));
      expect(await journalRepo.badges(tx, p, FROM, TO)).toEqual([{ badgeId: 'bloom', at: at(13) }]);
      await runRepo.split(tx, p, 'champion', at(14));
      expect((await journalRepo.splits(tx, p, FROM, TO)).map((s) => s.split)).toEqual(['champion']);

      await npcMemoryRepo.remember(tx, p, 'mirevale.archivist', { zoneId: 'mirevale', deeds: ['insulted'] }, at(15));
      expect(await journalRepo.memories(tx, p)).toEqual([{ npcId: 'mirevale.archivist', zoneId: 'mirevale', deeds: [{ deed: 'insulted', at: at(15).toISOString() }] }]);
    });
  });
});
