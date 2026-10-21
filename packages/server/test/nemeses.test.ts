/**
 * Nemeses (content nemesis.ts, game/nemesis.ts): a wild creature that breaks out of the player's orb or knocks one of
 * theirs out and gets away rises as their nemesis (only where nemeses are on: testEnv keeps them off); an ambush fights
 * with its name and gained move; knocked out, it is gone and the creature that landed the blow keeps a trophy line;
 * caught, it keeps its name, its scar and its move, with a history line; GET /nemeses lists the active ones.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { matchMaker } from '@colyseus/core';
import { NEMESIS_SCARS, nemesisScarRibbon, zone } from '@ewa/content';
import { createRng } from '@ewa/core';
import type { Action, BattleState } from '@ewa/core';
import type { NewNemesis } from '@ewa/persist';
import type { ServerMessage } from '@ewa/protocol';
import { createRoomMetrics } from '../src/metrics';
import { silentLogger } from '../src/log';
import { BattleCoordinator } from '../src/rooms/battleSession';
import type { BattleHost } from '../src/rooms/battleSession';
import type { SpawnRecord } from '../src/rooms/spawnDirector';
import type { ZoneRoom } from '../src/rooms/ZoneRoom';
import { tauntOf } from '../src/game/nemesis';
import { api, content, enter, register, startServer } from './helpers';
import type { TestServer } from './helpers';

let s: TestServer;
beforeAll(async () => {
  s = await startServer();
}, 120_000);
afterAll(async () => {
  await s?.stop();
}, 60_000);

const spawn = (zoneId: string, kind: 'wild' | 'nemesis', speciesId: string, level: number): SpawnRecord => ({
  id: `${zoneId}:${kind}:1`,
  speciesId,
  level,
  variantKey: 'normal',
  isAlpha: false,
  ability: content.species(speciesId).abilities[0]!,
  medium: 'land',
  x: 0,
  z: 0,
  bornAt: 0,
  engagedBy: null,
  engagedAt: null,
  despawnAt: 60_000,
});

function coordinator(zoneId: 'mire_route' | 'ash_route', on: boolean, msgs: ServerMessage[]): BattleCoordinator {
  const host: BattleHost = { send: (_p, m) => void msgs.push(m), onStart: () => undefined, onEnd: () => undefined, onProgress: () => undefined };
  return new BattleCoordinator(createRng(`nemesis:${zoneId}`), {
    repos: s.repos,
    content,
    clock: s.time.clock,
    log: silentLogger(),
    zone: zone(zoneId),
    host,
    metrics: createRoomMetrics('r', zoneId, 0),
    ...(on ? { nemeses: () => ({ always: true, shadow: 0 }) } : {}),
  });
}

/** Plays the battle to its end, `pick` choosing each turn's action. */
async function play(c: BattleCoordinator, pid: string, id: string, pick: (st: BattleState) => Action): Promise<void> {
  for (let i = 0; i < 60 && c.get(id) !== null; i++) {
    const st = c.get(id)!.state;
    c.action(pid, id, st.turn + 1, pick(st));
    for (let k = 0; k < 400 && c.get(id)?.resolving; k++) await new Promise((r) => setTimeout(r, 5));
  }
}

const strongest = (st: BattleState): Action => {
  const b = st.sides[0].party[st.sides[0].active]!;
  const mv = [...b.creature.moves].filter((m) => m.pp > 0).sort((x, y) => content.move(y.id).power - content.move(x.id).power)[0]!;
  return { kind: 'move', move: mv.id };
};

const risen = (owner: string, name: string, over: Partial<NewNemesis> = {}): NewNemesis => ({
  ownerId: owner,
  speciesId: 'dustcub',
  level: 14,
  name,
  title: 'the Unbroken',
  scar: 'burn',
  move: 'Crunch',
  ability: content.species('dustcub').abilities[0]!,
  variantKey: 'normal',
  isShiny: false,
  isAlpha: false,
  bornZone: 'mire_route',
  memory: { how: 'ko', zoneId: 'mire_route', foeSpecies: 'bramblecub', foeName: null, move: 'Tackle', orb: null },
  ...over,
});

describe('nemeses', () => {
  it('a wild creature that breaks out and gets away rises (nemeses on), never where they are off', async () => {
    for (const on of [false, true]) {
      const me = await register(s);
      const msgs: ServerMessage[] = [];
      const c = coordinator('mire_route', on, msgs);
      const res = await c.startWild({ playerId: me.id, sessionId: 's' }, spawn('mire_route', 'wild', 'dustcub', 60), { x: 0, z: 0 });
      if (!res.ok) throw new Error(res.detail);
      let thrown = false;
      await play(c, me.id, res.session.id, () => {
        if (!thrown) {
          thrown = true;
          return { kind: 'catch', orb: 'spark_orb' };
        }
        return { kind: 'flee' };
      });
      expect(msgs.find((m) => m.type === 'battleEnd')).toBeDefined();
      const active = await s.repos.db.transaction((tx) => s.repos.nemeses.active(tx, me.id));
      if (!on) {
        expect(active).toEqual([]);
        expect(msgs.some((m) => m.type === 'nemesisNews')).toBe(false);
      } else {
        expect(active).toHaveLength(1);
        const n = active[0]!;
        expect(n).toMatchObject({ speciesId: 'dustcub', rank: 1, bornZone: 'mire_route', lastZone: 'mire_route', status: 'active' });
        expect(n.level).toBeGreaterThanOrEqual(62);
        expect(n.level).toBeLessThanOrEqual(65);
        expect(NEMESIS_SCARS).toContain(n.scar);
        expect(['ko', 'breakout']).toContain(n.memory.how);
        if (n.memory.how === 'breakout') expect(n).toMatchObject({ scar: 'torn_ear', memory: { orb: 'spark_orb', foeSpecies: 'bramblecub' } });
        const news = msgs.filter((m) => m.type === 'nemesisNews');
        expect(news).toEqual([expect.objectContaining({ type: 'nemesisNews', event: 'rose', name: n.name, nemesisId: n.id })]);
        // battleEnd first, then the news
        expect(msgs.findIndex((m) => m.type === 'battleEnd')).toBeLessThan(msgs.findIndex((m) => m.type === 'nemesisNews'));
        // GET /nemeses
        const view = (await api(s, 'GET', '/nemeses', me.access)).body;
        expect(view.max).toBe(3);
        expect(view.nemeses[0]).toMatchObject({ id: n.id, name: n.name, title: n.title, scar: n.scar, rank: 1, lastZone: 'mire_route' });
      }
      c.dispose();
    }
  }, 60_000);

  it('an ambush fights with its name and gained move; knocked out, the creature that landed the blow keeps the trophy', async () => {
    const me = await register(s);
    const { nemesis } = await s.repos.db.transaction((tx) => s.repos.nemeses.rise(tx, risen(me.id, 'Scarjaw'), 3, new Date(s.time.clock())));
    expect(tauntOf(content, nemesis)).toBe('Scarjaw remembers your Bramblecub. It remembers Tackle.');
    const msgs: ServerMessage[] = [];
    const c = coordinator('ash_route', true, msgs);
    const res = await c.startWild({ playerId: me.id, sessionId: 's' }, spawn('ash_route', 'nemesis', 'dustcub', 2), { x: 0, z: 0 }, nemesis);
    if (!res.ok) throw new Error(res.detail);
    const foe = res.session.state.sides[1].party[0]!.creature;
    expect(foe).toMatchObject({ nickname: 'Scarjaw', level: 2, speciesId: 'dustcub' });
    expect(foe.moves.map((m) => m.id)).toContain('Crunch');
    await play(c, me.id, res.session.id, strongest);
    const end = msgs.find((m) => m.type === 'battleEnd');
    if (end?.type !== 'battleEnd') throw new Error('no end');
    expect(end.outcome).toEqual({ winner: 0 });
    expect(msgs.filter((m) => m.type === 'nemesisNews')).toEqual([expect.objectContaining({ event: 'beaten', nemesisId: nemesis.id })]);
    expect((await s.repos.db.transaction((tx) => s.repos.nemeses.of(tx, nemesis.id)))?.status).toBe('beaten');
    const lead = (await s.repos.db.transaction((tx) => s.repos.creatures.party(tx, me.id)))[0]!;
    const h = (await api(s, 'GET', `/creature/${lead.id}/history`, me.access)).body;
    expect(h.events.at(-1)).toMatchObject({ kind: 'nemesis', how: 'beaten', name: 'Scarjaw the Unbroken', speciesId: 'dustcub', rank: 1, zoneId: 'ash_route' });
    c.dispose();
  }, 60_000);

  it('caught, it keeps its name, its scar and its gained move, and its history says what it was', async () => {
    const me = await register(s);
    await s.repos.db.transaction((tx) => s.repos.inventory.add(tx, me.id, 'spark_orb', 40));
    const { nemesis } = await s.repos.db.transaction((tx) => s.repos.nemeses.rise(tx, risen(me.id, 'Ashfang', { scar: 'frost', rank: undefined }), 3, new Date(s.time.clock())));
    const msgs: ServerMessage[] = [];
    const c = coordinator('ash_route', true, msgs);
    const res = await c.startWild({ playerId: me.id, sessionId: 's' }, spawn('ash_route', 'nemesis', 'dustcub', 2), { x: 0, z: 0 }, nemesis);
    if (!res.ok) throw new Error(res.detail);
    await play(c, me.id, res.session.id, () => ({ kind: 'catch', orb: 'spark_orb' }));
    const end = msgs.find((m) => m.type === 'battleEnd');
    if (end?.type !== 'battleEnd') throw new Error('no end');
    expect(end.outcome.winner).toBe('caught');
    const added = msgs.flatMap((m) => (m.type === 'inventoryDelta' ? m.creaturesAdded : []));
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ speciesId: 'dustcub', nickname: 'Ashfang', ribbons: [nemesisScarRibbon('frost')] });
    expect(added[0]!.moves.map((m) => m.id)).toContain('Crunch');
    expect(msgs.filter((m) => m.type === 'nemesisNews')).toEqual([expect.objectContaining({ event: 'caught' })]);
    const h = (await api(s, 'GET', `/creature/${added[0]!.id}/history`, me.access)).body;
    expect(h.events.map((e: { kind: string }) => e.kind)).toEqual(['met', 'nemesis']);
    expect(h.events[1]).toMatchObject({ how: 'caught', name: 'Ashfang the Unbroken' });
    expect(await s.repos.db.transaction((tx) => s.repos.nemeses.active(tx, me.id))).toEqual([]);
    c.dispose();
  }, 60_000);

  it('an ambush that escapes again ranks up and remembers the newest fight', async () => {
    const me = await register(s);
    const { nemesis } = await s.repos.db.transaction((tx) => s.repos.nemeses.rise(tx, risen(me.id, 'Gritmaw'), 3, new Date(s.time.clock())));
    const msgs: ServerMessage[] = [];
    const c = coordinator('ash_route', true, msgs);
    const res = await c.startWild({ playerId: me.id, sessionId: 's' }, spawn('ash_route', 'nemesis', 'dustcub', 60), { x: 0, z: 0 }, nemesis);
    if (!res.ok) throw new Error(res.detail);
    let thrown = false;
    await play(c, me.id, res.session.id, () => {
      if (thrown) return { kind: 'flee' };
      thrown = true;
      return { kind: 'catch', orb: 'spark_orb' };
    });
    const after = await s.repos.db.transaction((tx) => s.repos.nemeses.of(tx, nemesis.id));
    expect(after).toMatchObject({ status: 'active', rank: 2, lastZone: 'ash_route', bornZone: 'mire_route', memory: { zoneId: 'ash_route' } });
    expect(after!.level).toBeGreaterThanOrEqual(15);
    expect(after!.level).toBeLessThanOrEqual(16);
    expect(msgs.filter((m) => m.type === 'nemesisNews')).toEqual([expect.objectContaining({ event: 'rankUp', rank: 2 })]);
    c.dispose();
  }, 60_000);

  it('NEMESES=off (testEnv): a zone room never rolls an ambush', async () => {
    const me = await register(s);
    const j = await enter(s, me, 'mirevale');
    const room = matchMaker.getLocalRoomById(j.room.roomId) as unknown as ZoneRoom;
    for (let i = 0; i < 50; i++) expect(room.nemesisAmbushRoll()).toBe(false);
    await j.room.leave(true);
  }, 60_000);
});
