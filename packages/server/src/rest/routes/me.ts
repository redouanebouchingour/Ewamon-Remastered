/**
 * §4.7 rows: GET /me, POST /zone/enter, POST /profile, POST /quests/claim.
 */
import { BATTLE_PASS, BODIES, QUESTS, TITLES, WEEKDAY_VARIANT, quest as questById, zone as zoneById } from '@ewa/content';
import type { Weekday } from '@ewa/content';
import { TRAINER_EXP, trainerLevelFor } from '@ewa/core';
import { MeRes, PlayerProfileSchema, QuestClaimReq, QuestClaimRes, ZoneEnterReq, ZoneEnterRes, profileRequestFor } from '@ewa/protocol';
import type { QuestView, ZoneId } from '@ewa/protocol';
import type { FastifyInstance } from 'fastify';
import { newCreature } from '../../game/creatures';
import { pickZoneRoom, reserveZoneSeat } from '../../rooms/matchmaking';
import { toInstance } from '../../rooms/battleSession';
import { HttpError, out, rateLimit, requireAuth, toProfile } from '../http';
import type { RestDeps } from '../http';

/** UTC calendar day key `YYYY-MM-DD`. */
export function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** ISO week key `YYYY-Www` (Monday 00:00 UTC). */
export function weekKey(ms: number): string {
  const d = new Date(ms);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  const thursday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day + 3));
  const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((thursday.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

const profileReq = profileRequestFor(TITLES, BODIES.map((b) => b.id));

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
      // §30.9 summary — part 2 (live-ops) fills missions, swarms, events and the login streak
      liveOps: { dayKey: dayKey(now), weekKey: weekKey(now), weekdayVariant: WEEKDAY_VARIANT[new Date(now).getUTCDay() as Weekday], loginStreak: 0 },
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
    if (deps.presenceStore.battleOf(id) !== null) throw new HttpError(409, 'inBattle');
    // R2: the client may enter only the zone it is in (its row, or its live presence); crossings are handovers
    const present = deps.presenceStore.get(id)?.zoneId ?? null;
    if (body.zoneId !== row.zoneId && body.zoneId !== present) throw new HttpError(409, 'wrongZone', { zoneId: present ?? row.zoneId });
    const room = await pickZoneRoom(body.zoneId, deps.ticket);
    const seat = await reserveZoneSeat(room, { zoneId: body.zoneId, shard: Number(room.metadata?.shard ?? 0), ticket: deps.ticket });
    return out(deps, ZoneEnterRes, { seat: { ...seat } });
  });

  app.post('/profile', bearer, async (req) => {
    const body = profileReq.parse(req.body);
    const id = req.user.sub;
    const row = await repos.db.transaction(async (tx) => {
      await repos.players.setIdentity(tx, id, body);
      return (await repos.players.byId(tx, id))!;
    });
    // part 2: presence.publish('ewa:profile', …) so rooms re-read `body`
    return out(deps, PlayerProfileSchema, toProfile(row));
  });

  /** A QuestDef claim requires every objective done; grants money, items, creature (party or box), flag. */
  app.post('/quests/claim', bearer, async (req) => {
    const body = QuestClaimReq.parse(req.body);
    const id = req.user.sub;
    if (body.questId.startsWith('daily:') || body.questId.startsWith('weekly:')) throw new HttpError(404, 'NotFound'); // part 2 (live-ops)
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
