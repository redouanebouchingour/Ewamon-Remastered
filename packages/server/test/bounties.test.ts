/**
 * The bounty board (content bounties.ts, game/bounties.ts): a Badlander party posts a bounty on another trainer's ghost
 * in a town (escrow and cut taken, refusals named); the board posts its own on a ghost that keeps winning; beating the
 * ghost claims every bounty on it once (the Lawlander bonus, the lead's honor and history, the toast after battleEnd,
 * audit rows), a second hunter finds none; an expired post refunds the whole escrow once; a nemesis of rank 2 pays its
 * trainer's personal bounty; a zone room meets a wanted ghost first; with the board off (testEnv) nothing is claimed.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { matchMaker } from '@colyseus/core';
import { BOUNTY_POST_HOURS, bountyFee, bountyPayout, gameBountyReward, ghostReward, nemesisBounty, nemesisFullName, zone } from '@ewa/content';
import type { ZoneId } from '@ewa/content';
import { createRng } from '@ewa/core';
import type { Action, BattleState } from '@ewa/core';
import type { NewNemesis } from '@ewa/persist';
import type { ServerMessage } from '@ewa/protocol';
import { createRoomMetrics } from '../src/metrics';
import { silentLogger } from '../src/log';
import { BattleCoordinator } from '../src/rooms/battleSession';
import type { BattleHost } from '../src/rooms/battleSession';
import { SHADOW_CHECK_MS } from '../src/rooms/ZoneRoom';
import type { ZoneRoom } from '../src/rooms/ZoneRoom';
import { broughtInText, postGameBounties } from '../src/game/bounties';
import { newCreature } from '../src/game/creatures';
import type { SpawnRecord } from '../src/rooms/spawnDirector';
import { api, content, enter, placePlayer, rawQuery, register, startServer, waitFor } from './helpers';
import type { Account, TestServer } from './helpers';

let s: TestServer;
beforeAll(async () => {
  s = await startServer({ BOUNTIES: 'always' });
}, 120_000);
afterAll(async () => {
  await s?.stop();
}, 60_000);

const tx = <T>(f: (t: Parameters<Parameters<typeof s.repos.db.transaction>[0]>[0]) => Promise<T>): Promise<T> => s.repos.db.transaction(f);
const money = async (id: string): Promise<number> => (await tx((t) => s.repos.players.byId(t, id)))!.money;
const setMoney = (id: string, m: number) => rawQuery(s.db, 'update players set money = $2 where id = $1', [id, m]);
/** The account's starter becomes a fresh `species` at `level` (its lead). */
async function leadAs(id: string, species: string, level: number): Promise<void> {
  await tx(async (t) => {
    const cur = (await s.repos.creatures.party(t, id))[0]!;
    const fresh = newCreature(content, species, level, { ownerId: id, moves: 'level' });
    await s.repos.creatures.update(t, { ...cur, speciesId: species, level, exp: fresh.exp, hp: fresh.hp, moves: fresh.moves, ability: fresh.ability });
  });
}
/** Adds a creature to the party's next slot. */
async function addToParty(id: string, species: string, level: number): Promise<void> {
  await tx(async (t) => {
    const used = (await s.repos.creatures.party(t, id)).length;
    await s.repos.creatures.insert(t, newCreature(content, species, level, { ownerId: id, moves: 'level' }), { kind: 'party', index: used });
  });
}
async function haunt(acc: Account, zoneId: ZoneId): Promise<void> {
  await tx(async (t) => s.repos.ghosts.save(t, acc.id, acc.username, zoneId, await s.repos.creatures.party(t, acc.id), new Date(s.time.clock())));
}

function coordinator(zoneId: ZoneId, on: boolean, msgs: ServerMessage[]): BattleCoordinator {
  const host: BattleHost = { send: (_p, m) => void msgs.push(m), onStart: () => undefined, onEnd: () => undefined, onProgress: () => undefined };
  return new BattleCoordinator(createRng(`bounty:${zoneId}`), {
    repos: s.repos,
    content,
    clock: s.time.clock,
    log: silentLogger(),
    zone: zone(zoneId),
    host,
    metrics: createRoomMetrics('r', zoneId, 0),
    ...(on ? { bounties: () => true, nemeses: () => ({ always: false, shadow: 0 }) } : {}),
  });
}

const strongest = (st: BattleState): Action => {
  const b = st.sides[0].party[st.sides[0].active]!;
  const mv = [...b.creature.moves].filter((m) => m.pp > 0).sort((x, y) => content.move(y.id).power - content.move(x.id).power)[0]!;
  return { kind: 'move', move: mv.id };
};

async function play(c: BattleCoordinator, pid: string, id: string): Promise<void> {
  for (let i = 0; i < 60 && c.get(id) !== null; i++) {
    const st = c.get(id)!.state;
    c.action(pid, id, st.turn + 1, strongest(st));
    for (let k = 0; k < 400 && c.get(id)?.resolving; k++) await new Promise((r) => setTimeout(r, 5));
  }
}

/** The hunter beats the ghost's weakened copy (level 2) and the battle's messages come back. */
async function beatGhost(ghost: Account, hunter: Account, on = true): Promise<ServerMessage[]> {
  const msgs: ServerMessage[] = [];
  const c = coordinator('mire_route', on, msgs);
  const party = (await tx((t) => s.repos.creatures.party(t, ghost.id))).map((x) => ({ ...x, level: 2 }));
  const res = await c.startGhost({ playerId: hunter.id, sessionId: 's' }, { ownerId: ghost.id, name: ghost.username, party, topLevel: 2 }, { x: 0, z: 0 });
  if (!res.ok) throw new Error(res.detail);
  await play(c, hunter.id, res.session.id);
  c.dispose();
  const end = msgs.find((m) => m.type === 'battleEnd');
  if (end?.type !== 'battleEnd') throw new Error('no end');
  expect(end.outcome).toEqual({ winner: 0 });
  return msgs;
}

describe('the bounty board', () => {
  it('a Badlander party posts on a ghost in a town: escrow and cut taken; the refusals are named', async () => {
    const ghost = await register(s);
    const poster = await register(s);
    await haunt(ghost, 'mire_route');
    const j = await enter(s, poster, 'mirevale');
    await setMoney(poster.id, 5_000);
    const post = (target: string, reward: number) => api(s, 'POST', '/bounties', poster.access, { target, reward });
    expect((await post(ghost.username, 800)).body.code).toBe('noBadlander');
    await addToParty(poster.id, 'badlander', 30);
    await haunt(poster, 'mirevale');
    expect((await post(poster.username, 800)).body.code).toBe('ownGhost');
    expect((await post('nobody_at_all', 800)).body.code).toBe('noGhost');
    expect((await post(ghost.username, 100)).body.code).toBe('tooLow');
    expect((await post(ghost.username, 50_000)).body.code).toBe('tooHigh');
    const ok = await post(ghost.username, 800);
    expect(ok.status).toBe(200);
    expect(await money(poster.id)).toBe(5_000 - 800 - bountyFee(800));
    expect(ok.body.money).toBe(5_000 - 1_000);
    expect(ok.body.you).toMatchObject({ badlander: true, open: 1, atBoard: true });
    expect(ok.body.wanted.find((w: { target: string }) => w.target === ghost.username)).toMatchObject({ kind: 'player', reward: 800, withLawlander: 1_000, postedBy: poster.username, mine: true, zoneId: 'mire_route' });
    expect(ok.body.posted[0]).toMatchObject({ target: ghost.username, reward: 800, fee: 200, status: 'open', claimedBy: null });
    expect(ok.body.ghosts.some((g: { name: string; wanted: boolean }) => g.name === ghost.username && g.wanted)).toBe(true);
    expect(ok.body.ghosts.some((g: { name: string }) => g.name === poster.username)).toBe(false);
    expect((await post(ghost.username, 900)).body.code).toBe('alreadyPosted');
    const audit = await rawQuery(s.db, "select detail from audit_log where actor_id = $1 and action = 'bounty.post'", [poster.id]);
    expect(audit).toHaveLength(1);
    // not enough money: nothing taken, nothing posted
    const other = await register(s);
    await haunt(other, 'mire_route');
    await setMoney(poster.id, 100);
    expect((await post(other.username, 800)).body.code).toBe('InsufficientFunds');
    expect(await money(poster.id)).toBe(100);
    await j.room.leave(true);
    // only at a board: a route has none
    await placePlayer(s, poster.id, 'mire_route', 0, 0);
    const k = await enter(s, poster, 'mire_route');
    await setMoney(poster.id, 5_000);
    expect((await post(other.username, 800)).body.code).toBe('notAtBoard');
    await k.room.leave(true);
  }, 60_000);

  it('beating a wanted ghost claims every bounty on it once: Lawlander bonus, honor, history, toast and audit', async () => {
    const ghost = await register(s);
    const poster = await register(s);
    const hunter = await register(s);
    const late = await register(s);
    await haunt(ghost, 'mire_route');
    await addToParty(poster.id, 'badlander', 30);
    const j = await enter(s, poster, 'mirevale');
    await setMoney(poster.id, 5_000);
    expect((await api(s, 'POST', '/bounties', poster.access, { target: ghost.username, reward: 800 })).status).toBe(200);
    await j.room.leave(true);
    // the board's own: five different trainers beaten this week
    await tx(async (t) => {
      for (const who of ['v1', 'v2', 'v3', 'v4', 'v5']) await s.repos.ghosts.record(t, ghost.id, who, 'mire_route', true, new Date(s.time.clock()));
      expect(await postGameBounties(s.repos, t, s.time.clock())).toBe(1);
    });
    const board = (await api(s, 'GET', '/bounties', hunter.access)).body;
    expect(board.wanted.filter((w: { target: string }) => w.target === ghost.username).map((w: { kind: string; reward: number }) => [w.kind, w.reward])).toEqual([
      ['player', 800],
      ['game', gameBountyReward(5)],
    ]);

    // the hunter: a dustcub lead (it keeps the honor ledger) and a Lawlander in the party
    await leadAs(hunter.id, 'dustcub', 30);
    await addToParty(hunter.id, 'lawlander', 30);
    const before = await money(hunter.id);
    const msgs = await beatGhost(ghost, hunter);
    const pay = bountyPayout(800, true) + bountyPayout(gameBountyReward(5), true);
    const end = msgs.find((m) => m.type === 'battleEnd');
    if (end?.type !== 'battleEnd') throw new Error('no end');
    expect(end.rewards.money).toBe(ghostReward(2) + pay);
    expect(await money(hunter.id)).toBe(before + ghostReward(2) + pay);
    const toast = msgs.find((m) => m.type === 'toast');
    expect(toast).toMatchObject({ level: 'success', text: broughtInText(ghost.username, 2, pay, pay - 800 - gameBountyReward(5)) });
    expect(msgs.findIndex((m) => m.type === 'battleEnd')).toBeLessThan(msgs.findIndex((m) => m.type === 'toast'));
    const lead = (await tx((t) => s.repos.creatures.party(t, hunter.id)))[0]!;
    // the battle's own honor (a won duel, any Dark move) and then the claim's +1
    const fought = msgs.flatMap((m) => (m.type === 'battleEvents' ? m.events : [])).filter((e) => e.t === 'honor' && e.who.side === 0 && e.who.slot === 0);
    const afterBattle = fought.length === 0 ? 0 : (fought.at(-1) as { honorAfter: number }).honorAfter;
    expect(lead).toMatchObject({ speciesId: 'dustcub', honor: afterBattle + 1 });
    const h = (await api(s, 'GET', `/creature/${lead.id}/history`, hunter.access)).body;
    expect(h.events.at(-1)).toMatchObject({ kind: 'bounty', target: ghost.username, targetKind: 'ghost', reward: pay, zoneId: 'mire_route' });
    expect(await rawQuery(s.db, "select subject from audit_log where actor_id = $1 and action = 'bounty.claim'", [hunter.id])).toHaveLength(2);
    // the poster sees it claimed; the board shows the claim
    const seen = (await api(s, 'GET', '/bounties', poster.access)).body;
    expect(seen.posted[0]).toMatchObject({ status: 'claimed', claimedBy: hunter.username });
    expect(seen.claims[0]).toMatchObject({ target: ghost.username, claimedBy: hunter.username, bonus: true });
    expect(seen.wanted.some((w: { target: string }) => w.target === ghost.username)).toBe(false);

    // a second hunter finds nothing left: the route reward only
    const second = await beatGhost(ghost, late);
    const end2 = second.find((m) => m.type === 'battleEnd');
    if (end2?.type !== 'battleEnd') throw new Error('no end');
    expect(end2.rewards.money).toBe(ghostReward(2));
    expect(second.some((m) => m.type === 'toast')).toBe(false);
  }, 90_000);

  it('the board off: beating a wanted ghost claims nothing', async () => {
    const ghost = await register(s);
    const hunter = await register(s);
    await haunt(ghost, 'mire_route');
    await tx(async (t) => {
      for (const who of ['w1', 'w2', 'w3', 'w4', 'w5', 'w6']) await s.repos.ghosts.record(t, ghost.id, who, 'mire_route', true, new Date(s.time.clock()));
      await postGameBounties(s.repos, t, s.time.clock());
    });
    const msgs = await beatGhost(ghost, hunter, false);
    const end = msgs.find((m) => m.type === 'battleEnd');
    if (end?.type !== 'battleEnd') throw new Error('no end');
    expect(end.rewards.money).toBe(ghostReward(2));
    expect((await api(s, 'GET', '/bounties', hunter.access)).body.wanted.some((w: { target: string }) => w.target === ghost.username)).toBe(true);
  }, 60_000);

  it('an expired post comes down and the whole escrow goes back, once', async () => {
    const ghost = await register(s);
    const poster = await register(s);
    await haunt(ghost, 'mire_route');
    await addToParty(poster.id, 'badlander', 30);
    const j = await enter(s, poster, 'mirevale');
    await setMoney(poster.id, 3_000);
    expect((await api(s, 'POST', '/bounties', poster.access, { target: ghost.username, reward: 1_000 })).status).toBe(200);
    expect(await money(poster.id)).toBe(3_000 - 1_250);
    await j.room.leave(true);
    s.time.advance(BOUNTY_POST_HOURS * 3_600_000 + 60_000);
    const v = (await api(s, 'GET', '/bounties', poster.access)).body;
    expect(v.posted[0]).toMatchObject({ status: 'expired' });
    expect(await money(poster.id)).toBe(3_000);
    s.time.advance(120_000);
    await api(s, 'GET', '/bounties', poster.access);
    expect(await money(poster.id)).toBe(3_000);
    expect(await rawQuery(s.db, "select subject from audit_log where actor_id = $1 and action = 'bounty.refund'", [poster.id])).toHaveLength(1);
  }, 60_000);

  it("a rank 2 nemesis shows on its trainer's board alone and pays its bounty when brought in", async () => {
    const me = await register(s);
    const other = await register(s);
    const n0: NewNemesis = {
      ownerId: me.id,
      speciesId: 'dustcub',
      level: 14,
      name: 'Scarjaw',
      title: 'the Unbroken',
      scar: 'burn',
      move: null,
      ability: content.species('dustcub').abilities[0]!,
      variantKey: 'normal',
      isShiny: false,
      isAlpha: false,
      bornZone: 'mire_route',
      memory: { how: 'ko', zoneId: 'mire_route', foeSpecies: 'bramblecub', foeName: null, move: 'Tackle', orb: null },
    };
    const nemesis = await tx(async (t) => {
      const { nemesis: n } = await s.repos.nemeses.rise(t, n0, 3, new Date(s.time.clock()));
      return (await s.repos.nemeses.rankUp(t, n.id, { rank: 2, level: 15, memory: n.memory, zoneId: 'mire_route' }, new Date(s.time.clock())))!;
    });
    const mine = (await api(s, 'GET', '/bounties', me.access)).body;
    expect(mine.personal).toEqual([expect.objectContaining({ kind: 'nemesis', target: nemesisFullName(nemesis), rank: 2, reward: nemesisBounty(2), expiresAt: null })]);
    expect((await api(s, 'GET', '/bounties', other.access)).body.personal).toEqual([]);
    const msgs: ServerMessage[] = [];
    const c = coordinator('ash_route', true, msgs);
    const spawn: SpawnRecord = { id: 'ash_route:nemesis:1', speciesId: 'dustcub', level: 2, variantKey: 'normal', isAlpha: false, ability: n0.ability, medium: 'land', x: 0, z: 0, bornAt: 0, engagedBy: null, engagedAt: null, despawnAt: 60_000 };
    const before = await money(me.id);
    const res = await c.startWild({ playerId: me.id, sessionId: 's' }, spawn, { x: 0, z: 0 }, nemesis);
    if (!res.ok) throw new Error(res.detail);
    await play(c, me.id, res.session.id);
    c.dispose();
    const end = msgs.find((m) => m.type === 'battleEnd');
    if (end?.type !== 'battleEnd') throw new Error('no end');
    expect(end.outcome).toEqual({ winner: 0 });
    expect(await money(me.id)).toBe(before + nemesisBounty(2));
    expect(msgs.find((m) => m.type === 'toast')).toMatchObject({ text: broughtInText(nemesisFullName(nemesis), 1, nemesisBounty(2), 0) });
    const lead = (await tx((t) => s.repos.creatures.party(t, me.id)))[0]!;
    const h = (await api(s, 'GET', `/creature/${lead.id}/history`, me.access)).body;
    expect(h.events.map((e: { kind: string }) => e.kind).slice(-2)).toEqual(['nemesis', 'bounty']);
    expect((await api(s, 'GET', '/bounties', me.access)).body).toMatchObject({ personal: [], you: { claimsToday: 1 } });
  }, 60_000);

  it('a zone room meets a wanted ghost first (BOUNTIES=always: every time)', async () => {
    const wantedGhost = await register(s);
    const plain = await register(s);
    const poster = await register(s);
    const me = await register(s);
    await haunt(plain, 'mirevale');
    await haunt(wantedGhost, 'mirevale');
    await addToParty(poster.id, 'badlander', 30);
    const j = await enter(s, poster, 'mirevale');
    await setMoney(poster.id, 5_000);
    expect((await api(s, 'POST', '/bounties', poster.access, { target: wantedGhost.username, reward: 600 })).status).toBe(200);
    await j.room.leave(true);
    const k = await enter(s, me, 'mirevale');
    s.time.advance(SHADOW_CHECK_MS);
    const room = matchMaker.getLocalRoomById(k.room.roomId) as unknown as ZoneRoom;
    // once the room's minute read knows it is wanted, every encounter meets it
    await waitFor(() => Array.from({ length: 50 }, () => room.ghostEncounter(me.id)?.playerId).every((x) => x === wantedGhost.id), 5000);
    await k.room.leave(true);
  }, 60_000);
});
