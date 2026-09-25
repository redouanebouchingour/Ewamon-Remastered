/**
 * §4.7 admin rows (stats, players search, metrics, ban/unban) and GET /health. Admin = bearer + `is_admin` re-read
 * from the row (never the token's `adm` claim).
 */
import { AdminPlayersQuery, AdminPlayersRes, AdminStatsRes, BanReq, HealthRes, UnbanReq } from '@ewa/protocol';
import type { FastifyInstance } from 'fastify';
import { HttpError, iso, out, rateLimit, requireAdmin } from '../http';
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

  /** §30.10.2 ProcessMetrics: per-room rates/percentiles, REST per route, presence size, heap. */
  app.get('/admin/metrics', admin, async () => deps.metrics.snapshot(deps.presenceStore.size));

  /** Legacy counters (spec TODO: no body listed): players total/banned/admins, online, rooms, live battles/raids. */
  app.get('/admin/stats', admin, async () => {
    const c = await repos.db.transaction((tx) => repos.players.counts(tx));
    const rooms = deps.metrics.all();
    return out(deps, AdminStatsRes, {
      total: c.total,
      banned: c.banned,
      online: deps.presenceStore.size,
      admins: c.admins,
      rooms: rooms.length,
      battles: rooms.reduce((n, r) => n + r.battles, 0),
      raids: rooms.filter((r) => r.raid).length,
    });
  });

  /** `ILIKE '%' || escapeLike(q) || '%' ESCAPE ''` on username_lower (persist `players.search`), page of 25. */
  app.get('/admin/players', admin, async (req) => {
    const q = AdminPlayersQuery.parse(req.query);
    const r = await repos.db.transaction((tx) => repos.players.search(tx, (q.q ?? '').slice(0, 32), q.page, 25));
    return out(deps, AdminPlayersRes, {
      rows: r.rows.map((p) => ({
        id: p.id,
        username: p.username,
        email: p.email,
        isAdmin: p.isAdmin,
        bannedAt: p.bannedAt === null ? null : iso(p.bannedAt),
        banReason: p.banReason,
        createdAt: iso(p.createdAt),
        lastSeenAt: iso(p.lastSeenAt),
      })),
      total: r.total,
    });
  });

  app.get('/health', async () => HealthRes.parse({ status: 'ok', time: clock() }));
}
