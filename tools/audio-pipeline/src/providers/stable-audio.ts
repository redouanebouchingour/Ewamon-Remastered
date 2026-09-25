/**
 * Stability AI Stable Audio 2.5 — the provider `.design/audio-bible.md` §9 recommends. Needs the user's key in
 * `EWA_AUDIO_API_KEY`; nothing here has a default key, and no test calls the network (tests inject `fetch`).
 *
 * Documented API (platform.stability.ai/docs/api-reference, checked 2026-09-25):
 *   POST https://api.stability.ai/v2beta/audio/stable-audio-2/text-to-audio
 *   headers  authorization: Bearer <key>, accept: audio/* (raw bytes; application/json returns base64)
 *   body     multipart/form-data: prompt (≤ 10 000 chars), duration (1–190 s, default 190 — always sent),
 *            seed (0–4 294 967 294, 0 = random), steps (4–8 for 2.5), cfg_scale (1–25), model ('stable-audio-2.5';
 *            the endpoint defaults to 'stable-audio-2', so it is always sent), output_format ('wav' | 'mp3')
 *   returns  44.1 kHz stereo WAV bytes; 429 above 150 requests / 10 s; 20 credits ($0.20) per success
 * No negative prompt, loop flag or instrumental switch exists; the manifest's `negative` is kept in the request
 * hash but not sent, and `process` resamples to 48 kHz and finds the loop itself.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { AudioProvider, GenerationJob } from '../provider.js';
import { API_KEY_ENV, ProviderError } from '../provider.js';

export const STABLE_AUDIO_ENDPOINT = 'https://api.stability.ai/v2beta/audio/stable-audio-2/text-to-audio';
export const STABLE_AUDIO_MODEL = 'stable-audio-2.5';
export const STABLE_AUDIO_MIN_SEC = 1;
export const STABLE_AUDIO_MAX_SEC = 190;
const SEED_MAX = 4_294_967_294;

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: FormData; signal: AbortSignal }) => Promise<{
  status: number;
  ok: boolean;
  headers: { get(name: string): string | null };
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
}>;

export interface StableAudioOptions {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly fetch?: FetchLike;
  readonly endpoint?: string;
  readonly model?: string;
  readonly steps?: number;
  readonly cfgScale?: number;
  /** backoff base in ms for 429/5xx (1 s, 2 s, 4 s by default) */
  readonly backoffMs?: number;
  readonly sleep?: (ms: number) => Promise<void>;
}

/** Map a manifest uint32 seed into the provider's 1..4 294 967 294 (0 would mean "random"). */
export function providerSeed(seed: number): number {
  return 1 + ((seed >>> 0) % SEED_MAX);
}

/** Clamp to the provider's duration window; process trims sfx back to the requested length. */
export function providerDuration(sec: number): number {
  return Math.min(STABLE_AUDIO_MAX_SEC, Math.max(STABLE_AUDIO_MIN_SEC, Math.round(sec * 1000) / 1000));
}

/** The provider prompt: the manifest text, plus bpm and key when the manifest carries them and the text does not. */
export function providerPrompt(job: GenerationJob): string {
  const { text, bpm, key } = job.prompt;
  const extra: string[] = [];
  if (bpm !== undefined && !text.includes(`${bpm} BPM`) && !text.includes(`${bpm} bpm`)) extra.push(`${bpm} BPM`);
  if (key !== undefined && !text.toLowerCase().includes(key.toLowerCase())) extra.push(key);
  extra.push(job.kind === 'sfx' || job.kind === 'ui' ? 'isolated sound effect, no music' : 'instrumental');
  return `${text}${text.endsWith('.') ? '' : '.'} ${extra.join(', ')}.`;
}

export function buildForm(job: GenerationJob, model: string, steps: number, cfgScale: number): FormData {
  const form = new FormData();
  form.set('prompt', providerPrompt(job));
  form.set('duration', String(providerDuration(job.prompt.durationSec)));
  form.set('seed', String(providerSeed(job.prompt.seed)));
  form.set('steps', String(steps));
  form.set('cfg_scale', String(cfgScale));
  form.set('model', model);
  form.set('output_format', 'wav');
  return form;
}

export class StableAudioProvider implements AudioProvider {
  readonly name = 'stable-audio';
  readonly supports = { seed: true, bpm: false, maxDurationSec: STABLE_AUDIO_MAX_SEC } as const;
  private readonly env: Readonly<Record<string, string | undefined>>;
  private readonly fetchImpl: FetchLike;
  private readonly endpoint: string;
  private readonly model: string;
  private readonly steps: number;
  private readonly cfgScale: number;
  private readonly backoffMs: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(opts: StableAudioOptions = {}) {
    this.env = opts.env ?? process.env;
    this.fetchImpl = opts.fetch ?? (globalThis.fetch as unknown as FetchLike);
    this.endpoint = opts.endpoint ?? STABLE_AUDIO_ENDPOINT;
    this.model = opts.model ?? STABLE_AUDIO_MODEL;
    this.steps = opts.steps ?? 8;
    this.cfgScale = opts.cfgScale ?? 1;
    this.backoffMs = opts.backoffMs ?? 1000;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  configured(): boolean {
    const k = this.env[API_KEY_ENV];
    return typeof k === 'string' && k.trim().length > 0;
  }

  async generate(job: GenerationJob, signal: AbortSignal): Promise<void> {
    const key = this.env[API_KEY_ENV];
    if (typeof key !== 'string' || key.trim().length === 0) throw new ProviderError(0, `stable-audio: ${API_KEY_ENV} is not set`);
    let lastErr = '';
    for (let attempt = 0; attempt <= 3; attempt++) {
      if (signal.aborted) throw new Error('stable-audio: aborted');
      const res = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        headers: { authorization: `Bearer ${key.trim()}`, accept: 'audio/*' },
        body: buildForm(job, this.model, this.steps, this.cfgScale),
        signal,
      });
      if (res.ok) {
        const bytes = new Uint8Array(await res.arrayBuffer());
        const riff = bytes.byteLength > 12 && String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF';
        if (!riff) throw new ProviderError(res.status, `stable-audio: ${job.id}: response is not a WAV (${bytes.byteLength} bytes, content-type ${res.headers.get('content-type') ?? '?'})`);
        const finish = res.headers.get('finish-reason');
        if (finish !== null && finish !== 'SUCCESS') throw new ProviderError(res.status, `stable-audio: ${job.id}: finish-reason ${finish}`);
        mkdirSync(path.dirname(job.outWav), { recursive: true });
        writeFileSync(job.outWav, bytes);
        return;
      }
      const body = (await res.text().catch(() => '')).slice(0, 400);
      lastErr = `HTTP ${res.status}: ${body}`;
      if (res.status === 429 || res.status >= 500) {
        if (attempt < 3) await this.sleep(this.backoffMs * 2 ** attempt);
        continue;
      }
      throw new ProviderError(res.status, `stable-audio: ${job.id}: ${lastErr}`);
    }
    throw new ProviderError(0, `stable-audio: ${job.id}: gave up after 3 retries (${lastErr})`);
  }
}
