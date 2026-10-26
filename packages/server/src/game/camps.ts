/**
 * Camp bases (content camps.ts, SPEC §3.19): the server's half. The trophies a trainer has earned (read fresh from what
 * they did: nemeses ended, legendaries caught, the Champion's medal and their ranked peak, achievements claimed,
 * bounties brought in), a camp as one viewer sees it, the raid's settlement inside the battle's own end transaction
 * (the cut with an audit row, the raider's lead's honor, a takeover, the held point for the owner's side, the log row),
 * and the bus topic a REST edit publishes so the zone rooms redraw the camp.
 */
import {
  ACHIEVEMENTS,
  CAMP_HELD_PER_DAY,
  CAMP_HELD_POINTS,
  CAMP_RAID_COOLDOWN_MS,
  CAMP_RAID_HONOR,
  RESEARCH_HONOR_LINE,
  campInactive,
  campRaidCut,
  defaultCampName,
  nemesisFullName,
  raidWonText,
  seasonAt,
  trophyId,
} from '@ewa/content';
import type { Trophy } from '@ewa/content';
import { RANK_TIERS, clampHonor, tierFor, tracksHonor } from '@ewa/core';
import type { ContentIndex, CreatureInstance } from '@ewa/core';
import type { Camp, Db, Repos as PersistRepos, Tx } from '@ewa/persist';
import type { CampView } from '@ewa/protocol';

type Repos = PersistRepos & { readonly db: Db };

/** The bus topic a REST edit (rename, trophies, abandon) publishes: the zone rooms of that camp re-read it. */
export const CAMP_TOPIC = 'ewa:camp';

const DAY_MS = 86_400_000;
const ACHIEVEMENT_TITLE: ReadonlyMap<string, string> = new Map(ACHIEVEMENTS.map((a) => [a.id, a.title]));

/** The ranked tiers that earn a medal (Silver and up: everyone starts Bronze). */
const MEDAL_TIERS: readonly string[] = RANK_TIERS.slice(1).map((t) => t.key);

/**
 * Every trophy the trainer has earned, newest-ish first per kind: nemeses they beat or caught (their scar), legendary
 * species they caught, the Champion's medal, their ranked peak's medal (Silver up), achievements claimed, bounties
 * brought in. `champion`: the trainer holds the Champion's flag (the caller reads the flags).
 */
export async function earnedTrophies(repos: Repos, tx: Tx, content: ContentIndex, playerId: string, champion: boolean): Promise<Trophy[]> {
  const out: Trophy[] = [];
  for (const n of await repos.nemeses.ended(tx, playerId, 20)) out.push({ id: trophyId('scar', n.id), kind: 'scar', label: `${nemesisFullName(n)}'s scar`.slice(0, 64) });
  const dex = await repos.progress.dex(tx, playerId);
  for (const s of dex.caught) {
    let def;
    try {
      def = content.species(s);
    } catch {
      continue;
    }
    if (def.legendary) out.push({ id: trophyId('legend', s), kind: 'legend', label: `${def.name} caught` });
  }
  if (champion) out.push({ id: trophyId('medal', 'champion'), kind: 'medal', label: "Champion's medal" });
  const me = await repos.players.byId(tx, playerId);
  if (me !== null) {
    const tier = tierFor(me.peakRating);
    if (MEDAL_TIERS.includes(tier.key)) out.push({ id: trophyId('medal', tier.key), kind: 'medal', label: `${tier.label} ranked medal` });
  }
  for (const q of await repos.progress.claimedQuestIds(tx, playerId)) {
    const title = ACHIEVEMENT_TITLE.get(q);
    if (title !== undefined) out.push({ id: trophyId('achievement', q), kind: 'achievement', label: title.slice(0, 64) });
  }
  for (const b of await repos.bounties.claimedBy(tx, playerId, 20)) out.push({ id: trophyId('bounty', b.id), kind: 'bounty', label: `Brought in ${b.targetName}`.slice(0, 64) });
  return out.slice(0, 80);
}

/** A camp as `viewerId` sees it; `ctx` says what a raid would meet now (null for the viewer's own camp). */
export function campView(
  c: Camp,
  viewerId: string,
  ctx: { readonly ownerOnline: boolean; readonly ownerInRun: boolean; readonly ownerLastSeenMs: number | null; readonly raidedToday: boolean; readonly ownerMoney: number },
  nowMs: number,
): CampView {
  const mine = c.ownerId === viewerId;
  return {
    zoneId: c.zoneId,
    owner: c.ownerName,
    name: c.name,
    trophies: c.trophies.slice(0, 3).map((t) => ({ id: t.id, kind: t.kind as CampView['trophies'][number]['kind'], label: t.label })),
    guard: c.guard.slice(0, 6).map((g) => ({ speciesId: g.speciesId, level: g.level, isShiny: g.isShiny === true })),
    claimedAt: c.claimedAt.toISOString(),
    mine,
    ownerOnline: ctx.ownerOnline,
    ownerInRun: ctx.ownerInRun,
    inactive: !mine && campInactive(ctx.ownerLastSeenMs, nowMs),
    raidedToday: !mine && ctx.raidedToday,
    cut: mine ? 0 : campRaidCut(ctx.ownerMoney),
  };
}

/** Whether the raider already won a raid on this camp within the cooldown. */
export async function raidedToday(repos: Repos, tx: Tx, raiderId: string, zoneId: string, nowMs: number): Promise<boolean> {
  return repos.camps.wonSince(tx, raiderId, zoneId, new Date(nowMs - CAMP_RAID_COOLDOWN_MS));
}

export interface RaidSettled {
  /** what the raider takes (added to the battle's money) */
  readonly cut: number;
  /** the raider's lead after its honor hit (null: no stored lead, or a lost raid) */
  readonly lead: CreatureInstance | null;
  readonly tookOver: boolean;
  /** the raider's toast after battleEnd (null on a loss) */
  readonly text: string | null;
}

/**
 * A raid ended (inside the battle's end transaction, the raider's player row locked). A win: the cut from the owner's
 * purse (their row locked, 2 % capped, nothing when the raider already took a cut from this camp in the last 24 hours
 * or the camp changed hands meanwhile) with an audit row; the raider's lead loses `CAMP_RAID_HONOR` (a species that
 * keeps the ledger); a long-away owner's camp passes to a raider who holds none. A loss: the guard held, its owner's
 * side earns `CAMP_HELD_POINTS` (at most `CAMP_HELD_PER_DAY` a day). Either way the owner's log gets the row.
 */
export async function settleRaid(
  repos: Repos,
  tx: Tx,
  content: ContentIndex,
  p: { readonly ownerId: string; readonly ownerName: string; readonly zoneId: string; readonly raiderId: string; readonly raiderName: string; readonly battleId: string; readonly won: boolean },
  nowMs: number,
): Promise<RaidSettled> {
  const now = new Date(nowMs);
  const camp = await repos.camps.of(tx, p.zoneId);
  const same = camp !== null && camp.ownerId === p.ownerId;
  if (!p.won) {
    let held = false;
    if (same && (await repos.camps.heldSince(tx, p.ownerId, new Date(nowMs - DAY_MS))) < CAMP_HELD_PER_DAY) {
      held = (await repos.factions.award(tx, seasonAt(nowMs).number, p.ownerId, CAMP_HELD_POINTS)) !== null;
    }
    await repos.camps.recordRaid(tx, { zoneId: p.zoneId, ownerId: p.ownerId, raiderId: p.raiderId, raiderName: p.raiderName, won: false, cut: 0, tookOver: false, held }, now);
    return { cut: 0, lead: null, tookOver: false, text: null };
  }
  let cut = 0;
  let tookOver = false;
  if (same && !(await raidedToday(repos, tx, p.raiderId, p.zoneId, nowMs))) {
    const owner = await repos.players.lock(tx, p.ownerId);
    cut = campRaidCut(owner.money);
    if (cut > 0) await repos.players.addMoney(tx, p.ownerId, -cut);
    // a camp whose owner has been away too long passes to the raider (when they hold none)
    if (campInactive(owner.lastSeenAt.getTime(), nowMs) && (await repos.camps.byOwner(tx, p.raiderId)) === null) {
      const guard = await repos.creatures.party(tx, p.raiderId);
      if (guard.length > 0) tookOver = await repos.camps.transfer(tx, p.zoneId, p.ownerId, { ownerId: p.raiderId, ownerName: p.raiderName, name: defaultCampName(p.raiderName), guard }, now);
    }
  }
  await repos.audit.write(tx, { actorId: p.raiderId, action: 'camp.raid', subject: p.battleId, detail: { owner: p.ownerName, ownerId: p.ownerId, zoneId: p.zoneId, cut, tookOver } }, now);
  await repos.camps.recordRaid(tx, { zoneId: p.zoneId, ownerId: p.ownerId, raiderId: p.raiderId, raiderName: p.raiderName, won: true, cut, tookOver, held: false }, now);
  // the honor hit: the raider's party lead (its first slot), a species that keeps the ledger
  const party = await repos.creatures.party(tx, p.raiderId);
  let lead: CreatureInstance | null = null;
  const first = party[0];
  if (first !== undefined && tracksHonor(content.species(first.speciesId))) {
    const honor = clampHonor((first.honor ?? 0) + CAMP_RAID_HONOR);
    if (honor !== (first.honor ?? 0)) {
      lead = { ...first, honor };
      await repos.creatures.update(tx, lead);
      // Dex research: the toll can carry the lead over the Low Honor line
      if (honor <= -RESEARCH_HONOR_LINE && (first.honor ?? 0) > -RESEARCH_HONOR_LINE) await repos.progress.bumpCounter(tx, p.raiderId, first.speciesId, 'honorLow');
    }
  }
  return { cut, lead, tookOver, text: raidWonText(p.ownerName, cut, tookOver) };
}

/** The trophy kinds of a camp in slot order, as the zone state carries them ('' = none). */
export function trophyKinds(c: Pick<Camp, 'trophies'> | null): string {
  return c === null ? '' : c.trophies.slice(0, 3).map((t) => t.kind).join(',');
}
