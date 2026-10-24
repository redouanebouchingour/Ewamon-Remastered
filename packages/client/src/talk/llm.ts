/**
 * The local model's plumbing, shared by every LLM feature (NPC talk, memory summaries and the features after them):
 * the endpoint and model names, llama.cpp's reasoning switch, the streamed call (`streamChat`, SSE `parseSse`), the
 * one-shot call (`chatOnce`: tools, JSON output, a timeout), and the tidying every model text goes through before a
 * player sees it (`stripThink`, `noDashes`).
 *
 * The model is gemma4-e2b behind llama.cpp's OpenAI-compatible API (`LLM_BASE`, default `/npc/llm/v1`: nginx in docker,
 * Vite in dev). LLM calls stay in the client; the server never calls the model, and nothing the model says is game
 * truth until a server route has checked it.
 *
 * `VITE_NPC_LLM_URL` / `VITE_NPC_LLM_MODEL` / `VITE_NPC_LLM_REASONING` and `VITE_NPC_TOOL_URL` / `VITE_NPC_TOOL_MODEL` /
 * `VITE_NPC_TOOL_REASONING` override the talk and the tool passes (reasoning: a llama.cpp `reasoning_effort`, or
 * `default` to leave it to the model).
 *
 * No em-dashes: every prompt says so (`NO_DASHES`) and every text shown to the player goes through `noDashes`, since
 * the model still writes one now and then (gemma4-e2b: about one reply in fifteen without the instruction).
 */

const env = (k: string): string | undefined => (import.meta.env as Record<string, string | undefined> | undefined)?.[k];
export const LLM_BASE = env('VITE_NPC_LLM_URL') ?? '/npc/llm/v1';
/** the tool pass's server and model: the talk pass's unless overridden (one model does both) */
export const TOOL_BASE = env('VITE_NPC_TOOL_URL') ?? LLM_BASE;
export const TALK_MODEL = env('VITE_NPC_LLM_MODEL') ?? 'gemma4-e2b';
// `none` is required for gemma4: without `enable_thinking: false` it writes its reasoning into the content
export const TALK_REASONING = env('VITE_NPC_LLM_REASONING') ?? 'none';
export const TOOL_MODEL = env('VITE_NPC_TOOL_MODEL') ?? TALK_MODEL;
export const TOOL_REASONING = env('VITE_NPC_TOOL_REASONING') ?? 'none';

/** the sentence every prompt carries (the model copies dashes from its training data otherwise) */
export const NO_DASHES = 'Never use em-dashes.';

export interface LlmMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

/** Llama.cpp's switch: `none` = no thinking; `default` = leave it to the model. */
export function reasoning(effort: string): Record<string, unknown> {
  if (effort === 'default') return {};
  return { reasoning_effort: effort, chat_template_kwargs: { enable_thinking: effort !== 'none' } };
}

/**
 * Em-dashes (and the horizontal bar, and a spaced ` -- `) out of a model's text, the way a person would have written
 * it: an aside between two dashes gets commas, a dash before a list (a comma follows before the sentence ends) a colon,
 * any other dash a comma; one at the start of the text or right before the end of a sentence just goes.
 */
export function noDashes(text: string): string {
  let t = text.replace(/\u2015|(?<=\s)--(?=\s)/g, '\u2014');
  if (!t.includes('\u2014')) return t;
  t = t
    // at the start, or right before the end of a sentence (or the text): dropped
    .replace(/^\s*\u2014\s*/, '')
    .replace(/\s*\u2014\s*(?=[.!?…]|$)/g, '')
    // an aside between two dashes: commas
    .replace(/\s*\u2014\s*([^\u2014.!?]{1,60}?)\s*\u2014\s*/g, ', $1, ')
    // a single dash: a colon before a list, a comma otherwise
    .replace(/\s*\u2014\s*([^\u2014.!?]*)/g, (_m, rest: string) => (rest.includes(',') ? `: ${rest}` : `, ${rest}`));
  return t.replace(/\u2014/g, ',').replace(/([,:])\s*,/g, '$1').replace(/\s+([,:])/g, '$1');
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
    .replace(/\p{Extended_Pictographic}️?/gu, '')
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

export interface ChatOptions {
  readonly messages: readonly LlmMessage[];
  readonly maxTokens: number;
  readonly temperature?: number;
  /** extra sampling fields (top_p, top_k, min_p...) */
  readonly sampling?: Readonly<Record<string, number>>;
  /** defaults to the talk pass's server / model / reasoning */
  readonly base?: string;
  readonly model?: string;
  readonly reasoning?: string;
  readonly signal?: AbortSignal;
  /** aborts the call after this long (on top of `signal`) */
  readonly timeoutMs?: number;
}

export interface ChatOnceOptions extends ChatOptions {
  /** OpenAI function tools */
  readonly tools?: readonly unknown[];
  readonly toolChoice?: 'auto' | 'required' | 'none';
  /** `true`: any JSON object (`response_format: json_object`); an object: a JSON schema the output must follow */
  readonly json?: true | Readonly<Record<string, unknown>>;
}

export interface ToolCallRaw {
  readonly name: string;
  /** the arguments as the model wrote them (a JSON string, unparsed) */
  readonly arguments: string;
}

export interface ChatOnceResult {
  /** the message content, `<think>` blocks dropped (not otherwise tidied) */
  readonly content: string;
  readonly toolCalls: readonly ToolCallRaw[];
}

function signalOf(signal: AbortSignal | undefined, timeoutMs: number | undefined): AbortSignal | undefined {
  const timeout = timeoutMs !== undefined ? AbortSignal.timeout(timeoutMs) : undefined;
  if (signal === undefined) return timeout;
  if (timeout === undefined) return signal;
  const anyFn = (AbortSignal as unknown as { any?: (s: AbortSignal[]) => AbortSignal }).any;
  if (typeof anyFn === 'function') return anyFn([signal, timeout]);
  const ctl = new AbortController();
  const abort = (): void => ctl.abort();
  signal.addEventListener('abort', abort, { once: true });
  timeout.addEventListener('abort', abort, { once: true });
  return ctl.signal;
}

function body(o: ChatOptions, stream: boolean, model: string, effort: string): Record<string, unknown> {
  return {
    model,
    messages: o.messages,
    stream,
    max_tokens: o.maxTokens,
    ...(o.temperature !== undefined ? { temperature: o.temperature } : {}),
    ...(o.sampling ?? {}),
    ...reasoning(effort),
  };
}

/**
 * One call, no streaming: the content and the tool calls. Throws when the server answers an error, the timeout or
 * `signal` aborts it, or the reply is not JSON; callers fall back to a templated line.
 */
export async function chatOnce(o: ChatOnceOptions): Promise<ChatOnceResult> {
  const base = o.base ?? LLM_BASE;
  const req: Record<string, unknown> = body(o, false, o.model ?? TALK_MODEL, o.reasoning ?? TALK_REASONING);
  if (o.tools !== undefined) req['tools'] = o.tools;
  if (o.toolChoice !== undefined) req['tool_choice'] = o.toolChoice;
  if (o.json === true) req['response_format'] = { type: 'json_object' };
  else if (o.json !== undefined) req['response_format'] = { type: 'json_schema', json_schema: { name: 'answer', schema: o.json, strict: true } };
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(req),
    signal: signalOf(o.signal, o.timeoutMs),
  });
  if (!res.ok) throw new Error(`Llama.cpp answered ${res.status}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string | null; tool_calls?: { function?: { name?: string; arguments?: string } }[] } }[] };
  const msg = json.choices?.[0]?.message;
  const toolCalls = (msg?.tool_calls ?? []).flatMap((c) => {
    const name = c.function?.name ?? '';
    return name === '' ? [] : [{ name, arguments: c.function?.arguments ?? '{}' }];
  });
  return { content: stripThink(typeof msg?.content === 'string' ? msg.content : '').trim(), toolCalls };
}

/**
 * A streamed call: `onRaw` gets the whole raw text so far after each chunk and returns true to stop (closing the
 * stream stops the generation too). Resolves with the raw text.
 */
export async function streamChat(o: ChatOptions, onRaw: (raw: string) => boolean): Promise<string> {
  const res = await fetch(`${o.base ?? LLM_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body(o, true, o.model ?? TALK_MODEL, o.reasoning ?? TALK_REASONING)),
    signal: signalOf(o.signal, o.timeoutMs),
  });
  if (!res.ok || res.body === null) throw new Error(`Llama.cpp answered ${res.status}`);
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
      if (onRaw(raw)) {
        void reader.cancel();
        break;
      }
    }
    if (parsed.done) break;
  }
  return raw;
}
