/**
 * Push-to-talk in a talk box (LLM feature 10, voice/listen.ts): the mic button beside Chat in the DialogueBox and in
 * the buddy talk. Shown only with Settings › Audio "Speak to NPCs" on and a browser that has speech recognition;
 * otherwise nothing renders and typing is the way to talk, as before.
 *
 * Hold the button (pointer) or the push-to-talk key (backquote by default; the key is caught before the talk field,
 * so it types nothing while this button is up) to speak; the live words fill the field; release sends them as the
 * typed line. While listening the button turns orange ("Listening"). A blocked or missing mic, or a recognizer that
 * cannot reach its service, shows a short note under the button; pressing again retries. The mic never opens by itself.
 */
import { useEffect, useRef } from 'react';
import { useSettingsStore } from '../state/settings';
import { Icon } from '../ui/Icon';
import { hushVoices } from '../voice/bindVoices';
import { PTT_NOTE, cancelTalk, pressToTalk, releaseToTalk, setPttTarget, speechInputSupported, usePttStore } from '../voice/listen';
import type { PttState, PttTarget } from '../voice/listen';
import { keyGlyph } from './TutorialCard';
import d from './DialogueBox.module.css';
import s from './MicButton.module.css';

const LABEL: Readonly<Record<PttState, string>> = {
  idle: 'Talk',
  listening: 'Listening',
  stopping: 'Sending',
  denied: 'Mic blocked',
  nomic: 'No mic',
  unavailable: 'Mic off',
  unsupported: 'Mic off',
};

export interface MicButtonProps {
  /** who is listened to (for the button's label) */
  readonly to: string;
  readonly target: PttTarget;
}

function press(): void {
  if (pressToTalk()) hushVoices();
}

export function MicButton({ to, target }: MicButtonProps) {
  const on = useSettingsStore((st) => st.audio.speechInput);
  const keys = useSettingsStore((st) => st.keybinds.pushToTalk);
  const state = usePttStore((st) => st.state);
  const latest = useRef(target);
  latest.current = target;
  const enabled = on && speechInputSupported();

  // this box hears the words while it is up; closing it (or turning the setting off) stops the mic
  useEffect(() => {
    if (!enabled) return;
    setPttTarget({
      onLive: (t) => latest.current.onLive(t),
      onSend: (t) => latest.current.onSend(t),
      onStart: () => latest.current.onStart?.(),
    });
    return () => setPttTarget(null);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const mine = (e: KeyboardEvent): boolean => keys.includes(e.code) && !e.ctrlKey && !e.metaKey && !e.altKey;
    const down = (e: KeyboardEvent): void => {
      if (!mine(e)) return;
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat) press();
    };
    const up = (e: KeyboardEvent): void => {
      if (!mine(e)) return;
      e.preventDefault();
      e.stopPropagation();
      releaseToTalk();
    };
    // the key let go outside the window: what was heard is still sent
    const blur = (): void => releaseToTalk();
    window.addEventListener('keydown', down, true);
    window.addEventListener('keyup', up, true);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down, true);
      window.removeEventListener('keyup', up, true);
      window.removeEventListener('blur', blur);
      cancelTalk();
    };
  }, [enabled, keys]);

  if (!enabled) return null;
  const note = PTT_NOTE[state];
  const key = keys[0];
  return (
    <span className={s.wrap}>
      <button
        type="button"
        className={`${d.act} ${s.mic}`}
        data-state={state}
        data-testid="mic-button"
        aria-pressed={state === 'listening'}
        aria-label={state === 'listening' ? `Listening to you, release to send to ${to}` : `Hold to speak to ${to}${key !== undefined ? `, or hold ${keyGlyph(key)}` : ''}`}
        onPointerDown={(e) => {
          if (e.button > 0) return;
          e.preventDefault();
          e.currentTarget.setPointerCapture?.(e.pointerId);
          press();
        }}
        onPointerUp={() => releaseToTalk()}
        onPointerCancel={() => releaseToTalk()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <Icon name="mic" size="sm" />
        <span>{LABEL[state]}</span>
        {key !== undefined ? <kbd className={d.key}>{keyGlyph(key)}</kbd> : null}
      </button>
      {note !== undefined ? (
        <span className={s.note} role="status" data-testid="mic-note">
          {note}
        </span>
      ) : null}
    </span>
  );
}
