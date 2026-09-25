/**
 * SPEC §10.5.6 — water surfaces. One mesh per heightfield water body: a 0.5 m grid at the body's level over its
 * extent (+1.5 m), keeping only cells where the plane is above the terrain somewhere (the bank clips the rest by
 * depth), with the build-time `depthBelow` attribute (level − terrain height, ≥ 0) that the library's water graph
 * turns into the shallow → deep tint (no depth-buffer read). `castShadow = false`, `receiveShadow = true`.
 */
import { BufferAttribute, BufferGeometry, Mesh, Vector3 } from 'three/webgpu';
import type { Material } from 'three/webgpu';
import type { HeightfieldData } from '../contracts.js';
import { WATER_DEPTH_ATTRIBUTE, linearRgb } from '../materials/graph.js';
import { surfaceDef, type SurfaceId } from '../materials/surfaces.js';
import { heightClamped, waterAt, type WaterBody } from '../terrain/field.js';

const _c = new Vector3();

export function buildWaterMesh(h: HeightfieldData, body: WaterBody, surface: SurfaceId, material: Material): Mesh | null {
  const step = 0.5;
  const pad = 1.5;
  const x0 = body.x0 - pad; const x1 = body.x1 + pad; const z0 = body.z0 - pad; const z1 = body.z1 + pad;
  const nx = Math.round((x1 - x0) / step); const nz = Math.round((z1 - z0) / step);
  const level = body.level;
  const cols = nx + 1;
  const depth = new Float32Array((nx + 1) * (nz + 1));
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) depth[j * cols + i] = level - heightClamped(h, x0 + i * step, z0 + j * step);
  const pos: number[] = []; const nrm: number[] = []; const uv: number[] = []; const dep: number[] = []; const idx: number[] = [];
  const map = new Map<number, number>();
  const vtx = (i: number, j: number): number => {
    const k = j * cols + i;
    let v = map.get(k);
    if (v !== undefined) return v;
    v = pos.length / 3;
    map.set(k, v);
    const x = x0 + i * step; const z = z0 + j * step;
    pos.push(x, level, z); nrm.push(0, 1, 0); uv.push(x, z); dep.push(Math.max(0, depth[k]!));
    return v;
  };
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const d = Math.max(depth[j * cols + i]!, depth[j * cols + i + 1]!, depth[(j + 1) * cols + i]!, depth[(j + 1) * cols + i + 1]!);
      if (d <= 0.005) continue;
      // only over the water mask (dilated one sample): low ground elsewhere round the pond stays dry, as collision says
      const cx = x0 + (i + 0.5) * step; const cz = z0 + (j + 0.5) * step;
      let near = false;
      for (let dz = -1; dz <= 1 && !near; dz++) for (let dx = -1; dx <= 1 && !near; dx++) if (waterAt(h, cx + dx * 0.5, cz + dz * 0.5)) near = true;
      if (!near) continue;
      const a = vtx(i, j); const b = vtx(i + 1, j); const c = vtx(i, j + 1); const e = vtx(i + 1, j + 1);
      idx.push(a, c, b, b, c, e);
    }
  }
  if (idx.length === 0) return null;
  const n = pos.length / 3;
  const col = new Float32Array(n * 3);
  linearRgb(surfaceDef(surface).albedo, _c);
  for (let i = 0; i < n; i++) { col[i * 3] = _c.x; col[i * 3 + 1] = _c.y; col[i * 3 + 2] = _c.z; }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('normal', new BufferAttribute(new Float32Array(nrm), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  g.setAttribute('color', new BufferAttribute(col, 3));
  g.setAttribute(WATER_DEPTH_ATTRIBUTE, new BufferAttribute(new Float32Array(dep), 1));
  g.setIndex(n > 65535 ? new BufferAttribute(new Uint32Array(idx), 1) : new BufferAttribute(new Uint16Array(idx), 1));
  g.computeBoundingSphere(); g.computeBoundingBox();
  const m = new Mesh(g, material);
  m.name = `ewa:water:${body.id}`;
  m.castShadow = false;
  m.receiveShadow = true;
  return m;
}
