/**
 * The world's own boot overlay (SPEC §20.10.3 / §20.10.4, IMPLEMENTATION-NOTES part 2 W2): drawn over the canvas
 * from the moment the canvas mounts until World3D renders its first zone frame, then fades out (--motion-banner).
 * Literal phase labels and a real byte bar where bytes are known (creature atlases); an activity sweep otherwise —
 * the shader warm-up blocks the main thread, and the CSS sweep keeps moving on the compositor meanwhile, so the
 * canvas never looks broken. DOM, not the canvas HUD: the HUD cannot draw before the renderer exists.
 */
import { useEffect, useState } from 'react';
import { KeyArt } from '../ui/KeyArt';
import { ProgressBar } from '../ui/ProgressBar';
import { formatMb, useWorldBoot } from './bootProgress';
import s from './WorldBoot.module.css';

export function WorldBoot() {
  const boot = useWorldBoot();
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (!boot.ready) {
      setGone(false);
      return;
    }
    const t = setTimeout(() => setGone(true), 420);
    return () => clearTimeout(t);
  }, [boot.ready]);
  if (gone) return null;
  const known = boot.loadedBytes !== null && boot.totalBytes !== null && boot.totalBytes > 0;
  const label = boot.error !== null ? 'The 3D world could not start' : known ? `${boot.label} ${formatMb(boot.loadedBytes!)} / ${formatMb(boot.totalBytes!)} MB` : boot.label;
  return (
    <div className={s.boot} data-state={boot.ready ? 'done' : 'loading'} data-testid="worldboot" role="status" aria-live="polite">
      <KeyArt dim />
      <div className={s.center}>
        <p className={s.brand}>Ewamon</p>
        <p className={s.label}>{label}</p>
        {boot.error !== null ? (
          <p className={s.error}>{boot.error}</p>
        ) : known ? (
          <ProgressBar value={boot.loadedBytes! / boot.totalBytes!} label={boot.label} valueText={label} size="sm" />
        ) : (
          <div className={s.activity} aria-hidden>
            <span className={s.sweep} />
          </div>
        )}
      </div>
    </div>
  );
}
