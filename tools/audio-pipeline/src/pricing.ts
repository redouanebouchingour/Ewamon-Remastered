/**
 * Published rate cards, checked 2026-09-25 (sources in `.design/audio-bible.md` §9). `plan` prices the job list
 * with the selected provider's card; no key and no network are involved. The comparison cards exist so the
 * bible's cost table is computed, not typed.
 */
import type { ProviderPricing } from './provider.js';

/** Stability AI Stable Audio 2.5: 20 credits per successful generation at any duration 1–190 s; 1 credit = $0.01. */
export const STABLE_AUDIO_PRICING: ProviderPricing = {
  provider: 'stable-audio',
  currency: 'USD',
  basis: 'Stability AI platform pricing, Stable Audio 2.5 text-to-audio: 20 credits ($0.20) per generation, flat for 1–190 s (checked 2026-09-25)',
  costOf: () => 0.2,
};

/** ElevenLabs: Music $0.15 per generated minute (prompt length); Sound Effects $0.12 per generated minute (API rate card). */
export const ELEVENLABS_PRICING: ProviderPricing = {
  provider: 'elevenlabs',
  currency: 'USD',
  basis: 'ElevenLabs API pricing: Music $0.15/min, Sound Effects $0.12/min, min 0.5 s per effect (checked 2026-09-25); music licence excludes multi-platform monetised games below Enterprise',
  costOf: (kind, sec) => (kind === 'stem' ? (Math.max(3, sec) / 60) * 0.15 : (Math.max(0.5, sec) / 60) * 0.12),
};

/** Google Lyria 2 (Vertex AI): $0.06 per fixed 30 s clip; a longer request is tiled from ceil(sec / 30) clips. */
export const LYRIA_PRICING: ProviderPricing = {
  provider: 'lyria',
  currency: 'USD',
  basis: 'Vertex AI Lyria 2 (lyria-002): $0.06 per 30 s 48 kHz clip (checked 2026-09-25); fixed length, no loop control',
  costOf: (_kind, sec) => Math.ceil(sec / 30) * 0.06,
};

export const PRICING: Readonly<Record<string, ProviderPricing>> = {
  'stable-audio': STABLE_AUDIO_PRICING,
  elevenlabs: ELEVENLABS_PRICING,
  lyria: LYRIA_PRICING,
};
