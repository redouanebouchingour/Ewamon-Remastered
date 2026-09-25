/**
 * Material-class splitting of multi-surface meshes (IMPLEMENTATION-NOTES Part 2, C20).
 *
 * 1. Alpha class. three 0.186 renders every shadow map with ONE override material per light shadow and copies each
 *    object's `alphaTest` onto it (`Renderer.renderObject`); `Material.alphaTest` bumps `version` whenever it crosses
 *    0, and a version change makes every following render object recompute its full cache key. Interleaving
 *    alpha-tested cards with solids in a shadow pass therefore costs a cache-key rebuild per draw — measured 185 ms
 *    CPU per frame on Mirevale, 8 ms without the alternation. Cards get `renderOrder 1`, solids 0, so the sorted
 *    render lists flip at most once per pass.
 * 2. Shadow class. Groups whose surface does not cast (`SurfaceDef.castShadow` false: glass, emissive, water) go to
 *    a mesh with `castShadow = false`, so a building's window panes do not cost a draw per cascade.
 *
 * A mesh whose groups span several classes becomes several meshes over geometry *views* (shared attributes and
 * index, disjoint groups).
 */
import { BufferGeometry } from 'three/webgpu';
import type { Material } from 'three/webgpu';
import { isSurfaceId, surfaceDef } from '../materials/surfaces.js';

/** 1 for alpha-tested (card) materials, 0 for everything else. */
export function alphaClass(m: Material): 0 | 1 {
  return m.alphaTest > 0 ? 1 : 0;
}

/** Whether a library material's surface casts shadows (`SurfaceDef.castShadow`); foreign materials cast. */
export function surfaceCasts(m: Material): boolean {
  const id = (m.userData as { ewaSurface?: string } | undefined)?.ewaSurface;
  return id !== undefined && isSurfaceId(id) ? surfaceDef(id).castShadow : true;
}

/** Render order of the card class (after solids). */
export const CARD_RENDER_ORDER = 1;

export interface ClassPart { readonly geometry: BufferGeometry; readonly cls: 0 | 1; readonly casts: boolean }

/**
 * Returns one geometry per (alpha class, shadow class) present: the original when a single class is present,
 * otherwise views sharing its attributes / index with the groups of one class each. `views` lists geometries
 * created here (the caller disposes them with the zone).
 */
export function splitByClass(geo: BufferGeometry, mats: readonly Material[]): { parts: ClassPart[]; views: BufferGeometry[] } {
  const groups = geo.groups;
  const key = (m: Material): number => alphaClass(m) * 2 + (surfaceCasts(m) ? 1 : 0);
  if (groups.length === 0) {
    const m = mats[0]!;
    return { parts: [{ geometry: geo, cls: alphaClass(m), casts: surfaceCasts(m) }], views: [] };
  }
  const keys = groups.map((g) => key(mats[g.materialIndex ?? 0] ?? mats[0]!));
  const present = [...new Set(keys)].sort((a, b) => a - b);
  if (present.length === 1) {
    const k = present[0]!;
    return { parts: [{ geometry: geo, cls: (k >> 1) as 0 | 1, casts: (k & 1) === 1 }], views: [] };
  }
  const views: BufferGeometry[] = [];
  const parts: ClassPart[] = [];
  for (const k of present) {
    const v = new BufferGeometry();
    v.name = `${geo.name || 'geo'}:class${k}`;
    for (const name of Object.keys(geo.attributes)) v.setAttribute(name, geo.getAttribute(name));
    if (geo.index) v.setIndex(geo.index);
    groups.forEach((g, i) => { if (keys[i] === k) v.addGroup(g.start, g.count, g.materialIndex); });
    v.boundingSphere = geo.boundingSphere?.clone() ?? null;
    v.boundingBox = geo.boundingBox?.clone() ?? null;
    views.push(v);
    parts.push({ geometry: v, cls: (k >> 1) as 0 | 1, casts: (k & 1) === 1 });
  }
  return { parts, views };
}
