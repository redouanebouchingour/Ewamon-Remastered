/**
 * NPC voice talk: one local model (`qwen3.5-0.8b` behind LM Studio's OpenAI-compatible API) in two passes. The player
 * speaks English (whisper.cpp transcribes it).
 *
 * - Talk: the model streams the NPC's words (fast; the dialogue is rough, and that is accepted), in character,
 *   in English, with reasoning off and no tools, so they appear as fast as they come. It decides in the story what the NPC does (villagers are hot-headed: they slap, kick and
 *   grab when provoked, and can be generous to the friendly) and says it out loud.
 * - Tools: once the words are complete, the same model reads the exchange and must call at least one tool:
 *   what the NPC does to the player (`slap_user`, `kick_user`, `give_money` / `take_money` with an amount, `give_ewamon`,
 *   `take_ewamon`) or `do_nothing`. Forcing the choice (`tool_choice: required`) lets it run without reasoning
 *   (~0.3 s): left free and without reasoning it never called a tool; with reasoning it was right but took 5–7 s.
 *   It still drifts into reasoning now and then on harmless chat, so the pass is capped at a few tokens: no call =
 *   nothing happens. The 0.8b model often gets the direction wrong (gives when the NPC takes) and acts on threats, so
 *   `guardCalls` checks each call against the NPC's words: it drops a call the words do not mention (or only threaten)
 *   and turns give / take round when the wording clearly says the other way. Measured on 20 unseen exchanges: 9/20
 *   right bare, 14/20 guarded (gemma-4-e4b-it-qat: 18/20 at twice the time); most guarded misses drop an action.
 *
 * What the tools did is remembered on the turn (`ChatTurn.events`) and told to the talk pass as the scene so far.
 * `VITE_NPC_LLM_MODEL` / `VITE_NPC_LLM_REASONING` and `VITE_NPC_TOOL_MODEL` / `VITE_NPC_TOOL_REASONING` override the
 * two passes (reasoning: an LM Studio `reasoning_effort`, or `default` to leave it to the model). `stripThink` drops
 * a `<think>` block that leaks into the content.
 */

export interface NpcPersona {
  readonly name: string;
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

/** The player's hit as a user turn: the models read the narration, the dialogue shows `shown`. */
export function playerHitTurn(kind: 'slap' | 'kick', npcName: string): ChatTurn {
  return kind === 'slap'
    ? { role: 'user', content: '(The traveller slaps you hard in the face, out of nowhere.)', shown: `You slap ${npcName}.` }
    : { role: 'user', content: '(The traveller kicks you hard, out of nowhere.)', shown: `You kick ${npcName}.` };
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

/** turns of history sent back to the talk pass: the whole conversation in practice (lines are a sentence or two) */
export const HISTORY_TURNS = 32;

const env = (k: string): string | undefined => import.meta.env[k] as string | undefined;
export const LLM_BASE = env('VITE_NPC_LLM_URL') ?? '/voice/llm/v1';
export const TALK_MODEL = env('VITE_NPC_LLM_MODEL') ?? 'qwen3.5-0.8b';
const TALK_REASONING = env('VITE_NPC_LLM_REASONING') ?? 'none';
export const TOOL_MODEL = env('VITE_NPC_TOOL_MODEL') ?? 'qwen3.5-0.8b';
const TOOL_REASONING = env('VITE_NPC_TOOL_REASONING') ?? 'none';

/** the tool pass's token cap without reasoning (see `judgeExchange`): a few calls with an amount */
const JUDGE_TOKENS = 120;

export const SLAP = 'slap_user';
export const KICK = 'kick_user';
export const GIVE_MONEY = 'give_money';
export const TAKE_MONEY = 'take_money';
export const GIVE_EWAMON = 'give_ewamon';
export const TAKE_EWAMON = 'take_ewamon';
export const DO_NOTHING = 'do_nothing';

/** LM Studio's switch: `none` = no thinking; `default` = leave it to the model. */
function reasoning(effort: string): Record<string, unknown> {
  if (effort === 'default') return {};
  return { reasoning_effort: effort, chat_template_kwargs: { enable_thinking: effort !== 'none' } };
}

/** What the NPC's tools did in this conversation so far, oldest first. */
export function eventsSoFar(history: readonly ChatTurn[]): string[] {
  return history.flatMap((t) => t.events ?? []);
}

/**
 * Framed as a role-play with only positive rules (a small model told "you are not an AI" starts talking about AIs).
 * Everything is said to the NPC as "you" and asks for its own words in the first person: a prompt that described the
 * NPC as "Bram is hot-headed…" got narration back ("Bram sits on the bench. He looks at you…"). The example turns set
 * the voice (short, spoken, in-world), the answer to "are you a computer?" and giving in to a robbery.
 */
export function systemPrompt(p: NpcPersona, events: readonly string[] = []): string {
  const where = p.place !== null ? `, who lives in ${p.place}` : '';
  const said = p.lines.length > 0 ? ` Earlier you said to the traveller: "${p.lines.join(' ')}"` : '';
  const sofar = events.length > 0 ? `\n\nWhat has happened in this conversation so far: ${events.slice(-6).join(' ')}` : '';
  return (
    'This is a role-play in the fantasy world of Ewamon, where travellers catch, train and battle wild creatures ' +
    `(Ewamon) at gyms. You are ${p.name}${where}.${said}\n\n` +
    `You speak as ${p.name}, in the first person ("I", "me", "my"): each reply is only your own spoken words to the ` +
    'traveller, in English, one or two sentences, like in a conversation, without narration, formatting or emoji. ' +
    'You only know the world of Ewamon.\n\n' +
    'You are hot-headed and take no nonsense. Faced with cheek, insults or threats, you hand out a slap or a kick, or ' +
    'take money (at most 1000 coins) or even an Ewamon from the traveller. If you are truly scared, you may hand over ' +
    'money after all. To a friendly traveller you can be generous and give money or an Ewamon as a gift. When you do ' +
    `something, say it out loud in your own words as you do it, like "Here, take this slap!"${sofar}`
  );
}

/** The talk pass's messages: persona, three example turns (voice, "are you a robot?", a temper), then the history. */
export function chatMessages(p: NpcPersona, history: readonly ChatTurn[]): ChatMessage[] {
  return [
    { role: 'system', content: systemPrompt(p, eventsSoFar(history)) },
    { role: 'user', content: 'Hi! How are you?' },
    { role: 'assistant', content: 'Fine, thanks, though it is busy with Ewamon around here again today. What brings you here?' },
    { role: 'user', content: 'Are you a robot or something?' },
    { role: 'assistant', content: `A robot? Ha, no, I'm just ${p.name}. You ask strange questions, traveller.` },
    { role: 'user', content: 'Give me your money, or else!' },
    { role: 'assistant', content: 'Or else what? Here, a slap for your cheek, now get lost!' },
    ...history.slice(-HISTORY_TURNS).map((t) => ({ role: t.role, content: t.content })),
  ];
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
        `${p.name} gives in angrily or fearfully, like "take it then" or "here you go". If ${p.name} only threatens, ` +
        `refuses, only promises something or just talks, call ${DO_NOTHING}.`,
    },
    { role: 'user', content: transcript },
  ];
}

/** Drops `<think>…</think>` (and an unclosed `<think>` tail while streaming) and markdown emphasis. */
export function stripThink(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/<think>[\s\S]*$/, '')
    .replace(/[*_#`]+/g, '')
    .trimStart();
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
      max_tokens: TALK_REASONING === 'none' ? 200 : 1200,
      // the talk pass samples warm, with a presence penalty against loops ("You're not welcome. You're not welcome. …"
      // at 0.7): 2/168 sampled replies repeated a sentence 3+ times at 0.7, 0/168 like this; the tool pass stays at 0
      temperature: 1.0,
      top_p: 0.95,
      top_k: 40,
      presence_penalty: 1.5,
      ...reasoning(TALK_REASONING),
    }),
    signal,
  });
  if (!res.ok || res.body === null) throw new Error(`LM Studio answered ${res.status}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buffer = '';
  let raw = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += dec.decode(value, { stream: true });
    const parsed = parseSse(buffer);
    buffer = parsed.rest;
    if (parsed.pieces.length > 0) {
      raw += parsed.pieces.join('');
      onText(stripThink(raw));
    }
    if (parsed.done) break;
  }
  return stripThink(raw).trim();
}

/** The tool pass reads the exchange (history ending in the NPC's reply) and returns the tools it calls. */
export async function judgeExchange(persona: NpcPersona, history: readonly ChatTurn[], maxMoney: number, signal: AbortSignal): Promise<ToolCall[]> {
  const res = await fetch(`${LLM_BASE}/chat/completions`, {
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
  if (!res.ok) throw new Error(`LM Studio answered ${res.status}`);
  const json = (await res.json()) as { choices?: { message?: { tool_calls?: { function?: { name?: string; arguments?: string } }[] } }[] };
  const calls = (json.choices?.[0]?.message?.tool_calls ?? []).flatMap((c) => {
    const name = c.function?.name ?? '';
    if (name === '' || name === DO_NOTHING) return [];
    return [{ name, ...amountOf(c.function?.arguments, maxMoney) }];
  });
  return guardCalls(calls, history.at(-1)?.content ?? '');
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

/**
 * The tool pass's calls checked against the NPC's last words (see the header): a hit needs a hit word and must not
 * be only a threat (an `*action*` or a "here" makes it real); money needs a money word and no refusal; an Ewamon
 * needs the word Ewamon; give / take follow the wording when it points one way only. Repeats are dropped.
 */
export function guardCalls(calls: readonly ToolCall[], reply: string): ToolCall[] {
  const t = reply.toLowerCase();
  const onlyThreat = THREAT.test(t) && !t.includes('*') && !/\bhere\b/.test(t);
  const direction = (give: boolean, take: boolean, giveName: string, takeName: string, said: string): string =>
    take && !give ? takeName : give && !take ? giveName : said;
  const out: ToolCall[] = [];
  for (const c of calls) {
    let name: string | null = null;
    if (c.name === SLAP || c.name === KICK) name = HIT_WORDS[c.name]!.test(t) && !onlyThreat ? c.name : null;
    else if (c.name === GIVE_MONEY || c.name === TAKE_MONEY)
      name = MONEY_WORDS.test(t) && !MONEY_REFUSED.test(t) ? direction(MONEY_GIVE.test(t), MONEY_TAKE.test(t), GIVE_MONEY, TAKE_MONEY, c.name) : null;
    else if (c.name === GIVE_EWAMON || c.name === TAKE_EWAMON)
      name = t.includes('ewamon') ? direction(EWAMON_GIVE.test(t), EWAMON_TAKE.test(t), GIVE_EWAMON, TAKE_EWAMON, c.name) : null;
    if (name !== null && !out.some((o) => o.name === name)) out.push({ ...c, name });
  }
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
