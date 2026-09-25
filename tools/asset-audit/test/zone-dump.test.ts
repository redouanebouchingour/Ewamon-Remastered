/**
 * The audit mirrors render's `ZoneDump` (SPEC §40.0.2 rule 5: no runtime import of `@ewa/render` from the tool).
 * This test is the drift guard: it builds a small zone graph, runs render's real `dumpZone()` on it (a test-only
 * import through the root vitest alias), serialises it exactly as `harness:budget --dump` would, and asserts the
 * audit parses it field for field.
 */
import { describe, expect, it } from 'vitest';
import { Group, Mesh, MeshBasicNodeMaterial, MeshStandardNodeMaterial, NearestFilter, PlaneGeometry, PointLight, SphereGeometry, Texture } from 'three/webgpu';
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
    expect(keys).toEqual(['counts', 'culledChunks', 'geometries', 'harvestLevel', 'lightIds', 'lights', 'materials', 'shadowDrawCalls', 'sprites', 'zone']);
    const d = renderDump(true);
    expect(Object.keys(d.materials[0]!).sort()).toEqual(['cls', 'ktx2', 'maps', 'surface', 'uuid']);
    expect(Object.keys(d.geometries[0]!).sort()).toEqual(['instanced', 'parameters', 'triangles', 'type', 'uuid']);
    expect(Object.keys(d.lights[0]!).sort()).toEqual(['castShadow', 'housingDistance', 'id', 'position', 'type']);
    expect(Object.keys(d.counts).sort()).toEqual([
      'attributes', 'attributesSize', 'drawCalls', 'geometries', 'materials', 'nonShadowLights', 'programs', 'renderTargets',
      'shadowLights', 'textures', 'texturesSize', 'triangles',
    ]);
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
