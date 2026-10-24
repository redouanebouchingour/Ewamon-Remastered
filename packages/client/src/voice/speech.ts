/**
 * Voice talk (LLM feature 10): the browser's speech synthesis behind a small interface, so the speaker (speaker.ts)
 * runs the same against the real `speechSynthesis` and a fake in tests (jsdom has neither speech API).
 *
 * `browserSpeech()` is null where the browser has no `speechSynthesis`. Its voice list arrives late in Chrome (empty
 * until `voiceschanged`), so it is read on every call. The engine gets one utterance at a time from the speaker, which
 * keeps its own queue: Chrome's queue cannot drop a single waiting line, and it stalls on very long utterances.
 */
import type { VoiceInfo } from './voices';

export interface Utterance {
  readonly text: string;
  /** null: the browser's default voice */
  readonly voiceURI: string | null;
  readonly lang: string;
  readonly pitch: number;
  readonly rate: number;
  /** 0..1 */
  readonly volume: number;
  /** spoken to the end, or failed / cancelled (called once) */
  readonly onDone: () => void;
}

export interface SpeechEngine {
  voices(): readonly VoiceInfo[];
  speak(u: Utterance): void;
  /** stops what is speaking now (its `onDone` still fires) */
  cancel(): void;
  /** the voice list changed (Chrome fills it after load); returns the unsubscribe */
  onVoices(cb: () => void): () => void;
}

/** The real `speechSynthesis`, or null when the browser has none. */
export function browserSpeech(): SpeechEngine | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return null;
  const synth = window.speechSynthesis;
  const list = (): SpeechSynthesisVoice[] => {
    try {
      return synth.getVoices();
    } catch (_e) {
      return [];
    }
  };
  return {
    voices: () => list().map((v) => ({ voiceURI: v.voiceURI, name: v.name, lang: v.lang, localService: v.localService })),
    speak(u) {
      // only the voice asked for: never the browser's default, which may be a network voice
      const v = u.voiceURI === null ? undefined : list().find((x) => x.voiceURI === u.voiceURI);
      if (v === undefined) return u.onDone();
      const ut = new SpeechSynthesisUtterance(u.text);
      ut.voice = v;
      ut.lang = u.lang;
      ut.pitch = u.pitch;
      ut.rate = u.rate;
      ut.volume = u.volume;
      let done = false;
      const finish = (): void => {
        if (done) return;
        done = true;
        u.onDone();
      };
      ut.onend = finish;
      ut.onerror = finish;
      synth.speak(ut);
    },
    cancel() {
      synth.cancel();
    },
    onVoices(cb) {
      synth.addEventListener('voiceschanged', cb);
      return () => synth.removeEventListener('voiceschanged', cb);
    },
  };
}
