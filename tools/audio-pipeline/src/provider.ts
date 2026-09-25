/**
 * SPEC §40.4.2 — the provider adapter. `GenerationJob` and `AudioProvider` are verbatim; `ProviderPricing` is an
 * addition so the key-less `plan` can price the job list from the provider's published rate card.
 */
import type { AudioKind, AudioPrompt } from './schema.js';

export interface GenerationJob {
  readonly id: string;
  readonly kind: AudioKind;
  readonly prompt: AudioPrompt;
  readonly outWav: string;
  readonly requestHash: string;
}

export interface AudioProvider {
  readonly name: string; // e.g. 'elevenlabs' — chosen in .design/audio-bible.md §9
  readonly supports: { readonly seed: boolean; readonly bpm: boolean; readonly maxDurationSec: number };
  /** Reads its API key from process.env[envVar]; returns false (never throws) when it is unset. */
  configured(): boolean;
  /** Generates one WAV (48 kHz, stereo for stems/ambience, mono for sfx). Retries 3× with backoff on 429/5xx; throws on 4xx. */
  generate(job: GenerationJob, signal: AbortSignal): Promise<void>;
}

/** The environment variable every adapter reads (PLAN.md open dependency 1). Never a default, never logged. */
export const API_KEY_ENV = 'EWA_AUDIO_API_KEY';

/** List-price model for `plan`'s estimate. Amounts are USD at the plan tier named in `basis`. */
export interface ProviderPricing {
  readonly provider: string;
  readonly currency: 'USD';
  /** Human-readable source of the numbers (rate card + date checked). */
  readonly basis: string;
  /** Cost of one job, from its kind and requested seconds. */
  costOf(kind: AudioKind, durationSec: number): number;
}

/** Thrown for a non-retryable provider response (4xx other than 429). Carries no request headers. */
export class ProviderError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
