/**
 * Provider registry. The bible (§9) recommends Stable Audio 2.5; `EWA_AUDIO_PROVIDER` may name another adapter
 * once one exists. Adding a provider = one file implementing `AudioProvider` + one line here + a rate card in
 * `pricing.ts`. The provider name is part of every `requestHash`, so switching providers re-plans every job.
 */
import type { AudioProvider } from '../provider.js';
import type { StableAudioOptions } from './stable-audio.js';
import { StableAudioProvider } from './stable-audio.js';

export const DEFAULT_PROVIDER = 'stable-audio';

const FACTORIES: Readonly<Record<string, (opts: StableAudioOptions) => AudioProvider>> = {
  'stable-audio': (opts) => new StableAudioProvider(opts),
};

export function providerNames(): string[] {
  return Object.keys(FACTORIES).sort();
}

export function createProvider(name: string = DEFAULT_PROVIDER, opts: StableAudioOptions = {}): AudioProvider {
  const f = FACTORIES[name];
  if (f === undefined) throw new Error(`audio-pipeline: unknown provider '${name}' (known: ${providerNames().join(', ')})`);
  return f(opts);
}

export { StableAudioProvider } from './stable-audio.js';
