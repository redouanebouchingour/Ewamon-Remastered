/**
 * Dex completion rewards over REST: `POST /dex/rewards/:rewardId/claim` pays a complete set once (404 unknown id, 409
 * rewardIncomplete / AlreadyClaimed), and `POST /profile` takes a Dex title only once its reward is claimed.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEX_REWARDS } from '@ewa/content';
import { api, register, startServer } from './helpers';
import type { TestServer } from './helpers';

describe('dex rewards', () => {
  let s: TestServer;
  beforeAll(async () => {
    s = await startServer();
  }, 120_000);
  afterAll(async () => {
    await s?.stop();
  }, 60_000);

  const smallestZone = [...DEX_REWARDS].filter((r) => r.need.kind === 'zone').sort((a, b) => (a.need.kind === 'zone' && b.need.kind === 'zone' ? a.need.species.length - b.need.species.length : 0))[0]!;
  const zoneSpecies = smallestZone.need.kind === 'zone' ? smallestZone.need.species : [];

  it('claims a complete zone set once; an incomplete one and an unknown id are refused', async () => {
    const acc = await register(s, 'bramblecub');
    expect((await api(s, 'POST', '/dex/rewards/nope/claim', acc.access, {})).status).toBe(404);
    const early = await api(s, 'POST', `/dex/rewards/${smallestZone.id}/claim`, acc.access, {});
    expect(early.status).toBe(409);
    expect(early.body.code).toBe('rewardIncomplete');

    const before = await api(s, 'GET', '/me', acc.access);
    await s.repos.db.transaction(async (tx) => {
      for (const sp of zoneSpecies) await s.repos.progress.markCaught(tx, acc.id, sp, 'normal', false, new Date());
    });
    const ok = await api(s, 'POST', `/dex/rewards/${smallestZone.id}/claim`, acc.access, {});
    expect(ok.status).toBe(200);
    expect(ok.body.rewards).toEqual([smallestZone.id]);
    expect(ok.body.money).toBe(before.body.money + smallestZone.money);
    for (const [item, n] of Object.entries(smallestZone.items)) expect(ok.body.inventory[item] ?? 0).toBeGreaterThanOrEqual(n);

    const again = await api(s, 'POST', `/dex/rewards/${smallestZone.id}/claim`, acc.access, {});
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('AlreadyClaimed');
    expect((await api(s, 'GET', '/dex', acc.access)).body.rewards).toEqual([smallestZone.id]);
  });

  it('a Dex title is locked until its reward is claimed', async () => {
    const acc = await register(s, 'bramblecub');
    const title = smallestZone.trainerTitle!;
    const locked = await api(s, 'POST', '/profile', acc.access, { title });
    expect(locked.status).toBe(403);
    expect(locked.body.code).toBe('titleLocked');
    await s.repos.db.transaction(async (tx) => {
      for (const sp of zoneSpecies) await s.repos.progress.markCaught(tx, acc.id, sp, 'normal', false, new Date());
    });
    expect((await api(s, 'POST', `/dex/rewards/${smallestZone.id}/claim`, acc.access, {})).status).toBe(200);
    const set = await api(s, 'POST', '/profile', acc.access, { title });
    expect(set.status).toBe(200);
    expect(set.body.title).toBe(title);
    // an ordinary title still needs nothing
    expect((await api(s, 'POST', '/profile', acc.access, { title: 'Witness' })).status).toBe(200);
  });
});
