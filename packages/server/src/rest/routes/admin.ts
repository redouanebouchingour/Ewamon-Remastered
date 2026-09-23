/**
 * §4.7 admin rows (bans + metrics) and GET /health. `/admin/stats` and `/admin/players` (search with
 * escapeLike) are part 2 (observability) — they need persist count/search methods that do not exist yet.
 */
import { BanReq, HealthRes, UnbanReq } from '@ewa/protocol';
import type { FastifyInstance } from 'fastify';
import { HttpError, rateLimit, requireAdmin } from '../http';
import type { RestDeps } from '../http';

export function registerAdminRoutes(app: FastifyInstance, deps: RestDeps, publishKick: (playerId: string) => void): void {
  const { repos, clock } = deps;
  const admin = { onRequest: requireAdmin(deps), preHandler: rateLimit(deps) };

  /** Ban: banned_at/ban_reason, revoke refresh tokens, drop from every room within one tick, audit. Admins cannot be banned (409). */
  app.post('/admin/ban', admin, async (req, reply) => {
    const body = BanReq.parse(req.body);
    const now = new Date(clock());
    const targetId = await repos.db.transaction(async (tx) => {
      const target = await repos.players.byUsername(tx, body.username.toLowerCase());
      if (target === null) throw new HttpError(404, 'NotFound');
      if (target.isAdmin) throw new HttpError(409, 'adminNotBannable');
      await repos.players.ban(tx, target.id, body.reason, now);
      await repos.auth.revokeAll(tx, target.id, now);
      await repos.audit.write(tx, { actorId: req.user.sub, action: 'admin.ban', subject: target.id, detail: { reason: body.reason } }, now);
      return target.id;
    });
    deps.bans.add(targetId);
    publishKick(targetId);
    return reply.status(204).send();
  });

  app.post('/admin/unban', admin, async (req, reply) => {
    const body = UnbanReq.parse(req.body);
    const now = new Date(clock());
    const targetId = await repos.db.transaction(async (tx) => {
      const target = await repos.players.byUsername(tx, body.username.toLowerCase());
      if (target === null) throw new HttpError(404, 'NotFound');
      await repos.players.unban(tx, target.id);
      await repos.audit.write(tx, { actorId: req.user.sub, action: 'admin.unban', subject: target.id, detail: {} }, now);
      return target.id;
    });
    deps.bans.remove(targetId);
    return reply.status(204).send();
  });

  /** §30.10.2 — the counters part 1 keeps; part 2 adds rates, REST and DB figures. */
  app.get('/admin/metrics', admin, async () => {
    return {
      rooms: deps.metrics.all().map((m) => ({ ...m })),
      rest: {},
      db: { txPerSec: 0, txP99Ms: 0, poolInUse: 0 },
      presenceSize: deps.presenceStore.size,
      heapMb: Math.round((process.memoryUsage().heapUsed / 1048576) * 10) / 10,
    };
  });

  app.get('/health', async () => HealthRes.parse({ status: 'ok', time: clock() }));
}
