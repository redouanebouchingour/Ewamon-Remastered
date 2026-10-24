/**
 * The rumour board (LLM feature 8, game/rumours.ts): `GET /world/rumours/:zoneId` for a town (404 elsewhere), the
 * town's facts of the UTC day: the world's part built once per day and town and cached (`RumourBoard`), the caller's
 * gossip (feature 1's deeds in that town) read per call. Read-only: nothing here touches a save, so there is no audit
 * row. Behind `NPC_TOOLS` with the rest of the LLM features (409 `npcToolsOff`): the board's words come from the
 * model, and its gossip from NPC memory.
 */
import { hasRumourBoard } from '@ewa/content';
import type { ZoneId } from '@ewa/content';
import { RumourParams, RumoursRes } from '@ewa/protocol';
import type { FastifyInstance } from 'fastify';
import { dayKey } from '../../liveops/schedule';
import { RumourBoard, buildRumours, gatherWorld, gossipRumours, placeName } from '../../game/rumours';
import { HttpError, out, rateLimit, requireAuth } from '../http';
import type { RestDeps } from '../http';

export function registerRumourRoutes(app: FastifyInstance, deps: RestDeps, on: boolean): RumourBoard {
  const { repos, clock } = deps;
  const bearer = { onRequest: requireAuth(deps), preHandler: rateLimit(deps) };
  const board = new RumourBoard();

  app.get('/world/rumours/:zoneId', bearer, async (req) => {
    const { zoneId } = RumourParams.parse(req.params);
    if (!on) throw new HttpError(409, 'npcToolsOff');
    if (!hasRumourBoard(zoneId)) throw new HttpError(404, 'NotFound');
    const town = zoneId as ZoneId;
    const id = req.user.sub;
    const now = clock();
    const world = await board.get(town, now, (start) =>
      repos.db.transaction(async (tx) => buildRumours(town, start, deps.worldSeed, await gatherWorld(repos, tx, town, start, now, deps.env.ECOSYSTEM === 'on'))),
    );
    const mine = await repos.db.transaction(async (tx) => {
      const me = await repos.players.byId(tx, id);
      return gossipRumours(town, me?.username ?? 'a traveller', await repos.npcMemory.inZone(tx, id, town));
    });
    return out(deps, RumoursRes, { zoneId: town, town: placeName(town), day: dayKey(now), facts: [...world, ...mine] });
  });
  return board;
}
