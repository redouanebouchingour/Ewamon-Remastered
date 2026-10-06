/**
 * Scatter instancing through geometry attributes (IMPLEMENTATION-NOTES "Handover II", (a)).
 *
 * three 0.186 keys the node build of every `InstancedMesh` by the object's uuid (`RenderObject.getMaterialCacheKey`
 * adds `object.uuid` for `isInstancedMesh || count > 1`): its instance buffers are node attributes bound to that one
 * object, so a build cannot be shared. Each scatter mesh of a zone was therefore its own node build (49 builds, 4.3 s
 * of a crossing on the dev iGPU).
 *
 * A `ScatterMesh` is a plain `Mesh` (no `isInstancedMesh`, `count` stays 1) over an `InstancedBufferGeometry` whose
 * per-instance data are ordinary geometry attributes — the 4 matrix rows `ewaInstM0..3` (one `InstancedInterleavedBuffer`,
 * 16 floats per instance, shared by the class meshes of a tier) and, on tinted parts, `ewaInstColor` — read BY NAME:
 * `RenderObject.getAttributes` resolves a named attribute against each object's own geometry. The cache key then
 * depends only on the material and the geometry's attribute layout, so every scatter mesh of a material with the same
 * layout shares one node build (and, with the zone build keep in renderer.ts, across zones).
 *
 * The vertex transform is three's own instancing (`nodes/accessors/Instance.js`) moved in front of
 * `NodeMaterial.setupPosition`, which runs for the beauty pass and for the shadow pass's override material alike:
 * `positionLocal = M · positionLocal`, `normalLocal = transformNormal(normalLocal, M)`, `vInstanceColor` from the colour
 * attribute (`setupDiffuseColor` multiplies it in when `object.instanceColor` is set), and for the velocity MRT
 * `positionPrevious = M · positionPrevious` with the same matrix (three's previous-matrix copy only differed on the frame
 * a tier buffer was rewritten, where it paired instances of the old layout with the new). `positionNode` (wind) still
 * runs after it, on the instanced position, as before. Everything else about the geometry (morph, skinning,
 * displacement) does not exist on scatter.
 */
import { InstancedBufferAttribute, InstancedBufferGeometry, InstancedInterleavedBuffer, InterleavedBufferAttribute, Mesh, NodeMaterial, StaticDrawUsage } from 'three/webgpu';
import type { BufferGeometry, Material, Node, NodeBuilder, Sphere } from 'three/webgpu';
import { Fn, attribute, instanceColor, mat4, normalLocal, positionLocal, positionPrevious, transformNormal } from 'three/tsl';

/** The matrix rows (vec4 each) and the tint (vec3), as geometry attribute names. */
export const SCATTER_MATRIX_ROWS = Object.freeze(['ewaInstM0', 'ewaInstM1', 'ewaInstM2', 'ewaInstM3'] as const);
export const SCATTER_COLOR_ATTRIBUTE = 'ewaInstColor';

/** One tier's instance matrices: 16 floats per instance, shared by the tier's class meshes. */
export class ScatterMatrices {
  readonly buffer: InstancedInterleavedBuffer;
  readonly rows: readonly InterleavedBufferAttribute[];
  constructor(capacity: number) {
    this.buffer = new InstancedInterleavedBuffer(new Float32Array(capacity * 16), 16, 1);
    this.buffer.setUsage(StaticDrawUsage);
    this.rows = [0, 4, 8, 12].map((o) => new InterleavedBufferAttribute(this.buffer, 4, o));
  }
}

/** One tier's tints (white until written), shared by its tinted class meshes. */
export function scatterColors(capacity: number): InstancedBufferAttribute {
  const a = new InstancedBufferAttribute(new Float32Array(capacity * 3).fill(1), 3);
  a.setUsage(StaticDrawUsage);
  return a;
}

/**
 * A scatter draw: `part`'s vertices (attributes, index, groups shared, never copied) drawn `instances` times with the
 * tier's matrices (and tints). Shaped like the `InstancedMesh` it replaces for the scatter code: `instanceMatrix` (the
 * interleaved buffer: `array`, `updateRanges`, `needsUpdate`), `instanceColor`, `boundingSphere` (frustum culling and
 * sorting read it as they do an `InstancedMesh`'s), `dispose()`.
 */
export class ScatterMesh extends Mesh<InstancedBufferGeometry, Material | Material[]> {
  readonly isScatterMesh = true;
  readonly instanceMatrix: InstancedInterleavedBuffer;
  /** Read by `NodeMaterial.setupDiffuseColor` (`object.instanceColor` → × `vInstanceColor`); null = untinted. */
  readonly instanceColor: InstancedBufferAttribute | null;
  boundingSphere: Sphere | null;

  constructor(part: BufferGeometry, material: Material | Material[], matrices: ScatterMatrices, colors: InstancedBufferAttribute | null, sphere: Sphere) {
    installScatterInstancing();
    const g = new InstancedBufferGeometry();
    g.name = part.name;
    g.setIndex(part.index);
    for (const name of Object.keys(part.attributes)) g.setAttribute(name, part.attributes[name]!);
    for (const gr of part.groups) g.addGroup(gr.start, gr.count, gr.materialIndex);
    g.setDrawRange(part.drawRange.start, part.drawRange.count);
    SCATTER_MATRIX_ROWS.forEach((n, i) => g.setAttribute(n, matrices.rows[i]!));
    if (colors !== null) g.setAttribute(SCATTER_COLOR_ATTRIBUTE, colors);
    g.instanceCount = 0;
    super(g, material);
    this.instanceMatrix = matrices.buffer;
    this.instanceColor = colors;
    this.boundingSphere = sphere;
  }

  /** Instances drawn (the geometry's `instanceCount`; 0 draws nothing). */
  get instances(): number { return this.geometry.instanceCount; }
  set instances(n: number) { this.geometry.instanceCount = n; }

  /** Releases the render objects (the `dispose` event, as `InstancedMesh.dispose`) and the wrapper geometry. */
  override dispose(): void {
    this.dispatchEvent({ type: 'dispose' } as never);
    this.geometry.dispose();
  }
}

/** Whether `o` is a `ScatterMesh` (duck-typed: stats / compile-plan code holds plain `Object3D`s). */
export function isScatterMesh(o: unknown): o is ScatterMesh {
  return (o as { isScatterMesh?: boolean } | null)?.isScatterMesh === true;
}

type SetupPosition = (this: NodeMaterial, builder: NodeBuilder) => Node;
let installed = false;

/**
 * Prepends the scatter instance transform to `NodeMaterial.prototype.setupPosition` for geometries that carry
 * `ewaInstM0` (nothing else changes: other geometries never have that attribute, so no other program or key moves).
 * Idempotent.
 */
export function installScatterInstancing(): void {
  if (installed) return;
  installed = true;
  const proto = NodeMaterial.prototype as unknown as { setupPosition: SetupPosition };
  const base = proto.setupPosition;
  proto.setupPosition = function setupPosition(this: NodeMaterial, builder: NodeBuilder): Node {
    const geo = (builder as unknown as { geometry?: BufferGeometry | null }).geometry;
    if (geo != null && geo.getAttribute(SCATTER_MATRIX_ROWS[0]) !== undefined) scatterInstance();
    return base.call(this, builder);
  };
}

const scatterInstance = Fn((_inputs: unknown, builder: NodeBuilder) => {
  const b = builder as unknown as { needsPreviousData(): boolean; hasGeometryAttribute(n: string): boolean };
  const row = (n: string): Node<'vec4'> => attribute(n, 'vec4') as unknown as Node<'vec4'>;
  const m = mat4(row(SCATTER_MATRIX_ROWS[0]), row(SCATTER_MATRIX_ROWS[1]), row(SCATTER_MATRIX_ROWS[2]), row(SCATTER_MATRIX_ROWS[3]));
  (positionLocal as unknown as { assign(n: Node): void }).assign(m.mul(positionLocal).xyz);
  if (b.needsPreviousData()) (positionPrevious as unknown as { assign(n: Node): void }).assign(m.mul(positionPrevious).xyz);
  if (b.hasGeometryAttribute('normal')) (normalLocal as unknown as { assign(n: Node): void }).assign(transformNormal(normalLocal, m));
  if (b.hasGeometryAttribute(SCATTER_COLOR_ATTRIBUTE)) (instanceColor as unknown as { assign(n: Node): void }).assign(attribute(SCATTER_COLOR_ATTRIBUTE, 'vec3'));
}, 'void') as unknown as () => void;
