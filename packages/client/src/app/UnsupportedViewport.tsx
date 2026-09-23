/**
 * SPEC §20.2.3: desktop only, minimum 1280×720; below 1280 px width the app renders this static message instead of
 * the router (no responsive breakpoints exist). The router stays mounted underneath so widening the window
 * resumes exactly where the player was.
 */
import { useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { KeyArt } from '../ui/KeyArt';
import s from './UnsupportedViewport.module.css';

export const MIN_WIDTH = 1280;
const QUERY = `(min-width: ${MIN_WIDTH}px)`;

function subscribe(cb: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => undefined;
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

function wideEnough(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia(QUERY).matches;
}

export function UnsupportedViewport() {
  return (
    <div className={s.page} role="alert" data-testid="unsupportedviewport">
      <KeyArt dim />
      <div className={s.card}>
        <h1 className={s.title}>Make the window wider</h1>
        <p className={s.text}>
          Ewamon is built for desktop screens at least {MIN_WIDTH} pixels wide. Widen this window (or zoom out) and the world will be right
          where you left it.
        </p>
      </div>
    </div>
  );
}

export function ViewportGate({ children }: { readonly children: ReactNode }) {
  const ok = useSyncExternalStore(subscribe, wideEnough, () => true);
  return (
    <>
      <div hidden={!ok} className={s.app}>
        {children}
      </div>
      {!ok && <UnsupportedViewport />}
    </>
  );
}
