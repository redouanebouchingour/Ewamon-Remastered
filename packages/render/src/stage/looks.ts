/**
 * SPEC §10.7.7 character looks (amended 2026-10-05): the KayKit set of `public/models/models.manifest.json` v2
 * (`tools/model-pipeline`, §40.2.5) — the manifest mirror, look resolution, and the loader.
 *
 * The set is: 15 body SHAPES (one skinned primitive each on the shared 23-joint `Rig_Medium`, UVs into the 8 × 4
 * KayKit swatch grid, no image), a few hand-held ACCESSORIES (rigid, parented to a hand-slot joint), ONE animation
 * file (node-only rig; `AnimationMixer` binds its tracks by joint name, so one set of clips drives every shape) and
 * ONE atlas (a recoloured tile per look). A look is `{ shape, tile, accessory, accessoryTile, scale, heightM }`.
 *
 * `CharacterSource` is the seam: the browser one (`createGltfCharacterSource`) fetches the manifest once and loads each
 * file once through `GLTFLoader` + `MeshoptDecoder` + the host's `KTX2Loader`; tests pass a synthetic source.
 */
import { LinearFilter, SRGBColorSpace, TextureLoader } from 'three/webgpu';
import type { AnimationClip, BufferGeometry, Mesh, Object3D, SkinnedMesh, Texture } from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

// ---- manifest mirror (tools/model-pipeline/src/manifest.ts, §40.2.5 v2) --------------------------------------------

export interface CharacterFileRef { readonly url: string; readonly bytes: number; readonly hash: string }
export interface ShapeRef extends CharacterFileRef { readonly triangles: number; readonly texture: string }
export interface AccessoryRef extends CharacterFileRef {
  readonly triangles: number; readonly texture: string; readonly bone: string;
  /** XYZ Euler (radians) in the slot's frame (absent = none). */
  readonly rotation?: readonly [number, number, number];
}
export interface AnimationsRef extends CharacterFileRef {
  readonly clips: readonly string[];
  readonly durations: Readonly<Record<string, number>>;
  /** Model units / s of the planted toe at time scale 1 (the pipeline's measurement). */
  readonly gaitSpeed: { readonly walk: number; readonly run: number };
}
export interface AtlasRef extends CharacterFileRef {
  readonly textures: 'ktx2' | 'webp';
  readonly width: number; readonly height: number; readonly columns: number; readonly rows: number; readonly tileSize: number;
}
export interface LookRef {
  readonly shape: string;
  readonly tile: number;
  readonly accessory: string | null;
  readonly accessoryTile: number | null;
  readonly scale: number;
  readonly heightM: number;
}
export interface CharacterSet {
  readonly rig: string;
  readonly scale: number;
  readonly heightM: number;
  readonly animations: AnimationsRef;
  readonly atlas: AtlasRef;
  readonly shapes: Readonly<Record<string, ShapeRef>>;
  readonly accessories: Readonly<Record<string, AccessoryRef>>;
  readonly looks: Readonly<Record<string, LookRef>>;
}

const isFile = (v: unknown): v is CharacterFileRef => {
  const f = v as Partial<CharacterFileRef> | null;
  return f !== null && typeof f === 'object' && typeof f.url === 'string' && typeof f.hash === 'string';
};

/** Validates the parts of `models.manifest.json` v2 the runtime reads; null when unusable. */
export function parseCharacterSet(json: unknown): CharacterSet | null {
  const m = json as { version?: unknown; characters?: Partial<CharacterSet>; looks?: Record<string, unknown> } | null;
  if (m === null || typeof m !== 'object' || m.version !== 2) return null;
  const c = m.characters;
  if (!c || typeof c !== 'object' || !isFile(c.animations) || !isFile(c.atlas) || typeof c.shapes !== 'object' || c.shapes === null) return null;
  if (typeof c.atlas.columns !== 'number' || typeof c.atlas.rows !== 'number' || typeof c.scale !== 'number') return null;
  if (typeof c.animations.gaitSpeed?.walk !== 'number' || typeof c.animations.gaitSpeed.run !== 'number') return null;
  const looks: Record<string, LookRef> = {};
  for (const [id, v] of Object.entries(m.looks ?? {})) {
    const l = v as Partial<LookRef>;
    if (typeof l.shape !== 'string' || typeof l.tile !== 'number' || !c.shapes[l.shape]) continue;
    looks[id] = {
      shape: l.shape, tile: l.tile, accessory: typeof l.accessory === 'string' && c.accessories?.[l.accessory] ? l.accessory : null,
      accessoryTile: typeof l.accessoryTile === 'number' ? l.accessoryTile : null, scale: typeof l.scale === 'number' ? l.scale : c.scale,
      heightM: typeof l.heightM === 'number' ? l.heightM : c.heightM ?? 1.55,
    };
  }
  if (Object.keys(looks).length === 0) return null;
  return { rig: c.rig ?? 'Rig_Medium', scale: c.scale, heightM: c.heightM ?? 1.55, animations: c.animations, atlas: c.atlas, shapes: c.shapes, accessories: c.accessories ?? {}, looks };
}

/**
 * The look a descriptor id draws: itself (`casual2_male:dusk`), else its base look (`casual2_male` for an unknown
 * palette), else a deterministic pick among the base looks (spectators, unknown ids) — never nothing.
 */
export function resolveLook(set: CharacterSet, look: string): { readonly id: string; readonly look: LookRef } {
  const direct = set.looks[look];
  if (direct) return { id: look, look: direct };
  const base = look.includes(':') ? look.slice(0, look.indexOf(':')) : look;
  const b = set.looks[base];
  if (b) return { id: base, look: b };
  const pool = Object.keys(set.looks).filter((k) => !k.includes(':')).sort();
  const ids = pool.length > 0 ? pool : Object.keys(set.looks).sort();
  const id = ids[pickHash(look) % ids.length]!;
  return { id, look: set.looks[id]! };
}

/**
 * FNV-1a with a murmur3 finaliser. Plain FNV-1a (`hash01`) barely moves its high bits when only the last character
 * changes, so `spectator_3_0 … spectator_3_5` all landed on the same look (measured: six ninjas around one arena).
 */
export function pickHash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

// ---- templates ------------------------------------------------------------------------------------------------------

/** A loaded shape: the node graph holding its one `SkinnedMesh` (cloned per actor with `SkeletonUtils.clone`). */
export interface ShapeTemplate {
  readonly id: string;
  readonly scene: Object3D;
  readonly mesh: SkinnedMesh;
}
/** A loaded accessory: its mesh node (the quantization transform on it), cloned per actor and parented to `bone`. */
export interface AccessoryTemplate {
  readonly id: string;
  readonly mesh: Mesh;
  readonly bone: string;
  /** XYZ Euler (radians) in the slot's frame. */
  readonly rotation?: readonly [number, number, number];
}

/** Loads the character set. Every method caches: one request per file for the source's lifetime. */
export interface CharacterSource {
  set(): Promise<CharacterSet | null>;
  clips(): Promise<readonly AnimationClip[]>;
  atlas(): Promise<Texture | null>;
  shape(id: string): Promise<ShapeTemplate | null>;
  accessory(id: string): Promise<AccessoryTemplate | null>;
  dispose(): void;
}

export interface GltfCharacterSourceOptions {
  /** Where `models.manifest.json` lives (entries' urls are relative to it). */
  readonly baseUrl: string;
  readonly ktx2?: KTX2Loader | null;
  readonly fetchJson?: (url: string) => Promise<unknown>;
  readonly warn?: (msg: string) => void;
}

/** Frees what a shape template owns on the GPU: its geometry, its (never rendered) material, its skeleton. */
export function disposeShape(t: ShapeTemplate): void {
  (t.mesh.geometry as BufferGeometry).dispose();
  const m = t.mesh.material;
  for (const x of Array.isArray(m) ? m : [m]) x.dispose();
  t.mesh.skeleton?.dispose();
}

export function disposeAccessory(t: AccessoryTemplate): void {
  t.mesh.geometry.dispose();
  const m = t.mesh.material;
  for (const x of Array.isArray(m) ? m : [m]) x.dispose();
}

/** The browser `CharacterSource`. */
export function createGltfCharacterSource(o: GltfCharacterSourceOptions): CharacterSource {
  const base = o.baseUrl.endsWith('/') ? o.baseUrl : `${o.baseUrl}/`;
  const fetchJson = o.fetchJson ?? (async (url: string) => { const r = await fetch(url); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<unknown>; });
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  if (o.ktx2) loader.setKTX2Loader(o.ktx2);
  const urlOf = (f: CharacterFileRef): string => `${base}${f.url}?v=${f.hash.slice(0, 8)}`;
  let disposed = false;
  let setP: Promise<CharacterSet | null> | null = null;
  let clipsP: Promise<readonly AnimationClip[]> | null = null;
  let atlasP: Promise<Texture | null> | null = null;
  let atlasTex: Texture | null = null;
  const shapes = new Map<string, Promise<ShapeTemplate | null>>();
  const accs = new Map<string, Promise<AccessoryTemplate | null>>();
  const loadedShapes: ShapeTemplate[] = [];
  const loadedAccs: AccessoryTemplate[] = [];
  const fail = (what: string) => (e: unknown): null => { o.warn?.(`${what} failed to load (${e instanceof Error ? e.message : String(e)})`); return null; };

  const set = (): Promise<CharacterSet | null> => {
    setP ??= fetchJson(`${base}models.manifest.json`).then((j) => {
      const s = parseCharacterSet(j);
      if (s === null) o.warn?.('models.manifest.json has no usable character set (version 2 expected): characters stay hidden');
      return s;
    }, fail('models.manifest.json'));
    return setP;
  };
  return {
    set,
    clips() {
      clipsP ??= set().then(async (s) => (s === null || disposed ? [] : (await loader.loadAsync(urlOf(s.animations))).animations), (e: unknown) => { fail('character animations')(e); return []; });
      return clipsP;
    },
    atlas() {
      atlasP ??= set().then(async (s) => {
        if (s === null || disposed) return null;
        const url = urlOf(s.atlas);
        let t: Texture;
        if (s.atlas.textures === 'ktx2') {
          if (!o.ktx2) throw new Error('no KTX2 loader');
          t = await o.ktx2.loadAsync(url);
        } else {
          t = await new TextureLoader().loadAsync(url);
          t.colorSpace = SRGBColorSpace;
          t.flipY = false;
        }
        // level 0 only, linear: the swatch gradients are smooth and every face samples one swatch's interior
        t.generateMipmaps = false;
        t.minFilter = LinearFilter;
        t.magFilter = LinearFilter;
        t.name = 'ewa:character-atlas';
        t.needsUpdate = true;
        if (disposed) { t.dispose(); return null; }
        atlasTex = t;
        return t;
      }).catch(fail('character atlas'));
      return atlasP;
    },
    shape(id) {
      let p = shapes.get(id);
      if (p === undefined) {
        p = set().then(async (s) => {
          const ref = s?.shapes[id];
          if (!ref || disposed) return null;
          const gltf = await loader.loadAsync(urlOf(ref));
          let mesh: SkinnedMesh | null = null;
          gltf.scene.traverse((n) => { if (mesh === null && (n as SkinnedMesh).isSkinnedMesh === true) mesh = n as SkinnedMesh; });
          if (mesh === null) throw new Error('no skinned mesh');
          const t: ShapeTemplate = { id, scene: gltf.scene, mesh };
          if (disposed) { disposeShape(t); return null; }
          loadedShapes.push(t);
          return t;
        }).catch(fail(`character shape '${id}'`));
        shapes.set(id, p);
      }
      return p;
    },
    accessory(id) {
      let p = accs.get(id);
      if (p === undefined) {
        p = set().then(async (s) => {
          const ref = s?.accessories[id];
          if (!ref || disposed) return null;
          const gltf = await loader.loadAsync(urlOf(ref));
          let mesh: Mesh | null = null;
          gltf.scene.traverse((n) => { if (mesh === null && (n as Mesh).isMesh === true) mesh = n as Mesh; });
          if (mesh === null) throw new Error('no mesh');
          const t: AccessoryTemplate = { id, mesh, bone: ref.bone, ...(ref.rotation ? { rotation: ref.rotation } : {}) };
          if (disposed) { disposeAccessory(t); return null; }
          loadedAccs.push(t);
          return t;
        }).catch(fail(`character accessory '${id}'`));
        accs.set(id, p);
      }
      return p;
    },
    dispose() {
      disposed = true;
      for (const t of loadedShapes) disposeShape(t);
      for (const t of loadedAccs) disposeAccessory(t);
      loadedShapes.length = 0; loadedAccs.length = 0;
      atlasTex?.dispose();
      atlasTex = null;
    },
  };
}
