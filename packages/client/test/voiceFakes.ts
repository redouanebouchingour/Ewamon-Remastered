/**
 * Fakes for voice talk (LLM feature 10): jsdom has neither `speechSynthesis` nor `SpeechRecognition`.
 */
import type { Recognizer } from '../src/voice/listen';
import type { SpeechEngine, Utterance } from '../src/voice/speech';
import type { VoiceInfo } from '../src/voice/voices';

export const VOICES: readonly VoiceInfo[] = [
  { voiceURI: 'Microsoft David', name: 'Microsoft David', lang: 'en-US', localService: true },
  { voiceURI: 'Microsoft Zira', name: 'Microsoft Zira', lang: 'en-US', localService: true },
  { voiceURI: 'Microsoft Hazel', name: 'Microsoft Hazel', lang: 'en-GB', localService: true },
  { voiceURI: 'Microsoft Frank', name: 'Microsoft Frank', lang: 'nl-NL', localService: true },
  { voiceURI: 'Google US English', name: 'Google US English', lang: 'en-US', localService: false },
];

export interface FakeEngine extends SpeechEngine {
  /** every utterance handed to the engine, in order */
  readonly spoken: Utterance[];
  /** the utterance speaking now */
  current(): Utterance | null;
  /** the one speaking now reaches its end */
  finish(): void;
  /** finish everything that comes, one after another */
  drain(): void;
  cancels: number;
  setVoices(v: readonly VoiceInfo[]): void;
}

export function fakeEngine(voices: readonly VoiceInfo[] = VOICES): FakeEngine {
  let list = voices;
  let now: Utterance | null = null;
  const listeners = new Set<() => void>();
  const e: FakeEngine = {
    spoken: [],
    cancels: 0,
    voices: () => list,
    speak(u) {
      e.spoken.push(u);
      now = u;
    },
    cancel() {
      e.cancels++;
      const u = now;
      now = null;
      u?.onDone();
    },
    onVoices(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    current: () => now,
    finish() {
      const u = now;
      now = null;
      u?.onDone();
    },
    drain() {
      for (let i = 0; i < 100 && now !== null; i++) e.finish();
    },
    setVoices(v) {
      list = v;
      for (const cb of listeners) cb();
    },
  };
  return e;
}

export interface FakeRecognizer extends Recognizer {
  started: number;
  stopped: number;
  aborted: number;
  /** the browser hears words (the whole transcript so far) */
  hear(text: string): void;
  fail(code: string): void;
  end(): void;
}

export function fakeRecognizer(o: { readonly throwOnStart?: boolean } = {}): FakeRecognizer {
  const r: FakeRecognizer = {
    started: 0,
    stopped: 0,
    aborted: 0,
    onresult: null,
    onerror: null,
    onend: null,
    start() {
      if (o.throwOnStart === true) throw new Error('not allowed to start');
      r.started++;
    },
    stop() {
      r.stopped++;
    },
    abort() {
      r.aborted++;
    },
    hear: (t) => r.onresult?.(t),
    fail: (c) => r.onerror?.(c),
    end: () => r.onend?.(),
  };
  return r;
}
