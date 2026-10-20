/**
 * Ranked seasons (content seasons.ts, jobs/seasonRollover.ts) and spectator mode (game/liveBoard.ts): the season now
 * with its standings so far and the latest closed seasons' top eight, one closed season's standings, a trainer's
 * titles; the live arena matches and one match's feed; the zones under a shadow this season (honor shapes the world,
 * content worldHonor.ts). A banned trainer is left out of every list.
 */
import { GHOST_DAYS, SEASON_FINALISTS, roamerMovesAt, roamerOf, roamerZoneAt, seasonAt, seasonByNumber, seasonTitle, shadowLevel } from '@ewa/content';
import type { Season } from '@ewa/content';
import type { SeasonStanding } from '@ewa/persist';
import { LiveFeedRes, LiveListRes, LiveParams, PageQuery, SeasonParams, SeasonStandingsRes, SeasonTitlesRes, SeasonsRes, LegendsRes, GhostRes, UsernameParams, WorldShadowRes } from '@ewa/protocol';
import type { FastifyInstance } from 'fastify';
import { HttpError, out, rateLimit, requireAuth } from '../http';
import type { RestDeps } from '../http';

/** How many closed seasons GET /seasons shows. */
export const SEASONS_SHOWN = 6;
export const SEASON_PAGE = 50;

const iso = (ms: number): string => new Date(ms).toISOString();
const info = (s: Season) => ({ season: s.number, startsAt: iso(s.startsAt), endsAt: iso(s.endsAt), finalsAt: iso(s.finalsAt) });
const row = (r: SeasonStanding) => ({ rank: r.rank, username: r.player.username, rating: r.rating, wins: r.wins, losses: r.losses, title: seasonTitle(r.rank) });
const shown = (rows: readonly SeasonStanding[]) => rows.filter((r) => r.player.bannedAt === null).map(row);

export function registerSeasonRoutes(app: FastifyInstance, deps: RestDeps): void {
  const { repos, clock } = deps;
  const bearer = { onRequest: requireAuth(deps), preHandler: rateLimit(deps) };

  app.get('/seasons', bearer, async () => {
    const now = clock();
    const season = seasonAt(now);
    const v = await repos.db.transaction(async (tx) => {
      const top = await repos.seasons.current(tx, season.startsAt, now, SEASON_FINALISTS);
      const last = await repos.seasons.lastClosed(tx);
      const past = [];
      for (let n = last; n >= 1 && n > last - SEASONS_SHOWN; n--) past.push({ season: seasonByNumber(n), top: await repos.seasons.standings(tx, n, 1, SEASON_FINALISTS) });
      return { top, past };
    });
    return out(deps, SeasonsRes, {
      current: { ...info(season), finals: now >= season.finalsAt, top: shown(v.top) },
      past: v.past.map((p) => ({ ...info(p.season), top: shown(p.top) })),
    });
  });

  app.get('/seasons/titles/:username', bearer, async (req) => {
    const { username } = UsernameParams.parse(req.params);
    const v = await repos.db.transaction(async (tx) => {
      const p = await repos.players.byUsername(tx, username.toLowerCase());
      if (p === null || p.bannedAt !== null) return null;
      return { p, titles: await repos.seasons.titles(tx, p.id) };
    });
    if (v === null) throw new HttpError(404, 'NotFound');
    return out(deps, SeasonTitlesRes, {
      username: v.p.username,
      titles: v.titles.map((t) => ({ season: t.season, rank: t.rank, title: seasonTitle(t.rank)! })),
    });
  });

  app.get('/seasons/:season', bearer, async (req) => {
    const { season } = SeasonParams.parse(req.params);
    const { page } = PageQuery.parse(req.query);
    const v = await repos.db.transaction(async (tx) => ((await repos.seasons.lastClosed(tx)) >= season ? repos.seasons.standings(tx, season, page, SEASON_PAGE) : null));
    if (v === null) throw new HttpError(404, 'NotFound');
    return out(deps, SeasonStandingsRes, { season, rows: shown(v) });
  });

  app.get('/world/shadow', bearer, async () => {
    const season = seasonAt(clock()).number;
    const rows = await repos.db.transaction((tx) => repos.worldHonor.season(tx, season));
    const zones = rows.map((r) => ({ ...r, level: shadowLevel(r.light, r.shadow) })).filter((r) => r.level > 0);
    return out(deps, WorldShadowRes, { season, zones });
  });

  // one roaming legendary per season: where the season's roamer is (until caught) and every season's first catcher
  app.get('/legends', bearer, async () => {
    const now = clock();
    const season = seasonAt(now).number;
    const v = await repos.db.transaction(async (tx) => ({ caught: season >= 1 ? await repos.legends.of(tx, season) : null, past: await repos.legends.all(tx) }));
    const view = (l: { season: number; species: string; playerName: string; caughtAt: Date }) => ({ season: l.season, species: l.species, username: l.playerName, at: l.caughtAt.toISOString() });
    const roaming = season >= 1 && v.caught === null;
    return out(deps, LegendsRes, {
      season,
      species: roamerOf(Math.max(1, season)),
      zoneId: roaming ? roamerZoneAt(season, now) : null,
      movesAt: roaming ? iso(roamerMovesAt(now)) : null,
      caught: v.caught === null ? null : view(v.caught),
      past: v.past.map(view),
    });
  });

  // ghost trainers: where the caller's ghost haunts (until it fades) and its latest fights
  app.get('/ghost', bearer, async (req) => {
    const now = clock();
    const v = await repos.db.transaction(async (tx) => ({ ghost: await repos.ghosts.of(tx, req.user.sub), record: await repos.ghosts.fights(tx, req.user.sub, 20) }));
    const g = v.ghost !== null && now - v.ghost.leftAt.getTime() < GHOST_DAYS * 86_400_000 ? v.ghost : null;
    return out(deps, GhostRes, {
      haunting: g === null ? null : { zoneId: g.zoneId, leftAt: g.leftAt.toISOString(), party: g.party.slice(0, 6).map((c) => ({ speciesId: c.speciesId, level: c.level })) },
      won: v.record.won,
      lost: v.record.lost,
      fights: v.record.fights.map((f) => ({ challenger: f.challenger, zoneId: f.zoneId, won: f.won, at: f.at.toISOString() })),
    });
  });

  app.get('/arena/live', bearer, async () => {
    const matches = await deps.live.list();
    return out(deps, LiveListRes, {
      matches: matches.slice(0, 50).map((m) => ({ matchId: m.matchId, kind: m.kind, finals: m.finals, players: m.players, turn: m.turn, startedAt: iso(m.startedAt) })),
    });
  });

  app.get('/arena/live/:matchId', bearer, async (req) => {
    const { matchId } = LiveParams.parse(req.params);
    const f = await deps.live.feed(matchId);
    if (f === null) throw new HttpError(404, 'NotFound');
    return out(deps, LiveFeedRes, {
      matchId: f.matchId,
      kind: f.kind,
      finals: f.finals,
      players: f.players,
      turn: f.turn,
      startedAt: iso(f.startedAt),
      // the start snapshot is opaque to persist (its arena kind a plain string); the response schema checks it
      replay: f.replay as never,
      outcome: f.outcome,
    });
  });
}
