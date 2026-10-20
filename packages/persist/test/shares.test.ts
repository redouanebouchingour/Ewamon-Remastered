/**
 * Battle replays (migration 0006 battle_shares): one share per (player, battle), found again by its token; sharing the
 * same battle twice returns the first share; a token already taken by another share returns null.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AnyDb } from '../src/db';
import { historyRepo } from '../src/repos/history';
import type { SharedReplay } from '../src/types';
import { mkPlayer, openTestDb } from './helpers';

let db: AnyDb;
beforeAll(async () => {
  db = await openTestDb();
});
afterAll(async () => {
  await db.close();
});

const REPLAY: SharedReplay = {
  format: 'wild',
  seat: 0,
  labels: ['ash', null],
  result: 'win',
  turns: 3,
  happenedAt: '2026-10-20T10:00:00.000Z',
  seed: [1, 2, 3, 4],
  start: { zoneId: 'mirevale', terrain: 'grove', sides: [{}, {}] },
  actions: [[{ kind: 'move', move: 'tackle' }, null]],
  finalDigest: '0a1b2c3d',
};
const NOW = new Date('2026-10-20T10:05:00.000Z');
const BATTLE_A = '00000000-0000-4000-8000-00000000000a';
const BATTLE_B = '00000000-0000-4000-8000-00000000000b';

describe('battle_shares', () => {
  it('stores a share, finds it by token and by (player, battle)', async () => {
    await db.transaction(async (tx) => {
      const p = await mkPlayer(tx);
      const row = await historyRepo.createShare(tx, { token: 'tok-one', playerId: p, battleId: BATTLE_A, replay: REPLAY }, NOW);
      expect(row?.token).toBe('tok-one');
      expect((await historyRepo.shareByToken(tx, 'tok-one'))?.replay).toEqual(REPLAY);
      expect((await historyRepo.shareOf(tx, p, BATTLE_A))?.token).toBe('tok-one');
      expect(await historyRepo.shareOf(tx, p, BATTLE_B)).toBeNull();
      expect(await historyRepo.shareByToken(tx, 'missing')).toBeNull();
    });
  });

  it('a second share of the same battle returns the first; a taken token returns null', async () => {
    await db.transaction(async (tx) => {
      const p = await mkPlayer(tx);
      const q = await mkPlayer(tx);
      await historyRepo.createShare(tx, { token: 'tok-first', playerId: p, battleId: BATTLE_A, replay: REPLAY }, NOW);
      const again = await historyRepo.createShare(tx, { token: 'tok-second', playerId: p, battleId: BATTLE_A, replay: REPLAY }, NOW);
      expect(again?.token).toBe('tok-first');
      expect(await historyRepo.shareByToken(tx, 'tok-second')).toBeNull();
      expect(await historyRepo.createShare(tx, { token: 'tok-first', playerId: q, battleId: BATTLE_B, replay: REPLAY }, NOW)).toBeNull();
    });
  });
});
