/**
 * Camp bases (content camps.ts, game/camps.ts, SPEC §3.19). GET /camps: the camp of the zone the caller stands in (and
 * who holds it, with what a raid would meet now), their own camp, the trophies they earned, their camp log and every
 * held camp. POST /camps/edit: a new banner name (filtered like chat: blocked words are refused) and / or trophies
 * (ids from `earned`, at most three). POST /camps/abandon. Claiming and raiding happen at the campfire (the zone room's
 * `camp` message). Every change tells the zone rooms (`CAMP_TOPIC`). CAMPS=off: nothing to read, edits refused.
 */
import { CAMP_NAME_MAX, CAMP_TROPHY_SLOTS, campLogLine, campOf, challengeActive } from '@ewa/content';
import type { Trophy } from '@ewa/content';
import { CampEditReq, CampsRes } from '@ewa/protocol';
import type { CampsView, CampView } from '@ewa/protocol';
import type { Camp, Tx } from '@ewa/persist';
import type { FastifyInstance } from 'fastify';
import { containsBlocked, sanitizeChat } from '../../chat/filter';
import { CAMP_TOPIC, campView, earnedTrophies, raidedToday } from '../../game/camps';
import { CHAMPION_FLAG } from '../../rooms/battleSession';
import { HttpError, out, presenceZone, rateLimit, refuseInBattle, requireAuth } from '../http';
import type { RestDeps } from '../http';

export function registerCampRoutes(app: FastifyInstance, deps: RestDeps): void {
  const { repos, clock } = deps;
  const bearer = { onRequest: requireAuth(deps), preHandler: rateLimit(deps) };
  const enabled = (): boolean => deps.env.CAMPS === 'on';

  async function seen(tx: Tx, c: Camp, viewerId: string, nowMs: number): Promise<CampView> {
    if (c.ownerId === viewerId) return campView(c, viewerId, { ownerOnline: true, ownerInRun: false, ownerLastSeenMs: null, raidedToday: false, ownerMoney: 0 }, nowMs);
    const owner = await repos.players.byId(tx, c.ownerId);
    const ownerInRun = challengeActive(await repos.progress.flags(tx, c.ownerId)) !== null;
    return campView(
      c,
      viewerId,
      {
        ownerOnline: (await deps.presenceMirror.lookup(c.ownerId)) !== null,
        ownerInRun,
        ownerLastSeenMs: owner?.lastSeenAt.getTime() ?? null,
        raidedToday: await raidedToday(repos, tx, viewerId, c.zoneId, nowMs),
        ownerMoney: owner?.money ?? 0,
      },
      nowMs,
    );
  }

  async function view(tx: Tx, id: string, nowMs: number): Promise<CampsView> {
    const me = (await repos.players.byId(tx, id))!;
    const flags = await repos.progress.flags(tx, id);
    const you = { inRun: challengeActive(flags) !== null, money: me.money };
    if (!enabled()) return { enabled: false, here: null, mine: null, earned: [], log: [], camps: [], you };
    const zone = presenceZone(deps, id);
    let here: CampsView['here'] = null;
    if (zone !== null && campOf(zone.id) !== null) {
      const c = await repos.camps.of(tx, zone.id);
      here = { zoneId: zone.id, camp: c === null ? null : await seen(tx, c, id, nowMs) };
    }
    const mineRow = await repos.camps.byOwner(tx, id);
    const earned = await earnedTrophies(repos, tx, deps.content, id, flags.includes(CHAMPION_FLAG));
    const log = (await repos.camps.log(tx, id, 20)).map((r) => ({
      zoneId: r.zoneId,
      raider: r.raiderName,
      won: r.won,
      cut: r.cut,
      tookOver: r.tookOver,
      line: campLogLine({ raider: r.raiderName, won: r.won, cut: r.cut, tookOver: r.tookOver }),
      at: r.at.toISOString(),
    }));
    const camps = (await repos.camps.all(tx)).slice(0, 32).map((c) => ({ zoneId: c.zoneId, owner: c.ownerName, name: c.name }));
    return { enabled: true, here, mine: mineRow === null ? null : await seen(tx, mineRow, id, nowMs), earned, log, camps, you };
  }

  app.get('/camps', bearer, async (req) => {
    const now = clock();
    return out(deps, CampsRes, await repos.db.transaction((tx) => view(tx, req.user.sub, now)));
  });

  app.post('/camps/edit', bearer, async (req) => {
    const body = CampEditReq.parse(req.body);
    const id = req.user.sub;
    if (!enabled()) throw new HttpError(409, 'campsOff');
    refuseInBattle(deps, id);
    let name: string | undefined;
    if (body.name !== undefined) {
      const clean = sanitizeChat(body.name, CAMP_NAME_MAX);
      if (clean === null) throw new HttpError(400, 'invalidPayload');
      if (containsBlocked(clean)) throw new HttpError(400, 'blockedWord');
      name = clean;
    }
    const nowMs = clock();
    const res = await repos.db.transaction(async (tx) => {
      await repos.players.lock(tx, id);
      const mine = await repos.camps.byOwner(tx, id);
      if (mine === null) throw new HttpError(409, 'noCamp');
      let trophies: Trophy[] | undefined;
      if (body.trophies !== undefined) {
        const ids = body.trophies;
        if (new Set(ids).size !== ids.length || ids.length > CAMP_TROPHY_SLOTS) throw new HttpError(409, 'badTrophy');
        const flags = await repos.progress.flags(tx, id);
        const earned = new Map((await earnedTrophies(repos, tx, deps.content, id, flags.includes(CHAMPION_FLAG))).map((t) => [t.id, t]));
        trophies = ids.map((t) => {
          const got = earned.get(t);
          if (got === undefined) throw new HttpError(409, 'badTrophy');
          return got;
        });
      }
      const now = new Date(nowMs);
      await repos.camps.edit(tx, id, { ...(name !== undefined ? { name } : {}), ...(trophies !== undefined ? { trophies } : {}) }, now);
      await repos.audit.write(tx, { actorId: id, action: 'camp.edit', subject: mine.zoneId, detail: { name: name ?? null, trophies: trophies?.map((t) => t.id) ?? null } }, now);
      return { zoneId: mine.zoneId, view: await view(tx, id, nowMs) };
    });
    deps.bus.publish(CAMP_TOPIC, { zoneId: res.zoneId });
    return out(deps, CampsRes, res.view);
  });

  app.post('/camps/abandon', bearer, async (req) => {
    const id = req.user.sub;
    if (!enabled()) throw new HttpError(409, 'campsOff');
    refuseInBattle(deps, id);
    const nowMs = clock();
    const res = await repos.db.transaction(async (tx) => {
      const gone = await repos.camps.abandon(tx, id);
      if (gone === null) throw new HttpError(409, 'noCamp');
      await repos.audit.write(tx, { actorId: id, action: 'camp.abandon', subject: gone.zoneId, detail: {} }, new Date(nowMs));
      return { zoneId: gone.zoneId, view: await view(tx, id, nowMs) };
    });
    deps.bus.publish(CAMP_TOPIC, { zoneId: res.zoneId });
    return out(deps, CampsRes, res.view);
  });
}
