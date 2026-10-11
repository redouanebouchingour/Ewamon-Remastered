/**
 * Arena PvP: the stadium the arena battle is fought in — render's `createArenaBackdrop()` (`{ root, update(s),
 * dispose() }`, render stage/arenaBackdrop.ts), added to the scene and registered as the zone root
 * (`HostContext.setZoneRoot`: counted by the stats and the probe) while no zone is loaded, with render's night-venue
 * lighting palette and grade (`ARENA_LIGHTING` / `ARENA_GRADE`; the next `loadZone` sets the zone's own again), its
 * recommended time of day and ring terrain (`ARENA_BACKDROP`). Read through the namespace so a render build without
 * it still links: then (or when the build throws) the arena shows the sky only and the ring dresses as 'none'.
 */
import * as render from '@ewa/render';
import { rendererInternals } from '@ewa/render';
import type { Renderer, Terrain } from '@ewa/render';
import type { Group, Object3D } from 'three/webgpu';

/** render's contract (stage/arenaBackdrop.ts). */
export interface ArenaBackdropLike {
  readonly root: Object3D;
  /** seconds (scaled frame time, so hitstop freezes the crowd) */
  update(dtSeconds: number): void;
  dispose(): void;
}

export interface MountedBackdrop {
  /** the ring's dressing in the stadium */
  readonly terrain: Terrain;
  /** the stadium's time of day (0..1) */
  readonly timeOfDay: number;
  /** frame time in ms (unscaled; the renderer's time scale is applied here) */
  update(dtMs: number): void;
  dispose(): void;
}

type RenderModule = Readonly<Record<string, unknown>>;
const RENDER = render as unknown as RenderModule;

/** Fallbacks without render's backdrop: a plain ring, a bright afternoon. */
export const ARENA_FALLBACK = { terrain: 'none' as Terrain, timeOfDay: 0.45 };

/** The factory, when this render build has one. */
export function arenaBackdropFactory(mod: RenderModule = RENDER): (() => ArenaBackdropLike) | null {
  const f = mod['createArenaBackdrop'];
  return typeof f === 'function' ? (f as () => ArenaBackdropLike) : null;
}

/** Builds the stadium into `r`'s scene and registers it as the zone root; null = sky only (`ARENA_FALLBACK`). */
export function mountArenaBackdrop(r: Renderer, mod: RenderModule = RENDER): MountedBackdrop | null {
  const factory = arenaBackdropFactory(mod);
  if (factory === null) return null;
  let b: ArenaBackdropLike;
  try {
    b = factory();
  } catch (e) {
    console.warn('[arena] backdrop build failed; the arena shows the sky only', e);
    return null;
  }
  const host = rendererInternals(r);
  if (b.root.parent === null) r.scene.add(b.root);
  host?.setZoneRoot(b.root as Group);
  const lighting = mod['ARENA_LIGHTING'];
  const grade = mod['ARENA_GRADE'];
  if (host !== undefined && lighting !== undefined) host.setLightingPalette(lighting as Parameters<typeof host.setLightingPalette>[0]);
  if (host !== undefined && grade !== undefined) host.setGrade(grade as Parameters<typeof host.setGrade>[0]);
  const cfg = (mod['ARENA_BACKDROP'] ?? {}) as { readonly terrain?: Terrain; readonly timeOfDay?: number };
  let disposed = false;
  return {
    terrain: cfg.terrain ?? ARENA_FALLBACK.terrain,
    timeOfDay: cfg.timeOfDay ?? ARENA_FALLBACK.timeOfDay,
    update: (dtMs) => {
      if (!disposed) b.update((dtMs * (host?.timeScale() ?? 1)) / 1000);
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      host?.setZoneRoot(null);
      b.root.removeFromParent();
      try {
        b.dispose();
      } catch (e) {
        console.warn('[arena] backdrop dispose', e);
      }
    },
  };
}
