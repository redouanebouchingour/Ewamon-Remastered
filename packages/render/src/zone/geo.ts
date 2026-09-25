/**
 * Geometry toolkit for the §10.5.4 generators. Everything a generator returns is a plain `BufferGeometry` built
 * from `Float32Array`s (type `'BufferGeometry'`): temporary `ExtrudeGeometry` / `Shape` paths and raw lathes are
 * baked into per-surface triangle soups (`Parts`) and disposed immediately, so Pillar 3's audit never meets a stock
 * primitive under the zone root. Output is unwelded (flat face normals) unless a part asks for smooth normals
 * (trunks, terrain), carries metre UVs (the library multiplies by `1 / manifest.metres`, part-1 note M3) and a
 * `color` attribute holding the surface albedo (the harvest level-2 colour, §10.5.4).
 */
import { BufferAttribute, BufferGeometry, Euler, ExtrudeGeometry, Matrix3, Matrix4, Quaternion, Shape, Vector3 } from 'three/webgpu';
import { linearRgb } from '../materials/graph.js';
import { surfaceDef, type SurfaceId } from '../materials/surfaces.js';
import type { PropGeo } from './types.js';

const _v = new Vector3();
const _n = new Vector3();
const _nm = new Matrix3();

class Acc {
  readonly pos: number[] = [];
  readonly nrm: number[] = [];
  readonly uv: number[] = [];
}

export interface AddOpts {
  /** Swap u and v (wood grain along beams). */
  readonly swapUV?: boolean;
  /** Multiply UVs. */
  readonly uvScale?: number;
  /** Offset UVs (metres), to decorrelate repeated parts. */
  readonly uvOffset?: readonly [number, number];
}

/** Per-surface triangle soup. */
export class Parts {
  private readonly map = new Map<SurfaceId, Acc>();
  private readonly orderSeen: SurfaceId[] = [];

  private acc(s: SurfaceId): Acc {
    let a = this.map.get(s);
    if (a === undefined) { a = new Acc(); this.map.set(s, a); this.orderSeen.push(s); }
    return a;
  }

  surfaces(): readonly SurfaceId[] { return this.orderSeen; }

  isEmpty(): boolean {
    for (const a of this.map.values()) if (a.pos.length > 0) return false;
    return true;
  }

  triangles(): number {
    let n = 0;
    for (const a of this.map.values()) n += a.pos.length / 9;
    return n;
  }

  /** Appends `g` (indexed or not) transformed by `m`. Does not dispose `g`. */
  add(surface: SurfaceId, g: BufferGeometry, m?: Matrix4, o: AddOpts = {}): this {
    const a = this.acc(surface);
    const pos = g.getAttribute('position');
    const nrm = g.getAttribute('normal');
    const uv = g.getAttribute('uv');
    const idx = g.getIndex();
    const flip = m !== undefined && m.determinant() < 0;
    if (m) _nm.getNormalMatrix(m);
    const count = idx ? idx.count : pos.count;
    const us = o.uvScale ?? 1;
    const uo = o.uvOffset ?? [0, 0];
    for (let t = 0; t < count; t += 3) {
      for (let k = 0; k < 3; k++) {
        const kk = flip ? (k === 0 ? 0 : 3 - k) : k;
        const i = idx ? idx.getX(t + kk) : t + kk;
        _v.fromBufferAttribute(pos, i);
        if (m) _v.applyMatrix4(m);
        a.pos.push(_v.x, _v.y, _v.z);
        if (nrm) { _n.fromBufferAttribute(nrm, i); if (m) _n.applyMatrix3(_nm).normalize(); } else _n.set(0, 1, 0);
        a.nrm.push(_n.x, _n.y, _n.z);
        let u = uv ? uv.getX(i) : 0; let v = uv ? uv.getY(i) : 0;
        if (o.swapUV) { const tmp = u; u = v; v = tmp; }
        a.uv.push(u * us + uo[0], v * us + uo[1]);
      }
    }
    return this;
  }

  /** Appends one triangle (positions, one shared normal or per-vertex normals, uvs). */
  tri(surface: SurfaceId, p: readonly number[], n: readonly number[], uv: readonly number[]): this {
    const a = this.acc(surface);
    for (let k = 0; k < 9; k++) a.pos.push(p[k]!);
    if (n.length === 3) for (let k = 0; k < 3; k++) a.nrm.push(n[0]!, n[1]!, n[2]!); else for (let k = 0; k < 9; k++) a.nrm.push(n[k]!);
    for (let k = 0; k < 6; k++) a.uv.push(uv[k]!);
    return this;
  }

  /** Appends every surface of `other`, transformed by `m`. */
  addParts(other: Parts, m?: Matrix4): this {
    for (const s of other.orderSeen) {
      const src = other.map.get(s)!;
      const dst = this.acc(s);
      if (!m) { pushAll(dst.pos, src.pos); pushAll(dst.nrm, src.nrm); pushAll(dst.uv, src.uv); continue; }
      _nm.getNormalMatrix(m);
      const flip = m.determinant() < 0;
      for (let t = 0; t < src.pos.length; t += 9) {
        for (let k = 0; k < 3; k++) {
          const kk = flip ? (k === 0 ? 0 : 3 - k) : k;
          const o = t + kk * 3;
          _v.set(src.pos[o]!, src.pos[o + 1]!, src.pos[o + 2]!).applyMatrix4(m);
          _n.set(src.nrm[o]!, src.nrm[o + 1]!, src.nrm[o + 2]!).applyMatrix3(_nm).normalize();
          dst.pos.push(_v.x, _v.y, _v.z); dst.nrm.push(_n.x, _n.y, _n.z);
          const uo = (t / 9) * 6 + kk * 2;
          dst.uv.push(src.uv[uo]!, src.uv[uo + 1]!);
        }
      }
    }
    return this;
  }

  /** One `BufferGeometry` with a group per surface (in `order`, then first-seen order). */
  build(order?: readonly SurfaceId[]): { geometry: BufferGeometry; groups: { surface: SurfaceId; start: number; count: number }[]; surfaces: SurfaceId[] } {
    const seq: SurfaceId[] = [];
    if (order) for (const s of order) if (this.map.has(s) && !seq.includes(s)) seq.push(s);
    for (const s of this.orderSeen) if (!seq.includes(s)) seq.push(s);
    let verts = 0;
    for (const s of seq) verts += this.map.get(s)!.pos.length / 3;
    const pos = new Float32Array(verts * 3); const nrm = new Float32Array(verts * 3);
    const uv = new Float32Array(verts * 2); const col = new Float32Array(verts * 3);
    const g = new BufferGeometry();
    const groups: { surface: SurfaceId; start: number; count: number }[] = [];
    const surfaces: SurfaceId[] = [];
    let v0 = 0;
    for (const s of seq) {
      const a = this.map.get(s)!;
      const n = a.pos.length / 3;
      if (n === 0) continue;
      pos.set(a.pos, v0 * 3); nrm.set(a.nrm, v0 * 3); uv.set(a.uv, v0 * 2);
      linearRgb(surfaceDef(s).albedo, _v);
      for (let i = 0; i < n; i++) { col[(v0 + i) * 3] = _v.x; col[(v0 + i) * 3 + 1] = _v.y; col[(v0 + i) * 3 + 2] = _v.z; }
      g.addGroup(v0, n, surfaces.length);
      groups.push({ surface: s, start: v0, count: n });
      surfaces.push(s);
      v0 += n;
    }
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('normal', new BufferAttribute(nrm, 3));
    g.setAttribute('uv', new BufferAttribute(uv, 2));
    g.setAttribute('color', new BufferAttribute(col, 3));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return { geometry: g, groups, surfaces };
  }
}

function pushAll(dst: number[], src: readonly number[]): void {
  for (let i = 0; i < src.length; i++) dst.push(src[i]!);
}

/** Builds a `PropGeo` from three `Parts` tiers (lod2 may equal lod1 content). */
export function propGeo(lod0: Parts, lod1: Parts, lod2: Parts, impostorKind: string | null = null, order?: readonly SurfaceId[]): PropGeo {
  const b0 = lod0.build(order); const b1 = lod1.build(order); const b2 = lod2.build(order);
  return { lod0: b0.geometry, lod1: b1.geometry, lod2: b2.geometry, impostorKind, surfaces: b0.surfaces, groups: b0.groups };
}

// ---- matrices ----------------------------------------------------------------------------------------------

const _q = new Quaternion();
const _s = new Vector3();
const _p = new Vector3();
const _e = new Vector3();
const _eu = new Euler();

/** Translation + yaw (about +Y) + uniform scale. */
export function trs(x: number, y: number, z: number, yaw = 0, s = 1): Matrix4 {
  _q.setFromAxisAngle(_e.set(0, 1, 0), yaw);
  return new Matrix4().compose(_p.set(x, y, z), _q, _s.set(s, s, s));
}

/** Translation + euler XYZ + non-uniform scale. */
export function trsEuler(x: number, y: number, z: number, rx: number, ry: number, rz: number, sx = 1, sy = 1, sz = 1): Matrix4 {
  const m = new Matrix4().makeRotationFromEuler(_eu.set(rx, ry, rz, 'YXZ'));
  m.scale(_s.set(sx, sy, sz));
  m.setPosition(x, y, z);
  return m;
}

// ---- shapes ------------------------------------------------------------------------------------------------

const boxCache = new Map<string, BufferGeometry>();

/**
 * A box with `c` chamfers on all 12 edges (Pillar 3: 3–5 cm on buildings), bottom at y = 0, centred in x/z,
 * built as an `ExtrudeGeometry` (bevel) of an inset rectangle; UVs in metres. Cached per size within a build;
 * `releaseShapeCache()` disposes the cache.
 */
export function chamferBox(w: number, h: number, d: number, c = 0.04): BufferGeometry {
  const cc = Math.max(0.005, Math.min(c, w / 2.2, h / 2.2, d / 2.2));
  const key = `${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}|${cc.toFixed(3)}`;
  const hit = boxCache.get(key);
  if (hit) return hit;
  const s = new Shape();
  const hw = w / 2 - cc; const hd = d / 2 - cc;
  s.moveTo(-hw, -hd); s.lineTo(hw, -hd); s.lineTo(hw, hd); s.lineTo(-hw, hd); s.lineTo(-hw, -hd);
  const g = new ExtrudeGeometry(s, { depth: Math.max(0.001, h - 2 * cc), bevelEnabled: true, bevelSize: cc, bevelThickness: cc, bevelSegments: 2, curveSegments: 1, steps: 1 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, cc, 0);
  boxCache.set(key, g);
  return g;
}

/** Disposes every cached temporary shape geometry (call once a zone build finished). */
export function releaseShapeCache(): void {
  for (const g of boxCache.values()) g.dispose();
  boxCache.clear();
}

const _a = new Vector3();
const _b = new Vector3();
const _dir = new Vector3();
const _fx = new Vector3();
const _fz = new Vector3();
const _bm = new Matrix4();

export type V3 = readonly [number, number, number];

/**
 * A chamfered beam from `a` to `b` with cross-section `w` (in the plane ⟂ `face`) × `t` (along `face`), grain along
 * the beam. `face` defaults to world up for horizontal beams and world +z for vertical ones.
 */
export function beam(parts: Parts, surface: SurfaceId, a: V3, b: V3, w: number, t: number, c = 0.03, face?: V3, parent?: Matrix4): void {
  _a.set(a[0], a[1], a[2]); _b.set(b[0], b[1], b[2]);
  const len = _a.distanceTo(_b);
  if (len < 1e-4) return;
  _dir.copy(_b).sub(_a).divideScalar(len);
  if (face) _fz.set(face[0], face[1], face[2]); else if (Math.abs(_dir.y) > 0.9) _fz.set(0, 0, 1); else _fz.set(0, 1, 0);
  _fz.addScaledVector(_dir, -_fz.dot(_dir));
  if (_fz.lengthSq() < 1e-8) _fz.set(1, 0, 0).addScaledVector(_dir, -_dir.x);
  _fz.normalize();
  _fx.crossVectors(_dir, _fz).normalize();
  _bm.makeBasis(_fx, _dir, _fz).setPosition(_a);
  const m = parent ? _bm.clone().premultiply(parent) : _bm.clone();
  parts.add(surface, chamferBox(w, len, t, c), m, { swapUV: true, uvOffset: [a[0] * 0.37 + a[2] * 0.21, a[1] * 0.53] });
}

/** Axis-aligned chamfered box placed with its bottom centre at (x, y, z) and yaw. */
export function box(parts: Parts, surface: SurfaceId, x: number, y: number, z: number, w: number, h: number, d: number, yaw = 0, c = 0.04, parent?: Matrix4, o?: AddOpts): void {
  const m = trs(x, y, z, yaw);
  if (parent) m.premultiply(parent);
  parts.add(surface, chamferBox(w, h, d, c), m, o);
}

/** Extrudes `shape` (in its local XY plane) by `depth` along +Z with a `bevel` chamfer, adds it with `m`. */
export function extrude(parts: Parts, surface: SurfaceId, shape: Shape, depth: number, bevel: number, m: Matrix4, o?: AddOpts & { readonly curveSegments?: number; readonly bevelSegments?: number }): void {
  const g = new ExtrudeGeometry(shape, {
    depth: Math.max(0.001, depth - 2 * bevel), bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel,
    bevelSegments: o?.bevelSegments ?? 2, curveSegments: o?.curveSegments ?? 6, steps: 1,
  });
  g.translate(0, 0, bevel);
  parts.add(surface, g, m, o);
  g.dispose();
}

export function rectShape(x0: number, y0: number, x1: number, y1: number): Shape {
  const s = new Shape();
  s.moveTo(x0, y0); s.lineTo(x1, y0); s.lineTo(x1, y1); s.lineTo(x0, y1); s.lineTo(x0, y0);
  return s;
}

/** A closed polygon shape from xy points. */
export function polyShape(pts: readonly (readonly [number, number])[]): Shape {
  const s = new Shape();
  s.moveTo(pts[0]![0], pts[0]![1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i]![0], pts[i]![1]);
  s.lineTo(pts[0]![0], pts[0]![1]);
  return s;
}

// ---- lathe (raw arrays, metre UVs) ---------------------------------------------------------------------------

export interface LatheOpts {
  /** Radial segments. */
  readonly segments: number;
  /** Multiplier on the radius at (angle, profile index, height). */
  readonly radial?: (angle: number, j: number, y: number) => number;
  /** Horizontal offset of the axis at height y (lean / bend). */
  readonly axis?: (y: number, j: number) => readonly [number, number];
  /** Smooth normals (trunks) vs faceted (rocks, posts). Default smooth. */
  readonly smooth?: boolean;
  readonly phase?: number;
  /** Close the bottom / top with a cap fan. */
  readonly capBottom?: boolean;
  readonly capTop?: boolean;
}

/**
 * Lathes a profile of (radius, y) pairs around +Y into `parts`, transformed by `m`. UVs: u = arc length at the
 * mean radius (metres), v = profile arc length (metres).
 */
export function lathe(parts: Parts, surface: SurfaceId, profile: readonly (readonly [number, number])[], o: LatheOpts, m?: Matrix4): void {
  const seg = o.segments;
  const rows = profile.length;
  const cols = seg + 1;
  const pos = new Float32Array(rows * cols * 3);
  const uv = new Float32Array(rows * cols * 2);
  let meanR = 0;
  for (const [r] of profile) meanR += r;
  meanR = Math.max(0.02, meanR / rows);
  let vAcc = 0;
  for (let j = 0; j < rows; j++) {
    const [r, y] = profile[j]!;
    if (j > 0) vAcc += Math.hypot(r - profile[j - 1]![0], y - profile[j - 1]![1]);
    const ax = o.axis ? o.axis(y, j) : [0, 0] as const;
    for (let i = 0; i < cols; i++) {
      const a = ((i % seg) / seg) * Math.PI * 2 + (o.phase ?? 0);
      const rr = r * (o.radial ? o.radial(a, j, y) : 1);
      const k = j * cols + i;
      pos[k * 3] = ax[0] + Math.cos(a) * rr; pos[k * 3 + 1] = y; pos[k * 3 + 2] = ax[1] + Math.sin(a) * rr;
      uv[k * 2] = (i / seg) * Math.PI * 2 * meanR; uv[k * 2 + 1] = vAcc;
    }
  }
  const index: number[] = [];
  for (let j = 0; j + 1 < rows; j++) {
    for (let i = 0; i < seg; i++) {
      const a = j * cols + i; const b = a + 1; const c = a + cols; const d = c + 1;
      index.push(a, c, b, b, c, d);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('uv', new BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  if (o.smooth !== false) {
    // average the seam column so the smooth trunk has no shading seam
    const n = g.getAttribute('normal') as BufferAttribute;
    for (let j = 0; j < rows; j++) {
      const a = j * cols; const b = a + seg;
      const x = n.getX(a) + n.getX(b); const y = n.getY(a) + n.getY(b); const z = n.getZ(a) + n.getZ(b);
      const l = Math.hypot(x, y, z) || 1;
      n.setXYZ(a, x / l, y / l, z / l); n.setXYZ(b, x / l, y / l, z / l);
    }
    parts.add(surface, g, m);
  } else {
    const flat = g.toNonIndexed();
    flat.computeVertexNormals();
    parts.add(surface, flat, m);
    flat.dispose();
  }
  if (o.capTop || o.capBottom) {
    const cap = (j: number, up: boolean): void => {
      const [, y] = profile[j]!;
      const ax = o.axis ? o.axis(y, j) : [0, 0] as const;
      const p: number[] = []; const nn: number[] = []; const uu: number[] = [];
      for (let i = 0; i < seg; i++) {
        const k0 = j * cols + i; const k1 = j * cols + i + 1;
        const tri = up ? [ax[0], y, ax[1], pos[k1 * 3]!, y, pos[k1 * 3 + 2]!, pos[k0 * 3]!, y, pos[k0 * 3 + 2]!] : [ax[0], y, ax[1], pos[k0 * 3]!, y, pos[k0 * 3 + 2]!, pos[k1 * 3]!, y, pos[k1 * 3 + 2]!];
        for (let q = 0; q < 9; q++) p.push(tri[q]!);
        for (let q = 0; q < 3; q++) nn.push(0, up ? 1 : -1, 0);
        for (let q = 0; q < 3; q++) uu.push(tri[q * 3]!, tri[q * 3 + 2]!);
      }
      const cg = new BufferGeometry();
      cg.setAttribute('position', new BufferAttribute(new Float32Array(p), 3));
      cg.setAttribute('normal', new BufferAttribute(new Float32Array(nn), 3));
      cg.setAttribute('uv', new BufferAttribute(new Float32Array(uu), 2));
      parts.add(surface, cg, m);
      cg.dispose();
    };
    if (o.capBottom) cap(0, false);
    if (o.capTop) cap(rows - 1, true);
  }
  g.dispose();
}

// ---- cards ---------------------------------------------------------------------------------------------------

/**
 * An alpha card (quad) of w × h: bottom edge centred at `c`, facing `n` (horizontal-ish), tilted by `tilt` toward
 * +Y; uv 0..1 (v = 0 at the stem, the wind weight). `normalBend` blends the vertex normals toward `bendFrom → vertex`
 * (foliage volume lighting).
 */
export function card(parts: Parts, surface: SurfaceId, cx: number, cy: number, cz: number, w: number, h: number, yaw: number, tilt: number, bendFrom?: readonly [number, number, number], bend = 0.65, uvRect: readonly [number, number, number, number] = [0, 0, 1, 1], twoSided = false): void {
  const rx = Math.cos(yaw); const rz = -Math.sin(yaw);          // card right axis
  const ux = Math.sin(yaw) * Math.sin(tilt); const uy = Math.cos(tilt); const uz = Math.cos(yaw) * Math.sin(tilt);   // card up axis (tilted)
  const fx = Math.sin(yaw) * Math.cos(tilt); const fy = -Math.sin(tilt); const fz = Math.cos(yaw) * Math.cos(tilt); // face normal
  const hw = w / 2;
  const P = [
    [cx - rx * hw, cy, cz - rz * hw], [cx + rx * hw, cy, cz + rz * hw],
    [cx + rx * hw + ux * h, cy + uy * h, cz + rz * hw + uz * h], [cx - rx * hw + ux * h, cy + uy * h, cz - rz * hw + uz * h],
  ] as const;
  const UV = [[uvRect[0], uvRect[1]], [uvRect[2], uvRect[1]], [uvRect[2], uvRect[3]], [uvRect[0], uvRect[3]]] as const;
  const N = P.map((p) => {
    if (!bendFrom) return [fx, fy, fz];
    let dx = p[0] - bendFrom[0]; let dy = p[1] - bendFrom[1]; let dz = p[2] - bendFrom[2];
    const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
    const nx = fx * (1 - bend) + dx * bend; const ny = fy * (1 - bend) + dy * bend + 0.15; const nz = fz * (1 - bend) + dz * bend;
    const nl = Math.hypot(nx, ny, nz) || 1;
    return [nx / nl, ny / nl, nz / nl];
  });
  for (const [a, b, c] of [[0, 1, 2], [0, 2, 3]] as const) {
    parts.tri(surface, [...P[a], ...P[b], ...P[c]], [...N[a]!, ...N[b]!, ...N[c]!], [...UV[a], ...UV[b], ...UV[c]]);
  }
  if (twoSided) {
    // a back-to-back twin 1 cm behind with reversed winding and the SAME bent normals: three flips the normal of a
    // DoubleSide back face, so a single card seen from behind renders dark; the twin shows its lit front instead
    const o = 0.01;
    const Q = P.map((p) => [p[0] - fx * o, p[1] - fy * o, p[2] - fz * o] as const);
    for (const [a, b, c] of [[0, 2, 1], [0, 3, 2]] as const) {
      parts.tri(surface, [...Q[a]!, ...Q[b]!, ...Q[c]!], [...N[a]!, ...N[b]!, ...N[c]!], [...UV[a], ...UV[b], ...UV[c]]);
    }
  }
}

// ---- digest --------------------------------------------------------------------------------------------------

/** Incremental FNV-1a 32 over typed-array bytes (little-endian hosts; every shipping browser and Node). */
export class Digest {
  private h = 0x811c9dc5 | 0;
  add(a: ArrayBufferView): this {
    const b = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
    let h = this.h;
    for (let i = 0; i < b.length; i++) { h = (h ^ b[i]!) | 0; h = Math.imul(h, 0x01000193) | 0; }
    this.h = h;
    return this;
  }
  hex(): string { return (this.h >>> 0).toString(16).padStart(8, '0'); }
}
