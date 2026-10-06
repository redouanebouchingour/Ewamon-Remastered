/**
 * Phase D9 — the Old Rod's prompt: a small bottom-centre card while a line is out. 'waiting': a bobbing float and
 * "Wait for a bite…"; 'bite': a large "!" and "Reel in — E"; 'missed': "It got away." The card owns E / Enter / Space
 * (reel) and Escape (reel in empty) while it is up; a click on it reels too. Under reduced motion nothing moves (the
 * float holds still, the "!" does not pulse) and the bite window is longer (`FISHING.reducedBiteMs`).
 */
import { useEffect } from 'react';
import { fishingActions, useFishingStore } from '../state/fishing';
import { useSettingsStore } from '../state/settings';
import s from './FishingPrompt.module.css';

function keyName(code: string | undefined): string {
  return (code ?? 'KeyE').replace(/^Key|^Digit/, '');
}

export function FishingPrompt() {
  const phase = useFishingStore((st) => st.phase);
  const reel = useSettingsStore((st) => keyName(st.keybinds.interact[0]));
  const open = phase !== 'idle';

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const binds = useSettingsStore.getState().keybinds.interact;
      if (binds.includes(e.code) || e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        fishingActions()?.press();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        fishingActions()?.cancel();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open]);

  if (!open) return null;
  return (
    <button type="button" className={s.card} data-phase={phase} onClick={() => fishingActions()?.press()}>
      {phase === 'bite' ? (
        <span className={s.bang} aria-hidden="true">
          !
        </span>
      ) : (
        <span className={phase === 'waiting' ? s.float : s.floatIdle} aria-hidden="true" />
      )}
      <span className={s.text} role="status" aria-live="assertive">
        {phase === 'waiting' && 'Wait for a bite…'}
        {phase === 'bite' && `Reel in — ${reel}`}
        {phase === 'missed' && 'It got away.'}
      </span>
    </button>
  );
}
