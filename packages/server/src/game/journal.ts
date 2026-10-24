/**
 * The adventure journal (LLM feature 9): a play day (the UTC day) as a digest of short first-person facts, read from
 * what the server already keeps. The client asks the model for the diary entry from these facts and checks it against
 * them; the facts are also its fallback and the chips under each entry, so every name and number in them is real.
 *
 * Sources, all inside the day's window [00:00, 24:00) UTC:
 * - creature history (`creature_events` of the creatures the player owns now): catches (and shinies), gifts, eggs
 *   hatched, evolutions, legendaries, nemeses caught or brought down;
 * - badges and the Champion split (the run splits);
 * - battle history: the rival and villagers by name, league leaders lost to, route trainers, wild battles and the
 *   arena counted;
 * - audit rows: favours handed in (`npc.quest.claim`), haggles (`shop.haggle`), raids cleared (`raid.clear`), bounties
 *   brought in (`bounty.claim`);
 * - NPC memory: the deeds done to villagers that day (hit, insulted, threatened, robbed, gifts, kind words).
 * - the zones the day touched (where its battles, catches, deeds and favours happened): the game keeps no visit log, so
 *   a zone only walked through is not in it.
 *
 * `buildDigest` is pure: the same rows give the same facts in the same order (`KIND_ORDER`, then first seen), at most
 * `JOURNAL_FACTS_MAX`.
 */
import { BADGES, LEAGUE, RAID_HOTSPOTS, SPECIES, ZONES, rivalNameOf, zone as zoneById } from '@ewa/content';
import type { ZoneId } from '@ewa/content';
import type { JournalAudit, JournalBattle, JournalCreatureEvent, JournalMemory, Repos, Tx } from '@ewa/persist';
import { JOURNAL_FACTS_MAX, JOURNAL_TEXT_MAX, shopkeeperName, villagerNpcId } from '@ewa/protocol';
import type { JournalFact, JournalFactKind } from '@ewa/protocol';
import { DAY_MS, dayKey } from '../liveops/schedule';
import { npcInZone } from './npcMemory';

/** The audit actions a day reads. */
export const JOURNAL_ACTIONS: readonly string[] = ['npc.quest.claim', 'shop.haggle', 'raid.clear', 'bounty.claim'];

/** The rows one day is told from (`gatherDay`). */
export interface JournalDayRows {
  readonly events: readonly JournalCreatureEvent[];
  readonly battles: readonly JournalBattle[];
  readonly audits: readonly JournalAudit[];
  readonly badges: readonly { readonly badgeId: string; readonly at: Date }[];
  readonly splits: readonly { readonly split: string; readonly at: Date }[];
  readonly memories: readonly JournalMemory[];
}

export const EMPTY_DAY: JournalDayRows = Object.freeze({ events: [], battles: [], audits: [], badges: [], splits: [], memories: [] });

const KIND_ORDER: readonly JournalFactKind[] = ['badge', 'champion', 'legendary', 'shiny', 'caught', 'hatched', 'evolved', 'received', 'rival', 'league', 'villager', 'trainers', 'wild', 'pvp', 'raid', 'bounty', 'nemesis', 'favour', 'haggle', 'deed', 'zones'];

const speciesById = new Map(SPECIES.map((s) => [s.id, s]));
const zoneIds = new Set<string>(ZONES.map((z) => z.id));
const spName = (id: string): string => speciesById.get(id)?.name ?? id;
const spType = (id: string | null): string | null => (id === null ? null : (speciesById.get(id)?.types[0] ?? null));
/** "Solenne" for "Solenne, the Sun-City" */
export const placeName = (id: string): string => (zoneIds.has(id) ? zoneById(id as ZoneId).name.split(',')[0]! : id);
const list = (xs: readonly string[]): string => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)!}`);
const times = (n: number, one: string, many: string): string => (n === 1 ? one : `${n} ${many}`);
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** The name a villager goes by in the journal ("Hessa Dunmore", "Juniper"), or null when it is not one. */
export function npcName(npcId: string, zoneHint: string | null = null): string | null {
  const zoneId = zoneHint ?? npcId.split('.')[0] ?? '';
  if (!zoneIds.has(zoneId)) return null;
  const who = npcInZone(zoneById(zoneId as ZoneId), npcId);
  if (who === null) return null;
  return who.name.split(',')[0]!.trim();
}

/** A league trainer's name, else null. */
function leagueName(trainerId: string): string | null {
  return LEAGUE.find((l) => l.id === trainerId)?.name ?? null;
}

interface Draft {
  readonly kind: JournalFactKind;
  readonly key: string;
  text: string;
  speciesId: string | null;
  zoneId: string | null;
  type: string | null;
  count: number;
  readonly first: number;
}

/** The day's facts from its rows. Pure. */
export function buildDigest(rows: JournalDayRows, dayStart: number): JournalFact[] {
  const dayEnd = dayStart + DAY_MS;
  const drafts = new Map<string, Draft>();
  let seq = 0;
  const put = (kind: JournalFactKind, key: string, init: () => Omit<Draft, 'kind' | 'key' | 'first' | 'count'>, bump = 1): Draft => {
    const k = `${kind}:${key}`;
    const have = drafts.get(k);
    if (have !== undefined) {
      have.count += bump;
      return have;
    }
    const d: Draft = { kind, key: k, count: bump, first: seq++, ...init() };
    drafts.set(k, d);
    return d;
  };
  const zonesSeen: string[] = [];
  const catchZones = new Map<string, Set<string | null>>();
  const seenZone = (z: string | null): void => {
    if (z !== null && zoneIds.has(z) && !zonesSeen.includes(z)) zonesSeen.push(z);
  };

  // ---- the creatures ----
  for (const e of rows.events) {
    const d = e.detail;
    if (e.kind === 'met' && d['how'] === 'caught') {
      const sp = str(d['speciesId']) ?? e.speciesId;
      const z = str(d['zoneId']);
      seenZone(z);
      // a shiny is its own fact, not counted again with the plain catches (the model said "another" for the same one)
      if (e.isShiny) {
        put('shiny', sp, () => ({ text: '', speciesId: sp, zoneId: z, type: spType(sp) }));
        continue;
      }
      put('caught', sp, () => ({ text: '', speciesId: sp, zoneId: z, type: spType(sp) }));
      // "on Mire Route" only when every catch of the species was there
      const where = catchZones.get(sp) ?? new Set<string | null>();
      where.add(z);
      catchZones.set(sp, where);
    } else if (e.kind === 'met') {
      const sp = str(d['speciesId']) ?? e.speciesId;
      put('received', sp, () => ({ text: '', speciesId: sp, zoneId: null, type: spType(sp) }));
    } else if (e.kind === 'hatched') {
      const sp = str(d['speciesId']) ?? e.speciesId;
      const z = str(d['zoneId']);
      seenZone(z);
      put('hatched', sp, () => ({ text: '', speciesId: sp, zoneId: z, type: spType(sp) }));
    } else if (e.kind === 'evolved') {
      const from = str(d['from']);
      const into = str(d['into']);
      if (from !== null && into !== null) put('evolved', `${from}>${into}`, () => ({ text: `My ${spName(from)} evolved into ${spName(into)}.`, speciesId: into, zoneId: null, type: spType(into) }));
    } else if (e.kind === 'legendary') {
      const sp = str(d['species']);
      if (sp !== null) put('legendary', sp, () => ({ text: d['caught'] === true ? `I caught the legendary ${spName(sp)}!` : `I met the legendary ${spName(sp)}.`, speciesId: sp, zoneId: null, type: spType(sp) }));
    } else if (e.kind === 'nemesis') {
      const name = str(d['name']);
      const sp = str(d['speciesId']);
      const z = str(d['zoneId']);
      seenZone(z);
      if (name !== null) {
        const text = d['how'] === 'caught' ? `I caught my nemesis ${name}.` : `My ${e.nickname ?? spName(e.speciesId)} brought down my nemesis ${name}.`;
        put('nemesis', name, () => ({ text, speciesId: sp, zoneId: z, type: spType(sp) }));
      }
    }
  }

  // ---- badges and the Champion ----
  for (const b of rows.badges) {
    const def = BADGES.find((x) => x.id === b.badgeId);
    const leader = LEAGUE.find((l) => l.badge === b.badgeId);
    put('badge', b.badgeId, () => ({ text: `I won the ${def?.name ?? b.badgeId}${leader ? ` from ${leader.name}` : ''}!`, speciesId: null, zoneId: leader?.zoneId ?? null, type: def?.type ?? null }));
  }
  if (rows.splits.some((s) => s.split === 'champion')) put('champion', 'champion', () => ({ text: 'I beat the Champion!', speciesId: null, zoneId: 'solenne', type: null }));

  // ---- battles ----
  let trainerWins = 0;
  let trainerLosses = 0;
  let wildWins = 0;
  let wildLosses = 0;
  let pvpWins = 0;
  let pvpGames = 0;
  let raids = 0;
  const badgeLeaders = new Set(rows.badges.map((b) => LEAGUE.find((l) => l.badge === b.badgeId)?.id).filter((x): x is string => x !== undefined));
  for (const b of rows.battles) {
    seenZone(b.zoneId);
    const won = b.result === 'win';
    const lost = b.result === 'loss';
    if (!won && !lost && b.result !== 'draw') continue;
    const rival = rivalNameOf(b.opponent);
    const villager = villagerNpcId(b.opponent);
    if (rival !== null) {
      const where = b.zoneId !== null ? ` on ${placeName(b.zoneId)}` : '';
      const text = won ? `I beat my rival ${rival}${where}.` : lost ? `My rival ${rival} beat me${where}.` : `My rival ${rival} and I fought to a draw${where}.`;
      put('rival', `${rival}:${b.result}`, () => ({ text, speciesId: null, zoneId: b.zoneId, type: null }));
    } else if (villager !== null) {
      const name = npcName(villager, b.zoneId);
      if (name === null) continue;
      const text = won ? `I beat ${name} in a battle.` : lost ? `${name} beat me in a battle.` : `${name} and I fought to a draw.`;
      put('villager', `${villager}:${b.result}`, () => ({ text, speciesId: null, zoneId: b.zoneId, type: null }));
    } else if (b.format === 'league') {
      const name = leagueName(b.opponent);
      // the badge, or the Champion beaten, says that win already
      const champion = LEAGUE.find((l) => l.id === b.opponent)?.stage === 'champion' && rows.splits.some((x) => x.split === 'champion');
      if (name === null || (won && (badgeLeaders.has(b.opponent) || champion))) continue;
      put('league', `${b.opponent}:${b.result}`, () => ({ text: won ? `I beat ${name}.` : `${name} beat me.`, speciesId: null, zoneId: b.zoneId, type: null }));
    } else if (b.format === 'trainer') {
      // route trainers, ghost trainers and camp guards alike
      if (won) trainerWins++;
      if (lost) trainerLosses++;
    } else if (b.format === 'wild') {
      if (won) wildWins++;
      if (lost) wildLosses++;
    } else if (b.format === 'pvp') {
      pvpGames++;
      if (won) pvpWins++;
    } else if (b.format === 'raid') {
      raids++;
    }
  }
  if (trainerWins + trainerLosses > 0) {
    const text =
      trainerWins > 0 && trainerLosses > 0
        ? `I beat ${times(trainerWins, 'a trainer', 'trainers')} and lost to ${times(trainerLosses, 'one', 'others')}.`
        : trainerWins > 0
          ? `I beat ${times(trainerWins, 'a trainer', 'trainers')}.`
          : `I lost to ${times(trainerLosses, 'a trainer', 'trainers')}.`;
    put('trainers', 'trainers', () => ({ text, speciesId: null, zoneId: null, type: null }), trainerWins + trainerLosses);
  }
  if (wildWins + wildLosses > 0) {
    const text =
      wildLosses === 0
        ? `I won ${times(wildWins, 'a battle', 'battles')} against wild Ewamon.`
        : wildWins === 0
          ? `I lost ${times(wildLosses, 'a battle', 'battles')} against wild Ewamon.`
          : `I won ${wildWins} and lost ${wildLosses} battles against wild Ewamon.`;
    put('wild', 'wild', () => ({ text, speciesId: null, zoneId: null, type: null }), wildWins + wildLosses);
  }
  if (pvpGames > 0) put('pvp', 'pvp', () => ({ text: `I won ${pvpWins} of ${pvpGames} arena battles.`, speciesId: null, zoneId: null, type: null }), pvpGames);

  // ---- audit rows: favours, haggles, raids, bounties ----
  for (const a of rows.audits) {
    const d = a.detail;
    const z = str(d['zone']);
    if (a.action === 'npc.quest.claim' && a.subject !== null) {
      seenZone(z);
      const name = npcName(a.subject, z);
      if (name !== null) put('favour', a.subject, () => ({ text: `I did a favour for ${name}, and was paid for it.`, speciesId: null, zoneId: z, type: null }));
    } else if (a.action === 'shop.haggle' && a.subject !== null) {
      seenZone(z);
      const keeper = shopkeeperName(a.subject);
      const granted = num(d['granted']) ?? 0;
      if (d['kind'] === 'markup') put('haggle', `${a.subject}:markup`, () => ({ text: `I was rude to ${keeper} at the shop, and the prices went up.`, speciesId: null, zoneId: z, type: null }));
      else if (granted > 0) put('haggle', `${a.subject}:deal`, () => ({ text: `I haggled ${keeper} down ${granted}% at the shop.`, speciesId: null, zoneId: z, type: null }));
    } else if (a.action === 'raid.clear') {
      const h = RAID_HOTSPOTS.find((x) => x.id === str(d['hotspot']));
      if (h !== undefined) {
        seenZone(h.zoneId);
        put('raid', h.id, () => ({ text: `I helped clear a ${spName(h.boss.species)} raid on ${placeName(h.zoneId)}.`, speciesId: h.boss.species, zoneId: h.zoneId, type: spType(h.boss.species) }));
      }
    } else if (a.action === 'bounty.claim') {
      const target = str(d['target']);
      const payout = num(d['payout']);
      if (target !== null && payout !== null) put('bounty', a.subject ?? target, () => ({ text: `I brought in ${target} for a ${payout.toLocaleString('en-US')} bounty.`, speciesId: null, zoneId: null, type: null }));
    }
  }
  if (raids > 0 && ![...drafts.values()].some((x) => x.kind === 'raid')) put('raid', 'raids', () => ({ text: `I fought in ${times(raids, 'a raid', 'raids')}.`, speciesId: null, zoneId: null, type: null }), raids);

  // ---- deeds done to villagers (NPC memory) ----
  const DEED_TEXT: Readonly<Record<string, ((names: string) => string) | null>> = {
    hit: (n) => `I hit ${n}.`,
    insulted: (n) => `I insulted ${n}.`,
    threatened: (n) => `I threatened ${n}.`,
    robbed: (n) => `I robbed ${n}.`,
    kindWords: (n) => `I had kind words for ${n}.`,
    giftGiven: (n) => `I gave ${n} a gift.`,
    giftReceived: (n) => `${n} gave me a gift.`,
  };
  const deedNames = new Map<string, string[]>();
  const deedOrder: string[] = [];
  for (const m of rows.memories) {
    for (const deed of m.deeds) {
      const t = Date.parse(deed.at);
      if (!(t >= dayStart && t < dayEnd) || DEED_TEXT[deed.deed] == null) continue;
      // a discount won by haggling is a gift in NPC memory: the haggle says it already
      if (deed.deed === 'giftReceived' && [...drafts.values()].some((x) => x.kind === 'haggle')) continue;
      const name = npcName(m.npcId, m.zoneId);
      if (name === null) continue;
      seenZone(m.zoneId);
      const names = deedNames.get(deed.deed) ?? [];
      if (!names.includes(name)) names.push(name);
      deedNames.set(deed.deed, names);
      if (!deedOrder.includes(deed.deed)) deedOrder.push(deed.deed);
    }
  }
  for (const deed of deedOrder) {
    const names = deedNames.get(deed)!;
    const shown = names.length > 2 ? [...names.slice(0, 2), `${names.length - 2} more`] : names;
    put('deed', deed, () => ({ text: DEED_TEXT[deed]!(list(shown)), speciesId: null, zoneId: null, type: null }), names.length);
  }

  // ---- the texts that depend on counts ----
  for (const d of drafts.values()) {
    if (d.kind === 'caught' && (catchZones.get(d.speciesId!)?.size ?? 1) > 1) d.zoneId = null;
    if (d.kind === 'caught') d.text = `I caught ${d.count === 1 ? `a ${spName(d.speciesId!)}` : `${d.count} ${spName(d.speciesId!)}`}${d.zoneId !== null ? ` on ${placeName(d.zoneId)}` : ''}.`;
    else if (d.kind === 'shiny') d.text = d.count === 1 ? `I caught a shiny ${spName(d.speciesId!)}!` : `I caught ${d.count} shiny ${spName(d.speciesId!)}!`;
    else if (d.kind === 'received') d.text = d.count === 1 ? `I was given a ${spName(d.speciesId!)}.` : `I was given ${d.count} ${spName(d.speciesId!)}.`;
    else if (d.kind === 'hatched') d.text = `${d.count === 1 ? `A ${spName(d.speciesId!)}` : `${d.count} ${spName(d.speciesId!)}`} hatched from my eggs${d.zoneId !== null ? ` at the ${placeName(d.zoneId)} Daycare` : ''}.`;
  }
  if (zonesSeen.length > 0) {
    const shown = zonesSeen.length > 4 ? [...zonesSeen.slice(0, 4).map(placeName), `${zonesSeen.length - 4} more places`] : zonesSeen.map(placeName);
    put('zones', 'zones', () => ({ text: `I was on ${list(shown)}.`, speciesId: null, zoneId: zonesSeen[0]!, type: null }), zonesSeen.length);
  }
  const rank = (k: JournalFactKind): number => KIND_ORDER.indexOf(k);
  return [...drafts.values()]
    .sort((a, b) => rank(a.kind) - rank(b.kind) || a.first - b.first)
    .slice(0, JOURNAL_FACTS_MAX)
    .map((d) => ({ kind: d.kind, text: d.text.slice(0, 200), speciesId: d.speciesId, zoneId: d.zoneId, type: d.type, count: Math.max(1, d.count) }));
}

/** The UTC midnight that starts the day `day` (`YYYY-MM-DD`), or null for a malformed key. */
export function dayStartOfKey(day: string): number | null {
  const t = Date.parse(`${day}T00:00:00Z`);
  return Number.isNaN(t) || dayKey(t) !== day ? null : t;
}

/** "Day 12": the player's day, counted from the UTC day the account was made (1). */
export function dayNumberOf(createdAt: Date, dayStart: number): number {
  const born = Math.floor(createdAt.getTime() / DAY_MS) * DAY_MS;
  return Math.max(1, Math.floor((dayStart - born) / DAY_MS) + 1);
}

/** An entry as stored: control characters out, em-dashes to commas, whitespace collapsed, cut at a sentence to fit. */
export function cleanEntry(text: string): string {
  const dash = new RegExp(`\\s*[${String.fromCharCode(0x2014, 0x2015)}]\\s*`, 'g');
  const t = text
    .replace(/\p{Cc}/gu, ' ')
    .replace(dash, ', ')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length <= JOURNAL_TEXT_MAX) return t;
  const cut = t.slice(0, JOURNAL_TEXT_MAX);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return end > 40 ? cut.slice(0, end + 1) : `${cut.slice(0, JOURNAL_TEXT_MAX - 1).trimEnd()}…`;
}

/** The rows of the day starting `dayStart` for the player. */
export async function gatherDay(repos: Repos, tx: Tx, playerId: string, dayStart: number): Promise<JournalDayRows> {
  const from = new Date(dayStart);
  const to = new Date(dayStart + DAY_MS);
  return {
    events: await repos.journal.creatureEvents(tx, playerId, from, to),
    battles: await repos.journal.battles(tx, playerId, from, to),
    audits: await repos.journal.audit(tx, playerId, JOURNAL_ACTIONS, from, to),
    badges: await repos.journal.badges(tx, playerId, from, to),
    splits: await repos.journal.splits(tx, playerId, from, to),
    memories: await repos.journal.memories(tx, playerId),
  };
}
