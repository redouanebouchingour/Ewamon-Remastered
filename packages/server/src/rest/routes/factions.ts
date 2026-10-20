/**
 * Majin vs Tenjin seasons (content factions.ts): the season's two sides, the caller's side, the side holding Solenne's
 * sky (the last closed season's winner) and the Chronicle; taking a side (once a season).
 */
import { chronicleLine, factionWinner, seasonAt } from '@ewa/content';
import type { Faction } from '@ewa/content';
import { FactionJoinReq, FactionSkyRes, FactionsRes } from '@ewa/protocol';
import type { FastifyInstance } from 'fastify';
import { HttpError, out, rateLimit, requireAuth } from '../http';
import type { RestDeps } from '../http';

/** How many closed seasons the Chronicle shows. */
export const CHRONICLE_SHOWN = 6;
export const FACTION_TOP = 5;

export function registerFactionRoutes(app: FastifyInstance, deps: RestDeps): void {
  const { repos, clock } = deps;
  const bearer = { onRequest: requireAuth(deps), preHandler: rateLimit(deps) };

  async function view(playerId: string) {
    const now = clock();
    const season = seasonAt(now);
    const v = await repos.db.transaction(async (tx) => {
      const mine = await repos.factions.of(tx, season.number, playerId);
      const totals = await repos.factions.totals(tx, season.number);
      const top = {
        majin: await repos.factions.top(tx, season.number, 'majin', FACTION_TOP),
        tenjin: await repos.factions.top(tx, season.number, 'tenjin', FACTION_TOP),
      };
      // the Chronicle: the latest closed seasons (closed = before the running one), newest first
      const chronicle: { season: number; winner: Faction | null; line: string }[] = [];
      for (let n = season.number - 1; n >= 1 && n > season.number - 1 - CHRONICLE_SHOWN; n--) {
        const t = await repos.factions.totals(tx, n);
        const winner = factionWinner(t.points);
        chronicle.push({ season: n, winner, line: chronicleLine(n, winner, t.points) });
      }
      return { mine, totals, top, chronicle };
    });
    const row = (r: { player: { username: string }; points: number }) => ({ username: r.player.username, points: r.points });
    return {
      season: season.number,
      endsAt: new Date(season.endsAt).toISOString(),
      mine: v.mine,
      points: v.totals.points,
      members: v.totals.members,
      top: { majin: v.top.majin.map(row), tenjin: v.top.tenjin.map(row) },
      sky: v.chronicle[0]?.winner ?? null,
      chronicle: v.chronicle,
    };
  }

  app.get('/factions', bearer, async (req) => out(deps, FactionsRes, await view(req.user.sub)));

  app.post('/factions/join', bearer, async (req) => {
    const { side } = FactionJoinReq.parse(req.body);
    const now = clock();
    const held = await repos.db.transaction((tx) => repos.factions.join(tx, seasonAt(now).number, req.user.sub, side, new Date(now)));
    if (held !== side) throw new HttpError(409, 'alreadyJoined', { side: held });
    return out(deps, FactionsRes, await view(req.user.sub));
  });

  app.get('/factions/sky', bearer, async () => {
    const last = seasonAt(clock()).number - 1;
    if (last < 1) return out(deps, FactionSkyRes, { sky: null });
    const t = await repos.db.transaction((tx) => repos.factions.totals(tx, last));
    return out(deps, FactionSkyRes, { sky: factionWinner(t.points) });
  });
}

