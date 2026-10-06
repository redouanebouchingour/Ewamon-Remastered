/**
 * Phase E3 (audit M2-link-east-1): the skirt beyond a linked edge follows the neighbour zone's terrain — its heights
 * (offset so the link points meet, blended in from this field's edge) and its road / plaza layers — instead of the
 * generic hills, and the skirt treeline keeps off the neighbour's road. Real content: mirevale's east link is mire_route.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Scene, Vector3 } from 'three/webgpu';
import type { Box3, BufferGeometry, Material, Mesh } from 'three/webgpu';
import { zone as contentZone, type ZoneId } from '@ewa/content';
import type { Dir, NeighbourSpec, ZoneSpec } from '../src/contracts.js';
import { LightRig } from '../src/lighting/rig.js';
import { heightClamped } from '../src/terrain/field.js';
import { NEIGHBOUR_SKIRT, neighbourWeight, skirtClearFn, skirtHeightFn, type SkirtOpts } from '../src/terrain/mesh.js';
import { buildZone, neighbourFields } from '../src/zone/builder.js';
import { edgePoint, roadDistance } from '../src/zone/layout.js';
import { paletteFor } from '../src/zone/palettes.js';
import { mockLibrary, realSpec } from './zone-helpers.js';

let warn: ReturnType<typeof vi.spyOn>;
beforeAll(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); return () => warn.mockRestore(); });

const OPP: Readonly<Record<Dir, Dir>> = { n: 's', s: 'n', e: 'w', w: 'e' };

/** The client adapter's `neighbourSpecsFor`, repeated (render tests may not import the client). */
function withNeighbours(spec: ZoneSpec): ZoneSpec {
  const z = contentZone(spec.id as ZoneId);
  const neighbours: Partial<Record<Dir, NeighbourSpec>> = {};
  for (const d of ['n', 'e', 's', 'w'] as const) {
    const to = z.links[d];
    if (to === undefined) continue;
    const nb = realSpec(to as ZoneId);
    const [x, zz] = edgePoint(nb.layout, OPP[d]);
    neighbours[d] = { id: nb.id, layout: nb.layout, seed: nb.seed, heightfield: nb.heightfield, plan: nb.plan, buildings: nb.buildings, ...(nb.interiors ? { interiors: nb.interiors } : {}), edge: { x, z: zz } };
  }
  return { ...spec, neighbours };
}

const BASE: Omit<SkirtOpts, 'neighbours'> = { reach: 60, rise: 14, salt: 7, exits: [] };

describe('E3 neighbour skirt — geometry of the join', () => {
  const spec = withNeighbours(realSpec('mirevale'));
  const fields = neighbourFields(spec);
  const east = fields.find((f) => f.dir === 'e')!;
  const half = spec.heightfield.size / 2;

  it('lays mire_route\'s west edge point on mirevale\'s east edge point, heights meeting there', () => {
    expect(contentZone('mirevale').links.e).toBe('mire_route');
    expect(east.dx).toBe(64 - -104);
    expect(east.dz).toBe(0);
    const nbEdge = spec.neighbours!.e!.edge;
    expect(heightClamped(east.h, nbEdge.x, nbEdge.z) + east.dy).toBeCloseTo(heightClamped(spec.heightfield, 64, 0), 6);
  });

  it('the skirt height equals the hills at the field edge and the neighbour\'s terrain past the blend band', () => {
    const hills = skirtHeightFn(spec.heightfield, BASE);
    const joined = skirtHeightFn(spec.heightfield, { ...BASE, neighbours: fields });
    for (const z of [-40, -10, 0, 12, 37]) {
      expect(joined(half + 0.01, z)).toBeCloseTo(hills(half + 0.01, z), 3);           // continuous with the field
      const x = half + NEIGHBOUR_SKIRT.blendM + 8;
      expect(neighbourWeight(east, half, x, z)).toBe(1);
      expect(joined(x, z)).toBeCloseTo(heightClamped(east.h, x - east.dx, z - east.dz) + east.dy, 6);
    }
    // the other sides keep their hills
    expect(joined(-half - 30, 5)).toBe(hills(-half - 30, 5));
    expect(joined(5, -half - 30)).toBe(hills(5, -half - 30));
  });

  it('the neighbour fades out toward its own field boundary (no cliff where its field ends)', () => {
    const nh = east.h.size / 2;
    const zEdge = east.dz + nh;                                 // the neighbour field's south boundary in world z
    expect(neighbourWeight(east, half, half + 40, zEdge - 0.5)).toBeLessThan(0.01);
    expect(neighbourWeight(east, half, half + 40, zEdge + 3)).toBe(0);
  });

  it('skirt scatter keeps off the neighbour\'s road', () => {
    const clear = skirtClearFn(spec.heightfield, { ...BASE, neighbours: fields });
    const roads = east.splat!.roads;
    let blocked = 0; let tested = 0;
    for (let x = half + 4; x < half + 60; x += 1.5) for (let z = -30; z <= 30; z += 1.5) {
      const d = roadDistance(roads, x - east.dx, z - east.dz);
      if (d < NEIGHBOUR_SKIRT.roadClearM - 0.5) { tested++; if (!clear(x, z)) blocked++; }
    }
    expect(tested).toBeGreaterThan(20);
    expect(blocked).toBe(tested);
    expect(clear(-half - 20, 0)).toBe(true);
  });
});

describe('E3 neighbour skirt — the built zone', () => {
  async function build(spec: ZoneSpec) {
    const lib = await mockLibrary();
    const scene = new Scene();
    return { h: buildZone(spec, { materials: lib, lighting: new LightRig(scene), scene }), lib };
  }

  it('mirevale\'s east skirt draws mire_route\'s road beyond the field; trees keep off it; the build is deterministic', async () => {
    const plain = realSpec('mirevale');
    const spec = withNeighbours(plain);
    const a = await build(spec);
    const b = await build(spec);
    const c = await build(plain);
    expect(a.h.geometryDigest).toBe(b.h.geometryDigest);
    expect(a.h.geometryDigest).not.toBe(c.h.geometryDigest);              // only the skirt geometry changed …
    const pal = paletteFor(spec.palette, spec.biome);
    const pathSurface = pal.terrainLayers[1];
    const half = spec.heightfield.size / 2;
    // … and only on the linked side: path-layer triangles of the skirt east of the field
    const pathTrisEast = (root: typeof a.h.group): number => {
      let n = 0;
      root.traverse((o) => {
        if (o.name !== 'ewa:skirt' || !(o as Mesh).isMesh) return;
        const m = o as Mesh; const g = m.geometry as BufferGeometry; const mats = m.material as Material[];
        g.computeBoundingBox();
        if ((g.boundingBox as Box3).min.x < half - 2) return;
        for (const grp of g.groups) if (a.lib.describe(mats[grp.materialIndex!]!)?.surface === pathSurface) n += grp.count / 3;
      });
      return n;
    };
    expect(pathTrisEast(a.h.group)).toBeGreaterThan(20);
    expect(pathTrisEast(c.h.group)).toBe(0);
    // skirt trees east of the field stand off the neighbour's road
    const east = neighbourFields(spec).find((f) => f.dir === 'e')!;
    const p = new Vector3();
    let onRoad = 0;
    for (const s of a.h.scatterInstances()) {
      if (!s.kind.startsWith('tree')) continue;
      for (let i = 0; i < s.matrices.length; i += 16) {
        p.set(s.matrices[i + 12]!, s.matrices[i + 13]!, s.matrices[i + 14]!);
        if (p.x <= half + 1) continue;
        if (roadDistance(east.splat!.roads, p.x - east.dx, p.z - east.dz) < NEIGHBOUR_SKIRT.roadClearM - 0.01) onRoad++;
      }
    }
    expect(onRoad).toBe(0);
    for (const x of [a, b, c]) x.h.dispose();
  });
});
