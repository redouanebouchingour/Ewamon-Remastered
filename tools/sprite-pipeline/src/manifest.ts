/**
 * `creatures.manifest.json` v2 (spec §40.1.5) — the contract between this pipeline and the
 * client's sprite material. Everything is sorted by species id / atlas id / zone id and
 * carries no timestamps, so the same inputs always produce byte-identical output.
 *
 * The client (20-client.md §20.4.4 adapter) maps `ManifestSpriteV2` -> `SpriteDescriptor` by
 * copying `uv -> rect`, `footV`, `aspect` and looking up the `AtlasSet` from `atlases`.
 */
import { ANIM_BUDGET_BYTES, ANIM_CELL_DIVISOR, ANIM_DIR, ANIM_MAX_EDGE, CREATURES_BUDGET_BYTES, MANIFEST_FOOT_V, MAX_ATLASES_PER_ZONE, compareStrings } from './types.js';
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
  /**
   * Additive extension (spec §40.1.5 as amended 2026-10-06): present only for a species whose source is a GIF /
   * animated WebP — every page of the side as a flipbook in its own anim atlas. The static `front`/`back` rects keep
   * showing the frame-select page (`staticFrame`), at the same place in the cell.
   */
  readonly anim?: ManifestAnimSprite;
}

export interface ManifestAnimSprite {
  readonly front?: ManifestAnimSide;
  readonly back?: ManifestAnimSide;
}

export interface ManifestAnimSide {
  readonly atlas: string; // ManifestAnimAtlas.id, 'anim-<species>-<side>'
  readonly frames: readonly (readonly [number, number, number, number])[]; // uv (u0, v0, u1, v1, v up) per source page, in page order
  readonly delays: readonly number[]; // display ms per page (sharp `delay`; < 20 ms shows as 100 ms)
  readonly staticFrame: number; // the frame-select page: the static rect shows this frame
  readonly footV: number; // 0.08, as the static rect: the shared transform keeps the feet on the static foot line
  readonly aspect: number; // 1
  readonly pixelScale: number; // anim texels per source px (QA only)
  readonly source: string; // relative to assets-src/creatures/ (QA only)
}

/** One side's flipbook: a cols × rows grid of `cell`² frames in page order (non-square allowed). */
export interface ManifestAnimAtlas {
  readonly id: string; // 'anim-<species>-<side>'
  readonly species: string;
  readonly side: 'front' | 'back';
  readonly width: number; // level-0 texels
  readonly height: number;
  readonly cell: number; // 512 = spriteSize / 2
  readonly slots: number; // occupied cells = the side's page count
  readonly albedo: ManifestMap; // anim/<species>-<side>.albedo.webp + .m1..m3
  readonly normal: ManifestMap; // half resolution
  readonly emissive: ManifestMap;
  readonly normalScale: 0.5;
}

export interface SpriteManifestV2 {
  readonly version: 2;
  readonly encoding: 'webp';
  readonly spriteSize: 1024;
  readonly pipelineVersion: string; // PIPELINE_VERSION
  readonly atlases: readonly ManifestAtlasV2[]; // sorted by id
  readonly zones: Readonly<Record<string, readonly string[]>>; // ZoneId -> atlas ids (≤ 8, §40.1.4), all 21 zones present ([] allowed)
  readonly sprites: Readonly<Record<string, ManifestSpriteV2>>; // exactly the 130 species ids, sorted
  readonly totalBytes: number; // every static file under public/creatures/ (all but anim/) + the manifest without its anim fields
  /** Sorted by id; present iff some sprite has `anim`. */
  readonly animAtlases?: readonly ManifestAnimAtlas[];
  /** Every file under public/creatures/anim/ + the manifest bytes its anim fields add (the §40.6 anim line). */
  readonly animTotalBytes?: number;
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
  /** Ceiling for `animTotalBytes` (default ANIM_BUDGET_BYTES, 24 MiB). */
  animBudgetBytes?: number;
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
  animErrors(o, spriteSize, opts, err);
  return errors;
}

/**
 * The anim extension (§40.1.5 as amended 2026-10-06), as strict as the static part: `animAtlases` and `animTotalBytes`
 * are present iff some sprite has `anim`; every anim atlas is a tight cols × rows grid of `spriteSize / 2` cells within
 * ANIM_MAX_EDGE, its maps live under `anim/`, and it is referenced by exactly one sprite side, whose `frames` are the
 * grid's cells in raster order (one per source page), with a positive integer delay each and a `staticFrame` among
 * them; `animTotalBytes ≤ animBudgetBytes`.
 */
function animErrors(o: Record<string, unknown>, spriteSize: number, opts: ValidateOptions, err: (s: string) => void): void {
  const sprites = (typeof o.sprites === 'object' && o.sprites !== null ? o.sprites : {}) as Record<string, Record<string, unknown>>;
  const withAnim = Object.keys(sprites).filter((id) => sprites[id]!.anim !== undefined);
  const hasAtlases = o.animAtlases !== undefined;
  const hasTotal = o.animTotalBytes !== undefined;
  if (!hasAtlases && !hasTotal && withAnim.length === 0) return;
  if (!hasAtlases) err('animAtlases missing while sprites carry anim');
  if (!hasTotal) err('animTotalBytes missing');
  else if (!isNum(o.animTotalBytes) || o.animTotalBytes < 0) err('animTotalBytes is not a number');
  else if (o.animTotalBytes > (opts.animBudgetBytes ?? ANIM_BUDGET_BYTES)) err(`animTotalBytes ${o.animTotalBytes} > anim budget ${opts.animBudgetBytes ?? ANIM_BUDGET_BYTES}`);
  if (withAnim.length === 0) err('animAtlases present but no sprite has anim');
  const cell = spriteSize / ANIM_CELL_DIVISOR;
  const atlases = new Map<string, Record<string, unknown>>();
  if (hasAtlases && !Array.isArray(o.animAtlases)) err('animAtlases is not an array');
  else if (hasAtlases) {
    let prev = '';
    for (const a of o.animAtlases as Array<Record<string, unknown>>) {
      if (typeof a.id !== 'string') {
        err('anim atlas without id');
        continue;
      }
      if (a.id <= prev) err(`animAtlases not sorted by id at ${a.id}`);
      prev = a.id;
      const tag = `anim atlas ${a.id}`;
      if (typeof a.species !== 'string' || !(a.species in sprites)) err(`${tag}: species ${String(a.species)} unknown`);
      if (a.side !== 'front' && a.side !== 'back') err(`${tag}: side ${String(a.side)}`);
      else if (a.id !== `anim-${String(a.species)}-${a.side}`) err(`${tag}: id !== anim-<species>-<side>`);
      if (a.cell !== cell) err(`${tag}: cell ${String(a.cell)} !== ${cell}`);
      if (a.normalScale !== 0.5) err(`${tag}: normalScale ${String(a.normalScale)} !== 0.5`);
      const w = a.width;
      const h = a.height;
      const slots = a.slots;
      if (!isNum(w) || !isNum(h) || w % cell !== 0 || h % cell !== 0 || w <= 0 || h <= 0) err(`${tag}: ${String(w)}×${String(h)} is not a grid of ${cell}² cells`);
      else if (w > ANIM_MAX_EDGE || h > ANIM_MAX_EDGE) err(`${tag}: ${w}×${h} exceeds ${ANIM_MAX_EDGE}`);
      else if (!Number.isInteger(slots) || (slots as number) < 2 || (slots as number) > (w / cell) * (h / cell) || (slots as number) <= (w / cell) * (h / cell - 1)) {
        err(`${tag}: slots ${String(slots)} do not fill the ${w / cell}×${h / cell} grid (the last row is the only partial one)`);
      }
      for (const k of ['albedo', 'normal', 'emissive'] as const) {
        const map = a[k] as Record<string, unknown> | undefined;
        if (!map || typeof map !== 'object') {
          err(`${tag}: ${k} map missing`);
          continue;
        }
        if (typeof map.url !== 'string' || !map.url.startsWith(`${ANIM_DIR}/`)) err(`${tag}.${k}: url must live under ${ANIM_DIR}/`);
        if (!Array.isArray(map.mips) || map.mips.length !== 3 || !map.mips.every((s) => typeof s === 'string' && s.startsWith(`${ANIM_DIR}/`))) err(`${tag}.${k}: 3 mips under ${ANIM_DIR}/ expected`);
        if (map.codec !== 'webp-lossy' && map.codec !== 'webp-lossless') err(`${tag}.${k}: codec ${String(map.codec)}`);
        if (map.codec === 'webp-lossless' ? map.quality !== null : !isNum(map.quality)) err(`${tag}.${k}: quality/codec mismatch`);
        if (!isNum(map.bytes)) err(`${tag}.${k}: bytes missing`);
      }
      atlases.set(a.id, a);
    }
  }
  const referenced = new Map<string, number>();
  for (const id of withAnim) {
    const anim = sprites[id]!.anim as Record<string, unknown> | null;
    if (typeof anim !== 'object' || anim === null) {
      err(`${id}.anim: malformed`);
      continue;
    }
    const sides = Object.keys(anim);
    if (sides.length === 0 || sides.some((s) => s !== 'front' && s !== 'back')) err(`${id}.anim: needs front and/or back only`);
    for (const side of ['front', 'back'] as const) {
      const r = anim[side] as Record<string, unknown> | undefined;
      if (r === undefined) continue;
      const tag = `${id}.anim.${side}`;
      if (typeof r !== 'object' || r === null) {
        err(`${tag}: malformed`);
        continue;
      }
      const a = typeof r.atlas === 'string' ? atlases.get(r.atlas) : undefined;
      if (!a) {
        err(`${tag}: atlas ${String(r.atlas)} unresolved`);
        continue;
      }
      referenced.set(a.id as string, (referenced.get(a.id as string) ?? 0) + 1);
      if (a.species !== id || a.side !== side) err(`${tag}: atlas ${String(a.id)} belongs to ${String(a.species)}/${String(a.side)}`);
      const frames = r.frames;
      const W = a.width as number;
      const H = a.height as number;
      const cols = W / cell;
      if (!Array.isArray(frames) || frames.length !== a.slots) err(`${tag}: ${Array.isArray(frames) ? frames.length : 'no'} frames, atlas has ${String(a.slots)} slots`);
      else {
        frames.forEach((uv, i) => {
          const px = [(i % cols) * cell, Math.floor(i / cols) * cell, cell, cell] as const;
          const want = [px[0] / W, 1 - (px[1] + px[3]) / H, (px[0] + px[2]) / W, 1 - px[1] / H];
          if (!isTuple4(uv) || want.some((v, j) => Math.abs(v - uv[j]!) > UV_EPS)) err(`${tag}: frame ${i} uv is not grid cell ${i} (raster order)`);
        });
      }
      const delays = r.delays;
      if (!Array.isArray(delays) || !Array.isArray(frames) || delays.length !== frames.length) err(`${tag}: delays must hold one entry per frame`);
      else if (!delays.every((d) => Number.isInteger(d) && (d as number) >= 1)) err(`${tag}: delays must be positive integers (ms)`);
      if (!Number.isInteger(r.staticFrame) || (r.staticFrame as number) < 0 || !Array.isArray(frames) || (r.staticFrame as number) >= frames.length) err(`${tag}: staticFrame ${String(r.staticFrame)} out of range`);
      if (r.footV !== MANIFEST_FOOT_V) err(`${tag}: footV ${String(r.footV)} !== ${MANIFEST_FOOT_V}`);
      if (r.aspect !== 1) err(`${tag}: aspect ${String(r.aspect)} !== 1`);
      if (!isNum(r.pixelScale) || typeof r.source !== 'string') err(`${tag}: pixelScale/source`);
    }
  }
  for (const id of atlases.keys()) if ((referenced.get(id) ?? 0) !== 1) err(`anim atlas ${id}: referenced ${referenced.get(id) ?? 0} times (exactly 1 expected)`);
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
      ...(s.anim ? { anim: orderedAnimSprite(s.anim) } : {}),
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
    ...(m.animAtlases ? { animAtlases: [...m.animAtlases].sort((a, b) => compareStrings(a.id, b.id)).map(orderedAnimAtlas) } : {}),
    ...(m.animTotalBytes !== undefined ? { animTotalBytes: m.animTotalBytes } : {}),
  };
  return `${JSON.stringify(ordered, null, 2)}\n`;
}

function orderedAnimSide(r: ManifestAnimSide): ManifestAnimSide {
  return {
    atlas: r.atlas,
    frames: r.frames,
    delays: r.delays,
    staticFrame: r.staticFrame,
    footV: r.footV,
    aspect: r.aspect,
    pixelScale: r.pixelScale,
    source: r.source,
  };
}

function orderedAnimSprite(a: ManifestAnimSprite): ManifestAnimSprite {
  return { ...(a.front ? { front: orderedAnimSide(a.front) } : {}), ...(a.back ? { back: orderedAnimSide(a.back) } : {}) };
}

function orderedAnimAtlas(a: ManifestAnimAtlas): ManifestAnimAtlas {
  return {
    id: a.id,
    species: a.species,
    side: a.side,
    width: a.width,
    height: a.height,
    cell: a.cell,
    slots: a.slots,
    albedo: orderedMap(a.albedo),
    normal: orderedMap(a.normal),
    emissive: orderedMap(a.emissive),
    normalScale: a.normalScale,
  };
}

/**
 * The static manifest: `m` without its anim extension (no `sprites[*].anim`, `animAtlases`, `animTotalBytes`). Its
 * serialisation is byte-identical to what the pipeline wrote before the extension existed, and its length is what
 * `totalBytes` counts for the manifest.
 */
export function staticManifest(m: SpriteManifestV2): SpriteManifestV2 {
  const sprites: Record<string, ManifestSpriteV2> = {};
  for (const [id, s] of Object.entries(m.sprites)) {
    const { anim: _anim, ...rest } = s;
    sprites[id] = rest;
  }
  const { animAtlases: _a, animTotalBytes: _t, ...rest } = m;
  return { ...rest, sprites };
}

/** `px` -> `uv` (v up) for a `size`² atlas. */
export function pxToUv(px: readonly [number, number, number, number], size: number): [number, number, number, number] {
  const [x, y, w, h] = px;
  return [x / size, 1 - (y + h) / size, (x + w) / size, 1 - y / size];
}
