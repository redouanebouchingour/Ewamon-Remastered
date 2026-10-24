/**
 * NPC side quests in the talk (LLM feature 2): a villager asks the traveller for a favour. The server draws the favour
 * (`GET /npc/quests/:npcId` -> `next`: what this NPC would ask now, from content and the world seed) and owns its
 * progress and reward; this module words it for the talk pass, decides when the NPC is told to ask, reads the
 * player's yes / no / "done", and gives the tool pass its `offer_quest` tool and the guard on it.
 *
 * - When: the player asks for work ("do you need any help?", "any errands?": `asksForWork`) or, unprompted, on the
 *   player's second line of a conversation with an NPC that is neutral or better, once per conversation and never on a
 *   line that is a slap, an insult, a robbery or a challenge (`shouldAsk`). The ask rides that user turn as a bracketed
 *   note (`askNote`: "You need help: ask the traveller to catch a Mossling for you, it lives on Mire Route. Promise
 *   them three hundred coins and a Potion when it is done."), the way the furious / scared nudges do.
 * - Whether: the NPC words the ask (or does not); the tool pass, which gets `offer_quest` only on an exchange that
 *   carried the note, calls it; `guardOffer` keeps it only when the words ask for something, and adds it when they do
 *   and the call is missing. The offer (`POST /npc/quests/offer`) is the server's draw again, never the model's words.
 * - Then the dialogue shows the offer (Accept / Decline). A typed "yes, I'll do it" or "no thanks" right after the ask
 *   answers it too (`answerOf`); the talk pass hears what was answered (`ACCEPTED` / `DECLINED`) and so does the hand
 *   in (`claimedNote`).
 *
 * Measured on gemma4-e2b (the docker model, 2026-10-24): 3 NPCs (gruff gardener, archivist, cheerful fish-seller) x 5
 * favour kinds x 2 openings ("Do you need any help?" / small talk on the second line), one reply each, then the tool
 * pass with `offer_quest`; plus 9 small-talk replies without a note as negatives.
 * - "Offer 300 coins." (first wording): 26 of 30 replies asked, 28 named the thing asked for, but 6 paid on the spot
 *   ("Here, take these four hundred coins") and the tool pass then called give_money / take_money 7 times (it would
 *   have moved real money); offer_quest 20 of 30.
 * - "Promise them 300 coins when it is done.": 27 of 30 asked, 24 named the thing, nobody paid on the spot, no money
 *   tool; offer_quest on 25 of 27 asks, once on a reply that did not ask, 0 of 9 negatives. But the amount came out
 *   wrong in 14 of 30 ("thirty hundred coins" for 300, "forty coins" for 400) and right in only 10.
 * - "You will pay them 300 coins when they come back and it is done, not now." (a longer variant): only 20 of 30 asked.
 * - Shipped: the "Promise" wording with the amount in words (`numberWords`: "three hundred coins"): 28 of 30 asked, 26
 *   named the thing, the amount right in 26 of 30 and garbled in none, nobody paid on the spot, no money tool;
 *   offer_quest on 27 of 28 asks and on 0 of 9 negatives; no em-dashes in any reply. The tool pass took 1.4 to 4.6 s
 *   (once 29 s on the busy shared model).
 * - The guard still drops money and battle calls on an asking exchange (the 7 above), and adds the offer when the words
 *   ask but the call is missing (1 of 28 in the shipped wording).
 * - End to end with the shipped code (the server's `planNpcQuest` draws for 6 NPCs of Mirevale and Saltmourn, 2 each,
 *   the real `streamNpcReply` and `judgeExchange`): 12 of 12 exchanges stored an offer, 11 replies said the task and
 *   the right amount and item ("Bring me three Spark Orbs from Mirevale. Six hundred and eighty coins will be yours
 *   when you are done."), one only said "Do you want help? Fine. Come here." (the card shows the favour anyway); no
 *   money or battle call, no em-dash. Talk 1.7 to 6.4 s, tool pass 2.2 to 15 s on the shared docker model.
 */
import type { NpcQuestObjective, NpcQuestPlan, NpcQuestReward, Standing } from '@ewa/protocol';
import { itemInfo, speciesName, zoneName } from '../data/content';

export const OFFER_QUEST = 'offer_quest';

function plural(name: string, n: number): string {
  return n === 1 ? name : name.endsWith('s') ? name : `${name}s`;
}
function an(word: string): string {
  return /^[aeiou]/i.test(word) ? `an ${word}` : `a ${word}`;
}

/** The objective for the journal and the dialogue card ("Catch a Mossling on Mire Route"). */
export function objectiveText(o: NpcQuestObjective): string {
  switch (o.kind) {
    case 'catch':
      return `Catch ${an(speciesName(o.species))} (${zoneName(o.zoneId)})`;
    case 'defeat':
      return `Beat ${o.count} wild Ewamon on ${zoneName(o.zoneId)}`;
    case 'show':
      return `Show ${an(o.type)}-type Ewamon of level ${o.level} or more`;
    case 'deliver':
      return `Bring ${o.qty} ${plural(itemInfo(o.item).name, o.qty)}`;
    case 'visit':
      return `Go to ${zoneName(o.zoneId)}`;
  }
}

/** "300 coins and a Potion" */
export function rewardText(r: NpcQuestReward, words = false): string {
  const n = (x: number): string => (words ? numberWords(x) : String(x));
  const coins = r.money > 0 ? `${n(r.money)} coins` : '';
  const item = r.item === null ? '' : r.item.qty === 1 ? an(itemInfo(r.item.id).name) : `${n(r.item.qty)} ${plural(itemInfo(r.item.id).name, r.item.qty)}`;
  return [coins, item].filter((x) => x !== '').join(' and ');
}

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/**
 * 0..999 in words ("three hundred and forty"): the talk pass reads amounts this way. Given digits, gemma4-e2b said
 * "thirty hundred coins" for 300 (see the header); given words, it repeats them.
 */
export function numberWords(n: number): string {
  const x = Math.max(0, Math.min(999, Math.trunc(n)));
  if (x < 20) return ONES[x]!;
  if (x < 100) return x % 10 === 0 ? TENS[Math.floor(x / 10)]! : `${TENS[Math.floor(x / 10)]!}-${ONES[x % 10]!}`;
  const rest = x % 100;
  return `${ONES[Math.floor(x / 100)]!} hundred${rest === 0 ? '' : ` and ${numberWords(rest)}`}`;
}

/** What the NPC asks the traveller to do, as the talk pass reads it. */
function askPhrase(o: NpcQuestObjective): string {
  switch (o.kind) {
    case 'catch':
      return `catch ${an(speciesName(o.species))} for you, it lives on ${zoneName(o.zoneId)}`;
    case 'defeat':
      return `beat ${o.count} wild Ewamon on ${zoneName(o.zoneId)} for you`;
    case 'show':
      return `show you ${an(o.type)}-type Ewamon of level ${o.level} or more`;
    case 'deliver':
      return `bring you ${o.qty} ${plural(itemInfo(o.item).name, o.qty)}, the shop in ${zoneName(o.zoneId)} sells them`;
    case 'visit':
      return `go to ${zoneName(o.zoneId)} and come back to tell you how it is there`;
  }
}

/** The note on the user turn that makes the NPC ask (without the brackets). */
export function askNote(plan: NpcQuestPlan): string {
  return `You need help: ask the traveller to ${askPhrase(plan.objective)}. Promise them ${rewardText(plan.reward, true)} when it is done.`;
}

/** the player asks the NPC for work */
const WORK = /\b(need (any |some |a )?(help|hand)|help you|can i (help|do)|anything (i can do|to do)|(a|any) (job|jobs|task|tasks|errand|errands|quest|quests|favou?r|favou?rs|work)\b|work for you|what can i do for you)/i;
export function asksForWork(said: string): boolean {
  return WORK.test(said);
}

/**
 * Whether this user line carries the ask: the NPC has a favour to ask (`hasNext`), has not been told to ask in this
 * conversation, does not dislike the player, and the line is no provocation (the caller passes `calm`); then on a
 * request for work, or unprompted on the player's second line.
 */
export function shouldAsk(p: { readonly hasNext: boolean; readonly asked: boolean; readonly feeling: Standing | null; readonly calm: boolean; readonly said: string; readonly userLine: number }): boolean {
  if (!p.hasNext || p.asked || !p.calm) return false;
  if (p.feeling === 'wary' || p.feeling === 'hostile') return false;
  return asksForWork(p.said) || p.userLine === 2;
}

const YES = /^\s*(yes|yeah|yep|yup|sure|ok|okay|of course|alright|all right|deal|gladly|happy to|count me in|consider it done|i('ll| will) (do it|help|take it|go)|i can do (that|it))\b/i;
const NO = /^\s*(no|nope|nah|not now|not today|maybe later|sorry|i can'?t|i won'?t|i don'?t want)\b/i;
/** A typed answer to an open offer: accept, decline, or neither (just talk). */
export function answerOf(said: string): 'accept' | 'decline' | null {
  return YES.test(said) ? 'accept' : NO.test(said) ? 'decline' : null;
}

const DONE = /(^\s*(all )?done\b|\b(i did it|done it|it'?s done|finished|i('ve| have) (done|got|brought|caught|beaten|beat|been|found)|here (it is|they are|you go|you are)|mission (accomplished|complete)|as you asked|what you asked)\b)/i;
/** The player says the favour is done (the hand-in is tried; the server decides). */
export function saysDone(said: string): boolean {
  return DONE.test(said);
}

/** the NPC's words ask for something (the guard on `offer_quest`) */
const ASKING = /\b(help|favou?r|could you|would you|can you|will you|need you|i need|bring me|bring it|please|reward|i('ll| will) (pay|give)|coins?)\b/i;
/** `offer_quest` stands only on an exchange that carried the ask, when the NPC's words ask for something. */
export function guardOffer(reply: string, asked: boolean): boolean {
  return asked && ASKING.test(reply);
}

/** The tool the tool pass gets on an exchange that carried the ask. */
export function offerTool(name: string): unknown {
  return {
    type: 'function',
    function: { name: OFFER_QUEST, description: `${name} asks the traveller to do a task for them (an errand or a favour, with a reward).`, parameters: { type: 'object', properties: {}, required: [] } },
  };
}

/** The tool pass's rule for it. */
export function offerRule(name: string): string {
  return `If ${name} asks the traveller to do a task or a favour for them, call ${OFFER_QUEST}.`;
}

/** What the talk pass hears after the player answered (addressed to the NPC, like every event). */
export const ACCEPTED = 'The traveller agrees to do it. Thank them and tell them to come back to you when it is done.';
export const DECLINED = 'The traveller says no to your request. Take it well.';
export function claimedNote(o: NpcQuestObjective, r: NpcQuestReward): string {
  return `The traveller did what you asked (${objectiveText(o).toLowerCase()}). You pay them ${rewardText(r, true)}. Thank them warmly.`;
}
export const NOT_DONE = 'The traveller says they did what you asked, but they have not yet. Tell them so, kindly.';
