/**
 * `/play`'s hydrateFallbackElement (SPEC §20.10.4): key art, the literal phase label and a real byte bar. Shown
 * only before the FIRST /me resolves; afterwards phases continue behind the canvas HUD's own fade (part 2).
 */
import { KeyArt } from '../ui/KeyArt';
import { ProgressBar } from '../ui/ProgressBar';
import { formatMb, useBootPhase } from './bootProgress';
import s from './BootScreen.module.css';

export function BootScreen() {
  const phase = useBootPhase();
  const known = phase.loadedBytes !== null && phase.totalBytes !== null && phase.totalBytes > 0;
  const label = known ? `${phase.label} ${formatMb(phase.loadedBytes!)} / ${formatMb(phase.totalBytes!)} MB` : phase.label;
  return (
    <div className={s.boot} data-testid="bootscreen" role="status" aria-live="polite">
      <KeyArt />
      <div className={s.center}>
        <p className={s.brand}>Ewamon</p>
        <p className={s.tag}>Remastered</p>
        <div className={s.phase}>
          <p className={s.label}>{label}</p>
          {known ? (
            <ProgressBar value={phase.loadedBytes! / phase.totalBytes!} label={phase.label} valueText={label} size="sm" />
          ) : (
            <div className={s.activity} aria-hidden>
              <span className={s.sweep} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
