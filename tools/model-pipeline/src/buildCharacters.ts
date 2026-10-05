/**
 * The KayKit character set end to end (SPEC §40.2, amended 2026-10-05): shapes, accessories, the shared animation
 * file and the look atlas, each from the content-hash cache when its inputs are unchanged, plus the manifest's
 * `characters` block and `looks` table.
 *
 * Output (relative to `public/models/`):
 *   characters/<shape>.glb           15 skinned bodies (one primitive, material `character`, UVs, no image)
 *   characters/acc_<id>.glb          hand-held accessories (rigid, UVs, no image)
 *   characters/animations.glb        the kept clips on a node-only rig
 *   characters/atlas.<hash8>.ktx2    one tile per look (+ the source textures accessories need), UASTC, no mips
 */
import { readFileSync } from 'node:fs';
import type { Document } from '@gltf-transform/core';
import { dedup, prune, resample, sparse } from '@gltf-transform/functions';
import sharp from 'sharp';
import { ATLAS_COLUMNS, ATLAS_KTX2, ATLAS_ROWS, TILE_SIZE, cellMean, composeAtlas, decodeRgba, downscale, recolour } from './atlas.js';
import { restPoseBounds } from './bounds.js';
import type { Bounds } from './bounds.js';
import { PIPELINE_VERSION, hashKey, pipelineSourceText, readModel, readTexture, writeModel, writeTexture } from './cache.js';
import {
  ACCESSORIES, CHARACTER_CLIPS, CHARACTER_HEIGHT_M, LOOK_DEFS, NON_CLOTHING_SLOTS, PALETTE_VARIANTS, SHAPES, SLOTS, allLookIds, paletteOf,
} from './characters.js';
import type { AccessoryId, BaseTexture, KayKitCharacter } from './characters.js';
import { createIO } from './glb.js';
import { encodeKtx2, settingsKey } from './ktx2.js';
import { RIG_NAME, buildAccessory, buildAnimations, buildShape, clipDuration, gaitSpeed, readRig, shapeIds } from './kaykit.js';
import type { AccessoryEntry, AnimationsEntry, AtlasEntry, CharactersEntry, LookEntry, ShapeEntry } from './manifest.js';
import { pruneRestTracks, REST_TRACK_EPSILON } from './prepare.js';
import type { KayKitSources } from './sets.js';
import { sha256 } from './textures.js';
import type { TextureFormat } from './textures.js';
import { RESAMPLE_TOLERANCE, SEQUENCE_KEY, meshoptCompression, runSequence } from './transform.js';

export const CHARACTERS_DIR = 'characters';
/** Parameters that shape the character bytes beyond the source files and the pipeline text (cache keys). */
export const CHARACTER_KEY = JSON.stringify({ keepAttributes: true, clips: CHARACTER_CLIPS, restEps: REST_TRACK_EPSILON, height: CHARACTER_HEIGHT_M });

export interface CharacterQa {
  readonly kind: 'shape' | 'accessory' | 'animations' | 'atlas';
  readonly id: string;
  readonly bytes: number;
  readonly triangles: number | null;
  readonly cacheHit: boolean;
}
export interface LookQa {
  readonly id: string;
  readonly shape: string;
  readonly tile: number;
  readonly accessory: string | null;
  /** Mean sRGB of each recoloured slot in the look's tile (0–255). */
  readonly slots: Readonly<Record<string, readonly [number, number, number]>>;
}

export interface CharactersBuild {
  readonly files: ReadonlyMap<string, Uint8Array>;
  readonly characters: CharactersEntry;
  readonly looks: Readonly<Record<string, LookEntry>>;
  readonly qa: readonly CharacterQa[];
  readonly lookQa: readonly LookQa[];
  readonly inputs: number;
  readonly cacheHits: number;
}

interface ShapeMeta { readonly triangles: number; readonly bounds: Bounds; readonly topY: number; readonly bareTopY: number }
interface AnimMeta { readonly clips: readonly string[]; readonly durations: Record<string, number>; readonly walk: number; readonly run: number; readonly dropped: number }
interface AccMeta { readonly triangles: number }

const bytesOf = (b: Buffer): Uint8Array => new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
const r4 = (v: number): number => Math.round(v * 1e4) / 1e4;

/** The KayKit characters a shape reads (sorted), for its cache key. */
function shapeSources(id: string): KayKitCharacter[] {
  return [...new Set<KayKitCharacter>(['Knight', ...SHAPES[id]!.parts.map((p) => p.from)])].sort();
}

/** The tiles of the atlas: every look (sorted ids) then the source textures accessories need off their own body. */
export function atlasPlan(): { readonly looks: readonly string[]; readonly props: readonly BaseTexture[] } {
  const looks = allLookIds();
  const props = new Set<BaseTexture>();
  for (const id of looks) {
    const { def } = paletteOf(id);
    if (def.accessory !== null && ACCESSORIES[def.accessory].texture !== SHAPES[def.shape]!.texture) props.add(ACCESSORIES[def.accessory].texture);
  }
  return { looks, props: [...props].sort() };
}

/** Throws when a palette names a slot its texture lacks, or a variant touches skin / hair. */
export function validateLookTable(): void {
  for (const id of allLookIds()) {
    const { def, palette } = paletteOf(id);
    const shape = SHAPES[def.shape];
    if (!shape) throw new Error(`[model-pipeline] look ${id}: unknown shape ${def.shape}`);
    for (const slot of Object.keys(palette)) if (!SLOTS[shape.texture][slot]) throw new Error(`[model-pipeline] look ${id}: ${shape.texture} texture has no slot "${slot}"`);
  }
  for (const [id, pal] of Object.entries(PALETTE_VARIANTS)) {
    for (const slot of Object.keys(pal)) if (NON_CLOTHING_SLOTS.has(slot)) throw new Error(`[model-pipeline] palette variant ${id} recolours ${slot}; variants recolour clothing only`);
  }
}

export async function buildCharacters(src: KayKitSources, format: TextureFormat, cacheDir: string, force: boolean): Promise<CharactersBuild> {
  validateLookTable();
  const io = await createIO();
  const files = new Map<string, Uint8Array>();
  const qa: CharacterQa[] = [];
  let hits = 0, inputs = 0;
  const raw = new Map<string, Uint8Array>();
  const read = (f: string): Uint8Array => { let b = raw.get(f); if (!b) { b = bytesOf(readFileSync(f)); raw.set(f, b); } return b; };
  const docs = new Map<KayKitCharacter, Document>();
  const doc = async (c: KayKitCharacter): Promise<Document> => { let d = docs.get(c); if (!d) { d = await io.readBinary(read(src.characters[c])); docs.set(c, d); } return d; };

  // ---- shapes
  const shapes: Record<string, ShapeEntry> = {};
  const shapeMeta = new Map<string, ShapeMeta>();
  for (const id of shapeIds()) {
    inputs++;
    const used = shapeSources(id);
    const key = hashKey(PIPELINE_VERSION, 'kaykit-shape', id, JSON.stringify(SHAPES[id]), SEQUENCE_KEY, CHARACTER_KEY, pipelineSourceText(), ...used.map((c) => read(src.characters[c])));
    let glb: Uint8Array; let meta: ShapeMeta; let hit = false;
    const cached = force ? null : readModel<ShapeMeta>(cacheDir, key);
    if (cached) { glb = cached.lod0; meta = cached.meta; hit = true; hits++; } else {
      const m = new Map<KayKitCharacter, Document>();
      for (const c of used) m.set(c, await doc(c));
      const b = buildShape(id, SHAPES[id]!, m);
      const bounds = restPoseBounds(b.doc);
      await runSequence(b.doc, { keepAttributes: true });
      glb = await io.writeBinary(b.doc);
      meta = { triangles: b.triangles, bounds, topY: r4(b.topY), bareTopY: r4(b.bareTopY) };
      writeModel(cacheDir, key, { lod0: glb, lod1: null, meta });
    }
    const url = `${CHARACTERS_DIR}/${id}.glb`;
    files.set(url, glb);
    shapeMeta.set(id, meta);
    shapes[id] = { url, bytes: glb.byteLength, hash: sha256(glb), triangles: meta.triangles, texture: SHAPES[id]!.texture, bounds: { min: [...meta.bounds.min], max: [...meta.bounds.max] } };
    qa.push({ kind: 'shape', id, bytes: glb.byteLength, triangles: meta.triangles, cacheHit: hit });
  }

  // ---- accessories
  const accessories: Record<string, AccessoryEntry> = {};
  for (const id of Object.keys(ACCESSORIES).sort() as AccessoryId[]) {
    inputs++;
    const s = src.accessories[id]!;
    const key = hashKey(PIPELINE_VERSION, 'kaykit-accessory', id, SEQUENCE_KEY, CHARACTER_KEY, pipelineSourceText(), read(s.gltf), read(s.bin));
    let glb: Uint8Array; let meta: AccMeta; let hit = false;
    const cached = force ? null : readModel<AccMeta>(cacheDir, key);
    if (cached) { glb = cached.lod0; meta = cached.meta; hit = true; hits++; } else {
      const b = buildAccessory(id, await io.read(s.gltf));
      await runSequence(b.doc, { keepAttributes: true });
      glb = await io.writeBinary(b.doc);
      meta = { triangles: b.triangles };
      writeModel(cacheDir, key, { lod0: glb, lod1: null, meta });
    }
    const url = `${CHARACTERS_DIR}/acc_${id}.glb`;
    files.set(url, glb);
    accessories[id] = { url, bytes: glb.byteLength, hash: sha256(glb), triangles: meta.triangles, texture: ACCESSORIES[id].texture, bone: ACCESSORIES[id].bone, rotation: ACCESSORIES[id].rotation.map((v) => Math.round(v * 1e6) / 1e6) as unknown as readonly [number, number, number] };
    qa.push({ kind: 'accessory', id, bytes: glb.byteLength, triangles: meta.triangles, cacheHit: hit });
  }

  // ---- animations
  inputs++;
  let animations: AnimationsEntry;
  {
    const key = hashKey(PIPELINE_VERSION, 'kaykit-animations', CHARACTER_KEY, JSON.stringify({ resample: RESAMPLE_TOLERANCE }), pipelineSourceText(), read(src.characters.Knight), ...src.animations.map(read));
    let glb: Uint8Array; let meta: AnimMeta; let hit = false;
    const cached = force ? null : readModel<AnimMeta>(cacheDir, key);
    if (cached) { glb = cached.lod0; meta = cached.meta; hit = true; hits++; } else {
      const sources: Document[] = [];
      for (const f of src.animations) sources.push(await io.readBinary(read(f)));
      const a = buildAnimations(sources, readRig(await doc('Knight'), 'Knight.glb'));
      const walk = gaitSpeed(a, 'walk'), run = gaitSpeed(a, 'run');
      const durations: Record<string, number> = {};
      for (const x of a.getRoot().listAnimations()) durations[x.getName()] = r4(clipDuration(x));
      const dropped = pruneRestTracks(a);
      await a.transform(dedup(), prune(), resample({ tolerance: RESAMPLE_TOLERANCE }), sparse(), meshoptCompression());
      glb = await io.writeBinary(a);
      meta = { clips: Object.keys(durations).sort(), durations, walk, run, dropped };
      writeModel(cacheDir, key, { lod0: glb, lod1: null, meta });
    }
    const url = `${CHARACTERS_DIR}/animations.glb`;
    files.set(url, glb);
    animations = { url, bytes: glb.byteLength, hash: sha256(glb), clips: [...meta.clips], durations: meta.durations, gaitSpeed: { walk: meta.walk, run: meta.run } };
    qa.push({ kind: 'animations', id: 'animations', bytes: glb.byteLength, triangles: null, cacheHit: hit });
  }

  // ---- atlas
  inputs++;
  const plan = atlasPlan();
  const tileOf = new Map<string, number>(plan.looks.map((id, i) => [id, i] as const));
  const propTile = new Map<BaseTexture, number>(plan.props.map((t, i) => [t, plan.looks.length + i] as const));
  const atlasOpts = format === 'ktx2' ? settingsKey(ATLAS_KTX2) : 'webp-lossless';
  const atlasKey = hashKey(PIPELINE_VERSION, 'kaykit-atlas', format, atlasOpts, JSON.stringify({ TILE_SIZE, ATLAS_COLUMNS, ATLAS_ROWS, plan, LOOK_DEFS, PALETTE_VARIANTS, SLOTS }), pipelineSourceText(), ...Object.keys(src.textures).sort().map((t) => read(src.textures[t]!)));
  let atlasBytes: Uint8Array; let atlasHit = false;
  const lookQa: LookQa[] = [];
  const decoded = new Map<string, Awaited<ReturnType<typeof decodeRgba>>>();
  for (const t of Object.keys(src.textures).sort()) decoded.set(t, await decodeRgba(read(src.textures[t]!)));
  const tiles = plan.looks.map((id) => {
    const { def, palette } = paletteOf(id);
    const tex = SHAPES[def.shape]!.texture;
    const full = recolour(decoded.get(tex)!, tex, palette);
    const slots: Record<string, [number, number, number]> = {};
    for (const slot of Object.keys(palette).sort()) slots[slot] = cellMean(full, SLOTS[tex][slot]![0]!);
    lookQa.push({ id, shape: def.shape, tile: tileOf.get(id)!, accessory: def.accessory, slots });
    return downscale(full, TILE_SIZE);
  });
  for (const t of plan.props) tiles.push(downscale(decoded.get(t)!, TILE_SIZE));
  const cachedAtlas = force ? null : readTexture(cacheDir, atlasKey);
  if (cachedAtlas) { atlasBytes = cachedAtlas.bytes; atlasHit = true; hits++; } else {
    const img = composeAtlas(tiles);
    atlasBytes = format === 'ktx2'
      ? await encodeKtx2(img, ATLAS_KTX2)
      : new Uint8Array(await sharp(Buffer.from(img.data), { raw: { width: img.width, height: img.height, channels: 4 } }).webp({ lossless: true }).toBuffer());
    writeTexture(cacheDir, atlasKey, atlasBytes, { role: 'atlas', format, width: img.width, height: img.height, mean: [0, 0, 0] });
  }
  const atlasHash = sha256(atlasBytes);
  const atlasUrl = `${CHARACTERS_DIR}/atlas.${atlasHash.slice(0, 8)}.${format === 'ktx2' ? 'ktx2' : 'webp'}`;
  files.set(atlasUrl, atlasBytes);
  const atlas: AtlasEntry = { url: atlasUrl, bytes: atlasBytes.byteLength, hash: atlasHash, textures: format, width: ATLAS_COLUMNS * TILE_SIZE, height: ATLAS_ROWS * TILE_SIZE, columns: ATLAS_COLUMNS, rows: ATLAS_ROWS, tileSize: TILE_SIZE };
  qa.push({ kind: 'atlas', id: 'atlas', bytes: atlasBytes.byteLength, triangles: null, cacheHit: atlasHit });

  // ---- scale and looks
  const bare = [...shapeMeta.values()].map((m) => m.bareTopY).sort((a, b) => a - b);
  const mid = bare.length >> 1;
  const median = bare.length % 2 === 1 ? bare[mid]! : (bare[mid - 1]! + bare[mid]!) / 2;
  const scale = r4(CHARACTER_HEIGHT_M / median);
  const looks: Record<string, LookEntry> = {};
  for (const id of plan.looks) {
    const { def } = paletteOf(id);
    const acc = def.accessory;
    const accTile = acc === null ? null : ACCESSORIES[acc].texture === SHAPES[def.shape]!.texture ? tileOf.get(id)! : propTile.get(ACCESSORIES[acc].texture)!;
    looks[id] = { shape: def.shape, tile: tileOf.get(id)!, accessory: acc, accessoryTile: accTile, scale, heightM: Math.round(shapeMeta.get(def.shape)!.topY * scale * 1000) / 1000 };
  }
  const characters: CharactersEntry = { rig: RIG_NAME, scale, heightM: CHARACTER_HEIGHT_M, animations, atlas, shapes, accessories };
  return { files, characters, looks, qa, lookQa, inputs, cacheHits: hits };
}
