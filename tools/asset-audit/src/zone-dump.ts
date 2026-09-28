/**
 * `ZoneDump` — the JSON the asset audit reads (SPEC §40.5.1, §10.10.1).
 *
 * SOURCE OF TRUTH: `packages/render/src/stats.ts` (`export interface ZoneDump`, written by `dumpZone()`), with
 * `BudgetCounts` from `packages/render/src/descriptors.ts`, `HarvestLevel` from the same file and `MaterialClass`
 * from `packages/render/src/surfaces/types.ts`. SPEC §40.0.2 rule 5 forbids a tool importing `@ewa/render`, so the
 * shape is mirrored here field for field; `test/zone-dump.test.ts` builds a dump with render's real `dumpZone()`
 * and asserts it parses, so the two cannot drift silently.
 *
 * Differences from render's declaration, each forced by JSON or by the SPEC:
 *  - `lights[].housingDistance` is `number | null`: render computes `+Infinity` when a zone has no housing mesh,
 *    and `JSON.stringify(Infinity)` is `null`. The audit reads `null` as "no housing" (a `lights.housing` failure).
 *  - `cls` additionally admits `'sky'` and `'debug'`, the two classes §40.5.2 names (`BackSide` only on `sky`;
 *    `materials.count` excludes `debug`) that render does not emit today.
 *  - The OPTIONAL fields below are the ones §40.5.2 says "the dump gains" (`geometries[].sharedBy`,
 *    `materials[].side`, the scatter `kind` + LOD tier + `instancedMesh`, the `lightSource`-tagged emissives of
 *    §50.4.6). Render writes all of them since 2026-09-25 (render IMPLEMENTATION-NOTES Part 4, H2) except `meshes[]`
 *    and `shot`; they stay optional so older dumps still parse, and a rule whose input is absent reports itself as
 *    unevaluated (never as a silent pass). `lightSources[].lightDistance` is `null` for render's `+Infinity` (no light).
 */

export type HarvestLevel = 0 | 1 | 2;

/** `packages/render/src/surfaces/types.ts` `MaterialClass`. */
export type MaterialClass = 'standard' | 'physical' | 'card' | 'water' | 'emissive';

/** `packages/render/src/stats.ts` `DumpMaterialClass`, plus the two SPEC-named classes render does not emit yet. */
export type DumpMaterialClass = MaterialClass | 'billboard' | 'impostor' | 'decal' | 'character' | 'water' | 'sky' | 'debug';

/** `packages/render/src/descriptors.ts` `BudgetCounts` (SPEC §50.2.3, verbatim). */
export interface BudgetCounts {
  readonly drawCalls: number;
  readonly triangles: number;
  readonly texturesSize: number;
  readonly textures: number;
  readonly geometries: number;
  readonly programs: number;
  readonly renderTargets: number;
  readonly attributes: number;
  readonly attributesSize: number;
  readonly materials: number;
  readonly shadowLights: number;
  readonly nonShadowLights: number;
}

/** three.js `Side`: FrontSide 0, BackSide 1, DoubleSide 2. */
export const BACK_SIDE = 1;
/** three.js `NearestFilter`. */
export const NEAREST_FILTER = 1003;

export interface DumpMaterial {
  readonly uuid: string;
  readonly cls: DumpMaterialClass;
  readonly surface: string | null;
  readonly maps: { readonly albedo: boolean; readonly orm: boolean; readonly normal: boolean };
  readonly ktx2: boolean;
  /** §40.5.2 `geometry.noOutlineShells`: "the dump gains `materials[].side`". Optional until render writes it. */
  readonly side?: 0 | 1 | 2;
}

/** Scatter LOD tier: 0/1/2 = LOD0–2, 3 = impostor (§10.5.7). */
export type ScatterTier = 0 | 1 | 2 | 3;

export interface DumpGeometry {
  readonly uuid: string;
  readonly type: string;
  readonly parameters: Readonly<Record<string, number>> | null;
  readonly triangles: number;
  readonly instanced: number;
  /** §40.5.2: "the dump gains `geometries[].sharedBy: number`" (meshes referencing this geometry). Optional. */
  readonly sharedBy?: number;
  /** §40.5.2 `scatter.instanced`: the scatter kind this geometry draws (`tree_oak`, `tall_grass`, …). Optional. */
  readonly kind?: string | null;
  /** The LOD tier of a scatter geometry (3 = impostor). Optional. */
  readonly tier?: ScatterTier;
  /** True when the geometry is drawn by an `InstancedMesh` (render's `instanced` is 1 for a plain mesh too). Optional. */
  readonly instancedMesh?: boolean;
}

export interface DumpLight {
  readonly id: string;
  readonly type: 'PointLight' | 'SpotLight';
  readonly castShadow: boolean;
  readonly position: readonly [number, number, number];
  /** Render's `number`; `null` when render computed `+Infinity` (no housing mesh at all). */
  readonly housingDistance: number | null;
}

export interface DumpSprite {
  readonly atlas: string;
  readonly magFilter: number;
  readonly anisotropy: number;
}

/** §50.4.6 `lights.housing` second direction: a `lightSource`-tagged emissive and the distance to its nearest light. */
export interface DumpLightSource {
  readonly id: string;
  readonly lightDistance: number | null;
}

/** §40.5.2 `geometry.noOutlineShells` precise form: one row per mesh. Optional. */
export interface DumpMesh {
  readonly geometry: string;
  readonly material: string;
  /** Largest world-scale component of the mesh. */
  readonly scale: number;
}

export interface ZoneDump {
  readonly zone: string;
  readonly harvestLevel: HarvestLevel;
  readonly materials: readonly DumpMaterial[];
  readonly geometries: readonly DumpGeometry[];
  readonly lights: readonly DumpLight[];
  readonly sprites: readonly DumpSprite[];
  readonly counts: BudgetCounts;
  readonly shadowDrawCalls: number;
  readonly culledChunks: number;
  readonly lightIds: readonly string[];
  /** `CameraShot.id` of the shot this dump was taken at (render does not write it; the file name stands in). Optional. */
  readonly shot?: string;
  readonly lightSources?: readonly DumpLightSource[];
  readonly meshes?: readonly DumpMesh[];
}

// ---- runtime validation -------------------------------------------------------------------------------------

export class DumpParseError extends Error {
  constructor(readonly path: string, detail: string) {
    super(`ZoneDump${path}: ${detail}`);
    this.name = 'DumpParseError';
  }
}

const COUNT_KEYS: readonly (keyof BudgetCounts)[] = [
  'drawCalls', 'triangles', 'texturesSize', 'textures', 'geometries', 'programs', 'renderTargets',
  'attributes', 'attributesSize', 'materials', 'shadowLights', 'nonShadowLights',
];

const CLASSES: ReadonlySet<string> = new Set<DumpMaterialClass>([
  'standard', 'physical', 'card', 'water', 'emissive', 'billboard', 'impostor', 'decal', 'character', 'sky', 'debug',
]);

type Json = unknown;
const isObj = (v: Json): v is Record<string, Json> => typeof v === 'object' && v !== null && !Array.isArray(v);

function obj(v: Json, path: string): Record<string, Json> {
  if (!isObj(v)) throw new DumpParseError(path, `expected an object, got ${v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v}`);
  return v;
}
function arr(v: Json, path: string): readonly Json[] {
  if (!Array.isArray(v)) throw new DumpParseError(path, `expected an array, got ${v === null ? 'null' : typeof v}`);
  return v;
}
function str(v: Json, path: string): string {
  if (typeof v !== 'string') throw new DumpParseError(path, `expected a string, got ${JSON.stringify(v)}`);
  return v;
}
function num(v: Json, path: string): number {
  if (typeof v !== 'number' || Number.isNaN(v)) throw new DumpParseError(path, `expected a number, got ${JSON.stringify(v)}`);
  return v;
}
function bool(v: Json, path: string): boolean {
  if (typeof v !== 'boolean') throw new DumpParseError(path, `expected a boolean, got ${JSON.stringify(v)}`);
  return v;
}
function numOrNull(v: Json, path: string): number | null {
  return v === null ? null : num(v, path);
}
function optional<T>(o: Record<string, Json>, key: string, path: string, read: (v: Json, p: string) => T): T | undefined {
  return o[key] === undefined ? undefined : read(o[key], `${path}.${key}`);
}

function parseMaterial(v: Json, p: string): DumpMaterial {
  const o = obj(v, p);
  const cls = str(o.cls, `${p}.cls`);
  if (!CLASSES.has(cls)) throw new DumpParseError(`${p}.cls`, `unknown material class ${JSON.stringify(cls)}`);
  const maps = obj(o.maps, `${p}.maps`);
  const side = optional(o, 'side', p, (x, q) => {
    const n = num(x, q);
    if (n !== 0 && n !== 1 && n !== 2) throw new DumpParseError(q, `expected 0 | 1 | 2, got ${n}`);
    return n;
  });
  return {
    uuid: str(o.uuid, `${p}.uuid`),
    cls: cls as DumpMaterialClass,
    surface: o.surface === null ? null : str(o.surface, `${p}.surface`),
    maps: { albedo: bool(maps.albedo, `${p}.maps.albedo`), orm: bool(maps.orm, `${p}.maps.orm`), normal: bool(maps.normal, `${p}.maps.normal`) },
    ktx2: bool(o.ktx2, `${p}.ktx2`),
    ...(side === undefined ? {} : { side }),
  };
}

function parseGeometry(v: Json, p: string): DumpGeometry {
  const o = obj(v, p);
  let parameters: Record<string, number> | null = null;
  if (o.parameters !== null) {
    const po = obj(o.parameters, `${p}.parameters`);
    parameters = {};
    for (const k of Object.keys(po)) parameters[k] = num(po[k], `${p}.parameters.${k}`);
  }
  const tier = optional(o, 'tier', p, (x, q) => {
    const n = num(x, q);
    if (n !== 0 && n !== 1 && n !== 2 && n !== 3) throw new DumpParseError(q, `expected 0 | 1 | 2 | 3, got ${n}`);
    return n;
  });
  const sharedBy = optional(o, 'sharedBy', p, num);
  const kind = optional(o, 'kind', p, (x, q) => (x === null ? null : str(x, q)));
  const instancedMesh = optional(o, 'instancedMesh', p, bool);
  return {
    uuid: str(o.uuid, `${p}.uuid`),
    type: str(o.type, `${p}.type`),
    parameters,
    triangles: num(o.triangles, `${p}.triangles`),
    instanced: num(o.instanced, `${p}.instanced`),
    ...(sharedBy === undefined ? {} : { sharedBy }),
    ...(kind === undefined ? {} : { kind }),
    ...(tier === undefined ? {} : { tier }),
    ...(instancedMesh === undefined ? {} : { instancedMesh }),
  };
}

function parseLight(v: Json, p: string): DumpLight {
  const o = obj(v, p);
  const type = str(o.type, `${p}.type`);
  if (type !== 'PointLight' && type !== 'SpotLight') throw new DumpParseError(`${p}.type`, `expected PointLight | SpotLight, got ${JSON.stringify(type)}`);
  const pos = arr(o.position, `${p}.position`);
  if (pos.length !== 3) throw new DumpParseError(`${p}.position`, `expected 3 numbers, got ${pos.length}`);
  return {
    id: str(o.id, `${p}.id`),
    type,
    castShadow: bool(o.castShadow, `${p}.castShadow`),
    position: [num(pos[0], `${p}.position[0]`), num(pos[1], `${p}.position[1]`), num(pos[2], `${p}.position[2]`)],
    housingDistance: numOrNull(o.housingDistance, `${p}.housingDistance`),
  };
}

function parseSprite(v: Json, p: string): DumpSprite {
  const o = obj(v, p);
  return { atlas: str(o.atlas, `${p}.atlas`), magFilter: num(o.magFilter, `${p}.magFilter`), anisotropy: num(o.anisotropy, `${p}.anisotropy`) };
}

function parseCounts(v: Json, p: string): BudgetCounts {
  const o = obj(v, p);
  const out = {} as Record<keyof BudgetCounts, number>;
  for (const k of COUNT_KEYS) out[k] = num(o[k], `${p}.${k}`);
  return out;
}

/** Validates `json` against the mirrored `ZoneDump` and returns a typed copy. Extra fields are ignored. */
export function parseZoneDump(json: Json): ZoneDump {
  const o = obj(json, '');
  const h = num(o.harvestLevel, '.harvestLevel');
  if (h !== 0 && h !== 1 && h !== 2) throw new DumpParseError('.harvestLevel', `expected 0 | 1 | 2, got ${h}`);
  const shot = optional(o, 'shot', '', str);
  const lightSources = optional(o, 'lightSources', '', (x, q) => arr(x, q).map((e, i) => {
    const r = obj(e, `${q}[${i}]`);
    return { id: str(r.id, `${q}[${i}].id`), lightDistance: numOrNull(r.lightDistance, `${q}[${i}].lightDistance`) };
  }));
  const meshes = optional(o, 'meshes', '', (x, q) => arr(x, q).map((e, i) => {
    const r = obj(e, `${q}[${i}]`);
    return { geometry: str(r.geometry, `${q}[${i}].geometry`), material: str(r.material, `${q}[${i}].material`), scale: num(r.scale, `${q}[${i}].scale`) };
  }));
  return {
    zone: str(o.zone, '.zone'),
    harvestLevel: h,
    materials: arr(o.materials, '.materials').map((m, i) => parseMaterial(m, `.materials[${i}]`)),
    geometries: arr(o.geometries, '.geometries').map((g, i) => parseGeometry(g, `.geometries[${i}]`)),
    lights: arr(o.lights, '.lights').map((l, i) => parseLight(l, `.lights[${i}]`)),
    sprites: arr(o.sprites, '.sprites').map((s, i) => parseSprite(s, `.sprites[${i}]`)),
    counts: parseCounts(o.counts, '.counts'),
    shadowDrawCalls: num(o.shadowDrawCalls, '.shadowDrawCalls'),
    culledChunks: num(o.culledChunks, '.culledChunks'),
    lightIds: arr(o.lightIds, '.lightIds').map((s, i) => str(s, `.lightIds[${i}]`)),
    ...(shot === undefined ? {} : { shot }),
    ...(lightSources === undefined ? {} : { lightSources }),
    ...(meshes === undefined ? {} : { meshes }),
  };
}
