/**
 * NPC memory in the talk (LLM feature 1): what an NPC remembers of the traveller, how it feels about them, what the
 * town says, and what it keeps from a conversation once it ends. The server owns the facts (`GET /npc/memory`: the
 * stored summary, the standing, the town's reputation, the gossip as structured deeds); this module words them for the
 * talk pass and builds the write (`POST /npc/memory`: a summary and the talk deeds).
 *
 * - Folding it in: one bracketed note on the player's first line of the conversation (`memoryNote`, placed by
 *   `chatMessages`), not the system prompt. Measured on gemma4-e2b (2026-10-24, the docker model; 3 replies per case
 *   unless noted, the warm-and-chatty temperament, which pulls hardest towards a cheerful hello): the memory as a
 *   sentence of the system prompt changed nothing (0 of 9 replies mentioned it, a slapped NPC still said "lovely to see
 *   you"); as a bracketed note on the opening "Hello." turn, 0 of 9 too. On the player's first real line it works, and
 *   the order matters: feeling and instruction first, the memory last. "Last time: <summary> You are still angry: tell
 *   them so." was cold but named the slap in 2 of 6; "You know this traveller and you do not trust them. Tell them why,
 *   coldly. What you remember of them: <summary>" named it in 12 of 12 (two NPCs, two runs), a friend brought up last
 *   time's talk in 6 of 6, and a stranger passed on the town's gossip in 6 of 6. The one slip: the summary's "I feel
 *   angry" came back as "now you feel angry" once in 12.
 *   The note speaks to the NPC as "you" and says what to do with the memory, the way the furious / scared nudges do.
 * - The summary (`summarize`): one short call, temperature 0.2, no tools, the transcript as plain lines; two sentences
 *   at most, in the first person. 11 of 11 transcripts (slap, kind words, robbery, battle, small talk, a live slap)
 *   gave a usable summary at 2.6 to 9 s on the shared, busy docker model ("The traveller slapped me and called me
 *   names."); one small-talk summary muddled who said what. Its output is checked (`cleanSummary`); when the model is down, slow or writes
 *   something unusable, `fallbackSummary` builds one from what happened (the deeds and the tool events).
 * - The deeds (`deedsOf`) come from what happened, never from the model: a hit from H / K, a robbery / insult from the
 *   same detectors the talk pass uses, a threat or kind words from the player's own lines. Money, Ewamon and battles
 *   the server records itself.
 */
import { NPC_MEMORY_NOTE_MAX, NPC_TALK_DEEDS } from '@ewa/protocol';
import type { NpcDeed, NpcMemoryView, NpcTalkDeed, Standing } from '@ewa/protocol';
import { NO_DASHES, chatOnce, noDashes } from './llm';
import { provoked, robbed } from './npcChat';
import type { ChatTurn, NpcPersona } from './npcChat';

/** how long the first reply waits for the memory before it goes without it */
export const MEMORY_WAIT_MS = 600;
/** the summary call's budget (it runs after the dialogue closed: nobody waits on it) */
export const SUMMARY_TIMEOUT_MS = 12_000;

/** "Hessa Dunmore, town archivist" → "Hessa Dunmore" (the title reads badly mid-sentence) */
function short(name: string): string {
  return name.split(',')[0]!.trim();
}

/** A deed as the town tells it, the traveller the subject ("slapped Hessa Dunmore"). */
export function deedPhrase(deed: NpcDeed, name: string): string {
  const n = short(name);
  switch (deed) {
    case 'hit':
      return `hit ${n}`;
    case 'insulted':
      return `insulted ${n}`;
    case 'threatened':
      return `threatened ${n}`;
    case 'robbed':
      return `robbed ${n}`;
    case 'kindWords':
      return `were kind to ${n}`;
    case 'giftReceived':
      return `got a gift from ${n}`;
    case 'giftGiven':
      return `gave ${n} something`;
    case 'battleWon':
      return `beat ${n} in an Ewamon battle`;
    case 'battleLost':
      return `lost an Ewamon battle to ${n}`;
    case 'helped':
      return `did a favour for ${n}`;
    case 'haggledRudely':
      return `haggled so rudely that ${n} raised the prices`;
  }
}

/** "a, b and c" */
function list(xs: readonly string[]): string {
  return xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)!}`;
}

/** How a known NPC feels and what to do with it, said before the memory itself. */
const KNOWN: Readonly<Record<Standing, string>> = {
  hostile: 'You know this traveller and you hate them. Be rude and cold, and tell them why.',
  wary: 'You know this traveller and you do not trust them. Tell them why, coldly.',
  neutral: 'You know this traveller. Greet them as someone you have met before.',
  liked: 'You know this traveller and you like them. Greet them like a friend and bring up what you remember of them.',
  trusted: 'You know this traveller and they are a dear friend. Greet them warmly and bring up what you remember of them.',
};

/** What the NPC's own deeds say when it has no summary (only the server recorded something). */
function deedsSummary(m: NpcMemoryView): string {
  const own = [...new Set(m.deeds.map((d) => d.deed))];
  return own.length === 0 ? 'You have met them before.' : `They ${list(own.map((d) => deedPhrase(d, 'you')))}.`;
}

/**
 * The bracketed note for the talk pass (without the brackets), or null when the NPC has nothing to remember or tell:
 * how it feels and what to do first, then what it remembers, then the town's gossip, all addressed to the NPC.
 */
export function memoryNote(m: NpcMemoryView | null): string | null {
  if (m === null) return null;
  const gossip = m.gossip.map((g) => deedPhrase(g.deed, g.npcName));
  const heard = gossip.length > 0 ? `people in ${m.town.name} say the traveller ${list(gossip)}.` : '';
  if (m.known) {
    const said = [KNOWN[m.feeling], `What you remember of them: ${m.summary !== '' ? m.summary : deedsSummary(m)}`];
    return [...said, ...(heard !== '' ? [`Also, ${heard}`] : [])].join(' ');
  }
  const cold = m.feeling === 'hostile' || m.feeling === 'wary';
  if (heard === '') return cold ? `You have not met this traveller, but ${m.town.name} does not trust them. Be wary of them.` : null;
  return `You have not met this traveller, but ${heard} ${cold ? 'You are wary of them: say what you heard.' : 'Bring up what you heard.'}`;
}

const THREAT = /\b(or else|i('ll| will) (hurt|kill|beat|burn|smash|end|break)|you('ll| will) (regret|pay)|watch your back|i('m| am) going to (hurt|kill|beat|get you))/i;
/**
 * Kind words aimed at the NPC: thanks, an apology, a compliment ("you are so kind"), not any nice word ("nice day"
 * counted as kindness in a live check and the whole town heard about it).
 */
const KIND =
  /\b(thank(s| you)|appreciate|sorry|apologi[sz]e|cheers|(you('re| are)|you look|that'?s|what a) (so |very |really )?(kind|nice|lovely|wonderful|great|sweet|helpful|beautiful|clever|smart|wise)|love (you|your)|good to see you|nice to meet you)\b/i;

/** The talk deeds of a conversation, from what the player did and said (never from the model). */
export function deedsOf(turns: readonly ChatTurn[]): NpcTalkDeed[] {
  const found = new Set<NpcTalkDeed>();
  for (const t of turns) {
    if (t.role !== 'user') continue;
    if (t.shown !== undefined) found.add('hit');
    else if (robbed(t)) found.add('robbed');
    else {
      if (provoked(t)) found.add('insulted');
      if (THREAT.test(t.content)) found.add('threatened');
    }
  }
  if (found.size === 0 && turns.some((t) => t.role === 'user' && t.shown === undefined && KIND.test(t.content))) found.add('kindWords');
  return NPC_TALK_DEEDS.filter((d) => found.has(d));
}

/** At least one reply from the model: a conversation worth remembering. */
export function hadExchange(turns: readonly ChatTurn[]): boolean {
  return turns.some((t) => t.role === 'assistant' && t.content !== '…' && t.content.trim() !== '');
}

const FALLBACK_DEED: Readonly<Record<NpcTalkDeed, string>> = {
  hit: 'The traveller hit me.',
  insulted: 'The traveller insulted me.',
  threatened: 'The traveller threatened me.',
  robbed: 'The traveller demanded my money.',
  kindWords: 'The traveller was kind to me.',
};

/** A summary without the model: the deeds, then what the NPC did ("You slapped the traveller." → "I slapped..."). */
export function fallbackSummary(turns: readonly ChatTurn[]): string {
  const deeds = deedsOf(turns).map((d) => FALLBACK_DEED[d]);
  const done = turns.flatMap((t) => t.events ?? []).map((e) => e.replace(/^You /, 'I '));
  const all = [...deeds, ...done];
  return cleanSummary(all.length > 0 ? all.join(' ') : 'The traveller stopped to chat with me.') ?? 'The traveller stopped to chat with me.';
}

/** The model's summary made safe to store: one or two sentences, no dashes or quotes, or null when unusable. */
export function cleanSummary(text: string): string | null {
  const t = noDashes(text)
    .replace(/[“”"*_#`[\]()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length < 8 || /(traveller|you|me):/i.test(t) || /^(as an ai|i cannot|i can't|sorry)/i.test(t)) return null;
  const two = t.match(/[^.!?]+[.!?]+/g)?.slice(0, 2).map((x) => x.trim()).join(' ') ?? t;
  const out = two.length > NPC_MEMORY_NOTE_MAX ? `${two.slice(0, NPC_MEMORY_NOTE_MAX - 1).trimEnd()}…` : two;
  return out.length >= 8 ? out : null;
}

/** The conversation as the summary call reads it: plain lines, a hit as what it was, the tool events in brackets. */
export function summaryTranscript(p: NpcPersona, turns: readonly ChatTurn[]): string {
  return turns
    .map((t) => {
      if (t.role === 'user') return t.shown !== undefined ? `(The traveller ${t.content.includes('kicks') ? 'kicked' : 'slapped'} you.)` : `Traveller: ${t.content}`;
      const ev = (t.events ?? []).length > 0 ? ` [${t.events!.join(' ')}]` : '';
      return `${p.name}: ${t.content}${ev}`;
    })
    .join('\n');
}

export function summaryMessages(p: NpcPersona, turns: readonly ChatTurn[]): { role: 'system' | 'user'; content: string }[] {
  return [
    {
      role: 'system',
      content:
        `You are ${p.name}, a villager in Ewamon. Write one or two short sentences you will remember about the traveller from the ` +
        'conversation below: what they did or said to you, and how you feel about them now. Write as yourself (I, me) and call ' +
        `them the traveller. ${NO_DASHES}`,
    },
    { role: 'user', content: summaryTranscript(p, turns.slice(-16)) },
  ];
}

/** One or two sentences from the NPC's point of view: the model's, else the fallback. Never throws. */
export async function summarize(p: NpcPersona, turns: readonly ChatTurn[], signal?: AbortSignal): Promise<string> {
  try {
    const res = await chatOnce({ messages: summaryMessages(p, turns), maxTokens: 90, temperature: 0.2, timeoutMs: SUMMARY_TIMEOUT_MS, ...(signal !== undefined ? { signal } : {}) });
    return cleanSummary(res.content) ?? fallbackSummary(turns);
  } catch (_e) {
    return fallbackSummary(turns);
  }
}
