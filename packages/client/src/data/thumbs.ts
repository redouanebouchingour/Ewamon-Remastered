/**
 * DOM creature thumbnails (SPEC §20.10.2 rule 6): the pipeline's 128 px WebP thumbs at
 * `public/creatures/thumbs/<id>_front.webp`, listed in `public/creatures/creatures.manifest.json`.
 * The manifest is read once; until it resolves (or when the pipeline output is absent) components draw the
 * type-tinted monogram instead of issuing 130 requests that would 404.
 *
 * Animated dex thumbnails (2026-10-27): every species whose front plays a flipbook in the manifest (`sprites[id].anim
 * .front`, the animated legendaries / mythicals) also has `public/dex-anim/<id>.webp`, a looping animated WebP the
 * sprite pipeline cuts from that flipbook (`pnpm --filter @ewa/sprite-pipeline dex-anim`). The dex draws it in place of
 * the still (`CreatureSprite animated`).
 */
import { useSyncExternalStore } from 'react';

export const THUMB_MANIFEST_URL = '/creatures/creatures.manifest.json';

let available: ReadonlySet<string> = new Set();
let animated: ReadonlySet<string> = new Set();
let requested = false;
const listeners = new Set<() => void>();

function load(): void {
  if (requested || typeof fetch === 'undefined') return;
  requested = true;
  fetch(THUMB_MANIFEST_URL, { priority: 'low' } as RequestInit)
    .then(async (res) => {
      if (!res.ok) return;
      const json = (await res.json()) as { sprites?: Record<string, { anim?: { front?: { frames?: readonly unknown[] } } } | null> };
      if (json.sprites === undefined || json.sprites === null) return;
      available = new Set(Object.keys(json.sprites));
      animated = animatedFronts(json.sprites);
      for (const l of listeners) l();
    })
    .catch(() => undefined);
}

function subscribe(cb: () => void): () => void {
  load();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const snapshot = (): ReadonlySet<string> => available;
const animatedSnapshot = (): ReadonlySet<string> => animated;

/** The sprite ids whose front plays a flipbook (more than one page) in a manifest's `sprites`: each has an animated dex thumb. */
export function animatedFronts(sprites: Readonly<Record<string, { anim?: { front?: { frames?: readonly unknown[] } } } | null>>): ReadonlySet<string> {
  return new Set(Object.keys(sprites).filter((id) => (sprites[id]?.anim?.front?.frames?.length ?? 0) > 1));
}

export function useThumbSet(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** The sprite ids with an animated dex thumb (empty until the manifest resolves). */
export function useAnimatedThumbSet(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, animatedSnapshot, animatedSnapshot);
}

export function thumbUrl(speciesId: string): string {
  return `/creatures/thumbs/${speciesId}_front.webp`;
}

export function animatedThumbUrl(speciesId: string): string {
  return `/dex-anim/${speciesId}.webp`;
}
