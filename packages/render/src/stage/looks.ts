/**
 * SPEC §10.7.7 character looks from `public/models/models.manifest.json` (IMPLEMENTATION-NOTES Part 4, H7).
 *
 * Each look is ONE GLB (meshopt-compressed, quantized; one skinned primitive with the six flat colours baked into
 * `COLOR_0`, one material, the 7 kept clips `idle`/`walk`/`run`/`victory`/`defeat`/`sitdown`/`standup`), loaded once
 * per renderer through `GLTFLoader` + `MeshoptDecoder` (+ the host's `KTX2Loader`, which only the legendaries need)
 * and shared by every actor wearing it: actors clone the node graph (`SkeletonUtils.clone`: own bones, shared
 * geometry) and bind the pool's one `'character'` material. The pipeline keeps the Quaternius scale (≈ 3.1 units in
 * the stored pose); every look is scaled by ONE factor, `CHARACTER.heightM / median(look heights)`, so hats and
 * horns stay taller than bare heads.
 *
 * `LookSource` is the seam: `CharacterPool` falls back to its procedural figure while a look loads, when the
 * manifest does not list it, and when loading fails (warned once per look).
 */
import type { AnimationClip, BufferGeometry, Object3D, SkinnedMesh } from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

/** A loaded look, ready to clone: the node graph holding exactly one `SkinnedMesh`, its clips and its scale. */
export interface LookTemplate {
  readonly look: string;
  readonly scene: Object3D;
  readonly mesh: SkinnedMesh;
  readonly clips: readonly AnimationClip[];
  /** World metres per model unit. */
  readonly scale: number;
}

/** Resolves a look id to a template; null = no model for it (the pool keeps the procedural figure). */
export type LookSource = (look: string) => Promise<LookTemplate | null>;

/** The clips the model pipeline keeps (§40.2.3, lower-cased). */
export const LOOK_CLIPS = Object.freeze(['idle', 'walk', 'run', 'victory', 'defeat', 'sitdown', 'standup'] as const);
export type LookClip = (typeof LOOK_CLIPS)[number];

/** `ModelEntry` fields read here (§40.2.5). */
interface LookEntry { readonly url: string; readonly hash: string; readonly clips: readonly string[]; readonly bounds: { readonly min: readonly number[]; readonly max: readonly number[] } }

/** Parses `models.manifest.json`'s `looks` (unknown shape → empty). */
export function parseLooks(json: unknown): Map<string, LookEntry> {
  const out = new Map<string, LookEntry>();
  const looks = (json as { looks?: Record<string, unknown> } | null)?.looks;
  if (looks === null || typeof looks !== 'object') return out;
  for (const [id, v] of Object.entries(looks)) {
    const e = v as Partial<LookEntry>;
    if (typeof e.url !== 'string' || typeof e.hash !== 'string' || !Array.isArray(e.bounds?.min) || !Array.isArray(e.bounds?.max)) continue;
    out.set(id, { url: e.url, hash: e.hash, clips: Array.isArray(e.clips) ? e.clips : [], bounds: e.bounds as LookEntry['bounds'] });
  }
  return out;
}

/** One scale for every look: `heightM / median(bounds height)` (≈ 1.7 / 3.1 for the Quaternius set). */
export function lookScale(entries: ReadonlyMap<string, LookEntry>, heightM: number): number {
  const hs = [...entries.values()].map((e) => (e.bounds.max[1] ?? 0) - (e.bounds.min[1] ?? 0)).filter((h) => h > 0).sort((a, b) => a - b);
  if (hs.length === 0) return 1;
  const m = hs.length >> 1;
  const median = hs.length % 2 === 1 ? hs[m]! : (hs[m - 1]! + hs[m]!) / 2;
  return heightM / median;
}

export interface GlbLookSourceOptions {
  /** Where `models.manifest.json` lives (entries' `url`s are relative to it). */
  readonly baseUrl: string;
  readonly heightM: number;
  readonly ktx2?: KTX2Loader | null;
  readonly fetchJson?: (url: string) => Promise<unknown>;
  readonly warn?: (msg: string) => void;
}

/** The manifest-backed `LookSource` (browser): one GLTF load per look, cached; the manifest is fetched once. */
export function createGlbLookSource(o: GlbLookSourceOptions): LookSource & { dispose(): void } {
  const base = o.baseUrl.endsWith('/') ? o.baseUrl : `${o.baseUrl}/`;
  const fetchJson = o.fetchJson ?? (async (url: string) => { const r = await fetch(url); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<unknown>; });
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  if (o.ktx2) loader.setKTX2Loader(o.ktx2);
  let manifest: Promise<{ entries: Map<string, LookEntry>; scale: number }> | null = null;
  const loads = new Map<string, Promise<LookTemplate | null>>();
  const templates: LookTemplate[] = [];
  let disposed = false;
  const getManifest = (): Promise<{ entries: Map<string, LookEntry>; scale: number }> => {
    manifest ??= fetchJson(`${base}models.manifest.json`).then(
      (j) => { const entries = parseLooks(j); return { entries, scale: lookScale(entries, o.heightM) }; },
      (e: unknown) => { o.warn?.(`models manifest unavailable (${e instanceof Error ? e.message : String(e)}): procedural characters`); return { entries: new Map<string, LookEntry>(), scale: 1 }; },
    );
    return manifest;
  };
  const source = (look: string): Promise<LookTemplate | null> => {
    let p = loads.get(look);
    if (p !== undefined) return p;
    p = getManifest().then(async ({ entries, scale }) => {
      const e = entries.get(look);
      if (e === undefined || disposed) return null;
      const gltf = await loader.loadAsync(`${base}${e.url}?v=${e.hash.slice(0, 8)}`);
      let mesh: SkinnedMesh | null = null;
      gltf.scene.traverse((n) => { if (mesh === null && (n as SkinnedMesh).isSkinnedMesh === true) mesh = n as SkinnedMesh; });
      if (mesh === null) throw new Error('no skinned mesh');
      const t: LookTemplate = { look, scene: gltf.scene, mesh, clips: gltf.animations, scale };
      if (disposed) { disposeTemplate(t); return null; }
      templates.push(t);
      return t;
    }).catch((err: unknown) => {
      o.warn?.(`look '${look}' failed to load (${err instanceof Error ? err.message : String(err)}): procedural figure kept`);
      return null;
    });
    loads.set(look, p);
    return p;
  };
  return Object.assign(source, {
    dispose(): void {
      disposed = true;
      for (const t of templates) disposeTemplate(t);
      templates.length = 0;
    },
  });
}

/** Frees what a template owns on the GPU: its geometry, its (never rendered) material, the template skeleton. */
export function disposeTemplate(t: LookTemplate): void {
  (t.mesh.geometry as BufferGeometry).dispose();
  const m = t.mesh.material;
  for (const x of Array.isArray(m) ? m : [m]) x.dispose();
  t.mesh.skeleton?.dispose();
}
