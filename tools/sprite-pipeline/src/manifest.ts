/**
 * `creatures.manifest.json` v2 (spec §40.1.5) — the contract between this pipeline and the
 * client's sprite material. Everything is sorted by species id / atlas id / zone id and
 * carries no timestamps, so the same inputs always produce byte-identical output.
 *
 * The client (20-client.md §20.4.4 adapter) maps `ManifestSpriteV2` -> `SpriteDescriptor` by
 * copying `uv -> rect`, `footV`, `aspect` and looking up the `AtlasSet` from `atlases`.
 */
import { CREATURES_BUDGET_BYTES, MANIFEST_FOOT_V, MAX_ATLASES_PER_ZONE, compareStrings } from './types.js';
import { ZONE_ORDER } from './zones.js';

export type SpriteCodec = 'webp-lossy' | 'webp-lossless';

export interface SpriteRectV2 {
  readonly atlas: string; // ManifestAtlasV2.id
  readonly px: readonly [number, number, number, number]; // x, y, w, h in level-0 texels, y down
  readonly uv: readonly [number, number, number, number]; // u0, v0, u1, v1, v up — 10-render.md SpriteFrame.rect
  readonly footV: number; // from the bottom of the cell; 0.08
  readonly aspect: number; // w / h; 1
  readonly pixelScale: number; // output px per source px (QA only)
  readonly source: string; // relative to assets-src/creatures/ (QA only)
}

export interface ManifestMap {
  readonly url: string; // level 0, relative to the manifest, e.g. atlases/a-000.albedo.webp
  readonly mips: readonly string[]; // levels 1..3 (1024², 512², 256² for a 2048² atlas)
  readonly codec: SpriteCodec;
  readonly quality: number | null; // libwebp q for lossy, null for lossless
  readonly bytes: number; // sum over url + mips
}

export interface ManifestAtlasV2 {
  readonly id: string; // 'a-000' … 'a-064', or 'a-<zoneId>-dup-N' (§40.1.4)
  readonly species: readonly string[]; // the 1–2 species packed here, sorted
  readonly size: 2048; // level-0 texels per side
  readonly slots: number; // occupied 1024² cells, 2 or 4
  readonly albedo: ManifestMap; // sRGB, straight alpha
  readonly normal: ManifestMap; // NoColorSpace; half resolution (normalScale 0.5 → a 1024² file)
  readonly emissive: ManifestMap; // mask in R
  readonly normalScale: 0.5 | 1; // normal atlas texels per albedo texel
}

export interface ManifestSpriteV2 {
  readonly front: SpriteRectV2;
  readonly back: SpriteRectV2;
  readonly sizeScale: number; // SpeciesDef.sizeScale
  readonly home: string; // atlas id used for the runtime single set
  readonly thumb: string; // thumbs/<id>_front.webp, 128 px (20-client.md §20.10.2 rule 6)
  /**
   * Additive extension, present only when the planner duplicated this species into a
   * zone-local `a-<zoneId>-dup-N` atlas (§40.1.4): the rects of each duplicate, keyed by
   * atlas id. Absent from every entry when `duplicated` is empty (the measured tables).
   */
  readonly alt?: Readonly<Record<string, { readonly front: SpriteRectV2; readonly back: SpriteRectV2 }>>;
}

export interface SpriteManifestV2 {
  readonly version: 2;
  readonly encoding: 'webp';
  readonly spriteSize: 1024;
  readonly pipelineVersion: string; // PIPELINE_VERSION
  readonly atlases: readonly ManifestAtlasV2[]; // sorted by id
  readonly zones: Readonly<Record<string, readonly string[]>>; // ZoneId -> atlas ids (≤ 8, §40.1.4), all 21 zones present ([] allowed)
  readonly sprites: Readonly<Record<string, ManifestSpriteV2>>; // exactly the 130 species ids, sorted
  readonly totalBytes: number; // every file under public/creatures/
}
export const MANIFEST_FILE = 'creatures.manifest.json';

export interface ValidateOptions {
  /** The content species set; when given, `sprites` keys must equal it exactly. */
  species?: readonly string[];
  /** Zone ids that must all be present (default: the 21 of ZONE_ORDER). */
  zones?: readonly string[];
  budgetBytes?: number;
  /** Cell size (default 1024; tests build smaller fixtures). The atlas size is 2 × this. */
  spriteSize?: number;
}

const UV_EPS = 1e-9;

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}
function isTuple4(v: unknown): v is [number, number, number, number] {
  return Array.isArray(v) && v.length === 4 && v.every(isNum);
}

/** Every reason `m` is not a valid v2 manifest; empty when it is. */
export function manifestErrors(m: unknown, opts: ValidateOptions = {}): string[] {
  const errors: string[] = [];
  const err = (s: string): void => {
    errors.push(s);
  };
  if (typeof m !== 'object' || m === null) return ['manifest is not an object'];
  const o = m as Record<string, unknown>;
  if (o.version !== 2) err(`version ${String(o.version)} !== 2`);
  if (o.encoding !== 'webp') err(`encoding ${String(o.encoding)} !== 'webp'`);
  const spriteSize = opts.spriteSize ?? 1024;
  const size = spriteSize * 2;
  if (o.spriteSize !== spriteSize) err(`spriteSize ${String(o.spriteSize)} !== ${spriteSize}`);
  if (typeof o.pipelineVersion !== 'string') err('pipelineVersion missing');
  if (!isNum(o.totalBytes)) err('totalBytes missing');
  else if (o.totalBytes > (opts.budgetBytes ?? CREATURES_BUDGET_BYTES)) err(`totalBytes ${o.totalBytes} > budget ${opts.budgetBytes ?? CREATURES_BUDGET_BYTES}`);

  const atlases = new Map<string, Record<string, unknown>>();
  if (!Array.isArray(o.atlases)) err('atlases is not an array');
  else {
    let prev = '';
    for (const a of o.atlases as Array<Record<string, unknown>>) {
      if (typeof a.id !== 'string') {
        err('atlas without id');
        continue;
      }
      if (a.id <= prev) err(`atlases not sorted by id at ${a.id}`);
      prev = a.id;
      if (a.size !== size) err(`atlas ${a.id}: size ${String(a.size)} !== ${size}`);
      if (a.normalScale !== 0.5 && a.normalScale !== 1) err(`atlas ${a.id}: normalScale ${String(a.normalScale)}`);
      if (!Array.isArray(a.species) || a.species.length < 1 || a.species.length > 2) err(`atlas ${a.id}: species must hold 1–2 ids`);
      if (a.slots !== 2 && a.slots !== 4) err(`atlas ${a.id}: slots ${String(a.slots)}`);
      for (const k of ['albedo', 'normal', 'emissive'] as const) {
        const map = a[k] as Record<string, unknown> | undefined;
        if (!map || typeof map !== 'object') {
          err(`atlas ${a.id}: ${k} map missing`);
          continue;
        }
        if (typeof map.url !== 'string') err(`atlas ${a.id}.${k}: url missing`);
        if (!Array.isArray(map.mips) || !map.mips.every((s) => typeof s === 'string')) err(`atlas ${a.id}.${k}: mips missing`);
        if (map.codec !== 'webp-lossy' && map.codec !== 'webp-lossless') err(`atlas ${a.id}.${k}: codec ${String(map.codec)}`);
        if (map.codec === 'webp-lossless' ? map.quality !== null : !isNum(map.quality)) err(`atlas ${a.id}.${k}: quality/codec mismatch`);
        if (!isNum(map.bytes)) err(`atlas ${a.id}.${k}: bytes missing`);
      }
      atlases.set(a.id, a);
    }
  }

  const zoneIds = opts.zones ?? ZONE_ORDER;
  if (typeof o.zones !== 'object' || o.zones === null) err('zones missing');
  else {
    const zones = o.zones as Record<string, unknown>;
    for (const z of zoneIds) if (!(z in zones)) err(`zones: ${z} missing`);
    for (const [z, list] of Object.entries(zones)) {
      if (!Array.isArray(list) || !list.every((a) => typeof a === 'string' && atlases.has(a))) err(`zones.${z}: unresolved atlas reference`);
      else if (list.length > MAX_ATLASES_PER_ZONE) err(`zones.${z}: ${list.length} atlases > ${MAX_ATLASES_PER_ZONE}`);
    }
  }

  if (typeof o.sprites !== 'object' || o.sprites === null) err('sprites missing');
  else {
    const sprites = o.sprites as Record<string, Record<string, unknown>>;
    const keys = Object.keys(sprites);
    const sorted = [...keys].sort(compareStrings);
    if (keys.some((k, i) => k !== sorted[i])) err('sprites keys are not sorted');
    if (opts.species) {
      const want = [...opts.species].sort(compareStrings);
      if (want.length !== sorted.length || want.some((k, i) => k !== sorted[i])) {
        const missing = want.filter((k) => !keys.includes(k));
        const extra = keys.filter((k) => !want.includes(k));
        err(`sprites keys != species set (missing: ${missing.join(',') || '-'}; extra: ${extra.join(',') || '-'})`);
      }
    }
    const checkRect = (id: string, side: string, r: unknown, atlasId?: string): void => {
      if (typeof r !== 'object' || r === null) {
        err(`${id}.${side}: missing`);
        return;
      }
      const x = r as Record<string, unknown>;
      if (typeof x.atlas !== 'string' || !atlases.has(x.atlas)) err(`${id}.${side}: atlas ${String(x.atlas)} unresolved`);
      else if (atlasId && x.atlas !== atlasId) err(`${id}.${side}: atlas ${x.atlas} !== ${atlasId}`);
      else {
        const species = atlases.get(x.atlas)!.species as string[];
        if (!species.includes(id)) err(`${id}.${side}: atlas ${x.atlas} does not list ${id}`);
      }
      const pxT = x.px;
      const uvT = x.uv;
      if (!isTuple4(pxT) || !isTuple4(uvT)) {
        err(`${id}.${side}: px/uv missing`);
        return;
      }
      const [px, py, pw, ph] = pxT;
      const want = [px / size, 1 - (py + ph) / size, (px + pw) / size, 1 - py / size];
      if (want.some((v, i) => Math.abs(v - uvT[i]!) > UV_EPS)) err(`${id}.${side}: uv inconsistent with px`);
      if (x.footV !== MANIFEST_FOOT_V) err(`${id}.${side}: footV ${String(x.footV)} !== ${MANIFEST_FOOT_V}`);
      if (!isNum(x.aspect) || Math.abs(x.aspect - pw / ph) > UV_EPS) err(`${id}.${side}: aspect`);
      if (!isNum(x.pixelScale) || typeof x.source !== 'string') err(`${id}.${side}: pixelScale/source`);
    };
    for (const id of keys) {
      const s = sprites[id]!;
      checkRect(id, 'front', s.front);
      checkRect(id, 'back', s.back);
      if (!isNum(s.sizeScale)) err(`${id}: sizeScale missing`);
      if (typeof s.home !== 'string' || !atlases.has(s.home)) err(`${id}: home ${String(s.home)} unresolved`);
      if (typeof s.thumb !== 'string') err(`${id}: thumb missing`);
      if (s.alt !== undefined) {
        if (typeof s.alt !== 'object' || s.alt === null) err(`${id}: alt malformed`);
        else {
          for (const [atlasId, pair] of Object.entries(s.alt as Record<string, Record<string, unknown>>)) {
            checkRect(id, `alt.${atlasId}.front`, pair.front, atlasId);
            checkRect(id, `alt.${atlasId}.back`, pair.back, atlasId);
          }
        }
      }
    }
  }
  return errors;
}

/** Structural validation used by tests and by the build before writing. */
export function validateManifest(m: unknown, opts: ValidateOptions = {}): m is SpriteManifestV2 {
  return manifestErrors(m, opts).length === 0;
}

function sortedRecord<T>(rec: Readonly<Record<string, T>>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const k of Object.keys(rec).sort(compareStrings)) out[k] = rec[k]!;
  return out;
}

function orderedRect(r: SpriteRectV2): SpriteRectV2 {
  return { atlas: r.atlas, px: r.px, uv: r.uv, footV: r.footV, aspect: r.aspect, pixelScale: r.pixelScale, source: r.source };
}

function orderedMap(m: ManifestMap): ManifestMap {
  return { url: m.url, mips: m.mips, codec: m.codec, quality: m.quality, bytes: m.bytes };
}

/** Deterministic JSON: every key order fixed, arrays sorted, 2-space indent, trailing LF. */
export function serializeManifest(m: SpriteManifestV2): string {
  const sprites: Record<string, ManifestSpriteV2> = {};
  for (const id of Object.keys(m.sprites).sort(compareStrings)) {
    const s = m.sprites[id]!;
    const alt = s.alt
      ? sortedRecord(Object.fromEntries(Object.entries(s.alt).map(([k, v]) => [k, { front: orderedRect(v.front), back: orderedRect(v.back) }])))
      : undefined;
    sprites[id] = {
      front: orderedRect(s.front),
      back: orderedRect(s.back),
      sizeScale: s.sizeScale,
      home: s.home,
      thumb: s.thumb,
      ...(alt && Object.keys(alt).length ? { alt } : {}),
    };
  }
  const ordered: SpriteManifestV2 = {
    version: 2,
    encoding: 'webp',
    spriteSize: 1024,
    pipelineVersion: m.pipelineVersion,
    atlases: [...m.atlases]
      .sort((a, b) => compareStrings(a.id, b.id))
      .map((a) => ({
        id: a.id,
        species: [...a.species].sort(compareStrings),
        size: a.size,
        slots: a.slots,
        albedo: orderedMap(a.albedo),
        normal: orderedMap(a.normal),
        emissive: orderedMap(a.emissive),
        normalScale: a.normalScale,
      })),
    zones: sortedRecord(Object.fromEntries(Object.entries(m.zones).map(([z, list]) => [z, [...list].sort(compareStrings)]))),
    sprites,
    totalBytes: m.totalBytes,
  };
  return `${JSON.stringify(ordered, null, 2)}\n`;
}

/** `px` -> `uv` (v up) for a `size`² atlas. */
export function pxToUv(px: readonly [number, number, number, number], size: number): [number, number, number, number] {
  const [x, y, w, h] = px;
  return [x / size, 1 - (y + h) / size, (x + w) / size, 1 - y / size];
}
