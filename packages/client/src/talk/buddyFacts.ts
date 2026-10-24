/**
 * Talk to your own Ewamon (LLM feature 6): what a creature knows about itself, as "you" facts, and the voice it speaks
 * in. Pure and deterministic: a creature from the save, its history (`GET /creature/:id/history`, null when signed out
 * or not back yet), the session's memories of it (state/buddy.ts, read off the battles it fought) and where the player
 * is now go in; short true sentences come out. The model in talk/buddy.ts only words them, and the templates here
 * speak whenever the model is down, slow or says something the facts do not hold.
 *
 * The game has no nature and no friendship value: the voice (`voiceOf`) is a temperament and two creature sounds
 * seeded by the creature's id (so one creature always sounds the same), and the bond is read from what the save
 * already holds: how long it has been with its trainer, the badges it was there for, the battles of this session.
 *
 * Sides are said the way feature 5 found the small model needs them: the creature is "you", a foe is "a wild X" or
 * "the opponent's X", never "their X" (with "their" the model swapped whose creature was whose).
 */
import { SPECIES, ZONES } from '@ewa/content';
import type { ZoneDef } from '@ewa/content';
import { calcMaxHp, tracksHonor } from '@ewa/core';
import type { CreatureInstance, SpeciesDef, StatusId, TypeName, WeatherKind } from '@ewa/core';
import type { CreatureEvent, CreatureHistory } from '@ewa/protocol';

const speciesById = new Map<string, SpeciesDef>(SPECIES.map((sp) => [sp.id, sp]));
const zoneById = new Map<string, ZoneDef>(ZONES.map((z) => [z.id, z]));

export const speciesNameOf = (id: string): string => speciesById.get(id)?.name ?? id;
export const zoneNameOf = (id: string | null | undefined): string => (id == null ? 'somewhere' : (zoneById.get(id)?.name ?? id));
/** move ids are their display names ('Vine Lash') */
export const moveNameOf = (id: string): string => id;

// ---- the voice -----------------------------------------------------------------------------------------------------

export type VoiceStyle = 'bouncy' | 'shy' | 'proud' | 'sleepy' | 'grumpy' | 'curious';
export const VOICE_STYLES: readonly VoiceStyle[] = ['bouncy', 'shy', 'proud', 'sleepy', 'grumpy', 'curious'];

/** how the prompt describes each temperament */
export const STYLE_WORDS: Readonly<Record<VoiceStyle, string>> = {
  bouncy: 'bouncy and cheerful',
  shy: 'shy and gentle',
  proud: 'proud and bold',
  sleepy: 'sleepy and slow',
  grumpy: 'grumpy but loyal',
  curious: 'curious and eager',
};

/** a creature sound per type (the second of the two sounds a creature makes) */
export const TYPE_SOUND: Readonly<Record<TypeName, string>> = {
  Normal: 'mrrp',
  Fire: 'fwoo',
  Water: 'blub',
  Grass: 'mlem',
  Electric: 'bzzt',
  Ice: 'brrr',
  Fighting: 'hup',
  Poison: 'hsss',
  Ground: 'grrm',
  Flying: 'kree',
  Psychic: 'hmmm',
  Bug: 'chirr',
  Rock: 'grrk',
  Ghost: 'oooo',
  Dragon: 'rawr',
  Steel: 'clank',
  Fairy: 'tee hee',
  Dark: 'hehh',
  Cosmic: 'vwoom',
};

export interface BuddyVoice {
  readonly style: VoiceStyle;
  /** the species' call ("Moss moss") and its type's sound ("mlem") */
  readonly sounds: readonly [string, string];
}

/** FNV-1a over a string: the creature's seed */
export function seedOf(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** The first syllable of a species name, the creature's call ("Mossling" → "Moss", "Ampmite" → "Amp"). */
export function callOf(name: string): string {
  const letters = name.replace(/[^A-Za-z]/g, '');
  const m = /^[^aeiouy]*[aeiouy]+/i.exec(letters);
  let syl = m?.[0] ?? letters;
  const next2 = letters.slice(syl.length, syl.length + 2).toLowerCase();
  const vowels = syl.length - (/^[^aeiouy]*/i.exec(syl)?.[0].length ?? 0);
  // a long vowel ends it ("Geo", "Bloo"); else one closing consonant, or two when they sound as one ("Moss", "Dust",
  // "Amp"), never "Bramb" / "Glimf" / "Geob"
  if (vowels >= 2) {
    // as it is
  } else if (CLUSTERS.has(next2)) syl += letters.slice(syl.length, syl.length + 2);
  else if (/^[^aeiouy]/.test(next2)) syl += letters.charAt(syl.length);
  syl = syl.slice(0, 6);
  return syl.length < 2 ? name : syl[0]!.toUpperCase() + syl.slice(1).toLowerCase();
}

const CLUSTERS: ReadonlySet<string> = new Set(['ss', 'st', 'sh', 'ck', 'ng', 'mp', 'nk', 'rk', 'll', 'rr', 'ff', 'zz', 'mm', 'nn', 'pp', 'tt', 'th', 'ch']);

/** The voice of one creature: the same for that creature every time (seeded by its id), its species' call. */
export function voiceOf(creatureId: string, speciesId: string): BuddyVoice {
  const h = seedOf(creatureId);
  const sp = speciesById.get(speciesId);
  const call = callOf(sp?.name ?? speciesId);
  const typeSound = TYPE_SOUND[sp?.types[0] ?? 'Normal'];
  return { style: VOICE_STYLES[h % VOICE_STYLES.length]!, sounds: [`${call} ${call.toLowerCase()}`, typeSound] };
}

// ---- the session's memories --------------------------------------------------------------------------------------

export type BuddyMemoryKind = 'won' | 'lost' | 'fainted' | 'ko' | 'levelUp' | 'learned' | 'evolveReady' | 'caught' | 'fled';

/** One thing a creature did this session (state/buddy.ts writes them from the battles' events). */
export interface BuddyMemory {
  readonly kind: BuddyMemoryKind;
  /** unix ms */
  readonly at: number;
  /** the other side, said as the facts say it: "a wild Ampmite", "Mira Thornwell" */
  readonly foe?: string;
  /** a move id: the one it landed (won / ko) or learned */
  readonly move?: string;
  /** `ko`: the creature it knocked out, said as "the opponent's X" or "a wild X" */
  readonly other?: string;
  /** levelUp: the new level */
  readonly level?: number;
  /** evolveReady: the species id it can become */
  readonly into?: string;
  /** caught: the species id caught */
  readonly caught?: string;
  /** the move landed was super effective */
  readonly superEffective?: boolean;
}

function ago(at: number, now: number): string {
  const min = (now - at) / 60_000;
  if (min < 3) return 'Just now';
  if (min < 60) return 'A little while ago';
  return 'Earlier today';
}

/** One memory as a "you" sentence. */
export function memoryFact(m: BuddyMemory, now: number): string {
  const when = ago(m.at, now);
  const move = m.move !== undefined ? moveNameOf(m.move) : null;
  switch (m.kind) {
    case 'won':
      return `${when}, you won a battle against ${m.foe ?? 'a foe'}${move !== null ? `, and your ${move} ${m.superEffective === true ? 'was super effective' : 'hit hard'}` : ''}.`;
    case 'lost':
      return `${when}, you and your trainer lost a battle against ${m.foe ?? 'a foe'}.`;
    case 'fainted':
      return `${when}, you fainted in the battle against ${m.foe ?? 'a foe'}.`;
    case 'ko':
      return `${when}, you knocked out ${m.other ?? 'a foe'}${move !== null ? ` with ${move}` : ''}.`;
    case 'levelUp':
      return `${when}, you grew to level ${m.level ?? '?'}.`;
    case 'learned':
      return `${when}, you learned the move ${move ?? 'a new move'}.`;
    case 'evolveReady':
      return `${when}, you felt ready to evolve into ${speciesNameOf(m.into ?? '')}.`;
    case 'caught':
      return `${when}, you helped your trainer catch a ${speciesNameOf(m.caught ?? '')}.`;
    case 'fled':
      return `${when}, you and your trainer ran from ${m.foe ?? 'a foe'}.`;
  }
}

// ---- where the player is -------------------------------------------------------------------------------------------

export interface BuddyPlace {
  readonly zoneId: string | null;
  /** 0..1, the room's clock (`ZoneState.timeOfDay`), null when unknown */
  readonly timeOfDay: number | null;
  readonly weather: WeatherKind | null;
}

/** The server's day: [0.25, 0.75) (spawnDirector.ts), night otherwise. */
export function isNight(timeOfDay: number): boolean {
  return timeOfDay < 0.25 || timeOfDay >= 0.75;
}

const WEATHER_FACT: Readonly<Record<WeatherKind, string | null>> = {
  none: null,
  sun: 'the sun is hot',
  rain: 'it is raining',
  sand: 'a strong wind blows',
  hail: 'it is snowing',
};

export function placeFact(p: BuddyPlace): string | null {
  if (p.zoneId === null) return null;
  const bits: string[] = [];
  if (p.timeOfDay !== null) bits.push(isNight(p.timeOfDay) ? 'it is night' : 'it is day');
  const w = p.weather !== null ? WEATHER_FACT[p.weather] : null;
  if (w !== null) bits.push(w);
  return `You and your trainer are in ${zoneNameOf(p.zoneId)} now${bits.length > 0 ? `, and ${bits.join(' and ')}` : ''}.`;
}

// ---- the creature itself -------------------------------------------------------------------------------------------

export type BuddyMood = 'happy' | 'proud' | 'sad' | 'tired' | 'calm';

/** How the creature feels: its HP and status first, then what happened in the last ten minutes. */
export function moodOf(c: Pick<CreatureInstance, 'speciesId' | 'level' | 'hp' | 'status'>, memories: readonly BuddyMemory[], now: number): BuddyMood {
  const sp = speciesById.get(c.speciesId);
  const max = sp !== undefined ? calcMaxHp(sp.baseHp, c.level) : 1;
  if (c.hp <= 0 || c.hp < max * 0.35) return 'tired';
  const recent = memories.filter((m) => now - m.at < 10 * 60_000);
  const last = recent[recent.length - 1];
  if (last === undefined) return c.status.length > 0 ? 'tired' : 'calm';
  if (last.kind === 'lost' || last.kind === 'fainted' || last.kind === 'fled') return 'sad';
  if (last.kind === 'levelUp' || last.kind === 'ko' || last.kind === 'evolveReady' || last.kind === 'learned') return 'proud';
  return 'happy';
}

const MOOD_FACT: Readonly<Record<BuddyMood, string>> = {
  happy: 'You feel happy.',
  proud: 'You feel proud and strong.',
  sad: 'You feel a bit sad.',
  tired: 'You feel tired and hurt.',
  calm: 'You feel calm.',
};

const STATUS_FACT: Readonly<Partial<Record<StatusId, string>>> = {
  poison: 'You are poisoned.',
  confuse: 'You feel dizzy and confused.',
  burn: 'You are burned.',
  paralyze: 'You are paralyzed.',
  sleep: 'You are asleep and drowsy.',
  freeze: 'You are frozen stiff.',
};

function joinTypes(types: readonly TypeName[]): string {
  return types.length === 2 ? `${types[0]} and ${types[1]}` : types[0]!;
}

/** How the creature came to its trainer (the history's first event, else `caughtAt`). */
export function metFact(c: Pick<CreatureInstance, 'caughtAt'>, history: CreatureHistory | null, trainer: string | null): string {
  const evs = history?.events ?? [];
  // the history is newest first: the first event is the last one
  const first = [...evs].reverse().find((e) => e.kind === 'met' || e.kind === 'hatched');
  const hands = evs.find((e): e is Extract<CreatureEvent, { kind: 'traded' | 'sold' | 'gift' }> => e.kind === 'traded' || e.kind === 'sold' || e.kind === 'gift');
  if (hands !== undefined && (trainer === null || hands.to === trainer)) {
    return hands.kind === 'traded' ? 'You came to your trainer in a trade.' : hands.kind === 'sold' ? 'Your trainer got you on the market.' : 'You came to your trainer as a gift from another trainer.';
  }
  if (first?.kind === 'hatched') return `You hatched from an egg in ${zoneNameOf(first.zoneId)}.`;
  if (first?.kind === 'met') {
    return first.how === 'caught' ? `Your trainer caught you in ${zoneNameOf(first.zoneId)} at level ${first.level}.` : `Your trainer got you as a gift at level ${first.level}.`;
  }
  if (c.caughtAt !== null) return `Your trainer caught you in ${zoneNameOf(c.caughtAt.zoneId)}.`;
  return 'Your trainer got you as a gift, at the very start.';
}

/** "You have been with your trainer for 3 days." from the met event or `caughtAt`; null when nothing says when. */
export function togetherFact(c: Pick<CreatureInstance, 'caughtAt'>, history: CreatureHistory | null, now: number): string | null {
  const evs = history?.events ?? [];
  const first = [...evs].reverse()[0];
  const since = first !== undefined ? Date.parse(first.at) : (c.caughtAt?.at ?? Number.NaN);
  if (!Number.isFinite(since)) return null;
  const days = Math.floor((now - since) / 86_400_000);
  if (days < 1) return 'You met your trainer today.';
  return days === 1 ? 'You have been with your trainer for one day.' : `You have been with your trainer for ${days} days.`;
}

/** What the history adds: the last evolution, the badges, the Champion, a legendary, a nemesis. */
export function historyFacts(history: CreatureHistory | null): string[] {
  const evs = history?.events ?? [];
  const out: string[] = [];
  const evolved = evs.find((e): e is Extract<CreatureEvent, { kind: 'evolved' }> => e.kind === 'evolved');
  if (evolved !== undefined) out.push(`You evolved from a ${speciesNameOf(evolved.from)}.`);
  const badges = evs.filter((e) => e.kind === 'badge').length;
  if (badges > 0) out.push(badges === 1 ? 'You were in the party that won a gym badge.' : `You were in the party that won ${badges} gym badges.`);
  if (evs.some((e) => e.kind === 'champion')) out.push('You were in the party that beat the Champion.');
  const nem = evs.find((e): e is Extract<CreatureEvent, { kind: 'nemesis' }> => e.kind === 'nemesis' && e.how === 'beaten');
  if (nem !== undefined) out.push(`You struck down a nemesis named ${nem.name}.`);
  return out;
}

/** Shiny, alpha, a Majin / Tenjin form, bandborn, the honor ledger. */
export function natureFacts(c: Pick<CreatureInstance, 'speciesId' | 'isShiny' | 'isAlpha' | 'honor' | 'bandborn'>): string[] {
  const sp = speciesById.get(c.speciesId);
  const out: string[] = [];
  if (c.isShiny === true) out.push('You are shiny: your colours are rare and special.');
  if (c.isAlpha) out.push('You are an alpha, bigger than others of your kind.');
  const form = sp?.battleForm;
  if (form?.kind === 'majin') out.push(`In battle you can turn into your Majin form when you are hurt.`);
  else if (form?.kind === 'tenjin') out.push(`In battle you can turn into your Tenjin form while you are strong.`);
  if (c.bandborn === true) out.push('You were born from a Majin parent and a Tenjin parent.');
  if (sp !== undefined && tracksHonor(sp)) {
    const h = c.honor ?? 0;
    out.push(h >= 3 ? 'You fight with honor, fair and clean.' : h <= -3 ? 'You fight dirty and ruthless.' : 'Your heart is torn between fair and dirty fighting.');
  }
  return out;
}

// ---- the profile -------------------------------------------------------------------------------------------------

export interface BuddyContext {
  readonly history: CreatureHistory | null;
  /** this creature's memories this session, oldest first */
  readonly memories: readonly BuddyMemory[];
  readonly place: BuddyPlace | null;
  /** it is the party's lead (it walks behind the player) */
  readonly lead: boolean;
  /** the player's name (a trade's `to`) */
  readonly trainer: string | null;
  readonly now: number;
}

export interface BuddyProfile {
  readonly id: string;
  /** nickname or species name */
  readonly name: string;
  readonly speciesId: string;
  readonly speciesName: string;
  readonly types: readonly TypeName[];
  readonly level: number;
  readonly voice: BuddyVoice;
  readonly mood: BuddyMood;
  /** "you" sentences, all true, the most important first (at most `MAX_BUDDY_FACTS`) */
  readonly facts: readonly string[];
  /** the names it may use for itself */
  readonly selfNames: readonly string[];
}

/** the most facts one prompt carries (feature 5: the small model words six or seven lines well, a dozen badly) */
export const MAX_BUDDY_FACTS = 9;
/** memories in a prompt */
export const MAX_MEMORY_FACTS = 3;

export type BuddyCreature = Pick<CreatureInstance, 'id' | 'speciesId' | 'nickname' | 'level' | 'hp' | 'status' | 'caughtAt' | 'isAlpha' | 'isShiny' | 'honor' | 'bandborn'>;

/** Everything the creature knows about itself, as "you" facts. */
export function buddyProfile(c: BuddyCreature, ctx: BuddyContext): BuddyProfile {
  const sp = speciesById.get(c.speciesId);
  const speciesName = sp?.name ?? c.speciesId;
  const types = sp?.types ?? (['Normal'] as const);
  const name = c.nickname ?? speciesName;
  const mood = moodOf(c, ctx.memories, ctx.now);
  const who = c.nickname !== null && c.nickname !== speciesName ? `You are ${name}, a ${joinTypes(types)} type ${speciesName}.` : `You are ${speciesName}, a ${joinTypes(types)} type Ewamon.`;
  const core: string[] = [who, `You are level ${c.level}.`, metFact(c, ctx.history, ctx.trainer)];
  const together = togetherFact(c, ctx.history, ctx.now);
  if (together !== null) core.push(together);
  const status = c.status.map((st) => STATUS_FACT[st]).find((x) => x !== undefined);
  core.push(c.hp <= 0 ? 'You fainted and need rest at a healer.' : (status ?? MOOD_FACT[mood]));
  const memories = ctx.memories.slice(-MAX_MEMORY_FACTS).reverse().map((m) => memoryFact(m, ctx.now));
  const place = ctx.place !== null ? placeFact(ctx.place) : null;
  const extra = [...historyFacts(ctx.history), ...natureFacts(c)];
  const lead = ctx.lead ? ['You walk behind your trainer as the lead of the party.'] : [];
  const facts = [...core, ...memories, ...(place !== null ? [place] : []), ...extra, ...lead].slice(0, MAX_BUDDY_FACTS);
  return {
    id: c.id,
    name,
    speciesId: c.speciesId,
    speciesName,
    types,
    level: c.level,
    voice: voiceOf(c.id, c.speciesId),
    mood,
    facts,
    selfNames: [...new Set([name, speciesName])],
  };
}

// ---- templates -----------------------------------------------------------------------------------------------------

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

const MOOD_LINES: Readonly<Record<BuddyMood, readonly string[]>> = {
  happy: ['We did it! Happy happy.', 'Good day with you!', 'More adventure? Yes yes!'],
  proud: ['Did you see me? Strong!', 'I am getting stronger for you.', 'Look at me now!'],
  sad: ['Sorry... I try harder next time.', 'That one hurt. Stay with me?', 'Next time we win. Promise.'],
  tired: ['So tired... rest soon?', 'Ow. I need a healer.', 'Sleepy... carry on slow?'],
  calm: ['I like walking with you.', 'Where we go next?', 'Here with you. Good.'],
};

const STYLE_TAGS: Readonly<Record<VoiceStyle, string>> = {
  bouncy: '!',
  shy: '...',
  proud: '!',
  sleepy: '...',
  grumpy: '. Hmph.',
  curious: '?',
};

/** The creature's sound as it opens a line ("Moss moss!", "Blub..."). */
export function soundOf(v: BuddyVoice, seed: number): string {
  return cap(v.sounds[seed % 2]!) + STYLE_TAGS[v.style];
}

/** A templated reply: its sound and a line for its mood (seeded, so a turn reads the same each time). */
export function templateReply(p: BuddyProfile, turn: number): string {
  const h = seedOf(`${p.id}:${turn}`);
  const lines = MOOD_LINES[p.mood];
  return `${soundOf(p.voice, h)} ${lines[h % lines.length]!}`;
}

/**
 * A sound tacked on the end without a stop ("I am in Saltmourn hup.", the small model's habit on short lines) gets one:
 * "I am in Saltmourn. Hup!".
 */
export function punctuateSound(text: string, v: BuddyVoice): string {
  for (const snd of v.sounds) {
    const esc = snd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const m = new RegExp(`([A-Za-z0-9])\\s+(${esc})[.!?]*$`, 'i').exec(text);
    if (m !== null) return `${text.slice(0, m.index + 1)}. ${cap(snd)}!`;
  }
  return text;
}

/** The creature's sound at the start, unless the line already makes one of its sounds. */
export function voiced(text: string, v: BuddyVoice, seed: number): string {
  const low = text.toLowerCase();
  const call = v.sounds[0].split(' ')[0]!.toLowerCase();
  if (low.includes(call) || low.includes(v.sounds[1].toLowerCase())) return text;
  return `${soundOf(v, seed)} ${text}`;
}
