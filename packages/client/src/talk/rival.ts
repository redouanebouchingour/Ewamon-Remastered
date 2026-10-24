/**
 * A recurring rival (LLM feature 7): the rival's words. The server decides who the rival is, when it comes, the team it
 * brings, the record and the arc (`rival` message, `GET /rival`); this module turns those into facts in the rival's own
 * voice ("my Bramblecub", "your Pyrecap", "you have beaten me 2 times"), asks the model for the taunt it says when it
 * walks up and the parting line it says when the battle is over, and checks what comes back (`checkRivalLine`): no game
 * name or number the facts do not hold, no "your X" the player does not have, no "my X" the rival does not have, no
 * type claim the chart contradicts (feature 5's checks), and a parting line that has the result the right way round.
 * The templates (`TAUNTS`, `PARTINGS`, per arc stage) speak at once and whenever the model is down, slow or wrong. The
 * in-battle banter is feature 3's trainer bank, with the rival's arc and record as its memory (`rivalPersona`).
 *
 * Measured on gemma4-e2b (the docker model, 2026-10-24, CPU, reasoning off, temperature 0.7, 70 tokens), twelve scenes
 * (six taunts: a first meeting, cocky and ahead in the record, frustrated, respectful at six badges, cocky and level,
 * frustrated at 3 to 0; and a parting line after each, half of them won by the player), each run twice per round:
 * - First prompt (the facts as "Last time we met, on Ash Route, you beat me.", "Our record: you have beaten me 2
 *   times...", the job "a taunt about their team or our last meeting"): every taunt teased, but 3 of 6 said the player
 *   lost a battle they had won ("Remember how you lost on Deepcut", "You keep losing to my team" at 2 to 1 for the
 *   player), one told a first-time foe "You never win against my Ewamon", and the rival called the player's strongest
 *   creature its own ("My Infernomorel and my Moss") in 2 of 2 partings. "my my Ewamon" in 2 of 12 lines. The
 *   professor's `ungrounded` only caught the mix-ups; nothing caught the wrong past.
 * - Fixes, one at a time: the last battle said from both sides ("You won it and I lost it."), the record as "you won
 *   2 and I won 1"; `pastClaimsWrong` (the past the record allows) and `whoseMixups` (my / your, lists and nicknames:
 *   "You lost to my Sparky and Glimp" named the player's own pair); the feeling never phrased as "You lost again"
 *   (the model copied it into the line, to a player who had just won, 2 of 2); one angle per arc stage with a short
 *   example for the frustrated taunt and every parting line; no teams in the parting facts; "my my" collapsed.
 * - The round before last (24 calls): 22 kept, 0 fact errors or mix-ups among them; the cocky parting's example
 *   "Lucky. Next time I win." came back as "Lucky. Next time my win." (dropped: "my win" reads as a claim), and the
 *   live check on the alt pair hit it 4 of 4 times for its first-meeting loss, so the example became "That was luck. I
 *   will beat you next time."
 * - Shipped (the last round, 24 calls): 24 of 24 kept (12 taunts, 12 partings). Fact errors and whose-creature
 *   mix-ups in what was kept: 0 of 24 (checked by hand against each scene: "You lost the last battle" only where the
 *   rival won it, "My Ewamon won all three" at 3 to 0 for the rival). Tone per stage holds: cocky lines tease and gloat
 *   ("You know you lost the last battle. Your team is not very impressive.", "That was luck."), frustrated ones swear
 *   revenge ("You got me last time, but not today."; 4 of 4 copy the example nearly word for word, so the templates
 *   carry the variety) or crow at last ("Finally, I beat you."), respectful ones are warm ("You have grown strong. Let
 *   us have a good battle.", "You earned that win."). A first-meeting taunt is flat ("I am Corin. You have a Bramblecub
 *   and a Mossling."). Some kept lines read oddly but are not wrong ("You should be glad you finally lost.", "My Ewamon
 *   will beat your next time."). 0.85 to 5.8 s per call, median 1.3 s (llama.cpp's prompt cache keeps repeated scenes
 *   warm; a cold scene is 4 to 6 s).
 * - Timing in the game: the taunt is asked at `near`, while the player walks the last 18 to 40 m (5 to 15 s), and
 *   waited for at most 2.5 s after the rival arrives; the parting line is asked at `battleEnd` and has the result
 *   card's time plus 3 s. Either way a template speaks when the model is not back.
 */
import { RIVAL_TEMPERAMENT_TEXT, SPECIES, ZONES, rivalArc } from '@ewa/content';
import type { RivalArc } from '@ewa/content';
import type { CreatureInstance } from '@ewa/core';
import type { RivalResultView, RivalView } from '@ewa/protocol';
import { NO_DASHES, chatOnce, noDashes } from './llm';
import type { LlmMessage } from './llm';
import { ungrounded, wrongTypeClaims } from './professorFacts';

const speciesById = new Map(SPECIES.map((sp) => [sp.id, sp]));
const zoneNames = new Map<string, string>(ZONES.map((z) => [z.id, z.name]));
const speciesNameOf = (id: string): string => speciesById.get(id)?.name ?? id;
const typesOf = (id: string): readonly string[] => speciesById.get(id)?.types ?? [];
export const zoneNameOf = (id: string | null | undefined): string => (id == null ? 'the road' : (zoneNames.get(id) ?? id));

/** What the client knows when the rival speaks. */
export interface RivalScene {
  readonly rival: RivalView;
  /** the player's username */
  readonly player: string;
  readonly party: readonly Pick<CreatureInstance, 'speciesId' | 'nickname' | 'level' | 'hp'>[];
  readonly badges: number;
  readonly zoneId: string;
}

/** A battle that just ended, from the player's side. */
export type RivalOutcome = RivalResultView;

// ---- facts ---------------------------------------------------------------------------------------------------------

/** "Pyrecap (Fire, level 14)", or "Sparky (a Pyrecap, Fire, level 14)" for a nicknamed one. */
function creatureFact(c: { readonly speciesId: string; readonly nickname?: string | null; readonly level: number }): string {
  const sp = speciesNameOf(c.speciesId);
  const types = typesOf(c.speciesId).join(' and ');
  return c.nickname != null && c.nickname !== '' && c.nickname !== sp ? `${c.nickname} (a ${sp}, ${types}, level ${c.level})` : `${sp} (${types}, level ${c.level})`;
}

/** The player's strongest few, as the rival sees them. */
export function playerTeam(s: RivalScene, max = 3): RivalScene['party'] {
  return [...s.party].sort((a, b) => b.level - a.level).slice(0, max);
}

const times = (n: number): string => (n === 1 ? '1 time' : `${n} times`);

/** The last meeting in the rival's words (null before the first). */
function lastFact(r: RivalView): string {
  const l = r.last;
  if (l === null) return 'We have never battled before. This is our first battle.';
  const where = zoneNameOf(l.zoneId);
  if (l.result === 'won') return `Our last battle was on ${where}. You won it and I lost it.`;
  if (l.result === 'lost') return `Our last battle was on ${where}. I won it and you lost it.`;
  return `Our last battle was on ${where}. It was a draw.`;
}

/** The record after `outcome` (the battle that just ended), or as it stands. */
export function recordAfter(r: RivalView['record'], outcome: RivalOutcome | null): RivalView['record'] {
  if (outcome === null) return r;
  return {
    playerWins: r.playerWins + (outcome === 'won' ? 1 : 0),
    rivalWins: r.rivalWins + (outcome === 'lost' ? 1 : 0),
    draws: r.draws + (outcome === 'draw' ? 1 : 0),
    meetings: r.meetings + 1,
  };
}

/**
 * The facts the rival speaks from, in its own voice: "my" for its creatures, "your" for the player's (feature 5 and 6
 * found the small model mixes up whose creature is whose unless every one says so). `outcome`: the battle that just
 * ended (the parting line); null: before the battle (the taunt).
 */
export function rivalFacts(s: RivalScene, outcome: RivalOutcome | null): string[] {
  const r = s.rival;
  const rec = recordAfter(r.record, outcome);
  const facts = [
    `My name is ${r.name}. I am your rival, ${RIVAL_TEMPERAMENT_TEXT[r.temperament]}.`,
    `Your name is ${s.player}. You have ${s.badges === 1 ? '1 badge' : `${s.badges} badges`}.`,
    `We are on ${zoneNameOf(s.zoneId)}.`,
  ];
  // the teams only before the battle: in the parting line gemma4 claimed the player's strongest creature as its own
  // ("My Infernomorel and my Moss were stronger") in 4 of 4 runs, and the line does not need them
  const mine = playerTeam(s);
  if (outcome === null && mine.length > 0) facts.push(`Your team: ${mine.map((c) => `your ${creatureFact(c)}`).join(', ')}.`);
  if (outcome === null && r.team.length > 0) facts.push(`My team: ${r.team.map((c) => `my ${creatureFact(c)}`).join(', ')}.`);
  if (outcome === null) {
    facts.push(lastFact(r));
    if (r.record.meetings > 0) facts.push(`In all our battles, you won ${r.record.playerWins} and I won ${r.record.rivalWins}.`);
  } else {
    facts.push(outcome === 'won' ? 'We just battled. You won and I lost.' : outcome === 'lost' ? 'We just battled. I won and you lost.' : 'We just battled. It was a draw.');
    facts.push(`In all our battles, you won ${rec.playerWins} and I won ${rec.rivalWins}.`);
  }
  return facts;
}

/**
 * How the rival feels, by its arc going in, the last battle (before a battle) and how this one went (after it). The
 * last result is said here too: with the record in the facts alone, gemma4 still taunted "you lost" after a loss of
 * the rival's in about half the taunts.
 */
export function arcInstruction(arc: RivalArc, outcome: RivalOutcome | null, last: RivalView['last'] = null): string {
  if (outcome === null) {
    if (last === null) return 'You have never battled them, and you are sure you will win.';
    if (arc === 'frustrated') return 'You are frustrated: they keep beating you, and you want revenge.';
    if (arc === 'respectful') return 'You respect them now, but you still want to win.';
    if (last.result === 'won') return 'They beat you last time, but you are cocky and think it was luck.';
    return 'You are cocky and sure you will win.';
  }
  // never "You lost ..." here: gemma4 copies the instruction into the line, where "you" is the player ("You lost again"
  // to a player who had just won, 2 of 2 runs)
  if (outcome === 'draw') return 'The battle was even, and you want to settle it next time.';
  if (outcome === 'lost') return arc === 'respectful' ? 'You beat them and you are glad, but you respect them.' : 'You beat them, and you gloat a little.';
  if (arc === 'cocky') return 'They beat you. It stings, and you will not admit they are better.';
  if (arc === 'frustrated') return 'They beat you again. You are angry about it, but you will be back.';
  return 'They beat you, and you admit they earned it.';
}

// ---- the calls -----------------------------------------------------------------------------------------------------

export const RIVAL_SYSTEM = `You write what a character in a monster-catching game says. ${NO_DASHES}`;
/** a line not back by then is not waited for: the template speaks */
export const LINE_TIMEOUT_MS = 15_000;
const MAX_TOKENS = 70;
/** the longest line shown */
export const MAX_LINE = 200;

/**
 * What the taunt is about, by the arc and the last battle. Left to "their team or our last battle", gemma4 said the
 * player lost in about half the taunts whoever had won; one angle per stage, said from the right side, holds it.
 */
export function tauntAngle(s: RivalScene): string {
  // no creature named in the angle: "tease them about your Bramblecub" (the player's) came back as "my Bramblecub" in
  // 2 of 2 first taunts, since "your" in the prompt is the rival's and in the line the player's
  const r = s.rival;
  if (r.last === null) return 'introduce yourself by name, and tease them about their team.';
  const arc = rivalArc(s.badges, r.record);
  if (arc === 'frustrated') return 'admit they beat you last time, then swear you will win today, like "You got me last time, but not today."';
  if (arc === 'respectful') return 'say they have grown strong, and that you want a good battle.';
  if (r.last.result === 'lost') return 'remind them that you won our last battle, and tease them about their team.';
  if (r.last.result === 'won') return 'say that their win last time was luck.';
  return 'say that this time you will settle it, and tease them about their team.';
}

/**
 * What the parting line says, by the arc going in and the result, with a short example: without one gemma4 told a
 * player who had just won "You lost again" in 2 of 2 runs (the rival's "you" and the player's "you" run together).
 */
export function partingAngle(arc: RivalArc, outcome: RivalOutcome): string {
  if (outcome === 'draw') return 'say it was even and that you will settle it next time, like "Even. Next time I settle it."';
  if (outcome === 'won') {
    if (arc === 'cocky') return 'say their win was luck, like "That was luck. I will beat you next time."';
    if (arc === 'frustrated') return 'admit they won again and swear you will be back, like "You win again. I will be back."';
    return 'admit they earned the win, like "You earned that win."';
  }
  if (arc === 'cocky') return 'gloat that you won, like "Told you I would win."';
  if (arc === 'frustrated') return 'be glad you finally beat them, like "Finally, I beat you!"';
  return 'say it was a good battle and that they will be ready next time, like "Good battle. You will get me next time."';
}

/**
 * One line's messages: a neutral system prompt (a persona there made gemma4 think out loud, feature 3), the facts, who
 * the rival is and how it feels, and the job in the user turn.
 */
export function rivalMessages(s: RivalScene, outcome: RivalOutcome | null): LlmMessage[] {
  const r = s.rival;
  // the arc going in: a first meeting lost is "lucky", not "again?!"
  const arc = rivalArc(s.badges, r.record);
  const job = outcome === null ? `You just walked up to ${s.player} on the road to battle them. Say a short taunt before the battle: ${tauntAngle(s)}` : `Our battle is over. Say a short parting line to ${s.player} before you walk off: ${partingAngle(arc, outcome)}`;
  return [
    { role: 'system', content: RIVAL_SYSTEM },
    {
      role: 'user',
      content:
        `Facts, all true:\n${rivalFacts(s, outcome).map((f) => `- ${f}`).join('\n')}\n\n` +
        `You are ${r.name}, their rival. ${arcInstruction(arc, outcome, r.last)} ${job} ` +
        'One or two short sentences, said to them as "you". Say "my" for your own Ewamon and "your" for theirs. ' +
        `Use only the facts above, with no other names or numbers. ${NO_DASHES}`,
    },
  ];
}

// ---- the checks ----------------------------------------------------------------------------------------------------

const SPECIES_NAMES: ReadonlySet<string> = new Set(SPECIES.map((sp) => sp.name));
const OFF_CHARACTER = /\b(?:as an ai|language model|assistant|chatbot|I cannot help)\b/i;
/** a parting line with the result backwards (the rival lost but says it won, or the other way round) */
const WRONG_WAY: Readonly<Record<'rivalWon' | 'rivalLost', RegExp>> = {
  // "Next time I win" is a promise, not a claim: only the past and "I win" right after the battle count
  rivalLost: /\bI (?:have )?(?:won(?!')|beat you)\b|(?<!time )\bI win\b|\byou (?:have )?(?:lost|lose)\b|\byour (?:defeat|loss)\b|\bmy (?:\w+ )?(?:has |have )?won(?!')\b|\bwe won(?!')\b|\bmy (?:victory|win)\b/i,
  rivalWon: /\byou (?:have )?(?:won(?!')|beat me|beaten me)\b|(?<!time )\byou win\b|\bI (?:have )?(?:lost|lose)\b|\bmy (?:defeat|loss)\b|\byour (?:victory|win)\b/i,
};

/**
 * Whose creature is whose: "my X" for a species the rival does not bring, "your X" for one the player does not have.
 * Empty = right.
 */
export function whoseMixups(text: string, mine: readonly string[], theirs: readonly string[]): string[] {
  const out: string[] = [];
  const own = new Set(mine.map((n) => n.toLowerCase()));
  const rivals = new Set(theirs.map((n) => n.toLowerCase()));
  // "my Sparky and Glimp": every name of the list belongs to the side its "my" / "your" says (a species, or one of the
  // player's nicknames: gemma4 called the player's "Sparky" its own in 1 of 12 partings)
  for (const m of text.matchAll(/\b([Mm]y|[Yy]our) ([A-Z][A-Za-z]+(?:(?:,? and |, | or )[A-Z][A-Za-z]+)*)/g)) {
    const isMy = m[1]!.toLowerCase() === 'my';
    for (const n of m[2]!.split(/,? and |, | or /)) {
      const k = n.toLowerCase();
      const known = SPECIES_NAMES.has(n) || own.has(k) || rivals.has(k);
      if (!known) continue;
      if (isMy && !rivals.has(k)) out.push(`${m[1]} ${n}`);
      if (!isMy && !own.has(k)) out.push(`${m[1]} ${n}`);
    }
  }
  return out;
}

/** The names on each side: the player's creatures (nicknames and species) and the rival's species. */
export function sidesOf(s: RivalScene): { readonly mine: string[]; readonly theirs: string[] } {
  return {
    mine: s.party.flatMap((c) => [speciesNameOf(c.speciesId), ...(c.nickname != null && c.nickname !== '' ? [c.nickname] : [])]),
    theirs: s.rival.team.map((c) => speciesNameOf(c.speciesId)),
  };
}

/**
 * A model line made fit to show: `noDashes`, quotes and a "Name:" label off, at most two sentences and `MAX_LINE`
 * characters, a dangling half sentence cut. Empty when nothing is left.
 */
export function tidyRivalLine(raw: string, name: string): string {
  let t = noDashes(raw.replace(/\s+/g, ' ').trim());
  t = t.replace(new RegExp(`^(?:${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|Rival)\\s*:\\s*`, 'i'), '');
  t = t.replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim();
  // "my my Ewamon" (gemma4, 2 of 12 lines)
  t = t.replace(/\b(my|your) \1\b/gi, '$1');
  const sentences = t.match(/[^.!?]+[.!?]+/g) ?? [];
  if (sentences.length === 0) return '';
  let out = '';
  for (const s of sentences.slice(0, 2)) {
    if ((out + s).trim().length > MAX_LINE) break;
    out += s;
  }
  return out.trim();
}

const PAST = {
  /** the player lost a battle before */
  playerLostOnce: /\byou (?:lost|were beaten)\b|\bI (?:beat|defeated|crushed) you\b|\bhow you lost\b|\byour (?:defeat|loss)\b|\byour last battle\b[^.!?]*\b(?:loss|defeat|joke)\b/i,
  /** the player keeps losing */
  playerLosesAlways: /\byou (?:keep losing|always lose|never win|never beat me|can(?:not|'t) beat me|could(?: not|n't) beat me)\b/i,
  /** the rival lost a battle before ("you won't" is not "you won") */
  rivalLostOnce: /\byou (?:beat|defeated|won(?!'))\b|\bI lost\b|\bmy (?:defeat|loss)\b/i,
  /** the rival keeps losing */
  rivalLosesAlways: /\byou (?:keep (?:beating|winning)|always (?:beat|win))\b|\bI (?:keep losing|never win|always lose)\b/i,
  /** any battle before this one */
  before: /\b(?:last time|again|before|keep|always|never|lost|beat me|beat you|won(?!'))\b/i,
};

/**
 * What a taunt says about the battles before that the record contradicts: "you lost" unless the rival won the last
 * one (gemma4 wrote "Remember how you lost" after the player had won, in 3 of 6 taunts), a losing streak the record
 * does not show, any past battle on the first meeting. Empty = right.
 */
export function pastClaimsWrong(text: string, r: RivalView): string[] {
  const out: string[] = [];
  const rec = r.record;
  const hit = (re: RegExp, wrong: boolean): void => {
    const m = text.match(re);
    if (m !== null && wrong) out.push(m[0]);
  };
  if (rec.meetings === 0 || r.last === null) {
    hit(PAST.before, true);
    return out;
  }
  hit(PAST.playerLostOnce, r.last.result !== 'lost');
  hit(PAST.playerLosesAlways, rec.rivalWins <= rec.playerWins);
  hit(PAST.rivalLostOnce, r.last.result !== 'won');
  hit(PAST.rivalLosesAlways, rec.playerWins <= rec.rivalWins);
  return out;
}

/** The model's line if it holds up against the facts, else null (the template speaks). */
export function checkRivalLine(raw: string, s: RivalScene, outcome: RivalOutcome | null): string | null {
  const text = tidyRivalLine(raw, s.rival.name);
  if (text.length < 8 || OFF_CHARACTER.test(text)) return null;
  const facts = rivalFacts(s, outcome);
  const { mine, theirs } = sidesOf(s);
  if (ungrounded(text, facts, '', mine).length > 0) return null;
  if (wrongTypeClaims(text).length > 0) return null;
  if (whoseMixups(text, mine, theirs).length > 0) return null;
  if (outcome === null && pastClaimsWrong(text, s.rival).length > 0) return null;
  if (outcome === 'won' && WRONG_WAY.rivalLost.test(text)) return null;
  if (outcome === 'lost' && WRONG_WAY.rivalWon.test(text)) return null;
  return text;
}

export interface RivalLineOptions {
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
  /** tests inject the model */
  readonly chat?: typeof chatOnce;
}

/** One line from the model, checked; null when the model is down, slow or wrong. */
export async function fetchRivalLine(s: RivalScene, outcome: RivalOutcome | null, o: RivalLineOptions = {}): Promise<string | null> {
  const chat = o.chat ?? chatOnce;
  try {
    const r = await chat({ messages: rivalMessages(s, outcome), maxTokens: MAX_TOKENS, temperature: 0.7, timeoutMs: o.timeoutMs ?? LINE_TIMEOUT_MS, ...(o.signal ? { signal: o.signal } : {}) });
    return checkRivalLine(r.content, s, outcome);
  } catch (_e) {
    return null;
  }
}

// ---- templates -----------------------------------------------------------------------------------------------------

/**
 * The taunts by arc. `{player}` the player, `{lead}` the player's strongest creature, `{sig}` the rival's signature
 * creature, `{zone}` where they are, `{wins}` / `{losses}` the record from the player's side.
 */
export const TAUNTS: Readonly<Record<RivalArc | 'first', readonly string[]>> = {
  first: [
    'So you are {player}. I heard you won a badge. Let us see if you deserve it.',
    'Hey, {player}! I am {name}, and my {sig} and I have been looking for someone worth beating.',
    'You must be {player}. One badge and everyone talks about you. My {sig} is not impressed.',
  ],
  cocky: [
    'Found you, {player}. Your {lead} again? My {sig} will make this quick.',
    'Still walking around with your {lead}, {player}? This will be easy.',
    'Back on {zone}, {player}? My {sig} has been waiting for a warm up.',
  ],
  frustrated: [
    '{player}! You have beaten me {wins}. Not today.',
    'Your {lead} again. This time my {sig} is ready for it, {player}.',
    'I have been training since our last battle, {player}. No more luck for you.',
  ],
  respectful: [
    '{player}. You have come a long way. Let us see how far.',
    'No tricks today, {player}. My {sig} against your best.',
    'I knew I would find you on {zone}, {player}. Give me everything.',
  ],
};

/** The parting lines by arc and by how the battle went (the player's side: `won` = the rival lost). */
export const PARTINGS: Readonly<Record<RivalArc, Readonly<Record<RivalOutcome, readonly string[]>>>> = {
  cocky: {
    won: ['Lucky. Next time my {sig} wins.', 'Fine. Enjoy it while it lasts, {player}.'],
    lost: ['Told you. Train harder, {player}.', 'Easy. Come find me when your {lead} grows up.'],
    draw: ['A draw? That will not happen twice, {player}.'],
  },
  frustrated: {
    won: ['Again?! This is not over, {player}.', 'How do you keep doing that? I will be back.'],
    lost: ['Finally! Remember this one, {player}.', 'See? I told you I would get you back.'],
    draw: ['Even. I will settle this next time, {player}.'],
  },
  respectful: {
    won: ['You earned that, {player}. See you up the road.', 'A good fight. Go win the rest of them.'],
    lost: ['A good fight, {player}. Do not let it stop you.', 'That was close. You will be ready next time.'],
    draw: ['Even, {player}. That is the best fight I have had.'],
  },
};

export interface TemplateFill {
  readonly player: string;
  readonly name: string;
  readonly lead: string;
  readonly sig: string;
  readonly zone: string;
  readonly wins: string;
}

export function fillRival(t: string, v: TemplateFill): string {
  return t
    .replace(/\{player\}/g, v.player)
    .replace(/\{name\}/g, v.name)
    .replace(/\{lead\}/g, v.lead)
    .replace(/\{sig\}/g, v.sig)
    .replace(/\{zone\}/g, v.zone)
    .replace(/\{wins\}/g, v.wins);
}

function fillOf(s: RivalScene, outcome: RivalOutcome | null): TemplateFill {
  const lead = playerTeam(s, 1)[0];
  const rec = recordAfter(s.rival.record, outcome);
  return {
    player: s.player,
    name: s.rival.name,
    lead: lead === undefined ? 'team' : lead.nickname != null && lead.nickname !== '' ? lead.nickname : speciesNameOf(lead.speciesId),
    sig: s.rival.team[0] !== undefined ? speciesNameOf(s.rival.team[0].speciesId) : 'team',
    zone: zoneNameOf(s.zoneId),
    wins: times(rec.playerWins),
  };
}

/** The template taunt (seeded by the meeting count, so it changes from meeting to meeting). */
export function templateTaunt(s: RivalScene): string {
  const r = s.rival;
  const pool = r.record.meetings === 0 ? TAUNTS.first : TAUNTS[rivalArc(s.badges, r.record)];
  return fillRival(pool[r.record.meetings % pool.length]!, fillOf(s, null));
}

/** The template parting line for how the battle went. */
export function templateParting(s: RivalScene, outcome: RivalOutcome): string {
  const r = s.rival;
  const pool = PARTINGS[rivalArc(s.badges, r.record)][outcome];
  return fillRival(pool[r.record.meetings % pool.length]!, fillOf(s, outcome));
}

/** The rival's start-of-battle lines when the trainer bank has none (commentator `sayTrainer`). */
export const RIVAL_START: Readonly<Record<RivalArc, readonly string[]>> = {
  cocky: ['This will not take long.', 'Watch closely. This is how it is done.'],
  frustrated: ['Not this time. I mean it.', 'I have been waiting for this rematch.'],
  respectful: ['Give me your best. I will give you mine.', 'Let us make this one count.'],
};

/**
 * The rival as the trainer bank's persona (feature 3): who it is, and its arc and record as the memory the bank
 * folds in.
 */
export function rivalPersona(r: RivalView, badges: number): { readonly who: string; readonly memory: string } {
  const arc = rivalArc(badges, r.record);
  const rec = r.record.meetings === 0 ? 'You have never battled the traveller before.' : `The traveller has beaten you ${times(r.record.playerWins)}, you have beaten them ${times(r.record.rivalWins)}.`;
  return { who: `${r.name}, the traveller's rival, ${RIVAL_TEMPERAMENT_TEXT[r.temperament]}`, memory: `${arcInstruction(arc, null)} ${rec}` };
}
