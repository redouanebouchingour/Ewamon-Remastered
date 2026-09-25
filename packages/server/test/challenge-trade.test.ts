/**
 * §50.4.5 challenge-trade.test.ts + §30.5.1 #21.
 * Challenges: presence re-checked before createBattle; a challenge to a player who left → `unavailable`; the 45 s
 * TTL. Trades: `offerHash` is fnv1a32 of the canonical pair of offers; a changed offer resets both confirmations;
 * a stale hash is `staleOffer`; nothing moves until both confirm the same hash; completion is one transaction
 * (owners swap, money both ways, two trade_history rows, inventoryDelta to both); cancel / leave / idle / an
 * insufficient balance at completion write nothing.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getHeightfield, nearestWalkable } from '@ewa/content';
import { TRAINER_EXP, canonicalJson, fnv1a32 } from '@ewa/core';
import { tradeOfferHash } from '@ewa/protocol';
import { newCreature } from '../src/game/creatures';
import { TRADE_IDLE_MS, TradeSession } from '../src/rooms/tradeSession';
import { START_EXP, START_MONEY, api, content, enter, ofType, placePlayer, rawQuery, register, sleep, snapshot, startServer, waitFor } from './helpers';
import type { Account, Joined, TestServer } from './helpers';

describe('TradeSession (pure)', () => {
  it('offerHash = fnv1a32(canonicalJson(both offers without confirmed, sorted by playerId)) as 8 hex', () => {
    const t = new TradeSession('00000000-0000-4000-8000-00000000000a', 'bbbb', 'aaaa', 0);
    t.open(1);
    expect(t.setOffer('bbbb', ['c1', 'c2'], 50, 2)).toBe('ok');
    const expected = fnv1a32(
      canonicalJson([
        { playerId: 'aaaa', creatureIds: [], money: 0 },
        { playerId: 'bbbb', creatureIds: ['c1', 'c2'], money: 50 },
      ]),
    )
      .toString(16)
      .padStart(8, '0');
    expect(t.offerHash()).toBe(expected);
    expect(t.offerHash()).toBe(tradeOfferHash(t.offers));
    expect(t.offerHash()).toMatch(/^[0-9a-f]{8}$/);
    // confirming does not change the hash
    const h = t.offerHash();
    expect(t.confirm('aaaa', h, 3)).toBe('ok');
    expect(t.offerHash()).toBe(h);
  });

  it('a changed offer resets BOTH confirmations and re-opens; a stale hash is staleOffer; phases and parties are enforced', () => {
    const t = new TradeSession('00000000-0000-4000-8000-00000000000b', 'a', 'b', 0);
    expect(t.setOffer('a', ['x'], 0, 1)).toBe('badPhase'); // still requested
    expect(t.confirm('a', t.offerHash(), 1)).toBe('badPhase');
    t.open(1);
    t.setOffer('a', ['x'], 0, 2);
    t.setOffer('b', [], 100, 3);
    const h1 = t.offerHash();
    expect(t.confirm('a', h1, 4)).toBe('ok');
    expect(t.phase).toBe('confirming');
    expect(t.offers[0].confirmed).toBe(true);
    // b changes its offer after a confirmed: both flags cleared, phase open, old hash stale
    expect(t.setOffer('b', [], 150, 5)).toBe('ok');
    expect(t.phase).toBe('open');
    expect(t.offers.map((o) => o.confirmed)).toEqual([false, false]);
    expect(t.confirm('a', h1, 6)).toBe('staleOffer');
    expect(t.bothConfirmed()).toBe(false);
    const h2 = t.offerHash();
    expect(t.confirm('a', h2, 7)).toBe('ok');
    expect(t.confirm('b', h2, 8)).toBe('ok');
    expect(t.bothConfirmed()).toBe(true);
    expect(t.setOffer('z', [], 0, 9)).toBe('notParty');
    expect(t.confirm('z', h2, 9)).toBe('notParty');
    expect(t.idle(8 + TRADE_IDLE_MS - 1)).toBe(false);
    expect(t.idle(8 + TRADE_IDLE_MS)).toBe(true);
  });
});

let s: TestServer;
beforeAll(async () => {
  s = await startServer();
}, 120_000);
afterAll(async () => {
  await s?.stop();
}, 60_000);

async function inZone(x: number, z: number, acc?: Account): Promise<{ acc: Account; j: Joined }> {
  const a = acc ?? (await register(s));
  const p = nearestWalkable(getHeightfield('mirevale'), x, z, 12)!;
  await placePlayer(s, a.id, 'mirevale', p[0], p[1]);
  return { acc: a, j: await enter(s, a, 'mirevale') };
}

/** Two players standing ~1.5 m apart near the Mirevale spawn, each seeing the other. */
async function pair(): Promise<[{ acc: Account; j: Joined }, { acc: Account; j: Joined }]> {
  const a = await inZone(0, 6);
  const b = await inZone(1.5, 6);
  await waitFor(() => a.j.room.state.players.has(b.acc.id) && b.j.room.state.players.has(a.acc.id), 5000);
  return [a, b];
}

async function giveCreature(acc: Account, species: string, level: number): Promise<string> {
  return s.repos.db.transaction(async (tx) => {
    const n = (await s.repos.creatures.party(tx, acc.id)).length;
    return (await s.repos.creatures.insert(tx, newCreature(content, species, level, { ownerId: acc.id }), { kind: 'party', index: n })).id;
  });
}

function lastTrade(j: Joined): Extract<Joined['msgs'][number], { type: 'tradeUpdate' }> {
  return ofType(j.msgs, 'tradeUpdate').at(-1)!;
}

describe('challenges (§30.4.5)', () => {
  it('a challenge whose target leaves → unavailable to the challenger; the 45 s TTL → expired', async () => {
    const [a, b] = await pair();
    a.j.room.send('challenge', { targetId: b.acc.id });
    await waitFor(() => ofType(b.j.msgs, 'challengeReceived').length === 1, 3000);
    await b.j.room.leave(true);
    await waitFor(() => ofType(a.j.msgs, 'challengeResult').length === 1, 3000);
    expect(ofType(a.j.msgs, 'challengeResult')[0]).toMatchObject({ targetId: b.acc.id, result: 'unavailable' });
    // TTL: a fresh target, the clock jumps past 45 s, the sweep expires the invite
    const c = await inZone(1.5, 6);
    await waitFor(() => a.j.room.state.players.has(c.acc.id), 5000);
    await sleep(1100); // challenge limit 3 / 5 s is per client — plenty left, but keep the invites apart
    a.j.room.send('challenge', { targetId: c.acc.id });
    await waitFor(() => ofType(c.j.msgs, 'challengeReceived').length === 1, 3000);
    s.time.advance(46_000);
    try {
      await waitFor(() => ofType(a.j.msgs, 'challengeResult').length === 2, 3000);
      expect(ofType(a.j.msgs, 'challengeResult')[1]).toMatchObject({ targetId: c.acc.id, result: 'expired' });
      // accepting the expired invite starts nothing
      c.j.room.send('challengeReply', { fromId: a.acc.id, accept: true });
      await waitFor(() => ofType(c.j.msgs, 'challengeResult').length === 1, 3000);
      expect(ofType(c.j.msgs, 'challengeResult')[0]!.result).toBe('unavailable');
      expect(ofType(a.j.msgs, 'battleStart')).toEqual([]);
    } finally {
      s.time.advance(-46_000);
    }
    await a.j.room.leave(true);
    await c.j.room.leave(true);
  }, 60_000);
});

describe('trades (§30.8.3, §30.5.1 #21)', () => {
  it('request → accept → offers → #21 stale hash / changed offer → both confirm → one transaction swaps owners and money', async () => {
    const [a, b] = await pair();
    const ca = await giveCreature(a.acc, 'glimp', 11);
    const cb = await giveCreature(b.acc, 'mossling', 13);
    a.j.room.send('tradeRequest', { targetId: b.acc.id });
    await waitFor(() => ofType(b.j.msgs, 'tradeUpdate').length === 1, 3000);
    const req = lastTrade(b.j);
    expect(req).toMatchObject({ phase: 'requested' });
    const tradeId = req.tradeId;
    expect(lastTrade(a.j).tradeId).toBe(tradeId);
    b.j.room.send('tradeReply', { tradeId, accept: true });
    await waitFor(() => lastTrade(a.j).phase === 'open', 3000);
    const snapA = await snapshot(s, a.acc.id);
    const snapB = await snapshot(s, b.acc.id);
    // validation: a creature a does not own; more money than a has
    a.j.room.send('tradeOffer', { tradeId, creatureIds: [cb], money: 0 });
    await waitFor(() => ofType(a.j.msgs, 'error').some((e) => e.detail === 'notOwner'), 3000);
    await sleep(260);
    a.j.room.send('tradeOffer', { tradeId, creatureIds: [ca], money: 999_999 });
    await waitFor(() => ofType(a.j.msgs, 'error').some((e) => e.detail === 'insufficientFunds'), 3000);
    await sleep(260);
    a.j.room.send('tradeOffer', { tradeId, creatureIds: [ca], money: 200 });
    await waitFor(() => lastTrade(b.j).offers[0].creatureIds.length === 1, 3000);
    b.j.room.send('tradeOffer', { tradeId, creatureIds: [cb], money: 0 });
    await waitFor(() => lastTrade(a.j).offers[1].creatureIds.length === 1, 3000);
    const h1 = lastTrade(a.j).offerHash;
    expect(h1).toBe(tradeOfferHash(lastTrade(a.j).offers));
    a.j.room.send('tradeConfirm', { tradeId, offerHash: h1 });
    await waitFor(() => lastTrade(b.j).phase === 'confirming', 3000);
    // #21: b modifies its offer after a confirmed → phase open, both confirmations cleared
    await sleep(260);
    b.j.room.send('tradeOffer', { tradeId, creatureIds: [cb], money: 50 });
    await waitFor(() => lastTrade(a.j).offers[1].money === 50, 3000);
    expect(lastTrade(a.j).phase).toBe('open');
    expect(lastTrade(a.j).offers.map((o) => o.confirmed)).toEqual([false, false]);
    // #21: confirming with the old hash → notAllowed staleOffer; nothing persisted so far
    await sleep(260);
    b.j.room.send('tradeConfirm', { tradeId, offerHash: h1 });
    await waitFor(() => ofType(b.j.msgs, 'error').some((e) => e.detail === 'staleOffer'), 3000);
    expect(await snapshot(s, a.acc.id)).toBe(snapA);
    expect(await snapshot(s, b.acc.id)).toBe(snapB);
    const h2 = lastTrade(a.j).offerHash;
    await sleep(260);
    a.j.room.send('tradeConfirm', { tradeId, offerHash: h2 });
    b.j.room.send('tradeConfirm', { tradeId, offerHash: h2 });
    await waitFor(() => lastTrade(a.j).phase === 'complete' && lastTrade(b.j).phase === 'complete', 5000);
    // owners swapped, both into the receiver's box; money both ways
    const rows = await rawQuery(s.db, 'select id, owner_id, slot_kind from creature_instances where id = any($1::uuid[])', [[ca, cb]]);
    expect(rows.find((r) => r.id === ca)).toMatchObject({ owner_id: b.acc.id, slot_kind: 'box' });
    expect(rows.find((r) => r.id === cb)).toMatchObject({ owner_id: a.acc.id, slot_kind: 'box' });
    const meA = (await api(s, 'GET', '/me', a.acc.access)).body;
    const meB = (await api(s, 'GET', '/me', b.acc.access)).body;
    expect(meA.money).toBe(START_MONEY - 200 + 50);
    expect(meB.money).toBe(START_MONEY + 200 - 50);
    expect(meA.trainerExp).toBe(START_EXP + TRAINER_EXP.tradeComplete);
    const hist = await rawQuery(s.db, 'select player_id, money_sent, money_received from trade_history where trade_id = $1 order by player_id', [tradeId]);
    expect(hist).toHaveLength(2);
    // inventoryDelta to both (absolute money, removed / added creatures) + dex through progressionDelta
    await waitFor(() => ofType(a.j.msgs, 'inventoryDelta').length > 0 && ofType(b.j.msgs, 'inventoryDelta').length > 0, 3000);
    expect(ofType(a.j.msgs, 'inventoryDelta').at(-1)).toMatchObject({ money: START_MONEY - 150, creaturesRemoved: [ca], creaturesAdded: [expect.objectContaining({ id: cb, ownerId: a.acc.id })] });
    expect(ofType(b.j.msgs, 'progressionDelta').at(-1)).toMatchObject({ dexCaught: ['glimp'], trainerExp: START_EXP + TRAINER_EXP.tradeComplete });
    // both are free again: a new request works
    await sleep(1000);
    a.j.room.send('tradeRequest', { targetId: b.acc.id });
    await waitFor(() => ofType(b.j.msgs, 'tradeUpdate').filter((m) => m.phase === 'requested').length === 2, 3000);
    await a.j.room.leave(true);
    await waitFor(() => lastTrade(b.j).phase === 'cancelled', 3000); // leaving cancels
    await b.j.room.leave(true);
  }, 90_000);

  it('cancel, decline, idle (120 s) and an insufficient balance at completion all write nothing', async () => {
    const [a, b] = await pair();
    const snapA = await snapshot(s, a.acc.id);
    const snapB = await snapshot(s, b.acc.id);
    // decline
    a.j.room.send('tradeRequest', { targetId: b.acc.id });
    await waitFor(() => ofType(b.j.msgs, 'tradeUpdate').length === 1, 3000);
    b.j.room.send('tradeReply', { tradeId: lastTrade(b.j).tradeId, accept: false });
    await waitFor(() => lastTrade(a.j).phase === 'cancelled', 3000);
    // idle
    await sleep(1100);
    a.j.room.send('tradeRequest', { targetId: b.acc.id });
    await waitFor(() => ofType(b.j.msgs, 'tradeUpdate').filter((m) => m.phase === 'requested').length === 2, 3000);
    b.j.room.send('tradeReply', { tradeId: lastTrade(b.j).tradeId, accept: true });
    await waitFor(() => lastTrade(a.j).phase === 'open', 3000);
    s.time.advance(TRADE_IDLE_MS + 100);
    try {
      await waitFor(() => lastTrade(a.j).phase === 'cancelled', 3000);
    } finally {
      s.time.advance(-(TRADE_IDLE_MS + 100));
    }
    // insufficient balance at the completion instant: money offered, then spent before both confirm
    await sleep(1100);
    a.j.room.send('tradeRequest', { targetId: b.acc.id });
    await waitFor(() => ofType(b.j.msgs, 'tradeUpdate').filter((m) => m.phase === 'requested').length === 3, 3000);
    const tradeId = lastTrade(b.j).tradeId;
    b.j.room.send('tradeReply', { tradeId, accept: true });
    await waitFor(() => lastTrade(a.j).phase === 'open' && lastTrade(a.j).tradeId === tradeId, 3000);
    a.j.room.send('tradeOffer', { tradeId, creatureIds: [], money: 2_000 });
    await waitFor(() => lastTrade(b.j).offers[0].money === 2_000, 3000);
    await s.repos.db.transaction((tx) => s.repos.players.addMoney(tx, a.acc.id, -(START_MONEY - 500))); // a now has 500
    const h = lastTrade(a.j).offerHash;
    a.j.room.send('tradeConfirm', { tradeId, offerHash: h });
    b.j.room.send('tradeConfirm', { tradeId, offerHash: h });
    await waitFor(() => lastTrade(a.j).phase === 'cancelled' && lastTrade(a.j).tradeId === tradeId, 5000);
    await s.repos.db.transaction((tx) => s.repos.players.addMoney(tx, a.acc.id, START_MONEY - 500));
    expect(await snapshot(s, a.acc.id)).toBe(snapA);
    expect(await snapshot(s, b.acc.id)).toBe(snapB);
    expect(await rawQuery(s.db, 'select 1 from trade_history where trade_id = $1', [tradeId])).toHaveLength(0);
    // a foreign trade id leaks nothing
    b.j.room.send('tradeCancel', { tradeId: '00000000-0000-4000-8000-000000000000' });
    await waitFor(() => ofType(b.j.msgs, 'error').some((e) => e.code === 'notFound'), 3000);
    await a.j.room.leave(true);
    await b.j.room.leave(true);
  }, 90_000);
});
