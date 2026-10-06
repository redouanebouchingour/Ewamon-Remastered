/**
 * SPEC §20.10.3 phase 5, second half (Phase E3): after the current zone's hero textures, the linked neighbour zones'
 * field materials and creature atlases are fetched into the browser's HTTP cache — no transcode, no GPU memory (the
 * atlases cost ~33 MB of GPU each set, client IMPLEMENTATION-NOTES part 2), at `priority: 'low'`, one file at a time,
 * paced to ≤ 2 MB/s so it never competes with a handover. A handover's `loadZone` / atlas binds then read the cache;
 * `renderer.prepareHandover` additionally keeps the shared texture sets resident through the old zone's dispose.
 *
 * `neighbourPrefetchPlan` is pure (tested); `runPrefetch` does the fetching and stops when its token is cancelled
 * (the zone changed).
 */
import { harvestStateFor, zone as zoneDef } from '@ewa/content';
import type { ZoneDef, ZoneId } from '@ewa/content';
import { zoneSurfaces } from '@ewa/render';
import type { SurfaceId } from '@ewa/render';
import type { SpriteCatalog } from './spriteCatalog';
import { zoneSpecFor } from './zoneSpecFor';

export const PREFETCH = Object.freeze({
  /** pacing: ≤ this many bytes per second (§20.10.3) */
  bytesPerSecond: 2 * 1024 * 1024,
});

export interface PrefetchPlan {
  readonly zones: readonly ZoneId[];
  /** field-tier surfaces the neighbours bind that the current zone does not */
  readonly surfaces: readonly SurfaceId[];
  /** creature atlas files (albedo / normal / emissive, mips included) of atlases not bound yet */
  readonly atlasUrls: readonly string[];
}

/** What to prefetch for `zone`'s links (pure). */
export function neighbourPrefetchPlan(zone: ZoneDef, flags: ReadonlySet<string>, catalog: SpriteCatalog | null, boundAtlases: ReadonlySet<string>): PrefetchPlan {
  const zones: ZoneId[] = [];
  for (const d of ['n', 'e', 's', 'w'] as const) {
    const to = zone.links[d];
    if (to !== undefined && !zones.includes(to)) zones.push(to);
  }
  const mine = new Set(zoneSurfaces(zoneSpecFor(zone, harvestStateFor(zone.id, flags))));
  const surfaces: SurfaceId[] = [];
  const atlasUrls: string[] = [];
  const atlasSeen = new Set<string>();
  for (const id of zones) {
    const nb = zoneDef(id);
    for (const s of zoneSurfaces(zoneSpecFor(nb, harvestStateFor(id, flags)))) if (!mine.has(s) && !surfaces.includes(s)) surfaces.push(s);
    for (const a of catalog?.zoneAtlases(id) ?? []) {
      if (boundAtlases.has(a) || atlasSeen.has(a)) continue;
      atlasSeen.add(a);
      const set = catalog?.atlas(a);
      if (set === null || set === undefined) continue;
      for (const m of [set.albedo, set.normal, set.emissive]) atlasUrls.push(m.url, ...m.mips);
    }
  }
  return { zones, surfaces, atlasUrls };
}

export interface PrefetchToken { cancelled: boolean }

export interface PrefetchDeps {
  /** `renderer.materials.prefetch` (absent → materials skipped) */
  readonly materials?: (ids: readonly SurfaceId[]) => Promise<number>;
  readonly fetch: (url: string) => Promise<number>;
  readonly wait: (ms: number) => Promise<void>;
  readonly now: () => number;
}

/** Fetches the plan (materials first, then atlases) into the HTTP cache; resolves with the bytes fetched. */
export async function runPrefetch(plan: PrefetchPlan, token: PrefetchToken, d: PrefetchDeps): Promise<number> {
  let bytes = 0;
  const t0 = d.now();
  const pace = async (): Promise<void> => {
    const due = (bytes / PREFETCH.bytesPerSecond) * 1000 - (d.now() - t0);
    if (due > 0) await d.wait(due);
  };
  if (d.materials !== undefined && plan.surfaces.length > 0 && !token.cancelled) {
    bytes += await d.materials(plan.surfaces).catch(() => 0);
    await pace();
  }
  for (const u of plan.atlasUrls) {
    if (token.cancelled) break;
    bytes += await d.fetch(u).catch(() => 0);
    await pace();
  }
  return bytes;
}

/** The browser fetcher: a low-priority GET whose body is read (so it lands in the cache) and dropped. */
export async function fetchIntoCache(url: string): Promise<number> {
  const r = await fetch(url, { priority: 'low' } as RequestInit);
  return (await r.arrayBuffer()).byteLength;
}
