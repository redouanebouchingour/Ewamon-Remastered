/**
 * A recurring rival (content rival.ts, game/rival.ts), behind its own `RIVAL` env flag (it changes the world, not only
 * NPC talk, so it does not ride `NPC_TOOLS`).
 *
 * - `GET /rival`: who the rival is, its arc, the record, the last meeting (with its parting words) and the team it
 *   brought; `rival` stays null until the first meeting; `enabled` false with `RIVAL=off`.
 * - `POST /rival/words` { text }: the parting line the player saw (the client's model or its template), kept once per
 *   meeting within `RIVAL_WORDS_WINDOW_MS` of it (409 `rivalNoMeeting` otherwise; 409 `rivalOff`). Stored as said,
 *   cleaned (one line, no em-dash); flavour only, nothing reads it but the Profile. Audit row `rival.words`.
 */
import { RIVAL_WORDS_MAX, RIVAL_WORDS_WINDOW_MS } from '@ewa/content';
import { RivalRes, RivalWordsReq } from '@ewa/protocol';
import type { RivalState } from '@ewa/protocol';
import type { Repos, Tx } from '@ewa/persist';
import type { FastifyInstance } from 'fastify';
import { cleanWords, rivalView } from '../../game/rival';
import { HttpError, out, rateLimit, requireAuth } from '../http';
import type { RestDeps } from '../http';

async function stateOf(repos: Repos, tx: Tx, playerId: string): Promise<RivalState> {
  const r = await repos.rivals.of(tx, playerId);
  if (r === null || r.meetings === 0) return { enabled: true, rival: null };
  const badges = (await repos.progress.badges(tx, playerId)).length;
  return { enabled: true, rival: rivalView(r, badges, r.lastTeam) };
}

export function registerRivalRoutes(app: FastifyInstance, deps: RestDeps): void {
  const { repos, clock } = deps;
  const bearer = { onRequest: requireAuth(deps), preHandler: rateLimit(deps) };
  const on = (): boolean => deps.env.RIVAL !== 'off';

  app.get('/rival', bearer, async (req) => {
    if (!on()) return out(deps, RivalRes, { enabled: false, rival: null });
    return out(deps, RivalRes, await repos.db.transaction((tx) => stateOf(repos, tx, req.user.sub)));
  });

  app.post('/rival/words', bearer, async (req) => {
    const body = RivalWordsReq.parse(req.body);
    if (!on()) throw new HttpError(409, 'rivalOff');
    const id = req.user.sub;
    const text = cleanWords(body.text, RIVAL_WORDS_MAX);
    if (text === '') throw new HttpError(400, 'invalidPayload');
    const now = new Date(clock());
    const res = await repos.db.transaction(async (tx) => {
      if (!(await repos.rivals.setWords(tx, id, text, now, RIVAL_WORDS_WINDOW_MS))) throw new HttpError(409, 'rivalNoMeeting');
      await repos.audit.write(tx, { actorId: id, action: 'rival.words', subject: id, detail: { length: text.length } }, now);
      return stateOf(repos, tx, id);
    });
    return out(deps, RivalRes, res);
  });
}
