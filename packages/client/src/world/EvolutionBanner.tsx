/**
 * SPEC §20.5.6 (amended 2026-10-05) — the evolution sequence's DOM layer: the "<Name> evolved into <Species>!" banner
 * (bottom-centre, like a game text box) from the reveal (a status message for screen readers too), and while the
 * sequence builds up a small hint that a click, Space, Enter or Escape skips to the reveal. Reads `ui.evolution` only; the skip itself is World3D's input
 * capture (the sequence owns the keyboard and pointer while it plays).
 */
import { useUiStore } from '../state/ui';
import s from './EvolutionBanner.module.css';

export function EvolutionBanner() {
  const evo = useUiStore((st) => st.evolution);
  if (evo === null) return null;
  const shown = evo.phase !== 'playing';
  return (
    <div className={s.layer} data-testid="evolutionbanner" data-phase={evo.phase}>
      <div className={s.banner} role="status" aria-live="polite" data-shown={shown || undefined}>
        {shown && (
          <>
            <span className={s.eyebrow}>Evolution</span>
            <p className={s.line}>
              <strong className={s.name}>{evo.name}</strong> evolved into <strong className={s.species}>{evo.species}</strong>!
            </p>
          </>
        )}
      </div>
      {!shown && (
        <p className={s.hint}>
          <span className={s.sr}>{evo.name} is evolving. </span>
          <kbd>Space</kbd> or click to skip
        </p>
      )}
    </div>
  );
}
