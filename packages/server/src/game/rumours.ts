/**
 * The rumour board (LLM feature 8): the facts a town's crier calls out today, built from data the server already keeps.
 * The client words each fact as a rumour through the model and checks the words against the fact's sentence; the
 * sentence here is the truth and the fallback, so every name and number in it is real.
 *
 * What a board holds (`buildRumours`, pure, deterministic for a day, a town and the world's rows):
 * - Yesterday's news (the UTC day before the board's day, so a board is the same however late it is first read):
 *   badges won and the Champion beaten (public names, as the rankings and public profiles show them), bounties brought
 *   in (the claimer as the board's own claims list shows them), camps that changed hands (the holder as the camp shows it).
 * - The standing world as of the board's first read that day: open bounties, nemeses stalking near the town (by their
 *   own name, never their trainer's), each nearby zone's ecosystem this week (scarce from overhunting, surging, migrants).
 * - Today's schedule: the day's swarm, the raid hotspots near the town and their UTC windows, a seasonal event, the
 *   week's arena cup, the sky the nearby zones lean to (the biome's schedule).
 * - The market: species whose sale price moved by a quarter or more against the week before (two sales each at least).
 * - About the caller (`gossipRumours`, per read, not cached): what the town's villagers remember them doing (feature 1's
 *   deeds) and how the town stands with them.
 *
 * Choice: the facts are grouped by kind, local ones (the town and the zones one link away, content `rumourZones`) first;
 * the kinds are taken round-robin in an order seeded by the world seed, the day and the town, so towns differ and a
 * board holds a mix; at most `RUMOUR_WORLD_MAX` world facts.
 *
 * The world part is cached per day and town (`RumourBoard`); the reads behind it are a handful of indexed queries.
 */
import {
  BADGES,
  DAILY_SWARMS,
  RAID_HOTSPOTS,
  SPECIES,
  ZONES,
  nemesisFullName,
  rumourZones,
  scarce,
  surging,
  weeklyCup,
  zone as zoneById,
} from '@ewa/content';
import type { Ecosystem, SeasonalEvent, ZoneId } from '@ewa/content';
import { createRng } from '@ewa/core';
import type { Bounty, NewsBadge, NewsCampTakeover, NewsNemesis, NewsSale, NewsSplit, NpcMemory, Repos, Tx } from '@ewa/persist';
import { RUMOUR_GOSSIP_MAX, RUMOUR_TEXT_MAX, RUMOUR_WORLD_MAX, townScore, standingOf } from '@ewa/protocol';
import type { NpcDeed, RumourFact, RumourKind } from '@ewa/protocol';
import { DAY_MS, activeEvents, dayKey } from '../liveops/schedule';
import { readEcosystem } from './ecosystem';
import { gossipFrom } from './npcMemory';
import { WEATHER_SCHEDULE } from './weather';

/** A nemesis is news from this rank. */
export const RUMOUR_NEMESIS_MIN_RANK = 2;
/** A market price moved by this share or more against the week before. */
export const RUMOUR_MARKET_SWING = 0.25;
/** sales a species needs in each week to count */
export const RUMOUR_MARKET_MIN_SALES = 2;
/** the facts kept per kind */
const PER_KIND = 2;

/** The rows a board is built from (the reads of `gatherWorld`). */
export interface RumourWorld {
  /** badges earned yesterday */
  readonly badges: readonly NewsBadge[];
  /** the Champion beaten yesterday */
  readonly champions: readonly NewsSplit[];
  readonly camps: readonly NewsCampTakeover[];
  /** active nemeses near the town */
  readonly nemeses: readonly NewsNemesis[];
  /** open bounties on ghosts */
  readonly bounties: readonly Bounty[];
  /** bounties brought in yesterday */
  readonly claims: readonly Bounty[];
  /** market sales of the two weeks before the day */
  readonly sales: readonly NewsSale[];
  /** this week's ecosystem of the nearby zones that have wild creatures (empty with ECOSYSTEM=off) */
  readonly eco: readonly Ecosystem[];
}

export const EMPTY_WORLD: RumourWorld = Object.freeze({ badges: [], champions: [], camps: [], nemeses: [], bounties: [], claims: [], sales: [], eco: [] });

const speciesById = new Map(SPECIES.map((s) => [s.id, s]));
const zoneIds = new Set<string>(ZONES.map((z) => z.id));
const spName = (id: string): string => speciesById.get(id)?.name ?? id;
const spType = (id: string): string | null => speciesById.get(id)?.types[0] ?? null;
/** "Solenne" for "Solenne, the Sun-City" */
export const placeName = (id: string): string => (zoneIds.has(id) ? zoneById(id as ZoneId).name.split(',')[0]! : id);
/** em-dashes and the horizontal bar (by code: never typed into this file) */
const DASHES = new RegExp(`\\s*[${String.fromCharCode(0x2014, 0x2015)}]\\s*`, 'g');
const money = (n: number): string => Math.round(n).toLocaleString('en-US');
const list = (xs: readonly string[]): string => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)!}`);
const hhmm = (h: number): string => `${String(h).padStart(2, '0')}:00`;
const oneLine = (s: string): string =>
  s
    .replace(/\p{Cc}/gu, ' ')
    .replace(DASHES, ', ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, RUMOUR_TEXT_MAX);

interface Candidate {
  readonly fact: RumourFact;
  /** the town or a zone one link away */
  readonly local: boolean;
}

function fact(kind: RumourKind, subject: string, text: string, o: { zoneId?: string | null; speciesId?: string | null; type?: string | null } = {}): RumourFact {
  return { id: `${kind}:${subject}`.slice(0, 96), kind, text: oneLine(text), zoneId: o.zoneId ?? null, speciesId: o.speciesId ?? null, type: o.type ?? (o.speciesId ? spType(o.speciesId) : null) };
}

/** The UTC midnight that starts the day of `nowMs`. */
export function dayStartOf(nowMs: number): number {
  return Math.floor(nowMs / DAY_MS) * DAY_MS;
}

// ---- the kinds ------------------------------------------------------------------------------------------------------

function badgeFacts(w: RumourWorld): Candidate[] {
  if (w.badges.length === 0) return [];
  const order = (id: string): number => BADGES.findIndex((b) => b.id === id);
  // the deepest badge of the day is the news; ties: the earliest
  const top = [...w.badges].sort((a, b) => order(b.badgeId) - order(a.badgeId) || a.at.getTime() - b.at.getTime() || a.username.localeCompare(b.username))[0]!;
  const def = BADGES.find((b) => b.id === top.badgeId);
  const name = def?.name ?? top.badgeId;
  const people = new Set(w.badges.map((b) => b.username)).size;
  const text = people === 1 ? `${top.username} won the ${name} yesterday.` : `${people} trainers won badges yesterday, and ${top.username} won the ${name}.`;
  return [{ fact: fact('badge', top.badgeId, text, { type: def?.type ?? null }), local: false }];
}

function championFacts(w: RumourWorld): Candidate[] {
  if (w.champions.length === 0) return [];
  const first = w.champions[0]!;
  const text = w.champions.length === 1 ? `${first.username} beat the Champion yesterday.` : `${w.champions.length} trainers beat the Champion yesterday, ${first.username} first.`;
  return [{ fact: fact('champion', first.username, text), local: false }];
}

function raidFacts(near: ReadonlySet<string>): Candidate[] {
  return RAID_HOTSPOTS.filter((h) => near.has(h.zoneId)).map((h) => {
    const who = h.minBadges > 0 ? ` for trainers with ${h.minBadges} badge${h.minBadges === 1 ? '' : 's'}` : '';
    const text = `A level ${h.boss.level} ${spName(h.boss.species)} raid opens on ${placeName(h.zoneId)} at ${hhmm(h.window.utcHour)} UTC for ${h.window.minutes} minutes${who}.`;
    return { fact: fact('raid', h.id, text, { zoneId: h.zoneId, speciesId: h.boss.species }), local: true };
  });
}

function swarmFacts(dayStart: number, near: ReadonlySet<string>): Candidate[] {
  const s = DAILY_SWARMS[new Date(dayStart).getUTCDay()];
  if (s === undefined) return [];
  const text = `${placeName(s.zoneId)} is swarming with ${list(s.species.map(spName))} today.`;
  return [{ fact: fact('swarm', s.id, text, { zoneId: s.zoneId, speciesId: s.species[0] ?? null }), local: near.has(s.zoneId) }];
}

function eventFacts(events: readonly SeasonalEvent[], near: ReadonlySet<string>): Candidate[] {
  return events.map((e) => {
    const end = new Date(Date.parse(e.endsAt) - 1).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
    const where = e.featuredZones.filter((z) => near.has(z));
    const text = `${e.name} runs until ${end}${where.length > 0 ? `, and ${placeName(where[0]!)} is one of its places` : ''}.`;
    return { fact: fact('event', e.id, text, { zoneId: where[0] ?? e.featuredZones[0] ?? null, speciesId: e.featuredSpecies[0] ?? null }), local: where.length > 0 };
  });
}

function ecoFacts(w: RumourWorld): Candidate[] {
  const out: Candidate[] = [];
  for (const e of w.eco) {
    const where = placeName(e.zoneId);
    const hunted = scarce(e).find((s) => s.cause === 'hunted');
    if (hunted !== undefined) out.push({ fact: fact('ecosystem', `${e.zoneId}:${hunted.speciesId}:scarce`, `${spName(hunted.speciesId)} is getting scarce on ${where}: trainers have been overhunting it.`, { zoneId: e.zoneId, speciesId: hunted.speciesId }), local: true });
    const surge = surging(e).find((s) => s.cause === 'feeding');
    if (surge !== undefined) out.push({ fact: fact('ecosystem', `${e.zoneId}:${surge.speciesId}:surging`, `${spName(surge.speciesId)} is surging on ${where}, feeding well while its prey is hunted.`, { zoneId: e.zoneId, speciesId: surge.speciesId }), local: true });
    for (const m of e.migrantsIn.slice(0, 1)) out.push({ fact: fact('migrant', `${e.zoneId}:${m.species}`, `${spName(m.species)} has come to ${where} from ${placeName(m.from)} for the season.`, { zoneId: e.zoneId, speciesId: m.species }), local: true });
  }
  return out;
}

function bountyFacts(w: RumourWorld, near: ReadonlySet<string>): Candidate[] {
  const open = [...w.bounties].sort((a, b) => Number(near.has(b.zoneId)) - Number(near.has(a.zoneId)) || b.reward - a.reward || a.id.localeCompare(b.id));
  return open.slice(0, PER_KIND).map((b) => ({
    fact: fact('bounty', b.id, `${b.targetName} is wanted on ${placeName(b.zoneId)}, with a ${money(b.reward)} bounty on its head.`, { zoneId: b.zoneId, speciesId: b.speciesId }),
    local: near.has(b.zoneId),
  }));
}

function claimFacts(w: RumourWorld, near: ReadonlySet<string>): Candidate[] {
  return w.claims.slice(0, PER_KIND).map((b) => ({
    fact: fact('claim', b.id, `${b.claimerName ?? 'A hunter'} brought in ${b.targetName} on ${placeName(b.zoneId)} yesterday.`, { zoneId: b.zoneId, speciesId: b.speciesId }),
    local: near.has(b.zoneId),
  }));
}

function campFacts(w: RumourWorld, near: ReadonlySet<string>): Candidate[] {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const c of w.camps) {
    if (seen.has(c.zoneId)) continue;
    seen.add(c.zoneId);
    out.push({ fact: fact('camp', c.zoneId, `The camp on ${placeName(c.zoneId)} changed hands yesterday, and ${c.holder} holds it now.`, { zoneId: c.zoneId }), local: near.has(c.zoneId) });
  }
  return out;
}

function nemesisFacts(w: RumourWorld): Candidate[] {
  return w.nemeses.map((n) => ({
    fact: fact('nemesis', `${n.zoneId}:${n.name}`, `${nemesisFullName(n)}, a level ${n.level} ${spName(n.speciesId)} that has risen to rank ${n.rank}, stalks ${placeName(n.zoneId)}.`, { zoneId: n.zoneId, speciesId: n.speciesId }),
    local: true,
  }));
}

const WEATHER_WORD: Readonly<Record<string, string>> = { sun: 'harsh sun', rain: 'rain', sand: 'sandstorms', hail: 'hail' };

function weatherFacts(near: readonly ZoneId[]): Candidate[] {
  const out: Candidate[] = [];
  for (const id of near) {
    const z = zoneById(id);
    const weights = WEATHER_SCHEDULE[z.biome] ?? {};
    const total = Object.values(weights).reduce((a, b) => a + (b ?? 0), 0);
    const best = Object.entries(weights)
      .filter(([k]) => k !== 'none')
      .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0) || a[0].localeCompare(b[0]))[0];
    if (best === undefined || total <= 0 || (best[1] ?? 0) / total < 0.3) continue;
    const pct = Math.round(((best[1] ?? 0) / total) * 100);
    out.push({ fact: fact('weather', id, `${placeName(id)} sees ${WEATHER_WORD[best[0]] ?? best[0]} about ${pct} percent of the time.`, { zoneId: id }), local: true });
  }
  return out;
}

/** Species whose average sale price moved by `RUMOUR_MARKET_SWING` or more, the week before the day against the one before that. */
export function marketSwings(sales: readonly NewsSale[], dayStart: number): { speciesId: string; now: number; before: number }[] {
  const recent = new Map<string, number[]>();
  const prior = new Map<string, number[]>();
  for (const s of sales) {
    const t = s.at.getTime();
    const bucket = t >= dayStart - 7 * DAY_MS && t < dayStart ? recent : t >= dayStart - 14 * DAY_MS && t < dayStart - 7 * DAY_MS ? prior : null;
    if (bucket === null) continue;
    bucket.set(s.speciesId, [...(bucket.get(s.speciesId) ?? []), s.price]);
  }
  const avg = (xs: readonly number[]): number => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length / 10) * 10;
  const out: { speciesId: string; now: number; before: number }[] = [];
  for (const [id, xs] of recent) {
    const ys = prior.get(id);
    if (ys === undefined || xs.length < RUMOUR_MARKET_MIN_SALES || ys.length < RUMOUR_MARKET_MIN_SALES) continue;
    const now = avg(xs);
    const before = avg(ys);
    if (before <= 0 || Math.abs(now - before) / before < RUMOUR_MARKET_SWING) continue;
    out.push({ speciesId: id, now, before });
  }
  return out.sort((a, b) => Math.abs(b.now - b.before) / b.before - Math.abs(a.now - a.before) / a.before || a.speciesId.localeCompare(b.speciesId));
}

function marketFacts(w: RumourWorld, dayStart: number): Candidate[] {
  return marketSwings(w.sales, dayStart).map((m) => ({
    fact: fact('market', m.speciesId, `${spName(m.speciesId)} sells for about ${money(m.now)} at the market now, ${m.now > m.before ? 'up' : 'down'} from about ${money(m.before)} the week before.`, { speciesId: m.speciesId }),
    local: false,
  }));
}

function cupFacts(dayStart: number): Candidate[] {
  const cup = weeklyCup(dayStart);
  return [{ fact: fact('cup', cup.def.id, `This week's arena cup is the ${cup.def.name}. ${cup.description}`, { zoneId: cup.zone }), local: false }];
}

/** The order the kinds are taken in, seeded per day and town. */
const WORLD_KINDS: readonly RumourKind[] = ['badge', 'champion', 'raid', 'swarm', 'event', 'ecosystem', 'migrant', 'bounty', 'claim', 'camp', 'nemesis', 'weather', 'market', 'cup'];

/**
 * The world's facts on `town`'s board for the day starting `dayStart` (UTC midnight). Pure: the same rows, seed, day
 * and town give the same facts in the same order.
 */
export function buildRumours(town: ZoneId, dayStart: number, worldSeed: string, w: RumourWorld, events: readonly SeasonalEvent[] = activeEvents(dayStart)): RumourFact[] {
  const nearList = rumourZones(town);
  const near = new Set<string>(nearList);
  const local = <T extends { readonly zoneId: string }>(xs: readonly T[]): T[] => xs.filter((x) => near.has(x.zoneId));
  const byKind = new Map<RumourKind, Candidate[]>();
  const add = (xs: readonly Candidate[]): void => {
    for (const c of xs) byKind.set(c.fact.kind, [...(byKind.get(c.fact.kind) ?? []), c]);
  };
  add(badgeFacts(w));
  add(championFacts(w));
  add(raidFacts(near));
  add(swarmFacts(dayStart, near));
  add(eventFacts(events, near));
  add(ecoFacts({ ...w, eco: w.eco.filter((e) => near.has(e.zoneId)) }));
  add(bountyFacts(w, near));
  add(claimFacts(w, near));
  add(campFacts(w, near));
  add(nemesisFacts({ ...w, nemeses: local(w.nemeses) }));
  add(weatherFacts(nearList.slice(1)));
  add(marketFacts(w, dayStart));
  add(cupFacts(dayStart));
  // each kind: local first, then as built (each builder orders its own)
  for (const [k, xs] of byKind) byKind.set(k, xs.map((c, i) => ({ c, i })).sort((a, b) => Number(b.c.local) - Number(a.c.local) || a.i - b.i).map((x) => x.c).slice(0, PER_KIND));
  const rng = createRng(`${worldSeed}:rumours:${town}:${dayKey(dayStart)}`);
  const kinds = [...WORLD_KINDS];
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j]!, kinds[i]!];
  }
  // kinds with local news go first, in the seeded order
  kinds.sort((a, b) => Number(byKind.get(b)?.[0]?.local ?? false) - Number(byKind.get(a)?.[0]?.local ?? false));
  const out: RumourFact[] = [];
  const seen = new Set<string>();
  for (let round = 0; round < PER_KIND && out.length < RUMOUR_WORLD_MAX; round++) {
    for (const k of kinds) {
      const c = byKind.get(k)?.[round];
      if (c === undefined || seen.has(c.fact.id)) continue;
      seen.add(c.fact.id);
      out.push(c.fact);
      if (out.length >= RUMOUR_WORLD_MAX) break;
    }
  }
  return out;
}

// ---- about the caller -----------------------------------------------------------------------------------------------

/** What the town says the player did to a villager, from the town's side. */
const DEED_TEXT: Readonly<Record<NpcDeed, ((who: string, npc: string) => string) | null>> = {
  hit: (who, npc) => `${who} hit ${npc}.`,
  insulted: (who, npc) => `${who} insulted ${npc}.`,
  threatened: (who, npc) => `${who} threatened ${npc}.`,
  robbed: (who, npc) => `${who} robbed ${npc}.`,
  kindWords: null,
  giftReceived: (who, npc) => `${npc} gave ${who} a gift.`,
  giftGiven: (who, npc) => `${who} gave ${npc} a gift.`,
  battleWon: (who, npc) => `${who} beat ${npc} in a battle.`,
  battleLost: (who, npc) => `${npc} beat ${who} in a battle.`,
  helped: (who, npc) => `${who} did ${npc} a favour.`,
  haggledRudely: (who, npc) => `${who} haggled rudely with ${npc}.`,
};

const STANDING_TEXT: Readonly<Record<string, ((town: string, who: string) => string) | null>> = {
  hostile: (town, who) => `${town} has turned against ${who}.`,
  wary: (town, who) => `${town} is wary of ${who}.`,
  neutral: null,
  liked: (town, who) => `${town} has taken a liking to ${who}.`,
  trusted: (town, who) => `${town} trusts ${who}.`,
};

/** The town's gossip about the player (`username`): its villagers' notable deeds, newest first, and its feeling. */
export function gossipRumours(town: ZoneId, username: string, memories: readonly NpcMemory[]): RumourFact[] {
  const z = zoneById(town);
  const name = placeName(town);
  const out: RumourFact[] = [];
  const score = townScore(memories.map((m) => m.standing));
  const standing = STANDING_TEXT[standingOf(score)];
  for (const g of gossipFrom(z, '', memories)) {
    const say = DEED_TEXT[g.deed];
    if (say === null || say === undefined) continue;
    out.push(fact('gossip', `${g.npcId}:${g.deed}`, say(username, g.npcName.split(',')[0]!.trim()), { zoneId: town }));
    if (out.length >= RUMOUR_GOSSIP_MAX - (standing ? 1 : 0)) break;
  }
  if (standing && memories.length > 0) out.push(fact('standing', town, standing(name, username), { zoneId: town }));
  return out.slice(0, RUMOUR_GOSSIP_MAX);
}

// ---- reads and the cache ------------------------------------------------------------------------------------------

/** The rows behind `town`'s board for the day starting `dayStart`. */
export async function gatherWorld(repos: Repos, tx: Tx, town: ZoneId, dayStart: number, nowMs: number, ecosystemOn: boolean): Promise<RumourWorld> {
  const from = new Date(dayStart - DAY_MS);
  const to = new Date(dayStart);
  const near = rumourZones(town);
  const eco: Ecosystem[] = [];
  if (ecosystemOn) {
    for (const id of near) {
      const e = await readEcosystem(repos, tx, id, dayStart);
      if (e !== null) eco.push(e);
    }
  }
  const claims = (await repos.bounties.recentClaims(tx, 50)).filter((b) => b.claimedAt !== null && b.claimedAt >= from && b.claimedAt < to);
  return {
    badges: await repos.worldNews.badgesBetween(tx, from, to, 200),
    champions: await repos.worldNews.splitsBetween(tx, 'champion', from, to, 20),
    camps: await repos.worldNews.campTakeovers(tx, from, to, 20),
    nemeses: await repos.worldNews.risingNemeses(tx, near, RUMOUR_NEMESIS_MIN_RANK, 10),
    bounties: await repos.bounties.open(tx, new Date(nowMs), 20),
    claims,
    sales: await repos.worldNews.salesBetween(tx, new Date(dayStart - 14 * DAY_MS), to, 2000),
    eco,
  };
}

/**
 * The world part of every board, built once per UTC day and town (a read in flight is shared). Yesterday's boards go
 * when a new day's first board is built.
 */
export class RumourBoard {
  private readonly boards = new Map<string, Promise<RumourFact[]>>();
  private day = '';

  /** `town`'s world facts for the day of `nowMs`, built by `build` on the day's first read. */
  get(town: ZoneId, nowMs: number, build: (dayStart: number) => Promise<RumourFact[]>): Promise<RumourFact[]> {
    const start = dayStartOf(nowMs);
    const day = dayKey(start);
    if (day !== this.day) {
      this.boards.clear();
      this.day = day;
    }
    const cached = this.boards.get(town);
    if (cached !== undefined) return cached;
    const p = build(start);
    this.boards.set(town, p);
    // a failed build is not kept: the next read tries again
    p.catch(() => {
      if (this.boards.get(town) === p) this.boards.delete(town);
    });
    return p;
  }

  /** boards held (tests) */
  get size(): number {
    return this.boards.size;
  }
}
