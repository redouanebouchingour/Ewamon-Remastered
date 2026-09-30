/**
 * Pixel-art character atlas (tools/character-pipeline → `public/characters/characters.manifest.json`): the
 * manifest mirror, the per-look frame tables, and the textures of the one character material.
 *
 * Characters are drawn by the creature billboard graph (§10.4.5) — lit through the derived normal map, binary
 * alpha cut at 0.5 with the shadow from the same alpha (`maskShadowNode`), `NearestFilter` magnification, the
 * §10.4.4 yaw + half-pitch lean with the turned normal/tangent, the `mask` MRT (x 1: no GTAO darkening, y: the
 * DOF-sharp bit), a rim term, `shadowSide = DoubleSide`, `map = null` — as ONE INSTANCED draw: every actor is an
 * instance of one card whose per-instance attributes replace the creature's per-object `userData`:
 *   iFeet (vec3)  the foot point in world space (the mesh stays at the origin: three applies an InstancedMesh's
 *                 matrix BEFORE `positionNode`, which would scale the card math, so this is an InstancedBufferGeometry)
 *   iRect (vec4)  the frame's u0 v0 u1 v1 in the atlas
 *   iMisc (vec2)  x = DOF-sharp (the local player), y = shown (0 collapses the card: an empty or loading slot)
 * The variant palette, hurt flash, dissolve, shimmer and emissive mask of the creature graph are constants for
 * characters and are left out. The shadow pass falls back to `positionNode`, so each cascade is also one draw.
 *
 * The textures exist from construction as empty `Texture`s (three uploads a default texture for them), so the
 * material compiles in the renderer's warm-up frame; when the atlas decodes, its images are assigned in place
 * (`image` + `needsUpdate`): three creates the real GPU texture and refreshes the bindings — no recompile, no
 * re-pointed material (the H5c stale-binding trap never arises). Magnified ≈ 2–4× at every diorama zoom stop,
 * so level 0 only: `minFilter = LinearFilter`, no mip files.
 */
import { BufferAttribute, DataTexture, DoubleSide, DynamicDrawUsage, FrontSide, InstancedBufferAttribute, InstancedBufferGeometry, LinearFilter, MeshStandardNodeMaterial, PlaneGeometry, RedFormat, Texture, UnsignedByteType } from 'three/webgpu';
import type { Color, Node, UniformNode } from 'three/webgpu';
import {
  Fn, abs, attribute, cameraPosition, cos, dot, float, mix, mrt, normalLocal, normalMap, normalView, normalWorld, oneMinus, positionLocal, positionWorld, pow,
  sin, tangentLocal, texture, uv, vec2, vec3, vec4,
} from 'three/tsl';
import { stampAtlasTexture, type AtlasDecoder, type AtlasTextures, type DecodedImage } from './atlas.js';
import type { BillboardUniforms } from './billboard.js';
import { BILLBOARD, hash01 } from './tables.js';
import { FACING_KEYS, STATE_KEYS } from './characterAnim.js';

// ---- manifest mirror (tools/character-pipeline/src/bake.ts `CharactersManifest`) ----------------------------------

export type CharRect = readonly [number, number, number, number];
export interface CharManifestAtlas { readonly id: string; readonly width: number; readonly height: number; readonly albedo: string; readonly normal: string; readonly hash: string }
export interface CharManifestLook {
  readonly atlas: string;
  readonly heightPx: number;
  readonly frames: Readonly<Record<string, Readonly<Record<string, readonly CharRect[]>>>>;
}
export interface CharactersManifest {
  readonly version: 1;
  readonly cell: { readonly w: number; readonly h: number };
  readonly footV: number;
  readonly pixelsPerMetre: number;
  readonly cellM: { readonly w: number; readonly h: number };
  readonly fps: Readonly<Record<string, number>>;
  readonly cycleM: Readonly<Record<string, number>>;
  readonly atlases: readonly CharManifestAtlas[];
  readonly looks: Readonly<Record<string, CharManifestLook>>;
  readonly totalBytes: number;
}

export const CHARACTERS_MANIFEST = 'characters.manifest.json';

/** Validates the parts of the manifest the runtime reads; null when unusable. */
export function parseCharactersManifest(json: unknown): CharactersManifest | null {
  const m = json as Partial<CharactersManifest> | null;
  if (m === null || typeof m !== 'object' || m.version !== 1) return null;
  if (!Array.isArray(m.atlases) || m.atlases.length === 0 || typeof m.looks !== 'object' || m.looks === null) return null;
  if (typeof m.footV !== 'number' || typeof m.pixelsPerMetre !== 'number' || typeof m.cellM?.w !== 'number' || typeof m.cellM?.h !== 'number') return null;
  for (const a of m.atlases) if (typeof a?.id !== 'string' || typeof a.albedo !== 'string' || typeof a.normal !== 'string') return null;
  return m as CharactersManifest;
}

// ---- frame tables -------------------------------------------------------------------------------------------------

/** One look's frames: `rects` holds 4 floats per frame; (facing × 5 + state) → first frame / count. */
export interface LookFrames {
  readonly id: string;
  /** Head top above the feet (m), unleaned. */
  readonly heightM: number;
  readonly rects: Float32Array;
  readonly first: Uint16Array;
  readonly count: Uint8Array;
}

export class CharacterFrames {
  readonly looks = new Map<string, LookFrames>();
  /** Base looks (no palette variant), sorted: the deterministic fallback pool for unknown ids. */
  readonly baseIds: readonly string[];
  readonly footV: number;
  readonly cellW: number;
  readonly cellH: number;

  constructor(readonly manifest: CharactersManifest) {
    this.footV = manifest.footV;
    this.cellW = manifest.cellM.w;
    this.cellH = manifest.cellM.h;
    const ids = Object.keys(manifest.looks).sort();
    for (const id of ids) this.looks.set(id, buildLookFrames(id, manifest.looks[id]!, manifest.pixelsPerMetre));
    this.baseIds = ids.filter((id) => !id.includes(':'));
  }

  /**
   * The frames a look id draws: the exact id (`casual2_male:dusk`), else its base look (`casual2_male`), else a
   * deterministic pick among the base looks (ids the atlas does not carry: `ranger_m`, a spectator's seed).
   */
  resolve(look: string): LookFrames {
    const exact = this.looks.get(look);
    if (exact !== undefined) return exact;
    const colon = look.indexOf(':');
    if (colon > 0) { const base = this.looks.get(look.slice(0, colon)); if (base !== undefined) return base; }
    const pool = this.baseIds.length > 0 ? this.baseIds : [...this.looks.keys()];
    return this.looks.get(pool[Math.floor(hash01(look) * pool.length) % pool.length]!)!;
  }
}

function buildLookFrames(id: string, l: CharManifestLook, ppm: number): LookFrames {
  const first = new Uint16Array(FACING_KEYS.length * STATE_KEYS.length);
  const count = new Uint8Array(FACING_KEYS.length * STATE_KEYS.length);
  const flat: number[] = [];
  FACING_KEYS.forEach((f, fi) => STATE_KEYS.forEach((s, si) => {
    const list = l.frames[f]?.[s] ?? [];
    first[fi * STATE_KEYS.length + si] = flat.length / 4;
    count[fi * STATE_KEYS.length + si] = list.length;
    for (const r of list) flat.push(r[0], r[1], r[2], r[3]);
  }));
  // a facing without a state (emotes exist face-on only) falls back to that facing's idle
  FACING_KEYS.forEach((_, fi) => STATE_KEYS.forEach((__, si) => {
    const k = fi * STATE_KEYS.length + si;
    if (count[k] === 0) { first[k] = first[fi * STATE_KEYS.length]!; count[k] = count[fi * STATE_KEYS.length]!; }
  }));
  return { id, heightM: l.heightPx / ppm, rects: Float32Array.from(flat), first, count };
}

// ---- textures + the material --------------------------------------------------------------------------------------

export interface CharacterTextures extends AtlasTextures {
  /** Whether the atlas images have been assigned. */
  loaded: boolean;
}

/** The three textures of the character material: empty albedo / normal (filled on load), a black 4 × 4 mask. */
export function createCharacterTextures(): CharacterTextures {
  const albedo = stampAtlasTexture(new Texture(), 'albedo');
  const normal = stampAtlasTexture(new Texture(), 'normal');
  for (const t of [albedo, normal]) { t.minFilter = LinearFilter; t.mipmaps = []; }
  albedo.name = 'ewa_character_albedo';
  normal.name = 'ewa_character_normal';
  const emissive = new DataTexture(new Uint8Array(16), 4, 4, RedFormat, UnsignedByteType);
  stampAtlasTexture(emissive, 'emissive');
  emissive.minFilter = LinearFilter;
  emissive.name = 'ewa_character_emissive';
  emissive.needsUpdate = true;
  return { albedo, normal, emissive, bytes: 16, size: 0, loaded: false };
}

/** Assigns decoded atlas images in place (see the header). */
export function assignCharacterImages(t: CharacterTextures, albedo: DecodedImage, normal: DecodedImage): void {
  t.albedo.image = albedo as unknown as HTMLImageElement;
  t.normal.image = normal as unknown as HTMLImageElement;
  t.albedo.needsUpdate = true;
  t.normal.needsUpdate = true;
  (t as { bytes: number }).bytes = albedo.width * albedo.height * 4 + normal.width * normal.height * 4 + 16;
  (t as { size: number }).size = albedo.width;
  t.loaded = true;
}

export function disposeCharacterTextures(t: CharacterTextures): void {
  for (const tex of [t.albedo, t.normal]) (tex.image as DecodedImage | null)?.close?.();
  t.albedo.dispose(); t.normal.dispose(); t.emissive.dispose();
}

/** Uniforms every character shares: the card size and foot line from the manifest, and the rim colour. */
export interface CharacterUniforms {
  readonly cellW: UniformNode<'float', number>;
  readonly cellH: UniformNode<'float', number>;
  readonly footV: UniformNode<'float', number>;
  readonly rim: UniformNode<'color', Color>;
}

/**
 * §10.4.4 for instances: the foot-anchored card, sized by the manifest cell and collapsed when hidden, leaned back
 * about its foot line by `cameraLean`, turned by `cameraYaw`, then moved to the instance's feet. The turned normal
 * and tangent are assigned exactly as `billboard.ts` does (the SkinningNode pattern), so the normal map lights it.
 */
function characterPosition(u: BillboardUniforms, c: CharacterUniforms): Node<'vec3'> {
  return Fn(() => {
    const feet = attribute('iFeet', 'vec3') as unknown as Node<'vec3'>;
    const misc = attribute('iMisc', 'vec2') as unknown as Node<'vec2'>;
    const x = positionLocal.x.mul(c.cellW).mul(misc.y);
    const y = positionLocal.y.add(0.5).sub(c.footV).mul(c.cellH).mul(misc.y);
    const cl = cos(u.cameraLean); const sl = sin(u.cameraLean);
    const cy = cos(u.cameraYaw); const sy = sin(u.cameraYaw);
    const ly = y.mul(cl); const lz = y.mul(sl).negate();
    normalLocal.assign(vec3(cl.mul(sy), sl, cl.mul(cy)));
    tangentLocal.assign(vec3(cy, 0, sy.negate()));
    return vec3(x.mul(cy).add(lz.mul(sy)), ly, lz.mul(cy).sub(x.mul(sy))).add(feet);
  })() as unknown as Node<'vec3'>;
}

/** The one character material (see the header): the billboard graph with per-instance frame, feet and flags. */
export function createCharacterMaterial(t: CharacterTextures, u: BillboardUniforms, c: CharacterUniforms): MeshStandardNodeMaterial {
  const B = BILLBOARD;
  const m = new MeshStandardNodeMaterial();
  const rect = attribute('iRect', 'vec4') as unknown as Node<'vec4'>;
  const uvRect = rect.xy.add(uv().mul(rect.zw.sub(rect.xy)));
  const a = texture(t.albedo, uvRect);
  const n = texture(t.normal, uvRect);
  const h = u.harvestLevel.clamp(0, 2).div(2);
  m.colorNode = vec4(a.rgb, a.a);
  m.normalNode = mix(normalMap(n.rgb, float(1)) as unknown as Node<'vec3'>, normalView, h).normalize();
  m.roughnessNode = float(B.roughness);
  m.metalnessNode = float(B.metalness);
  m.alphaTest = B.alphaTest;
  m.alphaTestNode = float(B.alphaTest);
  m.maskShadowNode = a.a.greaterThan(float(B.alphaTest));
  const V = cameraPosition.sub(positionWorld).normalize();
  const rim = pow(oneMinus(abs(dot(normalWorld, V))), B.rimPower);
  m.emissiveNode = (c.rim as unknown as Node<'vec3'>).mul(rim).mul(B.rimStrength).mul(oneMinus(h));
  m.mrtNode = mrt({ mask: vec2(1, (attribute('iMisc', 'vec2') as unknown as Node<'vec2'>).x) });   // x: no GTAO darkening; y: DOF-sharp
  m.positionNode = characterPosition(u, c);
  m.side = FrontSide;
  m.shadowSide = DoubleSide;
  m.transparent = false;
  m.depthWrite = true;
  m.name = 'ewa:character-billboard';
  m.userData = { ewaClass: 'billboard', ewaAtlas: 'characters', ewaAlbedo: t.albedo, ewaCharacter: true };
  return m;
}

/** Instance attribute arrays of the character card (one slot per pool rig). */
export interface CharacterInstances {
  readonly geometry: InstancedBufferGeometry;
  readonly feet: InstancedBufferAttribute;
  readonly rect: InstancedBufferAttribute;
  readonly misc: InstancedBufferAttribute;
}

/** The shared card (PlaneGeometry(1, 1) + a tangent attribute) as an instanced geometry of `slots` instances, all hidden. */
export function createCharacterInstances(slots: number): CharacterInstances {
  const quad = new PlaneGeometry(1, 1);
  const geometry = new InstancedBufferGeometry();
  geometry.index = quad.index;
  for (const k of ['position', 'normal', 'uv'] as const) geometry.setAttribute(k, quad.getAttribute(k));
  const nv = quad.getAttribute('position').count;
  const tan = new Float32Array(nv * 4);
  for (let i = 0; i < nv; i++) { tan[i * 4] = 1; tan[i * 4 + 3] = 1; }
  geometry.setAttribute('tangent', new BufferAttribute(tan, 4));
  const feet = new InstancedBufferAttribute(new Float32Array(slots * 3), 3);
  const rect = new InstancedBufferAttribute(new Float32Array(slots * 4), 4);
  const misc = new InstancedBufferAttribute(new Float32Array(slots * 2), 2);
  for (const at of [feet, rect, misc]) at.setUsage(DynamicDrawUsage);
  geometry.setAttribute('iFeet', feet);
  geometry.setAttribute('iRect', rect);
  geometry.setAttribute('iMisc', misc);
  geometry.instanceCount = 0;
  geometry.name = 'ewa:character-cards';
  return { geometry, feet, rect, misc };
}

export interface CharacterSet { readonly manifest: CharactersManifest; readonly frames: CharacterFrames; readonly albedo: DecodedImage; readonly normal: DecodedImage }

/** Fetches the manifest, then decodes the (first) atlas's two maps. */
export async function loadCharacterSet(baseUrl: string, decoder: AtlasDecoder, fetchJson: (url: string) => Promise<unknown>): Promise<CharacterSet> {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const manifest = parseCharactersManifest(await fetchJson(`${base}${CHARACTERS_MANIFEST}`));
  if (manifest === null) throw new Error('characters manifest missing or not version 1');
  const a = manifest.atlases[0]!;
  const v = a.hash ? `?v=${a.hash.slice(0, 8)}` : '';
  const [albedo, normal] = await Promise.all([decoder.decode(`${base}${a.albedo}${v}`, null), decoder.decode(`${base}${a.normal}${v}`, null)]);
  return { manifest, frames: new CharacterFrames(manifest), albedo, normal };
}
