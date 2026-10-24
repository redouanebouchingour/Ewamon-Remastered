/**
 * Voice talk (LLM feature 10): push-to-talk through the browser's speech recognition (Web Speech `SpeechRecognition`,
 * `webkitSpeechRecognition` in Chrome). Opt-in: Settings › Audio "Speak to NPCs" is off by default, because Chrome's
 * recognition streams the microphone audio to Google's servers. Firefox has none: the mic button hides and typing is the
 * way to talk, as it always is.
 *
 * The mic opens only while the player holds the push-to-talk key (`pushToTalk`, backquote by default) or the mic
 * button; nothing ever starts it otherwise. While held, the live transcript fills the talk field (`onLive`); on
 * release the recognizer is stopped and its last words are sent as the typed line (`onSend`). A tap shorter than
 * `MIN_HOLD_MS` sends nothing; a hold longer than `MAX_HOLD_MS` is released for the player.
 *
 * The state machine (`createPushToTalk`), in states: `idle` → press → `listening` → release → `stopping` → the
 * recognizer ends → `idle` (the transcript sent). Errors: `not-allowed` / `service-not-allowed` → `denied` (the
 * button explains how to allow the mic), `audio-capture` → `nomic`, `network` → `unavailable` (Brave, or offline);
 * `no-speech` and `aborted` end quietly. Each of those can be retried by pressing again (never automatically). The
 * recognizer ending on its own while held drops nothing: the words stay in the field, unsent. `cancel` (the box closed,
 * a battle, the setting turned off) aborts and drops the transcript.
 *
 * The real recognizer wrapper (`browserRecognizer`) and the machine meet only through `Recognizer`, so tests drive
 * the machine with a fake.
 */
import { create } from 'zustand';

export const MIN_HOLD_MS = 250;
export const MAX_HOLD_MS = 20_000;
/** after a release, how long the recognizer may take to end before the words go anyway */
export const END_GRACE_MS = 2_500;
/** the recognition language (the talk is English) */
export const SPEECH_LANG = 'en-US';

export interface Recognizer {
  start(): void;
  /** stop listening and deliver the last result, then `onend` */
  stop(): void;
  /** stop at once, no result */
  abort(): void;
  /** the whole transcript so far (final and interim parts) */
  onresult: ((transcript: string) => void) | null;
  onerror: ((code: string) => void) | null;
  onend: (() => void) | null;
}

export type RecognizerFactory = () => Recognizer | null;

type RecognitionCtor = new () => {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { readonly results: ArrayLike<ArrayLike<{ readonly transcript: string }>> }) => void) | null;
  onerror: ((e: { readonly error: string }) => void) | null;
  onend: (() => void) | null;
};

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** The browser has speech recognition at all (Chrome, Edge, Safari; not Firefox). */
export function speechInputSupported(): boolean {
  return recognitionCtor() !== null;
}

/** A recognizer over the browser's `SpeechRecognition`, or null without one. */
export function browserRecognizer(): Recognizer | null {
  const Ctor = recognitionCtor();
  if (Ctor === null) return null;
  const r = new Ctor();
  r.lang = SPEECH_LANG;
  r.continuous = true;
  r.interimResults = true;
  r.maxAlternatives = 1;
  const out: Recognizer = {
    start: () => r.start(),
    stop: () => r.stop(),
    abort: () => r.abort(),
    onresult: null,
    onerror: null,
    onend: null,
  };
  r.onresult = (e) => {
    let text = '';
    for (let i = 0; i < e.results.length; i++) text += e.results[i]?.[0]?.transcript ?? '';
    out.onresult?.(text);
  };
  r.onerror = (e) => out.onerror?.(e.error);
  r.onend = () => out.onend?.();
  return out;
}

export type PttState = 'idle' | 'listening' | 'stopping' | 'denied' | 'nomic' | 'unavailable' | 'unsupported';

/** what each state's trouble means to the player (the button's note) */
export const PTT_NOTE: Readonly<Partial<Record<PttState, string>>> = {
  denied: "The microphone is blocked. Allow it in the browser's site settings, or type.",
  nomic: 'No microphone was found. Type instead.',
  unavailable: "Speech recognition is not available right now (it needs the browser's online service). Type instead.",
  unsupported: 'This browser has no speech recognition. Type instead.',
};

export interface PushToTalkOptions {
  readonly recognizer: RecognizerFactory;
  /** the transcript so far, while held */
  readonly onLive: (text: string) => void;
  /** the words to send as the typed line, on release */
  readonly onSend: (text: string) => void;
  readonly onState?: (s: PttState) => void;
  readonly now?: () => number;
  readonly setTimer?: (fn: () => void, ms: number) => () => void;
}

export interface PushToTalk {
  /** start listening (false: nothing started) */
  press(): boolean;
  /** stop listening and send what was heard */
  release(): void;
  /** stop listening, send nothing */
  cancel(): void;
  /** back to idle from any state (a new recognizer source) */
  reset(): void;
  state(): PttState;
}

const STICKY: Readonly<Record<string, PttState>> = {
  'not-allowed': 'denied',
  'service-not-allowed': 'denied',
  'audio-capture': 'nomic',
  network: 'unavailable',
  'language-not-supported': 'unavailable',
};

export function createPushToTalk(o: PushToTalkOptions): PushToTalk {
  const now = o.now ?? (() => Date.now());
  const setTimer =
    o.setTimer ??
    ((fn: () => void, ms: number) => {
      const t = setTimeout(fn, ms);
      return () => clearTimeout(t);
    });
  let st: PttState = 'idle';
  let rec: Recognizer | null = null;
  let heard = '';
  let pressedAt = 0;
  let clearTimer: (() => void) | null = null;

  const to = (s: PttState): void => {
    st = s;
    o.onState?.(s);
  };
  const stopTimer = (): void => {
    clearTimer?.();
    clearTimer = null;
  };
  const detach = (): Recognizer | null => {
    const r = rec;
    rec = null;
    stopTimer();
    if (r !== null) {
      r.onresult = null;
      r.onerror = null;
      r.onend = null;
    }
    return r;
  };
  /** the recognizer is done after a release: the words go */
  const finish = (): void => {
    detach();
    const text = heard.replace(/\s+/g, ' ').trim();
    heard = '';
    to('idle');
    if (text !== '') o.onSend(text);
  };

  const self: PushToTalk = {
    press() {
      if (st === 'listening' || st === 'stopping' || st === 'unsupported') return false;
      const r = o.recognizer();
      if (r === null) {
        to('unsupported');
        return false;
      }
      heard = '';
      rec = r;
      r.onresult = (text) => {
        if (rec !== r) return;
        heard = text;
        o.onLive(text);
      };
      r.onerror = (code) => {
        if (rec !== r) return;
        const sticky = STICKY[code];
        if (sticky === undefined) return; // no-speech, aborted: the end follows
        detach()?.abort();
        heard = '';
        to(sticky);
      };
      r.onend = () => {
        if (rec !== r) return;
        if (st === 'stopping') return finish();
        // it ended by itself while held: the words stay in the field, unsent
        detach();
        heard = '';
        to('idle');
      };
      try {
        r.start();
      } catch (_e) {
        detach();
        to('unavailable');
        return false;
      }
      pressedAt = now();
      to('listening');
      clearTimer = setTimer(() => self.release(), MAX_HOLD_MS);
      return true;
    },
    release() {
      if (st !== 'listening' || rec === null) return;
      if (now() - pressedAt < MIN_HOLD_MS) return self.cancel();
      stopTimer();
      to('stopping');
      const r = rec;
      try {
        r.stop();
      } catch (_e) {
        return finish();
      }
      clearTimer = setTimer(() => {
        if (rec === r && st === 'stopping') {
          r.abort();
          finish();
        }
      }, END_GRACE_MS);
    },
    cancel() {
      if (st !== 'listening' && st !== 'stopping') return;
      detach()?.abort();
      heard = '';
      to('idle');
    },
    reset() {
      detach()?.abort();
      heard = '';
      to('idle');
    },
    state: () => st,
  };
  return self;
}

// ---- the one push-to-talk of the open talk box ----------------------------------------------------------------------

export interface PttTarget {
  /** the transcript so far goes into the talk field */
  readonly onLive: (text: string) => void;
  /** the words, as the typed line */
  readonly onSend: (text: string) => void;
  /** listening started (the box opens its field, the voices hush) */
  readonly onStart?: () => void;
}

export const usePttStore = create<{ readonly state: PttState }>()(() => ({ state: 'idle' }));

let target: PttTarget | null = null;
let factory: RecognizerFactory = browserRecognizer;
const ptt = createPushToTalk({
  recognizer: () => factory(),
  onLive: (t) => target?.onLive(t),
  onSend: (t) => target?.onSend(t),
  onState: (state) => usePttStore.setState({ state }),
});

/** The talk box that hears the words (null: none; listening stops). */
export function setPttTarget(t: PttTarget | null): void {
  if (t === null) ptt.cancel();
  target = t;
}

export function pressToTalk(): boolean {
  if (target === null) return false;
  const ok = ptt.press();
  if (ok) target.onStart?.();
  return ok;
}

export function releaseToTalk(): void {
  ptt.release();
}

export function cancelTalk(): void {
  ptt.cancel();
}

/** Tests: a fake recognizer, and back to idle. */
export function setRecognizerFactory(f: RecognizerFactory | null): void {
  factory = f ?? browserRecognizer;
  ptt.reset();
}
