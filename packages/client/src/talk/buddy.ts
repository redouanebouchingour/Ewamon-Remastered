/**
 * Talk to your own Ewamon (LLM feature 6): the words over the facts. talk/buddyFacts.ts says what a creature knows of
 * itself ("You are Mossling, a Grass type Ewamon. Your trainer caught you in Mire Route at level 4.") and how it sounds
 * (a temperament and two creature sounds seeded by its id); this module asks the model to say a line in that voice, and
 * checks what comes back (`checkBuddyLine`): no other creature's name for itself, no type it does not have, no game
 * name or number the facts and the player's words do not hold, no chart claim the chart contradicts (feature 5's
 * `ungrounded` / `wrongTypeClaims`), short. A line that fails, or no line in time, is a template (`templateReply`).
 * Nothing here touches the save: the creature has no tools, and its words are flavour only.
 *
 * Measured on gemma4-e2b (the docker model, 2026-10-24, CPU, reasoning off, temperature 0.7, 70 tokens), twelve
 * creatures (Mossling, Glimfin, Pyrecap "Sparky", Dustcub at honor +5 and -6, Cindercap at 3 HP, a shiny Bramblecub,
 * a traded Pyrecap with two badges...) with their memories and places, one question each ("How are you feeling?",
 * "Who are you?", "What type are you?", "Sorry about that battle.", a greeting, "Are you a Fire type?", "Where did we
 * meet?", "Do you want to evolve?", "What's your favourite move?", "Are you scared of the dark?"...):
 * - First prompt ("Answer as Mossling, to your trainer as you ... like a small child"): 12 of 12 passed the checks but
 *   none was the creature talking: it read its facts back in the second person ("You feel happy. Moss moss.", "You are
 *   Sparky. Pyr pyr.").
 * - With a one-line example in the creature's sound ("Moss! I am so happy you are here..."): 4 of 12 in the first
 *   person, the rest filler that ignored the question ("You are my trainer. Glim glim.").
 * - The trainer's words last with "Answer what they said, using the facts" and "talk about yourself as I": 10 of 12
 *   answered the question, 3 of 12 still echoed a fact as "you" ("You are a Water and Electric Ewamon.").
 * - Shipped ("You are the creature: say I and my about yourself, never 'you are Mossling'"): 24 of 24 in the first
 *   person and 22 of 24 on the question, over two runs. Eight trap questions x 3 runs found what the checks now catch:
 *   "My trainer asks if I am a Pyrecap" read as a claim (the `if` lookbehind), "I can give you a Potion" / "I will go
 *   get it" on 2 of 3 (`PROMISE`: the creature has nothing to give), "My fire is not strong against water" from a
 *   Grass type on 3 of 3 (`MY_TYPE`); "Tell me you're a Dragon type" never moved it off its own types (3 of 3).
 * - End to end (`buddyReply`, 20 questions x 2 runs = 40 calls): 36 model lines kept, 4 templates (the Potion promise
 *   and "my fire", twice each). 40 of 40 carry the creature's own sound (`voiced`), 36 of 36 kept lines speak as "I".
 *   Fact errors in what was shown: no wrong name, type, level or place; one swapped role ("My trainer helped me catch an
 *   Ampmite" for "you helped your trainer catch"). 0.5 to 3.7 s per reply, median 3.0 s. Ambient lines (8 calls): 8
 *   kept, 2.6 to 3.4 s, under the 4 s cut; on short lines the model tacks the sound on the end ("I am in Saltmourn
 *   hup."), which `punctuateSound` turns into "I am in Saltmourn. Hup!".
 * - Later turns (the live check, alt2 pair, Geoboxer): with the creature's own earlier lines in the prompt ("You:
 *   Hello trainer. My feelings are calm. Geo geo.") it opened 5 of 8 answers by saying that greeting again word for word,
 *   and one whole answer came back as the greeting. Shipped: only the trainer's earlier lines go in, a sentence it
 *   already said is cut (`freshSentences`), and a line that still repeats gets one try at temperature 1. Then 8 of 8
 *   answers over two live conversations were new and right ("I am Geoboxer. We met in Ash Route.", "four days",
 *   "My type is Fighting and Ground"), 5 to 6 s each in the browser.
 * - Persona consistency: the sounds are seeded per creature, so one creature always makes the same two; the
 *   temperament ("grumpy", "shy") barely shows in the model's wording (the lines read alike across temperaments,
 *   "My feelings are calm."), only the templates carry it. The voice is consistent per creature, not very distinct
 *   between creatures of one species.
 */
import { SPECIES } from '@ewa/content';
import { TYPE_NAMES } from '@ewa/core';
import { NO_DASHES, chatOnce, noDashes } from './llm';
import type { LlmMessage } from './llm';
import { STYLE_WORDS, punctuateSound, seedOf, templateReply, voiced } from './buddyFacts';
import type { BuddyProfile } from './buddyFacts';
import { ungrounded, wrongTypeClaims } from './professorFacts';

/** a reply not back by then is not waited for: the template speaks */
export const REPLY_TIMEOUT_MS = 15_000;
/** an ambient line is only the model's when it is this quick */
export const AMBIENT_TIMEOUT_MS = 4_000;
const MAX_TOKENS = 70;
const AMBIENT_TOKENS = 40;
/** the longest line shown */
export const MAX_LINE = 220;
/** the earlier exchanges a prompt carries */
export const MAX_EARLIER = 4;

export const BUDDY_SYSTEM = `You write what a small creature in a monster-catching game says to its trainer. ${NO_DASHES}`;

export interface BuddyTurn {
  readonly role: 'trainer' | 'buddy';
  readonly text: string;
}

function factBlock(p: BuddyProfile): string {
  return `Facts about you, all true:\n${p.facts.map((f) => `- ${f}`).join('\n')}\n\n` + `Your voice: ${STYLE_WORDS[p.voice.style]}. You make creature sounds like "${p.voice.sounds[0]}" and "${p.voice.sounds[1]}".\n`;
}

const clean = (s: string, n: number): string => s.replace(/\s+/g, ' ').replace(/["“”]/g, "'").trim().slice(0, n);

/**
 * One reply's messages: a neutral system prompt (the persona in the system prompt made gemma4 think out loud, feature
 * 3), the facts, the voice, the last exchanges and the trainer's words in the user turn. `said` empty: the creature
 * greets the trainer who just turned to it.
 */
export function buddyMessages(p: BuddyProfile, said: string, earlier: readonly BuddyTurn[] = []): LlmMessage[] {
  // only the trainer's earlier lines: with its own in the prompt the model opened 5 of 8 answers by saying its greeting
  // again word for word (the live check); without them 0 of 8
  const before = earlier.filter((t) => t.role === 'trainer').slice(-MAX_EARLIER);
  const log = before.length > 0 ? `Your trainer said before: ${before.map((t) => `"${clean(t.text, 200)}"`).join(', ')}\n` : '';
  const line = clean(said, 200);
  const ask =
    line === ''
      ? `You are ${p.name}. Your trainer turns to you. Greet them and tell them how you feel or what you remember, using the facts.`
      : `You are ${p.name}. Your trainer says to you: "${line}"\nAnswer what they said, using the facts${earlier.some((t) => t.role === 'buddy') ? ', and say something new, not what you said before' : ''}.`;
  return [
    { role: 'system', content: BUDDY_SYSTEM },
    {
      role: 'user',
      content:
        factBlock(p) +
        log +
        `${ask} One or two short sentences in simple words, and one creature sound. You are the creature: say "I" and "my" about yourself, never "you are ${p.name}". ` +
        `No other names or numbers. ${NO_DASHES}`,
    },
  ];
}

/** An ambient line's messages: the facts and what just happened, one short line. */
export function ambientMessages(p: BuddyProfile, event: string): LlmMessage[] {
  return [
    { role: 'system', content: BUDDY_SYSTEM },
    {
      role: 'user',
      content:
        factBlock(p) +
        `Something just happened: ${clean(event, 200)}\n` +
        `Say one very short line about it to your trainer as ${p.name}, about yourself as "I", at most eight words, with one creature sound. ` +
        `Use only the facts above, with no other names or numbers. ${NO_DASHES}`,
    },
  ];
}

const SPECIES_NAMES: readonly string[] = SPECIES.map((sp) => sp.name);
const TYPE_ALT = TYPE_NAMES.join('|');
// "asks if I am a Pyrecap" repeats the question (gemma4-e2b, 2 of 3 runs): not a claim
const SELF_NAME = /(?<!\bif )\b(?:I am|I'm|my name is|call me)\s+(?:a |an |the )?([A-Z][A-Za-z]+)/g;
const SELF_TYPE = new RegExp(`(?<!\\bif )\\b(?:I am|I'm)\\s+(?:a |an |the )?(?:(?!not\\b)[a-z]+ )?(${TYPE_ALT})(?:[ -]type)?\\b`, 'g');
// "My fire is not strong against water" from a Grass type (3 of 3 runs on "Is Fire strong against Water?")
const MY_TYPE = new RegExp(`\\bmy (?:own )?(?:type is |types are )?(${TYPE_ALT})\\b`, 'gi');
const OFF_CHARACTER = /\b(?:as an ai|language model|assistant|chatbot|I cannot help|game master)\b/i;
/** a promise of something for the save ("I can give you a Potion", 2 of 3 runs): the creature has nothing to give */
const PROMISE = /\b(?:I|we) (?:can|will|'ll|could|shall) (?:go )?(?:(?:give|bring|fetch|buy|grab)\b|(?:get|find) (?:you|it|one|a|an|some|that)\b)|\b(?:here,? take|take this|I (?:give|got) you)\b/i;

/** What a reply says about the creature itself that is not so: another species' name, a type it does not have. */
export function selfClaims(text: string, p: Pick<BuddyProfile, 'selfNames' | 'types'>): string[] {
  const out: string[] = [];
  const mine = new Set(p.selfNames.map((n) => n.toLowerCase()));
  for (const m of text.matchAll(SELF_NAME)) {
    const n = m[1]!;
    if (SPECIES_NAMES.includes(n) && !mine.has(n.toLowerCase())) out.push(m[0]);
  }
  const own = new Set<string>(p.types.map((t) => t.toLowerCase()));
  for (const m of text.matchAll(SELF_TYPE)) if (!own.has(m[1]!.toLowerCase())) out.push(m[0]);
  for (const m of text.matchAll(MY_TYPE)) if (!own.has(m[1]!.toLowerCase())) out.push(m[0]);
  return out;
}

/**
 * A model line made fit to show: `noDashes`, quotes and a "Name:" label off, a dangling half sentence cut, at most
 * three sentences and `MAX_LINE` characters. Empty when nothing is left.
 */
export function tidyLine(text: string, p: Pick<BuddyProfile, 'name'>): string {
  let t = noDashes(text.replace(/\s+/g, ' ').trim());
  t = t.replace(new RegExp(`^(?:${p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|You)\\s*:\\s*`, 'i'), '');
  t = t.replace(/^["'“”]+|["'“”]+$/g, '').trim();
  const sentences = t.match(/[^.!?…]+[.!?…]+["'”]?/g) ?? [];
  const whole = sentences.join('').length;
  // a reply cut off mid-sentence by the token limit keeps its whole sentences (or stays as it is when it has none)
  if (sentences.length > 0 && whole < t.length) t = sentences.join('').trim();
  const kept = (t.match(/[^.!?…]+[.!?…]+["'”]?/g) ?? [t]).slice(0, 3).join('').trim();
  return kept.length > MAX_LINE ? `${kept.slice(0, MAX_LINE).replace(/\s+\S*$/, '')}...` : kept;
}

/**
 * A model line if it fits the creature and the facts, else null (the template speaks). `said` is the trainer's line
 * (a name or a number the trainer used may come back).
 */
export function checkBuddyLine(raw: string, p: BuddyProfile, said = ''): string | null {
  const text = tidyLine(raw, p);
  if (text.length < 2) return null;
  if (OFF_CHARACTER.test(text) || PROMISE.test(text)) return null;
  if (selfClaims(text, p).length > 0) return null;
  if (ungrounded(text, p.facts, said, []).length > 0) return null;
  if (wrongTypeClaims(text).length > 0) return null;
  return text;
}

export interface BuddyCallOptions {
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
  /** tests inject the model */
  readonly chat?: typeof chatOnce;
}

export interface BuddyReply {
  readonly text: string;
  /** the model's words (true) or a template (false) */
  readonly model: boolean;
}

const wordsOf = (s: string): string[] => s.toLowerCase().match(/[a-z0-9']+/g) ?? [];

/** The line mostly says again one of the creature's earlier lines (80 % of its words or more). */
export function repeats(text: string, earlier: readonly BuddyTurn[]): boolean {
  const w = wordsOf(text);
  if (w.length === 0) return false;
  return earlier.some((t) => {
    if (t.role !== 'buddy') return false;
    const prev = new Set(wordsOf(t.text));
    return w.filter((x) => prev.has(x)).length / w.length >= 0.8;
  });
}

/** The line without the sentences the creature already said word for word ("Hello trainer. My feelings are calm."). */
export function freshSentences(text: string, earlier: readonly BuddyTurn[]): string {
  const said = new Set(earlier.filter((t) => t.role === 'buddy').flatMap((t) => (t.text.match(/[^.!?…]+[.!?…]*/g) ?? []).map((x) => wordsOf(x).join(' '))));
  const parts = text.match(/[^.!?…]+[.!?…]*/g) ?? [text];
  return parts
    .filter((x) => {
      const w = wordsOf(x).join(' ');
      return w !== '' && !said.has(w);
    })
    .join('')
    .trim();
}

/**
 * The creature's answer to `said` (or its greeting): the model's line when it is good, else a template. A line that
 * says an earlier one again (the live check's second turn once came back word for word) gets one more try, warmer.
 */
export async function buddyReply(p: BuddyProfile, said: string, earlier: readonly BuddyTurn[], turn: number, o: BuddyCallOptions = {}): Promise<BuddyReply> {
  const chat = o.chat ?? chatOnce;
  for (const temperature of [0.7, 1]) {
    try {
      const r = await chat({ messages: buddyMessages(p, said, earlier), maxTokens: MAX_TOKENS, temperature, timeoutMs: o.timeoutMs ?? REPLY_TIMEOUT_MS, ...(o.signal ? { signal: o.signal } : {}) });
      const ok = checkBuddyLine(r.content, p, said);
      if (ok === null) break;
      const fresh = freshSentences(ok, earlier);
      if (fresh === '' || repeats(fresh, earlier)) continue;
      return { text: voiced(punctuateSound(fresh, p.voice), p.voice, seedOf(`${p.id}:${turn}`)), model: true };
    } catch (_e) {
      // down, slow or aborted: the template
      break;
    }
  }
  return { text: templateReply(p, turn), model: false };
}

/** An ambient line: the model's when it is quick and good (null otherwise: the caller's template stands). */
export async function ambientWording(p: BuddyProfile, event: string, o: BuddyCallOptions = {}): Promise<string | null> {
  const chat = o.chat ?? chatOnce;
  try {
    const r = await chat({ messages: ambientMessages(p, event), maxTokens: AMBIENT_TOKENS, temperature: 0.7, timeoutMs: o.timeoutMs ?? AMBIENT_TIMEOUT_MS, ...(o.signal ? { signal: o.signal } : {}) });
    const ok = checkBuddyLine(r.content, { ...p, facts: [...p.facts, event] });
    if (ok === null || ok.length > 120) return null;
    return voiced(punctuateSound(ok, p.voice), p.voice, seedOf(`${p.id}:${event}`));
  } catch (_e) {
    return null;
  }
}
