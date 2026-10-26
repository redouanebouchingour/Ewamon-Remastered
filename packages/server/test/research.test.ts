/**
 * Dex research on the server (game/research.ts): the counters a battle turn moves, the level-ups it reports, the two
 * perks (the catch bonus from level 3 as core `BattleState.catchBonus`, the doubled shiny odds at level 5 read from the
 * spawn's own roll), the evolution counters and the `/dex` routes.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { zone } from '@ewa/content';
import { createRng } from '@ewa/core';
import type { BattleEvent, BattleState } from '@ewa/core';
import { DexRes, ServerMessageSchema } from '@ewa/protocol';
import type { ServerMessage } from '@ewa/protocol';
import type { AnyDb, Db, Repos } from '@ewa/persist';
import { newCreature } from '../src/game/creatures';
import { battleResearchBumps, catchBonusFor, catchBonusOpt, researchLevelUps, researchLevels, sightingExtras } from '../src/game/research';
import { silentLogger } from '../src/log';
import { createRoomMetrics } from '../src/metrics';
import { BattleCoordinator } from '../src/rooms/battleSession';
import type { BattleHost } from '../src/rooms/battleSession';
import { RESEARCH_SHINY_ODDS, SHINY_ODDS, shinyFor, shinyFromDraw, shinyRollOf } from '../src/rooms/spawnDirector';
import type { SpawnRecord } from '../src/rooms/spawnDirector';
import { api, content, openRepos, register, startServer, uniqueName } from './helpers';
import type { TestServer } from './helpers';

/** A state whose two sides hold these species (party order), for the pure bump function. */
function stateOf(side0: readonly string[], side1: readonly string[]): BattleState {
  const party = (ids: readonly string[]) => ids.map((speciesId) => ({ creature: { speciesId } }));
  return { sides: [{ party: party(side0) }, { party: party(side1) }] } as unknown as BattleState;
}

describe('research: the pure part', () => {
  it('battleResearchBumps: foe knockouts, forms and signature moves on either side, the honor lines on own side only', () => {
    const next = stateOf(['dustcub', 'hollowmane'], ['castlemaw', 'mossling']);
    const events: BattleEvent[] = [
      { t: 'faint', who: { side: 1, slot: 1 } },
      { t: 'faint', who: { side: 0, slot: 1 } },
      { t: 'formChange', who: { side: 1, slot: 0 }, form: 'rage', atk: 1, def: 1, spd: 1 },
      { t: 'formChange', who: { side: 0, slot: 1 }, form: 'rage', atk: 1, def: 1, spd: 1 },
      { t: 'moveUsed', who: { side: 1, slot: 0 }, move: 'Vendetta Volley', target: { side: 0, slot: 0 }, ppLeft: 3 },
      { t: 'moveUsed', who: { side: 0, slot: 1 }, move: 'Tackle', target: { side: 1, slot: 0 }, ppLeft: 3 },
      { t: 'honor', who: { side: 0, slot: 0 }, delta: 2, honorAfter: 5, reason: 'duelWon' },
      { t: 'honor', who: { side: 1, slot: 0 }, delta: 2, honorAfter: 6, reason: 'duelWon' },
    ] as BattleEvent[];
    const b = battleResearchBumps(events, next, 0, content);
    expect(Object.fromEntries(b)).toEqual({
      mossling: { defeated: 1 },
      castlemaw: { 'form:rage': 1, signature: 1 },
      hollowmane: { 'form:rage': 1 },
      dustcub: { honorHigh: 1 },
    });
    // the low line, crossed downward only
    const low = battleResearchBumps([{ t: 'honor', who: { side: 0, slot: 0 }, delta: -1, honorAfter: -5, reason: 'wildKo' }, { t: 'honor', who: { side: 0, slot: 0 }, delta: -1, honorAfter: -6, reason: 'wildKo' }] as BattleEvent[], next, 0, content);
    expect(Object.fromEntries(low)).toEqual({ dustcub: { honorLow: 1 } });
  });

  it('the perks and the level-ups', () => {
    expect([0, 1, 2, 3, 4, 5].map(catchBonusFor)).toEqual([1, 1, 1, 1.25, 1.25, 1.5]);
    expect(catchBonusOpt('mossling', 2)).toBeUndefined();
    expect(catchBonusOpt('mossling', 5)).toEqual({ mossling: 1.5 });
    expect(sightingExtras({ night: true, water: true })).toEqual({ seenNight: 1, seenWater: 1 });
    expect(sightingExtras({})).toEqual({});
    expect(researchLevelUps({ mossling: { seen: 3 } }, { mossling: { seen: 5, caught: 1, defeated: 1 }, glimfin: { seen: 1 } })).toEqual([
      { speciesId: 'glimfin', level: 1 },
      { speciesId: 'mossling', level: 2 },
    ]);
    expect(researchLevels({ mossling: { counters: { seen: 1 } }, unknownthing: { counters: { seen: 99 } } })).toEqual({ mossling: 1, unknownthing: 0 });
  });

  it('the shiny roll at research odds: every 1/512 shiny stays shiny, 1/256 adds the half-way rolls', () => {
    expect(RESEARCH_SHINY_ODDS * 2).toBe(SHINY_ODDS);
    expect(shinyRollOf(0)).toBe(0);
    expect(shinyRollOf(256 / 4294967296)).toBe(256);
    expect(shinyFromDraw(256 / 4294967296)).toBe(false);
    expect(shinyFromDraw(256 / 4294967296, RESEARCH_SHINY_ODDS)).toBe(true);
    expect(shinyFor({ shinyRoll: 256 })).toBe(false);
    expect(shinyFor({ shinyRoll: 256 }, RESEARCH_SHINY_ODDS)).toBe(true);
    expect(shinyFor({ shinyRoll: 0 }, RESEARCH_SHINY_ODDS)).toBe(true);
    expect(shinyFor({ shinyRoll: 128 }, RESEARCH_SHINY_ODDS)).toBe(false);
    expect(shinyFor({ isShiny: true })).toBe(true);
    expect(shinyFor({})).toBe(false);
    // the research odds are exactly twice the base odds over the u32 space
    const rng = createRng('research-shiny');
    let base = 0;
    let research = 0;
    for (let i = 0; i < 512 * 400; i++) {
      const r = shinyRollOf(rng.next());
      if (r % SHINY_ODDS === 0) base++;
      if (r % RESEARCH_SHINY_ODDS === 0) research++;
    }
    expect(research).toBeGreaterThan(base * 1.6);
    expect(research).toBeLessThan(base * 2.4);
  });
});

describe('research in wild battles', () => {
  let db: AnyDb;
  let repos: Repos & { readonly db: Db };
  const now = 1_800_000_000_000;
  beforeAll(async () => {
    ({ db, repos } = await openRepos());
  }, 120_000);
  afterAll(async () => {
    await db?.close();
  });

  async function player(counters: Readonly<Record<string, number>> | null, lead = { species: 'bramblecub', level: 10 }): Promise<string> {
    return repos.db.transaction(async (tx) => {
      const name = uniqueName('rs');
      const { id } = await repos.players.create(tx, { username: name, email: `${name}@r.test`, passwordHash: 'x' }, new Date(now));
      await repos.creatures.insert(tx, newCreature(content, lead.species, lead.level, { ownerId: id }), { kind: 'party', index: 0 });
      await repos.inventory.addMany(tx, id, { aether_orb: 2 });
      if (counters !== null) {
        await repos.progress.markSeen(tx, id, 'mossling', new Date(now));
        await repos.progress.bumpCounters(tx, id, 'mossling', counters);
      }
      return id;
    });
  }

  function coordinator(msgs: ServerMessage[], night = false): BattleCoordinator {
    const host: BattleHost = { send: (_p, m) => void msgs.push(m), onStart: () => undefined, onEnd: () => undefined, onProgress: () => undefined };
    return new BattleCoordinator(createRng('research'), { repos, content, clock: () => now, log: silentLogger(), zone: zone('mire_route'), host, metrics: createRoomMetrics('r', 'mire_route', 0), night: () => night });
  }

  const spawn = (over: Partial<SpawnRecord> = {}): SpawnRecord => ({
    id: `mire_route:${uniqueName('s')}`,
    speciesId: 'mossling',
    level: 4,
    variantKey: 'normal',
    isAlpha: false,
    isShiny: false,
    shinyRoll: 256,
    ability: content.species('mossling').abilities[0]!,
    medium: 'land',
    x: 0,
    z: 0,
    bornAt: 0,
    engagedBy: null,
    engagedAt: null,
    despawnAt: 1e15,
    ...over,
  });

  async function settle(c: BattleCoordinator, battleId: string): Promise<void> {
    for (let i = 0; i < 400 && c.get(battleId)?.resolving; i++) await new Promise((r) => setTimeout(r, 5));
  }

  it('a first sighting at night on water counts seen / seenNight / seenWater, records the zone and reports level 1', async () => {
    const msgs: ServerMessage[] = [];
    const c = coordinator(msgs, true);
    const pid = await player(null);
    const res = await c.startWild({ playerId: pid, sessionId: 's' }, spawn({ medium: 'water' }), { x: 0, z: 0 });
    if (!res.ok) throw new Error(res.detail);
    const dex = await repos.db.transaction((tx) => repos.progress.dex(tx, pid));
    expect(dex.entries['mossling']).toMatchObject({ counters: { seen: 1, seenNight: 1, seenWater: 1 }, firstSeenZone: 'mire_route' });
    const ups = msgs.filter((m): m is Extract<ServerMessage, { type: 'progressionDelta' }> => m.type === 'progressionDelta' && m.research !== undefined);
    expect(ups.map((m) => m.research)).toEqual([[{ speciesId: 'mossling', level: 1 }]]);
    for (const m of ups) expect(ServerMessageSchema.safeParse(m).success).toBe(true);
    // below level 3: no catch bonus and the 1/512 odds (roll 256 is not shiny)
    expect('catchBonus' in res.session.state).toBe(false);
    expect(res.session.state.sides[1].party[0]!.creature.isShiny).toBeUndefined();
  }, 120_000);

  it('level 3: the battle state carries the catch bonus, and so does the replay snapshot; a catch counts', async () => {
    const msgs: ServerMessage[] = [];
    const c = coordinator(msgs);
    // seen 16 (the setup's sighting, 14, this one), caught 3, defeated 15: 3 + 2 + 3 = 8 points, level 3
    const pid = await player({ seen: 14, caught: 3, defeated: 15 });
    const res = await c.startWild({ playerId: pid, sessionId: 's' }, spawn(), { x: 0, z: 0 });
    if (!res.ok) throw new Error(res.detail);
    expect(res.session.state.catchBonus).toEqual({ mossling: 1.25 });
    expect(res.session.start.catchBonus).toEqual({ mossling: 1.25 });
    const start = msgs.find((m) => m.type === 'battleStart')!;
    expect(ServerMessageSchema.safeParse(start).success).toBe(true);
    expect(c.action(pid, res.session.id, 1, { kind: 'catch', orb: 'aether_orb' })).toBeNull();
    await settle(c, res.session.id);
    const counters = await repos.db.transaction((tx) => repos.progress.counters(tx, pid, ['mossling']));
    expect(counters['mossling']).toEqual({ seen: 16, caught: 4, defeated: 15 });
    const delta = msgs.filter((m): m is Extract<ServerMessage, { type: 'progressionDelta' }> => m.type === 'progressionDelta' && m.dexCaught !== null).at(-1)!;
    // seen 16 (3) + caught 4 (2) + defeated 15 (3) = 8: still level 3, so no level-up rides the catch
    expect(delta.research).toBeUndefined();
  }, 120_000);

  it('level 5: the spawn roll is read at 1/256 and the bonus is 1.5', async () => {
    const msgs: ServerMessage[] = [];
    const c = coordinator(msgs);
    const pid = await player({ seen: 59, caught: 15, defeated: 50, variant: 3, alpha: 3 });
    const res = await c.startWild({ playerId: pid, sessionId: 's' }, spawn(), { x: 0, z: 0 });
    if (!res.ok) throw new Error(res.detail);
    expect(res.session.state.sides[1].party[0]!.creature.isShiny).toBe(true);
    expect(res.session.state.catchBonus).toEqual({ mossling: 1.5 });
    // a roll that is not a multiple of 256 stays plain at level 5
    const other = await player({ seen: 59, caught: 15, defeated: 50, variant: 3, alpha: 3 });
    const res2 = await coordinator([]).startWild({ playerId: other, sessionId: 's2' }, spawn({ shinyRoll: 128 }), { x: 0, z: 0 });
    if (!res2.ok) throw new Error(res2.detail);
    expect(res2.session.state.sides[1].party[0]!.creature.isShiny).toBeUndefined();
  }, 120_000);

  it('a knockout counts `defeated` for the winner and reports the level it raised', async () => {
    const msgs: ServerMessage[] = [];
    const c = coordinator(msgs);
    // seen 6 after this sighting (2 points), caught 1 (1), defeated 0: one knockout gives the fourth point
    const pid = await player({ seen: 4, caught: 1 }, { species: 'bramblecub', level: 60 });
    const res = await c.startWild({ playerId: pid, sessionId: 's' }, spawn({ level: 2 }), { x: 0, z: 0 });
    if (!res.ok) throw new Error(res.detail);
    const mine = res.session.state.sides[0].party[0]!.creature;
    const attack = mine.moves.map((m) => m.id).find((id) => content.move(id).power > 0)!;
    for (let turn = 1; turn <= 6 && c.get(res.session.id) !== null && c.get(res.session.id)!.state.ended === null; turn++) {
      expect(c.action(pid, res.session.id, turn, { kind: 'move', move: attack })).toBeNull();
      await settle(c, res.session.id);
    }
    const counters = await repos.db.transaction((tx) => repos.progress.counters(tx, pid, ['mossling']));
    expect(counters['mossling']!['defeated']).toBe(1);
    const ups = msgs.flatMap((m) => (m.type === 'progressionDelta' && m.research !== undefined ? m.research : []));
    // seen 6 (2) + caught 1 (1) + defeated 1 (1) = 4 points: level 2
    expect(ups).toContainEqual({ speciesId: 'mossling', level: 2 });
  }, 120_000);
});

describe('research over REST', () => {
  let s: TestServer;
  beforeAll(async () => {
    s = await startServer();
  }, 120_000);
  afterAll(async () => {
    await s?.stop();
  }, 60_000);

  it('GET /dex carries the entries, the research levels and the claimed rewards; POST /dex/viewed marks an entry', async () => {
    const acc = await register(s, 'bramblecub');
    const dex = await api(s, 'GET', '/dex', acc.access);
    expect(dex.status).toBe(200);
    expect(DexRes.safeParse(dex.body).success).toBe(true);
    expect(dex.body.entries.bramblecub).toMatchObject({ counters: { seen: 1, caught: 1 }, viewedAt: null });
    expect(dex.body.research).toEqual({ bramblecub: 1 });
    expect(dex.body.rewards).toEqual([]);
    const viewed = await api(s, 'POST', '/dex/viewed/bramblecub', acc.access, {});
    expect(viewed.status).toBe(200);
    expect(viewed.body.speciesId).toBe('bramblecub');
    expect((await api(s, 'GET', '/dex', acc.access)).body.entries.bramblecub.viewedAt).toBe(viewed.body.viewedAt);
    expect((await api(s, 'POST', '/dex/viewed/glimfin', acc.access, {})).status).toBe(404);
    await s.repos.db.transaction((tx) => s.repos.progress.claimReward(tx, acc.id, 'dex:test', new Date()));
    expect((await api(s, 'GET', '/dex', acc.access)).body.rewards).toEqual(['dex:test']);
  });

  it('an evolution counts `evolved` on the species it left and `evolvedInto` on the one it became', async () => {
    const acc = await register(s, 'bramblecub');
    const evo = content.species('bramblecub').evolution;
    if (evo === null || evo.kind !== 'level') throw new Error('bramblecub evolves by level');
    const cid = await s.repos.db.transaction(async (tx) => {
      const n = (await s.repos.creatures.party(tx, acc.id)).length;
      return (await s.repos.creatures.insert(tx, newCreature(content, 'bramblecub', evo.atLevel, { ownerId: acc.id }), { kind: 'party', index: n })).id;
    });
    const r = await api(s, 'POST', `/creature/${cid}/evolve`, acc.access, { into: evo.into });
    expect(r.status).toBe(200);
    const counters = await s.repos.db.transaction((tx) => s.repos.progress.counters(tx, acc.id, ['bramblecub', evo.into]));
    expect(counters['bramblecub']).toMatchObject({ evolved: 1 });
    expect(counters[evo.into]).toMatchObject({ seen: 1, caught: 1, evolvedInto: 1 });
  });
});
