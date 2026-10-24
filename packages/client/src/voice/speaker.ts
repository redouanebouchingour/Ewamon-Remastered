/**
 * Voice talk (LLM feature 10): the speaker that turns lines into speech, one sentence at a time, with its own queue.
 *
 * Two channels: `world` (an NPC's reply, the buddy, the rival) and `battle` (the commentator, the trainer's lines). The
 * rules:
 * - `stream` follows a reply as it streams in and speaks each sentence when it completes (`update`), the rest when the
 *   reply is in (`end`). Opening a stream interrupts whatever is speaking: a new line starts.
 * - `say` speaks a whole line, interrupting everything; with `queue` (battle lines) it waits for the line speaking now
 *   instead, and a newer queued line replaces an older one still waiting (the caption it belongs to is gone by then).
 * - `hush(channel)` stops that channel (what speaks and what waits) and kills its open stream; `hush()` stops all.
 * - Nothing is spoken without a local voice (voices.ts): the browser's default voice may synthesize on a server, and
 *   headless Chrome on Windows lists only Google's network voices. Nor while `allowed(channel)` is false (its setting off, master volume 0, the tab hidden with "Mute
 *   when the tab is hidden") or `volume()` is 0; the check runs for every sentence, so turning a setting off mid-line
 *   stops at the next sentence even before the binding hushes it.
 *
 * After a cancel the next sentence waits `CANCEL_GAP_MS`: Chrome drops a `speak()` that follows `cancel()` at once.
 */
import type { SpeechEngine } from './speech';
import { cleanStream, nextSentences, sentencesOf } from './speakable';
import { pickVoice } from './voices';
import type { VoicePersona } from './voices';

export type VoiceChannel = 'world' | 'battle';

export const CANCEL_GAP_MS = 60;

export interface SpeakerOptions {
  readonly engine: SpeechEngine;
  /** may this channel speak now */
  readonly allowed: (c: VoiceChannel) => boolean;
  /** 0..1, the utterance volume */
  readonly volume: () => number;
  /** timers (tests run them at once) */
  readonly schedule?: (fn: () => void, ms: number) => void;
}

export interface SpeechStream {
  /** the reply so far (the whole text, not the new piece) */
  update(text: string): void;
  /** the whole reply, once it is in */
  end(text: string): void;
}

export interface Speaker {
  say(c: VoiceChannel, p: VoicePersona, text: string, o?: { readonly queue?: boolean }): void;
  stream(c: VoiceChannel, p: VoicePersona): SpeechStream;
  hush(c?: VoiceChannel): void;
  /** the channel speaking now (null: quiet) */
  speaking(): VoiceChannel | null;
}

interface Item {
  readonly channel: VoiceChannel;
  readonly persona: VoicePersona;
  readonly text: string;
  readonly line: number;
}

export function createSpeaker(o: SpeakerOptions): Speaker {
  const schedule = o.schedule ?? ((fn: () => void, ms: number) => void setTimeout(fn, ms));
  let queue: Item[] = [];
  let current: { readonly id: number; readonly channel: VoiceChannel; readonly line: number } | null = null;
  let seq = 0;
  let lines = 0;
  let cooling = false;
  const epoch: Record<VoiceChannel, number> = { world: 0, battle: 0 };

  const pump = (): void => {
    while (current === null && !cooling && queue.length > 0) {
      const item = queue.shift()!;
      const volume = Math.min(1, Math.max(0, o.volume()));
      if (!o.allowed(item.channel) || volume <= 0) continue;
      const pick = pickVoice(item.persona, o.engine.voices());
      // no local voice: nothing is said (the browser's default voice may be a network one)
      if (pick.voiceURI === null) continue;
      const id = ++seq;
      current = { id, channel: item.channel, line: item.line };
      o.engine.speak({
        text: item.text,
        voiceURI: pick.voiceURI,
        lang: pick.lang,
        pitch: pick.pitch,
        rate: pick.rate,
        volume,
        onDone: () => {
          if (current?.id !== id) return;
          current = null;
          pump();
        },
      });
    }
  };

  const cancelCurrent = (): void => {
    if (current === null) return;
    current = null;
    cooling = true;
    o.engine.cancel();
    schedule(() => {
      cooling = false;
      pump();
    }, CANCEL_GAP_MS);
  };

  const enqueue = (c: VoiceChannel, p: VoicePersona, sentences: readonly string[], line: number): void => {
    if (!o.allowed(c)) return;
    for (const text of sentences) queue.push({ channel: c, persona: p, text, line });
    pump();
  };

  const hush = (c?: VoiceChannel): void => {
    if (c === undefined) {
      epoch.world++;
      epoch.battle++;
      queue = [];
      cancelCurrent();
      return;
    }
    epoch[c]++;
    queue = queue.filter((i) => i.channel !== c);
    if (current?.channel === c) cancelCurrent();
  };

  return {
    say(c, p, text, opt = {}) {
      if (!o.allowed(c)) return;
      const sentences = sentencesOf(text);
      if (sentences.length === 0) return;
      const line = ++lines;
      if (opt.queue === true) {
        // only the line speaking now goes on; an older line still waiting is dropped for this one
        queue = queue.filter((i) => i.channel !== c || i.line === current?.line);
      } else hush();
      enqueue(c, p, sentences, line);
    },
    stream(c, p) {
      hush();
      const born = epoch[c];
      const line = ++lines;
      let offset = 0;
      const alive = (): boolean => epoch[c] === born;
      return {
        update(text) {
          if (!alive()) return;
          const next = nextSentences(cleanStream(text), offset);
          offset = next.offset;
          enqueue(c, p, next.sentences, line);
        },
        end(text) {
          if (!alive()) return;
          const next = nextSentences(cleanStream(text), offset, true);
          offset = next.offset;
          enqueue(c, p, next.sentences, line);
        },
      };
    },
    hush,
    speaking: () => current?.channel ?? (queue[0]?.channel ?? null),
  };
}
