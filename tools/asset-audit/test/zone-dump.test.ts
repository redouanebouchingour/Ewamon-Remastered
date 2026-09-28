/**
 * The audit mirrors render's `ZoneDump` (SPEC §40.0.2 rule 5: no runtime import of `@ewa/render` from the tool).
 * This test is the drift guard: it builds a small zone graph, runs render's real `dumpZone()` on it (a test-only
 * import through the root vitest alias), serialises it exactly as `harness:budget --dump` would, and asserts the
 * audit parses it field for field.
 */
import { describe, expect, it } from 'vitest';
import { BackSide, Group, InstancedMesh, Mesh, MeshBasicNodeMaterial, MeshStandardNodeMaterial, NearestFilter, PlaneGeometry, PointLight, SphereGeometry, Texture } from 'three/webgpu';
import { dumpZone, readBudgetCounts } from '@ewa/render';
import type { ZoneDump as RenderZoneDump } from '@ewa/render';
import { DumpParseError, parseZoneDump } from '../src/zone-dump.js';
import type { ZoneDump } from '../src/zone-dump.js';
import { runAudit } from '../src/audit.js';

type DumpInput = Parameters<typeof dumpZone>[0];

const info = {
  render: { drawCalls: 12, triangles: 3456 },
  memory: { textures: 3, texturesSize: 1_000, geometries: 4, programs: 5, renderTargets: 6, attributes: 7, attributesSize: 800, total: 9_000 },
};

/** A stub `MaterialLibrary`: nothing is library-owned, so `dumpZone` classifies by `userData.ewaClass`. */
const library = { describe: () => null } as unknown as DumpInput['library'];

function scene(withHousing: boolean): Group {
  const root = new Group();
  const ground = new MeshStandardNodeMaterial();
  ground.userData.ewaClass = 'standard';
  root.add(new Mesh(new PlaneGeometry(10, 10), ground));
  const sprite = new MeshBasicNodeMaterial();
  sprite.userData.ewaClass = 'billboard';
  sprite.userData.ewaAtlas = 'a-000';
  const map = new Texture();
  map.magFilter = NearestFilter;
  map.anisotropy = 1;
  sprite.map = map;
  root.add(new Mesh(new PlaneGeometry(1, 1), sprite));
  if (withHousing) {
    const glow = new MeshStandardNodeMaterial();
    glow.userData.ewaClass = 'emissive';
    const housing = new Mesh(new SphereGeometry(0.2, 32, 16), glow);
    housing.position.set(2, 2.5, 0);
    root.add(housing);
  }
  const lamp = new PointLight(0xffcc88, 2, 8);
  lamp.position.set(2, 2.5, 0);
  lamp.userData.ewaLightId = 'lamp.0';
  root.add(lamp);
  return root;
}

function renderDump(withHousing: boolean): RenderZoneDump {
  return dumpZone({ zone: 'fixture', harvestLevel: 0, root: scene(withHousing), library, counts: readBudgetCounts(info, 2, 0, 1) });
}

describe('ZoneDump mirror (source: packages/render/src/stats.ts)', () => {
  it('parses a dump produced by render dumpZone() after a JSON round trip, field for field', () => {
    const produced = renderDump(true);
    const wire = JSON.parse(JSON.stringify(produced)) as unknown;
    const parsed: ZoneDump = parseZoneDump(wire);
    expect(parsed).toEqual(wire);
    expect(parsed.materials.map((m) => m.cls).sort()).toEqual(['billboard', 'emissive', 'standard']);
    expect(parsed.sprites).toEqual([{ atlas: 'a-000', magFilter: 1003, anisotropy: 1 }]);
    expect(parsed.lights[0]!.housingDistance).toBe(0);
    expect(parsed.counts.drawCalls).toBe(12);
  });

  it('keeps every top-level key render writes (a new render field fails here until it is mirrored)', () => {
    const keys = Object.keys(renderDump(true)).sort();
    expect(keys).toEqual(['counts', 'culledChunks', 'geometries', 'harvestLevel', 'lightIds', 'lightSources', 'lights', 'materials', 'shadowDrawCalls', 'sprites', 'zone']);
    const d = renderDump(true);
    expect(Object.keys(d.materials[0]!).sort()).toEqual(['cls', 'ktx2', 'maps', 'side', 'surface', 'uuid']);
    expect(Object.keys(d.geometries[0]!).sort()).toEqual(['instanced', 'instancedMesh', 'kind', 'parameters', 'sharedBy', 'triangles', 'type', 'uuid']);
    expect(Object.keys(d.lights[0]!).sort()).toEqual(['castShadow', 'housingDistance', 'id', 'position', 'type']);
    expect(Object.keys(d.counts).sort()).toEqual([
      'attributes', 'attributesSize', 'drawCalls', 'geometries', 'materials', 'nonShadowLights', 'programs', 'renderTargets',
      'shadowLights', 'textures', 'texturesSize', 'triangles',
    ]);
  });

  it('parses the §40.5.2 fields render writes: side, sharedBy, scatter kind / tier / instancedMesh, lightSources', () => {
    const root = scene(true);
    // a scatter kind drawn at two tiers sharing one geometry (rock_a: lod2 doubles as the impostor), instanced
    const rockGeo = new SphereGeometry(0.5, 32, 16);
    const rockMat = new MeshStandardNodeMaterial();
    rockMat.userData.ewaClass = 'standard';
    for (const t of [2, 3]) {
      const im = new InstancedMesh(rockGeo, rockMat, 1025);
      im.userData = { ewaScatterKind: 'rock_a', ewaScatterTier: t };
      root.add(im);
    }
    // a tagged housing whose light sits 2 m away (the second direction fails), plus a BackSide non-sky material
    root.userData.ewaHousings = [{ id: 'orphan:housing', min: [9.9, 0, -0.1], max: [10.1, 0.2, 0.1] }];
    const shell = new MeshBasicNodeMaterial({ side: BackSide });
    shell.userData.ewaClass = 'standard';
    root.add(new Mesh(new PlaneGeometry(1, 1), shell));
    // a real billboard keeps `map` null and publishes its atlas albedo as userData.ewaAlbedo (render notes P7)
    const card = new MeshStandardNodeMaterial();
    card.userData.ewaClass = 'billboard';
    card.userData.ewaAtlas = 'b-001';
    const albedo = new Texture();
    albedo.magFilter = NearestFilter;
    albedo.anisotropy = 1;
    card.userData.ewaAlbedo = albedo;
    root.add(new Mesh(new PlaneGeometry(1, 1), card));
    const produced = dumpZone({ zone: 'fixture', harvestLevel: 0, root, library, counts: readBudgetCounts(info, 2, 0, 1) });
    const parsed = parseZoneDump(JSON.parse(JSON.stringify(produced)));
    const rock = parsed.geometries.filter((g) => g.kind === 'rock_a');
    expect(rock.map((g) => g.tier)).toEqual([2, 3]);
    expect(rock.every((g) => g.instancedMesh === true && g.sharedBy === 2 && g.instanced === 1025)).toBe(true);
    expect(parsed.geometries.filter((g) => g.kind === null).every((g) => g.instancedMesh === false && g.tier === undefined)).toBe(true);
    expect(parsed.materials.map((m) => m.side).sort()).toEqual([0, 0, 0, 0, 0, 1]);
    expect(parsed.sprites).toContainEqual({ atlas: 'b-001', magFilter: 1003, anisotropy: 1 });
    expect(parsed.materials.find((m) => m.cls === 'billboard' && m.maps.albedo)).toBeDefined();
    expect(parsed.lightSources).toEqual([{ id: 'orphan:housing', lightDistance: expect.closeTo(Math.hypot(7.9, 2.3), 3) as unknown as number }]);
    const report = runAudit([{ dump: parsed, source: 'x.json', shot: 'x' }], { materialsManifest: { surfaces: {} } });
    const failed = new Set(report.violations.map((v) => v.rule));
    expect(failed.has('lights.housing')).toBe(true);            // the orphan housing has no light within 0.6
    expect(failed.has('geometry.noOutlineShells')).toBe(true);  // BackSide on a non-sky material
    expect(failed.has('scatter.instanced')).toBe(true);          // rock_a lacks lod0 / lod1 in this fixture
    expect(report.unevaluated['scatter.instanced']).toBeUndefined();
    expect(report.unevaluated['geometry.noOutlineShells']).toBeUndefined();
  });

  it('reads render\'s Infinity housing distance (JSON null) as "no housing" and lights.housing fails on it', () => {
    const produced = renderDump(false);
    expect(produced.lights[0]!.housingDistance).toBe(Number.POSITIVE_INFINITY);
    const parsed = parseZoneDump(JSON.parse(JSON.stringify(produced)));
    expect(parsed.lights[0]!.housingDistance).toBeNull();
    const report = runAudit([{ dump: parsed, source: 'x.json', shot: 'x' }], { materialsManifest: { surfaces: {} } });
    expect(report.violations.map((v) => v.rule)).toContain('lights.housing');
  });

  it('rejects a malformed dump with the JSON path of the offending field', () => {
    const wire = JSON.parse(JSON.stringify(renderDump(true))) as Record<string, unknown>;
    (wire.counts as Record<string, unknown>).drawCalls = 'many';
    expect(() => parseZoneDump(wire)).toThrow(DumpParseError);
    expect(() => parseZoneDump(wire)).toThrow(/\.counts\.drawCalls/);
    expect(() => parseZoneDump({ ...wire, harvestLevel: 3 })).toThrow(/\.harvestLevel/);
    expect(() => parseZoneDump({ ...wire, materials: [{ uuid: 'm', cls: 'toon', surface: null, maps: { albedo: true, orm: true, normal: true }, ktx2: true }] })).toThrow(/unknown material class/);
  });
});
