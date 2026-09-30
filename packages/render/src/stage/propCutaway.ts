/**
 * Posts, fences and other static props inside a dressed battle ring (IMPLEMENTATION-NOTES Part 5, T1 / audit
 * M2-battle-8: a route fence ran through the arena and its post covered the foe's face).
 *
 * Hand-placed props, boundary dressing and plaza details are merged per 32 m chunk into one geometry per tier
 * (`ewa:props:<chunk>:<c|n>:lod<t>`, zone builder step 6), so a single prop cannot be hidden by visibility or an
 * instance matrix. The cutaway makes every triangle whose centroid lies inside the ring degenerate — in an indexed
 * geometry its three indices become one, otherwise its three vertices collapse onto the first — and saves what it
 * overwrote; `restore` writes the originals back. Only the touched range is uploaded (one update range per
 * attribute). Nothing is created or removed under the zone root, no material or program changes (Pillar 7), and
 * geometry views that share the attributes (zone/split.ts) follow automatically. Allocation happens at `hide` /
 * `restore` (a battle event), never per frame.
 */
import { Box3, Vector3 } from 'three/webgpu';
import type { BufferAttribute, BufferGeometry, Mesh, Object3D } from 'three/webgpu';

/** Name prefix of the zone builder's merged static-prop meshes. */
export const PROP_MESH_PREFIX = 'ewa:props:';

interface Saved { readonly attr: BufferAttribute; readonly at: number; readonly data: Float32Array | Uint32Array | Uint16Array }

const _box = new Box3();
const _a = new Vector3(); const _b = new Vector3(); const _c = new Vector3();

export class PropCutaway {
  private meshes: Mesh[] = [];
  private readonly saved = new Map<number, Saved[]>();

  /** The loaded zone root (null = none: every cut is forgotten, the geometries are the zone's to dispose). */
  setRoot(root: Object3D | null): void {
    this.saved.clear();
    this.meshes = [];
    if (root === null) return;
    root.traverse((o) => { if ((o as Mesh).isMesh === true && o.name.startsWith(PROP_MESH_PREFIX)) this.meshes.push(o as Mesh); });
  }

  /** Hides every static-prop triangle whose centroid is within `r` m (horizontally) of (x, z); `slot` names the cut. */
  hide(slot: number, x: number, z: number, r: number): void {
    this.restore(slot);
    const out: Saved[] = [];
    const done = new Set<BufferAttribute>();
    const r2 = r * r;
    for (const m of this.meshes) {
      const g = m.geometry as BufferGeometry;
      const pos = g.getAttribute('position') as BufferAttribute | undefined;
      if (!pos) continue;
      const index = g.getIndex();
      const key = (index ?? pos) as BufferAttribute;
      if (done.has(key)) continue;                                        // a view of an attribute already cut
      if (g.boundingBox === null) g.computeBoundingBox();
      _box.copy(g.boundingBox!).applyMatrix4(m.matrixWorld);
      const dx = x < _box.min.x ? _box.min.x - x : x > _box.max.x ? x - _box.max.x : 0;
      const dz = z < _box.min.z ? _box.min.z - z : z > _box.max.z ? z - _box.max.z : 0;
      if (dx * dx + dz * dz > r2) continue;
      done.add(key);
      m.updateWorldMatrix(true, false);
      const tris = index !== null ? index.count / 3 : pos.count / 3;
      let lo = Number.POSITIVE_INFINITY; let hi = -1;
      const hit: number[] = [];
      for (let t = 0; t < tris; t++) {
        const i0 = index !== null ? index.getX(t * 3) : t * 3;
        const i1 = index !== null ? index.getX(t * 3 + 1) : t * 3 + 1;
        const i2 = index !== null ? index.getX(t * 3 + 2) : t * 3 + 2;
        _a.fromBufferAttribute(pos, i0).applyMatrix4(m.matrixWorld);
        _b.fromBufferAttribute(pos, i1).applyMatrix4(m.matrixWorld);
        _c.fromBufferAttribute(pos, i2).applyMatrix4(m.matrixWorld);
        const cx = (_a.x + _b.x + _c.x) / 3 - x; const cz = (_a.z + _b.z + _c.z) / 3 - z;
        if (cx * cx + cz * cz > r2) continue;
        hit.push(t);
        if (t < lo) lo = t;
        if (t > hi) hi = t;
      }
      if (hit.length === 0) continue;
      if (index !== null) {
        const arr = index.array as Uint32Array | Uint16Array;
        const at = lo * 3;
        out.push({ attr: index as BufferAttribute, at, data: arr.slice(at, (hi + 1) * 3) });
        for (const t of hit) { const v = arr[t * 3]!; arr[t * 3 + 1] = v; arr[t * 3 + 2] = v; }
        upload(index as BufferAttribute, at, (hi + 1 - lo) * 3);
      } else {
        const arr = pos.array as Float32Array;
        const at = lo * 9;
        out.push({ attr: pos, at, data: arr.slice(at, (hi + 1) * 9) });
        for (const t of hit) { const o = t * 9; for (let k = 3; k < 9; k++) arr[o + k] = arr[o + (k % 3)]!; }
        upload(pos, at, (hi + 1 - lo) * 9);
      }
    }
    if (out.length > 0) this.saved.set(slot, out);
  }

  /** Writes back what cut `slot` overwrote. */
  restore(slot: number): void {
    const s = this.saved.get(slot);
    if (s === undefined) return;
    this.saved.delete(slot);
    for (const e of s) {
      (e.attr.array as Float32Array | Uint32Array | Uint16Array).set(e.data, e.at);
      upload(e.attr, e.at, e.data.length);
    }
  }

  /** Triangles currently cut (tests / sandbox). */
  get cuts(): number { let n = 0; for (const s of this.saved.values()) n += s.length; return n; }
}

function upload(attr: BufferAttribute, start: number, count: number): void {
  attr.addUpdateRange(start, count);
  attr.needsUpdate = true;
}
