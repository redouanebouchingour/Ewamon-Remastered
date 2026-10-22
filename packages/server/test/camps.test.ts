/**
 * Camp bases (content camps.ts, game/camps.ts): a trainer claims a route's camp at its campfire (one per trainer, one
 * owner per camp, refusals named), renames and decorates it with trophies they earned (blocked words and unearned
 * trophies refused), and everyone in the zone sees it. While the owner is away a raider fights the guard: a win takes
 * 2 % of the owner's money once a day (audit row), costs the raider's lead 1 honor and darkens the zone; a loss takes
 * nothing and earns the owner's side a point; a long-away owner loses the camp to the raider. The owner reads the log
 * when they come back. With CAMPS off nothing can be claimed or raided.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CAMP_HELD_POINTS, CAMP_RAID_SHADOW, campLogLine, campOf, campRaidCut, digSpotsFor, seasonAt, zone } from '@ewa/content';
import type { ZoneId } from '@ewa/content';
import { createRng } from '@ewa/core';
import type { Action, BattleState } from '@ewa/core';
import type { ServerMessage } from '@ewa/protocol';
import { createRoomMetrics } from '../src/metrics';
import { silentLogger } from '../src/log';
import { BattleCoordinator } from '../src/rooms/battleSession';
import type { BattleHost } from '../src/rooms/battleSession';
import { newCreature } from '../src/game/creatures';
import { api, content, enter, placePlayer, rawQuery, register, startServer, waitFor } from './helpers';
import type { Account, Joined, TestServer } from './helpers';

let s: TestServer;
beforeAll(async () => {
  s = await startServer({ CAMPS: 'on' });
}, 120_000);
afterAll(async () => {
  await s?.stop();
}, 60_000);

const ZONE: ZoneId = 'mire_route';
const tx = <T>(f: (t: Parameters<Parameters<typeof s.repos.db.transaction>[0]>[0]) => Promise<T>): Promise<T> => s.repos.db.transaction(f);
const money = async (id: string): Promise<number> => (await tx((t) => s.repos.players.byId(t, id)))!.money;
const setMoney = (id: string, m: number) => rawQuery(s.db, 'update players set money = $2 where id = $1', [id, m]);
const toasts = (j: Joined): string[] => j.msgs.flatMap((m) => (m.type === 'toast' ? [m.text] : []));
const errors = (j: Joined): string[] => j.msgs.flatMap((m) => (m.type === 'error' && typeof m.detail === 'string' ? [m.detail] : []));

/** The account's starter becomes a fresh `species` at `level` (its lead). */
async function leadAs(id: string, species: string, level: number): Promise<void> {
  await tx(async (t) => {
    const cur = (await s.repos.creatures.party(t, id))[0]!;
    const fresh = newCreature(content, species, level, { ownerId: id, moves: 'level' });
    await s.repos.creatures.update(t, { ...cur, speciesId: species, level, exp: fresh.exp, hp: fresh.hp, moves: fresh.moves, ability: fresh.ability, honor: 0 });
  });
}

/** Stands the player by the campfire (the dig spot beside it) and enters the route. */
async function atCamp(acc: Account): Promise<Joined> {
  const spot = digSpotsFor(ZONE)[0]!;
  await placePlayer(s, acc.id, ZONE, spot.x, spot.z);
  return enter(s, acc, ZONE);
}

function coordinator(msgs: ServerMessage[]): BattleCoordinator {
  const host: BattleHost = { send: (_p, m) => void msgs.push(m), onStart: () => undefined, onEnd: () => undefined, onProgress: () => undefined };
  return new BattleCoordinator(createRng(`camp:${ZONE}`), { repos: s.repos, content, clock: s.time.clock, log: silentLogger(), zone: zone(ZONE), host, metrics: createRoomMetrics('r', ZONE, 0) });
}

const strongest = (st: BattleState): Action => {
  const b = st.sides[0].party[st.sides[0].active]!;
  const mv = [...b.creature.moves].filter((m) => m.pp > 0).sort((x, y) => content.move(y.id).power - content.move(x.id).power)[0]!;
  return { kind: 'move', move: mv.id };
};

/** The raider fights the owner's guard (its copies at `guardLevel`) to the end; the battle's messages come back. */
async function raid(owner: Account, raider: Account, guardLevel: number): Promise<ServerMessage[]> {
  const msgs: ServerMessage[] = [];
  const c = coordinator(msgs);
  const guard = (await tx((t) => s.repos.creatures.party(t, owner.id))).map((x) => ({ ...x, level: guardLevel }));
  const res = await c.startCampRaid({ playerId: raider.id, sessionId: 's' }, { ownerId: owner.id, ownerName: owner.username, zoneId: ZONE, guard }, { x: 0, z: 0 });
  if (!res.ok) throw new Error(res.detail);
  const id = res.session.id;
  for (let i = 0; i < 80 && c.get(id) !== null; i++) {
    const st = c.get(id)!.state;
    if (st.sides[0].party.every((b) => b.creature.hp === 0)) break;
    c.action(raider.id, id, st.turn + 1, strongest(st));
    for (let k = 0; k < 400 && c.get(id)?.resolving; k++) await new Promise((r) => setTimeout(r, 5));
  }
  c.dispose();
  return msgs;
}

async function shadowOf(zoneId: string): Promise<number> {
  return (await tx((t) => s.repos.worldHonor.of(t, seasonAt(s.time.clock()).number, zoneId))).shadow;
}

describe('camp bases', () => {
  let owner: Account;
  let raider: Account;

  it('a trainer claims the free camp at its fire; everyone in the zone sees it; one camp each, one owner each', async () => {
    owner = await register(s);
    raider = await register(s);
    // far from the fire: refused
    await placePlayer(s, owner.id, ZONE, 0, 0);
    const far = await enter(s, owner, ZONE);
    far.room.send('camp', { action: 'claim' });
    await waitFor(() => errors(far).includes('campFar'));
    await far.room.leave(true);

    const j = await atCamp(owner);
    j.room.send('camp', { action: 'claim' });
    await waitFor(() => j.room.state.campOwner === owner.username, 5000);
    expect(j.room.state.campName).toBe(`${owner.username}'s camp`);
    expect(toasts(j).some((t) => t.startsWith('The camp is yours'))).toBe(true);
    const row = await tx((t) => s.repos.camps.of(t, ZONE));
    expect(row).toMatchObject({ ownerId: owner.id, guardTop: 5 });

    // a second trainer at the same fire: the camp is taken; the owner's raid on their own camp: refused
    const k = await atCamp(raider);
    expect(k.room.state.campOwner).toBe(owner.username);
    k.room.send('camp', { action: 'claim' });
    await waitFor(() => errors(k).includes('campTaken'));
    // the owner is in the world: their guard rests
    await new Promise((r) => setTimeout(r, 2100));
    k.room.send('camp', { action: 'raid' });
    await waitFor(() => errors(k).includes('ownerHome'));
    await k.room.leave(true);
    await j.room.leave(true);
  });

  it('the owner renames and decorates it with trophies they earned; blocked words and unearned trophies are refused', async () => {
    const legend = 'raikitsune';
    expect(content.species(legend).legendary).toBe(true);
    await tx(async (t) => s.repos.progress.markCaught(t, owner.id, legend, 'normal' as never, false, new Date(s.time.clock())));
    await rawQuery(s.db, 'update players set peak_rating = 1300 where id = $1', [owner.id]);
    const got = await api(s, 'GET', '/camps', owner.access);
    expect(got.status).toBe(200);
    expect(got.body.enabled).toBe(true);
    expect(got.body.mine).toMatchObject({ zoneId: ZONE, mine: true, owner: owner.username });
    const ids = got.body.earned.map((t: { id: string }) => t.id);
    expect(ids).toEqual(expect.arrayContaining([`legend:${legend}`, 'medal:gold']));

    expect((await api(s, 'POST', '/camps/edit', owner.access, { name: 'fuck camp' })).body.code).toBe('blockedWord');
    expect((await api(s, 'POST', '/camps/edit', owner.access, { trophies: ['medal:champion'] })).body.code).toBe('badTrophy');
    expect((await api(s, 'POST', '/camps/edit', raider.access, { name: 'Mine now' })).body.code).toBe('noCamp');
    const ok = await api(s, 'POST', '/camps/edit', owner.access, { name: '  Ironhold  ', trophies: [`legend:${legend}`, 'medal:gold'] });
    expect(ok.status).toBe(200);
    expect(ok.body.mine).toMatchObject({ name: 'Ironhold', trophies: [{ id: `legend:${legend}`, kind: 'legend' }, { id: 'medal:gold', kind: 'medal', label: 'Gold ranked medal' }] });
    const audit = await rawQuery(s.db, "select detail from audit_log where actor_id = $1 and action = 'camp.edit'", [owner.id]);
    expect(audit).toHaveLength(1);

    // the zone room hears of it: a trainer walking the route sees the banner and the trophies
    const k = await atCamp(raider);
    await waitFor(() => k.room.state.campName === 'Ironhold' && k.room.state.campTrophies === 'legend,medal', 5000);
    const seen = await api(s, 'GET', '/camps', raider.access);
    expect(seen.body.here.camp).toMatchObject({ owner: owner.username, name: 'Ironhold', mine: false, ownerOnline: false, raidedToday: false });
    await k.room.leave(true);
  });

  it('a raid while the owner is away starts a fight with the guard', async () => {
    await leadAs(raider.id, 'dustcub', 8);
    const k = await atCamp(raider);
    k.room.send('camp', { action: 'raid' });
    await waitFor(() => k.msgs.some((m) => m.type === 'battleStart'), 8000);
    const start = k.msgs.find((m) => m.type === 'battleStart');
    if (start?.type !== 'battleStart') throw new Error('no start');
    expect(start.state.sides[1].trainerId).toBe(`campguard:${owner.username}`);
    await k.room.leave(true);
  });

  it('a won raid takes 2 % once a day with an audit row, costs the lead honor and darkens the zone; the log tells the owner', async () => {
    await setMoney(owner.id, 6_000);
    await setMoney(raider.id, 100);
    await leadAs(raider.id, 'dustcub', 30);
    const shadow0 = await shadowOf(ZONE);
    const msgs = await raid(owner, raider, 2);
    const end = msgs.find((m) => m.type === 'battleEnd');
    if (end?.type !== 'battleEnd') throw new Error('no end');
    expect(end.outcome).toEqual({ winner: 0 });
    const cut = campRaidCut(6_000);
    expect(cut).toBe(120);
    expect(await money(owner.id)).toBe(6_000 - cut);
    expect(await money(raider.id)).toBe(100 + cut);
    const lead = (await tx((t) => s.repos.creatures.party(t, raider.id)))[0]!;
    expect(lead.honor).toBe(-1);
    expect(await shadowOf(ZONE)).toBeGreaterThanOrEqual(shadow0 + CAMP_RAID_SHADOW);
    expect(msgs.find((m) => m.type === 'toast')).toMatchObject({ text: expect.stringContaining(`took ${cut} from ${owner.username}`) });
    const audit = await rawQuery(s.db, "select detail from audit_log where actor_id = $1 and action = 'camp.raid'", [raider.id]);
    expect(audit).toHaveLength(1);
    expect(audit[0]!['detail']).toMatchObject({ cut, ownerId: owner.id, tookOver: false });

    // the same day again: nothing more to take
    await leadAs(raider.id, 'dustcub', 30);
    await raid(owner, raider, 2);
    expect(await money(owner.id)).toBe(6_000 - cut);
    const seen = await api(s, 'GET', '/camps', raider.access);
    expect(seen.body.camps).toEqual([{ zoneId: ZONE, owner: owner.username, name: 'Ironhold' }]);

    // a lost raid takes nothing; the guard held earns the owner's side a point
    await tx((t) => s.repos.factions.join(t, seasonAt(s.time.clock()).number, owner.id, 'tenjin', new Date(s.time.clock())));
    await leadAs(raider.id, 'dustcub', 2);
    const lost = await raid(owner, raider, 60);
    const lend = lost.find((m) => m.type === 'battleEnd');
    if (lend?.type !== 'battleEnd') throw new Error('no end');
    expect(lend.outcome).toEqual({ winner: 1 });
    expect(await money(owner.id)).toBe(6_000 - cut);
    expect((await tx((t) => s.repos.factions.of(t, seasonAt(s.time.clock()).number, owner.id)))?.points).toBe(CAMP_HELD_POINTS);

    // the owner comes back: the log, told once
    const j = await atCamp(owner);
    await waitFor(() => toasts(j).includes(campLogLine({ raider: raider.username, won: false, cut: 0, tookOver: false })), 5000);
    expect(toasts(j)).toContain(campLogLine({ raider: raider.username, won: true, cut, tookOver: false }));
    const log = await api(s, 'GET', '/camps', owner.access);
    expect(log.body.log.map((l: { cut: number; won: boolean }) => [l.won, l.cut])).toEqual([
      [false, 0],
      [true, 0],
      [true, cut],
    ]);
    await j.room.leave(true);
  });

  it('a long-away owner loses the camp to the raider who beats the guard; abandoning frees it', async () => {
    const third = await register(s);
    await rawQuery(s.db, "update players set last_seen_at = now() - interval '20 days' where id = $1", [owner.id]);
    // another trainer's cooldown is their own
    await leadAs(third.id, 'dustcub', 30);
    await raid(owner, third, 2);
    const row = await tx((t) => s.repos.camps.of(t, ZONE));
    expect(row).toMatchObject({ ownerId: third.id, name: `${third.username}'s camp`, trophies: [] });
    expect(await tx((t) => s.repos.camps.byOwner(t, owner.id))).toBeNull();
    const ab = await api(s, 'POST', '/camps/abandon', third.access);
    expect(ab.status).toBe(200);
    expect(ab.body.mine).toBeNull();
    expect((await api(s, 'POST', '/camps/abandon', third.access)).body.code).toBe('noCamp');
    expect(await tx((t) => s.repos.camps.of(t, ZONE))).toBeNull();
    expect(campOf(ZONE)).not.toBeNull();
  });
});

describe('camp bases off (testEnv)', () => {
  let off: TestServer;
  beforeAll(async () => {
    off = await startServer();
  }, 120_000);
  afterAll(async () => {
    await off?.stop();
  }, 60_000);

  it('nothing to read, nothing claimed, edited or raided; the zone shows no owner', async () => {
    const a = await register(off);
    const got = await api(off, 'GET', '/camps', a.access);
    expect(got.body).toMatchObject({ enabled: false, here: null, mine: null, earned: [], camps: [] });
    expect((await api(off, 'POST', '/camps/edit', a.access, { name: 'Nope' })).body.code).toBe('campsOff');
    const spot = digSpotsFor(ZONE)[0]!;
    await placePlayer(off, a.id, ZONE, spot.x, spot.z);
    const j = await enter(off, a, ZONE);
    j.room.send('camp', { action: 'claim' });
    await waitFor(() => errors(j).includes('campsOff'));
    expect(j.room.state.campOwner).toBe('');
    await j.room.leave(true);
  });
});
