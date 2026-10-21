/**
 * A living ecosystem (content ecosystem.ts, game/ecosystem.ts): GET /world/ecosystem/:zoneId, "This week on <zone>":
 * what is surging (predators whose prey is overhunted), what is scarce (overhunted, or away on migration), what the
 * zone's honor tilts (Dark and Ghost in a darkened zone, rare slots in a lit one) and the season's migrants in and out.
 * The same reading the zone room rolls on. 404 for a zone without wild creatures; ECOSYSTEM=off: `enabled` false and
 * every list empty.
 */
import { ECO_WEEK_MS, ecoWeek, ecoWeekStart, encounterTableFor, scarce, seasonAt, surging } from '@ewa/content';
import type { EcoSpecies } from '@ewa/content';
import { EcoParams, EcosystemRes } from '@ewa/protocol';
import type { FastifyInstance } from 'fastify';
import { readEcosystem } from '../../game/ecosystem';
import { HttpError, out, rateLimit, requireAuth } from '../http';
import type { RestDeps } from '../http';

const LIST_MAX = 40;
const view = (s: EcoSpecies) => ({
  speciesId: s.speciesId,
  factor: Math.round(s.factor * 100) / 100,
  cause: s.cause,
  caught: s.caught,
  ko: s.ko,
  preyOn: s.preyOn.slice(0, 24),
  huntedBy: s.huntedBy.slice(0, 24),
});

export function registerEcosystemRoutes(app: FastifyInstance, deps: RestDeps): void {
  const { repos, clock } = deps;
  const bearer = { onRequest: requireAuth(deps), preHandler: rateLimit(deps) };

  app.get('/world/ecosystem/:zoneId', bearer, async (req) => {
    const { zoneId } = EcoParams.parse(req.params);
    if (encounterTableFor(zoneId) === null) throw new HttpError(404, 'NotFound');
    const now = clock();
    const season = seasonAt(now);
    const week = ecoWeek(now);
    const weekOfSeason = Math.min(4, Math.max(1, Math.floor((ecoWeekStart(week) - season.startsAt) / ECO_WEEK_MS) + 1));
    const head = { zoneId, season: season.number, week: weekOfSeason, endsAt: new Date(ecoWeekStart(week + 1)).toISOString() };
    if (deps.env.ECOSYSTEM !== 'on') {
      return out(deps, EcosystemRes, { ...head, enabled: false, takes: 0, judged: false, surging: [], scarce: [], tilted: [], migrantsIn: [], migrantsOut: [], shadow: 0, light: 0 });
    }
    const e = await repos.db.transaction((tx) => readEcosystem(repos, tx, zoneId, now));
    if (e === null) throw new HttpError(404, 'NotFound');
    return out(deps, EcosystemRes, {
      ...head,
      enabled: true,
      takes: e.takes,
      judged: e.judged,
      surging: surging(e).filter((s) => s.cause === 'feeding').slice(0, LIST_MAX).map(view),
      scarce: scarce(e).slice(0, LIST_MAX).map(view),
      tilted: e.species.filter((s) => (s.cause === 'shadow' || s.cause === 'light') && s.factor > 1).sort((a, b) => b.factor - a.factor || a.speciesId.localeCompare(b.speciesId)).slice(0, LIST_MAX).map(view),
      migrantsIn: e.migrantsIn.map((m) => ({ speciesId: m.species, from: m.from })),
      migrantsOut: e.migrantsOut.map((m) => ({ speciesId: m.species, to: m.to })),
      shadow: e.shadow,
      light: e.light,
    });
  });
}
