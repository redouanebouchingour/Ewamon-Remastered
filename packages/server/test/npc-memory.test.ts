/**
 * NPC memory and town reputation (`GET /npc/memory/:npcId`, `POST /npc/memory`): a conversation's summary and talk
 * deeds move the NPC's standing within the per-write cap; the town's reputation sums its NPCs' standings and the other
 * villagers have heard the notable deeds; repeated kind words count once per cooldown; the client cannot report the
 * deeds the server records itself (money and Ewamon through `/npc/act`, a villager battle's end); an NPC elsewhere is
 * refused; every write leaves an audit row; `NPC_TOOLS=off` turns it off.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { zone } from '@ewa/content';
import { createRng } from '@ewa/core';
import { NPC_DEED_COOLDOWN_MS, NPC_MEMORY_NOTE_MAX, NPC_WRITE_DELTA_MIN, feelingScore, standingOf, townScore, villagerTrainerId, writeDelta } from '@ewa/protocol';
import type { ServerMessage } from '@ewa/protocol';
import { createRoomMetrics } from '../src/metrics';
import { silentLogger } from '../src/log';
import { BattleCoordinator } from '../src/rooms/battleSession';
import type { BattleHost } from '../src/rooms/battleSession';
import { trimNote } from '../src/rest/routes/npc';
import { applyDeeds, standingWithNpc, townStandingOf } from '../src/game/npcMemory';
import { api, content, enter, rawQuery, register, startServer } from './helpers';
import type { TestServer } from './helpers';

let s: TestServer;
beforeAll(async () => {
  s = await startServer();
}, 120_000);
afterAll(async () => {
  await s?.stop();
}, 60_000);

const [archivist, child, gardener] = ['mirevale.archivist', 'mirevale.child', 'mirevale.gardener'];
const D = '\u2014';

describe('NPC memory rules', () => {
  it('bands the standing, sums a town, halves it for a stranger and caps a write', () => {
    expect([-10, -6, -5, -2, -1, 0, 1, 2, 5, 6, 10].map(standingOf)).toEqual(['hostile', 'hostile', 'wary', 'wary', 'neutral', 'neutral', 'neutral', 'liked', 'liked', 'trusted', 'trusted']);
    expect(townScore([-3, -4, -5])).toBe(-10);
    expect(townScore([])).toBe(0);
    expect(feelingScore(null, -5)).toBe(-2);
    expect(feelingScore(3, -10)).toBe(3);
    expect(writeDelta(['hit', 'robbed', 'insulted'])).toBe(NPC_WRITE_DELTA_MIN);
    expect(writeDelta(['kindWords', 'kindWords'])).toBe(1);
  });

  it('records a deed once per cooldown; a repeated positive one adds nothing, a negative one still counts', () => {
    const t = Date.UTC(2026, 9, 24);
    const recent = [{ deed: 'kindWords', at: new Date(t - 1000).toISOString() }, { deed: 'hit', at: new Date(t - 1000).toISOString() }];
    expect(applyDeeds(['kindWords'], recent, t, true)).toEqual({ record: [], delta: 0 });
    expect(applyDeeds(['hit'], recent, t, true)).toEqual({ record: [], delta: -3 });
    expect(applyDeeds(['kindWords'], recent, t + NPC_DEED_COOLDOWN_MS, true)).toEqual({ record: ['kindWords'], delta: 1 });
  });

  it('trims a summary: no control characters or em-dashes, cut at a sentence', () => {
    expect(trimNote(`  The traveller ${D} rude ${D} slapped me.\n`)).toBe('The traveller, rude, slapped me.');
    const long = trimNote(`${'The traveller asked about berries. '.repeat(20)}`);
    expect(long.length).toBeLessThanOrEqual(NPC_MEMORY_NOTE_MAX);
    expect(long.endsWith('.')).toBe(true);
  });
});

describe('GET / POST /npc/memory', () => {
  it('a slapped NPC stays cold, the town turns wary and the other villagers have heard', async () => {
    const acc = await register(s);
    const j = await enter(s, acc, 'mirevale');
    const fresh = await api(s, 'GET', `/npc/memory/${archivist}`, acc.access);
    expect(fresh.status).toBe(200);
    expect(fresh.body).toMatchObject({ known: false, summary: '', standing: 0, feeling: 'neutral', deeds: [], gossip: [], town: { zoneId: 'mirevale', name: 'Mirevale', score: 0, standing: 'neutral', known: 0 } });

    const wrote = await api(s, 'POST', '/npc/memory', acc.access, { npcId: archivist, summary: `The traveller slapped me ${D} for nothing. I cursed at them.`, deeds: ['hit', 'insulted'] });
    expect(wrote.status).toBe(200);
    expect(wrote.body).toMatchObject({ known: true, summary: 'The traveller slapped me, for nothing. I cursed at them.', standing: -5, feeling: 'wary', town: { score: -5, standing: 'wary', known: 1 } });
    expect(wrote.body.deeds.map((d: { deed: string }) => d.deed)).toEqual(['hit', 'insulted']);

    // the next visit: still cold
    const again = await api(s, 'GET', `/npc/memory/${archivist}`, acc.access);
    expect(again.body).toMatchObject({ known: true, standing: -5, feeling: 'wary', summary: wrote.body.summary });
    // another villager has heard, and is wary of a stranger with that name
    const other = await api(s, 'GET', `/npc/memory/${child}`, acc.access);
    expect(other.body).toMatchObject({ known: false, standing: 0, feeling: 'wary', town: { score: -5, standing: 'wary' } });
    expect(other.body.gossip.map((g: { npcId: string; deed: string; npcName: string }) => [g.npcId, g.deed, g.npcName])).toEqual(
      expect.arrayContaining([
        [archivist, 'hit', 'Hessa Dunmore, town archivist'],
        [archivist, 'insulted', 'Hessa Dunmore, town archivist'],
      ]),
    );
    // the NPC never gossips about itself
    expect(again.body.gossip).toEqual([]);

    const audit = await rawQuery(s.db, "select action, subject, detail from audit_log where actor_id = $1 and action = 'npc.memory'", [acc.id]);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ subject: archivist, detail: { zone: 'mirevale', deeds: ['hit', 'insulted'], delta: -5, standing: -5 } });
    // the helpers later features read
    const st = await s.repos.db.transaction(async (tx) => ({ npc: await standingWithNpc(s.repos, tx, acc.id, archivist), town: await townStandingOf(s.repos, tx, acc.id, 'mirevale') }));
    expect(st).toMatchObject({ npc: -5, town: { score: -5, standing: 'wary' } });
    await j.room.leave(true);
  }, 60_000);

  it('kind words count once per cooldown; the summary rolls; server-only deeds are refused from the client', async () => {
    const acc = await register(s);
    const j = await enter(s, acc, 'mirevale');
    const write = (summary: string, deeds: string[]) => api(s, 'POST', '/npc/memory', acc.access, { npcId: gardener, summary, deeds });
    expect((await write('The traveller asked about berries.', ['kindWords'])).body).toMatchObject({ standing: 1, feeling: 'neutral' });
    const second = await write('They thanked me again.', ['kindWords']);
    expect(second.body).toMatchObject({ standing: 1, summary: 'The traveller asked about berries. They thanked me again.' });
    expect(second.body.deeds).toHaveLength(1);
    s.time.advance(NPC_DEED_COOLDOWN_MS + 1);
    expect((await write('More berries.', ['kindWords'])).body.standing).toBe(2);
    // kind words raise the town's opinion but are not gossip
    expect((await api(s, 'GET', `/npc/memory/${child}`, acc.access)).body).toMatchObject({ town: { score: 2, standing: 'liked' }, feeling: 'neutral', gossip: [] });
    for (const deeds of [['giftGiven'], ['battleWon'], ['nonsense']]) expect((await write('x', deeds)).status).toBe(400);
    // an NPC of another zone
    expect((await api(s, 'POST', '/npc/memory', acc.access, { npcId: zone('mire_route').npcs[0]!.id, summary: 'x', deeds: [] })).body.code).toBe('npcNotHere');
    expect((await api(s, 'GET', `/npc/memory/${zone('mire_route').npcs[0]!.id}`, acc.access)).body.code).toBe('npcNotHere');
    await j.room.leave(true);
  }, 60_000);

  it('records what /npc/act moved: money given is a gift received, money taken a gift given', async () => {
    const acc = await register(s);
    const j = await enter(s, acc, 'mirevale');
    expect((await api(s, 'POST', '/npc/act', acc.access, { npcId: child, action: 'giveMoney', amount: 5 })).status).toBe(200);
    expect((await api(s, 'POST', '/npc/act', acc.access, { npcId: child, action: 'takeMoney', amount: 5 })).status).toBe(200);
    // a second take inside the cooldown: not recorded again, no more standing
    expect((await api(s, 'POST', '/npc/act', acc.access, { npcId: child, action: 'takeMoney', amount: 1 })).status).toBe(200);
    const m = (await api(s, 'GET', `/npc/memory/${child}`, acc.access)).body;
    expect(m).toMatchObject({ known: true, standing: 1, summary: '' });
    expect(m.deeds.map((d: { deed: string }) => d.deed)).toEqual(['giftReceived', 'giftGiven']);
    await j.room.leave(true);
  }, 60_000);

  it('a villager battle is remembered when it ends', async () => {
    const acc = await register(s);
    const msgs: ServerMessage[] = [];
    const host: BattleHost = { send: (_p, msg) => void msgs.push(msg), onStart: () => undefined, onEnd: () => undefined, onProgress: () => undefined };
    const c = new BattleCoordinator(createRng('npc-memory'), { repos: s.repos, content, clock: s.time.clock, log: silentLogger(), zone: zone('mirevale'), host, metrics: createRoomMetrics('r', 'mirevale', 0) });
    const res = await c.startVillager({ playerId: acc.id, sessionId: 's' }, gardener, { x: 0, z: 0 }, 'seed');
    if (!res.ok) throw new Error(res.detail);
    expect(res.session.state.sides[1].trainerId).toBe(villagerTrainerId(gardener));
    for (let i = 0; i < 80 && c.get(res.session.id) !== null; i++) {
      const st = c.get(res.session.id)!.state;
      const b = st.sides[0].party[st.sides[0].active]!;
      const mv = b.creature.moves.find((x) => x.pp > 0 && content.move(x.id).power > 0) ?? b.creature.moves.find((x) => x.pp > 0)!;
      c.action(acc.id, res.session.id, st.turn + 1, { kind: 'move', move: mv.id });
      for (let k = 0; k < 300 && c.get(res.session.id)?.resolving; k++) await new Promise((r) => setTimeout(r, 5));
    }
    const end = msgs.find((x) => x.type === 'battleEnd');
    if (end?.type !== 'battleEnd') throw new Error('no end');
    const won = end.outcome.winner === 0;
    const mem = await s.repos.db.transaction((tx) => s.repos.npcMemory.of(tx, acc.id, gardener));
    expect(mem).toMatchObject({ zoneId: 'mirevale', standing: 1 });
    expect(mem!.deeds.map((d) => d.deed)).toEqual([won ? 'battleWon' : 'battleLost']);
    c.dispose();
  }, 90_000);
});

describe('NPC memory off', () => {
  it('answers npcToolsOff when NPC_TOOLS=off', async () => {
    const off = await startServer({ NPC_TOOLS: 'off' });
    try {
      const acc = await register(off);
      const j = await enter(off, acc, 'mirevale');
      expect((await api(off, 'GET', `/npc/memory/${archivist}`, acc.access)).body.code).toBe('npcToolsOff');
      expect((await api(off, 'POST', '/npc/memory', acc.access, { npcId: archivist, summary: 'x', deeds: [] })).body.code).toBe('npcToolsOff');
      await j.room.leave(true);
    } finally {
      await off.stop();
    }
  }, 120_000);
});
