/**
 * The shared LLM plumbing (talk/llm.ts): em-dashes out of model text, the one-shot call (tools, JSON output, the
 * timeout, errors) and the streamed call (stopping early), with `fetch` mocked.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LLM_BASE, NO_DASHES, TALK_MODEL, chatOnce, noDashes, reasoning, streamChat } from '../src/talk/llm';

const D = '\u2014';
afterEach(() => vi.unstubAllGlobals());

const sent = (m: ReturnType<typeof vi.fn>, i = 0): Record<string, unknown> => JSON.parse(String((m.mock.calls[i]![1] as RequestInit).body)) as Record<string, unknown>;

describe('noDashes', () => {
  it('turns em-dashes into commas, a colon before a list, and drops one at an end', () => {
    expect(noDashes(`The marsh ${D} my marsh ${D} is quiet.`)).toBe('The marsh, my marsh, is quiet.');
    expect(noDashes(`I love it here${D}truly.`)).toBe('I love it here, truly.');
    expect(noDashes(`Three things ${D} berries, mud, and frogs.`)).toBe('Three things: berries, mud, and frogs.');
    expect(noDashes(`${D} Hello there.`)).toBe('Hello there.');
    expect(noDashes(`You again ${D}.`)).toBe('You again.');
    expect(noDashes(`Well${D}`)).toBe('Well');
    expect(noDashes('Leave -- now.')).toBe('Leave, now.');
    expect(noDashes('Leave \u2015 now.')).toBe('Leave, now.');
    expect(noDashes(`Fine${D}take it${D}and go!`)).toBe('Fine, take it, and go!');
  });

  it('leaves text without one alone (hyphens and en-dashes included)', () => {
    for (const t of ['a well-known road', 'levels 3–5', 'x--y', '']) expect(noDashes(t)).toBe(t);
  });

  it('every prompt sentence names the rule', () => {
    expect(NO_DASHES).toBe('Never use em-dashes.');
  });
});

describe('chatOnce', () => {
  it('posts one non-streamed call with tools, tool choice and the reasoning switch, and reads content and calls', async () => {
    const f = vi.fn(async () => Response.json({ choices: [{ message: { content: '<think>hm</think> Hi.', tool_calls: [{ function: { name: 'do_it', arguments: '{"a":1}' } }, { function: {} }] } }] }));
    vi.stubGlobal('fetch', f);
    const r = await chatOnce({ messages: [{ role: 'user', content: 'x' }], maxTokens: 50, temperature: 0, tools: [{ type: 'function' }], toolChoice: 'required' });
    expect(r).toEqual({ content: 'Hi.', toolCalls: [{ name: 'do_it', arguments: '{"a":1}' }] });
    expect(f.mock.calls[0]![0]).toBe(`${LLM_BASE}/chat/completions`);
    expect(sent(f)).toMatchObject({ model: TALK_MODEL, stream: false, max_tokens: 50, temperature: 0, tool_choice: 'required', ...reasoning('none') });
  });

  it('asks for JSON: any object, or one following a schema', async () => {
    const f = vi.fn(async () => Response.json({ choices: [{ message: { content: '{"ok":true}' } }] }));
    vi.stubGlobal('fetch', f);
    await chatOnce({ messages: [], maxTokens: 10, json: true });
    await chatOnce({ messages: [], maxTokens: 10, json: { type: 'object' } });
    expect(sent(f, 0)['response_format']).toEqual({ type: 'json_object' });
    expect(sent(f, 1)['response_format']).toMatchObject({ type: 'json_schema', json_schema: { schema: { type: 'object' } } });
  });

  it('throws on an error status and on the timeout', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('no', { status: 503 })));
    await expect(chatOnce({ messages: [], maxTokens: 1 })).rejects.toThrow('503');
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_u: string, init: RequestInit) =>
          new Promise((_r, reject) => {
            init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          }),
      ),
    );
    await expect(chatOnce({ messages: [], maxTokens: 1, timeoutMs: 20 })).rejects.toThrow();
  });
});

describe('streamChat', () => {
  it('feeds the raw text so far and stops when asked', async () => {
    const sse = ['A', 'B', 'C'].map((c) => `data: {"choices":[{"delta":{"content":"${c}"}}]}\n\n`);
    const f = vi.fn(async () => new Response(new ReadableStream({ start: (c) => { for (const s of sse) c.enqueue(new TextEncoder().encode(s)); c.close(); } }), { status: 200 }));
    vi.stubGlobal('fetch', f);
    const seen: string[] = [];
    const raw = await streamChat({ messages: [], maxTokens: 5, sampling: { top_k: 64 } }, (r) => {
      seen.push(r);
      return r.length >= 2;
    });
    expect(raw).toBe('AB');
    expect(seen).toEqual(['A', 'AB']);
    expect(sent(f)).toMatchObject({ stream: true, top_k: 64 });
  });
});
