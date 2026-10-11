/**
 * The level pad under a dressed battle ring (M3 independent review R-forgewall-2: on a slope the terrain rose through
 * the ring floor and buried the rope posts on the uphill side).
 *
 * The arena seats its ring so the downhill rim is closed by the ring's skirt (`battleStage.ts` `placeArena`); every
 * terrain vertex ABOVE that seat within `inner` m of the ring centre is lowered to the seat, and between `inner` and
 * `outer` the cut eases back (smoothstep) to the original height — a pad dug into the slope. Only lowered, never
 * raised. It works like the prop cutaway (`propCutaway.ts`): the zone's terrain chunk meshes (`ewa:terrain:<cx>,<cz>`,
 * `terrain/mesh.ts`) are edited in place and only the touched vertex range is uploaded; `restore` writes the saved
 * originals back. Nothing is created or removed under the zone root, no material or program changes (Pillar 7).
 * Allocation happens at `level` / `restore` (a battle event), never per frame.
 *
 * `adjust(x, z, y)` applies the same cut analytically: the actor pool samples the ground through it, so the trainers
 * and the spectators stand on the pad and on its eased bank, not on the ground that was there.
 */
import { Box3 } from 'three/webgpu';
import type { BufferAttribute, BufferGeometry, Mesh, Object3D } from 'three/webgpu';

/** Name prefix of the terrain chunk meshes (terrain/mesh.ts). */
export const TERRAIN_MESH_PREFIX = 'ewa:terrain:';
/** Pads that can be active at once (the main arena + the spectator arenas, `STAGE.coverArenas`). */
export const PAD_SLOTS = 4;

interface Saved { readonly attr: BufferAttribute; readonly at: number; readonly data: Float32Array }

const _box = new Box3();

function smooth(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / Math.max(1e-6, e1 - e0)));
  return t * t * (3 - 2 * t);
}

export class TerrainPad {
  private meshes: Mesh[] = [];
  private saved: Saved[] = [];
  /** Per slot: x, z, y (the seat), inner, outer; `on[slot]` = active. */
  private readonly pads = new Float64Array(PAD_SLOTS * 5);
  private readonly on = new Uint8Array(PAD_SLOTS);

  /** The loaded zone root (null = none: every pad is forgotten, the geometries are the zone's to dispose). */
  setRoot(root: Object3D | null): void {
    this.saved = [];
    this.on.fill(0);
    this.meshes = [];
    if (root === null) return;
    root.traverse((o) => { if ((o as Mesh).isMesh === true && o.name.startsWith(TERRAIN_MESH_PREFIX)) this.meshes.push(o as Mesh); });
  }

  /** Levels the terrain above `y` within `inner` m of (x, z), easing back to the original by `outer`; `slot` names the pad. */
  level(slot: number, x: number, z: number, y: number, inner: number, outer: number): void {
    if (slot < 0 || slot >= PAD_SLOTS || !Number.isFinite(y)) return;
    const o = slot * 5;
    this.pads[o] = x; this.pads[o + 1] = z; this.pads[o + 2] = y; this.pads[o + 3] = inner; this.pads[o + 4] = Math.max(inner, outer);
    this.on[slot] = 1;
    this.apply();
  }

  /** Removes pad `slot` (the terrain under it comes back). */
  restore(slot: number): void {
    if (slot < 0 || slot >= PAD_SLOTS || this.on[slot] === 0) return;
    this.on[slot] = 0;
    this.apply();
  }

  /** The ground height `y` at (x, z) as the active pads cut it (allocation-free; the actor pool's sampler). */
  adjust(x: number, z: number, y: number): number {
    if (!Number.isFinite(y)) return y;
    let out = y;
    for (let s = 0; s < PAD_SLOTS; s++) {
      if (this.on[s] === 0) continue;
      const o = s * 5;
      const py = this.pads[o + 2]!;
      if (out <= py) continue;
      const d = Math.hypot(x - this.pads[o]!, z - this.pads[o + 1]!);
      if (d >= this.pads[o + 4]!) continue;
      out = py + (out - py) * smooth(this.pads[o + 3]!, this.pads[o + 4]!, d);
    }
    return out;
  }

  /** Whether any pad is active. */
  get active(): boolean { for (let s = 0; s < PAD_SLOTS; s++) if (this.on[s] !== 0) return true; return false; }

  /** Vertices currently displaced or saved (tests / sandbox). */
  get savedRanges(): number { return this.saved.length; }

  /** Writes every saved original back, then cuts every active pad afresh (overlapping pads compose). */
  private apply(): void {
    for (const e of this.saved) { (e.attr.array as Float32Array).set(e.data, e.at); upload(e.attr, e.at, e.data.length); }
    this.saved = [];
    if (!this.active) return;
    const done = new Set<BufferAttribute>();
    for (const m of this.meshes) {
      const g = m.geometry as BufferGeometry;
      const pos = g.getAttribute('position') as BufferAttribute | undefined;
      if (pos === undefined || done.has(pos)) continue;
      if (g.boundingBox === null) g.computeBoundingBox();
      m.updateWorldMatrix(true, false);
      _box.copy(g.boundingBox!).applyMatrix4(m.matrixWorld);
      if (!this.touches(_box)) continue;
      done.add(pos);
      const e = m.matrixWorld.elements;   // terrain chunks are translated only (terrain/mesh.ts builds world positions)
      const tx = e[12]!; const ty = e[13]!; const tz = e[14]!;
      const arr = pos.array as Float32Array;
      let lo = Number.POSITIVE_INFINITY; let hi = -1;
      for (let i = 0; i < pos.count; i++) {
        const y0 = arr[i * 3 + 1]! + ty;
        if (this.adjust(arr[i * 3]! + tx, arr[i * 3 + 2]! + tz, y0) < y0 - 1e-6) { if (i < lo) lo = i; if (i > hi) hi = i; }
      }
      if (hi < 0) continue;
      const nrm = g.getAttribute('normal') as BufferAttribute | undefined;
      this.saved.push({ attr: pos, at: lo * 3, data: arr.slice(lo * 3, (hi + 1) * 3) });
      const narr = nrm !== undefined ? (nrm.array as Float32Array) : null;
      if (nrm !== undefined && narr !== null) this.saved.push({ attr: nrm, at: lo * 3, data: narr.slice(lo * 3, (hi + 1) * 3) });
      for (let i = lo; i <= hi; i++) {
        const x = arr[i * 3]! + tx; const z = arr[i * 3 + 2]! + tz; const y0 = arr[i * 3 + 1]! + ty;
        const y = this.adjust(x, z, y0);
        if (y >= y0 - 1e-6) continue;
        arr[i * 3 + 1] = y - ty;
        // on the flat pad the normal is up; the eased bank keeps the slope's normal (a soft cut, lit like the hill)
        if (narr !== null && this.onFlat(x, z)) { narr[i * 3] = 0; narr[i * 3 + 1] = 1; narr[i * 3 + 2] = 0; }
      }
      upload(pos, lo * 3, (hi + 1 - lo) * 3);
      if (nrm !== undefined) upload(nrm, lo * 3, (hi + 1 - lo) * 3);
    }
  }

  private onFlat(x: number, z: number): boolean {
    for (let s = 0; s < PAD_SLOTS; s++) {
      if (this.on[s] === 0) continue;
      const o = s * 5;
      if (Math.hypot(x - this.pads[o]!, z - this.pads[o + 1]!) <= this.pads[o + 3]!) return true;
    }
    return false;
  }

  private touches(b: Box3): boolean {
    for (let s = 0; s < PAD_SLOTS; s++) {
      if (this.on[s] === 0) continue;
      const o = s * 5;
      const x = this.pads[o]!; const z = this.pads[o + 1]!; const r = this.pads[o + 4]!;
      const dx = x < b.min.x ? b.min.x - x : x > b.max.x ? x - b.max.x : 0;
      const dz = z < b.min.z ? b.min.z - z : z > b.max.z ? z - b.max.z : 0;
      if (dx * dx + dz * dz <= r * r && b.max.y > this.pads[o + 2]!) return true;
    }
    return false;
  }
}

function upload(attr: BufferAttribute, start: number, count: number): void {
  attr.addUpdateRange(start, count);
  attr.needsUpdate = true;
}
