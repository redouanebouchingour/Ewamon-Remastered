/**
 * SPEC §20.7 — AudioDirector: the WebAudio graph (§20.7.1), the mixer (§20.7.2) and the director surface (§20.7.3).
 *
 *   stems → stem gain → music ──────────────────────────────┐
 *   sfx → voice gain → HRTF panner ─┬→ sfx ─────────────────┼→ master → compressor → destination
 *                                   └→ reverb send → convolver(zone IR) → sfx
 *   ui → ui ────────────────────────────────────────────────┘
 *
 * The context is created on the first user gesture (pointerdown / keydown, once) and resumed; before that every
 * `play()` is a no-op. SILENT PATH: with no manifest (`public/audio/manifest.json` absent — the pipeline has not run)
 * the director keeps every piece of state (theme, threat, night, duck, bus gains, reverb zone) and answers every call,
 * but fetches and plays nothing. Stems loop by double-scheduling two sources 200 ms ahead of the loop point (never
 * `loop = true`), all four of a theme started at the same `currentTime + 0.05`. Voices: 24, per-id cooldown 40 ms,
 * per-id concurrency ≤ 4, the quietest (farthest) voice is stolen. `step()` runs per fixed step (ramps are WebAudio
 * automation; step does voice GC and loop scheduling) and allocates nothing.
 */
import type { AudioManifest, StemRef } from './manifest';
import { MIXER, dbToGain, nightGain, perceptual } from './mixer';

export type Bus = 'master' | 'music' | 'sfx' | 'ui';
export type ReverbKind = 'outdoor' | 'plaza' | 'interior' | 'cave';
export interface Vec3 { readonly x: number; readonly y: number; readonly z: number }

export interface AudioDirector {
  init(manifest: AudioManifest | null): Promise<void>;
  setTheme(themeId: string, crossfadeMs: number): void;
  setThreat(on: boolean): void;
  setNight(t01: number): void;
  setHarvested(on: boolean): void;
  duck(on: boolean): void;
  play(sfxId: string, at: Vec3 | null): void;
  setListener(x: number, y: number, z: number, fx: number, fy: number, fz: number): void;
  setBus(bus: Bus, gain01: number): void;
  setReverbZone(kind: ReverbKind): void;
  step(): void;
  suspend(): void;
  resume(): void;
  // ---- additions ----
  /** Arms context creation on the first pointerdown / keydown of `target`. */
  armOnGesture(target: Pick<Window, 'addEventListener' | 'removeEventListener'>): void;
  /** Theme id of a zone (manifest.zoneThemes) or the biome name. */
  themeFor(zoneId: string, biome: string): string;
  readonly state: DirectorState;
  dispose(): void;
}

export interface DirectorState {
  readonly silent: boolean;
  readonly contextReady: boolean;
  readonly theme: string | null;
  readonly threat: boolean;
  readonly night: number;
  readonly harvested: boolean;
  readonly ducked: boolean;
  readonly reverb: ReverbKind;
  readonly buses: Readonly<Record<Bus, number>>;
  readonly voices: number;
  readonly played: number;
  readonly dropped: number;
}

interface Voice { id: string; src: AudioBufferSourceNode | null; gain: GainNode | null; panner: PannerNode | null; endsAt: number; dist: number; live: boolean; startedAt: number }

interface StemPlayer {
  readonly gain: GainNode;
  buffer: AudioBuffer | null;
  loopStart: number;
  loopEnd: number;
  /** context time the current iteration's loop end falls on */
  nextAt: number;
  scheduled: boolean;
}

const STEMS = ['base', 'threat', 'biome', 'night'] as const;
type StemName = (typeof STEMS)[number];

export function createAudioDirector(opts: { readonly createContext?: () => AudioContext | null } = {}): AudioDirector {
  let manifest: AudioManifest | null = null;
  let ctx: AudioContext | null = null;
  let armed: { target: Pick<Window, 'addEventListener' | 'removeEventListener'>; fn: () => void } | null = null;
  // graph
  let master: GainNode | null = null;
  let music: GainNode | null = null;
  let sfxBus: GainNode | null = null;
  let uiBus: GainNode | null = null;
  let reverbSend: GainNode | null = null;
  let convolver: ConvolverNode | null = null;
  let duckGain: GainNode | null = null;
  let lowpass: BiquadFilterNode | null = null;
  const irs = new Map<ReverbKind, AudioBuffer>();
  const stems = new Map<StemName, StemPlayer>();
  const buffers = new Map<string, Promise<AudioBuffer | null>>();
  const decoded = new Map<string, AudioBuffer>();
  const lastPlayed = new Map<string, number>();
  const voices: Voice[] = [];
  for (let i = 0; i < MIXER.voices; i++) voices.push({ id: '', src: null, gain: null, panner: null, endsAt: 0, dist: 0, live: false, startedAt: 0 });
  const roundRobin = new Map<string, number>();
  let useFallback = false;
  let listenerX = 0;
  let listenerZ = 0;
  let listenerY = 0;

  const st = {
    silent: true, contextReady: false, theme: null as string | null, threat: false, night: 0, harvested: false, ducked: false,
    reverb: 'outdoor' as ReverbKind, buses: { master: 1, music: 1, sfx: 1, ui: 1 } as Record<Bus, number>, voices: 0, played: 0, dropped: 0,
  };

  const now = (): number => (ctx !== null ? ctx.currentTime : 0);
  const ramp = (p: AudioParam, v: number, ms: number): void => {
    if (ctx === null) return;
    const t = ctx.currentTime;
    p.cancelScheduledValues(t);
    p.setValueAtTime(p.value, t);
    p.linearRampToValueAtTime(v, t + Math.max(0.001, ms / 1000));
  };

  function makeIr(c: AudioContext, seconds: number): AudioBuffer {
    const len = Math.max(1, Math.floor(c.sampleRate * seconds));
    const buf = c.createBuffer(2, len, c.sampleRate);
    let seed = 0x9e3779b9;
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        seed = (seed * 1664525 + 1013904223) >>> 0; // deterministic LCG white noise
        const n = (seed / 0xffffffff) * 2 - 1;
        d[i] = n * Math.exp((-6.9 * i) / len); // −60 dB at the end
      }
    }
    return buf;
  }

  function buildGraph(c: AudioContext): void {
    master = c.createGain();
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = MIXER.compressor.threshold;
    comp.knee.value = MIXER.compressor.knee;
    comp.ratio.value = MIXER.compressor.ratio;
    comp.attack.value = MIXER.compressor.attack;
    comp.release.value = MIXER.compressor.release;
    master.connect(comp).connect(c.destination);
    duckGain = c.createGain();
    music = c.createGain();
    lowpass = c.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 22050;
    lowpass.Q.value = MIXER.harvestLowpass.q;
    lowpass.connect(music).connect(duckGain).connect(master);
    sfxBus = c.createGain();
    sfxBus.connect(master);
    uiBus = c.createGain();
    uiBus.connect(master);
    reverbSend = c.createGain();
    convolver = c.createConvolver();
    reverbSend.connect(convolver).connect(sfxBus);
    for (const k of ['outdoor', 'plaza', 'interior', 'cave'] as const) irs.set(k, makeIr(c, MIXER.irSeconds[k]));
    for (const name of STEMS) {
      const g = c.createGain();
      g.gain.value = 0;
      g.connect(lowpass);
      stems.set(name, { gain: g, buffer: null, loopStart: 0, loopEnd: 0, nextAt: 0, scheduled: false });
    }
    applyBuses();
    applyReverb();
    applyHarvest();
    applyStemTargets(0);
  }

  function applyBuses(): void {
    if (ctx === null) return;
    master!.gain.value = MIXER.master * perceptual(st.buses.master);
    music!.gain.value = MIXER.music * perceptual(st.buses.music);
    sfxBus!.gain.value = MIXER.sfx * perceptual(st.buses.sfx);
    uiBus!.gain.value = MIXER.ui * perceptual(st.buses.ui);
  }
  function applyReverb(): void {
    if (ctx === null) return;
    reverbSend!.gain.value = MIXER.reverbSend[st.reverb];
    convolver!.buffer = irs.get(st.reverb) ?? null;
  }
  function applyHarvest(): void {
    if (ctx === null) return;
    ramp(lowpass!.frequency, st.harvested ? MIXER.harvestLowpass.hz : 22050, 400);
  }
  function stemTarget(name: StemName): number {
    switch (name) {
      case 'base': return 1;
      case 'biome': return 1;
      case 'threat': return st.threat ? 1 : 0;
      case 'night': return st.harvested ? 0 : nightGain(st.night);
    }
  }
  function applyStemTargets(ms: number): void {
    if (ctx === null) return;
    for (const name of STEMS) ramp(stems.get(name)!.gain.gain, stemTarget(name), ms);
  }

  function ensureContext(): void {
    if (ctx !== null) return;
    const make = opts.createContext ?? (() => (typeof AudioContext !== 'undefined' ? new AudioContext() : null));
    ctx = make();
    if (ctx === null) return;
    buildGraph(ctx);
    st.contextReady = true;
    void ctx.resume().catch(() => undefined);
    if (typeof document !== 'undefined') {
      const probe = document.createElement('audio');
      useFallback = probe.canPlayType('audio/webm; codecs=opus') === '';
    }
    if (st.theme !== null) startTheme(st.theme);
  }

  function fetchBuffer(url: string): Promise<AudioBuffer | null> {
    const hit = buffers.get(url);
    if (hit !== undefined) return hit;
    const p = (async () => {
      if (ctx === null) return null;
      try {
        const res = await fetch(url, { priority: 'low' } as RequestInit);
        if (!res.ok) return null;
        const buf = await ctx.decodeAudioData(await res.arrayBuffer());
        decoded.set(url, buf);
        return buf;
      } catch (_e) {
        return null;
      }
    })();
    buffers.set(url, p);
    return p;
  }

  const urlOf = (r: { readonly url: string; readonly urlFallback: string }): string => (useFallback ? r.urlFallback : r.url);

  function startTheme(themeId: string): void {
    if (ctx === null || manifest === null) return;
    const theme = manifest.themes[themeId];
    if (theme === undefined) return;
    const refs: Record<StemName, StemRef> = theme.stems;
    void Promise.all(STEMS.map((n) => fetchBuffer(urlOf(refs[n])))).then((bufs) => {
      if (ctx === null || st.theme !== themeId) return;
      const at = ctx.currentTime + MIXER.startOffsetS;
      STEMS.forEach((n, i) => {
        const p = stems.get(n)!;
        p.buffer = bufs[i] ?? null;
        p.loopStart = refs[n].loopStartSec;
        p.loopEnd = refs[n].loopEndSec > refs[n].loopStartSec ? refs[n].loopEndSec : (p.buffer?.duration ?? 0);
        p.scheduled = false;
        if (p.buffer !== null) {
          const src = ctx!.createBufferSource();
          src.buffer = p.buffer;
          src.connect(p.gain);
          src.start(at, 0, p.loopEnd);
          p.nextAt = at + p.loopEnd;
        }
      });
    });
  }

  /** Double-scheduling: the next iteration from loopStart is queued 200 ms before the current one ends. */
  function scheduleLoops(): void {
    if (ctx === null) return;
    const t = ctx.currentTime;
    for (const name of STEMS) {
      const p = stems.get(name)!;
      if (p.buffer === null || p.nextAt <= 0) continue;
      if (p.nextAt - t > MIXER.scheduleAheadS) continue;
      const src = ctx.createBufferSource(); // alloc-ok: one source per stem per 16–64 s loop
      src.buffer = p.buffer;
      src.connect(p.gain);
      const span = p.loopEnd - p.loopStart;
      if (!(span > 0)) continue;
      src.start(p.nextAt, p.loopStart, span);
      p.nextAt += span;
    }
  }

  function freeVoice(v: Voice): void {
    try {
      v.src?.stop();
    } catch (_e) {
      // already stopped
    }
    v.src?.disconnect();
    v.gain?.disconnect();
    v.panner?.disconnect();
    v.src = null;
    v.gain = null;
    v.panner = null;
    v.live = false;
    v.id = '';
  }

  const director: AudioDirector = {
    get state() {
      return st;
    },

    async init(m) {
      manifest = m;
      st.silent = m === null;
      if (m !== null && ctx !== null) {
        // ui clips decode eagerly; music stems stream-decode per theme
        for (const [id, s] of Object.entries(m.sfx)) if (s.bus === 'ui') for (const c of s.clips) void fetchBuffer(urlOf(c)).then(() => id);
        if (st.theme !== null) startTheme(st.theme);
      }
    },

    armOnGesture(target) {
      if (armed !== null || ctx !== null) return;
      const fn = (): void => {
        target.removeEventListener('pointerdown', fn);
        target.removeEventListener('keydown', fn);
        armed = null;
        ensureContext();
        if (manifest !== null) void director.init(manifest);
      };
      armed = { target, fn };
      target.addEventListener('pointerdown', fn);
      target.addEventListener('keydown', fn);
    },

    themeFor(zoneId, biome) {
      return manifest?.zoneThemes[zoneId] ?? biome;
    },

    setTheme(themeId, crossfadeMs) {
      if (st.theme === themeId) return;
      st.theme = themeId;
      if (ctx === null || manifest === null) return;
      // fade the running stems out, then start the new theme's stems together
      for (const name of STEMS) ramp(stems.get(name)!.gain.gain, 0, crossfadeMs);
      setTimeout(() => {
        if (st.theme !== themeId) return;
        startTheme(themeId);
        applyStemTargets(crossfadeMs);
      }, crossfadeMs);
    },

    setThreat(on) {
      if (st.threat === on) return;
      st.threat = on;
      if (ctx !== null) ramp(stems.get('threat')!.gain.gain, stemTarget('threat'), MIXER.threatRampMs);
    },

    setNight(t01) {
      st.night = t01;
      if (ctx === null) return;
      const g = stems.get('night')!.gain.gain;
      const v = stemTarget('night');
      if (Math.abs(g.value - v) > 0.002) g.setTargetAtTime(v, ctx.currentTime, 0.5);
    },

    setHarvested(on) {
      if (st.harvested === on) return;
      st.harvested = on;
      applyHarvest();
      if (ctx !== null) ramp(stems.get('night')!.gain.gain, stemTarget('night'), 400);
    },

    duck(on) {
      if (st.ducked === on) return;
      st.ducked = on;
      if (ctx === null) return;
      ramp(duckGain!.gain, on ? dbToGain(MIXER.duck.db) : 1, on ? MIXER.duck.attackMs : MIXER.duck.releaseMs);
    },

    play(sfxId, at) {
      if (ctx === null || manifest === null) return; // before the first gesture / silent path: a no-op
      const def = manifest.sfx[sfxId];
      if (def === undefined || def.clips.length === 0) return;
      const t = performance.now();
      const last = lastPlayed.get(sfxId) ?? -1e9;
      if (t - last < MIXER.perIdCooldownMs) return;
      let same = 0;
      for (const v of voices) if (v.live && v.id === sfxId) same++;
      if (same >= Math.min(MIXER.perIdConcurrency, def.maxConcurrent > 0 ? def.maxConcurrent : MIXER.perIdConcurrency)) return;
      const rr = (roundRobin.get(sfxId) ?? 0) % def.clips.length;
      roundRobin.set(sfxId, rr + 1);
      const buf = decoded.get(urlOf(def.clips[rr]!));
      if (buf === undefined) {
        void fetchBuffer(urlOf(def.clips[rr]!));
        st.dropped++;
        return;
      }
      const dist = at === null ? 0 : Math.hypot(at.x - listenerX, at.y - listenerY, at.z - listenerZ);
      // free voice, else steal the quietest (farthest)
      let slot: Voice | null = null;
      for (const v of voices) if (!v.live) { slot = v; break; }
      if (slot === null) {
        for (const v of voices) if (slot === null || v.dist > slot.dist) slot = v;
        if (slot === null || slot.dist < dist) {
          st.dropped++;
          return;
        }
        freeVoice(slot);
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const gain = ctx.createGain();
      gain.gain.value = dbToGain(def.gainDb);
      src.connect(gain);
      const bus = def.bus === 'ui' || sfxId.startsWith('ui_') ? uiBus! : sfxBus!;
      if (at !== null && bus === sfxBus) {
        const p = ctx.createPanner();
        p.panningModel = MIXER.panner.panningModel;
        p.distanceModel = MIXER.panner.distanceModel;
        p.refDistance = MIXER.panner.refDistance;
        p.maxDistance = MIXER.panner.maxDistance;
        p.rolloffFactor = MIXER.panner.rolloffFactor;
        p.positionX.value = at.x;
        p.positionY.value = at.y;
        p.positionZ.value = at.z;
        gain.connect(p);
        p.connect(bus);
        p.connect(reverbSend!);
        slot.panner = p;
      } else {
        gain.connect(bus);
      }
      src.start();
      slot.id = sfxId;
      slot.src = src;
      slot.gain = gain;
      slot.dist = dist;
      slot.live = true;
      slot.startedAt = now();
      slot.endsAt = now() + buf.duration;
      lastPlayed.set(sfxId, t);
      st.played++;
    },

    setListener(x, y, z, fx, fy, fz) {
      // an AudioParam throws on a non-finite value; a camera that has not been posed yet keeps the last listener
      if (!Number.isFinite(x + y + z + fx + fy + fz)) return;
      listenerX = x;
      listenerY = y;
      listenerZ = z;
      if (ctx === null) return;
      const l = ctx.listener;
      if (l.positionX !== undefined) {
        l.positionX.value = x; l.positionY.value = y; l.positionZ.value = z;
        l.forwardX.value = fx; l.forwardY.value = fy; l.forwardZ.value = fz;
        l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
      }
    },

    setBus(bus, gain01) {
      st.buses[bus] = Math.min(1, Math.max(0, gain01));
      applyBuses();
    },

    setReverbZone(kind) {
      if (st.reverb === kind) return;
      st.reverb = kind;
      applyReverb();
    },

    step() {
      if (ctx === null) return;
      const t = ctx.currentTime;
      let n = 0;
      for (let i = 0; i < voices.length; i++) {
        const v = voices[i]!;
        if (!v.live) continue;
        if (t >= v.endsAt) freeVoice(v);
        else n++;
      }
      st.voices = n;
      scheduleLoops();
    },

    suspend() {
      if (ctx !== null && ctx.state === 'running') void ctx.suspend().catch(() => undefined);
    },

    resume() {
      if (ctx !== null && ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    },

    dispose() {
      if (armed !== null) {
        armed.target.removeEventListener('pointerdown', armed.fn);
        armed.target.removeEventListener('keydown', armed.fn);
        armed = null;
      }
      for (const v of voices) if (v.live) freeVoice(v);
      if (ctx !== null) void ctx.close().catch(() => undefined);
      ctx = null;
      st.contextReady = false;
    },
  };
  return director;
}
