/**
 * LLM feature 10, push-to-talk: the state machine over a fake recognizer (press, the live words, release sends them,
 * a tap sends nothing, the hold cap, the recognizer ending by itself, the errors and their retry, cancel).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { END_GRACE_MS, MAX_HOLD_MS, MIN_HOLD_MS, createPushToTalk } from '../src/voice/listen';
import type { PttState, PushToTalk } from '../src/voice/listen';
import { fakeRecognizer } from './voiceFakes';
import type { FakeRecognizer } from './voiceFakes';

describe('push-to-talk', () => {
  let clock: number;
  let timers: { at: number; fn: () => void; live: boolean }[];
  let recs: FakeRecognizer[];
  let live: string[];
  let sent: string[];
  let states: PttState[];
  let ptt: PushToTalk;
  let make: () => FakeRecognizer | null;

  const advance = (ms: number): void => {
    clock += ms;
    for (const t of timers.filter((x) => x.live && x.at <= clock)) {
      t.live = false;
      t.fn();
    }
  };
  const rec = (): FakeRecognizer => recs.at(-1)!;

  beforeEach(() => {
    clock = 1000;
    timers = [];
    recs = [];
    live = [];
    sent = [];
    states = [];
    make = () => {
      const r = fakeRecognizer();
      recs.push(r);
      return r;
    };
    ptt = createPushToTalk({
      recognizer: () => make(),
      onLive: (t) => live.push(t),
      onSend: (t) => sent.push(t),
      onState: (s) => states.push(s),
      now: () => clock,
      setTimer: (fn, ms) => {
        const t = { at: clock + ms, fn, live: true };
        timers.push(t);
        return () => {
          t.live = false;
        };
      },
    });
  });

  it('press listens, the words show as they come, release sends them once the recognizer ends', () => {
    expect(ptt.press()).toBe(true);
    expect(ptt.state()).toBe('listening');
    expect(rec().started).toBe(1);
    rec().hear('where is');
    rec().hear('where is the inn');
    expect(live).toEqual(['where is', 'where is the inn']);
    advance(800);
    ptt.release();
    expect(ptt.state()).toBe('stopping');
    expect(rec().stopped).toBe(1);
    expect(sent).toEqual([]);
    rec().hear('where is the inn please');
    rec().end();
    expect(sent).toEqual(['where is the inn please']);
    expect(ptt.state()).toBe('idle');
    expect(states).toEqual(['listening', 'stopping', 'idle']);
  });

  it('a second press while listening starts nothing new', () => {
    ptt.press();
    expect(ptt.press()).toBe(false);
    expect(recs).toHaveLength(1);
  });

  it('a tap sends nothing and aborts the mic', () => {
    ptt.press();
    rec().hear('uh');
    advance(MIN_HOLD_MS - 50);
    ptt.release();
    expect(rec().aborted).toBe(1);
    rec().end();
    expect(sent).toEqual([]);
    expect(ptt.state()).toBe('idle');
  });

  it('silence sends nothing', () => {
    ptt.press();
    advance(900);
    ptt.release();
    rec().fail('no-speech');
    rec().end();
    expect(sent).toEqual([]);
    expect(ptt.state()).toBe('idle');
  });

  it('a hold over the cap is released for the player', () => {
    ptt.press();
    rec().hear('a very long speech');
    advance(MAX_HOLD_MS);
    expect(ptt.state()).toBe('stopping');
    rec().end();
    expect(sent).toEqual(['a very long speech']);
  });

  it('a recognizer that never ends after the release still sends the words', () => {
    ptt.press();
    rec().hear('hello');
    advance(600);
    ptt.release();
    advance(END_GRACE_MS);
    expect(sent).toEqual(['hello']);
    expect(rec().aborted).toBe(1);
    rec().end();
    expect(sent).toEqual(['hello']);
  });

  it('ending by itself while held leaves the words unsent (they stay in the field)', () => {
    ptt.press();
    rec().hear('half a thought');
    rec().end();
    expect(ptt.state()).toBe('idle');
    expect(sent).toEqual([]);
    expect(live).toEqual(['half a thought']);
    ptt.release();
    expect(sent).toEqual([]);
  });

  it('a blocked mic says so, and a new press tries again', () => {
    ptt.press();
    rec().fail('not-allowed');
    expect(ptt.state()).toBe('denied');
    expect(rec().aborted).toBe(1);
    rec().end();
    expect(ptt.state()).toBe('denied');
    expect(ptt.press()).toBe(true);
    expect(recs).toHaveLength(2);
    expect(ptt.state()).toBe('listening');
  });

  it('no microphone and no service have their own states', () => {
    ptt.press();
    rec().fail('audio-capture');
    expect(ptt.state()).toBe('nomic');
    ptt.press();
    rec().fail('network');
    expect(ptt.state()).toBe('unavailable');
  });

  it('a recognizer that refuses to start is unavailable; none at all is unsupported for good', () => {
    make = () => fakeRecognizer({ throwOnStart: true });
    expect(ptt.press()).toBe(false);
    expect(ptt.state()).toBe('unavailable');
    make = () => null;
    expect(ptt.press()).toBe(false);
    expect(ptt.state()).toBe('unsupported');
    make = () => fakeRecognizer();
    expect(ptt.press()).toBe(false);
  });

  it('cancel drops the words and the mic', () => {
    ptt.press();
    rec().hear('never mind');
    advance(500);
    ptt.cancel();
    expect(rec().aborted).toBe(1);
    rec().end();
    expect(sent).toEqual([]);
    expect(ptt.state()).toBe('idle');
  });

  it('nothing starts the mic but a press', () => {
    expect(recs).toHaveLength(0);
    ptt.release();
    ptt.cancel();
    advance(MAX_HOLD_MS * 2);
    expect(recs).toHaveLength(0);
  });
});
