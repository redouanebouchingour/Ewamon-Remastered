/**
 * NPC side quests (`/npc/quests*`, game/npcQuests.ts): the favour is drawn deterministically from content and the world
 * seed, among what the player can reach, with a capped reward from the safe list; an offer is stored, accepted, advanced
 * by real events through `advanceQuests` (a catch, a wild win in the zone, a crossing), handed in for the reward and a
 * standing bump (`helped`), then the NPC waits out its cooldown; at most three open favours, one per NPC; offers lapse;
 * a show / deliver favour is checked (and the items taken) at the hand-in; every write leaves an audit row; an NPC
 * elsewhere is refused; `NPC_TOOLS=off` turns it off.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BADGE_ORDER, SPECIES, ZONES, encounterTableFor, zone } from '@ewa/content';
import type { BadgeId, ZoneId } from '@ewa/content';
import {
  NPC_DEED_DELTA,
  NPC_QUEST_COOLDOWN_MS,
  NPC_QUEST_DECLINE_COOLDOWN_MS,
  NPC_QUEST_DELIVER_ITEMS,
  NPC_QUEST_MONEY_MAX,
  NPC_QUEST_OFFER_TTL_MS,
  NPC_QUEST_REWARD_ITEMS,
  NpcQuestPlanSchema,
  npcQuestKey,
} from '@ewa/protocol';
import type { NpcQuestView } from '@ewa/protocol';
import { newCreature } from '../src/game/creatures';
import { advanceQuests } from '../src/game/quests';
import type { QuestEvent } from '../src/game/quests';
import { hitsOf, planNpcQuest, questSlots, reachableZones } from '../src/game/npcQuests';
import { api, content, enter, rawQuery, register, startServer } from './helpers';
import type { Account, TestServer } from './helpers';

let s: TestServer;
beforeAll(async () => {
  s = await startServer();
}, 120_000);
afterAll(async () => {
  await s?.stop();
}, 60_000);

const [archivist, child, gardener, wynn] = ['mirevale.archivist', 'mirevale.child', 'mirevale.gardener', 'mirevale.wynn'];

describe('planNpcQuest', () => {
  it('is deterministic, reachable, obtainable and capped for every zone, badge count and the first 40 favours', () => {
    const kinds = new Set<string>();
    for (const z of ZONES) {
      for (const n of [0, 2, 4, 8]) {
        const badges = BADGE_ORDER.slice(0, n) as BadgeId[];
        const reach = reachableZones(z.id, badges).map((x) => x.id);
        for (let seq = 0; seq < 40; seq++) {
          const input = { worldSeed: 'w', playerId: 'p', npcId: `${z.id}.n`, zoneId: z.id, seq, badges };
          const plan = planNpcQuest(input);
          expect(plan).not.toBeNull();
          expect(planNpcQuest(input)).toEqual(plan);
          NpcQuestPlanSchema.parse(plan);
          const o = plan!.objective;
          kinds.add(o.kind);
          expect(reach).toContain(o.zoneId);
          expect(plan!.reward.money).toBeLessThanOrEqual(NPC_QUEST_MONEY_MAX);
          expect(plan!.reward.money).toBeGreaterThan(0);
          if (plan!.reward.item !== null) expect(NPC_QUEST_REWARD_ITEMS).toContain(plan!.reward.item.id);
          if (o.kind === 'catch') expect(questSlots(o.zoneId).map((x) => x.species)).toContain(o.species);
          if (o.kind === 'show') expect(questSlots(o.zoneId).some((x) => SPECIES.find((sp) => sp.id === x.species)!.types[0] === o.type && x.levelMax === o.level)).toBe(true);
          if (o.kind === 'defeat') expect(encounterTableFor(o.zoneId)).not.toBeNull();
          if (o.kind === 'deliver') {
            expect(NPC_QUEST_DELIVER_ITEMS).toContain(o.item);
            expect(zone(o.zoneId).shop).toContain(o.item);
          }
          if (o.kind === 'visit') expect(o.zoneId).not.toBe(z.id);
          expect(plan!.target).toBe(o.kind === 'defeat' ? o.count : 1);
        }
      }
    }
    expect([...kinds].sort()).toEqual(['catch', 'defeat', 'deliver', 'show', 'visit']);
  });

  it('never sends a fresh trainer past a badge gate, and a new seed or a new favour draws again', () => {
    for (let seq = 0; seq < 40; seq++) {
      const o = planNpcQuest({ worldSeed: 'w', playerId: 'p', npcId: gardener, zoneId: 'mirevale', seq, badges: [] })!.objective;
      expect(['mirevale', 'mire_route']).toContain(o.zoneId);
    }
    const draws = (f: (i: number) => object) => new Set(Array.from({ length: 12 }, (_, i) => JSON.stringify(planNpcQuest({ worldSeed: 'w', playerId: 'p', npcId: gardener, zoneId: 'mirevale', seq: 0, badges: [], ...f(i) })))).size;
    expect(draws((i) => ({ seq: i }))).toBeGreaterThan(3);
    expect(draws((i) => ({ worldSeed: `w${i}` }))).toBeGreaterThan(3);
  });

  it('counts only the matching events', () => {
    const ev: QuestEvent[] = [
      { kind: 'catch', species: 'mossling' },
      { kind: 'catch', species: 'glimp' },
      { kind: 'win', format: 'wild', zoneId: 'mire_route' },
      { kind: 'win', format: 'wild', zoneId: 'ash_route' },
      { kind: 'win', format: 'trainer', zoneId: 'mire_route' },
      { kind: 'reachZone', zoneId: 'mire_route' },
    ];
    expect(hitsOf({ kind: 'catch', species: 'mossling', zoneId: 'mire_route' }, ev)).toBe(1);
    expect(hitsOf({ kind: 'defeat', zoneId: 'mire_route', count: 3 }, ev)).toBe(1);
    expect(hitsOf({ kind: 'visit', zoneId: 'mire_route' }, ev)).toBe(1);
    expect(hitsOf({ kind: 'deliver', item: 'potion', qty: 1, zoneId: 'mirevale' }, ev)).toBe(0);
  });
});

/** Does what a favour asks, the way the game would record it. */
async function complete(acc: Account, q: NpcQuestView): Promise<void> {
  const o = q.objective;
  await s.repos.db.transaction(async (tx) => {
    const events: QuestEvent[] =
      o.kind === 'catch'
        ? [{ kind: 'catch', species: o.species }]
        : o.kind === 'defeat'
          ? Array.from({ length: o.count }, () => ({ kind: 'win', format: 'wild', zoneId: o.zoneId }) as const)
          : o.kind === 'visit'
            ? [{ kind: 'reachZone', zoneId: o.zoneId as ZoneId }]
            : [];
    if (events.length > 0) {
      const touched = await advanceQuests(tx, s.repos, acc.id, events);
      expect(touched).toContainEqual({ questId: npcQuestKey(q.id), objectiveId: 'main', count: q.target, done: true });
    }
    if (o.kind === 'deliver') await s.repos.inventory.add(tx, acc.id, o.item, o.qty);
    if (o.kind === 'show') {
      const sp = questSlots(o.zoneId).find((x) => SPECIES.find((y) => y.id === x.species)!.types[0] === o.type)!.species;
      await s.repos.creatures.insert(tx, newCreature(content, sp, o.level, { ownerId: acc.id, moves: 'level' }), { kind: 'box', index: 'nextBox' });
      // a creature to show must be in the party: swap it in for the starter's slot 1
      const party = await s.repos.creatures.party(tx, acc.id);
      if (!party.some((c) => c.speciesId === sp && c.level >= o.level)) {
        await s.repos.creatures.insert(tx, newCreature(content, sp, o.level, { ownerId: acc.id, moves: 'level' }), { kind: 'party', index: party.length });
      }
    }
  });
}

describe('/npc/quests', () => {
  it('a villager offers, the player accepts, does it and hands it in for the reward and a standing bump', async () => {
    const acc = await register(s);
    const j = await enter(s, acc, 'mirevale');
    const first = await api(s, 'GET', `/npc/quests/${gardener}`, acc.access);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ npcId: gardener, quest: null, why: null });
    const next = first.body.next;
    NpcQuestPlanSchema.parse(next);

    const offered = await api(s, 'POST', '/npc/quests/offer', acc.access, { npcId: gardener });
    expect(offered.status).toBe(200);
    const q = offered.body.quest as NpcQuestView;
    // the server draws the same favour the client worded
    expect({ objective: q.objective, reward: q.reward, target: q.target }).toEqual(next);
    expect(q).toMatchObject({ status: 'offered', npcName: 'the berry-gardener', zoneId: 'mirevale', progress: 0, ready: false });
    // asking again answers the same offer
    expect((await api(s, 'POST', '/npc/quests/offer', acc.access, { npcId: gardener })).body.quest.id).toBe(q.id);
    expect((await api(s, 'GET', `/npc/quests/${gardener}`, acc.access)).body).toMatchObject({ quest: { id: q.id }, next: null, why: 'open' });

    // not accepted yet: nothing to hand in
    expect((await api(s, 'POST', '/npc/quests/claim', acc.access, { npcId: gardener })).body.code).toBe('npcQuestNone');
    const accepted = await api(s, 'POST', '/npc/quests/answer', acc.access, { questId: q.id, answer: 'accept' });
    expect(accepted.body).toMatchObject({ id: q.id, status: 'active' });
    expect((await api(s, 'POST', '/npc/quests/answer', acc.access, { questId: q.id, answer: 'accept' })).body.code).toBe('npcQuestClosed');
    // (the favour is drawn per player: a creature to show or items to bring may be there already)
    const counted = q.objective.kind === 'catch' || q.objective.kind === 'defeat' || q.objective.kind === 'visit';
    if (counted) expect((await api(s, 'POST', '/npc/quests/claim', acc.access, { npcId: gardener })).body.code).toBe('npcQuestNotDone');

    await complete(acc, q);
    const ready = await api(s, 'GET', `/npc/quests/${gardener}`, acc.access);
    expect(ready.body.quest).toMatchObject({ status: 'active', ready: true, progress: counted ? q.target : 0 });

    const before = await s.repos.db.transaction(async (tx) => ({ money: (await s.repos.players.byId(tx, acc.id))!.money, inv: await s.repos.inventory.all(tx, acc.id) }));
    const claim = await api(s, 'POST', '/npc/quests/claim', acc.access, { npcId: gardener });
    expect(claim.status).toBe(200);
    expect(claim.body.quest).toMatchObject({ id: q.id, status: 'claimed' });
    expect(claim.body.money).toBe(before.money + q.reward.money);
    expect(claim.body.standing).toBe(NPC_DEED_DELTA.helped);
    if (q.reward.item !== null) expect(claim.body.items[q.reward.item.id]).toBe((before.inv[q.reward.item.id] ?? 0) + q.reward.item.qty);
    if (q.objective.kind === 'deliver') expect(claim.body.items[q.objective.item]).toBe((before.inv[q.objective.item] ?? 0) - q.objective.qty);
    // the NPC remembers the favour, the town has heard
    const mem = (await api(s, 'GET', `/npc/memory/${child}`, acc.access)).body;
    expect(mem.gossip.map((g: { deed: string }) => g.deed)).toContain('helped');
    // the journal
    const list = (await api(s, 'GET', '/npc/quests', acc.access)).body;
    expect(list.open).toEqual([]);
    expect(list.done.map((x: NpcQuestView) => x.id)).toEqual([q.id]);
    // the NPC waits out its cooldown, then asks something new
    expect((await api(s, 'GET', `/npc/quests/${gardener}`, acc.access)).body).toMatchObject({ next: null, why: 'cooldown' });
    s.time.advance(NPC_QUEST_COOLDOWN_MS + 1);
    const again = (await api(s, 'GET', `/npc/quests/${gardener}`, acc.access)).body;
    expect(again.why).toBeNull();

    const audit = await rawQuery(s.db, "select action from audit_log where actor_id = $1 and action like 'npc.quest.%' order by at", [acc.id]);
    expect(audit.map((a) => a.action)).toEqual(['npc.quest.offer', 'npc.quest.accept', 'npc.quest.claim']);
    await j.room.leave(true);
  }, 60_000);

  it('holds three open favours at most, one per NPC; a refusal or a dropped favour starts a shorter cooldown; offers lapse', async () => {
    const acc = await register(s);
    const j = await enter(s, acc, 'mirevale');
    const offer = (npcId: string) => api(s, 'POST', '/npc/quests/offer', acc.access, { npcId });
    const a = (await offer(archivist)).body.quest;
    const b = (await offer(child)).body.quest;
    const c = (await offer(gardener)).body.quest;
    expect(new Set([a.id, b.id, c.id]).size).toBe(3);
    expect((await api(s, 'GET', `/npc/quests/${wynn}`, acc.access)).body).toMatchObject({ next: null, why: 'tooMany' });
    expect((await offer(wynn)).body).toMatchObject({ code: 'npcQuestUnavailable', why: 'tooMany' });

    expect((await api(s, 'POST', '/npc/quests/answer', acc.access, { questId: a.id, answer: 'decline' })).body.status).toBe('declined');
    expect((await api(s, 'GET', `/npc/quests/${archivist}`, acc.access)).body.why).toBe('cooldown');
    // dropping needs an accepted favour
    expect((await api(s, 'POST', '/npc/quests/answer', acc.access, { questId: b.id, answer: 'abandon' })).body.code).toBe('npcQuestClosed');
    await api(s, 'POST', '/npc/quests/answer', acc.access, { questId: b.id, answer: 'accept' });
    expect((await api(s, 'POST', '/npc/quests/answer', acc.access, { questId: b.id, answer: 'abandon' })).body.status).toBe('abandoned');
    s.time.advance(NPC_QUEST_DECLINE_COOLDOWN_MS + 1);
    expect((await api(s, 'GET', `/npc/quests/${archivist}`, acc.access)).body.why).toBeNull();
    // the gardener's offer was never answered: it lapses
    s.time.advance(NPC_QUEST_OFFER_TTL_MS);
    const list = (await api(s, 'GET', '/npc/quests', acc.access)).body;
    expect(list.open).toEqual([]);
    expect((await api(s, 'POST', '/npc/quests/answer', acc.access, { questId: c.id, answer: 'accept' })).body).toMatchObject({ code: 'npcQuestClosed', status: 'expired' });
    // a lapsed offer counts as a refusal: the gardener waits, then asks its next favour
    expect((await api(s, 'GET', `/npc/quests/${gardener}`, acc.access)).body.why).toBe('cooldown');
    s.time.advance(NPC_QUEST_DECLINE_COOLDOWN_MS + 1);
    const d = (await offer(gardener)).body.quest;
    expect(d.id).not.toBe(c.id);
    await j.room.leave(true);
  }, 60_000);

  it('a wary NPC asks nothing; an NPC elsewhere is refused; another player cannot answer the favour', async () => {
    const acc = await register(s);
    const j = await enter(s, acc, 'mirevale');
    await api(s, 'POST', '/npc/memory', acc.access, { npcId: archivist, summary: 'The traveller slapped me.', deeds: ['hit'] });
    expect((await api(s, 'GET', `/npc/quests/${archivist}`, acc.access)).body).toMatchObject({ next: null, why: 'standing' });
    const away = zone('mire_route').npcs[0]!.id;
    expect((await api(s, 'GET', `/npc/quests/${away}`, acc.access)).body.code).toBe('npcNotHere');
    expect((await api(s, 'POST', '/npc/quests/offer', acc.access, { npcId: away })).body.code).toBe('npcNotHere');
    const q = (await api(s, 'POST', '/npc/quests/offer', acc.access, { npcId: gardener })).body.quest;
    const other = await register(s);
    expect((await api(s, 'POST', '/npc/quests/answer', other.access, { questId: q.id, answer: 'accept' })).status).toBe(404);
    await j.room.leave(true);
  }, 60_000);
});

describe('handing in a favour to show or to bring', () => {
  it('checks the party and the bag at the hand-in, and takes the items', async () => {
    const acc = await register(s);
    const j = await enter(s, acc, 'mirevale');
    const seed = (npcId: string, objective: object, target = 1) =>
      s.repos.db.transaction(async (tx) => {
        const q = await s.repos.npcQuests.offer(tx, { playerId: acc.id, npcId, zoneId: 'mirevale', seq: 0, objective: objective as never, reward: { money: 200, item: null }, target }, new Date(s.time.clock()));
        await s.repos.npcQuests.setStatus(tx, q.id, 'active', new Date(s.time.clock()));
        return q.id;
      });
    await seed(child, { kind: 'deliver', item: 'potion', qty: 2, zoneId: 'mirevale' });
    await seed(archivist, { kind: 'show', type: 'Water', level: 30, zoneId: 'mire_route' });
    const claim = (npcId: string) => api(s, 'POST', '/npc/quests/claim', acc.access, { npcId });
    // a fresh save has a few potions: down to one
    await s.repos.db.transaction(async (tx) => s.repos.inventory.add(tx, acc.id, 'potion', 1 - (await s.repos.inventory.qty(tx, acc.id, 'potion'))));
    expect((await api(s, 'GET', `/npc/quests/${child}`, acc.access)).body.quest.ready).toBe(false);
    expect((await claim(child)).body.code).toBe('npcQuestNotDone');
    await s.repos.db.transaction((tx) => s.repos.inventory.add(tx, acc.id, 'potion', 2));
    const potions = await s.repos.db.transaction((tx) => s.repos.inventory.qty(tx, acc.id, 'potion'));
    expect((await api(s, 'GET', `/npc/quests/${child}`, acc.access)).body.quest.ready).toBe(true);
    const got = await claim(child);
    expect(got.status).toBe(200);
    expect(got.body.items).toEqual({ potion: potions - 2 });
    // no Water type of level 30 in the party: not done; one in the party: done (and kept)
    expect((await claim(archivist)).body.code).toBe('npcQuestNotDone');
    const water = SPECIES.find((sp) => sp.types[0] === 'Water')!.id;
    await s.repos.db.transaction(async (tx) => {
      const party = await s.repos.creatures.party(tx, acc.id);
      await s.repos.creatures.insert(tx, newCreature(content, water, 30, { ownerId: acc.id, moves: 'level' }), { kind: 'party', index: party.length });
    });
    expect((await claim(archivist)).status).toBe(200);
    expect((await s.repos.db.transaction((tx) => s.repos.creatures.party(tx, acc.id))).some((c) => c.speciesId === water)).toBe(true);
    await j.room.leave(true);
  }, 60_000);
});

describe('/npc/quests off', () => {
  it('answers npcToolsOff when NPC_TOOLS=off', async () => {
    const off = await startServer({ NPC_TOOLS: 'off' });
    try {
      const acc = await register(off);
      const j = await enter(off, acc, 'mirevale');
      expect((await api(off, 'GET', `/npc/quests/${gardener}`, acc.access)).body.code).toBe('npcToolsOff');
      expect((await api(off, 'GET', '/npc/quests', acc.access)).body.code).toBe('npcToolsOff');
      expect((await api(off, 'POST', '/npc/quests/offer', acc.access, { npcId: gardener })).body.code).toBe('npcToolsOff');
      expect((await api(off, 'POST', '/npc/quests/claim', acc.access, { npcId: gardener })).body.code).toBe('npcToolsOff');
      await j.room.leave(true);
    } finally {
      await off.stop();
    }
  }, 120_000);
});
