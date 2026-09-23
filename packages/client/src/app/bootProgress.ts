/**
 * BootScreen's phase + byte counter (SPEC §20.10.3/§20.10.4). Labels are literal ("Loading materials
 * 3.1 / 6.0 MB"); bytes come from Content-Length or stay null (then the bar shows activity, never fake
 * progress). Part 2's preloader writes phases 1–3 here; part 1 only knows the /me phase.
 */
import { useSyncExternalStore } from 'react';

export interface BootPhase {
  readonly label: string;
  readonly loadedBytes: number | null;
  readonly totalBytes: number | null;
}

let phase: BootPhase = { label: 'Loading trainer profile', loadedBytes: null, totalBytes: null };
const listeners = new Set<() => void>();

export function setBootPhase(p: BootPhase): void {
  phase = p;
  for (const l of listeners) l();
}

export function getBootPhase(): BootPhase {
  return phase;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useBootPhase(): BootPhase {
  return useSyncExternalStore(subscribe, getBootPhase, getBootPhase);
}

export function formatMb(bytes: number): string {
  return (bytes / 1_000_000).toFixed(1);
}
