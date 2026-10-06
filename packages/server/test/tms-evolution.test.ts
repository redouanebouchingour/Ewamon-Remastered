/**
 * Phase D1–D3 on the server: story-beat grants (completeBeatInTx + the room's inventoryDelta), TMs through
 * `POST /creature/:id/moves`, the move tutor (`POST /creature/:id/tutor`), key-item shop rules, stone evolutions
 * (`POST /item/use` answers evolveReady, `POST /creature/:id/evolve` spends the stone) and trade evolutions (the
 * trade marks the received creature in creaturesUpdated; evolve accepts it once and clears the mark).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BADGE_ORDER, MOVE_TUTOR_PRICE, TRADE_EVOLVE_RIBBON, getHeightfield, nearestWalkable, storyBeat, tmItemId, zone } from '@ewa/content';
import type { ZoneId } from '@ewa/content';
import type { CreatureInstance } from '@ewa/core';
import { tradeOfferHash } from '@ewa/protocol';
import { newCreature } from '../src/game/creatures';
import { completeBeatInTx } from '../src/rooms/storyBeats';
import { api, content, enter, ofType, placePlayer, register, sleep, startServer, waitFor } from './helpers';
import type { Account, Joined, TestServer } from './helpers';

let s: TestServer;
beforeAll(async () => {
  s = await startServer();
}, 120_000);
afterAll(async () => {
  await s?.stop();
}, 60_000);

async function inZone(acc: Account, zoneId: ZoneId, x: number, z: number): Promise<Joined> {
  const p = nearestWalkable(getHeightfield(zoneId), x, z, 12)!;
  await placePlayer(s, acc.id, zoneId, p[0], p[1]);
  return enter(s, acc, zoneId);
}

async function allBadges(acc: Account): Promise<void> {
  await s.repos.db.transaction(async (tx) => {
    for (const b of BADGE_ORDER) await s.repos.progress.awardBadge(tx, acc.id, b, new Date());
  });
}

async function give(acc: Account, species: string, level: number, slot: 'party' | 'box' = 'party'): Promise<string> {
  return s.repos.db.transaction(async (tx) => {
    const n = (await s.repos.creatures.party(tx, acc.id)).length;
    const target = slot === 'party' ? ({ kind: 'party', index: n } as const) : ({ kind: 'box', index: 'nextBox' } as const);
    return (await s.repos.creatures.insert(tx, newCreature(content, species, level, { ownerId: acc.id }), target)).id;
  });
}

async function items(acc: Account, deltas: Record<string, number>): Promise<void> {
  await s.repos.db.transaction((tx) => s.repos.inventory.addMany(tx, acc.id, deltas));
}

async function qty(acc: Account, item: string): Promise<number> {
  return s.repos.db.transaction((tx) => s.repos.inventory.qty(tx, acc.id, item));
}

async function creature(id: string): Promise<CreatureInstance> {
  return s.repos.db.transaction(async (tx) => {
    const r = await s.repos.creatures.byId(tx, id);
    return r as unknown as CreatureInstance;
  });
}

describe('D1 story grants', () => {
  it('completeBeatInTx adds the beat grant once, in the beat transaction, and reports absolute counts', async () => {
    const acc = await register(s);
    const beat = storyBeat('current_after');
    const done = await s.repos.db.transaction((tx) => completeBeatInTx(tx, s.repos, acc.id, beat, new Date()));
    expect(done.items).toEqual({ 'HM Surf': 1 });
    expect(await qty(acc, 'HM Surf')).toBe(1);
    const none = await s.repos.db.transaction((tx) => completeBeatInTx(tx, s.repos, acc.id, storyBeat('first_witness'), new Date()));
    expect(none.items).toEqual({});
  });

  it('Maren gives the Old Rod at drowned_harbour: the room sends the inventoryDelta with the beat completion', async () => {
    const acc = await register(s);
    await s.repos.db.transaction((tx) => s.repos.progress.awardBadge(tx, acc.id, 'ember', new Date()));
    const maren = zone('saltmourn').npcs.find((n) => n.id === 'saltmourn.harbourmaster')!;
    const j = await inZone(acc, 'saltmourn', maren.x + 1.5, maren.z);
    j.room.send('interact', { targetId: maren.id, kind: 'npc' });
    await waitFor(() => ofType(j.msgs, 'storyBeat').some((m) => m.beatId === 'drowned_harbour' && m.phase === 'complete'), 5000);
    const delta = ofType(j.msgs, 'inventoryDelta').find((m) => m.items['old_rod'] !== undefined);
    expect(delta?.items).toEqual({ old_rod: 1 });
    expect(await qty(acc, 'old_rod')).toBe(1);
    // the beat is done: talking again grants nothing more
    await sleep(300);
    j.room.send('interact', { targetId: maren.id, kind: 'npc' });
    await sleep(400);
    expect(await qty(acc, 'old_rod')).toBe(1);
    await j.room.leave(true);
  }, 30_000);
});

describe('D2 TMs, key-item shop rules and the move tutor', () => {
  it('a TM teaches a compatible species once owned, is never used up, and a known move is always kept', async () => {
    const acc = await register(s, 'cindercap');
    const [starter] = await s.repos.db.transaction((tx) => s.repos.creatures.party(tx, acc.id));
    const cid = starter!.id;
    const cur = starter!.moves.map((m) => m.id);
    const withTm = [...cur.slice(0, 3), 'Heat Wave'];
    // not owned → notLearnable
    expect((await api(s, 'POST', `/creature/${cid}/moves`, acc.access, { moves: withTm })).body.code).toBe('notLearnable');
    await items(acc, { [tmItemId('Heat Wave')]: 1, [tmItemId('Ice Beam')]: 1 });
    const r = await api(s, 'POST', `/creature/${cid}/moves`, acc.access, { moves: withTm });
    expect(r.status).toBe(200);
    expect(r.body.moves.map((m: { id: string }) => m.id)).toEqual(withTm);
    expect(await qty(acc, tmItemId('Heat Wave'))).toBe(1); // reusable
    // a Fire species cannot take an Ice TM
    expect((await api(s, 'POST', `/creature/${cid}/moves`, acc.access, { moves: [...cur.slice(0, 3), 'Ice Beam'] })).body.code).toBe('notLearnable');
    // reordering keeps the taught move (already known) even without re-checking the TM
    await s.repos.db.transaction((tx) => s.repos.inventory.add(tx, acc.id, tmItemId('Heat Wave'), -1));
    expect((await api(s, 'POST', `/creature/${cid}/moves`, acc.access, { moves: [...withTm].reverse() })).status).toBe(200);
  });

  it('the shop sells a TM once (qty 1, refused when owned) and never buys a key item back', async () => {
    const acc = await register(s);
    await allBadges(acc);
    await s.repos.db.transaction((tx) => s.repos.players.addMoney(tx, acc.id, 10_000));
    const j = await inZone(acc, 'stormrook', zone('stormrook').spawn.x, zone('stormrook').spawn.z);
    const tm = tmItemId('Discharge');
    expect((await api(s, 'POST', '/shop/buy', acc.access, { item: tm, qty: 2 })).body.code).toBe('oneAtATime');
    expect((await api(s, 'POST', '/shop/buy', acc.access, { item: tm, qty: 1 })).status).toBe(200);
    expect((await api(s, 'POST', '/shop/buy', acc.access, { item: tm, qty: 1 })).body.code).toBe('alreadyOwned');
    expect((await api(s, 'POST', '/shop/sell', acc.access, { item: tm, qty: 1 })).body.code).toBe('notSellable');
    expect(await qty(acc, tm)).toBe(1);
    // the town's stone is on sale too
    const shop = await api(s, 'GET', '/shop/stormrook', acc.access);
    expect(shop.body.stock).toContain('storm_stone');
    expect(shop.body.prices[tm]).toBeGreaterThan(0);
    await j.room.leave(true);
  }, 30_000);

  it('the tutor teaches its moves for MOVE_TUTOR_PRICE in its own town only, replacing `forget` when four are known', async () => {
    const acc = await register(s);
    await allBadges(acc);
    await s.repos.db.transaction((tx) => s.repos.players.addMoney(tx, acc.id, 10_000));
    const cid = await give(acc, 'nerohat', 20); // Ghost/Poison
    const c0 = await creature(cid);
    // not near a tutor (no presence) → refused
    expect((await api(s, 'POST', `/creature/${cid}/tutor`, acc.access, { move: 'Shadow Sneak', forget: null })).body.code).toBe('noTutorHere');
    const tutor = zone('vesperveil').npcs.find((n) => n.tutor !== undefined)!;
    const j = await inZone(acc, 'vesperveil', tutor.x + 1.5, tutor.z);
    const moneyBefore = (await api(s, 'GET', '/me', acc.access)).body.money as number;
    // a move this tutor does not teach
    expect((await api(s, 'POST', `/creature/${cid}/tutor`, acc.access, { move: 'Brave Bird', forget: null })).body.code).toBe('noTutorHere');
    const forget = c0.moves.length >= 4 ? c0.moves[0]!.id : null;
    const r = await api(s, 'POST', `/creature/${cid}/tutor`, acc.access, { move: 'Shadow Sneak', forget });
    expect(r.status).toBe(200);
    expect(r.body.moves.some((m: { id: string }) => m.id === 'Shadow Sneak')).toBe(true);
    expect(r.body.inventoryDelta.money).toBe(moneyBefore - MOVE_TUTOR_PRICE);
    expect(r.body.inventoryDelta.creaturesUpdated[0].id).toBe(cid);
    // already known
    expect((await api(s, 'POST', `/creature/${cid}/tutor`, acc.access, { move: 'Shadow Sneak', forget: null })).body.code).toBe('alreadyKnown');
    // an incompatible species (Normal-only Endeavor is fine for anyone; Spectral Burn needs Ghost/Fire)
    const other = await give(acc, 'mufflo', 10); // Normal
    expect((await api(s, 'POST', `/creature/${other}/tutor`, acc.access, { move: 'Spectral Burn', forget: null })).body.code).toBe('notLearnable');
    await j.room.leave(true);
  }, 30_000);
});

describe('D3 stone and trade evolutions', () => {
  it('a stone: /item/use answers evolveReady without spending; /evolve spends exactly one; the wrong stone has no effect', async () => {
    const acc = await register(s);
    const cid = await give(acc, 'embrock', 8); // level 8: a stone works at any level
    const use0 = await api(s, 'POST', '/item/use', acc.access, { item: 'ember_stone', target: cid, qty: 1 });
    expect(use0.body.code).toBe('InsufficientItems');
    await items(acc, { ember_stone: 2, tide_stone: 1 });
    expect((await api(s, 'POST', '/item/use', acc.access, { item: 'tide_stone', target: cid, qty: 1 })).body.code).toBe('noEffect');
    const use = await api(s, 'POST', '/item/use', acc.access, { item: 'ember_stone', target: cid, qty: 1 });
    expect(use.status).toBe(200);
    expect(use.body.events).toEqual([{ t: 'evolveReady', into: 'magmolith', item: 'ember_stone' }]);
    expect(await qty(acc, 'ember_stone')).toBe(2);
    // a level-based target is refused for a stone family; the stone target evolves and spends one
    const ev = await api(s, 'POST', `/creature/${cid}/evolve`, acc.access, { into: 'magmolith' });
    expect(ev.status).toBe(200);
    expect(ev.body.speciesId).toBe('magmolith');
    expect(ev.body.inventoryDelta.items).toEqual({ ember_stone: 1 });
    expect(await qty(acc, 'ember_stone')).toBe(1);
    const dex = (await api(s, 'GET', '/dex', acc.access)).body;
    expect(dex.caught).toContain('magmolith');
    // without the stone: notReady
    const cid2 = await give(acc, 'stormchick', 30);
    expect((await api(s, 'POST', `/creature/${cid2}/evolve`, acc.access, { into: 'thundrix' })).body.code).toBe('notReady');
  });

  it('a level family still evolves by level only (the response carries no inventoryDelta)', async () => {
    const acc = await register(s);
    const cid = await give(acc, 'smellduck', 20);
    const ev = await api(s, 'POST', `/creature/${cid}/evolve`, acc.access, { into: 'bloomduck' });
    expect(ev.status).toBe(200);
    expect(ev.body.inventoryDelta).toBeUndefined();
  });

  it('a trade marks the received trade-evolver in creaturesUpdated; /evolve accepts it once and clears the mark', async () => {
    const a = await register(s);
    const b = await register(s);
    const p = nearestWalkable(getHeightfield('mirevale'), 0, 6, 12)!;
    const q = nearestWalkable(getHeightfield('mirevale'), 1.5, 6, 12)!;
    await placePlayer(s, a.id, 'mirevale', p[0], p[1]);
    await placePlayer(s, b.id, 'mirevale', q[0], q[1]);
    const ja = await enter(s, a, 'mirevale');
    const jb = await enter(s, b, 'mirevale');
    await waitFor(() => ja.room.state.players.has(b.id) && jb.room.state.players.has(a.id), 5000);
    const ca = await give(a, 'glowtent', 12);
    const cb = await give(b, 'glimp', 10);
    // before any trade the trade evolution is refused
    expect((await api(s, 'POST', `/creature/${ca}/evolve`, a.access, { into: 'toxiveil' })).body.code).toBe('notReady');
    const last = (j: Joined) => ofType(j.msgs, 'tradeUpdate').at(-1)!;
    ja.room.send('tradeRequest', { targetId: b.id });
    await waitFor(() => ofType(jb.msgs, 'tradeUpdate').length === 1, 3000);
    const tradeId = last(jb).tradeId;
    jb.room.send('tradeReply', { tradeId, accept: true });
    await waitFor(() => last(ja).phase === 'open', 3000);
    ja.room.send('tradeOffer', { tradeId, creatureIds: [ca], money: 0 });
    await waitFor(() => last(jb).offers.some((o) => o.creatureIds.includes(ca)), 3000);
    jb.room.send('tradeOffer', { tradeId, creatureIds: [cb], money: 0 });
    await waitFor(() => last(ja).offers.some((o) => o.creatureIds.includes(cb)), 3000);
    const h = tradeOfferHash(last(ja).offers);
    await sleep(260);
    ja.room.send('tradeConfirm', { tradeId, offerHash: h });
    jb.room.send('tradeConfirm', { tradeId, offerHash: h });
    await waitFor(() => last(ja).phase === 'complete' && last(jb).phase === 'complete', 5000);
    await waitFor(() => ofType(jb.msgs, 'inventoryDelta').some((m) => m.creaturesAdded.some((c) => c.id === ca)), 3000);
    const delta = ofType(jb.msgs, 'inventoryDelta').find((m) => m.creaturesAdded.some((c) => c.id === ca))!;
    expect(delta.creaturesUpdated.map((c) => c.id)).toEqual([ca]);
    expect(delta.creaturesUpdated[0]!.ribbons).toContain(TRADE_EVOLVE_RIBBON);
    // the glimp b gave away has no trade evolution: a's delta updates nothing
    const deltaA = ofType(ja.msgs, 'inventoryDelta').find((m) => m.creaturesAdded.some((c) => c.id === cb))!;
    expect(deltaA.creaturesUpdated).toEqual([]);
    // the new owner evolves it once; the mark is gone afterwards
    const ev = await api(s, 'POST', `/creature/${ca}/evolve`, b.access, { into: 'toxiveil' });
    expect(ev.status).toBe(200);
    expect(ev.body.speciesId).toBe('toxiveil');
    expect(ev.body.ribbons).not.toContain(TRADE_EVOLVE_RIBBON);
    expect((await creature(ca)).ribbons).not.toContain(TRADE_EVOLVE_RIBBON);
    await ja.room.leave(true);
    await jb.room.leave(true);
  }, 40_000);
});
