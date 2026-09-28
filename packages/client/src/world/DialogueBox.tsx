/**
 * SPEC §20.9.2 DialogueBox: bottom-centre, --t-body-lg, speaker in the display face, `Enter` / `E` advance, ≤ 3 lines
 * visible, the remaining count shown; `Escape` closes. The lines come from content (§20.4.7) — World3D writes
 * `ui.dialogue`; this component only pages through it. Paging past the last line runs `onFinish` (a beat battle or a
 * gym challenge starts then); Escape does not.
 */
import { useEffect, useRef } from 'react';
import { useUiStore } from '../state/ui';
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

export function DialogueBox() {
  const d = useUiStore((st) => st.dialogue);
  const inBattle = useUiStore((st) => st.battle !== null);
  const ref = useRef<HTMLDivElement>(null);
  const open = d !== null && !inBattle;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (e.code === 'Enter' || e.code === 'KeyE' || e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        advance();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        useUiStore.getState().setDialogue(null);
      }
    };
    // capture: the dialogue owns E / Enter while it is open (the world's interact key must not re-trigger)
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open]);

  if (!open || d === null) return null;
  const page = d.lines.slice(d.index, d.index + LINES_PER_PAGE);
  const left = Math.max(0, d.lines.length - d.index - LINES_PER_PAGE);
  return (
    <div ref={ref} className={s.box} role="dialog" aria-label={`${d.speaker} says`} data-testid="dialoguebox">
      <p className={s.speaker}>{d.speaker}</p>
      {page.map((line, i) => (
        <p key={`${d.index}:${i}`} className={s.line}>
          {line}
        </p>
      ))}
      <button type="button" className={s.more} onClick={advance}>
        {left > 0 ? `${left} more — Enter` : 'Close — Enter'}
      </button>
    </div>
  );
}
