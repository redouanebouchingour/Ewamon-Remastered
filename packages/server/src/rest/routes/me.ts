/**
 * §4.7 rows: GET /me, POST /zone/enter, POST /profile, POST /quests/claim.
 */
import { BATTLE_PASS, BODIES, CHALLENGE_MODE_FLAG, DEX_TITLES, dexTitlesOf, FALLEN_MEMORIAL_RIBBON, FALLEN_RIBBON, QUESTS, TITLES, quest as questById, zone as zoneById } from '@ewa/content';
import { TRAINER_EXP, trainerLevelFor } from '@ewa/core';
import { ChallengeReq, ChallengeRes, MeRes, PlayerProfileSchema, QuestClaimReq, QuestClaimRes, ZoneEnterReq, ZoneEnterRes, profileRequestFor } from '@ewa/protocol';
import type { QuestView, ZoneId } from '@ewa/protocol';
import type { FastifyInstance } from 'fastify';
import { newCreature } from '../../game/creatures';
import { liveStreak } from '../../liveops/login';
import { WEEKLY_GOALS, dailyMissionsFor, dailyQuestId, missionsForQuest, weeklyQuestId } from '../../liveops/missions';
import type { DailyMission } from '../../liveops/missions';
import { dayKey, liveOpsSummary, weekKey } from '../../liveops/schedule';
import { pickZoneRoom, reserveZoneSeat, zoneRoomById } from '../../rooms/matchmaking';
import { toInstance } from '../../rooms/battleSession';
import { HttpError, out, rateLimit, refuseInBattle, requireAuth, toProfile } from '../http';
import type { RestDeps } from '../http';
import { FACTION_POINTS, seasonAt } from '@ewa/content';

export { dayKey, weekKey };

type QuestRows = Record<string, readonly { objectiveId: string; count: number; done: boolean; claimedAt: Date | null }[]>;

/**
 * A synthetic daily/weekly quest as GET /me lists it (QuestView is loose): one progress entry per mission (count 0
 * when untouched) and, beside it, the missions themselves with their per-mission claim state.
 */
function syntheticView(questId: string, missions: readonly DailyMission[], rows: QuestRows): QuestView {
  const got = rows[questId] ?? [];
  const progress = missions.map((m) => {
    const r = got.find((x) => x.objectiveId === m.id);
    return { questId, objectiveId: m.id, count: r?.count ?? 0, done: r?.done ?? false };
  });
  const claimedIds = new Set(got.filter((r) => r.claimedAt !== null).map((r) => r.objectiveId));
  return {
    id: questId,
    progress,
    claimed: missions.every((m) => claimedIds.has(m.id)),
    missions: missions.map((m) => ({ id: m.id, title: m.title, metric: m.metric, target: m.target, reward: m.reward, claimed: claimedIds.has(m.id) })),
  };
}

// a Dex reward's trainer title passes the shape check; the route then asks that its reward was claimed
const profileReq = profileRequestFor([...TITLES, ...DEX_TITLES.filter((t) => !TITLES.includes(t))], BODIES.map((b) => b.id));

export function registerMeRoutes(app: FastifyInstance, deps: RestDeps): void {
  const { repos, clock, content } = deps;
  const bearer = { onRequest: requireAuth(deps), preHandler: rateLimit(deps) };

  app.get('/me', bearer, async (req) => {
    const id = req.user.sub;
    const data = await repos.db.transaction(async (tx) => {
      const row = await repos.players.byId(tx, id);
      if (row === null) throw new HttpError(404, 'NotFound');
      return {
        row,
        party: await repos.creatures.party(tx, id),
        box: await repos.creatures.box(tx, id, 0, 500),
        inventory: await repos.inventory.all(tx, id),
        badges: await repos.progress.badges(tx, id),
        flags: await repos.progress.flags(tx, id),
        quests: await repos.progress.allQuests(tx, id),
        claimed: await repos.battlePass.claimedLevels(tx, id),
        mythical: await repos.battlePass.mythicalChoice(tx, id),
        unread: await repos.social.unreadCounts(tx, id),
        friends: await repos.social.friendLists(tx, id),
      };
    });
    const now = clock();
    const presence = deps.presenceStore.get(id);
    const claimedQuests = new Set(Object.entries(data.quests).filter(([, rows]) => rows.length > 0 && rows.every((r) => r.claimedAt !== null)).map(([q]) => q));
    const quests: QuestView[] = QUESTS.filter((q) => claimedQuests.has(q.id) || q.requires.every((r) => claimedQuests.has(r))).map((q) => ({
      id: q.id,
      progress: (data.quests[q.id] ?? []).map((r) => ({ questId: q.id, objectiveId: r.objectiveId, count: r.count, done: r.done })),
      claimed: claimedQuests.has(q.id),
    }));
    // §30.6.3: daily/weekly synthetic quests included
    quests.push(syntheticView(dailyQuestId(dayKey(now)), dailyMissionsFor(dayKey(now)), data.quests));
    quests.push(syntheticView(weeklyQuestId(weekKey(now)), WEEKLY_GOALS, data.quests));
    const res = {
      ...toProfile(data.row),
      party: data.party.map(toInstance),
      box: data.box.map(toInstance),
      inventory: data.inventory,
      badges: data.badges,
      flags: data.flags,
      quests,
      battlePass: { trainerExp: data.row.trainerExp, trainerLevel: trainerLevelFor(data.row.trainerExp), claimed: data.claimed, mythicalChoice: data.mythical, rewards: [...BATTLE_PASS] },
      presence: presence === null ? { roomId: null, zoneId: data.row.zoneId as ZoneId, shard: 0 } : { roomId: presence.roomId, zoneId: presence.zoneId, shard: presence.shard },
      unreadDm: data.unread,
      friendRequests: data.friends.incoming.length,
      // §30.9 summary: day/week keys, weekday variant, login streak + (loose) missions, swarm, events, raid windows
      liveOps: liveOpsSummary(now, liveStreak(data.flags, now)),
    };
    return out(deps, MeRes, res);
  });

  /** §30.2.6: picks/creates the shard and reserves a seat carrying the server-only join ticket. */
  app.post('/zone/enter', bearer, async (req) => {
    const body = ZoneEnterReq.parse(req.body);
    const id = req.user.sub;
    const zone = zoneById(body.zoneId);
    const { row, badges } = await repos.db.transaction(async (tx) => ({ row: await repos.players.byId(tx, id), badges: await repos.progress.badges(tx, id) }));
    if (row === null) throw new HttpError(404, 'NotFound');
    if (zone.gate !== null && !badges.includes(zone.gate)) throw new HttpError(403, 'gated', { badge: zone.gate });
    // R2: the client may enter only the zone it is in (its row, or its live presence); crossings are handovers
    const presence = deps.presenceStore.get(id);
    const present = presence?.zoneId ?? null;
    if (body.zoneId !== row.zoneId && body.zoneId !== present) throw new HttpError(409, 'wrongZone', { zoneId: present ?? row.zoneId });
    // Arena PvP: seated in an arena room still waiting / fighting → 409 inArena (the client rejoins it through
    // POST /arena/rejoin); once that battle has ended the world takes the player back as usual
    const liveArena = await deps.arena.liveRoom(id);
    if (liveArena !== null) throw new HttpError(409, 'inArena', { roomId: liveArena.roomId });
    // P3: during a battle the seat is issued in the battle's own room (a reload rejoins it and gets battleResync
    // on join); any other zone stays 409 inBattle
    if (presence !== null && presence.battleId !== null && presence.arena !== true) {
      if (presence.zoneId !== body.zoneId) throw new HttpError(409, 'inBattle');
      const battleRoom = await zoneRoomById(presence.roomId);
      if (battleRoom !== null) {
        const seat = await reserveZoneSeat(battleRoom, { zoneId: body.zoneId, shard: Number(battleRoom.metadata?.shard ?? 0), ticket: deps.ticket });
        return out(deps, ZoneEnterRes, { seat: { ...seat } });
      }
    }
    const room = await pickZoneRoom(body.zoneId, deps.ticket);
    const seat = await reserveZoneSeat(room, { zoneId: body.zoneId, shard: Number(room.metadata?.shard ?? 0), ticket: deps.ticket });
    return out(deps, ZoneEnterRes, { seat: { ...seat } });
  });

  /**
   * Challenge modes (content challenge.ts): start, change or end a run while there is no badge and nothing has fallen.
   * Every `challenge:` flag is cleared first (the first encounters of the old run included), then the new mode's set.
   */
  app.post('/challenge', bearer, async (req) => {
    const { mode } = ChallengeReq.parse(req.body);
    const id = req.user.sub;
    refuseInBattle(deps, id);
    const now = new Date(deps.clock());
    const flags = await repos.db.transaction(async (tx) => {
      await repos.players.lock(tx, id);
      if ((await repos.progress.badges(tx, id)).length > 0) throw new HttpError(409, 'badges');
      if ((await repos.creatures.byOwner(tx, id)).some((c) => c.ribbons.includes(FALLEN_RIBBON) || c.ribbons.includes(FALLEN_MEMORIAL_RIBBON))) throw new HttpError(409, 'fallen');
      const old = (await repos.progress.flags(tx, id)).filter((f) => f.startsWith('challenge:'));
      if (old.length > 0) await repos.progress.clearFlags(tx, id, old);
      if (mode !== 'normal') await repos.progress.setFlags(tx, id, [CHALLENGE_MODE_FLAG[mode]], now);
      await repos.audit.write(tx, { actorId: id, action: 'challenge.mode', subject: id, detail: { mode } }, now);
      return repos.progress.flags(tx, id);
    });
    return out(deps, ChallengeRes, { flags });
  });

  app.post('/profile', bearer, async (req) => {
    const body = profileReq.parse(req.body);
    const id = req.user.sub;
    const row = await repos.db.transaction(async (tx) => {
      if (body.title !== undefined && !TITLES.includes(body.title) && !dexTitlesOf(await repos.progress.claimedRewards(tx, id)).includes(body.title)) {
        throw new HttpError(403, 'titleLocked');
      }
      await repos.players.setIdentity(tx, id, body);
      return (await repos.players.byId(tx, id))!;
    });
    // §30.5: the room holding the avatar re-reads `body` (PlayerState)
    deps.bus.publish('ewa:profile', { playerId: id });
    return out(deps, PlayerProfileSchema, toProfile(row));
  });

  /**
   * §30.9.1 daily/weekly claim: names the mission (`objectiveId`); the mission must belong to that key's set, be done
   * and unclaimed (409 questIncomplete / AlreadyClaimed); grants that mission's money + items once.
   */
  async function claimMission(questId: string, objectiveId: string | undefined, missions: readonly DailyMission[], id: string) {
    const mission = objectiveId === undefined ? undefined : missions.find((m) => m.id === objectiveId);
    if (mission === undefined) throw new HttpError(404, 'NotFound');
    const now = new Date(clock());
    const res = await repos.db.transaction(async (tx) => {
      await repos.players.lock(tx, id);
      const rows = await repos.progress.quest(tx, id, questId);
      const row = rows.find((r) => r.objectiveId === mission.id);
      if (row === undefined || !row.done) throw new HttpError(409, 'questIncomplete');
      if (!(await repos.progress.claimObjective(tx, id, questId, mission.id, now))) throw new HttpError(409, 'AlreadyClaimed');
      // Majin vs Tenjin seasons: a mission claimed earns the trainer's side its point
      await repos.factions.award(tx, seasonAt(now.getTime()).number, id, FACTION_POINTS.mission);
      const money = mission.reward.money > 0 ? await repos.players.addMoney(tx, id, mission.reward.money) : (await repos.players.byId(tx, id))!.money;
      if (Object.keys(mission.reward.items).length > 0) await repos.inventory.addMany(tx, id, mission.reward.items);
      await repos.audit.write(tx, { actorId: id, action: 'liveops.claim', subject: questId, detail: { mission: mission.id } }, now);
      const progress = await repos.progress.quest(tx, id, questId);
      return {
        inventory: await repos.inventory.all(tx, id),
        money,
        creaturesAdded: [],
        questProgress: progress.map((r) => ({ questId, objectiveId: r.objectiveId, count: r.count, done: r.done })),
      };
    });
    return out(deps, QuestClaimRes, res);
  }

  /** A QuestDef claim requires every objective done; grants money, items, creature (party or box), flag. */
  app.post('/quests/claim', bearer, async (req) => {
    const body = QuestClaimReq.parse(req.body);
    const id = req.user.sub;
    const missions = missionsForQuest(body.questId);
    if (missions !== null) return claimMission(body.questId, body.objectiveId, missions, id);
    let q;
    try {
      q = questById(body.questId);
    } catch (_e) {
      throw new HttpError(404, 'NotFound');
    }
    const quest = q;
    const now = new Date(clock());
    const res = await repos.db.transaction(async (tx) => {
      await repos.players.lock(tx, id);
      const rows = await repos.progress.quest(tx, id, quest.id);
      if (rows.length < quest.objectives.length || rows.some((r) => !r.done)) throw new HttpError(409, 'questIncomplete');
      if (!(await repos.progress.claim(tx, id, quest.id, now))) throw new HttpError(409, 'AlreadyClaimed');
      const money = quest.rewards.money > 0 ? await repos.players.addMoney(tx, id, quest.rewards.money) : (await repos.players.byId(tx, id))!.money;
      if (Object.keys(quest.rewards.items).length > 0) await repos.inventory.addMany(tx, id, quest.rewards.items);
      const creaturesAdded = [];
      if (quest.rewards.creature !== null) {
        const partySize = (await repos.creatures.party(tx, id)).length;
        const c = newCreature(content, quest.rewards.creature.species, quest.rewards.creature.level, { ownerId: id });
        const records = await repos.creatures.byOwner(tx, id);
        const used = new Set(records.filter((r) => r.slotKind === 'party').map((r) => r.slotIndex));
        let idx = 0;
        while (used.has(idx)) idx++;
        creaturesAdded.push(toInstance(await repos.creatures.insert(tx, c, partySize < 6 ? { kind: 'party', index: idx } : { kind: 'box', index: 'nextBox' })));
        await repos.progress.markCaught(tx, id, quest.rewards.creature.species, 'normal', false, now);
      }
      if (quest.rewards.flag !== null) await repos.progress.setFlags(tx, id, [quest.rewards.flag], now);
      await repos.players.addTrainerExp(tx, id, TRAINER_EXP.questComplete);
      await repos.audit.write(tx, { actorId: id, action: 'quest.claim', subject: quest.id, detail: {} }, now);
      const progress = await repos.progress.quest(tx, id, quest.id);
      return {
        inventory: await repos.inventory.all(tx, id),
        money,
        creaturesAdded,
        questProgress: progress.map((r) => ({ questId: quest.id, objectiveId: r.objectiveId, count: r.count, done: r.done })),
      };
    });
    return out(deps, QuestClaimRes, res);
  });
}
