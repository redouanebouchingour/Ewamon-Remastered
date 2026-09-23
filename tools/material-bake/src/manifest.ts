/** `materials.manifest.json` (SPEC §40.3.4, shape verbatim) and the deterministic JSON writer (§40.0.2). */

export interface MaterialTier {
  readonly albedo: string; readonly orm: string; readonly normal: string;   // urls relative to the manifest
  readonly size: 512 | 1024;
  readonly bytes: number;                                                    // sum of the three files
}
export interface MaterialSetEntry {
  readonly field: MaterialTier;                                              // always present
  readonly hero: MaterialTier | null;                                        // null unless SurfaceDef.hero
  readonly metres: number; readonly wrap: 'repeat' | 'clamp';
  readonly hash: string;                                                     // sha256(recipe source, SurfaceDef JSON, tiers, encoder settingsKey) — the cache key and the client's cache-buster
  readonly albedoClampedPct: number;                                         // texels moved to the 0.85 ceiling (hero tier when present, else field)
}
export interface MaterialsManifest {
  readonly version: 2;
  readonly surfaces: Readonly<Record<string, MaterialSetEntry>>;             // every SurfaceId
  readonly byBiome: Readonly<Record<string, readonly string[]>>;             // 10-render.md §10.2.2 rows (each including the 6 shared ids), for 20-client.md §20.10.3 phase-2 preload
  readonly placeholder: { readonly albedo: string; readonly orm: string; readonly normal: string };
  readonly fieldBytes: number; readonly heroBytes: number; readonly totalBytes: number;
}

export const MANIFEST_FILE = 'materials.manifest.json';

export const tierFiles = (id: string, tier: 'field' | 'hero'): { albedo: string; orm: string; normal: string } => ({
  albedo: `${id}.${tier}_albedo.ktx2`,
  orm: `${id}.${tier}_orm.ktx2`,
  normal: `${id}.${tier}_normal.ktx2`,
});

export const PLACEHOLDER_FILES = { albedo: 'placeholder_albedo.ktx2', orm: 'placeholder_orm.ktx2', normal: 'placeholder_normal.ktx2' } as const;

/** JSON with object keys sorted at every depth, 2-space indent, trailing LF. */
export function stableJson(value: unknown): string {
  return `${JSON.stringify(sortKeys(value), null, 2)}\n`;
}

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o).sort()) out[k] = sortKeys(o[k]);
    return out;
  }
  return v;
}

/** Structural validation of a parsed manifest (used by the report and the tests). Returns problems. */
export function validateManifest(m: unknown): string[] {
  const errs: string[] = [];
  const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
  if (!isObj(m)) return ['manifest is not an object'];
  if (m.version !== 2) errs.push('version !== 2');
  for (const k of ['fieldBytes', 'heroBytes', 'totalBytes']) if (typeof m[k] !== 'number') errs.push(`${k} missing`);
  if (!isObj(m.placeholder)) errs.push('placeholder missing');
  if (!isObj(m.byBiome)) errs.push('byBiome missing');
  if (!isObj(m.surfaces)) return [...errs, 'surfaces missing'];
  const tierOk = (t: unknown, size: number, where: string): void => {
    if (!isObj(t)) { errs.push(`${where}: not an object`); return; }
    for (const k of ['albedo', 'orm', 'normal']) if (typeof t[k] !== 'string') errs.push(`${where}.${k} missing`);
    if (t.size !== size) errs.push(`${where}.size !== ${size}`);
    if (typeof t.bytes !== 'number' || !(t.bytes > 0)) errs.push(`${where}.bytes invalid`);
  };
  for (const [id, e] of Object.entries(m.surfaces)) {
    if (!isObj(e)) { errs.push(`${id}: not an object`); continue; }
    tierOk(e.field, 512, `${id}.field`);
    if (e.hero !== null) tierOk(e.hero, 1024, `${id}.hero`);
    if (typeof e.metres !== 'number') errs.push(`${id}.metres missing`);
    if (e.wrap !== 'repeat' && e.wrap !== 'clamp') errs.push(`${id}.wrap invalid`);
    if (typeof e.hash !== 'string' || !/^[0-9a-f]{64}$/.test(e.hash)) errs.push(`${id}.hash invalid`);
    if (typeof e.albedoClampedPct !== 'number') errs.push(`${id}.albedoClampedPct missing`);
    const keys = Object.keys(e).sort().join(',');
    if (keys !== 'albedoClampedPct,field,hash,hero,metres,wrap') errs.push(`${id}: unexpected keys ${keys}`);
  }
  return errs;
}
