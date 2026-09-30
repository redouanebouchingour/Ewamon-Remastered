/**
 * Two-phase zone compile — which render units the first zone frame needs (IMPLEMENTATION-NOTES Part 5, T4).
 *
 * Measured on the dev iGPU (fresh profile, no shader cache): a zone's compile is ~23 unique render pipelines at 1–5 s
 * of driver time each (mire_route: 49 s summed, 20 s wall with 4 in flight); every other render object is a cache hit.
 * So the split is by what can be seen: phase 1 (awaited by `loadZone`) compiles the units the predicted first view
 * draws — in the view frustum (padded) or within `surroundM` of the player, at the LOD level / scatter tier that view
 * picks — and phase 2 compiles the rest in the background (far LOD levels, scatter tiers ≥ 2, far set-pieces and
 * water, the warm library quads, the arena). Pure: node-tested.
 */
import { Box3, Frustum, Matrix4, Sphere, Vector3 } from 'three/webgpu';
import type { BufferGeometry, Camera, LOD, Material, Object3D } from 'three/webgpu';

export const COMPILE_PLAN = Object.freeze({
  /** Horizontal radius (m) around the player compiled in phase 1 whatever the view (a heading turn / zoom shows it). */
  surroundM: 28,
  /** The predicted view frustum is padded by this (m): the player walks and the camera settles in the first seconds. */
  viewPadM: 12,
  /** Scatter tiers (zone-wide instanced meshes) compiled in phase 1: the diorama camera never shows tier ≥ 2 (≥ 90 m). */
  nearScatterTier: 1,
});

/** One compile unit: a zone root child (or one LOD level) compiled by one `compileAsync` call. */
export interface CompileUnit {
  readonly object: Object3D;
  /** Phase 1 (the predicted first view needs it). */
  readonly near: boolean;
  /** Horizontal distance (m) from the focus to the unit's bounds (phase-2 order: nearest first). */
  readonly distance: number;
  /** Materials × instancing / skinning of its renderables: units with a key not seen yet carry the unique pipelines. */
  readonly key: string;
}

/** The predicted first view: a camera with its projection and world matrices current, and the player's feet. */
export interface ViewGuess { readonly camera: Camera; readonly focus: Vector3 }

interface Renderable extends Object3D {
  readonly geometry?: BufferGeometry;
  readonly material?: Material | Material[];
  readonly isMesh?: boolean; readonly isLine?: boolean; readonly isPoints?: boolean; readonly isSprite?: boolean;
  readonly isInstancedMesh?: boolean; readonly isSkinnedMesh?: boolean;
  readonly boundingSphere?: Sphere | null;
}

function isRenderable(o: Object3D): o is Renderable {
  const r = o as Renderable;
  return r.isMesh === true || r.isLine === true || r.isPoints === true || r.isSprite === true;
}

/** Whether a subtree holds anything the renderer draws (lights and bare spot-light targets hold nothing). */
export function hasRenderable(o: Object3D): boolean {
  let found = false;
  o.traverse((x) => { if (!found && isRenderable(x)) found = true; });
  return found;
}

const _box = new Box3();
const _b = new Box3();
const _frustum = new Frustum();
const _vp = new Matrix4();
const _s = new Sphere();
const _v = new Vector3();

/** World bounding sphere of a subtree's renderables (world matrices must be current); false when it has none. */
function subtreeSphere(o: Object3D, out: Sphere): boolean {
  _box.makeEmpty();
  o.traverse((x) => {
    if (!isRenderable(x)) return;
    const r = x as Renderable;
    if (r.isInstancedMesh === true && r.boundingSphere) { r.boundingSphere.getBoundingBox(_b); _box.union(_b); return; }
    const g = r.geometry;
    if (!g) { _b.setFromCenterAndSize(x.getWorldPosition(_v), _v.set(1, 1, 1)); _box.union(_b); return; }
    if (g.boundingBox === null) g.computeBoundingBox();
    if (g.boundingBox === null || g.boundingBox.isEmpty()) return;
    _b.copy(g.boundingBox).applyMatrix4(x.matrixWorld);
    _box.union(_b);
  });
  if (_box.isEmpty()) return false;
  _box.getBoundingSphere(out);
  return true;
}

/** Material ids + instancing / skinning / sprite of every renderable (a proxy for the pipelines a unit needs). */
export function unitKey(o: Object3D): string {
  const parts: string[] = [];
  o.traverse((x) => {
    if (!isRenderable(x)) return;
    const r = x as Renderable;
    const mats = Array.isArray(r.material) ? r.material : r.material ? [r.material] : [];
    const kind = `${r.isInstancedMesh ? 'I' : ''}${r.isSkinnedMesh ? 'S' : ''}${r.isSprite ? 'P' : ''}${r.isLine ? 'L' : ''}`;
    parts.push(`${kind}:${mats.map((m) => m.uuid).join(',')}`);
  });
  return parts.sort().join('|');
}

/** `LOD.update`'s level pick for a camera distance (hysteresis ignored). */
function lodLevelFor(lod: LOD, distance: number): number {
  let cur = 0;
  for (let i = 1; i < lod.levels.length; i++) { if (distance >= lod.levels[i]!.distance) cur = i; else break; }
  return cur;
}

/**
 * Splits a zone root into compile units. `view` null → every unit is phase 1 (the single-phase compile). World
 * matrices are brought up to date first. Units come out in build order; the caller sorts.
 */
export function planZoneCompile(root: Object3D, view: ViewGuess | null): CompileUnit[] {
  root.updateMatrixWorld(true);
  const out: CompileUnit[] = [];
  if (view !== null) {
    view.camera.updateMatrixWorld();
    _frustum.setFromProjectionMatrix(_vp.multiplyMatrices(view.camera.projectionMatrix, view.camera.matrixWorldInverse));
  }
  const fx = view?.focus.x ?? 0; const fz = view?.focus.z ?? 0;
  const distanceOf = (o: Object3D): number => {
    if (!subtreeSphere(o, _s)) return 0;
    return Math.max(0, Math.hypot(_s.center.x - fx, _s.center.z - fz) - _s.radius);
  };
  /** In the padded view or within the surroundings (reads `_s` from `distanceOf`). */
  const seen = (d: number): boolean => {
    if (d <= COMPILE_PLAN.surroundM) return true;
    _s.radius += COMPILE_PLAN.viewPadM;
    return _frustum.intersectsSphere(_s);
  };
  const push = (o: Object3D, near: (d: number) => boolean): void => {
    const d = distanceOf(o);
    out.push({ object: o, near: view === null || near(d), distance: d, key: unitKey(o) });
  };
  for (const c of root.children) {
    if (!hasRenderable(c)) continue;                                   // lights, spot targets
    if ((c as LOD).isLOD === true) {
      const lod = c as LOD;
      const cur = view !== null ? lodLevelFor(lod, view.camera.getWorldPosition(_v).distanceTo(lod.getWorldPosition(new Vector3()))) : 0;
      lod.levels.forEach((lv, i) => push(lv.object, (d) => seen(d) && (i === cur || (i === 0 && d <= COMPILE_PLAN.surroundM))));
      continue;
    }
    const tier = (c.userData as { ewaScatterTier?: unknown }).ewaScatterTier;
    if (typeof tier === 'number') { push(c, () => tier <= COMPILE_PLAN.nearScatterTier); continue; }
    // static prop chunks: `ewa:props:<chunk>:<c|n>:lod<t>` — tier 2 is only drawn ≥ 90 m from the camera
    push(c, (d) => !/:lod2$/.test(c.name) && seen(d));
  }
  return out;
}

/**
 * Order for a compile queue: units whose key is new first (they carry the pipelines nothing else compiles, so every
 * worker starts on a slow one), then the rest; nearest first inside each group. Stable, returns a new array.
 */
export function orderUnits(units: readonly CompileUnit[]): CompileUnit[] {
  const byDist = [...units].sort((a, b) => a.distance - b.distance);
  const seenKeys = new Set<string>();
  const first: CompileUnit[] = []; const rest: CompileUnit[] = [];
  for (const u of byDist) {
    if (seenKeys.has(u.key)) rest.push(u);
    else { seenKeys.add(u.key); first.push(u); }
  }
  return [...first, ...rest];
}
