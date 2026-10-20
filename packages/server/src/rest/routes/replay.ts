/**
 * Battle replays: POST /history/battles/:battleId/share gives one of the player's battles a public token (the same token
 * on every later share); GET /replay/:token serves the anonymised replay to anyone (no account, rate limited per ip).
 * The replay is frozen at share time (game/replay.ts), so a share needs neither the history row nor the sharer later.
 */
import { randomBytes } from 'node:crypto';
import { BattleShareParams, BattleShareRes, ReplayParams, ReplayRes } from '@ewa/protocol';
import type { FastifyInstance } from 'fastify';
import { shareableReplay } from '../../game/replay';
import { HttpError, out, rateLimit, requireAuth } from '../http';
import type { RestDeps } from '../http';

/** 9 random bytes as 12 url-safe characters */
export function newShareToken(): string {
  return randomBytes(9).toString('base64url');
}

export function registerReplayRoutes(app: FastifyInstance, deps: RestDeps): void {
  const { repos } = deps;
  const bearer = { onRequest: requireAuth(deps), preHandler: rateLimit(deps) };

  app.post('/history/battles/:battleId/share', bearer, async (req) => {
    const { battleId } = BattleShareParams.parse(req.params);
    const id = req.user.sub;
    const now = new Date(deps.clock());
    const token = await repos.db.transaction(async (tx) => {
      const existing = await repos.history.shareOf(tx, id, battleId);
      if (existing !== null) return existing.token;
      const row = await repos.history.battleById(tx, id, battleId);
      if (row === null) throw new HttpError(404, 'notFound');
      const me = await repos.players.byId(tx, id);
      if (me === null) throw new HttpError(404, 'notFound');
      const replay = shareableReplay(row, me.username, deps.content);
      if (replay === 'notReplayable' || replay === 'stale') throw new HttpError(409, replay);
      // a fresh token that collides with another share comes back null: try another (2^72 tokens, so twice is plenty)
      for (let attempt = 0; attempt < 3; attempt++) {
        const share = await repos.history.createShare(tx, { token: newShareToken(), playerId: id, battleId, replay }, now);
        if (share !== null) {
          await repos.audit.write(tx, { actorId: id, action: 'battle.share', subject: battleId, detail: { token: share.token } }, now);
          return share.token;
        }
      }
      throw new HttpError(503, 'tokenCollision');
    });
    return out(deps, BattleShareRes, { token });
  });

  app.get('/replay/:token', { preHandler: rateLimit(deps, 'replay', 'ip') }, async (req) => {
    const { token } = ReplayParams.parse(req.params);
    const share = await repos.db.transaction((tx) => repos.history.shareByToken(tx, token));
    if (share === null) throw new HttpError(404, 'notFound');
    return out(deps, ReplayRes, { token: share.token, ...share.replay } as never);
  });
}
