/**
 * Phase B2 — the two quest objective kinds part 1 left out:
 *   `restoreZone` (advanced by the `restoreZone` event `completeBeatInTx` emits; the beat side is in story-beats.test)
 *   `deliverItem` (ZoneRoom `interact npc`: the items are spent in the SAME transaction that advances the objective).
 * Plus the POST /quests/claim gate for a delivered quest.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { QUESTS, getHeightfield, nearestWalkable, quest } from '@ewa/content';
import type { BadgeId, ZoneId } from '@ewa/content';
import { advanceQuests, deliveriesFor } from '../src/game/quests';
import { api, enter, ofType, placePlayer, register, sleep, startServer, waitFor } from './helpers';
import type { Account, Joined, TestServer } from './helpers';

let s: TestServer;

beforeAll(async () => {
  s = await startServer();
}, 120_000);
afterAll(async () => {
  await s?.stop();
}, 60_000);

/** Setup only: marks every quest before `questId` (in list order) done + claimed, so `questId` is active. */
async function claimUpTo(acc: Account, questId: string): Promise<void> {
  const now = new Date();
  await s.repos.db.transaction(async (tx) => {
    for (const q of QUESTS) {
      if (q.id === questId) break;
      for (const o of q.objectives) await s.repos.progress.advance(tx, acc.id, q.id, o.id, 1, true);
      await s.repos.progress.claim(tx, acc.id, q.id, now);
    }
  });
}

async function setItem(acc: Account, item: string, qty: number): Promise<void> {
  await s.repos.db.transaction(async (tx) => {
    const have = await s.repos.inventory.qty(tx, acc.id, item);
    if (qty !== have) await s.repos.inventory.add(tx, acc.id, item, qty - have);
  });
}

async function qtyOf(acc: Account, item: string): Promise<number> {
  return s.repos.db.transaction((tx) => s.repos.inventory.qty(tx, acc.id, item));
}

async function progressOf(acc: Account, questId: string) {
  return s.repos.db.transaction((tx) => s.repos.progress.quest(tx, acc.id, questId));
}

async function inZone(acc: Account, zoneId: ZoneId, x: number, z: number, badges: readonly BadgeId[] = []): Promise<Joined> {
  await s.repos.db.transaction(async (tx) => {
    for (const b of badges) await s.repos.progress.awardBadge(tx, acc.id, b, new Date());
  });
  const p = nearestWalkable(getHeightfield(zoneId), x, z, 3)!;
  await placePlayer(s, acc.id, zoneId, p[0], p[1]);
  return enter(s, acc, zoneId);
}

async function talk(j: Joined, targetId: string): Promise<Joined['msgs']> {
  const n = j.msgs.length;
  j.room.send('interact', { kind: 'npc', targetId });
  await waitFor(() => j.msgs.length > n, 3000).catch(() => undefined);
  await sleep(400);
  return j.msgs.slice(n);
}

const QM = 'forgewall.quartermaster';
const Q08 = quest('q08_anvil_debt');
// forgewall is gated by the Wraith badge (zone.gate); the quartermaster stands at (-20, 20)
const FORGEWALL_BADGES: BadgeId[] = ['bloom', 'ember', 'current', 'circuit', 'fault', 'wraith'];

describe('restoreZone objective (Phase B2)', () => {
  it('advances only on a restoreZone event for its zone, and only while q10 is active', async () => {
    const acc = await register(s);
    // q10 not active yet: nothing advances
    let touched = await s.repos.db.transaction((tx) => advanceQuests(tx, s.repos, acc.id, [{ kind: 'restoreZone', zoneId: 'mire_route' }]));
    expect(touched.filter((t) => t.questId === 'q10_restore_the_grove')).toEqual([]);
    await claimUpTo(acc, 'q10_restore_the_grove');
    touched = await s.repos.db.transaction((tx) => advanceQuests(tx, s.repos, acc.id, [{ kind: 'restoreZone', zoneId: 'solenne' }]));
    expect(touched.filter((t) => t.questId === 'q10_restore_the_grove')).toEqual([]);
    touched = await s.repos.db.transaction((tx) => advanceQuests(tx, s.repos, acc.id, [{ kind: 'restoreZone', zoneId: 'mire_route' }]));
    expect(touched).toContainEqual({ questId: 'q10_restore_the_grove', objectiveId: 'restore', count: 1, done: true });
  });
});

describe('deliverItem objective (Phase B2)', () => {
  it('deliveriesFor lists the open delivery only while q08 is active', async () => {
    const acc = await register(s);
    expect(await s.repos.db.transaction((tx) => deliveriesFor(tx, s.repos, acc.id, QM))).toEqual([]);
    await claimUpTo(acc, Q08.id);
    expect(await s.repos.db.transaction((tx) => deliveriesFor(tx, s.repos, acc.id, QM))).toEqual([{ questId: Q08.id, objectiveId: 'deliver', item: 'full_heal', qty: 3 }]);
    expect(await s.repos.db.transaction((tx) => deliveriesFor(tx, s.repos, acc.id, 'mirevale.archivist'))).toEqual([]);
  });

  it('short of items: a toast, nothing spent, nothing advanced; with enough: spent in the same tx, inventoryDelta + questProgress, once', async () => {
    const acc = await register(s);
    await claimUpTo(acc, Q08.id);
    await setItem(acc, 'full_heal', 2);
    const j = await inZone(acc, 'forgewall', -20, 21.5, FORGEWALL_BADGES);

    let out = await talk(j, QM);
    expect(ofType(out, 'toast').map((t) => t.text)).toEqual(['Bring 3 × Full Heal to deliver.']);
    expect(ofType(out, 'inventoryDelta')).toEqual([]);
    expect(ofType(out, 'progressionDelta').flatMap((p) => p.questProgress ?? []).filter((q) => q.objectiveId === 'deliver')).toEqual([]);
    expect(await qtyOf(acc, 'full_heal')).toBe(2);
    expect((await progressOf(acc, Q08.id)).find((r) => r.objectiveId === 'deliver')).toBeUndefined();

    await setItem(acc, 'full_heal', 5);
    out = await talk(j, QM);
    expect(ofType(out, 'inventoryDelta').map((d) => d.items)).toEqual([{ full_heal: 2 }]);
    expect(ofType(out, 'progressionDelta').flatMap((p) => p.questProgress ?? [])).toContainEqual({ questId: Q08.id, objectiveId: 'deliver', count: 1, done: true });
    expect(ofType(out, 'toast')).toEqual([]);
    expect(await qtyOf(acc, 'full_heal')).toBe(2);
    expect((await progressOf(acc, Q08.id)).find((r) => r.objectiveId === 'deliver')?.done).toBe(true);

    // a second talk spends nothing more
    out = await talk(j, QM);
    expect(ofType(out, 'inventoryDelta')).toEqual([]);
    expect(await qtyOf(acc, 'full_heal')).toBe(2);
    await j.room.leave(true);
  });

  it('a player without q08 active keeps their items', async () => {
    const acc = await register(s);
    await setItem(acc, 'full_heal', 4);
    const j = await inZone(acc, 'forgewall', -20, 21.5, FORGEWALL_BADGES);
    const out = await talk(j, QM);
    expect(ofType(out, 'inventoryDelta')).toEqual([]);
    expect(ofType(out, 'toast')).toEqual([]);
    expect(await qtyOf(acc, 'full_heal')).toBe(4);
    await j.room.leave(true);
  });

  it('POST /quests/claim: 409 until every objective is done, then grants once', async () => {
    const acc = await register(s);
    await claimUpTo(acc, Q08.id);
    await s.repos.db.transaction(async (tx) => {
      await s.repos.progress.advance(tx, acc.id, Q08.id, 'acier', 1, true);
      await s.repos.progress.advance(tx, acc.id, Q08.id, 'anvil', 1, true);
    });
    expect((await api(s, 'POST', '/quests/claim', acc.access, { questId: Q08.id })).status).toBe(409);
    await s.repos.db.transaction((tx) => s.repos.progress.advance(tx, acc.id, Q08.id, 'deliver', 1, true));
    const ok = await api(s, 'POST', '/quests/claim', acc.access, { questId: Q08.id });
    expect(ok.status).toBe(200);
    expect(ok.body.inventory['mythos_orb']).toBeGreaterThanOrEqual(1);
    const again = await api(s, 'POST', '/quests/claim', acc.access, { questId: Q08.id });
    expect(again.status).toBe(409);
    expect(again.body.error ?? again.body.code ?? JSON.stringify(again.body)).toMatch(/AlreadyClaimed/);
  });
});
