/**
 * SPEC §40.2.3 per-set rules that run before the §40.2.2 sequence.
 *
 * Legendaries: one mesh, one skin, one clip (`Animation` → `idle`); the three textures are classified by their
 * material slot (see `classifyLegendaryTextures`).
 *
 * Both sets: tracks that hold the rest pose in every clip of a file are dropped (`pruneRestTracks`, lossless). The
 * KayKit character rules (shapes, the shared animation file, accessories) are in `kaykit.ts`.
 */
import type { Accessor, Animation, AnimationChannel, Document, Node, Texture } from '@gltf-transform/core';
import { LEGENDARY_CLIP } from './sets.js';

export interface QaFlag {
  readonly id: string;
  readonly flag: string;
  readonly detail: string;
}

// ---- legendaries --------------------------------------------------------------------------------------------

export type TextureRole = 'baseColor' | 'normal' | 'orm' | 'emissive';

export interface ClassifiedTexture {
  readonly texture: Texture;
  readonly role: TextureRole;
  /** Material slots that reference the texture (gltf-transform edge names). */
  readonly slots: readonly string[];
}

function slotsOf(doc: Document, t: Texture): string[] {
  const root = doc.getRoot();
  return [...new Set(doc.getGraph().listParentEdges(t).filter((e) => e.getParent() !== root).map((e) => e.getName()))].sort();
}

/**
 * The material slot is authoritative (the legendary sources bind `baseColorTexture`, `normalTexture` and
 * `metallicRoughnessTexture` explicitly). §40.2.3's heuristic ("second texture = normal if its mean is within
 * 16/255 of (128,128,255), else ORM; the third is emissive") mis-reads these files — their normal maps average
 * (127,127,234) and the third texture is the metal-rough map — so it is replaced by the binding, and the mean
 * colour is kept only as a cross-check in `normalLike` (IMPLEMENTATION-NOTES M6).
 */
export function classifyLegendaryTextures(doc: Document): ClassifiedTexture[] {
  const out: ClassifiedTexture[] = [];
  for (const t of doc.getRoot().listTextures()) {
    const slots = slotsOf(doc, t);
    let role: TextureRole | null = null;
    if (slots.includes('baseColorTexture')) role = 'baseColor';
    else if (slots.includes('normalTexture')) role = 'normal';
    else if (slots.includes('metallicRoughnessTexture') || slots.includes('occlusionTexture')) role = 'orm';
    else if (slots.includes('emissiveTexture')) role = 'emissive';
    if (!role) throw new Error(`[model-pipeline] texture "${t.getName()}" is bound to no known slot (${slots.join(', ') || 'none'})`);
    out.push({ texture: t, role, slots });
  }
  const roles = out.map((c) => c.role);
  if (new Set(roles).size !== roles.length) throw new Error(`[model-pipeline] two textures share a role (${roles.join(', ')})`);
  return out.sort((a, b) => ORDER[a.role] - ORDER[b.role]);
}
const ORDER: Readonly<Record<TextureRole, number>> = { baseColor: 0, normal: 1, orm: 2, emissive: 3 };

/** Tangent-space normal-map test on a mean colour (0–255): R, G within 16 of 128 and B clearly positive-Z. */
export function normalLike(mean: readonly [number, number, number]): boolean {
  return Math.abs(mean[0] - 128) <= 16 && Math.abs(mean[1] - 128) <= 16 && mean[2] >= 160;
}

export interface LegendaryShape { readonly triangles: number; readonly clips: readonly string[] }

export function prepareLegendary(doc: Document, id: string): LegendaryShape {
  const root = doc.getRoot();
  const meshes = root.listMeshes();
  const skins = root.listSkins();
  const anims = root.listAnimations();
  if (meshes.length !== 1) throw new Error(`[model-pipeline] legendary ${id}: expected 1 mesh, found ${meshes.length}`);
  if (skins.length !== 1) throw new Error(`[model-pipeline] legendary ${id}: expected 1 skin, found ${skins.length}`);
  if (anims.length !== 1) throw new Error(`[model-pipeline] legendary ${id}: expected 1 clip, found ${anims.length} (${anims.map((a) => a.getName()).join(', ')})`);
  anims[0]!.setName(LEGENDARY_CLIP);
  let tris = 0;
  for (const p of meshes[0]!.listPrimitives()) tris += Math.floor((p.getIndices()?.getCount() ?? p.getAttribute('POSITION')!.getCount()) / 3);
  return { triangles: tris, clips: [LEGENDARY_CLIP] };
}

// ---- animation tracks ---------------------------------------------------------------------------------------

/**
 * Detaches a clip so `prune()` can drop its keyframes. `Animation.dispose()` alone leaves its samplers alive and
 * still pointing at their input/output accessors — `prune()` then sees those accessors as referenced and keeps
 * them (measured on the former Quaternius set: 1 136 accessors instead of ~440). Channels and samplers are
 * disposed first.
 */
export function detachAnimation(a: Animation): void {
  for (const c of a.listChannels()) c.dispose();
  for (const s of a.listSamplers()) s.dispose();
  a.dispose();
}

/** Tolerance for "this track holds the rest pose" (metres / quaternion components / scale factors). */
export const REST_TRACK_EPSILON = 1e-5;

function restValue(node: Node, path: string): number[] | null {
  if (path === 'translation') return node.getTranslation();
  if (path === 'rotation') return node.getRotation();
  if (path === 'scale') return node.getScale();
  return null;
}

function constantAt(out: Accessor, rest: readonly number[], path: string, eps: number): boolean {
  const el: number[] = [];
  for (let i = 0, n = out.getCount(); i < n; i++) {
    out.getElement(i, el);
    let same = true;
    let flipped = path === 'rotation';
    for (let k = 0; k < rest.length; k++) {
      if (Math.abs(el[k]! - rest[k]!) > eps) same = false;
      if (Math.abs(el[k]! + rest[k]!) > eps) flipped = false;   // q and −q are the same rotation
    }
    if (!same && !flipped) return false;
  }
  return true;
}

/**
 * Drops every (node, path) track that holds the node's rest value in EVERY clip of the file (IMPLEMENTATION-NOTES
 * M8). Lossless in three.js: a bone without a track keeps its current transform, which is the rest pose because no
 * clip in the file ever moves it, so cross-fades between the kept clips are unchanged. KayKit clips key all 23
 * joints × T/R/S, and most of those tracks are constant (scale 1, bone-length translations): each one costs a
 * sampler, a channel and two accessors of JSON even after `resample()` shrinks it to two keys.
 */
export function pruneRestTracks(doc: Document, eps = REST_TRACK_EPSILON): number {
  const tracks = new Map<string, AnimationChannel[]>();
  const anims = doc.getRoot().listAnimations();
  for (const a of anims) {
    for (const c of a.listChannels()) {
      const node = c.getTargetNode();
      const path = c.getTargetPath();
      if (!node || !path) continue;
      const key = `${doc.getRoot().listNodes().indexOf(node)}:${path}`;
      const l = tracks.get(key) ?? [];
      l.push(c);
      tracks.set(key, l);
    }
  }
  let dropped = 0;
  for (const chans of tracks.values()) {
    const node = chans[0]!.getTargetNode()!;
    const path = chans[0]!.getTargetPath()!;
    const rest = restValue(node, path);
    if (!rest) continue;
    const allRest = chans.every((c) => {
      const s = c.getSampler();
      const out = s?.getOutput();
      return !!out && s!.getInterpolation() !== 'CUBICSPLINE' && constantAt(out, rest, path, eps);
    });
    if (!allRest) continue;
    for (const c of chans) {
      const s = c.getSampler();
      c.dispose();
      if (s && s.listParents().filter((p) => p.propertyType !== 'Root' && p.propertyType !== 'Animation').length === 0) s.dispose();
      dropped++;
    }
  }
  return dropped;
}
