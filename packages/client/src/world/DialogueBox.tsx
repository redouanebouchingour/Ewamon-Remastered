/**
 * SPEC §20.9.2 DialogueBox: bottom-centre, --t-body-lg, speaker in the display face, `Enter` / `E` advance, ≤ 3 lines
 * visible, the remaining count shown; `Escape` closes. The lines come from content (§20.4.7) — World3D writes
 * `ui.dialogue`; this component only pages through it. Paging past the last line runs `onFinish` (a beat battle or a
 * gym challenge starts then); Escape does not, except on an `obligatory` dialogue (a trainer who saw the player).
 *
 * Broadcast look (2026-10-11): a lower-third — an orange speaker strip over a black slab, the lines in the text face,
 * "n more" / "Close" with a paper key chip.
 *
 * NPC talk (2026-10-22): over any person's lines, C opens a text field; the NPC answers what the player types in
 * character from a local model (`state/npcTalk.ts`). H slaps and K kicks the NPC, who answers that too. The whole conversation shows as a log; while it is on screen Enter / E /
 * Escape return to the scripted lines and keep it (the next line resumes it), so a beat's `onFinish` still runs only by
 * paging past them. Closing the dialogue ends the conversation: E on the person again starts a new one.
 */
import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { zone } from '@ewa/content';
import type { ZoneId } from '@ewa/content';
import { useSessionStore } from '../state/session';
import { useUiStore } from '../state/ui';
import type { DialogueUi } from '../state/ui';
import { endTalk, hitNpc, leaveTalk, sendText, useNpcTalkStore } from '../state/npcTalk';
import type { NpcPersona } from '../talk/npcChat';
import s from './DialogueBox.module.css';

export const LINES_PER_PAGE = 3;

function advance(): void {
  const ui = useUiStore.getState();
  const d = ui.dialogue;
  if (d === null) return;
  const next = d.index + LINES_PER_PAGE;
  if (next >= d.lines.length) {
    ui.setDialogue(null);
    d.onFinish?.();
  } else ui.setDialogue({ ...d, index: next });
}

const TALK_ON = import.meta.env['VITE_NPC_TALK'] !== '0';

function placeOf(zoneId: ZoneId | null): string | null {
  if (zoneId === null) return null;
  try {
    const z = zone(zoneId);
    return `${z.name} (${z.kind}, ${z.biome})`;
  } catch (_e) {
    return null;
  }
}

function personaOf(d: DialogueUi): NpcPersona {
  const [name, ...role] = d.speaker.split(',');
  const title = role.join(',').trim();
  return { name: name!.trim(), role: title === '' ? null : title, place: placeOf(useSessionStore.getState().zoneId), lines: d.lines };
}

function typedSend(text: string): boolean {
  const d = useUiStore.getState().dialogue;
  if (d === null || d.noTalk === true || !TALK_ON || text.trim() === '' || useNpcTalkStore.getState().phase !== 'idle') return false;
  sendText(d.targetId, personaOf(d), text);
  return true;
}

function hit(kind: 'slap' | 'kick'): void {
  const d = useUiStore.getState().dialogue;
  if (d === null || d.noTalk === true || !TALK_ON) return;
  hitNpc(d.targetId, personaOf(d), kind);
}

/** the key went to a text field (the typed chat): the dialogue's keys stay out of its way */
function inField(e: KeyboardEvent): boolean {
  return e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
}

/** a conversation is on screen for the open dialogue */
function talking(): boolean {
  const d = useUiStore.getState().dialogue;
  const t = useNpcTalkStore.getState();
  return d !== null && t.targetId === d.targetId && !t.hidden && (t.turns.length > 0 || t.phase !== 'idle' || t.error !== null);
}

export function DialogueBox() {
  const d = useUiStore((st) => st.dialogue);
  const inBattle = useUiStore((st) => st.battle !== null);
  const talk = useNpcTalkStore(useShallow((st) => st));
  const ref = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState('');
  const open = d !== null && !inBattle;
  const canTalk = TALK_ON && d !== null && d.noTalk !== true;

  // the conversation belongs to one dialogue: closing it, or opening another, ends the talk
  const targetId = open ? d.targetId : null;
  useEffect(() => {
    if (useNpcTalkStore.getState().targetId !== targetId) endTalk();
    setTyping(false);
    setDraft('');
  }, [targetId]);
  useEffect(() => () => endTalk(), []);
  // the log follows the newest line
  useEffect(() => {
    const el = logRef.current;
    if (el !== null) el.scrollTop = el.scrollHeight;
  }, [talk.turns, talk.partial, talk.phase, talk.hidden]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey || inField(e)) return;
      if (e.code === 'KeyC' && TALK_ON && useUiStore.getState().dialogue?.noTalk !== true) {
        e.preventDefault();
        e.stopPropagation();
        setTyping(true);
        return;
      }
      if ((e.code === 'KeyH' || e.code === 'KeyK') && TALK_ON && useUiStore.getState().dialogue?.noTalk !== true) {
        e.preventDefault();
        e.stopPropagation();
        if (!e.repeat) hit(e.code === 'KeyH' ? 'slap' : 'kick');
        return;
      }
      if (e.repeat) return;
      if (talking() && (e.code === 'Enter' || e.code === 'KeyE' || e.code === 'Space' || e.code === 'Escape')) {
        e.preventDefault();
        e.stopPropagation();
        leaveTalk();
        return;
      }
      if (e.code === 'Enter' || e.code === 'KeyE' || e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        advance();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        const cur = useUiStore.getState().dialogue;
        useUiStore.getState().setDialogue(null);
        if (cur?.obligatory === true) cur.onFinish?.();
      }
    };
    // capture: the dialogue owns E / Enter / C / H / K while it is open (the world's interact key must not re-trigger)
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  if (!open || d === null) return null;
  const field =
    canTalk && typing ? (
      <form
        className={s.typed}
        onSubmit={(e) => {
          e.preventDefault();
          if (typedSend(draft)) setDraft('');
        }}
      >
        <input
          className={s.input}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Escape') return;
            e.preventDefault();
            e.stopPropagation();
            setTyping(false);
          }}
          placeholder={`Say something to ${personaOf(d).name}…`}
          aria-label={`Type to ${d.speaker}`}
          autoFocus
          maxLength={400}
        />
        <kbd className={s.key}>Enter</kbd>
      </form>
    ) : null;
  const fists = canTalk ? (
    <>
      <button type="button" className={s.act} onClick={() => hit('slap')} aria-label="Slap — H">
        <span>Slap</span>
        <kbd className={s.key}>H</kbd>
      </button>
      <button type="button" className={s.act} onClick={() => hit('kick')} aria-label="Kick — K">
        <span>Kick</span>
        <kbd className={s.key}>K</kbd>
      </button>
    </>
  ) : null;
  const chat =
    canTalk && !typing ? (
      <button type="button" className={s.act} onClick={() => setTyping(true)} aria-label="Type to chat — C">
        <span>Chat</span>
        <kbd className={s.key}>C</kbd>
      </button>
    ) : null;
  if (talk.targetId === d.targetId && !talk.hidden && (talk.turns.length > 0 || talk.phase !== 'idle' || talk.error !== null)) {
    const status = talk.phase === 'thinking' ? `${personaOf(d).name} is thinking…` : null;
    return (
      <div ref={ref} className={s.box} role="dialog" aria-label={`Talking with ${d.speaker}`} data-testid="dialoguebox">
        <p className={s.speaker}>{d.speaker}</p>
        <div className={s.slab}>
          <div ref={logRef} className={s.log}>
            {talk.turns.map((t, i) =>
              t.role === 'user' ? (
                <p key={i} className={s.heard}>
                  <span className={s.you}>You</span> {t.shown ?? t.content}
                </p>
              ) : (
                <p key={i} className={s.line}>
                  {t.content}
                </p>
              ),
            )}
            {talk.partial !== '' ? (
              <p className={s.line} aria-live="polite">
                {talk.partial}
              </p>
            ) : null}
          </div>
          {status !== null ? <p className={s.status}>{status}</p> : null}
          {talk.error !== null ? <p className={s.error}>{talk.error}</p> : null}
          {field}
          <div className={s.actions}>
            {fists}
            {chat}
            <button type="button" className={s.more} onClick={leaveTalk} aria-label="Back to the lines — Enter">
              <span>Back</span>
              <kbd className={s.key}>Enter</kbd>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const page = d.lines.slice(d.index, d.index + LINES_PER_PAGE);
  const left = Math.max(0, d.lines.length - d.index - LINES_PER_PAGE);
  return (
    <div ref={ref} className={s.box} role="dialog" aria-label={`${d.speaker} says`} data-testid="dialoguebox">
      <p className={s.speaker}>{d.speaker}</p>
      <div className={s.slab}>
        {page.map((line, i) => (
          <p key={`${d.index}:${i}`} className={s.line}>
            {line}
          </p>
        ))}
        {field}
        <div className={s.actions}>
          {fists}
          {chat}
          <button type="button" className={s.more} onClick={advance} aria-label={left > 0 ? `${left} more — Enter` : 'Close — Enter'}>
            <span>{left > 0 ? `${left} more` : 'Close'}</span>
            <kbd className={s.key}>Enter</kbd>
          </button>
        </div>
      </div>
    </div>
  );
}
