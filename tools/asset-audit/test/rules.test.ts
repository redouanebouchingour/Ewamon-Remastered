/**
 * SPEC §50.4.8 `tools/asset-audit/test/rules.test.ts`: one violating fixture per rule with the rule id asserted in
 * the error, `fixtures/empty-zone.json` passes every rule, the `--bytes` roll-up fails on any §40.6 ceiling, and the
 * `--baseline` regression gate trips at +5 %.
 */
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { loadDumps, runAudit } from '../src/audit.js';
import type { AuditReport } from '../src/audit.js';
import { CEILINGS, LICENCES, creaturesAnimShare, runBytes } from '../src/bytes.js';
import { COUNT_CAPS, HOUSING_MAX, MATERIALS_MAX, NON_SHADOW_LIGHTS_MAX, SHADOW_DRAW_CALLS_MAX, SHADOW_LIGHTS_MAX } from '../src/caps.js';
import { main } from '../src/cli.js';
import { RULE_IDS } from '../src/registry.js';
import type { LoadedDump, MaterialsManifestLike } from '../src/types.js';
import { parseZoneDump } from '../src/zone-dump.js';
import type { DumpGeometry, DumpMaterial, ZoneDump } from '../src/zone-dump.js';

const FIXTURES = resolve(__dirname, '..', 'fixtures');
const EMPTY: ZoneDump = parseZoneDump(JSON.parse(readFileSync(join(FIXTURES, 'empty-zone.json'), 'utf8')));
const MANIFEST: MaterialsManifestLike = { surfaces: { cobble: { albedoClampedPct: 0 }, moss: { albedoClampedPct: 1.5 }, unbaked: {} } };

const tmp: string[] = [];
afterAll(() => { for (const d of tmp) rmSync(d, { recursive: true, force: true }); });
function tempDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'ewa-audit-'));
  tmp.push(d);
  return d;
}

const mat = (o: Partial<DumpMaterial> = {}): DumpMaterial => ({
  uuid: 'm-0', cls: 'standard', surface: 'cobble', maps: { albedo: true, orm: true, normal: true }, ktx2: true, ...o,
});
const geo = (o: Partial<DumpGeometry> = {}): DumpGeometry => ({ uuid: 'g-0', type: 'BufferGeometry', parameters: null, triangles: 100, instanced: 1, ...o });
const dump = (o: Partial<ZoneDump> = {}): ZoneDump => ({ ...EMPTY, zone: 'fixture', ...o, counts: { ...EMPTY.counts, ...(o.counts ?? {}) } });
const one = (d: ZoneDump, shot = 'shot'): LoadedDump[] => [{ dump: d, source: `${shot}.json`, shot }];
const audit = (dumps: LoadedDump[], manifest: MaterialsManifestLike | null = MANIFEST): AuditReport => runAudit(dumps, { materialsManifest: manifest });
const failed = (r: AuditReport): string[] => [...new Set(r.violations.map((v) => v.rule))].sort();

/** One violating fixture per §50.4.6 rule — each must fail exactly that rule. */
const VIOLATING: Readonly<Record<string, () => LoadedDump[]>> = {
  'budget.counts.drawCalls': () => one(dump({ counts: { ...EMPTY.counts, drawCalls: COUNT_CAPS.drawCalls + 1 } })),
  'budget.counts.triangles': () => one(dump({ counts: { ...EMPTY.counts, triangles: COUNT_CAPS.triangles + 1 } })),
  'budget.counts.texturesSize': () => one(dump({ counts: { ...EMPTY.counts, texturesSize: COUNT_CAPS.texturesSize + 1 } })),
  'budget.counts.renderTargets': () => one(dump({ counts: { ...EMPTY.counts, renderTargets: COUNT_CAPS.renderTargets + 1 } })),
  'budget.counts.programs': () => one(dump({ counts: { ...EMPTY.counts, programs: COUNT_CAPS.programs + 1 } })),
  'materials.count': () => one(dump({ materials: Array.from({ length: MATERIALS_MAX + 1 }, (_, i) => mat({ uuid: `m-${i}` })) })),
  'materials.threeMaps': () => one(dump({ materials: [mat({ maps: { albedo: true, orm: false, normal: true } })] })),
  'materials.albedoCeiling': () => one(dump({ materials: [mat({ surface: 'unbaked' })] })),
  'textures.ktx2Only': () => one(dump({ materials: [mat({ cls: 'water', ktx2: false })] })),
  'geometry.noPrimitives': () => one(dump({ geometries: [geo({ type: 'SphereGeometry', parameters: { radius: 1, widthSegments: 8, heightSegments: 6 } })] })),
  'geometry.noOutlineShells': () => one(dump({ materials: [mat({ side: 1 })] })),
  'scatter.instanced': () => one(dump({ geometries: [0, 1, 2].map((t) => geo({ uuid: `tree-${t}`, kind: 'tree_oak', tier: t as 0 | 1 | 2, instancedMesh: true })) })),
  'lights.count': () => one(dump({ lights: Array.from({ length: SHADOW_LIGHTS_MAX + 1 }, (_, i) => ({ id: `l${i}`, type: 'PointLight' as const, castShadow: true, position: [0, 2, i] as const, housingDistance: 0.1 })) })),
  'lights.housing': () => one(dump({ lights: [{ id: 'lamp.0', type: 'SpotLight', castShadow: false, position: [0, 3, 0], housingDistance: HOUSING_MAX + 0.01 }] })),
  'sprites.nearest': () => one(dump({ sprites: [{ atlas: 'a-000', magFilter: 1006, anisotropy: 1 }] })),
  'shadows.drawCalls': () => one(dump({ shadowDrawCalls: SHADOW_DRAW_CALLS_MAX + 1 })),
  'harvest.same': () => [
    { dump: dump({ harvestLevel: 0, materials: [mat(), mat({ uuid: 'm-1', cls: 'card' })] }), source: 'noon-h0.json', shot: 'noon-h0' },
    { dump: dump({ harvestLevel: 2, materials: [mat(), mat({ uuid: 'm-1', cls: 'standard' })] }), source: 'noon-h2.json', shot: 'noon-h2' },
  ],
};

describe('§40.0.1: asset-audit depends on nothing but node:*', () => {
  it('every import under src/ is relative or node:*', () => {
    const src = resolve(__dirname, '..', 'src');
    const files: string[] = [];
    const walk = (d: string): void => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        if (e.isDirectory()) walk(join(d, e.name)); else if (e.name.endsWith('.ts')) files.push(join(d, e.name));
      }
    };
    walk(src);
    expect(files.length).toBeGreaterThan(20);
    for (const f of files) {
      for (const m of readFileSync(f, 'utf8').matchAll(/^\s*(?:import|export)[^'"]*from\s+['"]([^'"]+)['"]/gm)) {
        expect(m[1]!.startsWith('.') || m[1]!.startsWith('node:'), `${f}: ${m[1]}`).toBe(true);
      }
    }
    expect(Object.keys((JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json'), 'utf8')) as { dependencies: object }).dependencies)).toEqual([]);
  });
});

describe('§40.5.2 rule set', () => {
  it('implements exactly the §50.4.6 rule names, one file per rule', () => {
    const files = readdirSync(resolve(__dirname, '..', 'src', 'rules')).map((f) => f.replace(/\.ts$/, '')).sort();
    expect(files).toEqual([...RULE_IDS].sort());
    expect([...RULE_IDS]).toEqual([
      'budget.counts.drawCalls', 'budget.counts.triangles', 'budget.counts.texturesSize', 'budget.counts.renderTargets', 'budget.counts.programs',
      'materials.count', 'materials.threeMaps', 'materials.albedoCeiling', 'textures.ktx2Only',
      'geometry.noPrimitives', 'geometry.noOutlineShells', 'scatter.instanced',
      'lights.count', 'lights.housing', 'sprites.nearest', 'shadows.drawCalls', 'harvest.same',
    ]);
    expect(Object.keys(VIOLATING).sort()).toEqual([...RULE_IDS].sort());
  });

  it('pins the §50.2.2 / §10.5.8 numbers (render targets / programs as amended 2026-09-25)', () => {
    expect(COUNT_CAPS).toEqual({ drawCalls: 400, triangles: 2_500_000, texturesSize: 734_003_200, renderTargets: 41, programs: 128 });
    expect([MATERIALS_MAX, SHADOW_LIGHTS_MAX, NON_SHADOW_LIGHTS_MAX, HOUSING_MAX, SHADOW_DRAW_CALLS_MAX]).toEqual([48, 8, 24, 0.6, 564]);
  });

  it('fixtures/empty-zone.json passes every rule, evaluated (§50.5 M1)', () => {
    const r = audit(loadDumps(join(FIXTURES, 'empty-zone.json')));
    expect(r.violations).toEqual([]);
    expect(r.unevaluated).toEqual({});
    expect(Object.keys(r.worst).sort()).toEqual([...RULE_IDS].sort());
  });

  for (const id of Object.keys(VIOLATING)) {
    it(`${id}: its violating fixture fails with the rule id, and only that rule`, () => {
      const r = audit(VIOLATING[id]!());
      expect(failed(r)).toEqual([id]);
      for (const v of r.violations) {
        expect(v.rule).toBe(id);
        expect(v.message.length).toBeGreaterThan(0);
        expect(v.zone).toBe('fixture');
      }
    });
  }

  it('the CLI exits 1 on a violating dump and prints the rule id with the offending object', () => {
    const dir = tempDir();
    writeFileSync(join(dir, 'bad.json'), JSON.stringify(VIOLATING['sprites.nearest']!()[0]!.dump));
    const lines: string[] = [];
    const code = main(['--dump', join(dir, 'bad.json'), '--report', join(dir, 'report.json'), '--materials', join(dir, 'none.json')], (s) => lines.push(s));
    expect(code).toBe(1);
    const out = lines.join('\n');
    expect(out).toMatch(/FAIL sprites\.nearest fixture\/bad: sprite atlas a-000/);
    expect(out).toContain('"magFilter":1006');
    const report = JSON.parse(readFileSync(join(dir, 'report.json'), 'utf8')) as AuditReport;
    expect(report.zone).toBe('fixture');
    expect(report.violations[0]!.rule).toBe('sprites.nearest');
  });
});

describe('rule details', () => {
  it('materials.threeMaps exempts billboard/impostor/decal/character and harvest ≥ 1', () => {
    const noMaps = { albedo: false, orm: false, normal: false };
    const exempt = ['billboard', 'impostor', 'decal', 'character'] as const;
    expect(failed(audit(one(dump({ materials: exempt.map((cls, i) => mat({ uuid: `m${i}`, cls, surface: null, maps: noMaps, ktx2: cls !== 'billboard' && cls !== 'character' ? true : false })) }))))).toEqual([]);
    expect(failed(audit(one(dump({ harvestLevel: 1, materials: [mat({ maps: noMaps })] }))))).toEqual([]);
    expect(failed(audit(one(dump({ materials: [mat({ cls: 'card', maps: { albedo: true, orm: true, normal: false } })] }))))).toEqual(['materials.threeMaps']);
  });

  it('textures.ktx2Only exempts billboard and character by class', () => {
    expect(failed(audit(one(dump({ materials: [mat({ cls: 'billboard', surface: null, ktx2: false }), mat({ uuid: 'm-1', cls: 'character', surface: null, ktx2: false })] }))))).toEqual([]);
    expect(failed(audit(one(dump({ materials: [mat({ cls: 'emissive', ktx2: false, maps: { albedo: true, orm: true, normal: true } })] }))))).toEqual(['textures.ktx2Only']);
  });

  it('materials.albedoCeiling fails a referenced surface when the manifest is missing or lacks the entry', () => {
    expect(failed(audit(one(dump({ materials: [mat()] })), null))).toEqual(['materials.albedoCeiling']);
    expect(failed(audit(one(dump({ materials: [mat({ surface: 'nowhere' })] }))))).toEqual(['materials.albedoCeiling']);
    expect(failed(audit(one(dump({ materials: [mat(), mat({ uuid: 'm-1', surface: 'moss' })] }))))).toEqual([]);
  });

  it('geometry.noPrimitives: boxes, cones, icosahedra and low spheres at harvest 0 only', () => {
    for (const type of ['BoxGeometry', 'ConeGeometry', 'IcosahedronGeometry']) {
      expect(failed(audit(one(dump({ geometries: [geo({ type })] }))))).toEqual(['geometry.noPrimitives']);
    }
    expect(failed(audit(one(dump({ geometries: [geo({ type: 'SphereGeometry', parameters: { widthSegments: 24 } })] }))))).toEqual([]);
    expect(failed(audit(one(dump({ harvestLevel: 2, geometries: [geo({ type: 'BoxGeometry' })] }))))).toEqual([]);
  });

  it('geometry.noOutlineShells allows BackSide on sky, catches the shared scaled BackSide clone, and is unevaluated without `side`', () => {
    expect(failed(audit(one(dump({ materials: [mat({ cls: 'sky', surface: null, side: 1, ktx2: false, maps: { albedo: false, orm: false, normal: false } })] }))))).toEqual([]);
    const shell = dump({
      materials: [mat({ uuid: 'body', side: 0 }), mat({ uuid: 'outline', side: 1, cls: 'sky', surface: null, maps: { albedo: false, orm: false, normal: false }, ktx2: false })],
      meshes: [{ geometry: 'g', material: 'body', scale: 1 }, { geometry: 'g', material: 'outline', scale: 1.05 }],
    });
    expect(failed(audit(one(shell)))).toEqual(['geometry.noOutlineShells']);
    const r = audit(one(dump({ materials: [mat()] })));
    expect(r.unevaluated['geometry.noOutlineShells']).toEqual(['shot']);
  });

  it('scatter.instanced needs an InstancedMesh; trees lod0–lod2 + impostor, other kinds lod0 + lod1 (P4-C1)', () => {
    const tiers = (kind: string, inst = true, ts: readonly number[] = [0, 1, 2, 3]): DumpGeometry[] => ts.map((t) => geo({ uuid: `${kind}-${t}`, kind, tier: t as 0 | 1 | 2 | 3, instancedMesh: inst }));
    expect(failed(audit(one(dump({ geometries: [...tiers('tree_oak'), ...tiers('bush')] }))))).toEqual([]);
    expect(failed(audit(one(dump({ geometries: tiers('rock_s', false) }))))).toEqual(['scatter.instanced']);
    expect(audit(one(dump({ geometries: [geo()] }))).unevaluated['scatter.instanced']).toEqual(['shot']);
    // the tier sets render actually builds (Part 4 H2): small kinds stop at their last drawn tier and pass
    const real = [...tiers('tree_oak'), ...tiers('rock_a'), ...tiers('bush', true, [0, 1, 2]), ...tiers('tall_grass', true, [0, 1]), ...tiers('grass_tuft', true, [0, 1])];
    expect(failed(audit(one(dump({ geometries: real }))))).toEqual([]);
    // a tree without its impostor, or a small kind without lod1, still fails
    expect(failed(audit(one(dump({ geometries: tiers('tree_oak', true, [0, 1, 2]) }))))).toEqual(['scatter.instanced']);
    expect(failed(audit(one(dump({ geometries: tiers('tall_grass', true, [0]) }))))).toEqual(['scatter.instanced']);
  });

  it('budget.counts.drawCalls caps beauty + post: counts.drawCalls − shadowDrawCalls (§10.5.8, amended 2026-09-30)', () => {
    // M2 lamps-night: 408 draw calls of which 248 shadow-map draws → beauty + post 160 passes
    expect(failed(audit(one(dump({ counts: { ...EMPTY.counts, drawCalls: 408 }, shadowDrawCalls: 248 }))))).toEqual([]);
    expect(failed(audit(one(dump({ counts: { ...EMPTY.counts, drawCalls: 700 }, shadowDrawCalls: 299 }))))).toEqual(['budget.counts.drawCalls']);
  });

  it('lights.count counts non-shadow lights too, and trusts the larger of lights[] and counts', () => {
    const lights = Array.from({ length: NON_SHADOW_LIGHTS_MAX + 1 }, (_, i) => ({ id: `l${i}`, type: 'PointLight' as const, castShadow: false, position: [i, 2, 0] as const, housingDistance: 0 }));
    expect(failed(audit(one(dump({ lights }))))).toEqual(['lights.count']);
    expect(failed(audit(one(dump({ counts: { ...EMPTY.counts, shadowLights: SHADOW_LIGHTS_MAX + 1 } }))))).toEqual(['lights.count']);
  });

  it('lights.housing checks both directions', () => {
    expect(failed(audit(one(dump({ lightSources: [{ id: 'lantern.3', lightDistance: null }] }))))).toEqual(['lights.housing']);
    expect(failed(audit(one(dump({ lights: [{ id: 'l', type: 'PointLight', castShadow: false, position: [0, 0, 0], housingDistance: null }] }))))).toEqual(['lights.housing']);
    expect(failed(audit(one(dump({ lightSources: [{ id: 'lantern.3', lightDistance: 0.2 }], lights: [{ id: 'l', type: 'PointLight', castShadow: false, position: [0, 0, 0], housingDistance: 0.6 }] }))))).toEqual([]);
  });

  it('harvest.same pairs by zone and shot key; identical class multisets pass', () => {
    const a = dump({ harvestLevel: 0, materials: [mat(), mat({ uuid: 'm-1', cls: 'card' })] });
    const b = dump({ harvestLevel: 2, materials: [mat({ uuid: 'x' }), mat({ uuid: 'y', cls: 'card' })] });
    expect(failed(audit([{ dump: a, source: 'a', shot: 'dusk_h0' }, { dump: b, source: 'b', shot: 'dusk_h2' }]))).toEqual([]);
    const r = audit([{ dump: a, source: 'a', shot: 'dusk-h0' }, { dump: b, source: 'b', shot: 'noon-h2' }]);
    expect(r.unevaluated['harvest.same']).toEqual(['noon-h2']);
  });

  it('reports the worst shot per rule over a directory of dumps', () => {
    const dir = tempDir();
    for (const [shot, dc] of [['s1', 120], ['s2', 310], ['s3', 205]] as const) {
      writeFileSync(join(dir, `${shot}.json`), JSON.stringify(dump({ counts: { ...EMPTY.counts, drawCalls: dc } })));
    }
    const r = audit(loadDumps(dir));
    expect(r.dumps).toBe(3);
    expect(r.worst['budget.counts.drawCalls']).toBe(310);
    expect(r.worstShot['budget.counts.drawCalls']).toBe('s2');
    expect(r.violations).toEqual([]);
  });
});

describe('§40.5.3 regression gate', () => {
  const at = (drawCalls: number, triangles = 1000): LoadedDump[] => one(dump({ counts: { ...EMPTY.counts, drawCalls, triangles } }));

  it('fails growth above 5 % over the baseline worst even under the cap, passes at ≤ 5 %', () => {
    const baseline = { worst: { 'budget.counts.drawCalls': 200, 'budget.counts.triangles': 1000, 'budget.counts.texturesSize': 0, 'materials.count': 0 } };
    const over = runAudit(at(211), { materialsManifest: MANIFEST, baseline });
    expect(failed(over)).toEqual(['regression.drawCalls']);
    expect(over.violations[0]!.message).toMatch(/^regression\.drawCalls \+5\.5 %/);
    expect(failed(runAudit(at(210), { materialsManifest: MANIFEST, baseline }))).toEqual([]);
    expect(failed(runAudit(at(150, 1051), { materialsManifest: MANIFEST, baseline }))).toEqual(['regression.triangles']);
  });

  it('--write-baseline writes the worst record the next run gates against', () => {
    const dir = tempDir();
    writeFileSync(join(dir, 'shot.json'), JSON.stringify(at(300)[0]!.dump));
    const base = join(dir, 'baseline.json');
    const log = (): void => undefined;
    expect(main(['--dump', join(dir, 'shot.json'), '--baseline', base, '--write-baseline', '--report', join(dir, 'r.json')], log)).toBe(0);
    expect(JSON.parse(readFileSync(base, 'utf8')).worst['budget.counts.drawCalls']).toBe(300);
    writeFileSync(join(dir, 'shot.json'), JSON.stringify(at(330)[0]!.dump));
    expect(main(['--dump', join(dir, 'shot.json'), '--baseline', base, '--report', join(dir, 'r.json')], log)).toBe(1);
  });
});

describe('§40.6 --bytes roll-up', () => {
  const MiB = 1024 * 1024;

  function fakePublic(o: Partial<Record<'creatures' | 'creaturesAnim' | 'models' | 'materials', number>> & { audio?: number | null; misc?: number; stray?: number; licences?: boolean } = {}): string {
    const root = tempDir();
    const man = (dir: string, file: string, body: unknown): void => { mkdirSync(join(root, dir), { recursive: true }); writeFileSync(join(root, dir, file), JSON.stringify(body)); };
    man('creatures', 'creatures.manifest.json', { totalBytes: o.creatures ?? 30 * MiB, ...(o.creaturesAnim !== undefined ? { animTotalBytes: o.creaturesAnim } : {}) });
    man('models', 'models.manifest.json', { totalBytes: o.models ?? 8 * MiB });
    man('materials', 'materials.manifest.json', { totalBytes: o.materials ?? 60 * MiB });
    if (o.audio !== null) {
      const b = o.audio ?? 40 * MiB;
      man('audio', 'manifest.json', { version: 1, themes: { t: { stems: { base: { bytes: b / 2 }, threat: { bytes: b / 4 } } } }, sfx: { hit: { clips: [{ bytes: b / 8 }] } }, ambience: { grove: { bytes: b / 8 } } });
    }
    mkdirSync(join(root, 'basis'), { recursive: true });
    writeFileSync(join(root, 'basis', 'basis_transcoder.wasm'), new Uint8Array(o.misc ?? 1024));
    if (o.stray) writeFileSync(join(root, 'stray.bin'), new Uint8Array(o.stray));
    if (o.licences !== false) {
      mkdirSync(join(root, 'icons'), { recursive: true });
      writeFileSync(join(root, 'models', 'CREDITS.txt'), 'CC0');
      writeFileSync(join(root, 'icons', 'TABLER-LICENSE.txt'), 'MIT');
    }
    return root;
  }
  const failing = (dir: string): string[] => runBytes(dir).lines.filter((l) => !l.ok).map((l) => l.line);

  it('passes a tree under every ceiling', () => {
    const r = runBytes(fakePublic());
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('fails each §40.6 ceiling on its own', () => {
    expect(failing(fakePublic({ creatures: CEILINGS.creatures + 1 }))).toEqual(['creatures/']);
    expect(failing(fakePublic({ creaturesAnim: CEILINGS.creaturesAnim + 1 }))).toEqual(['creatures/anim/']);
    expect(failing(fakePublic({ models: CEILINGS.models + 1 }))).toEqual(['models/']);
    expect(failing(fakePublic({ materials: CEILINGS.materials + 1 }))).toEqual(['materials/']);
    expect(failing(fakePublic({ audio: CEILINGS.audio + 8 }))).toEqual(['audio/']);
    expect(failing(fakePublic({ misc: CEILINGS.misc + 1 }))).toEqual(['basis/ + icons/ + fonts/ + keyart/']);
    const full = fakePublic({ creatures: CEILINGS.creatures, creaturesAnim: CEILINGS.creaturesAnim, models: CEILINGS.models, materials: CEILINGS.materials, audio: CEILINGS.audio, misc: 1024, stray: CEILINGS.misc });
    expect(failing(full)).toEqual(['total public/']);
    expect(CEILINGS).toEqual({ creatures: 52 * MiB, creaturesAnim: 24 * MiB, models: 12 * MiB, materials: 90 * MiB, audio: 80 * MiB, misc: 2 * MiB, total: 243 * MiB });
  });

  it('creatures/anim/ is its own 24 MiB line: anim files + the manifest bytes its anim fields add, charged away from creatures/', () => {
    const dir = fakePublic();
    const staticM = { totalBytes: 1000, sprites: { a: { thumb: 't' }, b: { thumb: 'u' } } };
    const withAnim = { totalBytes: 1000, sprites: { a: { thumb: 't', anim: { front: { atlas: 'anim-a-front', delays: [125, 125] } } }, b: { thumb: 'u' } }, animAtlases: [{ id: 'anim-a-front' }], animTotalBytes: 0 };
    const ser = (o: unknown): string => `${JSON.stringify(o, null, 2)}\n`;
    // the manifest counts its own anim share: iterate to the fixed point, as the pipeline does
    let share = 0;
    for (let i = 0; i < 4; i++) share = Buffer.byteLength(ser({ ...withAnim, animTotalBytes: 5000 + share })) - Buffer.byteLength(ser(staticM));
    mkdirSync(join(dir, 'creatures', 'anim'), { recursive: true });
    writeFileSync(join(dir, 'creatures', 'anim', 'a-front.albedo.webp'), new Uint8Array(5000));
    const write = (animTotalBytes: number): void => writeFileSync(join(dir, 'creatures', 'creatures.manifest.json'), ser({ ...withAnim, animTotalBytes }));
    write(5000 + share);
    const l = (r: ReturnType<typeof runBytes>, name: string) => r.lines.find((x) => x.line === name)!;
    let r = runBytes(dir);
    expect(r.ok, r.errors.join(';')).toBe(true);
    expect(creaturesAnimShare(dir).share).toBe(share);
    expect(l(r, 'creatures/anim/').diskBytes).toBe(5000 + share);
    expect(l(r, 'creatures/anim/').manifestBytes).toBe(5000 + share);
    expect(l(r, 'creatures/').diskBytes).toBe(Buffer.byteLength(ser(staticM)));
    // over the anim ceiling → only that line fails; the static line is unaffected
    write(CEILINGS.creaturesAnim + 1);
    r = runBytes(dir);
    expect(r.lines.filter((x) => !x.ok).map((x) => x.line)).toEqual(['creatures/anim/']);
    // anim files with no animTotalBytes in the manifest are an error
    writeFileSync(join(dir, 'creatures', 'creatures.manifest.json'), JSON.stringify(staticM));
    expect(runBytes(dir).errors.join(' | ')).toMatch(/anim files without animTotalBytes/);
  });

  it('holds the larger of manifest total and disk bytes to the ceiling', () => {
    const dir = fakePublic({ models: 1024 });
    writeFileSync(join(dir, 'models', 'big.glb'), new Uint8Array(CEILINGS.models + 1));
    expect(failing(dir)).toEqual(['models/']);
  });

  it('fails when a licence is missing or an owned manifest is absent; a missing audio manifest is a warning', () => {
    const noLic = runBytes(fakePublic({ licences: false }));
    expect(noLic.ok).toBe(false);
    expect(noLic.missingLicences).toEqual([...LICENCES]);
    const noAudio = runBytes(fakePublic({ audio: null }));
    expect(noAudio.ok).toBe(true);
    expect(noAudio.warnings.join('\n')).toMatch(/audio/);
    const dir = fakePublic();
    rmSync(join(dir, 'models', 'models.manifest.json'));
    expect(runBytes(dir).ok).toBe(false);
  });

  it('the real packages/client/public tree is within every §40.6 ceiling', () => {
    const r = runBytes(resolve(__dirname, '..', '..', '..', 'packages', 'client', 'public'));
    const detail = r.lines.map((l) => `${l.line} ${l.bytes}/${l.ceiling}`).concat(r.errors).join('\n');
    expect(r.ok, detail).toBe(true);
  });
});
