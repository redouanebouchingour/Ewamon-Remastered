/**
 * SPEC §20.4.2: one <canvas>, one effect: acquireWorld(canvas) / releaseWorld(). Mounted by CanvasHost (the
 * pathless layout above /play), so no route transition, loader, error or Suspense boundary ever unmounts it.
 * React ends here — nothing inside the world is React (§20.0 rule 4, CUT: no R3F).
 */
import { useEffect, useRef } from 'react';
import s from './GameCanvas.module.css';
import { acquireWorld, releaseWorld, worldCapability } from './worldHost';

export function GameCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  const capable = worldCapability();
  useEffect(() => {
    const canvas = ref.current;
    if (canvas === null || !capable) return;
    acquireWorld(canvas);
    return () => releaseWorld();
  }, [capable]);
  if (!capable) return <div className={s.fallback} data-testid="gamecanvas-fallback" aria-hidden />;
  return <canvas ref={ref} className={s.canvas} data-testid="gamecanvas" aria-label="Game world" />;
}
