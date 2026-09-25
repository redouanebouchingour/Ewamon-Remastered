/**
 * The Stable Audio adapter against its documented HTTP contract, with an injected fake `fetch`. Never calls the
 * network and never reads the real environment: every provider here gets an explicit `env`.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { expandJobs } from '../src/jobs.js';
import { ProviderError } from '../src/provider.js';
import type { FetchLike } from '../src/providers/stable-audio.js';
import { STABLE_AUDIO_ENDPOINT, StableAudioProvider, buildForm, providerDuration, providerPrompt, providerSeed } from '../src/providers/stable-audio.js';
import { encodeWav } from '../src/wav.js';
import { tempPaths, tinyManifest } from './helpers.js';

const t = tempPaths('ewa-audio-provider-');
afterAll(() => t.cleanup());
const jobs = expandJobs(tinyManifest(), 'stable-audio', t.cache);
const stem = jobs.find((j) => j.id === 'themes/grove/base')!;
const click = jobs.find((j) => j.id === 'sfx/ui_click_1')!;
const FAKE_KEY = 'test-not-a-real-key';
const wav = encodeWav({ sampleRate: 44100, channels: [new Float32Array(441), new Float32Array(441)] });

interface Call {
  url: string;
  headers: Record<string, string>;
  body: FormData;
}

function fakeFetch(statuses: number[], calls: Call[], opts: { body?: Uint8Array; headers?: Record<string, string> } = {}): FetchLike {
  let i = 0;
  return async (url, init) => {
    calls.push({ url, headers: init.headers, body: init.body });
    const status = statuses[Math.min(i++, statuses.length - 1)]!;
    const bytes = opts.body ?? wav;
    return {
      status,
      ok: status >= 200 && status < 300,
      headers: { get: (n: string) => (opts.headers ?? { 'content-type': 'audio/wav', 'finish-reason': 'SUCCESS' })[n.toLowerCase()] ?? null },
      arrayBuffer: async () => bytes.slice().buffer,
      text: async () => (status >= 400 ? '{"errors":["nope"]}' : ''),
    };
  };
}

describe('StableAudioProvider', () => {
  it('is unconfigured without EWA_AUDIO_API_KEY and refuses to generate', async () => {
    const calls: Call[] = [];
    const p = new StableAudioProvider({ env: {}, fetch: fakeFetch([200], calls) });
    expect(p.configured()).toBe(false);
    await expect(p.generate(stem, new AbortController().signal)).rejects.toThrow(/EWA_AUDIO_API_KEY/);
    expect(calls).toHaveLength(0);
  });

  it('posts the documented multipart form and writes the WAV', async () => {
    const calls: Call[] = [];
    const p = new StableAudioProvider({ env: { EWA_AUDIO_API_KEY: FAKE_KEY }, fetch: fakeFetch([200], calls) });
    expect(p.configured()).toBe(true);
    await p.generate(stem, new AbortController().signal);
    expect(calls).toHaveLength(1);
    const c = calls[0]!;
    expect(c.url).toBe(STABLE_AUDIO_ENDPOINT);
    expect(c.headers.authorization).toBe(`Bearer ${FAKE_KEY}`);
    expect(c.headers.accept).toBe('audio/*');
    expect(c.body.get('model')).toBe('stable-audio-2.5');
    expect(c.body.get('output_format')).toBe('wav');
    expect(c.body.get('duration')).toBe(String(stem.prompt.durationSec));
    expect(c.body.get('seed')).toBe(String(providerSeed(stem.prompt.seed)));
    expect(String(c.body.get('prompt'))).toContain('200 BPM');
    expect(existsSync(stem.outWav)).toBe(true);
    expect(readFileSync(stem.outWav).subarray(0, 4).toString('latin1')).toBe('RIFF');
    expect(path.basename(stem.outWav)).toBe(`${stem.requestHash}.wav`);
  });

  it('retries 429/5xx with backoff, then succeeds', async () => {
    const calls: Call[] = [];
    const waits: number[] = [];
    const p = new StableAudioProvider({ env: { EWA_AUDIO_API_KEY: FAKE_KEY }, fetch: fakeFetch([429, 503, 200], calls), sleep: async (ms) => void waits.push(ms), backoffMs: 10 });
    await p.generate(click, new AbortController().signal);
    expect(calls).toHaveLength(3);
    expect(waits).toEqual([10, 20]);
  });

  it('gives up after 3 retries', async () => {
    const calls: Call[] = [];
    const p = new StableAudioProvider({ env: { EWA_AUDIO_API_KEY: FAKE_KEY }, fetch: fakeFetch([500], calls), sleep: async () => undefined });
    await expect(p.generate(click, new AbortController().signal)).rejects.toThrow(/gave up after 3 retries/);
    expect(calls).toHaveLength(4);
  });

  it('throws on 4xx without retrying, and never echoes the key', async () => {
    const calls: Call[] = [];
    const p = new StableAudioProvider({ env: { EWA_AUDIO_API_KEY: FAKE_KEY }, fetch: fakeFetch([400], calls) });
    const err = await p.generate(click, new AbortController().signal).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect((err as ProviderError).status).toBe(400);
    expect((err as Error).message).not.toContain(FAKE_KEY);
    expect(calls).toHaveLength(1);
  });

  it('rejects a non-WAV body and a filtered generation', async () => {
    const p1 = new StableAudioProvider({ env: { EWA_AUDIO_API_KEY: FAKE_KEY }, fetch: fakeFetch([200], [], { body: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]) }) });
    await expect(p1.generate(click, new AbortController().signal)).rejects.toThrow(/not a WAV/);
    const p2 = new StableAudioProvider({ env: { EWA_AUDIO_API_KEY: FAKE_KEY }, fetch: fakeFetch([200], [], { headers: { 'finish-reason': 'CONTENT_FILTERED' } }) });
    await expect(p2.generate(click, new AbortController().signal)).rejects.toThrow(/CONTENT_FILTERED/);
  });
});

describe('request mapping', () => {
  it('maps seeds into 1..4 294 967 294 (0 means random at the provider)', () => {
    expect(providerSeed(0)).toBe(1);
    expect(providerSeed(0xffffffff)).toBeGreaterThanOrEqual(1);
    expect(providerSeed(0xffffffff)).toBeLessThanOrEqual(4_294_967_294);
  });

  it('clamps durations to 1–190 s (sfx are trimmed back by process)', () => {
    expect(providerDuration(0.15)).toBe(1);
    expect(providerDuration(49.263)).toBe(49.263);
    expect(providerDuration(400)).toBe(190);
    expect(buildForm(click, 'stable-audio-2.5', 8, 1).get('duration')).toBe('1');
  });

  it('marks sfx prompts as isolated effects and music prompts as instrumental', () => {
    expect(providerPrompt(click)).toMatch(/isolated sound effect, no music\.$/);
    expect(providerPrompt(stem)).toMatch(/instrumental\.$/);
  });
});
