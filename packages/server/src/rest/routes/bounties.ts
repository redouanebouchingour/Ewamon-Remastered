/**
 * The bounty board (content bounties.ts, game/bounties.ts). GET /bounties: the Wanted posters (the game's and trainers'
 * on ghosts, richest first), the caller's own nemesis posters, their posts, the latest claims, the ghosts haunting now
 * that a bounty can go on, and what the caller's party allows. POST /bounties: a trainer with a Badlander in the party,
 * standing in a town, pays the reward and the board's cut into escrow on another trainer's ghost. BOUNTIES=off: the
 * board reads empty and a post is refused.
 */
import {
  BADLANDER_LINE,
  GHOST_DAYS,
  LAWLANDER_LINE,
  NEMESIS_BOUNTY_MIN_RANK,
  bountyFee,
  bountyPayout,
  bountyPeriod,
  hasBountyBoard,
  holdsLine,
  nemesisBounty,
  nemesisFullName,
  postExpiry,
  postRefusal,
} from '@ewa/content';
import { BountiesRes, BountyPostReq } from '@ewa/protocol';
import type { BountiesView, BountyPosterView } from '@ewa/protocol';
import type { Bounty, Ghost, Tx } from '@ewa/persist';
import type { FastifyInstance } from 'fastify';
import { boardUpkeep, ghostFace, ghostFadesAt } from '../../game/bounties';
import { HttpError, out, presenceZone, rateLimit, refuseInBattle, requireAuth } from '../http';
import type { RestDeps } from '../http';

const DAY_MS = 86_400_000;

export function registerBountyRoutes(app: FastifyInstance, deps: RestDeps): void {
  const { repos, clock } = deps;
  const bearer = { onRequest: requireAuth(deps), preHandler: rateLimit(deps) };
  const enabled = (): boolean => deps.env.BOUNTIES !== 'off';
  const atBoard = (id: string): boolean => {
    const z = presenceZone(deps, id);
    return z !== null && hasBountyBoard(z);
  };

  async function view(tx: Tx, id: string, nowMs: number): Promise<BountiesView> {
    const now = new Date(nowMs);
    const me = (await repos.players.byId(tx, id))!;
    const party = (await repos.creatures.party(tx, id)).map((c) => c.speciesId);
    const you = {
      badlander: holdsLine(party, BADLANDER_LINE),
      lawlander: holdsLine(party, LAWLANDER_LINE),
      open: 0,
      claimsToday: 0,
      atBoard: atBoard(id),
    };
    const nextPostingAt = new Date(bountyPeriod(nowMs).endsAt).toISOString();
    if (!enabled()) return { enabled: false, nextPostingAt, wanted: [], personal: [], posted: [], claims: [], ghosts: [], you, money: me.money };
    const since = new Date(nowMs - GHOST_DAYS * DAY_MS);
    const ghosts = await repos.ghosts.everywhere(tx, since, 200);
    const byOwner = new Map<string, Ghost>(ghosts.map((g) => [g.playerId, g]));
    const wins = await repos.bounties.ghostWins(tx, since);
    const open = await repos.bounties.open(tx, now, 40);
    const wantedIds = new Set(open.map((b) => b.targetId));
    const poster = (b: Bounty): BountyPosterView => {
      const g = b.targetId === null ? undefined : byOwner.get(b.targetId);
      const face = g !== undefined && g.party.length > 0 ? ghostFace(g) : { speciesId: b.speciesId, level: b.level };
      return {
        id: b.id,
        kind: b.kind,
        target: b.targetName,
        speciesId: face.speciesId,
        level: face.level,
        zoneId: g?.zoneId ?? b.zoneId,
        wins: Math.max(b.kind === 'game' ? b.wins : 0, b.targetId === null ? 0 : (wins.get(b.targetId) ?? 0)),
        rank: null,
        reward: b.reward,
        withLawlander: bountyPayout(b.reward, true),
        postedBy: b.posterName,
        postedAt: b.createdAt.toISOString(),
        expiresAt: b.expiresAt.toISOString(),
        mine: b.posterId === id,
      };
    };
    const nemeses = (await repos.nemeses.active(tx, id)).filter((n) => n.rank >= NEMESIS_BOUNTY_MIN_RANK);
    const personal: BountyPosterView[] = nemeses.slice(0, 10).map((n) => {
      const reward = nemesisBounty(n.rank);
      return {
        id: n.id,
        kind: 'nemesis',
        target: nemesisFullName(n),
        speciesId: n.speciesId,
        level: n.level,
        zoneId: n.lastZone,
        wins: null,
        rank: n.rank,
        reward,
        withLawlander: bountyPayout(reward, true),
        postedBy: null,
        postedAt: n.updatedAt.toISOString(),
        expiresAt: null,
        mine: false,
      };
    });
    const posted = (await repos.bounties.postedBy(tx, id, 10)).map((b) => ({
      id: b.id,
      target: b.targetName,
      reward: b.reward,
      fee: b.fee,
      status: b.status,
      claimedBy: b.claimerName,
      postedAt: b.createdAt.toISOString(),
      expiresAt: b.expiresAt.toISOString(),
    }));
    const claims = (await repos.bounties.recentClaims(tx, 10)).map((b) => ({
      kind: b.kind,
      target: b.targetName,
      claimedBy: b.claimerName ?? '?',
      payout: b.payout ?? b.reward,
      bonus: b.bonus,
      zoneId: b.zoneId,
      at: (b.claimedAt ?? b.createdAt).toISOString(),
    }));
    const targets = ghosts
      .filter((g) => g.playerId !== id && g.party.length > 0)
      .map((g) => ({ name: g.name, zoneId: g.zoneId, ...ghostFace(g), wins: wins.get(g.playerId) ?? 0, wanted: wantedIds.has(g.playerId) }))
      .sort((a, b) => b.wins - a.wins || (a.name < b.name ? -1 : 1))
      .slice(0, 30);
    you.open = (await repos.bounties.openBy(tx, id, now)).length;
    you.claimsToday = await repos.bounties.claimsSince(tx, id, new Date(nowMs - DAY_MS));
    return { enabled: true, nextPostingAt, wanted: open.map(poster), personal, posted, claims, ghosts: targets, you, money: me.money };
  }

  app.get('/bounties', bearer, async (req) => {
    const now = clock();
    if (enabled()) await boardUpkeep(repos, now, deps.log);
    return out(deps, BountiesRes, await repos.db.transaction((tx) => view(tx, req.user.sub, now)));
  });

  app.post('/bounties', bearer, async (req) => {
    const body = BountyPostReq.parse(req.body);
    const id = req.user.sub;
    if (!enabled()) throw new HttpError(409, 'bountiesOff');
    refuseInBattle(deps, id);
    if (!atBoard(id)) throw new HttpError(409, 'notAtBoard');
    const nowMs = clock();
    await boardUpkeep(repos, nowMs, deps.log);
    const now = new Date(nowMs);
    const res = await repos.db.transaction(async (tx) => {
      const me = await repos.players.lock(tx, id);
      const target = await repos.players.byUsername(tx, body.target.toLowerCase());
      const ghost = target === null ? null : await repos.ghosts.of(tx, target.id);
      const alive = ghost !== null && ghost.party.length > 0 && ghostFadesAt(ghost) > nowMs && target!.bannedAt === null;
      const mine = await repos.bounties.openBy(tx, id, now);
      const why = postRefusal({
        partySpecies: (await repos.creatures.party(tx, id)).map((c) => c.speciesId),
        reward: body.reward,
        ownGhost: target?.id === id,
        ghostAlive: alive,
        openPosts: mine.length,
        postedOnTarget: target !== null && mine.some((b) => b.targetId === target.id),
      });
      if (why !== null) throw new HttpError(409, why);
      const fee = bountyFee(body.reward);
      // escrow: the reward and the board's cut leave the poster now (409 InsufficientFunds rolls it all back)
      await repos.players.addMoney(tx, id, -(body.reward + fee));
      const face = ghostFace(ghost!);
      const b = await repos.bounties.post(
        tx,
        {
          targetId: ghost!.playerId,
          targetName: ghost!.name,
          speciesId: face.speciesId,
          level: face.level,
          zoneId: ghost!.zoneId,
          wins: 0,
          reward: body.reward,
          fee,
          expiresAt: new Date(postExpiry(nowMs, ghostFadesAt(ghost!))),
          posterId: id,
          posterName: me.username,
        },
        now,
      );
      await repos.audit.write(tx, { actorId: id, action: 'bounty.post', subject: b.id, detail: { target: ghost!.name, reward: body.reward, fee, escrow: body.reward + fee } }, now);
      return view(tx, id, nowMs);
    });
    return out(deps, BountiesRes, res);
  });
}
