/**
 * The adventure journal (LLM feature 9): a play day's diary entry in the player's voice. The server reads the day into
 * a digest of short first-person facts ("I caught 2 Mossling on Mire Route.", "My rival Corin beat me on Mire Road.",
 * `GET /journal`); this module asks the model for a 3 to 5 sentence entry that starts "Day 12:", checks it against the
 * facts (`checkEntry`), and falls back to a template made of the facts themselves (`templateEntry`). The entry is
 * stored by the server (`POST /journal/day/:day`), so it is written once a day and read back after.
 *
 * The checks: feature 5's `ungrounded` (no game name or number the facts do not hold) and `wrongTypeClaims`; no other
 * capitalised name mid-sentence and no number word the facts lack (feature 8's `strangeNames` / `strangeNumbers`); no
 * result turned around ("I beat my rival Corin" when Corin won: `resultFlips`); at least two of the facts (or the one)
 * told; the "Day N:" opening fixed when the model writes another number or none.
 *
 * Measured on gemma4-e2b (the docker model, 2026-10-24, CPU, reasoning off, temperature 0.6, 220 tokens), twelve days
 * built by the server's `buildDigest` from test rows (a starter day, a catching day with a shiny, a badge day, a rival
 * win and a villager loss, favours with a haggle and two deeds, the Champion, an evolution and an egg, a raid and a
 * bounty, a losing day, a nemesis and a legendary, a quiet day, a busy mixed day), one call each:
 * - First round (12 calls): 12 of 12 kept, 3.7 to 10.7 s (median 4.8 s). What was wrong came from the digest, not the
 *   model: a shiny counted both as "a shiny Resilian" and among the plain catches came back as "I caught another
 *   Resilian", and the Champion's league win next to "I beat the Champion" became "Then I beat Champion Zeon". Fixed in
 *   the digest (a shiny is only its own fact; the Champion's win is not said twice).
 * - Shipped (2 rounds, 24 calls): 23 of 24 kept, 1.6 to 9.1 s (median 2.7 s; a busy day with six or more facts is the
 *   slow one). The drop was right: "for a one thousand two hundred fifty bounty" (numbers spelled out are not checked,
 *   so they are refused). By hand, no wrong name, number, side or result among the kept 23. The model keeps to the
 *   facts in their order and adds little ("It felt good to win that fight.", "It was a busy day."), turns "2" into
 *   "two", drops a name now and then ("I beat my rival on the Ash Route"), and with three or four short facts it often
 *   gives them back word for word, so its page and the template read alike on a quiet day.
 * - Live (the alt pair, the docker model): opening the Journal wrote Day 1 from four facts in 3.8 s; after a new deed,
 *   reopening showed "More happened since this page was written." and Rewrite today wrote the new page in 6.8 s.
 */
import type { JournalFact } from '@ewa/protocol';
import { NO_DASHES, chatOnce, noDashes } from './llm';
import type { LlmMessage } from './llm';
import { ungrounded, wrongTypeClaims } from './professorFacts';
import { anchorsOf, strangeNames, strangeNumbers } from './rumours';

/** an entry the model has not written by then is not waited for: the template is written */
export const ENTRY_TIMEOUT_MS = 25_000;
const MAX_TOKENS = 220;
/** as the server stores it */
export const ENTRY_MAX = 600;
/** the facts a prompt carries (a busy day keeps its first ones: the server orders them by weight) */
export const PROMPT_FACTS = 10;

export const JOURNAL_SYSTEM = `You write short diary entries for a player of a monster-catching game, using only the facts you are given. ${NO_DASHES}`;

/** The call's messages: a neutral system prompt; the day's facts and the job in the user turn. */
export function entryMessages(dayNumber: number, facts: readonly JournalFact[]): LlmMessage[] {
  const shown = facts.slice(0, PROMPT_FACTS);
  return [
    { role: 'system', content: JOURNAL_SYSTEM },
    {
      role: 'user',
      content:
        `What happened to me on day ${dayNumber} of my journey, all true:\n${shown.map((f) => `- ${f.text}`).join('\n')}\n\n` +
        `Write my diary entry for that day in my own voice, as "I", in 3 to 5 short sentences, starting with "Day ${dayNumber}:". ` +
        'Use only these facts, with no other names or numbers, and keep who won and who lost as they are. You may say how I felt. ' +
        NO_DASHES,
    },
  ];
}

// ---- the checks -----------------------------------------------------------------------------------------------------

const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The names a fact says the player beat, and the ones that beat the player. */
function results(facts: readonly JournalFact[]): { readonly beat: string[]; readonly lostTo: string[] } {
  const beat: string[] = [];
  const lostTo: string[] = [];
  for (const f of facts) {
    const w = /^I beat (?:my rival )?(.+?)(?: in a battle| on .+)?[.!]$/.exec(f.text);
    if (w && !/^\d|trainer/.test(w[1]!)) beat.push(w[1]!);
    const l = /^(?:My rival )?(.+?) beat me(?: in a battle| on .+)?[.!]$/.exec(f.text);
    if (l) lostTo.push(l[1]!);
  }
  return { beat, lostTo };
}

/** Results the entry turns around: "I beat Corin" when Corin beat the player, or the other way. */
export function resultFlips(text: string, facts: readonly JournalFact[]): string[] {
  const { beat, lostTo } = results(facts);
  const out: string[] = [];
  for (const n of lostTo) if (new RegExp(`\\bI (?:beat|defeated|bested|won against) (?:my rival )?${esc(n)}\\b`, 'i').test(text)) out.push(n);
  for (const n of beat) if (new RegExp(`\\b${esc(n)} (?:beat|defeated|bested) me\\b|\\blost to (?:my rival )?${esc(n)}\\b`, 'i').test(text)) out.push(n);
  return [...new Set(out)];
}

/** How many of the facts the entry tells (one of a fact's names or numbers in it, or its words for a fact without). */
export function factsTold(text: string, facts: readonly JournalFact[]): number {
  const t = text.toLowerCase().replace(/(\d),(?=\d{3}(?![0-9]))/g, '$1');
  let n = 0;
  for (const f of facts) {
    const anchors = anchorsOf(f.text.replace(/(\d),(?=\d{3}(?![0-9]))/g, '$1')).filter((a) => a !== 'I' && a !== 'My');
    const keys = anchors.length > 0 ? anchors : (f.text.toLowerCase().match(/[a-z]{5,}/g) ?? []).slice(0, 2);
    if (keys.some((k) => t.includes(k.toLowerCase()))) n++;
  }
  return n;
}

/** A model reply made fit to keep: one paragraph, no dashes or markdown, "Day N:" first, at most six sentences. */
export function tidyEntry(raw: string, dayNumber: number): string {
  let t = noDashes(raw.replace(/\s+/g, ' ').trim())
    .replace(/^["“”']+|["“”']+$/g, '')
    .replace(/^(?:\*\*)?(?:dear diary[,.!]?\s*)/i, '')
    .trim();
  t = t.replace(/^day\s*\d+\s*[:.,-]?\s*/i, '');
  const sentences = t.match(/[^.!?]+[.!?]+/g) ?? (t.length > 0 ? [`${t}.`] : []);
  const body = sentences.slice(0, 6).join(' ').replace(/\s+/g, ' ').trim();
  if (body === '') return '';
  let out = `Day ${dayNumber}: ${body.charAt(0).toUpperCase()}${body.slice(1)}`;
  if (out.length > ENTRY_MAX) out = (out.slice(0, ENTRY_MAX).match(/^[\s\S]*[.!?]/)?.[0] ?? '').trim();
  return out;
}

/** The model's entry if it holds to the day's facts, else null (the template is written). */
export function checkEntry(raw: string, dayNumber: number, facts: readonly JournalFact[]): string | null {
  const text = tidyEntry(raw, dayNumber);
  const sentences = (text.match(/[^.!?]+[.!?]+/g) ?? []).length;
  if (text.length < 24 || sentences < 2) return null;
  const src = [...facts.map((f) => f.text.replace(/(\d),(?=\d{3}(?![0-9]))/g, '$1')), `Day ${dayNumber}`];
  const t = text.replace(/(\d),(?=\d{3}(?![0-9]))/g, '$1');
  if (ungrounded(t, src).length > 0 || wrongTypeClaims(text).length > 0) return null;
  if (strangeNames(text, src.join(' '), '', { sentenceStarts: false }).length > 0 || strangeNumbers(t, src.join(' ')).length > 0) return null;
  if (resultFlips(text, facts).length > 0) return null;
  if (factsTold(text, facts) < Math.min(2, facts.length)) return null;
  return text;
}

// ---- the template ---------------------------------------------------------------------------------------------------

/** The entry without the model: "Day N:" and the day's first facts as they are. */
export function templateEntry(dayNumber: number, facts: readonly JournalFact[]): string {
  if (facts.length === 0) return `Day ${dayNumber}: A quiet day.`;
  const shown = facts.slice(0, 5).map((f) => f.text);
  const more = facts.length > 5 ? ' And more besides.' : '';
  let out = noDashes(`Day ${dayNumber}: ${shown.join(' ')}${more}`);
  if (out.length > ENTRY_MAX) out = (out.slice(0, ENTRY_MAX).match(/^[\s\S]*[.!?]/)?.[0] ?? out.slice(0, ENTRY_MAX)).trim();
  return out;
}

export interface EntryOptions {
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
  /** tests inject the model */
  readonly chat?: typeof chatOnce;
}

/** One entry from the model, checked; null when the model is down, slow or strays from the facts. */
export async function writeEntry(dayNumber: number, facts: readonly JournalFact[], o: EntryOptions = {}): Promise<string | null> {
  if (facts.length === 0) return null;
  const chat = o.chat ?? chatOnce;
  try {
    const r = await chat({ messages: entryMessages(dayNumber, facts), maxTokens: MAX_TOKENS, temperature: 0.6, timeoutMs: o.timeoutMs ?? ENTRY_TIMEOUT_MS, ...(o.signal ? { signal: o.signal } : {}) });
    return checkEntry(r.content, dayNumber, facts.slice(0, PROMPT_FACTS));
  } catch (_e) {
    return null;
  }
}
