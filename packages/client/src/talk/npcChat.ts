/**
 * NPC talk: one local model (`gemma4-e2b` behind llama.cpp's OpenAI-compatible API) in two passes. The player
 * types English in the DialogueBox.
 *
 * - Talk: the model streams the NPC's words (fast; the dialogue is rough, and that is accepted), in character,
 *   with reasoning off and no tools, so they appear as fast as they come. The system prompt is only instructions (who
 *   the NPC is, spoken words only, answer anything: see `systemPrompt`); the conversation is the message log
 *   (`chatMessages`). What the NPC does, it says out loud.
 * - Tools: once the words are complete, the same model reads the exchange and must call at least one tool:
 *   what the NPC does to the player (`slap_user`, `kick_user`, `give_money` / `take_money` with an amount, `give_ewamon`,
 *   `take_ewamon`, `start_battle`) or `do_nothing`. Forcing the choice (`tool_choice: required`) lets it run without reasoning
 *   (~0.3 s): left free and without reasoning it never called a tool; with reasoning it was right but took 5–7 s.
 *   It still drifts into reasoning now and then on harmless chat, so the pass is capped at a few tokens: no call =
 *   nothing happens. The 0.8b model often gets the direction wrong (gives when the NPC takes) and acts on threats, so
 *   `guardCalls` checks each call against the NPC's words: it drops a call the words do not mention (or only threaten)
 *   and turns give / take round when the wording clearly says the other way. Measured on 20 unseen exchanges: 9/20
 *   right bare, 14/20 guarded (gemma-4-e4b-it-qat: 18/20 at twice the time); most guarded misses drop an action.
 *   gemma4-e2b (one model for both passes since 2026-10-23) called the tools right on 8/8 labelled exchanges at
 *   ~0.4–0.6 s; the guard stays.
 *
 * What the tools did is remembered on the turn (`ChatTurn.events`) and told to the talk pass in brackets on the next
 * user turn.
 * `VITE_NPC_LLM_MODEL` / `VITE_NPC_LLM_REASONING` and `VITE_NPC_TOOL_MODEL` / `VITE_NPC_TOOL_REASONING` override the
 * two passes (reasoning: an Llama.cpp `reasoning_effort`, or `default` to leave it to the model). `stripThink` drops
 * a `<think>` block that leaks into the content.
 */

export interface NpcPersona {
  readonly name: string;
  /** what the dialogue's speaker line says after the name ("Town Archivist"), if anything */
  readonly role?: string | null;
  /** "Mirevale (town, marsh)" */
  readonly place: string | null;
  /** what the NPC said before the player spoke (the content lines, in English) */
  readonly lines: readonly string[];
}

export interface ChatTurn {
  readonly role: 'user' | 'assistant';
  readonly content: string;
  /** an assistant turn: what the NPC's tools did, in English for the talk pass, addressed to the NPC ("You slapped the traveller.") */
  readonly events?: readonly string[];
  /** a user turn that is an action (H / K), not words: what the dialogue shows instead of `content` */
  readonly shown?: string;
}

/** rude words in the player's line: the talk pass is told it is furious (the rule in the prompt alone was too weak) */
const INSULT = /\b(idiot|stupid|fool|ugly|dumb|moron|loser|pathetic|useless|worthless|coward|liar|freak|jerk|imbecile|cretin|shut up|hate you|stink|smell|fuck|shit|bitch|bastard|asshole|dick|crap)/i;

/** a slap, a kick or an insult from the player: the NPC is furious and the tool pass hits back */
export function provoked(t: ChatTurn | undefined): boolean {
  return t?.role === 'user' && (t.shown !== undefined || INSULT.test(t.content));
}

/** what the talk pass reads after a slap, a kick or an insult */
const FURIOUS = 'You are furious: swear at them and insult them back. Use foul words';

/** money in the player's line, and a demand for it: a robbery */
const ROB_MONEY = /\b(coin|money|gold|purse|wallet|pocket|cash|valuables)/i;
const ROB_DEMAND = /\b(give me|hand (it |them )?over|hand me|empty|rob|stick ?up|or else|or i('ll| will)|pay (me|up)|now\b)/i;

/**
 * A robbery: the player demands the NPC's money. Without a nudge gemma4-e2b refused or changed the subject almost
 * every time (1 of 12 live robberies paid), however it was threatened; told it is scared, it gives in and names the
 * amount, which the tool pass carries out (18 of 24 paid; the rest still talk their way out).
 */
export function robbed(t: ChatTurn | undefined): boolean {
  return t?.role === 'user' && t.shown === undefined && ROB_MONEY.test(t.content) && ROB_DEMAND.test(t.content);
}

/** what the talk pass reads after a robbery (wins over FURIOUS: "give me your gold, idiot" is still a robbery) */
const SCARED = 'You are scared and you give in: say how many coins you hand over.';

/** a challenge in the player's line ("battle me", "let's fight", "I challenge you"), not turned down by the player */
const CHALLENGE = /\b(battle|duel|fight|challenge|1v1)/i;
const NO_CHALLENGE = /\b(don'?t|do not|never|no|won'?t|not)\b[^.?!]*\b(battle|duel|fight|challenge)/i;

/**
 * The player challenges the NPC to an Ewamon battle: the talk pass is told to take it up (`ACCEPT`) and the battle
 * starts whatever the tool pass picked (`guardCalls`), so a challenge is never talked away.
 */
export function challenged(t: ChatTurn | undefined): boolean {
  return t?.role === 'user' && t.shown === undefined && CHALLENGE.test(t.content) && !NO_CHALLENGE.test(t.content);
}

/** what the talk pass reads after a challenge (wins over FURIOUS: "fight me, idiot" is still a challenge) */
const ACCEPT = 'You accept the challenge: say you will battle them with your Ewamon, right now.';

/** The player's hit as a user turn: the models read the narration, the dialogue shows `shown`. */
export function playerHitTurn(kind: 'slap' | 'kick', npcName: string): ChatTurn {
  return kind === 'slap'
    ? { role: 'user', content: `[The traveller slaps you hard in the face, out of nowhere. ${FURIOUS}]`, shown: `You slap ${npcName}.` }
    : { role: 'user', content: `[The traveller kicks you hard, out of nowhere. ${FURIOUS}]`, shown: `You kick ${npcName}.` };
}

/** A tool the tool pass called: its name and, for money, the amount (1..NPC_MONEY_MAX). */
export interface ToolCall {
  readonly name: string;
  readonly amount?: number;
}

interface ChatMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

/** messages of the log sent to the talk pass: the whole conversation in practice (lines are a sentence or two) */
export const HISTORY_TURNS = 32;

const env = (k: string): string | undefined => import.meta.env[k] as string | undefined;
export const LLM_BASE = env('VITE_NPC_LLM_URL') ?? '/npc/llm/v1';
/** the tool pass's server and model: the talk pass's unless overridden (one model does both) */
export const TOOL_BASE = env('VITE_NPC_TOOL_URL') ?? LLM_BASE;
export const TALK_MODEL = env('VITE_NPC_LLM_MODEL') ?? 'gemma4-e2b';
// `none` is required for gemma4: without `enable_thinking: false` it writes its reasoning into the content
const TALK_REASONING = env('VITE_NPC_LLM_REASONING') ?? 'none';
export const TOOL_MODEL = env('VITE_NPC_TOOL_MODEL') ?? TALK_MODEL;
const TOOL_REASONING = env('VITE_NPC_TOOL_REASONING') ?? 'none';

/** the tool pass's token cap without reasoning (see `judgeExchange`): a few calls with an amount */
const JUDGE_TOKENS = 120;

export const SLAP = 'slap_user';
export const KICK = 'kick_user';
export const GIVE_MONEY = 'give_money';
export const TAKE_MONEY = 'take_money';
export const GIVE_EWAMON = 'give_ewamon';
export const TAKE_EWAMON = 'take_ewamon';
export const START_BATTLE = 'start_battle';
export const DO_NOTHING = 'do_nothing';

/** Llama.cpp's switch: `none` = no thinking; `default` = leave it to the model. */
function reasoning(effort: string): Record<string, unknown> {
  if (effort === 'default') return {};
  return { reasoning_effort: effort, chat_template_kwargs: { enable_thinking: effort !== 'none' } };
}

/** What the NPC's tools did in this conversation so far, oldest first. */
export function eventsSoFar(history: readonly ChatTurn[]): string[] {
  return history.flatMap((t) => t.events ?? []);
}

/**
 * Only instructions: who the NPC is and how to answer. The conversation itself (the scripted lines, what was said, what
 * the tools did) goes in the message log (`chatMessages`). Kept short for gemma3-1b: a long list of rules (stand up
 * for yourself, stay in the world, only know Ewamon) made villagers curt and unwilling to chat. Addressed as "you"
 * (described as "Bram is…" the model narrated). The one hard rule is spoken words only: without it gemma3-1b wrote
 * `*my voice higher than usual*` and other stage directions. Brackets are not named: explaining the bracketed events
 * made it answer with `[asides]` of its own. What still slips through (mostly a sung song's `(breathy voice)`) is
 * dropped by `stripThink` / `tidyReply`.
 */
export function systemPrompt(p: NpcPersona): string {
  const who = p.role !== undefined && p.role !== null ? `${p.name}, the ${p.role.toLowerCase()}` : p.name;
  const where = p.place !== null ? ` in ${p.place}` : '';
  return (
    `You are ${who}${where}, a villager in Ewamon, a game like Pokémon. ` +
    `You are ${temperamentOf(p.name)}. ` +
    'You can slap or kick the traveller, give them money or take theirs, give them an Ewamon or take one of theirs, and battle them with your Ewamon: to do it, just say it. ' +
    'If the traveller slaps, kicks, threatens, or insults you, you are furious: yell, curse and swear at them with foul words, insult them back and threaten them. ' +
    'Otherwise chat and answer any question, whatever the subject, with only the words you say out loud.'
  );
}

/**
 * Who the NPC is, picked from its name so it is the same on every visit: one temperament each, all of them friendly to
 * a friendly traveller (a single "hot-headed, takes no nonsense" for everyone made every villager curt and rude).
 */
export const TEMPERAMENTS = [
  'warm and chatty, you love a bit of gossip and want to hear all about the traveller\'s journey',
  'gruff on the outside but soft-hearted: you grumble a little, then help anyway',
  'cheerful and easily excited, and everything about Ewamon delights you',
  'dry-witted, you tease the traveller kindly and love a good joke',
  'dreamy and curious, full of odd little stories about this place',
  'proud of your work and your town, and happy to boast about both',
  'a little nervous and fussy, but eager to help',
  'old and wise, you give advice with a twinkle in your eye',
] as const;

export function temperamentOf(name: string): string {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619);
  return TEMPERAMENTS[(h >>> 0) % TEMPERAMENTS.length]!;
}

/** the user turn before the NPC's scripted lines, so the log opens with the traveller (gemma's template requires it) */
export const GREETING = 'Hello.';

/**
 * The talk pass's messages: the system prompt, then the conversation as a regular user / assistant log. The scripted
 * lines open it as the NPC's first reply; what the tools did after a reply is told in square brackets at the start of
 * the next user turn, and a line with an insult in it gets `[You are furious: swear at them…]` (as a slap or a kick does: the
 * rule in the system prompt is too far back for a 1B model to act on), a robbery `[You are scared: …]` (`robbed`), a
 * challenge `[You accept the challenge: …]` (`challenged`). gemma3's template only takes strict user / assistant turns starting with the user, so turns of
 * the same role are merged and a cut that would start on the NPC drops that turn.
 */
export function chatMessages(p: NpcPersona, history: readonly ChatTurn[]): ChatMessage[] {
  const opening: ChatTurn[] = p.lines.length > 0 ? [{ role: 'user', content: GREETING }, { role: 'assistant', content: p.lines.join(' ') }] : [];
  const log: ChatMessage[] = [];
  let pending: readonly string[] = [];
  for (const t of [...opening, ...history]) {
    const said = robbed(t) ? `${t.content} [${SCARED}]` : challenged(t) ? `${t.content} [${ACCEPT}]` : provoked(t) && t.shown === undefined ? `${t.content} [${FURIOUS}]` : t.content;
    const content = t.role === 'user' && pending.length > 0 ? `[${pending.join(' ')}] ${said}` : said;
    if (t.role === 'user') pending = [];
    if (t.role === 'assistant') pending = t.events ?? [];
    const last = log.at(-1);
    if (last?.role === t.role) log[log.length - 1] = { role: t.role, content: `${last.content} ${content}` };
    else log.push({ role: t.role, content });
  }
  const recent = log.slice(-HISTORY_TURNS);
  if (recent[0]?.role === 'assistant') recent.shift();
  return [{ role: 'system', content: systemPrompt(p) }, ...recent];
}

/** The tools the tool pass must choose from (OpenAI function format). */
export function judgeTools(p: NpcPersona, maxMoney: number): unknown[] {
  const none = { type: 'object', properties: {}, required: [] };
  const money = { type: 'object', properties: { amount: { type: 'integer', minimum: 1, maximum: maxMoney, description: `the amount ${p.name} names, otherwise ${maxMoney}` } }, required: ['amount'] };
  const fn = (name: string, description: string, parameters: object = none) => ({ type: 'function', function: { name, description, parameters } });
  return [
    fn(SLAP, `${p.name} slaps the traveller (hits, smacks).`),
    fn(KICK, `${p.name} kicks the traveller.`),
    fn(GIVE_MONEY, `${p.name} now gives the traveller money (at most ${maxMoney} coins).`, money),
    fn(TAKE_MONEY, `${p.name} now takes money from the traveller (at most ${maxMoney} coins).`, money),
    fn(GIVE_EWAMON, `${p.name} now gives the traveller an Ewamon (a creature).`),
    fn(TAKE_EWAMON, `${p.name} now takes an Ewamon from the traveller.`),
    fn(START_BATTLE, `${p.name} starts an Ewamon battle with the traveller now (takes up their challenge, or challenges them).`),
    fn(DO_NOTHING, `Nothing happens in the game: ${p.name} only talks, refuses, only threatens or only promises something.`),
  ];
}

/** The tool pass's messages: the rule, then the last exchange as one transcript. */
export function judgeMessages(p: NpcPersona, history: readonly ChatTurn[]): ChatMessage[] {
  const transcript = history
    .slice(-2)
    .map((t) => `${t.role === 'user' ? 'Traveller' : p.name}: ${t.content}`)
    .join('\n');
  return [
    {
      role: 'system',
      content:
        `You are the game master of a role-play. You read the last part of a conversation between the traveller and ` +
        `${p.name} (a character) and carry out what ${p.name} actually does in the last reply: call the matching tool ` +
        `for each action (several is fine, for example a slap and taking money). Giving or taking also counts when ` +
        `${p.name} gives in angrily or fearfully, like "take it then" or "here you go". If the traveller slapped, kicked ` +
        `or insulted ${p.name}, ${p.name} hits back: call ${SLAP} or ${KICK}. If they agree to an Ewamon battle, call ` +
        `${START_BATTLE}. If ${p.name} only threatens, ` +
        `refuses, only promises something or just talks, call ${DO_NOTHING}.`,
    },
    { role: 'user', content: transcript },
  ];
}

/**
 * Drops `<think>…</think>` (and an unclosed `<think>` tail while streaming), everything up to a `</think>` whose
 * opening tag was in the prompt (a thinking template; qwen under llama.cpp's `--reasoning-budget 0` also closes a
 * block it never opened and then says its reply again), `*actions*`, emoji and the rest of the markdown emphasis. A
 * single-asterisk span of three words or more without a quote is an action (gemma3-1b writes `*my voice higher than
 * usual*`) and goes, also unclosed while streaming; a shorter one (`a *beautiful* city`) or quoted speech in italics
 * (a song) only loses its asterisks.
 */
export function stripThink(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/^[\s\S]*<\/think>/, '')
    .replace(/<think>[\s\S]*$/, '')
    .replace(/(?<!\*)\*(?!\*)([^*]*)(\*(?!\*)|$)/g, (span, inner: string) => (inner.trim().split(/\s+/).length >= 3 && !/[“”"]/.test(inner) ? ' ' : span))
    .replace(/\p{Extended_Pictographic}\uFE0F?/gu, '')
    .replace(/[*_#`]+/g, '')
    .trimStart();
}

/** the talk pass's reply is cut after this many sentences (the stream is stopped there) */
export const MAX_SENTENCES = 6;

/** A sentence ends at . ! ? before a capital (or quote) or the end: "a bit… restless" and "a bit... restless" go on. */
function sentences(text: string): { readonly done: string[]; readonly rest: string } {
  const done: string[] = [];
  const re = /[.!?]+['"’”]?(?=\s+['"‘“]?[A-Z]|\s*$)/g;
  let from = 0;
  for (let m = re.exec(text); m !== null; m = re.exec(text)) {
    const end = m.index + m[0].length;
    if (end === text.length && !/[.!?]['"’”]?$/.test(text)) break;
    done.push(text.slice(from, end).trim());
    from = end;
  }
  return { done: done.filter((x) => x.length > 0), rest: text.slice(from).trim() };
}

const plain = (t: string): string => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * The talk pass's words, tidied the same way while streaming and at the end: stage directions in round or square
 * brackets (not a bracket right after a word, so `print(x)` and `a[0]` in a code answer stay) and quote marks go, a sentence that only repeats
 * the NPC's scripted lines or the player's last line goes (gemma3-1b echoes both), and the reply stops after `MAX_SENTENCES` (`full`: the stream can stop). `final` = the stream has ended, so
 * the last piece counts as a sentence. Prompt wording did not stop any of these on a 1B model.
 */
export function tidyReply(text: string, p: NpcPersona, said: string, final: boolean): { readonly text: string; readonly full: boolean } {
  const clean = text
    .replace(/(^|[^\w])\([^)]*\)?/g, '$1 ')
    .replace(/(^|[^\w])\[[^\]]*\]?/g, '$1 ')
    .replace(/[“”"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const scripted = plain(p.lines.join(' '));
  const echoed = plain(said);
  const keep = (x: string): boolean => {
    const t = plain(x);
    return t.length > 0 && !(t.split(' ').length >= 3 && (scripted.includes(t) || t === echoed));
  };
  const { done, rest } = sentences(clean);
  const whole = final && rest !== '' ? [...done, rest] : done;
  const kept = whole.filter(keep).slice(0, MAX_SENTENCES);
  const full = kept.length >= MAX_SENTENCES;
  const out = [...kept, ...(!final && !full && rest !== '' ? [rest] : [])].join(' ');
  return { text: out === '' && final ? clean : out, full };
}

/** The `delta.content` pieces of the complete SSE lines in `buffer`, and the unfinished remainder. */
export function parseSse(buffer: string): { readonly pieces: string[]; readonly rest: string; readonly done: boolean } {
  const lines = buffer.split('\n');
  const rest = lines.pop() ?? '';
  const pieces: string[] = [];
  let done = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line.startsWith('data:')) continue;
    const data = line.slice(5).trim();
    if (data === '[DONE]') {
      done = true;
      continue;
    }
    try {
      const json = JSON.parse(data) as { choices?: { delta?: { content?: string | null } }[] };
      const c = json.choices?.[0]?.delta?.content;
      if (typeof c === 'string' && c.length > 0) pieces.push(c);
    } catch (_e) {
      // a keep-alive or a partial line: skip
    }
  }
  return { pieces, rest, done };
}

/** The talk pass streams the NPC's reply; `onText` gets the cleaned reply so far. Resolves with the final text. */
export async function streamNpcReply(persona: NpcPersona, history: readonly ChatTurn[], onText: (text: string) => void, signal: AbortSignal): Promise<string> {
  const res = await fetch(`${LLM_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: TALK_MODEL,
      messages: chatMessages(persona, history),
      stream: true,
      max_tokens: TALK_REASONING === 'none' ? 320 : 1200,
      // gemma's recommended sampling (gemma3-1b and gemma4 alike). Measured with gemma3-1b on 90 replies (2 personas × 15 lines × 3
      // histories): no loops, third person, emoji or overlong replies; a presence penalty (1.5, kept against qwen's
      // loops at 0.7) or repeat_penalty 1.1 changed nothing for gemma. The tool pass stays at 0.
      temperature: 1.0,
      top_p: 0.95,
      top_k: 64,
      min_p: 0,
      ...reasoning(TALK_REASONING),
    }),
    signal,
  });
  if (!res.ok || res.body === null) throw new Error(`Llama.cpp answered ${res.status}`);
  const said = history.at(-1)?.role === 'user' ? history.at(-1)!.content : '';
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buffer = '';
  let raw = '';
  for (; ;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += dec.decode(value, { stream: true });
    const parsed = parseSse(buffer);
    buffer = parsed.rest;
    if (parsed.pieces.length > 0) {
      raw += parsed.pieces.join('');
      const tidy = tidyReply(stripThink(raw), persona, said, false);
      onText(tidy.text);
      // enough said: closing the stream stops the generation too
      if (tidy.full) {
        void reader.cancel();
        break;
      }
    }
    if (parsed.done) break;
  }
  return tidyReply(stripThink(raw), persona, said, true).text;
}

/** The tool pass reads the exchange (history ending in the NPC's reply) and returns the tools it calls. */
export async function judgeExchange(persona: NpcPersona, history: readonly ChatTurn[], maxMoney: number, signal: AbortSignal): Promise<ToolCall[]> {
  const res = await fetch(`${TOOL_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: TOOL_MODEL,
      messages: judgeMessages(persona, history),
      tools: judgeTools(persona, maxMoney),
      tool_choice: 'required',
      // a call is ~10–20 tokens; gemma sometimes starts reasoning anyway on harmless chat: cut off, it counts as nothing
      max_tokens: TOOL_REASONING === 'none' ? JUDGE_TOKENS : 1200,
      temperature: 0,
      ...reasoning(TOOL_REASONING),
    }),
    signal,
  });
  if (!res.ok) throw new Error(`Llama.cpp answered ${res.status}`);
  const json = (await res.json()) as { choices?: { message?: { tool_calls?: { function?: { name?: string; arguments?: string } }[] } }[] };
  const calls = (json.choices?.[0]?.message?.tool_calls ?? []).flatMap((c) => {
    const name = c.function?.name ?? '';
    if (name === '' || name === DO_NOTHING) return [];
    return [{ name, ...amountOf(c.function?.arguments, maxMoney) }];
  });
  return guardCalls(calls, history.at(-1)?.content ?? '', provoked(history.at(-2)), robbed(history.at(-2)), challenged(history.at(-2)));
}

/** "or I will…", "next time", "keep talking and…": a hit said this way has not happened yet */
const THREAT = /\b(or (else|i will|i'll)|next time|one more|if you|keep talking|you will (feel|regret|get)|watch your)\b/;
const HIT_WORDS: Readonly<Record<string, RegExp>> = { [SLAP]: /\b(slap|smack|hit|punch|whack)/, [KICK]: /\b(kick|boot)/ };
const MONEY_WORDS = /\b(coin|money|gold|purse|wallet)/;
const MONEY_REFUSED = /\b(never|no way|nothing from me)\b/;
const MONEY_TAKE = /\b(taking|take your|i('ll| will) (take|have|keep)|keeping|hand (it|them) over|confiscat|steal)/;
const MONEY_GIVE = /\b(here is|here are|here,|have \d+|take it|take this|for you|reward|gift)/;
const EWAMON_TAKE = /\b(take (that|your)|i('ll| will) (take|have)|have that|of yours|on your belt|steal)/;
const EWAMON_GIVE = /\b(take (my|this)|here,? (take|have)|gift|for you|have (this|my))/;
const BATTLE_WORDS = /\b(battle|duel|fight|match|challenge)/;

/**
 * The tool pass's calls checked against the NPC's last words (see the header): a hit needs a hit word and must not
 * be only a threat (an `*action*` or a "here" makes it real), unless the player provoked it (`provoked`: the NPC hits
 * back, though gemma3-1b only yells about it); money needs a money word and no refusal; an Ewamon
 * needs the word Ewamon; give / take follow the wording when it points one way only, except after a robbery
 * (`robbed`), where money only goes to the player: gemma4-e2b called `take_money` for "Here, take these" 6 times in 12.
 * A battle the NPC starts needs a battle word and must not be only a threat; after the player's challenge
 * (`challenged`) it always starts, called or not. Repeats are dropped.
 */
export function guardCalls(calls: readonly ToolCall[], reply: string, wasProvoked = false, wasRobbed = false, wasChallenged = false): ToolCall[] {
  const t = reply.toLowerCase();
  const onlyThreat = THREAT.test(t) && !t.includes('*') && !/\bhere\b/.test(t);
  const direction = (give: boolean, take: boolean, giveName: string, takeName: string, said: string): string =>
    take && !give ? takeName : give && !take ? giveName : said;
  const out: ToolCall[] = [];
  for (const c of calls) {
    let name: string | null = null;
    if (c.name === SLAP || c.name === KICK) name = wasProvoked || (HIT_WORDS[c.name]!.test(t) && !onlyThreat) ? c.name : null;
    else if (c.name === GIVE_MONEY || c.name === TAKE_MONEY)
      name = !MONEY_WORDS.test(t) || MONEY_REFUSED.test(t) ? null : wasRobbed ? GIVE_MONEY : direction(MONEY_GIVE.test(t), MONEY_TAKE.test(t), GIVE_MONEY, TAKE_MONEY, c.name);
    else if (c.name === GIVE_EWAMON || c.name === TAKE_EWAMON)
      name = t.includes('ewamon') ? direction(EWAMON_GIVE.test(t), EWAMON_TAKE.test(t), GIVE_EWAMON, TAKE_EWAMON, c.name) : null;
    else if (c.name === START_BATTLE) name = wasChallenged || (BATTLE_WORDS.test(t) && !onlyThreat) ? c.name : null;
    if (name !== null && !out.some((o) => o.name === name)) out.push({ ...c, name });
  }
  if (wasChallenged && !out.some((o) => o.name === START_BATTLE)) out.push({ name: START_BATTLE });
  return out;
}

/** `{"amount": n}` → a clamped amount; anything else → none (the server's default, the cap). */
export function amountOf(args: string | undefined, maxMoney: number): { amount?: number } {
  try {
    const a = (JSON.parse(args ?? '{}') as { amount?: unknown }).amount;
    const n = typeof a === 'number' ? a : typeof a === 'string' ? Number(a) : Number.NaN;
    return Number.isFinite(n) && n >= 1 ? { amount: Math.min(maxMoney, Math.round(n)) } : {};
  } catch (_e) {
    return {};
  }
}
