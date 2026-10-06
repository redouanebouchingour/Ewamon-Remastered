/**
 * Phase E4 (`40-pipelines.md` §40.4.8): the AudioDirector with a fake AudioContext — a theme whose layers were
 * derived from its base track starts all four stems together; a derived layer is never played without its base;
 * a theme that ships fewer than four layers starts what exists instead of throwing.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAudioDirector } from '../src/audio/AudioDirector';
import type { AudioManifest, StemRef } from '../src/audio/manifest';

interface FakeSource { buffer: { id: string } | null; started: number | null; connect(): unknown; start(at: number): void; stop(): void; disconnect(): void }

function fakeContext(): { ctx: AudioContext; sources: FakeSource[] } {
  const sources: FakeSource[] = [];
  const param = () => ({ value: 0, cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime() {} });
  const node = () => {
    const n = { gain: param(), frequency: param(), Q: param(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param(), type: '', buffer: null as unknown, connect: (x: unknown) => x, disconnect() {} };
    return n;
  };
  const ctx = {
    currentTime: 0,
    sampleRate: 48000,
    state: 'running',
    destination: {},
    listener: {},
    resume: () => Promise.resolve(),
    suspend: () => Promise.resolve(),
    close: () => Promise.resolve(),
    createGain: node,
    createDynamicsCompressor: node,
    createBiquadFilter: node,
    createConvolver: node,
    createBuffer: (_c: number, len: number) => ({ getChannelData: () => new Float32Array(len), duration: len / 48000 }),
    createBufferSource: () => {
      const s: FakeSource = { buffer: null, started: null, connect: (x: unknown) => x, start(at: number) { this.started = at; }, stop() {}, disconnect() {} };
      sources.push(s);
      return s;
    },
    decodeAudioData: (buf: ArrayBuffer) => Promise.resolve({ id: new TextDecoder().decode(buf), duration: 20 }),
  };
  return { ctx: ctx as unknown as AudioContext, sources };
}

const stem = (name: string): StemRef => ({ url: `/audio/${name}.webm`, urlFallback: `/audio/${name}.m4a`, durationSec: 20, bytes: 1, hash: '0'.repeat(64), loopStartSec: 0.05, loopEndSec: 19.25, lufs: -16 });

function manifest(themes: AudioManifest['themes']): AudioManifest {
  return { version: 1, builtAt: '2026-10-06T00:00:00Z', themes, sfx: {}, ambience: {}, zoneThemes: {} };
}

/** fetch that serves `/audio/<name>.webm` as the bytes of `<name>`, and 404s the urls in `fail`. */
function stubFetch(fail: readonly string[] = []): void {
  vi.stubGlobal('fetch', (url: string) =>
    Promise.resolve(fail.includes(url) ? { ok: false } : { ok: true, arrayBuffer: () => Promise.resolve(new TextEncoder().encode(url.replace(/^\/audio\/|\.webm$/g, '')).buffer) }),
  );
}

async function startTheme(m: AudioManifest, theme: string): Promise<FakeSource[]> {
  const { ctx, sources } = fakeContext();
  const d = createAudioDirector({ createContext: () => ctx });
  await d.init(m);
  d.setTheme(theme, 0);
  const listeners = new Map<string, () => void>();
  d.armOnGesture({ addEventListener: (t: string, f: () => void) => listeners.set(t, f), removeEventListener: (t: string) => listeners.delete(t) } as unknown as Window);
  listeners.get('pointerdown')!();
  for (let i = 0; i < 10; i++) await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
  return sources.filter((s) => s.started !== null);
}

afterEach(() => vi.unstubAllGlobals());

describe('AudioDirector stems (Phase E4)', () => {
  it('starts all four layers of a derived theme together', async () => {
    stubFetch();
    const started = await startTheme(manifest({ grove: { bpm: 96, derived: ['threat', 'biome', 'night'], stems: { base: stem('base'), threat: stem('threat'), biome: stem('biome'), night: stem('night') } } }), 'grove');
    expect(started.map((s) => s.buffer!.id).sort()).toEqual(['base', 'biome', 'night', 'threat']);
    expect(new Set(started.map((s) => s.started)).size).toBe(1);
  });

  it('never plays a derived layer without its base', async () => {
    stubFetch(['/audio/base.webm']);
    const started = await startTheme(manifest({ grove: { bpm: 96, derived: ['threat', 'biome', 'night'], stems: { base: stem('base'), threat: stem('threat'), biome: stem('biome'), night: stem('night') } } }), 'grove');
    expect(started).toEqual([]);
  });

  it('a generated (non-derived) theme still plays the layers that loaded when base fails', async () => {
    stubFetch(['/audio/base.webm']);
    const started = await startTheme(manifest({ grove: { bpm: 96, stems: { base: stem('base'), threat: stem('threat'), biome: stem('biome'), night: stem('night') } } }), 'grove');
    expect(started.map((s) => s.buffer!.id).sort()).toEqual(['biome', 'night', 'threat']);
  });

  it('a theme with fewer than four layers starts what exists', async () => {
    stubFetch();
    const partial = { bpm: 96, stems: { base: stem('base') } } as unknown as AudioManifest['themes'][string];
    const started = await startTheme(manifest({ grove: partial }), 'grove');
    expect(started.map((s) => s.buffer!.id)).toEqual(['base']);
  });
});
