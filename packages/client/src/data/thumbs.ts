/**
 * DOM creature thumbnails (SPEC §20.10.2 rule 6): the pipeline's 128 px WebP thumbs at
 * `public/creatures/thumbs/<id>_front.webp`, listed in `public/creatures/creatures.manifest.json`.
 * The manifest is read once; until it resolves (or when the pipeline output is absent) components draw the
 * type-tinted monogram instead of issuing 130 requests that would 404.
 */
import { useSyncExternalStore } from 'react';

export const THUMB_MANIFEST_URL = '/creatures/creatures.manifest.json';

let available: ReadonlySet<string> = new Set();
let requested = false;
const listeners = new Set<() => void>();

function load(): void {
  if (requested || typeof fetch === 'undefined') return;
  requested = true;
  fetch(THUMB_MANIFEST_URL, { priority: 'low' } as RequestInit)
    .then(async (res) => {
      if (!res.ok) return;
      const json = (await res.json()) as { sprites?: Record<string, unknown> };
      if (json.sprites === undefined || json.sprites === null) return;
      available = new Set(Object.keys(json.sprites));
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

export function useThumbSet(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function thumbUrl(speciesId: string): string {
  return `/creatures/thumbs/${speciesId}_front.webp`;
}
