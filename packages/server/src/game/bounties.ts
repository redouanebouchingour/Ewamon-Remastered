/**
 * The bounty board (content bounties.ts): the server's half. The board's upkeep (expired posts refunded, the game's
 * bounties posted on schedule), a claim when a ghost is beaten or a nemesis brought in (inside the battle's own end
 * transaction), and what a claim does to the party lead (honor, history). Money moves always come with an audit row.
 */
import {
  BOUNTY_CLAIMS_PER_DAY,
  BOUNTY_HONOR,
  GHOST_DAYS,
  LAWLANDER_LINE,
  bountyPayout,
  bountyPeriod,
  gameBountyReward,
  holdsLine,
  nemesisBounty,
} from '@ewa/content';
import { clampHonor, tracksHonor } from '@ewa/core';
import type { ContentIndex, CreatureInstance } from '@ewa/core';
import type { Bounty, Db, Ghost, Repos as PersistRepos, Tx } from '@ewa/persist';

type Repos = PersistRepos & { readonly db: Db };

const DAY_MS = 86_400_000;
/** How often (at most) one process sweeps expired posts outside the battle path. */
export const BOUNTY_SWEEP_MS = 60_000;

/** The creature a ghost poster shows: its strongest (the first of the highest level). */
export function ghostFace(g: Pick<Ghost, 'party'>): { speciesId: string; level: number } {
  let best = g.party[0]!;
  for (const c of g.party) if (c.level > best.level) best = c;
  return { speciesId: best.speciesId, level: best.level };
}

/** When a ghost fades (content `GHOST_DAYS` after its owner left). */
export function ghostFadesAt(g: Pick<Ghost, 'leftAt'>): number {
  return g.leftAt.getTime() + GHOST_DAYS * DAY_MS;
}

/**
 * Expired posts come down: a player's escrow (reward and cut) goes back to them, with an audit row. Each post is
 * expired once (the update returns it once), so a refund is paid once.
 */
export async function expireBounties(repos: Repos, tx: Tx, nowMs: number): Promise<Bounty[]> {
  const now = new Date(nowMs);
  const gone = await repos.bounties.expireDue(tx, now);
  for (const b of gone) {
    if (b.kind !== 'player' || b.posterId === null) continue;
    const back = b.reward + b.fee;
    await repos.players.addMoney(tx, b.posterId, back);
    await repos.audit.write(tx, { actorId: b.posterId, action: 'bounty.refund', subject: b.id, detail: { target: b.targetName, reward: b.reward, fee: b.fee, refund: back } }, now);
  }
  return gone;
}

/**
 * The board's own bounties: every ghost still haunting that beat at least `GAME_BOUNTY_MIN_WINS` different trainers
 * this week (since its last bounty was claimed) is posted, or its poster raised, until the ghost fades.
 */
export async function postGameBounties(repos: Repos, tx: Tx, nowMs: number): Promise<number> {
  const since = new Date(nowMs - GHOST_DAYS * DAY_MS);
  const wins = await repos.bounties.ghostWins(tx, since);
  if (wins.size === 0) return 0;
  const ghosts = await repos.ghosts.everywhere(tx, since, 500);
  let posted = 0;
  for (const g of ghosts) {
    const w = wins.get(g.playerId) ?? 0;
    const reward = gameBountyReward(w);
    if (reward <= 0 || g.party.length === 0) continue;
    const face = ghostFace(g);
    await repos.bounties.upsertGame(tx, { targetId: g.playerId, targetName: g.name, speciesId: face.speciesId, level: face.level, zoneId: g.zoneId, wins: w, reward, expiresAt: new Date(ghostFadesAt(g)) }, new Date(nowMs));
    posted += 1;
  }
  return posted;
}

interface Upkeep {
  period: number;
  sweptAt: number;
}
const upkeep = new WeakMap<object, Upkeep>();

/**
 * The board's upkeep outside a battle (the board read, a post, the zone room's minute): sweeps expired posts at most
 * once a `BOUNTY_SWEEP_MS` per process and posts the game's bounties once per period (`BOUNTY_PERIOD_MS`; both are
 * idempotent, so several processes doing it is harmless). Never throws.
 */
export async function boardUpkeep(repos: Repos, nowMs: number, log?: { warn(o: object, m: string): void }): Promise<void> {
  const u = upkeep.get(repos) ?? { period: -1, sweptAt: -Infinity };
  const period = bountyPeriod(nowMs).index;
  const sweep = nowMs - u.sweptAt >= BOUNTY_SWEEP_MS;
  if (!sweep && period === u.period) return;
  upkeep.set(repos, { period, sweptAt: sweep ? nowMs : u.sweptAt });
  try {
    await repos.db.transaction(async (tx) => {
      await expireBounties(repos, tx, nowMs);
      if (period !== u.period) await postGameBounties(repos, tx, nowMs);
    });
  } catch (e) {
    upkeep.set(repos, u);
    log?.warn({ err: e }, 'bounty upkeep failed');
  }
}

/** Claims a trainer may still make today. */
export async function claimsLeft(repos: Repos, tx: Tx, playerId: string, nowMs: number): Promise<number> {
  return Math.max(0, BOUNTY_CLAIMS_PER_DAY - (await repos.bounties.claimsSince(tx, playerId, new Date(nowMs - DAY_MS))));
}

export interface BroughtIn {
  /** what the claims paid in all */
  readonly payout: number;
  /** of which the Lawlander bonus */
  readonly bonus: number;
  /** the claimed posters */
  readonly count: number;
  /** the party lead after its honor nudge and history line (null: no stored lead) */
  readonly lead: CreatureInstance | null;
  /** the toast after battleEnd */
  readonly text: string;
}

function money(n: number): string {
  return n.toLocaleString('en-US');
}

/** "You brought in kestrel: 2 bounties, 1,250 (Lawlander +250)." */
export function broughtInText(target: string, count: number, payout: number, bonus: number): string {
  const what = count === 1 ? 'the bounty' : `${count} bounties`;
  return `You brought in ${target}: ${what}, ${money(payout)}${bonus > 0 ? ` (Lawlander +${money(bonus)})` : ''}.`;
}

/**
 * What bringing a target in does to the claiming party's lead (its first party slot): honor + `BOUNTY_HONOR` when its
 * species keeps the ledger (honor.ts bounds), and the history line `bounty`. Plus the audit rows of the payout.
 */
async function leadBringsIn(
  repos: Repos,
  tx: Tx,
  content: ContentIndex,
  party: readonly CreatureInstance[],
  p: { readonly target: string; readonly targetKind: 'ghost' | 'nemesis'; readonly reward: number; readonly zoneId: string },
  now: Date,
): Promise<CreatureInstance | null> {
  const lead = party[0];
  if (lead === undefined) return null;
  let after = lead;
  if (tracksHonor(content.species(lead.speciesId))) {
    const honor = clampHonor((lead.honor ?? 0) + BOUNTY_HONOR);
    if (honor !== (lead.honor ?? 0)) {
      after = { ...lead, honor };
      await repos.creatures.update(tx, after);
    }
  }
  await repos.creatures.addEvent(tx, [lead.id], { kind: 'bounty', target: p.target, targetKind: p.targetKind, reward: p.reward, zoneId: p.zoneId }, now);
  return after;
}

/**
 * A ghost was beaten (inside the battle's end transaction, the claimer's player row locked): every open bounty on it
 * the claimer may take (not their own post, within today's claims) is claimed once and paid, with the Lawlander bonus
 * when their party holds one. Null when nothing was claimed. The caller adds `payout` to the battle's money.
 */
export async function claimGhostBounties(
  repos: Repos,
  tx: Tx,
  content: ContentIndex,
  p: { readonly ghostOwnerId: string; readonly ghostName: string; readonly claimerId: string; readonly claimerName: string; readonly zoneId: string; readonly battleId: string },
  nowMs: number,
): Promise<BroughtIn | null> {
  const left = await claimsLeft(repos, tx, p.claimerId, nowMs);
  if (left <= 0) return null;
  const now = new Date(nowMs);
  const party = await repos.creatures.party(tx, p.claimerId);
  const lawlander = holdsLine(
    party.map((c) => c.speciesId),
    LAWLANDER_LINE,
  );
  const got = await repos.bounties.claim(tx, { targetId: p.ghostOwnerId, claimerId: p.claimerId, claimerName: p.claimerName, bonus: lawlander, max: left, payoutOf: (r) => bountyPayout(r, lawlander) }, now);
  if (got.length === 0) return null;
  let payout = 0;
  let reward = 0;
  for (const b of got) {
    payout += b.payout ?? 0;
    reward += b.reward;
    await repos.audit.write(tx, { actorId: p.claimerId, action: 'bounty.claim', subject: b.id, detail: { kind: b.kind, target: b.targetName, poster: b.posterName, reward: b.reward, payout: b.payout, bonus: lawlander, battleId: p.battleId } }, now);
  }
  const lead = await leadBringsIn(repos, tx, content, party, { target: p.ghostName, targetKind: 'ghost', reward: payout, zoneId: p.zoneId }, now);
  return { payout, bonus: payout - reward, count: got.length, lead, text: broughtInText(p.ghostName, got.length, payout, payout - reward) };
}

/**
 * One of the claimer's own nemeses was knocked out or caught (inside the battle's end transaction): its personal
 * bounty (from `NEMESIS_BOUNTY_MIN_RANK`) is paid once, recorded as a claimed poster, within today's claims.
 */
export async function claimNemesisBounty(
  repos: Repos,
  tx: Tx,
  content: ContentIndex,
  p: { readonly fullName: string; readonly speciesId: string; readonly level: number; readonly rank: number; readonly claimerId: string; readonly claimerName: string; readonly zoneId: string; readonly battleId: string },
  nowMs: number,
): Promise<BroughtIn | null> {
  const reward = nemesisBounty(p.rank);
  if (reward <= 0) return null;
  if ((await claimsLeft(repos, tx, p.claimerId, nowMs)) <= 0) return null;
  const now = new Date(nowMs);
  const party = await repos.creatures.party(tx, p.claimerId);
  const lawlander = holdsLine(
    party.map((c) => c.speciesId),
    LAWLANDER_LINE,
  );
  const payout = bountyPayout(reward, lawlander);
  const b = await repos.bounties.recordNemesis(tx, { targetName: p.fullName, speciesId: p.speciesId, level: p.level, zoneId: p.zoneId, rank: p.rank, reward, claimerId: p.claimerId, claimerName: p.claimerName, payout, bonus: lawlander }, now);
  await repos.audit.write(tx, { actorId: p.claimerId, action: 'bounty.claim', subject: b.id, detail: { kind: 'nemesis', target: p.fullName, poster: null, reward, payout, bonus: lawlander, battleId: p.battleId } }, now);
  const lead = await leadBringsIn(repos, tx, content, party, { target: p.fullName, targetKind: 'nemesis', reward: payout, zoneId: p.zoneId }, now);
  return { payout, bonus: payout - reward, count: 1, lead, text: broughtInText(p.fullName, 1, payout, payout - reward) };
}
