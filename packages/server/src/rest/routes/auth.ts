/**
 * §30.6.2 / §4.7 auth rows: register, login, refresh, logout; Phase C6 forgot / reset / verify / resend.
 */
import { visitedFlag } from '@ewa/content';
import type { ZoneId } from '@ewa/content';
import { AuthRes, ForgotReq, LoginReq, LogoutReq, RefreshReq, RefreshRes, RegisterReq, ResetReq, VerifyReq } from '@ewa/protocol';
import { isPersistError } from '@ewa/persist';
import type { FastifyInstance } from 'fastify';
import { newCreature } from '../../game/creatures';
import { dailyLogin } from '../../liveops/login';
import { RESET_TTL_MS, VERIFY_TTL_MS, deliver, resetEmail, verifyEmail } from '../../mail/mailer';
import { dummyHash, hashPassword, issueTokens, rotateTokens, verifyPassword } from '../auth';
import { HttpError, out, rateLimit, requireAuth, toProfile } from '../http';
import type { RestDeps } from '../http';

/** Starter kit (§30.6.2): level 5, species default moves, ability index 0, full hp; potion ×5, spark_orb ×10. */
export const STARTER_LEVEL = 5;
export const STARTER_ITEMS: Readonly<Record<string, number>> = { potion: 5, spark_orb: 10 };

export function registerAuthRoutes(app: FastifyInstance, deps: RestDeps): void {
  const { repos, content, clock } = deps;

  app.post('/auth/register', { preHandler: rateLimit(deps, 'register', 'ip') }, async (req) => {
    const body = RegisterReq.parse(req.body);
    const passwordHash = await hashPassword(body.password);
    const now = new Date(clock());
    try {
      const created = await repos.db.transaction(async (tx) => {
        const { id } = await repos.players.create(tx, { username: body.username, email: body.email.toLowerCase(), passwordHash }, now);
        await repos.creatures.insert(tx, newCreature(content, body.starter, STARTER_LEVEL, { ownerId: id, moves: 'default' }), { kind: 'party', index: 0 });
        await repos.inventory.addMany(tx, id, STARTER_ITEMS);
        await repos.progress.markSeen(tx, id, body.starter, now);
        await repos.progress.markCaught(tx, id, body.starter, 'normal', false, now);
        await repos.audit.write(tx, { actorId: id, action: 'auth.register', subject: id, detail: { starter: body.starter } }, now);
        // registration is the account's first login: day 1 of the streak (§30.9.1, IMPLEMENTATION-NOTES Q13)
        await dailyLogin(tx, repos, id, now.getTime());
        const row = (await repos.players.byId(tx, id))!;
        // Phase C3: the starting zone counts as visited from the first moment (the room writes it on any later first join)
        await repos.progress.setFlags(tx, id, [visitedFlag(row.zoneId as ZoneId)], now);
        const tokens = await issueTokens(tx, repos, app, { id, username: row.username, isAdmin: row.isAdmin }, now);
        // Phase C6: a verification link (never gates play); sent after the response, never awaited
        const verify = await repos.auth.issueEmailToken(tx, id, 'verify', VERIFY_TTL_MS, now);
        return { res: out(deps, AuthRes, { ...tokens, player: toProfile(row) }), mail: verifyEmail(deps.env, row.email, row.username, verify.token) };
      });
      deliver(deps.mailer, req.log, created.mail);
      return created.res;
    } catch (e) {
      // duplicate username/email → 409 { code: 'taken', field } (mapped from the unique check, never pre-checked)
      if (isPersistError(e, 'UsernameTaken')) throw new HttpError(409, 'taken', { field: 'username' });
      if (isPersistError(e, 'EmailTaken')) throw new HttpError(409, 'taken', { field: 'email' });
      throw e;
    }
  });

  app.post('/auth/login', { preHandler: rateLimit(deps, 'login', 'ip') }, async (req) => {
    const body = LoginReq.parse(req.body);
    const lower = body.username.toLowerCase();
    if (!(await deps.limiter.allow(`user:${lower}`, 'login'))) throw new HttpError(429, 'rateLimited', { retryAfterS: 900 });
    const row = await repos.db.transaction((tx) => repos.players.byUsername(tx, lower));
    // a missing row still runs verifyPassword against a fixed dummy PHC (no timing oracle)
    const ok = await verifyPassword(row?.passwordHash ?? (await dummyHash()), body.password);
    if (row === null || !ok) throw new HttpError(401, 'badCredentials');
    if (row.bannedAt !== null || deps.bans.isBanned(row.id)) throw new HttpError(403, 'banned', { reason: row.banReason });
    const now = new Date(clock());
    return repos.db.transaction(async (tx) => {
      await repos.players.touchLastSeen(tx, row.id, now);
      // §30.9.1: the first login of a UTC day grants dailyLogin exp + the streak reward (once, under the row lock)
      await dailyLogin(tx, repos, row.id, now.getTime());
      const tokens = await issueTokens(tx, repos, app, { id: row.id, username: row.username, isAdmin: row.isAdmin }, now);
      const fresh = (await repos.players.byId(tx, row.id))!;
      return out(deps, AuthRes, { ...tokens, player: toProfile(fresh) });
    });
  });

  app.post('/auth/refresh', { preHandler: rateLimit(deps, 'refresh', 'ip') }, async (req) => {
    const body = RefreshReq.parse(req.body);
    const now = new Date(clock());
    // the tx commits either way so a reuse's revokeAll + audit persist; the 401 is answered after commit
    const r = await repos.db.transaction((tx) => rotateTokens(tx, repos, app, body.refresh, now));
    if (!r.ok) throw new HttpError(401, r.reuse ? 'refreshReuse' : 'badRefresh');
    return out(deps, RefreshRes, r.tokens);
  });

  // ---- Phase C6: password reset + email verification ------------------------------------------------------------

  /**
   * Always 204, whether or not the address belongs to an account (no enumeration). 5/h per IP (429), and at most
   * 3 reset mails per address per hour (over it the 204 is still answered, nothing is sent). A banned account gets
   * no mail. The newest link supersedes earlier ones.
   */
  app.post('/auth/forgot', { preHandler: rateLimit(deps, 'forgot', 'ip') }, async (req, reply) => {
    const body = ForgotReq.parse(req.body);
    const email = body.email.trim().toLowerCase();
    if (await deps.limiter.allow(`email:${email}`, 'forgotEmail')) {
      const now = new Date(clock());
      const mail = await repos.db.transaction(async (tx) => {
        const row = await repos.players.byEmail(tx, email);
        if (row === null || row.bannedAt !== null) return null;
        const { token } = await repos.auth.issueEmailToken(tx, row.id, 'reset', RESET_TTL_MS, now);
        await repos.audit.write(tx, { actorId: row.id, action: 'auth.forgot', subject: row.id, detail: {} }, now);
        return resetEmail(deps.env, row.email, row.username, token);
      });
      if (mail !== null) deliver(deps.mailer, req.log, mail);
    }
    return reply.status(204).send();
  });

  /**
   * Consumes a reset token, sets the new argon2id hash, revokes EVERY refresh token of the account (all devices sign
   * in again; live access tokens lapse within their 15 min), and marks the email verified (the link proved it).
   * 400 `{ code: 'badToken', reason: 'unknown' | 'expired' | 'used' }`.
   */
  app.post('/auth/reset', { preHandler: rateLimit(deps, 'emailToken', 'ip') }, async (req, reply) => {
    const body = ResetReq.parse(req.body);
    const passwordHash = await hashPassword(body.password);
    const now = new Date(clock());
    await repos.db.transaction(async (tx) => {
      const r = await repos.auth.consumeEmailToken(tx, body.token, 'reset', now);
      if (!r.ok) throw new HttpError(400, 'badToken', { reason: r.reason });
      await repos.players.setPasswordHash(tx, r.playerId, passwordHash);
      const revoked = await repos.auth.revokeAll(tx, r.playerId, now);
      await repos.players.markEmailVerified(tx, r.playerId, now);
      await repos.audit.write(tx, { actorId: r.playerId, action: 'auth.passwordReset', subject: r.playerId, detail: { revoked } }, now);
    });
    return reply.status(204).send();
  });

  /** Consumes a verification token and stamps `email_verified_at` (kept if already set). Same 400 as reset. */
  app.post('/auth/verify', { preHandler: rateLimit(deps, 'emailToken', 'ip') }, async (req, reply) => {
    const body = VerifyReq.parse(req.body);
    const now = new Date(clock());
    await repos.db.transaction(async (tx) => {
      const r = await repos.auth.consumeEmailToken(tx, body.token, 'verify', now);
      if (!r.ok) throw new HttpError(400, 'badToken', { reason: r.reason });
      if (await repos.players.markEmailVerified(tx, r.playerId, now)) {
        await repos.audit.write(tx, { actorId: r.playerId, action: 'auth.emailVerified', subject: r.playerId, detail: {} }, now);
      }
    });
    return reply.status(204).send();
  });

  /** A fresh verification link for the signed-in player: 3/h per player; 409 `alreadyVerified` once verified. */
  app.post('/auth/resend', { onRequest: requireAuth(deps), preHandler: rateLimit(deps, 'resend') }, async (req, reply) => {
    const now = new Date(clock());
    const mail = await repos.db.transaction(async (tx) => {
      const row = await repos.players.byId(tx, req.user.sub);
      if (row === null) throw new HttpError(404, 'NotFound');
      if (row.emailVerifiedAt !== null) throw new HttpError(409, 'alreadyVerified');
      const { token } = await repos.auth.issueEmailToken(tx, row.id, 'verify', VERIFY_TTL_MS, now);
      return verifyEmail(deps.env, row.email, row.username, token);
    });
    deliver(deps.mailer, req.log, mail);
    return reply.status(204).send();
  });

  app.post('/auth/logout', { onRequest: requireAuth(deps), preHandler: rateLimit(deps) }, async (req, reply) => {
    const body = LogoutReq.parse(req.body);
    const now = new Date(clock());
    await repos.db.transaction(async (tx) => {
      const owner = await repos.auth.ownerOf(tx, body.refresh);
      if (owner !== null && owner.playerId === req.user.sub) await repos.auth.revoke(tx, body.refresh, now);
    });
    return reply.status(204).send();
  });
}
