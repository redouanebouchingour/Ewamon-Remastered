/**
 * Prof. Wynn, the coach (LLM feature 5): the words over the facts. talk/professorFacts.ts finds the facts for a question
 * (from content and the player's save) and battle/lossFacts.ts the facts of a lost battle; this module asks the model
 * to say them as the professor would, and checks what comes back. The facts are the answer: the model's words are only
 * shown when they hold no game name, number or "your <creature>" the facts do not (`ungrounded`), and the facts are
 * shown as a terse list under them either way, and alone when the model is down, slow or wrong.
 *
 * Measured on gemma4-e2b (the docker model, 2026-10-24, CPU, reasoning off), 14 questions over two saves (an early one
 * with no badge, a mid one with three) that cover every lookup: "What beats Mira's team?", "Where do I find a fire
 * type?", "How do I evolve dustcub?", "What should I do next?", "Is my team good against the next gym?", "What is an
 * Ember Stone for?", "What can I catch on Mire Route?", "What is strong against ghost types?", "Tell me about
 * Cindercap", "Where can I catch a Mossling?", "How do I get a Lawlander?", "Which of my Ewamon should I use against
 * Karn?", "What level is Zia Volt's strongest?", "Is my team any good?".
 * - A tool loop (the ten lookups as OpenAI tools, `tool_choice: required` then `auto`, at most three rounds, temperature
 *   0): the right lookup first on 11 of 14 (and 8 of the first 10). It passed "fire" as a species (the help sheet came
 *   back and the answer was "ask me about an Ewamon, a type..."), asked next_goal for "my team against the next gym", and
 *   evolve_info for "Zia Volt". 14 of 14 answers grounded, 13 of 14 held the fact the question needed; most began
 *   "Professor Wynn, ..." or "Professor Wynn advises you to talk to Professor Wynn". 3.2 to 12 s per question (median
 *   4.4 s): two calls, the second carrying the tool schemas and results.
 * - Retrieval (`routeQuestion`: content names and a few keywords pick the lookup, then one phrasing call): the right
 *   lookup on 13 of 14 (the miss, "strongest" read as a matchup word, still answered; fixed) and 14 of 14 after, and
 *   it is deterministic and unit-tested. One call of 120 to 250 prompt tokens: 3.1 to 5.9 s (median 4.2 s). 14 of 14
 *   grounded by `ungrounded`, 12 of 14 held the needed fact. What went wrong was wording: with the first prompt
 *   ("Answer as Professor Wynn, kindly, in two or three short sentences") the model swapped sides once ("Your
 *   Bramblecub's Leaf Blade is super effective on your Glimfin": the Bramblecub was the leader's), answered "Which of
 *   my Ewamon should I use against Karn?" with "You should use your Ewamon against Karn" (the facts had no pick), and
 *   said a list twice. Fixes: the facts name sides on every creature ("Your Pyrecap's Ember ... their Ampmite",
 *   "Watch out: Their Bramblecub's Leaf Blade ... your Glimfin and Dustcub"), a "best pick" fact, the guard drops an
 *   answer that calls a creature "your" the player does not have, the prompt asks for the direct answer first and no
 *   repeats, and `tidy` drops a repeated sentence. Results with the shipped prompt are in the notes below.
 * - Shipped: retrieval. It is as fast or faster, the facts are the same every time (the tests pin them), and a wrong
 *   lookup cannot happen at the model's whim. The persona stays out of the system prompt (feature 3: gemma4 opened a
 *   hidden thinking block with a persona there and the reply landed in `reasoning_content`).
 * - The shipped code (`askProfessor`), the same 14 questions x 2 runs: 28 of 28 answers kept by the checks, 24 of 28
 *   held the fact the question needed (the misses were vague, not wrong: "Your team is adequate"), 1.3 to 5.3 s
 *   (median 2.8 s). One more thing the guards caught on the way: "Psychic and Ghost are strong against Ghost types" from
 *   facts that held both directions of the chart, so a type question now gets only the side it asks
 *   (`typeView`) and `wrongTypeClaims` drops an answer the chart contradicts.
 * - The loss coach (`lossMessages`, three fact sets x 4 runs): with "Their Caldermole's Earthquake did the most damage"
 *   the model, coaching "you", wrote "Your Caldermole's Earthquake" in 8 of 8 trainer losses (the guard dropped them:
 *   4 of 12 kept). With "The opponent's Caldermole hurt you most, with Earthquake" 12 of 12 kept, 1.7 to 6.2 s (median
 *   2.9 s). The words keep two or three of the facts; the "Bring next time" strip always shows the types and creatures.
 */
import { NO_DASHES, chatOnce, noDashes } from './llm';
import type { LlmMessage } from './llm';
import { factsFor, ungrounded, wrongTypeClaims } from './professorFacts';
import type { FactSheet, ProfSave } from './professorFacts';

/** a model answer that has not come back by then is not waited for: the facts stand alone */
export const ANSWER_TIMEOUT_MS = 20_000;
const MAX_TOKENS = 160;

export const PROF_SYSTEM = `You answer questions about a monster-catching game using only the facts you are given. ${NO_DASHES}`;

/** The phrasing call's messages: a neutral system prompt; the facts, the question and the professor in the user turn. */
export function answerMessages(question: string, facts: readonly string[]): LlmMessage[] {
  const q = question.replace(/\s+/g, ' ').trim().slice(0, 200);
  return [
    { role: 'system', content: PROF_SYSTEM },
    {
      role: 'user',
      content:
        `Facts from the game, all true:\n${facts.map((f) => `- ${f}`).join('\n')}\n\n` +
        `The player asks: "${q}"\n` +
        'You are Professor Wynn. Answer the question directly in the first sentence, then give the most useful facts. ' +
        'Two or three short sentences, to the player as "you". Use only the facts above, with no other names or numbers, and say each thing once. ' +
        NO_DASHES,
    },
  ];
}

/** The loss review's messages: the battle's facts and what to say about them. */
export function lossMessages(facts: readonly string[]): LlmMessage[] {
  return [
    { role: 'system', content: PROF_SYSTEM },
    {
      role: 'user',
      content:
        `Facts about a battle the player just lost, all true:\n${facts.map((f) => `- ${f}`).join('\n')}\n\n` +
        'You are Professor Wynn, coaching the player. In two or three short sentences, tell them why they lost and what to bring next time. ' +
        'Speak to the player as "you". Use only the facts above, with no other names or numbers, and say each thing once. ' +
        NO_DASHES,
    },
  ];
}

const words = (s: string): string[] => s.toLowerCase().match(/[a-z0-9']+/g) ?? [];

/**
 * A model answer made fit to show: `noDashes`, a sentence that mostly repeats an earlier one dropped, at most four
 * sentences, a dangling half sentence cut. Empty when nothing is left.
 */
export function tidy(text: string): string {
  const t = noDashes(text.replace(/\s+/g, ' ').trim());
  const sentences = t.match(/[^.!?]+[.!?]+/g) ?? (t.length > 0 ? [t] : []);
  const kept: string[] = [];
  const seen: string[][] = [];
  for (const raw of sentences) {
    const s = raw.trim();
    const w = words(s);
    if (w.length === 0) continue;
    const dup = seen.some((p) => w.filter((x) => p.includes(x)).length / w.length >= 0.8);
    if (dup) continue;
    seen.push(w);
    kept.push(s);
    if (kept.length >= 4) break;
  }
  return kept.join(' ');
}

/** Whose creatures the player has (names and species names): the guard's "your <creature>". */
export function mineOf(save: ProfSave, speciesName: (id: string) => string): string[] {
  return [...save.party, ...save.box].flatMap((m) => [m.name, speciesName(m.speciesId)]);
}

/** A model answer if it is grounded in the facts, else null (the facts are shown alone). */
export function checkedAnswer(raw: string, facts: readonly string[], question: string, mine: readonly string[]): string | null {
  const text = tidy(raw);
  if (text.length < 12 || text.length > 600) return null;
  if (ungrounded(text, facts, question, mine).length > 0 || wrongTypeClaims(text).length > 0) return null;
  return text;
}

export interface PhraseOptions {
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
  /** tests inject the model */
  readonly chat?: typeof chatOnce;
}

/** One phrasing call; null when the model is down, slow, or says what the facts do not. */
export async function phrase(messages: readonly LlmMessage[], facts: readonly string[], question: string, mine: readonly string[], o: PhraseOptions = {}): Promise<string | null> {
  const chat = o.chat ?? chatOnce;
  try {
    const r = await chat({ messages, maxTokens: MAX_TOKENS, temperature: 0.2, timeoutMs: o.timeoutMs ?? ANSWER_TIMEOUT_MS, ...(o.signal ? { signal: o.signal } : {}) });
    return checkedAnswer(r.content, facts, question, mine);
  } catch (_e) {
    return null;
  }
}

export interface ProfAnswer {
  readonly question: string;
  readonly sheet: FactSheet;
  /** the professor's words, or null: the facts alone */
  readonly text: string | null;
}

/** Facts for the question at once (`factsFor`), then the professor's words for them. */
export async function askProfessor(question: string, save: ProfSave, speciesName: (id: string) => string, o: PhraseOptions = {}): Promise<ProfAnswer> {
  const sheet = factsFor(question, save);
  const text = await phrase(answerMessages(question, sheet.facts), sheet.facts, question, mineOf(save, speciesName), o);
  return { question, sheet, text };
}
