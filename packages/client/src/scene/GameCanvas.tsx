/**
 * SPEC §20.4.2: one <canvas>, one effect: acquireWorld(canvas) / releaseWorld(). Mounted by CanvasHost (the
 * pathless layout above /play), so no route transition, loader, error or Suspense boundary ever unmounts it.
 * React ends here — nothing inside the world is React (§20.0 rule 4, CUT: no R3F). World3D is imported lazily
 * (`ensureWorldFactory`) so /login costs no three.js.
 */
import { useEffect, useRef } from 'react';
import s from './GameCanvas.module.css';
import { ensureWorldFactory } from './registerWorld';
import { acquireWorld, releaseWorld, worldCapability } from './worldHost';

export function GameCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  const capable = worldCapability();
  useEffect(() => {
    const canvas = ref.current;
    if (canvas === null || !capable) return;
    let cancelled = false;
    let acquired = false;
    ensureWorldFactory()
      .then(() => {
        if (cancelled) return;
        acquired = true;
        acquireWorld(canvas);
      })
      .catch((e: unknown) => console.error('world module failed to load', e));
    return () => {
      cancelled = true;
      if (acquired) releaseWorld();
    };
  }, [capable]);
  if (!capable) return <div className={s.fallback} data-testid="gamecanvas-fallback" aria-hidden />;
  return <canvas ref={ref} className={s.canvas} data-testid="gamecanvas" aria-label="Game world" tabIndex={-1} />;
}
