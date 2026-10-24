/**
 * The rumour board (LLM feature 8): the town crier's words. The server builds the day's facts for a town (`GET
 * /world/rumours/:zoneId`: yesterday's badges and Champion wins, raids and the swarm, the ecosystem, bounties, camps,
 * nemeses, the market, the cup, the sky, and the town's gossip about the player), each one plain sentence whose names
 * and numbers are true. This module asks the model to say one fact as a crier's rumour, checks what comes back against
 * that sentence (`checkRumour`), and keeps the words for the day (`RumourCache`: memory and localStorage, so each fact is
 * written once a day). A template (`templateRumour`: a crier's lead-in and the fact) shows at once and whenever the
 * model is down, slow or wrong.
 *
 * The checks: feature 5's `ungrounded` (no game name or number the fact does not hold) and `wrongTypeClaims`; no other
 * capitalised name (a username, an invented person) the fact or the town does not hold; no number word the fact does
 * not hold ("three trainers"); at least one name or number of the fact kept; the time kept (a "yesterday" fact never
 * becomes "today" and back); the turn of a fact kept (a price "up" stays up; "robbed" stays robbed, a favour stays a
 * favour: `KEEP`).
 *
 * Measured on gemma4-e2b (the docker model, 2026-10-24, CPU, reasoning off, temperature 0.7, 80 tokens), the 17 facts
 * three boards build from a test world (a nemesis, a camp that changed hands, a bounty brought in, two raids, two
 * wanted ghosts, a swarm, the sky of two routes, a market swing, the Champion beaten, two badges, the cup) plus three
 * about a player (robbed a villager, did one a favour, the town wary of them), one call per fact:
 * - First prompt ("calling the news in the square. Say it as a rumour in one or two short sentences"): 14 of 17 kept,
 *   1.4 to 2.9 s (median 1.9 s). The model restates the fact more than it gossips ("Camp on Mire Route changed hands
 *   yesterday. Dunst holds it now."). Two drops were the checker's fault ("1500" for "1,500"; "Two trainers" read as an
 *   invented name), one was right ("Galvan Span has Ampmite Gustuff and Darkone": the swarm was gone).
 * - Fixes: numbers compared without thousands commas, number words skipped by the name check, a sentence that repeats
 *   an earlier one dropped (it said the weather twice in 1 of 17), a crier's call tacked on at the end moved to the
 *   front, the badge fact reworded ("2 trainers won badges yesterday, and bram won the Ember Badge.": the first wording
 *   came back as "Bram the Ember Badge is theirs"), and the prompt asks for "lively gossip ... with a little colour".
 * - Shipped, 2 rounds of the 17 (34 calls): 34 of 34 kept, 0.6 to 2.8 s (median 1.3 s; llama.cpp's prompt cache keeps
 *   the shared prefix warm, a cold board's first call is about 2.5 s). By hand: no wrong name, number, place, side or
 *   time among them; the colour is thin and sometimes off the fact ("Cora is the new monster catcher", "the weather in
 *   Mirevale is a bit damp today" for a Mire Route fact), and the model drops list commas ("Ampmite Gustuff and
 *   Darkone"). Hear-ye calls in 7 of 34.
 * - Live (the alt pair, a fresh board of 6 facts in Mirevale): the facts showed at once, the six words came back one
 *   by one in 12.8 s in all, and the crier's board read again showed them at once from the day's cache.
 */
import { NO_DASHES, chatOnce, noDashes } from './llm';
import type { LlmMessage } from './llm';
import { ungrounded, wrongTypeClaims } from './professorFacts';

/** What the client needs of a fact (protocol `RumourFact`). */
export interface RumourFactLike {
  readonly id: string;
  readonly kind: string;
  readonly text: string;
}

/** a rumour the model has not written by then is not waited for: the template stays */
export const RUMOUR_TIMEOUT_MS = 15_000;
const MAX_TOKENS = 80;
/** a rumour longer than this is cut at a sentence, or dropped */
export const RUMOUR_MAX = 220;

export const RUMOUR_SYSTEM = `You retell one true piece of news from a monster-catching game in a few words. ${NO_DASHES}`;

/** The call's messages: a neutral system prompt; the fact, the town and the crier in the user turn. */
export function rumourMessages(f: RumourFactLike, town: string): LlmMessage[] {
  return [
    { role: 'system', content: RUMOUR_SYSTEM },
    {
      role: 'user',
      content:
        `The news, all true: "${f.text}"\n\n` +
        `You are the town crier of ${town}. Call this news out to the square as lively gossip, in one or two short sentences with a little colour. ` +
        'Keep every name and number exactly as written, and add no other names, numbers, places or Ewamon. Do not change what happened or when. ' +
        NO_DASHES,
    },
  ];
}

// ---- the checks -----------------------------------------------------------------------------------------------------

/** Capitalised words a crier may say that no fact holds. */
const CRIER_WORDS = new Set([
  'a',
  'an',
  'the',
  'hear',
  'ye',
  'oh',
  'word',
  'news',
  'they',
  'it',
  'its',
  'i',
  'we',
  'you',
  'and',
  'but',
  'so',
  'now',
  'today',
  'yesterday',
  'this',
  'that',
  'town',
  'crier',
  'folk',
  'friends',
  'good',
  'people',
  'listen',
  'attention',
  'rumour',
  'rumor',
  'gossip',
  'travellers',
  'traveller',
  'trainers',
  'trainer',
  'utc',
  'ewamon',
  'beware',
  'mark',
  'some',
  'there',
  'what',
  'who',
  'all',
  'everyone',
  'one',
  'fresh',
  'tidings',
  'did',
  'have',
  'has',
  'is',
  'are',
  'was',
  'if',
  'when',
  'come',
  'rumours',
  'rumors',
  'can',
  'my',
  'our',
  'their',
  'his',
  'her',
  'he',
  'she',
]);

const NUMBER_WORDS: Readonly<Record<string, number>> = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twenty: 20, thirty: 30, hundred: 100, thousand: 1000 };

const lower = (s: string): string => s.toLowerCase();
const wordsOf = (s: string): string[] => s.match(/[A-Za-z][A-Za-z'_]*|\d[\d,]*/g) ?? [];

/** Capitalised words of `text`, not at the start of a sentence, that neither the fact nor the town holds. */
export function strangeNames(text: string, fact: string, town: string): string[] {
  const src = lower(`${fact} ${town}`);
  const out: string[] = [];
  for (const m of text.matchAll(/[A-Z][A-Za-z'_]*/g)) {
    const i = m.index ?? 0;
    // inside a word ("McTavish", "UTC" after a digit) is part of that word
    if (i > 0 && /[A-Za-z0-9'_]/.test(text[i - 1]!)) continue;
    const before = text.slice(0, i).trimEnd();
    const sentenceStart = before === '' || /[.!?:]["”']?$/.test(before);
    const w = m[0];
    if (sentenceStart && (CRIER_WORDS.has(lower(w)) || NUMBER_WORDS[lower(w)] !== undefined)) continue;
    if (CRIER_WORDS.has(lower(w)) && !/^[A-Z]{2,}$/.test(w)) continue;
    if (!new RegExp(`(^|[^a-z])${lower(w).replace(/[^a-z0-9_']/g, '')}($|[^a-z])`).test(src)) out.push(w);
  }
  return [...new Set(out)];
}

/** Number words ("three trainers") the fact does not hold as a digit or a word. */
export function strangeNumbers(text: string, fact: string): string[] {
  const src = lower(fact);
  const out: string[] = [];
  for (const w of wordsOf(lower(text))) {
    const n = NUMBER_WORDS[w];
    if (n === undefined) continue;
    if (!new RegExp(`(^|[^0-9])${n}($|[^0-9])`).test(src.replace(/,/g, '')) && !new RegExp(`\\b${w}\\b`).test(src)) out.push(w);
  }
  return out;
}

/** The names and numbers of a fact (its anchors: a rumour keeps one at least). */
export function anchorsOf(fact: string): string[] {
  const out = new Set<string>();
  for (const m of fact.matchAll(/\d[\d,]*/g)) out.add(m[0]);
  fact.split(/(?<=[.!?])\s+/).forEach((sentence) => {
    const ws = sentence.match(/[A-Za-z][A-Za-z'_]*/g) ?? [];
    ws.forEach((w, i) => {
      if (i === 0 && CRIER_WORDS.has(lower(w))) return;
      if (/^[A-Z]/.test(w) && !CRIER_WORDS.has(lower(w))) out.add(w);
    });
  });
  // a lowercase username at the start of a fact is a name too ("red insulted a child.")
  const first = /^([a-z0-9_]{3,20}) (won|beat|brought|hit|insulted|threatened|robbed|gave|did|haggled)\b/.exec(fact);
  if (first) out.add(first[1]!);
  return [...out];
}

/** The words that carry a fact's turn: a rumour keeps one of each group. */
export const KEEP: readonly (readonly [RegExp, RegExp])[] = [
  // [the fact says this, the rumour must say one of these]
  [/\bup from\b/, /\b(up|rose|risen|climb|climbed|climbing|higher|more)\b/i],
  [/\bdown from\b/, /\b(down|fell|fallen|dropped|drop|lower|less|cheaper)\b/i],
  [/\brobbed\b/, /\b(rob|robbed|robbing|stole|stolen|thief)\b/i],
  [/\bhit\b/, /\b(hit|struck|slapped|punched|hitting)\b/i],
  [/\binsulted\b/, /\b(insult|insulted|insulting|rude)\b/i],
  [/\bthreatened\b/, /\b(threat|threats|threatened|threatening)\b/i],
  [/\ba favour\b/, /\b(favour|favor|help|helped|helping)\b/i],
  [/\bgave .* a gift\b/, /\b(gift|gave|present)\b/i],
  [/\bhaggled rudely\b/, /\b(haggl\w*|rude\w*|barter\w*)\b/i],
  [/\bbeat the Champion\b/, /\bChampion\b/],
  [/\bwanted\b/, /\b(wanted|bounty)\b/i],
  [/\bscarce\b/, /\b(scarce|rare|few|fewer|overhunt\w*|hunted)\b/i],
  [/\bsurging\b/, /\b(surg\w*|thriv\w*|many|more|plenty|plentiful|booming|abundant)\b/i],
  [/\bchanged hands\b/, /\b(camp)\b/i],
  [/\braid\b/, /\braid\b/i],
  [/\bswarming\b/, /\b(swarm\w*|teem\w*|crawling|full|plenty)\b/i],
  [/\bwary of\b/, /\b(wary|careful|distrust\w*|suspicious|uneasy)\b/i],
  [/\bturned against\b/, /\b(against|hostile|hate|hates|angry|turned)\b/i],
  [/\btrusts\b/, /\b(trust\w*)\b/i],
  [/\ba liking\b/, /\b(lik\w*|fond|warm\w*)\b/i],
];

/** What a rumour lost or turned around from its fact (empty = kept). */
export function turnsLost(text: string, fact: string): string[] {
  const out: string[] = [];
  for (const [has, needs] of KEEP) if (has.test(fact) && !needs.test(text)) out.push(needs.source);
  const t = lower(text);
  if (/\byesterday\b/.test(fact) && /\b(today|tonight|right now)\b/.test(t) && !/\byesterday\b/.test(t)) out.push('today');
  if (/\btoday\b/.test(fact) && /\byesterday\b/.test(t)) out.push('yesterday');
  if (/\bup from\b/.test(fact) && /\b(down|fell|fallen|dropped|cheaper)\b/.test(t)) out.push('down');
  if (/\bdown from\b/.test(fact) && /\b(rose|risen|climbed|higher|pricier)\b/.test(t)) out.push('up');
  return out;
}

/** A model reply made fit to show: one line, no dashes, quotes and a "Town Crier:" label off, at most two sentences. */
export function tidyRumour(raw: string): string {
  let t = noDashes(raw.replace(/\s+/g, ' ').trim())
    .replace(/^(town crier|crier)\s*:\s*/i, '')
    .replace(/^["“”']+|["“”']+$/g, '')
    .trim();
  const sentences = t.match(/[^.!?]+[.!?]+/g) ?? (t.length > 0 ? [t] : []);
  // a sentence that mostly repeats an earlier one goes (the model says the news twice now and then)
  const kept: string[] = [];
  const seen: string[][] = [];
  for (const raw1 of sentences) {
    const w = raw1.toLowerCase().match(/[a-z0-9']+/g) ?? [];
    if (w.length === 0) continue;
    if (seen.some((p) => w.filter((x) => p.includes(x)).length / w.length >= 0.7)) continue;
    seen.push(w);
    kept.push(raw1.trim());
    if (kept.length >= 2) break;
  }
  // a crier's call tacked on at the end ("... the week before. Hear ye, hear ye!") goes first, where a crier says it
  if (kept.length === 2 && /^(hear ye|oyez|listen)\b/i.test(kept[1]!) && kept[1]!.split(/\s+/).length <= 6) kept.reverse();
  t = kept.join(' ').replace(/\s+/g, ' ').trim();
  if (t.length > RUMOUR_MAX) t = (t.slice(0, RUMOUR_MAX).match(/^[\s\S]*[.!?]/)?.[0] ?? '').trim();
  return t;
}

/** "1,500" and "1500" are the same number to the checks. */
const plainNumbers = (s: string): string => s.replace(/(\d),(?=\d{3}(?![0-9]))/g, '$1');

/** The model's rumour if it holds to the fact, else null (the template shows). */
export function checkRumour(raw: string, f: RumourFactLike, town: string): string | null {
  const text = tidyRumour(raw);
  if (text.length < 12) return null;
  const t = plainNumbers(text);
  const fact = plainNumbers(f.text);
  if (ungrounded(t, [fact, town]).length > 0 || wrongTypeClaims(text).length > 0) return null;
  if (strangeNames(text, fact, town).length > 0 || strangeNumbers(t, fact).length > 0) return null;
  const anchors = anchorsOf(fact);
  if (anchors.length > 0 && !anchors.some((a) => lower(t).includes(lower(a)))) return null;
  if (turnsLost(text, f.text).length > 0) return null;
  return text;
}

// ---- templates ------------------------------------------------------------------------------------------------------

const LEADS: readonly string[] = ['Hear ye, hear ye!', 'Word around {town}:', 'Fresh from the road:', 'The crier calls it:', 'News for {town}:'];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
}

/** The crier's line without the model: a lead-in picked by the fact's id and the fact itself. */
export function templateRumour(f: RumourFactLike, town: string): string {
  const lead = LEADS[hash(f.id) % LEADS.length]!.replace('{town}', town);
  return noDashes(`${lead} ${f.text}`);
}

// ---- the day's words ------------------------------------------------------------------------------------------------

const STORE_PREFIX = 'ewa:rumours:';

interface Stored {
  readonly src: string;
  readonly text: string;
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch (_e) {
    return null;
  }
}

/**
 * The words written today, per day and town: in memory and in localStorage (wrapped: a private window or a full store
 * just keeps them in memory). A word is kept with the fact it was written from, so a fact that changed is written anew.
 * Other days' entries go when a day is saved.
 */
export class RumourCache {
  private readonly mem = new Map<string, Map<string, Stored>>();

  private load(day: string, town: string): Map<string, Stored> {
    const key = `${STORE_PREFIX}${day}:${town}`;
    const have = this.mem.get(key);
    if (have !== undefined) return have;
    const m = new Map<string, Stored>();
    try {
      const raw = storage()?.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, Stored>;
        for (const [id, v] of Object.entries(parsed)) if (typeof v?.src === 'string' && typeof v.text === 'string') m.set(id, { src: v.src, text: noDashes(v.text) });
      }
    } catch (_e) {
      // unreadable: start the day afresh
    }
    this.mem.set(key, m);
    return m;
  }

  /** The words written today for `f` on `town`'s board, else null. */
  get(day: string, town: string, f: RumourFactLike): string | null {
    const s = this.load(day, town).get(f.id);
    return s !== undefined && s.src === f.text ? s.text : null;
  }

  set(day: string, town: string, f: RumourFactLike, text: string): void {
    const m = this.load(day, town);
    m.set(f.id, { src: f.text, text });
    const st = storage();
    if (st === null) return;
    try {
      for (let i = st.length - 1; i >= 0; i--) {
        const k = st.key(i);
        if (k !== null && k.startsWith(STORE_PREFIX) && !k.startsWith(`${STORE_PREFIX}${day}:`)) st.removeItem(k);
      }
      st.setItem(`${STORE_PREFIX}${day}:${town}`, JSON.stringify(Object.fromEntries(m)));
    } catch (_e) {
      // a full or blocked store: memory only
    }
  }
}

export interface RumourOptions {
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
  /** tests inject the model */
  readonly chat?: typeof chatOnce;
}

/** One rumour from the model, checked; null when the model is down, slow or strays from the fact. */
export async function writeRumour(f: RumourFactLike, town: string, o: RumourOptions = {}): Promise<string | null> {
  const chat = o.chat ?? chatOnce;
  try {
    const r = await chat({ messages: rumourMessages(f, town), maxTokens: MAX_TOKENS, temperature: 0.7, timeoutMs: o.timeoutMs ?? RUMOUR_TIMEOUT_MS, ...(o.signal ? { signal: o.signal } : {}) });
    return checkRumour(r.content, f, town);
  } catch (_e) {
    return null;
  }
}
