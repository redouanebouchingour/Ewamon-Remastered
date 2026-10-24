/**
 * A recurring rival (migration 0023): the first `ensure` creates the row with its identity and a second keeps it; a
 * meeting moves the record, the last meeting and the cooldown and clears the last words; the words are taken once per
 * meeting and only inside the window; a player's row goes with the player.
 */
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AnyDb } from '../src/db';
import { rivalRepo } from '../src/repos/rivals';
import { mkPlayer, openTestDb } from './helpers';

let db: AnyDb;
beforeAll(async () => {
  db = await openTestDb();
});
afterAll(async () => {
  await db.close();
});

const at = (m: number): Date => new Date(Date.UTC(2026, 9, 24, 12, m));
const ID = { name: 'Corin', look: 'casual2_male', temperament: 'brash', signature: 'cindercap' };

describe('rivals', () => {
  it('keeps the first identity, counts meetings and holds the cooldown', async () => {
    await db.transaction(async (tx) => {
      const p = await mkPlayer(tx, 'rival_a');
      expect(await rivalRepo.of(tx, p)).toBeNull();
      const first = await rivalRepo.ensure(tx, p, ID, at(0));
      expect(first).toMatchObject({ ...ID, playerWins: 0, rivalWins: 0, draws: 0, meetings: 0, lastResult: null, lastTeam: [], nextAt: null });
      const again = await rivalRepo.ensure(tx, p, { ...ID, name: 'Vesna' }, at(1));
      expect(again.name).toBe('Corin');
      const won = await rivalRepo.recordMeeting(tx, p, { result: 'won', zoneId: 'ash_route', team: [{ speciesId: 'cindercap', level: 14 }], cooldownMs: 60_000 }, at(2));
      expect(won).toMatchObject({ playerWins: 1, rivalWins: 0, meetings: 1, lastResult: 'won', lastZone: 'ash_route', lastTeam: [{ speciesId: 'cindercap', level: 14 }] });
      expect(won!.nextAt!.getTime()).toBe(at(2).getTime() + 60_000);
      const lost = await rivalRepo.recordMeeting(tx, p, { result: 'lost', zoneId: 'tide_route', team: [], cooldownMs: 0 }, at(3));
      expect(lost).toMatchObject({ playerWins: 1, rivalWins: 1, meetings: 2, lastResult: 'lost' });
      const draw = await rivalRepo.recordMeeting(tx, p, { result: 'draw', zoneId: 'tide_route', team: [], cooldownMs: 0 }, at(4));
      expect(draw).toMatchObject({ draws: 1, meetings: 3 });
      expect(await rivalRepo.recordMeeting(tx, await mkPlayer(tx, 'rival_none'), { result: 'won', zoneId: 'x', team: [], cooldownMs: 0 }, at(4))).toBeNull();
    });
  });

  it('takes the last words once per meeting, inside the window', async () => {
    await db.transaction(async (tx) => {
      const p = await mkPlayer(tx, 'rival_b');
      await rivalRepo.ensure(tx, p, ID, at(0));
      expect(await rivalRepo.setWords(tx, p, 'Not before we meet.', at(1), 60_000)).toBe(false);
      await rivalRepo.recordMeeting(tx, p, { result: 'won', zoneId: 'ash_route', team: [], cooldownMs: 0 }, at(10));
      expect(await rivalRepo.setWords(tx, p, 'Too late.', at(30), 60_000)).toBe(false);
      expect(await rivalRepo.setWords(tx, p, 'Next time, I win.', at(10), 60_000)).toBe(true);
      expect(await rivalRepo.setWords(tx, p, 'Twice?', at(10), 60_000)).toBe(false);
      expect((await rivalRepo.of(tx, p))!.lastWords).toBe('Next time, I win.');
      await rivalRepo.recordMeeting(tx, p, { result: 'lost', zoneId: 'ash_route', team: [], cooldownMs: 0 }, at(11));
      expect((await rivalRepo.of(tx, p))!.lastWords).toBeNull();
    });
  });

  it("goes with the player's row", async () => {
    const p = await db.transaction(async (tx) => {
      const id = await mkPlayer(tx, 'rival_c');
      await rivalRepo.ensure(tx, id, ID, at(0));
      return id;
    });
    await db.transaction((tx) => tx.execute(sql`delete from players where id = ${p}`));
    expect(await db.transaction((tx) => rivalRepo.of(tx, p))).toBeNull();
  });
});
