/** @ewa/audio-pipeline — SPEC §40.4. */
export * from './schema.js';
export * from './provider.js';
export * from './jobs.js';
export * from './plan.js';
export * from './generate.js';
export * from './process.js';
export * from './loop.js';
export * from './budget.js';
export * from './output-manifest.js';
export * from './pricing.js';
export { checkFfmpeg, FFMPEG_MISSING_MESSAGE, ENCODE, measureLoudness } from './ffmpeg.js';
export { createProvider, DEFAULT_PROVIDER, providerNames, StableAudioProvider } from './providers/index.js';
export { DEFAULT_PATHS, PKG_DIR, REPO_ROOT } from './paths.js';
export type { PipelinePaths } from './paths.js';
export { decodeWav, encodeWav, mixdown } from './wav.js';
export type { PcmAudio } from './wav.js';
export { synthesizePlaceholder, parseKey } from './placeholder.js';
