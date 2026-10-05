/**
 * SPEC §10.4.1 / §10.4.3 — creature atlas sets: WebP level 0 + the pipeline-built mip levels 1..3 of three maps
 * (albedo sRGB, half-resolution normal NoColorSpace, emissive mask in R), decoded to `ImageBitmap`s and uploaded
 * as ordinary textures with `generateMipmaps = false`. Atlases and runtime "singles" (§10.4.1 party crops) live in
 * a refcounted cache; a set is disposed when its last bind is released AND no billboard still samples it.
 *
 * three 0.186 facts (verified in node_modules, IMPLEMENTATION-NOTES "Part 3"):
 * - `Textures.getMipLevels` uses `texture.mipmaps.length` as the level count and `WebGPUTextureUtils.updateTexture`
 *   uploads `mipmaps[i]` to level i — so `mipmaps` must hold level 0 too: `[l0, l1, l2, l3]`, not the SPEC's
 *   `[level1, level2, level3]` (that would upload level 1 into level 0 and drop the last level).
 * - `copyExternalImageToTexture` honours `flipY`, but the WebGL2 fallback ignores `UNPACK_FLIP_Y` for
 *   `ImageBitmap`s; the decoder therefore flips at decode time (`imageOrientation: 'flipY'`) and textures keep
 *   `flipY = false`, which gives the manifest's v-up `uv` rects on both backends.
 * - `RedFormat` + `UnsignedByteType` maps to `r8unorm`, a valid `copyExternalImageToTexture` destination.
 */
import {
  ClampToEdgeWrapping, DataTexture, LinearFilter, LinearMipmapLinearFilter, NearestFilter, NoColorSpace, RGBAFormat, RedFormat, SRGBColorSpace, Texture,
  UnsignedByteType,
} from 'three/webgpu';
import type { SpriteFrame } from '../contracts.js';
import { isDevBuild } from '../env.js';

// ---- §10.4.1 descriptors (verbatim) -------------------------------------------------------------------------

/** One map of an atlas: WebP level 0 plus pipeline-built levels 1..3 (40-pipelines.md §40.1.6.3). Never KTX2 — see the note below. */
export interface AtlasMap { readonly url: string; readonly mips: readonly string[] }
export interface AtlasSet {
  readonly id: string;                     // ManifestAtlasV2.id
  readonly albedo: AtlasMap;               // sRGB, straight alpha, lossy q85 with lossless alpha
  readonly normal: AtlasMap;               // NoColorSpace; at `normalScale` × the albedo resolution
  readonly emissive: AtlasMap;             // two-valued mask in R; uploaded as RedFormat/R8
  readonly size: 2048;                     // level-0 texels per side; 2 species (4 cells of 1024²) per atlas
  readonly normalScale: 0.5 | 1;
}

// ---- constants ------------------------------------------------------------------------------------------------

export type AtlasMapName = 'albedo' | 'normal' | 'emissive';
export const ATLAS_MAPS: readonly AtlasMapName[] = Object.freeze(['albedo', 'normal', 'emissive'] as const);
/** Level 0 + the three pipeline mips (§40.1.6.3). */
export const ATLAS_LEVELS = 4;
/** A party single is one 1024² cell (§10.4.1). */
export const SINGLE_TEXELS = 1024;
/** ≤ 6 singles live at a time (party size, §10.4.1). */
export const MAX_SINGLES = 6;

export type Crop = readonly [number, number, number, number];

/** A decoded level (an `ImageBitmap` in the browser; a stub in node tests). */
export interface DecodedImage { readonly width: number; readonly height: number; close?(): void }

/** Fetch + decode seam (tests inject a fake). `crop` is in the file's own texels, y down. */
export interface AtlasDecoder { decode(url: string, crop: Crop | null): Promise<DecodedImage> }

/** The three uploaded textures of one atlas (or single) and their GPU byte estimate. */
export interface AtlasTextures {
  readonly albedo: Texture;
  readonly normal: Texture;
  readonly emissive: Texture;
  readonly bytes: number;
  /** Level-0 texels per side of the albedo (2048 for an atlas, 1024 for a single). */
  readonly size: number;
}

// ---- sampler state (§10.4.3) ---------------------------------------------------------------------------------

/**
 * `magFilter = NearestFilter` (Pillar 6: hard texels when magnified), `minFilter = LinearMipmapLinearFilter` over
 * the supplied chain, `anisotropy = 1`, `generateMipmaps = false`, clamp-to-edge (cells never wrap), albedo sRGB,
 * normal/emissive NoColorSpace, emissive R8. Straight alpha (`premultiplyAlpha = false`).
 */
export function stampAtlasTexture(t: Texture, map: AtlasMapName): Texture {
  t.magFilter = NearestFilter;
  t.minFilter = LinearMipmapLinearFilter;
  t.anisotropy = 1;
  t.generateMipmaps = false;
  t.wrapS = ClampToEdgeWrapping;
  t.wrapT = ClampToEdgeWrapping;
  t.flipY = false;
  t.premultiplyAlpha = false;
  t.colorSpace = map === 'albedo' ? SRGBColorSpace : NoColorSpace;
  if (map === 'emissive') { t.format = RedFormat; t.type = UnsignedByteType; }
  t.name = `ewa_sprite_${map}`;
  return t;
}

/** Builds one texture from decoded levels `[l0, l1, l2, l3]` (see the header: level 0 is part of `mipmaps`). */
export function textureFromLevels(levels: readonly DecodedImage[], map: AtlasMapName): Texture {
  if (levels.length === 0) throw new RangeError('@ewa/render: an atlas map needs at least level 0');
  const t = new Texture(levels[0] as unknown as HTMLImageElement);
  t.mipmaps = levels as unknown as HTMLCanvasElement[];
  stampAtlasTexture(t, map);
  t.needsUpdate = true;
  return t;
}

/** Bytes of one map's chain: Σ (size / 2^i)² × bytesPerTexel over `levels` levels. */
export function chainBytes(size: number, bytesPerTexel: number, levels: number = ATLAS_LEVELS): number {
  let n = 0;
  for (let i = 0; i < levels; i++) { const s = Math.max(1, size >> i); n += s * s * bytesPerTexel; }
  return n;
}

/** GPU bytes of an atlas (or single) set: RGBA8 albedo + RGBA8 normal at `normalScale` + R8 emissive, 4 levels each. */
export function atlasSetBytes(size: number, normalScale: number): number {
  return chainBytes(size, 4) + chainBytes(Math.round(size * normalScale), 4) + chainBytes(size, 1);
}

/** Level-`level` crop of a level-0 rect for a map stored at `mapScale` × the albedo resolution. */
export function cropForLevel(px: Crop, level: number, mapScale: number): Crop {
  const k = mapScale / (1 << level);
  return [Math.round(px[0] * k), Math.round(px[1] * k), Math.max(1, Math.round(px[2] * k)), Math.max(1, Math.round(px[3] * k))];
}

function mapScaleOf(set: AtlasSet, map: AtlasMapName): number {
  return map === 'normal' ? set.normalScale : 1;
}

async function loadMap(set: AtlasSet, map: AtlasMapName, decoder: AtlasDecoder, px: Crop | null): Promise<Texture> {
  const m = set[map];
  const urls = [m.url, ...m.mips.slice(0, ATLAS_LEVELS - 1)];
  const scale = mapScaleOf(set, map);
  const levels = await Promise.all(urls.map((u, i) => decoder.decode(u, px === null ? null : cropForLevel(px, i, scale))));
  return textureFromLevels(levels, map);
}

/** Fetches 3 maps × 4 levels of `set` (§10.4.2 `bindAtlas`). */
export async function loadAtlasTextures(set: AtlasSet, decoder: AtlasDecoder): Promise<AtlasTextures> {
  const [albedo, normal, emissive] = await Promise.all(ATLAS_MAPS.map((m) => loadMap(set, m, decoder, null)));
  return { albedo: albedo!, normal: normal!, emissive: emissive!, bytes: atlasSetBytes(set.size, set.normalScale), size: set.size };
}

/** §10.4.1 `bindSingle`: decodes only `frame.px` (and the matching cells of the mip files) into a private set. */
export async function loadSingleTextures(set: AtlasSet, frame: Pick<SpriteFrame, 'px'>, decoder: AtlasDecoder): Promise<AtlasTextures> {
  const px = frame.px as Crop;
  const [albedo, normal, emissive] = await Promise.all(ATLAS_MAPS.map((m) => loadMap(set, m, decoder, px)));
  const size = Math.max(px[2], px[3]);
  return { albedo: albedo!, normal: normal!, emissive: emissive!, bytes: atlasSetBytes(size, set.normalScale), size };
}

export function disposeAtlasTextures(t: AtlasTextures): void {
  for (const m of ATLAS_MAPS) {
    const tex = t[m];
    for (const lv of (tex.mipmaps ?? []) as unknown as DecodedImage[]) lv.close?.();
    tex.dispose();
  }
}

/** Key of a party single (§10.4.2): `single:<set.id>:<frame.px>`. */
export function singleKey(atlasId: string, px: readonly number[]): string {
  return `single:${atlasId}:${px.join(',')}`;
}

/**
 * Browser decoder: one `fetch` per url (blobs cached so a single's 4 crops of one file fetch it once while the
 * bind is in flight), `createImageBitmap(blob, [crop], { imageOrientation: 'flipY', premultiplyAlpha: 'none',
 * colorSpaceConversion: 'none' })` so texel values arrive untouched.
 */
export function browserDecoder(): AtlasDecoder {
  const blobs = new Map<string, Promise<Blob>>();
  const blobOf = (url: string): Promise<Blob> => {
    let p = blobs.get(url);
    if (p === undefined) {
      p = fetch(url).then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
        return r.blob();
      });
      blobs.set(url, p);
      // Keep the blob only while the batch that asked for it is decoding.
      p.finally(() => { setTimeout(() => blobs.delete(url), 0); }).catch(() => undefined);
    }
    return p;
  };
  const opts: ImageBitmapOptions = { imageOrientation: 'flipY', premultiplyAlpha: 'none', colorSpaceConversion: 'none' };
  return {
    async decode(url, crop) {
      const blob = await blobOf(url);
      return crop === null ? createImageBitmap(blob, opts) : createImageBitmap(blob, crop[0], crop[1], crop[2], crop[3], opts);
    },
  };
}

/** 4×4 neutral set used only by the warm-up billboard and by billboards whose atlas is still loading (hidden). */
export function neutralAtlasTextures(): AtlasTextures {
  const mk = (map: AtlasMapName, rgba: readonly [number, number, number, number]): Texture => {
    const n = 4 * 4;
    const red = map === 'emissive';
    const data = new Uint8Array(n * (red ? 1 : 4));
    for (let i = 0; i < n; i++) {
      if (red) data[i] = rgba[0];
      else { data[i * 4] = rgba[0]; data[i * 4 + 1] = rgba[1]; data[i * 4 + 2] = rgba[2]; data[i * 4 + 3] = rgba[3]; }
    }
    const t = new DataTexture(data, 4, 4, red ? RedFormat : RGBAFormat, UnsignedByteType);
    stampAtlasTexture(t, map);
    // a single level, but FILTERABLE like the atlases' trilinear min filter: three's WGSL builder treats a texture with
    // Nearest min AND mag as unfilterable (`textureLoad` instead of `textureSample`), so a Nearest/Nearest neutral set
    // compiled a different billboard program at the step-8 warm-up than every real atlas then needed (the first
    // creature drawn — or an evolution sequence in a zone without wild creatures — compiled 2 programs; Part 7 E6)
    t.minFilter = LinearFilter;
    t.name = `ewa_sprite_neutral_${map}`;
    t.needsUpdate = true;
    return t;
  };
  return {
    albedo: mk('albedo', [200, 190, 170, 255]), normal: mk('normal', [128, 128, 255, 255]), emissive: mk('emissive', [0, 0, 0, 255]),
    bytes: 4 * 4 * 9, size: 4,
  };
}

// ---- refcounted cache ----------------------------------------------------------------------------------------

interface CacheEntry<E> {
  refs: number;          // binds (bindAtlas / bindSingle) not yet released
  users: number;         // billboards currently sampling the entry
  value: E | null;       // null while loading
  promise: Promise<E | null>;
  bytes: number;
}

/**
 * Refcounted atlas cache (§10.4.2 bind/release semantics). `E` is whatever the pool builds per set (textures +
 * the one material). An entry is disposed when `refs === 0 && users === 0`; a release while loading disposes the
 * result on arrival. Generic so node tests can drive it without a GPU.
 */
export class AtlasCache<E> {
  private readonly entries = new Map<string, CacheEntry<E>>();
  private disposed = false;

  constructor(private readonly disposeValue: (e: E) => void, private readonly bytesOf: (e: E) => number) {}

  /** Binds `key`, starting `load` on the first bind. Resolves with the value (null if released/disposed in flight). */
  bind(key: string, load: () => Promise<E>): Promise<E | null> {
    if (this.disposed) return Promise.resolve(null);
    const have = this.entries.get(key);
    if (have !== undefined) { have.refs++; return have.promise; }
    const entry: CacheEntry<E> = { refs: 1, users: 0, value: null, promise: Promise.resolve(null), bytes: 0 };
    this.entries.set(key, entry);
    entry.promise = load().then(
      (value) => {
        if (this.disposed || this.entries.get(key) !== entry) { this.disposeValue(value); return null; }
        entry.value = value;
        entry.bytes = this.bytesOf(value);
        if (entry.refs === 0 && entry.users === 0) { this.drop(key, entry); return null; }
        return value;
      },
      (err: unknown) => {
        if (this.entries.get(key) === entry) this.entries.delete(key);
        throw err;
      },
    );
    return entry.promise;
  }

  /** Releases one bind; disposes when nothing binds or samples the entry any more. */
  release(key: string): void {
    const e = this.entries.get(key);
    if (e === undefined || e.refs === 0) return;
    e.refs--;
    this.maybeDrop(key, e);
  }

  /** Releases every bind of `key` at once. */
  releaseAll(key: string): void {
    const e = this.entries.get(key);
    if (e === undefined) return;
    e.refs = 0;
    this.maybeDrop(key, e);
  }

  /** A billboard starts sampling `key`. */
  use(key: string): void {
    const e = this.entries.get(key);
    if (e !== undefined) e.users++;
  }

  /** A billboard stops sampling `key`. */
  unuse(key: string): void {
    const e = this.entries.get(key);
    if (e === undefined || e.users === 0) return;
    e.users--;
    this.maybeDrop(key, e);
  }

  get(key: string): E | null { return this.entries.get(key)?.value ?? null; }
  has(key: string): boolean { return this.entries.has(key); }
  refs(key: string): number { return this.entries.get(key)?.refs ?? 0; }
  users(key: string): number { return this.entries.get(key)?.users ?? 0; }
  keys(): IterableIterator<string> { return this.entries.keys(); }
  /** Loaded entries (in-flight ones excluded). */
  loaded(): number { let n = 0; for (const e of this.entries.values()) if (e.value !== null) n++; return n; }
  bytes(): number { let n = 0; for (const e of this.entries.values()) n += e.bytes; return n; }
  /** Entries whose key starts with `prefix` (singles of an atlas). */
  countPrefix(prefix: string): number { let n = 0; for (const k of this.entries.keys()) if (k.startsWith(prefix)) n++; return n; }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const [key, e] of [...this.entries]) this.drop(key, e);
  }

  private maybeDrop(key: string, e: CacheEntry<E>): void {
    if (e.refs === 0 && e.users === 0 && e.value !== null) this.drop(key, e);
  }

  private drop(key: string, e: CacheEntry<E>): void {
    this.entries.delete(key);
    if (e.value !== null) { const v = e.value; e.value = null; this.disposeValue(v); }
  }
}

/** Dev guard for §10.4.1 "≤ 6 such binds exist at a time". */
export function assertSingleBudget(live: number): void {
  if (live < MAX_SINGLES) return;
  const msg = `@ewa/render: more than ${MAX_SINGLES} creature singles bound at once (§10.4.1)`;
  if (isDevBuild()) throw new RangeError(msg);
  console.error(msg);
}
