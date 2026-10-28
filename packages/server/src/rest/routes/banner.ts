/**
 * Trainer banners (content `data/banners.ts`, `game/banner.ts`).
 *
 * - `GET /banner`: the saved pick (the default without one) and the counts the editor shows the locks from.
 * - `POST /banner` { frame, backdrop, pins, trackers, featuredId }: saved when every id is known and unlocked (403
 *   `bannerLocked` with content `bannerRefusal`'s reason otherwise) and the featured creature is the trainer's (404
 *   `NotFound`). The zone room holding the avatar re-reads the frame for the nameplate (`ewa:profile`). Audit row
 *   `banner.save`.
 */
import { bannerRefusal } from '@ewa/content';
import { BannerChoiceSchema, BannerRes } from '@ewa/protocol';
import type { FastifyInstance } from 'fastify';
import { bannerStatsOf, choiceOf } from '../../game/banner';
import { HttpError, out, rateLimit, requireAuth } from '../http';
import type { RestDeps } from '../http';

export function registerBannerRoutes(app: FastifyInstance, deps: RestDeps): void {
  const { repos, clock } = deps;
  const bearer = { onRequest: requireAuth(deps), preHandler: rateLimit(deps) };

  app.get('/banner', bearer, async (req) => {
    const id = req.user.sub;
    const res = await repos.db.transaction(async (tx) => {
      const stats = await bannerStatsOf(repos, tx, id);
      if (stats === null) throw new HttpError(404, 'NotFound');
      return { choice: choiceOf(await repos.banners.get(tx, id)), stats };
    });
    return out(deps, BannerRes, res);
  });

  app.post('/banner', bearer, async (req) => {
    const choice = BannerChoiceSchema.parse(req.body);
    const id = req.user.sub;
    const now = new Date(clock());
    const res = await repos.db.transaction(async (tx) => {
      const stats = await bannerStatsOf(repos, tx, id);
      if (stats === null) throw new HttpError(404, 'NotFound');
      const refusal = bannerRefusal(choice, stats);
      if (refusal !== null) throw new HttpError(403, 'bannerLocked', { reason: refusal });
      if (choice.featuredId !== null && (await repos.creatures.byId(tx, choice.featuredId))?.ownerId !== id) throw new HttpError(404, 'NotFound');
      await repos.banners.set(tx, id, choice, now);
      await repos.audit.write(tx, { actorId: id, action: 'banner.save', subject: id, detail: { frame: choice.frame, backdrop: choice.backdrop } }, now);
      return { choice, stats };
    });
    deps.bus.publish('ewa:profile', { playerId: id });
    return out(deps, BannerRes, res);
  });
}
