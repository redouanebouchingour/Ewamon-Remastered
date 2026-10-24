/**
 * The battle commentator and the opposing trainer's banter (LLM feature 3): the words. Which moment gets a line is
 * battle/commentator.ts's call (battle/moments.ts reads the moments off the core events); this module holds the
 * deterministic templates (several per moment, picked by a seeded picker that never repeats a line back to back), the
 * throttle that keeps the commentary to highlights, and the one structured call per bank that pre-writes lines for the
 * moments of this battle.
 *
 * A commentator line is a headline and a colour line. The headline is always a template filled with the facts (who
 * landed the crit, who fainted): the model never says who did what. The colour line comes from the model's bank when it
 * is back and has a line for the moment, else from the templates. The trainer's line is the bank's (in the trainer's
 * voice, a villager's memory of the player folded in) or a template (a villager's by how it feels about the player and
 * what it remembers).
 *
 * Measured on gemma4-e2b (the docker model, 2026-10-24, CPU, no other load), reasoning off, JSON schema grammar:
 * - Per-event calls (one line for one moment, names and types given, temperature 0.7): 5 calls at 0.7 to 1.4 s, 10 to
 *   12 tokens each; the facts roughly right but loose and run-on ("Bramble is down the field a real struggle now",
 *   "He grabs the Mossling a perfect catch.").
 * - A commentator bank with the names in the prompt (9 moments x 2 lines, `{name}` asked for the creature): 3 calls at
 *   13 to 17 s, 250 to 300 tokens. `{name}` was never used; the names were baked in and often on the wrong side ("Rook
 *   faints in flames", "Rook is poisoned by the grass"). So the bank is name free: the model gets the kind of battle and
 *   the types, and writes reactions "without naming anyone". With 12 moments: 6 of 6 parsed at 21 to 24 s, 350 to 375
 *   tokens, but the super-effective, knockout and status lines said who or what, wrongly ("Water power overwhelms the
 *   electric foe" in an Electric against Water battle, "One foe faints", "Poisoned status affects the opponent", "Final
 *   Pokemon"). Shipped: 9 moments (those three keep to the templates), 6 of 6 parsed at 13 to 21 s, 265 to 281 tokens,
 *   96 of 108 lines kept (`cleanLine` drops a line that names a creature, a side, "they", a type or a band outside the
 *   opening). The lines are flat ("A critical hit lands a big blow.") but true either way, so they join the templates'
 *   pool rather than replace it; the opening uses the bank alone ("Electric meets Water in this fight.").
 * - The trainer bank (5 moments x 2 lines in the trainer's voice). With the persona and the memory in the system
 *   prompt, a route trainer parsed, but 12 of 13 calls for a villager, a camp guard or a gym leader never reached the
 *   JSON: gemma4 opened a `<|channel>` thought block, llama.cpp filed it under `reasoning_content` and the 320 tokens ran
 *   out (also at temperature 0, also with `json_object`). A neutral system prompt ("You write short battle lines for a
 *   game character. Answer with JSON only.") with the persona, the memory and the moments in the user turn: 10 of 10
 *   parsed at 9.9 to 14 s. The moments need their side spelled out: "faint: one of your own Ewamon faints" came back
 *   gloating as if the traveller's creature fell in 9 of 10 replies ("See? Even your allies are weak"); "faint: the
 *   traveller just knocked out one of your Ewamon, you are annoyed" brought that down to about 5 of 24 lines ("Your
 *   arrogance cost you a valuable ally"), and "loss: the traveller beat you, admit it" gave gloating loss lines
 *   ("Admit your defeat, traveler, you lost.") in at least 6 of 12 replies, so it became "you lost to the traveller, you
 *   are a sore loser" plus a guard (`WRONG_WAY`) that drops a loss line telling the traveller they lost. Shipped
 *   wording: 12 of 12 parsed (6 personas x 2) at 10.1 to 14.9 s, 160 to 183 tokens; the wary archivist named the slap
 *   in 2 of 2 ("You will regret that foolish slap."), the camp guard and the ghost spoke as such.
 * - Pre-writing wins here: a battle needs 5 to 10 lines. Per-event calls would put that many calls on a CPU model the
 *   whole server shares (features 1 and 2 measured 1 to 15 s per call under load), each racing the turn it is about,
 *   and the late ones would be dropped. Two bank calls per battle (the trainer's first, then the commentator's) cost
 *   about 25 to 35 s of model time once, while the templates speak; whatever is back by a moment is used, and a bank
 *   that answers after the battle is dropped. Temperature 0.4 (commentator) and 0.5 (trainer): the lines are meant to
 *   vary between battles; the grammar and the zod schemas (`CasterBankSchema`, `TrainerBankSchema`) keep the shape.
 */
import { CASTER_BANK_KEYS, CasterBankSchema, TRAINER_BANK_KEYS, TrainerBankSchema, BANK_LINES_MAX } from '@ewa/protocol';
import type { CasterBankKey, NpcMemoryView, TrainerBankKey } from '@ewa/protocol';
import type { BandKind, StatusId } from '@ewa/core';
import type { Moment, MomentKind } from '../battle/moments';
import { NO_DASHES, chatOnce, noDashes } from './llm';
import type { LlmMessage } from './llm';

// ---- templates ----------------------------------------------------------------------------------------------------

/** The headline: the facts of the moment. `{name}` the creature it is about, `{other}` the other one, `{player}`. */
export const HEADLINES: Readonly<Record<MomentKind, readonly string[]>> = {
  opening: ['{name} against {other}', '{name} takes on {other}', 'It is {name} versus {other}'],
  crit: ['Critical hit from {name}!', '{name} finds the weak spot!', '{name} lands it clean!'],
  super: ['Super effective from {name}!', '{name} hits {other} where it hurts!', '{name} has the type edge!'],
  knockout: ['{name} is down!', '{name} cannot continue!', 'Down goes {name}!'],
  comeback: ['{name} hangs on and takes {other} down!', 'On its last legs, {name} wins it!', '{name} refuses to quit!'],
  status: ['{name} is {status}!', 'Now {name} is {status}!', 'Trouble: {name} is {status}!'],
  transform: ['{name} goes {band}!', 'The {band} form! {name} transforms!', '{name} breaks into its {band} form!'],
  lastOne: ['{name} is the last one standing!', 'Down to {name}, the last of the team!', 'Last one out: {name}!'],
  catch: ['{name} is caught!', 'Gotcha! {name} is in!', '{name} stays in the orb!'],
  escape: ['{name} breaks free!', 'Out pops {name}!', 'So close! {name} escapes!'],
  win: ['{player} takes the win!', 'Victory for {player}!', 'That is the match, {player} wins!'],
  loss: ['{player} goes down!', 'It is over for {player}!', 'A loss for {player} today.'],
};

/** The colour line when the bank has none: name free, true whichever side the moment fell to. */
export const COLOUR: Readonly<Record<MomentKind, readonly string[]>> = {
  opening: ['And we are under way!', 'Here we go, folks!', 'Settle in, this should be a good one.', 'The crowd is ready. Are you?'],
  crit: ['That one will leave a mark.', 'Right on target!', 'The whole arena felt that one.'],
  super: ['Textbook type play!', 'That is going to sting.', 'The matchup is paying off.'],
  knockout: ['What a blow!', 'That changes the picture.', 'The crowd is on its feet!'],
  comeback: ['Never count them out!', 'Unbelievable grit!', 'You cannot script this!'],
  status: ['That could decide it.', 'A nasty twist.', 'Keep an eye on that one.'],
  transform: ['The arena is shaking!', 'Look at that power!', 'This is what we came for!'],
  lastOne: ['Everything rides on this.', 'No room for error now.', 'It all comes down to this.'],
  catch: ['A new teammate!', 'What a throw!', 'Into the collection it goes!'],
  escape: ['Not this time!', 'So close!', 'It wants to fight on!'],
  win: ['What a performance!', 'Take a bow!', 'A deserved win!'],
  loss: ['Tough one. Regroup and come back.', 'Not their day.', 'There is always a rematch.'],
};

/** The trainer's moments, from the trainer's side. */
export type TrainerMoment = TrainerBankKey;

/** A trainer's lines when the bank has none. `{name}` = the trainer's own creature of the moment. */
export const TRAINER_LINES: Readonly<Record<TrainerMoment, readonly string[]>> = {
  start: ['Let us see what you have got.', 'Do not expect me to go easy on you.', 'You picked the wrong trainer to fight.', 'I have been waiting for a real challenge.'],
  faint: ['Hey! Get up, {name}!', 'Lucky shot. That is all it was.', '{name} deserved better than that.', 'Fine. I still have more.'],
  last_one: ['{name}, it is all on you now!', 'You have not won yet. Go, {name}!', 'My last one, and my best one.'],
  win: ['Told you. Better luck next time.', 'Was that all you had?', 'Come back when you are stronger.'],
  loss: ['Fine, you win this one.', 'Not bad. Not bad at all.', 'I will remember this.'],
};

/** A camp guard and a ghost speak for someone else; a villager by how it feels about the player. */
export const GUARD_START = ['Nobody takes this camp while I stand guard.', 'You want this camp? Go through me.'];
export const GHOST_START = ['You face what they left behind.', 'Their team still fights, even now.'];
const VILLAGER_START: Readonly<Record<'cold' | 'warm' | 'plain', readonly string[]>> = {
  cold: ['I have not forgotten you. Let us settle this.', 'You have some nerve, fighting me now.', 'After what you did? This one is personal.'],
  warm: ['No hard feelings, friend. Let us have a good one!', 'For a friend I still play to win.', 'Go easy? Not a chance, friend!'],
  plain: ['All right, traveller. Show me what you have.', 'You asked for it. Here we go.', 'Let us see if you are as good as you think.'],
};
/** What a villager remembers, said at the start (a deed of the player against this NPC, newest first). */
const DEED_START: Readonly<Partial<Record<NpcMemoryView['deeds'][number]['deed'], string>>> = {
  hit: 'You hit me last time. Try that now.',
  robbed: 'You took what was mine. Now I take this win.',
  insulted: 'Still think I am a joke? Watch this.',
  threatened: 'You threatened me. Let us see you back it up.',
  helped: 'You helped me before. I will not go easy on you though!',
  battleLost: 'I beat you last time. I can do it again.',
  battleWon: 'You beat me once. Not again.',
};

const STATUS_WORD: Readonly<Record<StatusId, string>> = { burn: 'burned', poison: 'poisoned', paralyze: 'paralyzed', sleep: 'fast asleep', freeze: 'frozen solid', confuse: 'confused' };
const BAND_WORD: Readonly<Record<BandKind, string>> = { majin: 'Majin', tenjin: 'Tenjin' };

/** `{name}` and friends filled in; a placeholder without a value goes with the words around it unchanged. */
export function fill(template: string, v: { readonly name?: string; readonly other?: string | null; readonly status?: StatusId; readonly band?: BandKind; readonly player?: string }): string {
  return template
    .replace(/\{name\}/g, v.name ?? 'It')
    .replace(/\{other\}/g, v.other ?? 'its foe')
    .replace(/\{status\}/g, v.status === undefined ? 'in trouble' : STATUS_WORD[v.status])
    .replace(/\{band\}/g, v.band === undefined ? 'battle' : BAND_WORD[v.band])
    .replace(/\{player\}/g, v.player ?? 'the challenger');
}

// ---- the picker and the throttle ----------------------------------------------------------------------------------

/** FNV-1a over a string, unsigned. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface Picker {
  /** an index into a list of `n` lines under `key`: seeded, and never the one this key gave last time */
  pick(key: string, n: number): number;
}

/** A battle's line picker: the same battle picks the same lines; a key never repeats its last line back to back. */
export function createPicker(seed: string): Picker {
  const count = new Map<string, number>();
  const last = new Map<string, number>();
  return {
    pick(key, n) {
      if (n <= 1) return 0;
      const c = count.get(key) ?? 0;
      count.set(key, c + 1);
      let i = hash(`${seed}|${key}|${c}`) % n;
      if (i === last.get(key)) i = (i + 1 + (hash(`${seed}|${key}|${c}|r`) % (n - 1))) % n;
      last.set(key, i);
      return i;
    },
  };
}

/** a minor moment needs this long since the last commentator line */
export const CASTER_GAP_MS = 7000;

export interface Throttle {
  /** whether a moment of `kind` may be called now (true also records it) */
  take(kind: MomentKind, major: boolean, now: number): boolean;
}

/**
 * Highlights, not a play by play: a major moment (opening, win, loss, catch, transform, comeback, last one) always
 * speaks; a minor one (crit, super effective, knockout, status, a break-out) only CASTER_GAP_MS after the last line and
 * never the same kind as the last minor line.
 */
export function createThrottle(gapMs = CASTER_GAP_MS): Throttle {
  let lastAt = Number.NEGATIVE_INFINITY;
  let lastMinor: MomentKind | null = null;
  return {
    take(kind, major, now) {
      if (!major) {
        if (now - lastAt < gapMs || kind === lastMinor) return false;
        lastMinor = kind;
      }
      lastAt = now;
      return true;
    },
  };
}

// ---- the banks ----------------------------------------------------------------------------------------------------

export type CasterBank = Partial<Record<CasterBankKey, readonly string[]>>;
export type TrainerBank = Partial<Record<TrainerBankKey, readonly string[]>>;

/** the bank key of a commentator moment (super effective, knockout and status keep to the templates) */
export const CASTER_KEY: Readonly<Partial<Record<MomentKind, CasterBankKey>>> = {
  opening: 'opening', crit: 'crit', comeback: 'comeback', transform: 'transform', lastOne: 'last_one', catch: 'catch', escape: 'escape', win: 'win', loss: 'loss',
};

/**
 * A colour line names nobody: a line that says who (the player, the opponent, a foe, "they") could say it wrong. "You"
 * is the audience and stays.
 */
const SAYS_WHO = /\b(opponents?|players?|foes?|enem(y|ies)|rivals?|challengers?|trainers?|traveller|traveler|underdog|they|their|them|he|she|his|her|pok[eé]mon)\b/i;
/** a type (or a band) named outside the opening says which side had the edge or which form it was, and the model gets that wrong */
const SAYS_TYPE = /\b(normal|fire|water|grass|electric|ice|fighting|poison|ground|flying|psychic|bug|rock|ghost|dragon|dark|steel|fairy|light|plants?|bugs?|majin|tenjin)\b/i;
const LINE_MAX = 90;
const WORDS_MAX = 16;

/** One model line tidied for the screen, or null when it should not show. `nameless`: the commentator's colour lines. */
export function cleanLine(raw: unknown, nameless: boolean, names: readonly string[] = [], typesOk = true): string | null {
  if (typeof raw !== 'string') return null;
  let t = noDashes(raw).replace(/\s+/g, ' ').trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim();
  if (t.length < 3 || t.length > LINE_MAX || /[{}<>*#_\\|]/.test(t) || t.split(' ').length > WORDS_MAX) return null;
  if (nameless && SAYS_WHO.test(t)) return null;
  if (nameless && !typesOk && SAYS_TYPE.test(t)) return null;
  if (nameless && names.some((n) => n.length > 2 && t.toLowerCase().includes(n.toLowerCase()))) return null;
  if (!/[.!?]$/.test(t)) t = `${t}.`;
  return t[0]!.toUpperCase() + t.slice(1);
}

/** The first JSON object in a reply (the model may wrap it in a code fence or a word). */
function jsonOf(content: string): unknown {
  const a = content.indexOf('{');
  const b = content.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try {
    return JSON.parse(content.slice(a, b + 1)) as unknown;
  } catch (_e) {
    return null;
  }
}

/**
 * A trainer line that has the outcome backwards: a `loss` line that says the traveller lost ("Admit your defeat"), a
 * `win` line that says the traveller won.
 */
const WRONG_WAY: Readonly<Partial<Record<TrainerBankKey, RegExp>>> = {
  loss: /\byou (lost|lose|are beaten|failed)\b|\byour (defeat|loss|failure)\b|\badmit\b|\bthink you could\b/i,
  win: /\byou (won|win|beat me)\b|\bI lost\b|\bmy (defeat|loss)\b/i,
};

function keep(lines: readonly unknown[] | undefined, nameless: boolean, names: readonly string[], wrong?: RegExp, typesOk = true): string[] {
  const out: string[] = [];
  for (const l of lines ?? []) {
    const c = cleanLine(l, nameless, names, typesOk);
    if (c !== null && wrong !== undefined && wrong.test(c)) continue;
    if (c !== null && !out.includes(c)) out.push(c);
    if (out.length >= BANK_LINES_MAX) break;
  }
  return out;
}

/** The commentator bank in a model reply: zod-checked, every line cleaned; null when nothing usable came back. */
export function parseCasterBank(content: string, names: readonly string[] = []): CasterBank | null {
  const parsed = CasterBankSchema.safeParse(jsonOf(content));
  if (!parsed.success) return null;
  const bank: Partial<Record<CasterBankKey, string[]>> = {};
  for (const k of CASTER_BANK_KEYS) {
    const l = keep(parsed.data[k], true, names, undefined, k === 'opening');
    if (l.length > 0) bank[k] = l;
  }
  return Object.keys(bank).length === 0 ? null : bank;
}

/** The trainer bank in a model reply: zod-checked, every line cleaned; null when nothing usable came back. */
export function parseTrainerBank(content: string): TrainerBank | null {
  const parsed = TrainerBankSchema.safeParse(jsonOf(content));
  if (!parsed.success) return null;
  const bank: Partial<Record<TrainerBankKey, string[]>> = {};
  for (const k of TRAINER_BANK_KEYS) {
    const l = keep(parsed.data[k], false, [], WRONG_WAY[k]);
    if (l.length > 0) bank[k] = l;
  }
  return Object.keys(bank).length === 0 ? null : bank;
}

/** JSON schemas for llama.cpp's grammar: every key an array of exactly two strings. */
function schemaOf(keys: readonly string[]): Record<string, unknown> {
  const arr = { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 2 };
  return { type: 'object', properties: Object.fromEntries(keys.map((k) => [k, arr])), required: keys, additionalProperties: false };
}

/** The battle the commentator bank is written for (no names: the bank is name free). */
export interface MatchInfo {
  /** "a route trainer battle", "a gym battle against the Water gym leader", "a wild encounter" */
  readonly kind: string;
  readonly ownTypes: readonly string[];
  readonly foeTypes: readonly string[];
}

const CASTER_MOMENTS =
  'opening: the match starts\ncrit: a critical hit\ncomeback: a creature at very low HP knocks out its foe\n' +
  'transform: a creature transforms into its Majin or Tenjin form\nlast_one: a team sends out its last creature\n' +
  'catch: a wild creature is caught\nescape: a wild creature breaks out of the orb\nwin: the player wins the battle\nloss: the player loses the battle';

const types = (t: readonly string[]): string => (t.length === 0 ? 'an unknown' : t.join(' and '));

export function casterBankMessages(m: MatchInfo): LlmMessage[] {
  return [
    { role: 'system', content: `You write short lines for a game's battle broadcast. Answer with JSON only. ${NO_DASHES}` },
    {
      role: 'user',
      content:
        `You are the excited commentator of ${m.kind}: a ${types(m.ownTypes)} type against a ${types(m.foeTypes)} type. Write two different short reactions ` +
        `for each moment, one sentence of at most 8 words each. Do not name anyone and do not say who: no names, no "the player", no "the opponent". ${NO_DASHES}\n${CASTER_MOMENTS}`,
    },
  ];
}

/** Who the opposing trainer is, for its bank. */
export interface TrainerPersona {
  /** "Rook, a route trainer", "Brisa, the Water gym leader of Saltmourn", "Hessa Dunmore, town archivist, a villager" */
  readonly who: string;
  /** a villager's memory of the player, said as an instruction ("You do not trust the traveller: ..."), else '' */
  readonly memory: string;
}

const TRAINER_MOMENTS =
  'start: the battle starts, you are sure you will win\nfaint: the traveller just knocked out one of your Ewamon, you are annoyed\n' +
  'last_one: you are down to your last Ewamon and send it out\nwin: you beat the traveller, you gloat\nloss: you lost to the traveller, you are a sore loser';

export function trainerBankMessages(p: TrainerPersona): LlmMessage[] {
  return [
    { role: 'system', content: `You write short battle lines for a game character. Answer with JSON only. ${NO_DASHES}` },
    {
      role: 'user',
      content:
        `You are ${p.who}, in an Ewamon battle against a traveller. ${p.memory.length > 0 ? `${p.memory} ` : ''}Write two lines for each moment, at most 12 words ` +
        `each, said to the traveller as "you", trash talk in character. ${NO_DASHES}\n${TRAINER_MOMENTS}`,
    },
  ];
}

/** a bank call's budget: past it the battle goes on with the templates */
export const BANK_TIMEOUT_MS = 45_000;

export async function fetchCasterBank(m: MatchInfo, names: readonly string[], signal?: AbortSignal): Promise<CasterBank | null> {
  try {
    const r = await chatOnce({ messages: casterBankMessages(m), maxTokens: 360, temperature: 0.4, json: schemaOf(CASTER_BANK_KEYS), timeoutMs: BANK_TIMEOUT_MS, ...(signal ? { signal } : {}) });
    return parseCasterBank(r.content, names);
  } catch (_e) {
    return null;
  }
}

export async function fetchTrainerBank(p: TrainerPersona, signal?: AbortSignal): Promise<TrainerBank | null> {
  try {
    const r = await chatOnce({ messages: trainerBankMessages(p), maxTokens: 320, temperature: 0.5, json: schemaOf(TRAINER_BANK_KEYS), timeoutMs: BANK_TIMEOUT_MS, ...(signal ? { signal } : {}) });
    return parseTrainerBank(r.content);
  } catch (_e) {
    return null;
  }
}

// ---- villagers ----------------------------------------------------------------------------------------------------

/** How a villager's memory goes into its bank: the feeling and what to do with it first, the memory last (feature 1). */
export function memoryInstruction(m: NpcMemoryView | null): string {
  if (m === null) return '';
  const summary = m.summary.trim();
  switch (m.feeling) {
    case 'hostile':
    case 'wary':
      return `You do not trust the traveller and you want to beat them.${summary.length > 0 ? ` What you remember of them: ${summary}` : ''}`;
    case 'liked':
    case 'trusted':
      return `You like the traveller, but you still want to win.${summary.length > 0 ? ` What you remember of them: ${summary}` : ''}`;
    default:
      return summary.length > 0 ? `What you remember of the traveller: ${summary}` : '';
  }
}

/** A villager's start lines by its memory: a remembered deed first, else its feeling. */
export function villagerStartLines(m: NpcMemoryView | null): readonly string[] {
  if (m === null) return VILLAGER_START.plain;
  const deed = m.deeds.map((d) => DEED_START[d.deed]).find((l) => l !== undefined);
  const mood = m.feeling === 'hostile' || m.feeling === 'wary' ? 'cold' : m.feeling === 'liked' || m.feeling === 'trusted' ? 'warm' : 'plain';
  return deed === undefined ? VILLAGER_START[mood] : [deed];
}

export type { Moment };
