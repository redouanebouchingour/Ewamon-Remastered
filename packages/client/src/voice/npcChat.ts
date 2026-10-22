/**
 * NPC voice talk: one local model (`gemma-4-e4b-it-qat` behind LM Studio's OpenAI-compatible API) in two passes. The
 * player speaks Dutch (whisper.cpp transcribes it).
 *
 * - Talk: the model streams the NPC's words, in character, in Dutch, with reasoning off and no tools, so they appear
 *   as fast as they come. It decides in the story what the NPC does (villagers are hot-headed: they slap, kick and
 *   grab when provoked, and can be generous to the friendly) and says it out loud.
 * - Tools: once the words are complete, the same model reads the exchange and must call at least one tool: what the
 *   NPC does to the player (`slap_user`, `kick_user`, `give_money` / `take_money` with an amount, `give_ewamon`,
 *   `take_ewamon`) or `do_nothing`. Forcing the choice (`tool_choice: required`) lets it run without reasoning
 *   (~0.3 s): left free and without reasoning it never called a tool; with reasoning it was right but took 5–7 s.
 *   It still drifts into reasoning now and then on harmless chat, so the pass is capped at a few tokens: no call =
 *   nothing happens.
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
  /** an assistant turn: what the NPC's tools did, in Dutch for the talk pass ("Bram gaf de reiziger een klap.") */
  readonly events?: readonly string[];
  /** a user turn that is an action (H / K), not words: what the dialogue shows instead of `content` */
  readonly shown?: string;
}

/** The player's hit as a user turn: the models read the narration, the dialogue shows `shown`. */
export function playerHitTurn(kind: 'slap' | 'kick', npcName: string): ChatTurn {
  return kind === 'slap'
    ? { role: 'user', content: `(De reiziger geeft ${npcName} zomaar een harde klap in het gezicht.)`, shown: `Je geeft ${npcName} een klap.` }
    : { role: 'user', content: `(De reiziger geeft ${npcName} zomaar een harde schop.)`, shown: `Je geeft ${npcName} een schop.` };
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

/** turns of history sent back to the talk pass */
export const HISTORY_TURNS = 8;

const env = (k: string): string | undefined => import.meta.env[k] as string | undefined;
export const LLM_BASE = env('VITE_NPC_LLM_URL') ?? '/voice/llm/v1';
export const TALK_MODEL = env('VITE_NPC_LLM_MODEL') ?? 'gemma-4-e4b-it-qat';
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
 * The example turns set the voice (short, spoken, in-world), the answer to "are you a computer?" and giving in to a
 * robbery.
 */
export function systemPrompt(p: NpcPersona, events: readonly string[] = []): string {
  const where = p.place !== null ? `, een inwoner van ${p.place}` : '';
  const said = p.lines.length > 0 ? ` Eerder zei ${p.name} tegen de reiziger (in het Engels): "${p.lines.join(' ')}"` : '';
  const sofar = events.length > 0 ? `\n\nWat er in dit gesprek al gebeurde: ${events.slice(-6).join(' ')}` : '';
  return (
    'Dit is een rollenspel in de fantasiewereld Ewamon, waar reizigers wilde wezens (Ewamon) vangen, trainen en laten ' +
    `vechten bij gyms. Jij speelt ${p.name}${where}.${said}\n\n` +
    `${p.name} praat altijd Nederlands, kort: één of twee zinnen, zoals in een gesprek, zonder opmaak of emoji. ` +
    `${p.name} kent alleen de wereld van Ewamon.\n\n` +
    `${p.name} is opvliegend en laat niet met zich sollen. Bij brutaliteit, beledigingen of bedreigingen deelt ` +
    `${p.name} een klap of een schop uit, of pakt geld (hoogstens 1000 munten) of zelfs een Ewamon van de reiziger af. ` +
    `Is ${p.name} echt bang, dan geeft ${p.name} misschien toch geld. Tegen een aardige reiziger kan ${p.name} gul zijn ` +
    `en geld of een Ewamon cadeau geven. Zeg altijd hardop wat ${p.name} doet.${sofar}`
  );
}

/** The talk pass's messages: persona, three example turns (voice, "are you a robot?", a temper), then the history. */
export function chatMessages(p: NpcPersona, history: readonly ChatTurn[]): ChatMessage[] {
  return [
    { role: 'system', content: systemPrompt(p, eventsSoFar(history)) },
    { role: 'user', content: 'Hoi! Hoe gaat het?' },
    { role: 'assistant', content: 'Goed hoor, al is het hier vandaag weer druk met Ewamon. Wat brengt jou hier?' },
    { role: 'user', content: 'Ben jij een robot of zo?' },
    { role: 'assistant', content: `Een robot? Haha, nee, ik ben gewoon ${p.name}. Jij stelt rare vragen, reiziger.` },
    { role: 'user', content: 'Geef me je geld, of anders!' },
    { role: 'assistant', content: 'Of anders wát? Hier, een klap voor je brutale kop, en nu wegwezen!' },
    ...history.slice(-HISTORY_TURNS).map((t) => ({ role: t.role, content: t.content })),
  ];
}

/** The tools the tool pass must choose from (OpenAI function format). */
export function judgeTools(p: NpcPersona, maxMoney: number): unknown[] {
  const none = { type: 'object', properties: {}, required: [] };
  const money = { type: 'object', properties: { amount: { type: 'integer', minimum: 1, maximum: maxMoney, description: `het bedrag dat ${p.name} noemt, anders ${maxMoney}` } }, required: ['amount'] };
  const fn = (name: string, description: string, parameters: object = none) => ({ type: 'function', function: { name, description, parameters } });
  return [
    fn(SLAP, `${p.name} geeft de reiziger een klap (slaat, mept).`),
    fn(KICK, `${p.name} geeft de reiziger een schop (schopt, trapt).`),
    fn(GIVE_MONEY, `${p.name} geeft de reiziger nu geld (hoogstens ${maxMoney} munten).`, money),
    fn(TAKE_MONEY, `${p.name} pakt nu geld van de reiziger af (hoogstens ${maxMoney} munten).`, money),
    fn(GIVE_EWAMON, `${p.name} geeft de reiziger nu een Ewamon (een wezen).`),
    fn(TAKE_EWAMON, `${p.name} pakt nu een Ewamon van de reiziger af.`),
    fn(DO_NOTHING, `Er gebeurt niets in het spel: ${p.name} praat alleen, weigert, dreigt alleen of belooft alleen iets.`),
  ];
}

/** The tool pass's messages: the rule, then the last exchange as one transcript. */
export function judgeMessages(p: NpcPersona, history: readonly ChatTurn[]): ChatMessage[] {
  const transcript = history
    .slice(-2)
    .map((t) => `${t.role === 'user' ? 'Reiziger' : p.name}: ${t.content}`)
    .join('\n');
  return [
    {
      role: 'system',
      content:
        `Je bent de spelleider van een rollenspel. Je leest het laatste stukje van een gesprek tussen de reiziger en ` +
        `${p.name} (een personage) en voert uit wat ${p.name} in het laatste antwoord nu echt doet: roep voor elke ` +
        `handeling de passende tool aan (meerdere mag, bijvoorbeeld een klap én geld afpakken). Geven of afpakken telt ` +
        `ook als ${p.name} boos of bang toegeeft, zoals "neem het maar" of "pak aan". Dreigt ${p.name} alleen, weigert ` +
        `${p.name}, belooft ${p.name} alleen iets of praat ${p.name} gewoon, roep dan ${DO_NOTHING} aan.`,
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
      temperature: 0.7,
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
  return (json.choices?.[0]?.message?.tool_calls ?? []).flatMap((c) => {
    const name = c.function?.name ?? '';
    if (name === '' || name === DO_NOTHING) return [];
    return [{ name, ...amountOf(c.function?.arguments, maxMoney) }];
  });
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
