/**
 * NPC side quests (LLM feature 2, `game/npcQuests.ts`), behind the `NPC_TOOLS` gate of the other NPC routes. The NPC
 * must stand in the caller's zone (`npcInZone`), except for dropping a favour from the journal.
 *
 * - `GET /npc/quests/:npcId`: the caller's open favour with that NPC (offered or active, `ready` when it can be handed
 *   in now) and what the NPC would ask now (`next`, null with the reason in `why`). The client words `next` for the
 *   talk pass before anything is asked.
 * - `POST /npc/quests/offer`: the NPC asked (the tool pass heard it ask): the favour is drawn again on the server (the
 *   same inputs give the same one) and stored as `offered`. An NPC that has an open favour answers that one.
 * - `POST /npc/quests/answer`: accept or decline an offer, or drop an active favour (anywhere).
 * - `POST /npc/quests/claim`: hand in to the NPC: the count reached, or the creature in the party / the items in the bag
 *   now (the items are taken). Pays the capped reward, records the `helped` deed (+2 standing, `recordNpcDeed`).
 * - `GET /npc/quests`: the journal (open favours, the last ten handed in).
 *
 * Offers nobody answered lapse after `NPC_QUEST_OFFER_TTL_MS`. Every write leaves an audit row (`npc.quest.*`).
 */
import { zone as zoneById } from '@ewa/content';
import type { ZoneId } from '@ewa/content';
import { NPC_QUEST_OFFER_TTL_MS, NpcQuestAnswerReq, NpcQuestClaimReq, NpcQuestClaimRes, NpcQuestOfferReq, NpcQuestParams, NpcQuestRes, NpcQuestsRes, NpcQuestViewSchema } from '@ewa/protocol';
import type { NpcQuestState, NpcQuestView } from '@ewa/protocol';
import type { NpcQuest, Tx } from '@ewa/persist';
import type { FastifyInstance } from 'fastify';
import { npcInZone, recordNpcDeed, standingWithNpc } from '../../game/npcMemory';
import { isReady, objectiveOf, planNpcQuest, questView, rewardOf, showable, whyNoQuest } from '../../game/npcQuests';
import { HttpError, out, presenceZone, refuseInBattle, requireAuth } from '../http';
import type { RestDeps } from '../http';

/** The NPC's name as the journal shows it ("Hessa Dunmore, town archivist"), from the zone it stands in. */
function npcName(zoneId: string, npcId: string): string {
  try {
    return npcInZone(zoneById(zoneId as ZoneId), npcId)?.name ?? npcId;
  } catch (_e) {
    return npcId;
  }
}

export function registerNpcQuestRoutes(app: FastifyInstance, deps: RestDeps, on: boolean): void {
  const { repos } = deps;
  const clock = deps.clock;
  const bearer = { onRequest: requireAuth(deps) };

  const zoneWith = (id: string, npcId: string) => {
    const zone = presenceZone(deps, id);
    if (zone === null || npcInZone(zone, npcId) === null) throw new HttpError(409, 'npcNotHere');
    return zone;
  };

  /** a favour as the client sees it: `ready` checked against the save now */
  const viewOf = async (tx: Tx, id: string, q: NpcQuest): Promise<NpcQuestView> => {
    const o = objectiveOf(q);
    const party = q.status === 'active' && o.kind === 'show' ? await repos.creatures.party(tx, id) : [];
    const items = q.status === 'active' && o.kind === 'deliver' ? await repos.inventory.all(tx, id) : {};
    return questView(q, npcName(q.zoneId, q.npcId), isReady(q, party, items));
  };

  /** the NPC's state for the caller (offers past their time lapse first) */
  const stateOf = async (tx: Tx, id: string, zoneId: ZoneId, npcId: string, now: Date): Promise<NpcQuestState> => {
    await repos.npcQuests.expireOffers(tx, id, new Date(now.getTime() - NPC_QUEST_OFFER_TTL_MS), now);
    const [open, history, standing] = await Promise.all([repos.npcQuests.open(tx, id), repos.npcQuests.ofNpc(tx, id, npcId), standingWithNpc(repos, tx, id, npcId)]);
    const mine = history.find((q) => q.status === 'offered' || q.status === 'active');
    const why = whyNoQuest({ open, history, standing, nowMs: now.getTime() });
    const next = why === null ? planNpcQuest({ worldSeed: deps.worldSeed, playerId: id, npcId, zoneId, seq: history.length, badges: await repos.progress.badges(tx, id) }) : null;
    return { npcId, quest: mine === undefined ? null : await viewOf(tx, id, mine), next, why };
  };

  app.get('/npc/quests', bearer, async (req) => {
    const id = req.user.sub;
    if (!on) throw new HttpError(409, 'npcToolsOff');
    const now = new Date(clock());
    const res = await repos.db.transaction(async (tx) => {
      await repos.npcQuests.expireOffers(tx, id, new Date(now.getTime() - NPC_QUEST_OFFER_TTL_MS), now);
      const open = await repos.npcQuests.open(tx, id);
      const done = await repos.npcQuests.claimed(tx, id, 10);
      return { open: await Promise.all(open.map((q) => viewOf(tx, id, q))), done: done.map((q) => questView(q, npcName(q.zoneId, q.npcId), false)) };
    });
    return out(deps, NpcQuestsRes, res);
  });

  app.get('/npc/quests/:npcId', bearer, async (req) => {
    const { npcId } = NpcQuestParams.parse(req.params);
    const id = req.user.sub;
    if (!on) throw new HttpError(409, 'npcToolsOff');
    const zone = zoneWith(id, npcId);
    const now = new Date(clock());
    return out(deps, NpcQuestRes, await repos.db.transaction((tx) => stateOf(tx, id, zone.id, npcId, now)));
  });

  app.post('/npc/quests/offer', bearer, async (req) => {
    const { npcId } = NpcQuestOfferReq.parse(req.body);
    const id = req.user.sub;
    if (!on) throw new HttpError(409, 'npcToolsOff');
    const zone = zoneWith(id, npcId);
    const now = new Date(clock());
    const res = await repos.db.transaction(async (tx) => {
      await repos.players.lock(tx, id);
      const st = await stateOf(tx, id, zone.id, npcId, now);
      if (st.quest !== null) return st;
      if (st.next === null) throw new HttpError(409, 'npcQuestUnavailable', { why: st.why });
      const seq = (await repos.npcQuests.ofNpc(tx, id, npcId)).length;
      const q = await repos.npcQuests.offer(tx, { playerId: id, npcId, zoneId: zone.id, seq, objective: st.next.objective, reward: st.next.reward, target: st.next.target }, now);
      await repos.audit.write(tx, { actorId: id, action: 'npc.quest.offer', subject: npcId, detail: { zone: zone.id, quest: q.id, objective: st.next.objective, reward: st.next.reward } }, now);
      return { npcId, quest: await viewOf(tx, id, q), next: null, why: 'open' as const };
    });
    return out(deps, NpcQuestRes, res);
  });

  app.post('/npc/quests/answer', bearer, async (req) => {
    const body = NpcQuestAnswerReq.parse(req.body);
    const id = req.user.sub;
    if (!on) throw new HttpError(409, 'npcToolsOff');
    const now = new Date(clock());
    const res = await repos.db.transaction(async (tx) => {
      await repos.npcQuests.expireOffers(tx, id, new Date(now.getTime() - NPC_QUEST_OFFER_TTL_MS), now);
      const q = await repos.npcQuests.lock(tx, id, body.questId);
      if (q === null) throw new HttpError(404, 'notFound');
      // an offer is answered to the NPC's face; a favour can be dropped from anywhere
      if (body.answer !== 'abandon') zoneWith(id, q.npcId);
      const from = body.answer === 'abandon' ? 'active' : 'offered';
      if (q.status !== from) throw new HttpError(409, 'npcQuestClosed', { status: q.status });
      const status = body.answer === 'accept' ? 'active' : body.answer === 'decline' ? 'declined' : 'abandoned';
      const after = await repos.npcQuests.setStatus(tx, q.id, status, now);
      await repos.audit.write(tx, { actorId: id, action: `npc.quest.${body.answer}`, subject: q.npcId, detail: { quest: q.id, zone: q.zoneId } }, now);
      return viewOf(tx, id, after);
    });
    return out(deps, NpcQuestViewSchema, res);
  });

  app.post('/npc/quests/claim', bearer, async (req) => {
    const { npcId } = NpcQuestClaimReq.parse(req.body);
    const id = req.user.sub;
    if (!on) throw new HttpError(409, 'npcToolsOff');
    refuseInBattle(deps, id);
    const zone = zoneWith(id, npcId);
    const now = new Date(clock());
    const res = await repos.db.transaction(async (tx) => {
      const row = await repos.players.lock(tx, id);
      const open = (await repos.npcQuests.ofNpc(tx, id, npcId)).find((x) => x.status === 'active');
      const q = open === undefined ? null : await repos.npcQuests.lock(tx, id, open.id);
      if (q === null || q.status !== 'active') throw new HttpError(409, 'npcQuestNone');
      const o = objectiveOf(q);
      const reward = rewardOf(q);
      const items: Record<string, number> = {};
      if (o.kind === 'show') {
        if (showable(await repos.creatures.party(tx, id), o.type, o.level).length === 0) throw new HttpError(409, 'npcQuestNotDone');
      } else if (o.kind === 'deliver') {
        if ((await repos.inventory.qty(tx, id, o.item)) < o.qty) throw new HttpError(409, 'npcQuestNotDone');
        items[o.item] = await repos.inventory.add(tx, id, o.item, -o.qty);
      } else if (q.progress < q.target) throw new HttpError(409, 'npcQuestNotDone');
      const money = reward.money > 0 ? await repos.players.addMoney(tx, id, reward.money) : row.money;
      if (reward.item !== null) items[reward.item.id] = await repos.inventory.add(tx, id, reward.item.id, reward.item.qty);
      const after = await repos.npcQuests.setStatus(tx, q.id, 'claimed', now);
      await recordNpcDeed(repos, tx, id, npcId, zone.id, 'helped', now);
      const standing = await standingWithNpc(repos, tx, id, npcId);
      await repos.audit.write(tx, { actorId: id, action: 'npc.quest.claim', subject: npcId, detail: { zone: zone.id, quest: q.id, objective: o, reward, standing } }, now);
      return { quest: questView(after, npcName(q.zoneId, npcId), false), money, items, standing };
    });
    return out(deps, NpcQuestClaimRes, res);
  });
}
