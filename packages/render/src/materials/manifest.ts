/**
 * `materials.manifest.json` — the material-bake output contract (SPEC §40.3.4), declared here because
 * render may not import `tools/`. Pure TypeScript: parsing and URL planning are node-testable.
 *
 * Degradation rule (the library's, not the SPEC's wording): a missing / unparsable manifest or a
 * surface absent from it never throws at runtime — the affected materials stay on the placeholder set
 * and a warning is recorded, so the renderer keeps drawing while the bake catches up.
 */
import { isSurfaceId, type SurfaceId } from './surfaces.js';

/** SPEC §40.3.4, verbatim. */
export interface MaterialTier {
  readonly albedo: string; readonly orm: string; readonly normal: string;   // urls relative to the manifest
  readonly size: 512 | 1024;
  readonly bytes: number;                                                    // sum of the three files
}
/** SPEC §40.3.4, verbatim. */
export interface MaterialSetEntry {
  readonly field: MaterialTier;                                              // always present
  readonly hero: MaterialTier | null;                                        // null unless SurfaceDef.hero
  readonly metres: number; readonly wrap: 'repeat' | 'clamp';
  readonly hash: string;                                                     // sha256(recipe source, SurfaceDef JSON, tiers, encoder settingsKey) — the cache key and the client's cache-buster
  readonly albedoClampedPct: number;                                         // texels moved to the 0.85 ceiling (hero tier when present, else field)
}
/** SPEC §40.3.4, verbatim. */
export interface MaterialsManifest {
  readonly version: 2;
  readonly surfaces: Readonly<Record<string, MaterialSetEntry>>;             // every SurfaceId
  readonly byBiome: Readonly<Record<string, readonly string[]>>;             // 10-render.md §10.2.2 rows (each including the 6 shared ids), for 20-client.md §20.10.3 phase-2 preload
  readonly placeholder: { readonly albedo: string; readonly orm: string; readonly normal: string };
  readonly fieldBytes: number; readonly heroBytes: number; readonly totalBytes: number;
}

export type TierName = 'field' | 'hero';
export type MapName = 'albedo' | 'orm' | 'normal';
export const MAP_NAMES: readonly MapName[] = ['albedo', 'orm', 'normal'];

export const MANIFEST_FILE = 'materials.manifest.json';

/** §40.3.4 file names of the 4×4 neutral set, used when the manifest itself is unavailable. */
export const DEFAULT_PLACEHOLDER: MaterialsManifest['placeholder'] = Object.freeze({
  albedo: 'placeholder_albedo.ktx2',
  orm: 'placeholder_orm.ktx2',
  normal: 'placeholder_normal.ktx2',
});

/** §10.2.3: the neutral set's texel values (albedo #808080, ORM (1, 0.5, 0), normal (0.5, 0.5, 1)), 0..255. */
export const PLACEHOLDER_TEXELS: Readonly<Record<MapName, readonly [number, number, number, number]>> = Object.freeze({
  albedo: [128, 128, 128, 255],
  orm: [255, 128, 0, 255],
  normal: [128, 128, 255, 255],
});

export interface ParsedManifest {
  readonly manifest: MaterialsManifest | null;
  /** Human-readable problems; the manifest is still usable when non-null. */
  readonly errors: readonly string[];
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function parseTier(v: unknown, where: string, errors: string[]): MaterialTier | null {
  if (!isObj(v)) { errors.push(`${where}: not an object`); return null; }
  const { albedo, orm, normal, size, bytes } = v;
  if (!isStr(albedo) || !isStr(orm) || !isStr(normal)) { errors.push(`${where}: albedo/orm/normal must be non-empty strings`); return null; }
  if (size !== 512 && size !== 1024) { errors.push(`${where}: size must be 512 or 1024`); return null; }
  if (!isNum(bytes) || bytes < 0) { errors.push(`${where}: bytes must be a non-negative number`); return null; }
  return { albedo, orm, normal, size, bytes };
}

function parseEntry(id: string, v: unknown, errors: string[]): MaterialSetEntry | null {
  const where = `surfaces.${id}`;
  if (!isObj(v)) { errors.push(`${where}: not an object`); return null; }
  const field = parseTier(v.field, `${where}.field`, errors);
  if (field === null) return null;
  let hero: MaterialTier | null = null;
  if (v.hero !== null && v.hero !== undefined) {
    hero = parseTier(v.hero, `${where}.hero`, errors);   // a broken hero tier degrades to field-only
  }
  const metres = isNum(v.metres) && v.metres > 0 ? v.metres : 1;
  const wrap = v.wrap === 'clamp' ? 'clamp' : 'repeat';
  const hash = isStr(v.hash) ? v.hash : '';
  const albedoClampedPct = isNum(v.albedoClampedPct) ? v.albedoClampedPct : 0;
  return { field, hero, metres, wrap, hash, albedoClampedPct };
}

/**
 * Validates a decoded `materials.manifest.json`. Entries that fail validation are dropped (their
 * surfaces fall back to the placeholder); ids that are not `SurfaceId`s are reported and ignored.
 */
export function parseMaterialsManifest(json: unknown): ParsedManifest {
  const errors: string[] = [];
  if (!isObj(json)) return { manifest: null, errors: ['manifest: not an object'] };
  if (json.version !== 2) return { manifest: null, errors: [`manifest: version ${String(json.version)} is not 2`] };

  const surfaces: Record<string, MaterialSetEntry> = {};
  if (isObj(json.surfaces)) {
    for (const id of Object.keys(json.surfaces).sort()) {
      if (!isSurfaceId(id)) { errors.push(`surfaces.${id}: not a SurfaceId (ignored)`); continue; }
      const e = parseEntry(id, json.surfaces[id], errors);
      if (e !== null) surfaces[id] = e;
    }
  } else {
    errors.push('manifest: surfaces missing');
  }

  const byBiome: Record<string, readonly string[]> = {};
  if (isObj(json.byBiome)) {
    for (const b of Object.keys(json.byBiome).sort()) {
      const list = json.byBiome[b];
      if (Array.isArray(list)) byBiome[b] = list.filter((x): x is string => typeof x === 'string');
    }
  }

  let placeholder = DEFAULT_PLACEHOLDER;
  if (isObj(json.placeholder) && isStr(json.placeholder.albedo) && isStr(json.placeholder.orm) && isStr(json.placeholder.normal)) {
    placeholder = { albedo: json.placeholder.albedo, orm: json.placeholder.orm, normal: json.placeholder.normal };
  } else {
    errors.push('manifest: placeholder missing or invalid (using default file names)');
  }

  const fieldBytes = isNum(json.fieldBytes) ? json.fieldBytes : 0;
  const heroBytes = isNum(json.heroBytes) ? json.heroBytes : 0;
  const totalBytes = isNum(json.totalBytes) ? json.totalBytes : fieldBytes + heroBytes;

  return { manifest: { version: 2, surfaces, byBiome, placeholder, fieldBytes, heroBytes, totalBytes }, errors };
}

/** Ensures a trailing slash (`'/materials'` → `'/materials/'`). */
export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

/** Resolves a manifest-relative url against the base (absolute urls and root-relative paths pass through). */
export function resolveUrl(baseUrl: string, rel: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(rel) || rel.startsWith('/')) return rel;
  return normalizeBaseUrl(baseUrl) + rel;
}

/** Appends the entry hash as a cache-buster (§40.3.4 "the client's cache-buster"). */
export function withCacheBuster(url: string, hash: string): string {
  if (hash.length === 0) return url;
  return `${url}${url.includes('?') ? '&' : '?'}h=${encodeURIComponent(hash.slice(0, 16))}`;
}

export interface TierUrls { readonly albedo: string; readonly orm: string; readonly normal: string; readonly bytes: number; readonly size: 512 | 1024 }

/**
 * The three urls to load for `(id, tier)`, or `null` when the manifest has no such set (the material
 * stays on the placeholder — or, for `hero`, on its field tier).
 */
export function planTierUrls(manifest: MaterialsManifest | null, baseUrl: string, id: SurfaceId, tier: TierName): TierUrls | null {
  if (manifest === null) return null;
  const entry = manifest.surfaces[id];
  if (entry === undefined) return null;
  const t = tier === 'field' ? entry.field : entry.hero;
  if (t === null) return null;
  return {
    albedo: withCacheBuster(resolveUrl(baseUrl, t.albedo), entry.hash),
    orm: withCacheBuster(resolveUrl(baseUrl, t.orm), entry.hash),
    normal: withCacheBuster(resolveUrl(baseUrl, t.normal), entry.hash),
    bytes: t.bytes,
    size: t.size,
  };
}

export function placeholderUrls(manifest: MaterialsManifest | null, baseUrl: string): Record<MapName, string> {
  const p = manifest?.placeholder ?? DEFAULT_PLACEHOLDER;
  return { albedo: resolveUrl(baseUrl, p.albedo), orm: resolveUrl(baseUrl, p.orm), normal: resolveUrl(baseUrl, p.normal) };
}
