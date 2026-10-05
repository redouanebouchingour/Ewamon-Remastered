/**
 * Node-side helpers for the zone tests: a material library over mock textures, a mock GPU bookkeeper that mirrors
 * three 0.186's `renderer.info.memory` accounting (geometries / attributes on geometry dispose, render objects and
 * programs on object / material dispose, textures on texture dispose), and a small synthetic ZoneSpec.
 */
import { vi } from 'vitest';
import { InstancedMesh, Mesh, Texture } from 'three/webgpu';
import type { BufferAttribute, BufferGeometry, InterleavedBufferAttribute, Material, Object3D } from 'three/webgpu';
import { createMaterialLibraryWith, type MaterialLibrary } from '../src/materials/library.js';
import type { MaterialsManifest } from '../src/materials/manifest.js';
import { SURFACE_IDS } from '../src/materials/surfaces.js';
import type { Dir, Edge, HeightfieldData, InteriorSpec, Marker, ZonePlanData, ZoneSpec } from '../src/contracts.js';
import { SET_PIECE_BY_ZONE, getHeightfield, interiorsFor, zone as contentZone, zonePlan, type ZoneId } from '@ewa/content';
import { INTERIOR_SIZE, edgePoint, lightsFromPlan } from '../src/zone/layout.js';

type Attr = BufferAttribute | InterleavedBufferAttribute;

/** A library whose every texture is a fresh `Texture` (counted by the mock GPU through dispose events). */
export async function mockLibrary(gpu?: MockGpu): Promise<MaterialLibrary> {
  const manifest: MaterialsManifest = {
    version: 2,
    surfaces: Object.fromEntries(SURFACE_IDS.map((id) => [id, {
      field: { albedo: `${id}.a`, orm: `${id}.o`, normal: `${id}.n`, size: 512, bytes: 3000 }, hero: null, metres: 2, wrap: 'repeat', hash: id, albedoClampedPct: 0,
    }])),
    byBiome: {}, placeholder: { albedo: 'p.a', orm: 'p.o', normal: 'p.n' }, fieldBytes: 0, heroBytes: 0, totalBytes: 0,
  };
  const lib = createMaterialLibraryWith({
    baseUrl: '/m/',
    source: { load: async (url: string) => { const t = new Texture(); t.name = url; gpu?.trackTexture(t); return t; } },
    fetchJson: async () => manifest,
  });
  await lib.ready;
  return lib;
}

/** Mirrors three 0.186's memory bookkeeping closely enough to prove the disposal contract in node. */
export class MockGpu {
  readonly geometries = new Set<BufferGeometry>();
  readonly attributes = new Set<Attr>();
  readonly textures = new Set<Texture>();
  /** Render objects keyed by object → material set; a "program" is a (material, instanced) pair in use. */
  private readonly renderObjects = new Map<Object3D, Set<Material>>();
  private readonly programUse = new Map<string, number>();
  private readonly geoAttrs = new Map<BufferGeometry, Attr[]>();

  trackTexture(t: Texture): void {
    this.textures.add(t);
    const onDispose = (): void => { this.textures.delete(t); t.removeEventListener('dispose', onDispose); };
    t.addEventListener('dispose', onDispose);
  }

  private trackGeometry(g: BufferGeometry, extra: readonly Attr[]): void {
    let list = this.geoAttrs.get(g);
    if (list === undefined) {
      list = [];
      this.geoAttrs.set(g, list);
      this.geometries.add(g);
      const onDispose = (): void => {
        this.geometries.delete(g);
        for (const a of this.geoAttrs.get(g) ?? []) this.attributes.delete(a);
        this.geoAttrs.delete(g);
        g.removeEventListener('dispose', onDispose);
      };
      g.addEventListener('dispose', onDispose);
      for (const a of Object.values(g.attributes)) { list.push(a); this.attributes.add(a); }
      if (g.index) { list.push(g.index); this.attributes.add(g.index); }
    }
    for (const a of extra) if (!list.includes(a)) { list.push(a); this.attributes.add(a); }
  }

  /** One "frame": every visible mesh under `root` gets geometry, attributes, render objects and programs. */
  render(root: Object3D): void {
    root.traverseVisible((o) => {
      if (!(o instanceof Mesh)) return;
      const inst = o instanceof InstancedMesh;
      const extra: Attr[] = inst ? [o.instanceMatrix, ...(o.instanceColor ? [o.instanceColor] : [])] : [];
      this.trackGeometry(o.geometry, extra);
      const mats: Material[] = Array.isArray(o.material) ? o.material : [o.material];
      let set = this.renderObjects.get(o);
      if (set === undefined) {
        set = new Set();
        this.renderObjects.set(o, set);
        const onDispose = (): void => { this.releaseObject(o); o.removeEventListener('dispose', onDispose); };
        o.addEventListener('dispose', onDispose);
      }
      for (const m of mats) {
        if (set.has(m)) continue;
        set.add(m);
        const key = `${m.uuid}|${inst ? 'i' : 'm'}`;
        this.programUse.set(key, (this.programUse.get(key) ?? 0) + 1);
      }
    });
  }

  private releaseObject(o: Object3D): void {
    const set = this.renderObjects.get(o);
    if (!set) return;
    const inst = o instanceof InstancedMesh;
    for (const m of set) {
      const key = `${m.uuid}|${inst ? 'i' : 'm'}`;
      const n = (this.programUse.get(key) ?? 1) - 1;
      if (n <= 0) this.programUse.delete(key); else this.programUse.set(key, n);
    }
    this.renderObjects.delete(o);
  }

  memory(): { geometries: number; attributes: number; textures: number; programs: number; renderObjects: number } {
    return { geometries: this.geometries.size, attributes: this.attributes.size, textures: this.textures.size, programs: this.programUse.size, renderObjects: this.renderObjects.size };
  }
}

/** A small synthetic field (fast to build) with a pond, for many load/unload cycles. */
export function syntheticSpec(seed = 7): ZoneSpec {
  const size = 48; const step = 0.5; const res = size / step + 1;
  const heights = new Float32Array(res * res); const walkable = new Uint8Array(res * res); const water = new Uint8Array(res * res);
  for (let r = 0; r < res; r++) for (let c = 0; c < res; c++) {
    const x = -size / 2 + c * step; const z = -size / 2 + r * step;
    const i = r * res + c;
    const d = Math.hypot(x - 10, z - 8);
    heights[i] = Math.round((Math.sin(x * 0.2) * 0.3 + Math.cos(z * 0.17) * 0.3 - (d < 4 ? (1 - (d / 4) ** 2) * 0.8 : 0)) * 64) / 64;
    water[i] = d < 3.2 ? 1 : 0;
    walkable[i] = Math.abs(x) < size / 2 - 2 && Math.abs(z) < size / 2 - 2 && water[i] === 0 ? 1 : 0;
  }
  const heightfield: HeightfieldData = { zoneId: 'synthetic', size, step: 0.5, res, originX: -size / 2, originZ: -size / 2, heights, walkable, water, digest: 'synthetic' };
  return {
    id: 'synthetic', seed, biome: 'grove', palette: 'grove_mire', generators: 'grove', layout: 'story', size: { w: size - 4, d: size - 4 }, heightfield,
    warps: [], setPiece: 'mire_boardwalk', edges: { e: { toZone: 'x', x: 20, z: 0 } },
    buildings: [{ id: 'h', kind: 'house', x: -10, z: -10, yaw: 0.3, w: 7, d: 6, floors: 2, roof: 'thatch', seed: 11 }],
    props: [{ kind: 'well', x: 6, z: -12, yaw: 0, scale: 1, seed: 3 }, { kind: 'barrel', x: -4, z: 12, yaw: 1, scale: 1, seed: 4 }],
    lights: [{ id: 'l1', kind: 'lantern', color: '#ffb35c', intensity: 40, position: [-4, 2.9, -4], castShadow: true, range: 12, housing: { kind: 'generated', generator: 'lantern', seed: 5 }, flicker: null }],
    actors: [{ id: 'a', look: 'x', x: 2, z: 2, kind: 'npc' }], pickups: [], tablets: [], tallGrass: true, water: null, accentType: 'Grass', harvestLevel: 0,
    plan: {
      plaza: { x: 0, z: 0, r: 14 }, roads: [{ id: 'road_e', kind: 'road', width: 4, points: [[13.4, 0], [18, 1.2], [24, 0]] }], doorPaths: [], roadMeander: null,
      grassPatches: [{ x: -12, z: 12, rx: 5, rz: 3, yaw: 0.3 }], clearings: [], setPiece: { id: 'mire_boardwalk', x: 0, z: 0, yaw: 0, hw: 15, hd: 4.5 },
      points: [[2, 2]], warpPairs: [],
    },
  };
}

/** Spies Material/Texture `dispose` on the prototypes for the duration of `fn`. */
export async function countDisposals<T>(fn: () => T | Promise<T>): Promise<{ result: T; materials: number; textures: number }> {
  const { Material: M } = await import('three/webgpu');
  const ms = vi.spyOn(M.prototype, 'dispose');
  const ts = vi.spyOn(Texture.prototype, 'dispose');
  try {
    const result = await fn();
    return { result, materials: ms.mock.calls.length, textures: ts.mock.calls.length };
  } finally { ms.mockRestore(); ts.mockRestore(); }
}

/**
 * A real slice ZoneSpec for render-side tests, from content's zone plan exactly as the client adapter builds it
 * (`packages/client/src/scene/zoneSpecFor.ts`; render tests may not import the client package). Water spec omitted.
 */
export function realSpec(id: ZoneId, harvestLevel: 0 | 1 | 2 = 0): ZoneSpec {
  const z = contentZone(id as ZoneId);
  const heightfield = getHeightfield(z.id);
  const layout = z.kind;
  const edges: Partial<Record<Dir, Edge>> = {};
  for (const d of ['n', 'e', 's', 'w'] as const) { const to = z.links[d]; if (to) { const [x, zz] = edgePoint(layout, d); edges[d] = { toZone: to, x, z: zz }; } }
  const warps: Marker[] = z.warps.flatMap((w) => [{ id: w.id, x: w.x, z: w.z }, { id: `${w.id}:to`, x: w.toX, z: w.toZ }]);
  const actors = [...z.npcs.map((n) => ({ id: n.id, look: n.look, x: n.x, z: n.z, kind: 'npc' as const })), ...z.trainers.map((t) => ({ id: t.id, look: t.look, x: t.x, z: t.z, kind: 'trainer' as const }))];
  const pickups = z.items.map((i) => ({ id: i.id, x: i.x, z: i.z }));
  const tablets = z.lore.map((l) => ({ id: l.id, x: l.x, z: l.z }));
  const setPiece = SET_PIECE_BY_ZONE[z.id];
  const tallGrass = z.encounterTable !== null;
  const seed = z.layoutSeed >>> 0;
  const p = zonePlan(z.id);
  const buildings = p.buildings.map((b) => ({ id: b.id, kind: b.kind, x: b.x, z: b.z, yaw: b.yaw, w: b.w, d: b.d, floors: b.floors, roof: b.roof, seed: b.seed }));
  const props = p.props.map((q) => ({ kind: q.kind, x: q.x, z: q.z, yaw: q.yaw, scale: q.scale, seed: q.seed }));
  const lights = lightsFromPlan(p.lights, z.biome, setPiece, z.type);
  const plan: ZonePlanData = {
    plaza: p.plaza, roads: p.roads, doorPaths: p.doorPaths, roadMeander: p.roadMeander, grassPatches: p.grassPatches, clearings: p.clearings,
    setPiece: p.setPiece, points: p.points, warpPairs: p.warpPairs,
  };
  return {
    id: z.id, seed, biome: z.biome, palette: z.palette, generators: z.biome, layout, size: { w: INTERIOR_SIZE[layout], d: INTERIOR_SIZE[layout] }, heightfield,
    warps, setPiece, edges, buildings, props, lights, actors, pickups, tablets, tallGrass, water: null, accentType: z.type, harvestLevel, plan,
    interiors: interiorSpecsFor(z.id),
  };
}

/** Content's placed pockets as render `InteriorSpec`s (the client adapter's `interiorSpecsFor`, repeated: render tests may not import the client). */
export function interiorSpecsFor(zoneId: ZoneId): InteriorSpec[] {
  return interiorsFor(zoneId).map((p) => {
    const d = p.def;
    return {
      id: d.id, building: d.building, template: d.template, theme: d.theme, x: p.at.x, z: p.at.z, yaw: p.at.yaw, floorY: p.at.floorY, w: d.w, d: d.d,
      footprint: { x: p.footprint.x, z: p.footprint.z, hw: p.footprint.hw, hd: p.footprint.hd },
      entry: { lx: d.entry.lx, lz: d.entry.lz }, exit: { lx: d.exit.lx, lz: d.exit.lz },
      walls: d.walls.map((w) => ({ lx: w.lx, lz: w.lz, hw: w.hw, hd: w.hd, style: w.style })),
      gates: d.gates.map((g) => ({ lx: g.rect.lx, lz: g.rect.lz, hw: g.rect.hw, hd: g.rect.hd, id: g.id, style: g.style })),
      switches: d.switches.map((s) => ({ id: s.id, kind: s.kind, lx: s.lx, lz: s.lz })),
      rooms: d.rooms.map((r) => ({ id: r.id, arena: { lx: r.arena.lx, lz: r.arena.lz }, leaderAt: r.leaderAt === null ? null : { lx: r.leaderAt.lx, lz: r.leaderAt.lz }, bounds: { lx: r.bounds.lx, lz: r.bounds.lz, hw: r.bounds.hw, hd: r.bounds.hd } })),
      props: d.props.map((q) => ({ kind: q.kind, lx: q.lx, lz: q.lz, yaw: q.yaw, scale: q.scale })),
    };
  });
}
