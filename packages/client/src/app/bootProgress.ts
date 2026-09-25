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

// ---- the world's own boot (part 2): renderer + shader warm-up + atlases + zone, until the first world frame ----

export interface WorldBoot {
  /** false until World3D rendered its first frame with the zone loaded */
  readonly ready: boolean;
  readonly label: string;
  readonly loadedBytes: number | null;
  readonly totalBytes: number | null;
  /** a fatal renderer failure (no GPU): the overlay shows it instead of spinning */
  readonly error: string | null;
}

let world: WorldBoot = { ready: false, label: 'Starting the renderer', loadedBytes: null, totalBytes: null, error: null };
const worldListeners = new Set<() => void>();

export function setWorldBoot(patch: Partial<WorldBoot>): void {
  world = { ...world, ...patch };
  for (const l of worldListeners) l();
}

export function getWorldBoot(): WorldBoot {
  return world;
}

function subscribeWorld(cb: () => void): () => void {
  worldListeners.add(cb);
  return () => worldListeners.delete(cb);
}

export function useWorldBoot(): WorldBoot {
  return useSyncExternalStore(subscribeWorld, getWorldBoot, getWorldBoot);
}
