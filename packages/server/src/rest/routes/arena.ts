/**
 * Arena PvP REST (protocol arena.ts ROUTES `arena*`): the PvP screen's data, the out-of-world queues, AI training,
 * friend invites and the reload rejoin. The rooms and the matcher live in rooms/arenaLobby.ts + rooms/ArenaRoom.ts.
 *
 * Every route needs the player online (a presence entry: in a zone room or an arena room) — 409 `offline` otherwise.
 * Queue refusals are answered as an `idle` status (reason `busy` / `party` / `cup` + `detail`); training and invites
 * answer 409 with the same codes (`busy`, `party`, `cup`) plus `notFriends`, `self`, `friendOffline`, `friendBusy`.
 */
import { weeklyCup } from '@ewa/content';
import {
  ARENA_LEVEL,
  ArenaInfoRes,
  ArenaInviteReplyReq,
  ArenaInviteReplyRes,
  ArenaInviteReq,
  ArenaInviteRes,
  ArenaQueueReq,
  ArenaSeatRes,
  ArenaStatusBody,
  ArenaTrainingReq,
  DailyRes,
} from '@ewa/protocol';
import type { ArenaKind, ArenaSeatView, ArenaStatus } from '@ewa/protocol';
import type { FastifyInstance } from 'fastify';
import { DAILY_TRAINER, dailyEndsAt, dailyNumber, dailyPuzzle } from '../../game/daily';
import { dayKey } from '../../liveops/schedule';
import { arenaRefusal, cupView, idleStatus, matchedStatus, queuedStatus, statusMsg } from '../../rooms/arenaLobby';
import { HttpError, out, rateLimit, requireAuth } from '../http';
import type { RestDeps } from '../http';

/** An ArenaStatus as the response body (the seat as a plain object: the zod reservation schema is loose). */
function body(s: ArenaStatus): ArenaStatus & { readonly seat: Record<string, unknown> | null } {
  return { ...s, seat: s.seat === null ? null : { ...s.seat } };
}

export function registerArenaRoutes(app: FastifyInstance, deps: RestDeps): void {
  const { repos, clock } = deps;
  const lobby = deps.arena;
  const bearer = { onRequest: requireAuth(deps), preHandler: rateLimit(deps) };
  const limited = { onRequest: requireAuth(deps), preHandler: rateLimit(deps, 'friendReq') };

  /** The player's row + party (one read). */
  async function me(id: string) {
    const r = await repos.db.transaction(async (tx) => ({ row: await repos.players.byId(tx, id), party: await repos.creatures.party(tx, id) }));
    if (r.row === null) throw new HttpError(404, 'NotFound');
    return { row: r.row, party: r.party };
  }

  /** 409 offline / busy unless the player is online and free. */
  async function requireFree(id: string): Promise<void> {
    const v = await lobby.availability(id);
    if (v !== null) throw new HttpError(409, v);
  }

  /** 409 party / cup when the stored party may not enter `kind`. */
  function requireParty(party: Parameters<typeof arenaRefusal>[0], kind: ArenaKind): void {
    const why = arenaRefusal(party, kind, clock());
    if (why !== null) throw new HttpError(409, why.reason, why.detail !== null ? { detail: why.detail } : {});
  }

  app.get('/arena', bearer, async (req) => {
    const id = req.user.sub;
    const { row } = await me(id);
    return out(deps, ArenaInfoRes, {
      rating: row.rating,
      peakRating: row.peakRating,
      rankedMatches: row.rankedMatches,
      level: ARENA_LEVEL,
      cup: cupView(weeklyCup(clock())),
      status: body(await lobby.status(id)),
      live: await lobby.liveRoom(id),
    });
  });

  /** Join a mode's queue (a second join of the same mode keeps the first entry; another mode moves the player). */
  app.post('/arena/queue', bearer, async (req) => {
    const { mode } = ArenaQueueReq.parse(req.body);
    const id = req.user.sub;
    const { row, party } = await me(id);
    const v = await lobby.availability(id);
    if (v === 'offline') throw new HttpError(409, 'offline');
    if (v === 'busy') return out(deps, ArenaStatusBody, body(idleStatus('busy')));
    const why = arenaRefusal(party, mode, clock());
    if (why !== null) return out(deps, ArenaStatusBody, body(idleStatus(why.reason, why.detail)));
    const entry = await lobby.queue.join(mode, { playerId: id, name: row.username, rating: row.rating, joinedAt: clock() });
    return out(deps, ArenaStatusBody, body(queuedStatus(mode, entry, clock())));
  });

  app.post('/arena/queue/leave', bearer, async (req) => {
    await lobby.queue.leave(req.user.sub);
    return out(deps, ArenaStatusBody, body(idleStatus('left')));
  });

  /** An AI battle: its arena room starts as soon as the player takes the seat in the response. */
  app.post('/arena/training', bearer, async (req) => {
    const body = ArenaTrainingReq.parse(req.body);
    const id = req.user.sub;
    const { row, party } = await me(id);
    await requireFree(id);
    requireParty(party, 'training');
    const seat = await lobby.training({ playerId: id, name: row.username, rating: row.rating }, body.rules, body.difficulty);
    if (seat === null) throw new HttpError(503, 'arenaUnavailable');
    return out(deps, ArenaSeatRes, { seat: { ...seat } });
  });

  /** The daily challenge: today's (UTC) puzzle, the player's best and tries, and how many have won it. */
  app.get('/daily', bearer, async (req) => {
    const id = req.user.sub;
    const day = dayKey(clock());
    const { team, foe, par } = dailyPuzzle(day, deps.content);
    const view = (c: (typeof team)[number]) => ({ speciesId: c.speciesId, level: c.level, moves: c.moves.map((m) => m.id), ability: c.ability });
    const r = await repos.db.transaction(async (tx) => ({ mine: await repos.daily.get(tx, id, day), winners: await repos.daily.winners(tx, day) }));
    return out(deps, DailyRes, {
      dayKey: day,
      number: dailyNumber(day),
      endsAt: dailyEndsAt(day),
      team: team.map(view),
      foe: foe.map(view),
      foeName: DAILY_TRAINER.name,
      par,
      best: r.mine.best,
      attempts: r.mine.attempts,
      winners: r.winners,
    });
  });

  /** Today's daily starts at once in an arena room (any party may play: the team is the day's, not the player's). */
  app.post('/daily/start', bearer, async (req) => {
    const id = req.user.sub;
    const { row } = await me(id);
    await requireFree(id);
    const seat = await lobby.daily({ playerId: id, name: row.username, rating: row.rating }, dayKey(clock()));
    if (seat === null) throw new HttpError(503, 'arenaUnavailable');
    return out(deps, ArenaSeatRes, { seat: { ...seat } });
  });

  /** Invite an accepted friend who is online and free; they get `arenaInvite` wherever they are. */
  app.post('/arena/invite', limited, async (req) => {
    const body = ArenaInviteReq.parse(req.body);
    const id = req.user.sub;
    const { row, party } = await me(id);
    const other = await repos.db.transaction(async (tx) => {
      const t = await repos.players.byUsername(tx, body.username.toLowerCase());
      if (t === null || t.bannedAt !== null) throw new HttpError(404, 'NotFound');
      if (t.id === id) throw new HttpError(409, 'self');
      if (!(await repos.social.areFriends(tx, id, t.id))) throw new HttpError(409, 'notFriends');
      return t;
    });
    await requireFree(id);
    requireParty(party, 'friend');
    const v = await lobby.availability(other.id);
    if (v === 'offline') throw new HttpError(409, 'friendOffline');
    if (v === 'busy') throw new HttpError(409, 'friendBusy');
    const inv = await lobby.invite({ fromId: id, fromName: row.username, fromRating: row.rating, toId: other.id, toName: other.username, rules: body.rules });
    return out(deps, ArenaInviteRes, { inviteId: inv.inviteId, expiresAt: inv.expiresAt });
  });

  /**
   * The invitee's answer. Decline → `arenaInviteResult declined` to the inviter. Accept → both re-checked free with a
   * party, the `friend` arena room, `arenaStatus matched` (with the seat) to the inviter, the invitee's seat here;
   * a failure → `arenaInviteResult unavailable` to the inviter and 409 here.
   */
  app.post('/arena/invite/reply', bearer, async (req) => {
    const body = ArenaInviteReplyReq.parse(req.body);
    const id = req.user.sub;
    const peek = await lobby.peekInvite(body.inviteId);
    if (peek === null || peek.toId !== id) throw new HttpError(404, 'NotFound');
    const inv = await lobby.takeInvite(body.inviteId);
    if (inv === null) throw new HttpError(404, 'expired');
    const tell = (result: 'declined' | 'unavailable'): void => lobby.notify(inv.fromId, { type: 'arenaInviteResult', inviteId: inv.inviteId, toName: inv.toName, result });
    if (!body.accept) {
      tell('declined');
      return out(deps, ArenaInviteReplyRes, { seat: null });
    }
    try {
      const mine = await me(id);
      const theirs = await me(inv.fromId);
      await requireFree(id);
      requireParty(mine.party, 'friend');
      const v = await lobby.availability(inv.fromId);
      if (v !== null) throw new HttpError(409, v === 'offline' ? 'friendOffline' : 'friendBusy');
      requireParty(theirs.party, 'friend');
      const players: ArenaSeatView[] = [
        { playerId: inv.fromId, name: theirs.row.username, rating: theirs.row.rating },
        { playerId: id, name: mine.row.username, rating: mine.row.rating },
      ];
      const match = lobby.newMatch('friend', players, { rules: inv.rules });
      const seats = await lobby.open(match);
      if (seats === null) throw new HttpError(503, 'arenaUnavailable');
      lobby.notify(inv.fromId, statusMsg(matchedStatus('friend', seats.get(inv.fromId)!, players[1]!)));
      return out(deps, ArenaInviteReplyRes, { seat: { ...seats.get(id)! } });
    } catch (e) {
      tell('unavailable');
      throw e;
    }
  });

  /** A reload mid-battle: a fresh seat in the arena room the player is seated in (404 when none / it is over). */
  app.post('/arena/rejoin', bearer, async (req) => {
    const seat = await lobby.rejoin(req.user.sub);
    if (seat === null) throw new HttpError(404, 'NotFound');
    return out(deps, ArenaSeatRes, { seat: { ...seat } });
  });
}
