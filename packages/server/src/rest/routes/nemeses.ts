/**
 * Nemeses (content nemesis.ts, game/nemesis.ts): GET /nemeses, the caller's active nemeses, newest first: who they are,
 * their scar, the move they gained, their rank, where they rose and were last met, and what they remember.
 */
import { NEMESIS_MAX } from '@ewa/content';
import type { NemesisScar } from '@ewa/content';
import { NemesesRes } from '@ewa/protocol';
import type { FastifyInstance } from 'fastify';
import { out, rateLimit, requireAuth } from '../http';
import type { RestDeps } from '../http';

export function registerNemesisRoutes(app: FastifyInstance, deps: RestDeps): void {
  const { repos } = deps;
  const bearer = { onRequest: requireAuth(deps), preHandler: rateLimit(deps) };

  app.get('/nemeses', bearer, async (req) => {
    const rows = await repos.db.transaction((tx) => repos.nemeses.active(tx, req.user.sub));
    return out(deps, NemesesRes, {
      nemeses: rows.slice(0, 10).map((n) => ({
        id: n.id,
        name: n.name,
        title: n.title,
        speciesId: n.speciesId,
        level: n.level,
        isShiny: n.isShiny,
        scar: n.scar as NemesisScar,
        move: n.move,
        rank: n.rank,
        bornZone: n.bornZone,
        lastZone: n.lastZone,
        lastSeenAt: n.updatedAt.toISOString(),
        memory: { ...n.memory },
      })),
      max: NEMESIS_MAX,
    });
  });
}
