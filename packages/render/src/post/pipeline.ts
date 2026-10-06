/**
 * SPEC §10.8 — the post stack as ONE `RenderPipeline` graph:
 *
 *   scenePass (MRT output · normal · velocity · mask) → GTAO (half res, 16 spp, × (1 − mask.x))
 *   → TRAA (SMAA on webgl2 / taa off) → bloom (1.15 / 0.35 / 0.6) → tilt-shift DOF through mask.y
 *   → chromatic aberration → ACES → grade → vignette → grain → renderOutput(→ sRGB)
 *
 * `planPostGraph` is the pure decision (which stages exist, with which numbers) — node-tested;
 * `buildPostOutput` realises a plan as TSL; `PostStack` owns the pipeline, the persistent scene pass and
 * the uniforms, and rebuilds the chain on `setEffects` / `BudgetProbe.setPassEnabled` so a disabled pass
 * has no node, no render target and no cost (§10.0.3 rule 7).
 *
 * Corrections vs the SPEC's verbatim block (IMPLEMENTATION-NOTES.md):
 * - `cameraProjectionMatrixInverse` / `cameraWorldMatrix` inside a post graph resolve to the fullscreen
 *   quad's camera, not the scene camera, so the DOF plane reconstruction uses `uniform(camera.
 *   projectionMatrixInverse)` / `uniform(camera.matrixWorld)` (the pattern GTAONode itself uses).
 * - `RenderPipeline.dispose()` only disposes its quad material; display nodes (GTAO/TRAA/Bloom/DOF/SMAA)
 *   and the `RTTNode`s that `traa()`/`dof()`/`chromaticAberration()` create through `convertToTexture`
 *   own render targets nobody else frees. `PostStack` walks the retired graph and disposes them.
 * - One pipeline per renderer (§10.0.3 rule 1): rebuilds assign `pipeline.outputNode` (+ `needsUpdate`)
 *   instead of constructing a new `RenderPipeline`; the scene pass (and its 4-target MRT) is kept.
 * - GTAO `useTemporalFiltering` is on only when TRAA is in the graph (GTAONode: "requires TRAANode").
 * - `bokehScale` is `6 px × pixelRatio` (§10.7.3 "scaled by pr"), a uniform written on `setPixelRatio`.
 * - `chromaticAberration(node, strength, null, …)`: the documented null → screen-centre default is not
 *   implemented in 0.186 (the null reaches the layout Fn and the build throws); the centre is explicit.
 */
import { NoToneMapping, RenderPipeline, SRGBColorSpace, Vector3 } from 'three/webgpu';
import type { Camera, Node, PassNode, PerspectiveCamera, RenderTarget, Scene, TextureNode, UniformNode, WebGPURenderer } from 'three/webgpu';
import {
  acesFilmicToneMapping, dot, float, getViewPosition, mix, mrt, normalView, oneMinus, output, pass, renderOutput, screenUV, uniform, vec2,
  vec4, velocity,
} from 'three/tsl';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { traa } from 'three/addons/tsl/display/TRAANode.js';
import { smaa } from 'three/addons/tsl/display/SMAANode.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { dof } from 'three/addons/tsl/display/DepthOfFieldNode.js';
import { chromaticAberration } from 'three/addons/tsl/display/ChromaticAberrationNode.js';
import type { Backend, BudgetPass, EffectsFlags } from '../descriptors.js';
import { GROVE_GRADE, gradeNode, VIGNETTE, vignetteNode, type GradePalette } from './grade.js';
import { grain } from './grain.js';

// ---- numbers that are assertions (§10.8.3) -------------------------------------------------------------

export const POST_PARAMS = Object.freeze({
  gtao: Object.freeze({ resolutionScale: 0.5, samples: 16, radius: 0.9, thickness: 0.6, scale: 1.0 }),
  bloom: Object.freeze({ strength: 0.35, radius: 0.6, threshold: 1.15, smoothWidth: 0.05, resolutionScale: 0.5 }),
  dof: Object.freeze({ tiltDeg: 24, focalLength: 6.0, bokehPx: 6, focusDistance: 0 }),
  chroma: Object.freeze({ scale: 1.1, rest: 0, superStrength: 0.012, superMs: 120 }),
  vignette: VIGNETTE.strength,
  /** §10.8.2 as amended 2026-10-06: the zero-mean `GrainNode` (`grain.ts`), σ ≈ 1.5 % of the value at mid-grey (was `film` 0.035). */
  grain: 0.052,
  exposure: 1.0,
});

// ---- the plan (pure) ---------------------------------------------------------------------------------

export type PostStageId = 'scene' | 'gtao' | 'traa' | 'smaa' | 'bloom' | 'dof' | 'chroma' | 'aces' | 'grade' | 'vignette' | 'grain' | 'output';

export interface PostStage {
  readonly id: PostStageId;
  readonly params: Readonly<Record<string, number | string | boolean>>;
}

/** Post-graph passes a `BudgetProbe` can toggle (the other three are realised outside the graph, §10.10.1). */
export const GRAPH_PASSES: readonly BudgetPass[] = ['gtao', 'traa', 'bloom', 'dof', 'grade'];

export type PassSwitches = Readonly<Record<BudgetPass, boolean>>;

export const ALL_PASSES_ON: PassSwitches = Object.freeze({
  opaque: true, sprites: true, shadows: true, gtao: true, traa: true, bloom: true, dof: true, grade: true,
});

/**
 * §10.8.1 order with §10.8.2's gating: a stage absent from the returned list is absent from the graph.
 * - GTAO iff `passes.gtao`; anti-aliasing: none iff `!passes.traa`, TRAA iff `f.taa && webgpu`, else SMAA;
 * - bloom iff `passes.bloom && f.bloom`; DOF iff `passes.dof && f.dof`; chroma iff `f.chroma`;
 * - ACES / grade / vignette iff `passes.grade`; grain iff `passes.grade && f.grain`.
 */
export function planPostGraph(f: EffectsFlags, backend: Backend, passes: PassSwitches = ALL_PASSES_ON): PostStage[] {
  const out: PostStage[] = [{ id: 'scene', params: { targets: 4, type: 'HalfFloat', depth: true } }];
  const p = POST_PARAMS;
  const useTraa = passes.traa && f.taa && backend === 'webgpu';
  if (passes.gtao) out.push({ id: 'gtao', params: { ...p.gtao, temporal: useTraa, maskChannel: 'x' } });
  if (passes.traa) out.push(useTraa ? { id: 'traa', params: { msaa: false } } : { id: 'smaa', params: {} });
  if (passes.bloom && f.bloom) out.push({ id: 'bloom', params: { ...p.bloom } });
  if (passes.dof && f.dof) out.push({ id: 'dof', params: { ...p.dof, maskChannel: 'y' } });
  if (f.chroma) out.push({ id: 'chroma', params: { scale: p.chroma.scale, rest: p.chroma.rest } });
  if (passes.grade) {
    out.push({ id: 'aces', params: { exposure: p.exposure } });
    out.push({ id: 'grade', params: { model: 'lift-gamma-gain' } });
    out.push({ id: 'vignette', params: { strength: p.vignette } });
    if (f.grain) out.push({ id: 'grain', params: { intensity: p.grain } });
  }
  out.push({ id: 'output', params: { toneMapping: 'none', colorSpace: 'srgb' } });
  return out;
}

// ---- uniforms ------------------------------------------------------------------------------------------

/** SPEC §10.8.2 `PostUniforms`, verbatim members, plus `bokehScale` and `vignetteAspect` (documented). */
export interface PostUniforms {
  readonly focusPoint: UniformNode<'vec3', Vector3>;   // rig.focus (world)
  readonly planeNormal: UniformNode<'vec3', Vector3>;  // §10.7.3 n, world space
  readonly chroma: UniformNode<'float', number>;       // 0 at rest; CHROMA_SUPER 0.012 for 120 ms
  readonly lift: UniformNode<'vec3', Vector3>; readonly gamma: UniformNode<'vec3', Vector3>; readonly gain: UniformNode<'vec3', Vector3>;
  readonly vignette: UniformNode<'float', number>;     // 0.22
  readonly grain: UniformNode<'float', number>;        // 0.052 (GrainNode intensity)
  readonly exposure: UniformNode<'float', number>;     // 1.0
  /** DOF max CoC in px: `6 × pixelRatio` (§10.7.3). */
  readonly bokehScale: UniformNode<'float', number>;
  /** Vignette aspect correction `height / width` (0.5625 at 16:9). */
  readonly vignetteAspect: UniformNode<'float', number>;
}

export function createPostUniforms(): PostUniforms {
  return {
    focusPoint: uniform(new Vector3()),
    planeNormal: uniform(new Vector3(0, 1, 0)),
    chroma: uniform(POST_PARAMS.chroma.rest),
    lift: uniform(new Vector3(...GROVE_GRADE.lift)),
    gamma: uniform(new Vector3(...GROVE_GRADE.gamma)),
    gain: uniform(new Vector3(...GROVE_GRADE.gain)),
    vignette: uniform(POST_PARAMS.vignette),
    grain: uniform(POST_PARAMS.grain),
    exposure: uniform(POST_PARAMS.exposure),
    bokehScale: uniform(POST_PARAMS.dof.bokehPx),
    vignetteAspect: uniform(0.5625),
  };
}

// ---- tilt-shift focal plane (§10.7.3) ------------------------------------------------------------------

const _fwd = new Vector3();
const DEG = Math.PI / 180;

/**
 * Writes the world-space focal-plane normal into `out`: the view-perpendicular plane tilted 24° toward
 * the ground about the camera's right axis. For the default −52° pitch this is
 * `normalize(−cos 76°·f_h + sin 76°·up) = (−0.2419·f_h, 0.9703)`. Generalised to the camera's actual
 * pitch so the battle camera (28°) keeps the same 24° tilt.
 */
export function tiltPlaneNormal(cameraWorldForward: Vector3, out: Vector3, tiltDeg: number = POST_PARAMS.dof.tiltDeg): Vector3 {
  _fwd.copy(cameraWorldForward).normalize();
  const pitchDown = Math.asin(Math.min(1, Math.max(-1, -_fwd.y)));
  const a = pitchDown + tiltDeg * DEG;
  let hx = _fwd.x; let hz = _fwd.z;
  const hl = Math.hypot(hx, hz);
  if (hl < 1e-6) { hx = 0; hz = -1; } else { hx /= hl; hz /= hl; }
  const c = Math.cos(a); const s = Math.sin(a);
  return out.set(-c * hx, s, -c * hz).normalize();
}

// ---- realisation -----------------------------------------------------------------------------------------

export interface PostNodes {
  readonly scenePass: PassNode;
  /** The `mask` MRT texture (x: exclude from GTAO, y: DOF-sharp), read by `pillars.spec.ts`. */
  readonly maskT: TextureNode;
  readonly beautyT: TextureNode;
}

export interface PostBuild {
  readonly outputNode: Node;
  readonly plan: readonly PostStage[];
  /** The output node of every realised stage, in graph order, with the §50.2.1 row its GPU time belongs to. */
  readonly stages: readonly { readonly pass: BudgetPass; readonly node: Node }[];
}

function has(plan: readonly PostStage[], id: PostStageId): boolean {
  return plan.some((s) => s.id === id);
}

/** Creates the persistent scene pass with the §10.8.2 MRT (4 HalfFloat colour targets + depth). */
export function createScenePass(scene: Scene, camera: Camera): PostNodes {
  const scenePass = pass(scene, camera, { depthBuffer: true });
  scenePass.setMRT(mrt({ output, normal: normalView, velocity, mask: vec2(0, 0) }));
  scenePass.name = 'ewa:scene';
  return {
    scenePass,
    beautyT: scenePass.getTextureNode('output'),
    maskT: scenePass.getTextureNode('mask'),
  };
}

/** Build options that exist for A/B comparisons (sandbox shots, tests); the defaults are the shipped graph. */
export interface PostBuildOptions {
  /** DOF CoC forced to 0 under `mask.y` (default true; false = the part-1 graph, for before/after shots). */
  readonly dofMaskedCoC?: boolean;
}

/** Realises `plan` on top of an existing scene pass. Pure TSL graph construction (no GPU work). */
export function buildPostOutput(nodes: PostNodes, camera: PerspectiveCamera, u: PostUniforms, plan: readonly PostStage[], opts: PostBuildOptions = {}): PostBuild {
  const { scenePass, beautyT: beauty, maskT } = nodes;
  const depthT = scenePass.getTextureNode('depth');
  const normalT = scenePass.getTextureNode('normal');
  const velT = scenePass.getTextureNode('velocity');
  const stages: { pass: BudgetPass; node: Node }[] = [];

  // GTAO — half resolution, 16 spp; sprites/decals (mask.x = 1) keep their own contact gradient.
  let lit: Node<'vec4'> = beauty as unknown as Node<'vec4'>;
  const gtao = plan.find((s) => s.id === 'gtao');
  if (gtao) {
    const g = POST_PARAMS.gtao;
    const aoNode = ao(depthT, normalT, camera);
    aoNode.resolutionScale = g.resolutionScale;
    aoNode.samples.value = g.samples;
    aoNode.radius.value = g.radius;
    aoNode.thickness.value = g.thickness;
    aoNode.scale.value = g.scale;
    aoNode.useTemporalFiltering = gtao.params.temporal === true;
    stages.push({ pass: 'gtao', node: aoNode as unknown as Node });
    const aoT = aoNode.getTextureNode();
    lit = vec4(beauty.rgb.mul(mix(aoT.r, float(1), maskT.x)), beauty.a);
  }

  // Anti-aliasing — TRAA on webgpu, SMAA on the webgl2 fallback (or with taa off).
  let aa: Node<'vec4'> = lit;
  if (has(plan, 'traa')) aa = traa(lit, depthT, velT, camera) as unknown as Node<'vec4'>;
  else if (has(plan, 'smaa')) aa = smaa(lit) as unknown as Node<'vec4'>;
  if (aa !== lit) stages.push({ pass: 'traa', node: aa });

  // Bloom — threshold 1.15 scene-linear sits in the gap between 1.10 environment and 1.35 creature emissive.
  let bloomed: Node<'vec4'> = aa;
  if (has(plan, 'bloom')) {
    const b = POST_PARAMS.bloom;
    const bn = bloom(aa, b.strength, b.radius, b.threshold);
    bn.smoothWidth.value = b.smoothWidth;
    bn.setResolutionScale(b.resolutionScale);
    stages.push({ pass: 'bloom', node: bn as unknown as Node });
    bloomed = aa.add(bn as unknown as Node<'vec4'>);
  }

  // Tilt-shift DOF through the sharp mask (§10.7.3): viewZNode = −d so the node's signedDist = d.
  let focused: Node<'vec4'> = bloomed;
  if (has(plan, 'dof')) {
    const projInv = uniform(camera.projectionMatrixInverse);
    const camWorld = uniform(camera.matrixWorld);
    const viewPos = getViewPosition(screenUV, depthT as unknown as Node<'float'>, projInv) as Node<'vec3'>;
    const worldPos = camWorld.mul(vec4(viewPos, 1)).xyz;
    const planeDist = dot(worldPos.sub(u.focusPoint), u.planeNormal);
    // R4 (IMPLEMENTATION-NOTES Part 4, H3): the CoC is 0 under mask.y, so a sharp billboard off the plane has no
    // near/far-field weight of its own — its CoC is not Gaussian-dilated into the ground around it and its colour
    // is not spread by the near-field max pass (the soft coloured halo). The composite below still restores it.
    const viewZ = opts.dofMaskedCoC === false ? planeDist.negate() : planeDist.negate().mul(oneMinus(maskT.y));
    const blurred = dof(bloomed, viewZ, POST_PARAMS.dof.focusDistance, POST_PARAMS.dof.focalLength, u.bokehScale) as unknown as Node<'vec4'>;
    stages.push({ pass: 'dof', node: blurred });
    focused = mix(blurred, bloomed, maskT.y);
  }

  // Chromatic aberration (transient; 0 at rest).
  let ca: Node<'vec4'> = focused;
  // `center = null` is documented as "screen centre" but 0.186 passes the null straight into its layout Fn (crash): explicit centre.
  if (has(plan, 'chroma')) ca = chromaticAberration(focused, u.chroma, vec2(0.5, 0.5), float(POST_PARAMS.chroma.scale)) as unknown as Node<'vec4'>;
  if (ca !== focused) stages.push({ pass: 'grade', node: ca });   // §50.2.1 "grade / HUD" row lists the aberration

  // ACES then grade (display-referred), vignette, grain.
  let rgb: Node<'vec3'> = ca.rgb;
  if (has(plan, 'aces')) rgb = acesFilmicToneMapping(ca.rgb, u.exposure) as Node<'vec3'>;
  if (has(plan, 'grade')) rgb = gradeNode(rgb, u.lift, u.gamma, u.gain);
  if (has(plan, 'vignette')) rgb = vignetteNode(rgb, u.vignette, u.vignetteAspect);
  // zero-mean, luminance-weighted grain (grain.ts): full and reduced effects agree in exposure (FilmNode brightened ≈ 2 %)
  if (has(plan, 'grain')) rgb = (grain(vec4(rgb, 1), u.grain) as unknown as Node<'vec4'>).rgb;

  const outputNode = renderOutput(vec4(rgb, 1), NoToneMapping, SRGBColorSpace);
  return { outputNode, plan, stages };
}

/** Every `RenderTarget` a display node holds in its own (also private) properties, one level into private sub-nodes. */
export function renderTargetsOf(n: Node, depth = 1): RenderTarget[] {
  const out: RenderTarget[] = [];
  const rec = n as unknown as Record<string, unknown>;
  for (const k of Object.getOwnPropertyNames(rec)) {
    const v = rec[k] as { isRenderTarget?: boolean; isNode?: boolean } | unknown[] | null | undefined;
    if (v === null || v === undefined || typeof v !== 'object') continue;
    if (Array.isArray(v)) { for (const e of v) if ((e as { isRenderTarget?: boolean } | null)?.isRenderTarget === true) out.push(e as RenderTarget); continue; }
    if ((v as { isRenderTarget?: boolean }).isRenderTarget === true) out.push(v as RenderTarget);
    else if (depth > 0 && k.startsWith('_') && (v as { isNode?: boolean }).isNode === true) out.push(...renderTargetsOf(v as unknown as Node, depth - 1));
  }
  return out;
}

/**
 * Render target → §50.2.1 row for the realised graph: the scene pass is `opaque` (sprites render inside it), every
 * stage's display nodes (and the `convertToTexture` RTTs they create) belong to that stage. Used by the per-context
 * GPU timer (`PassTimer`, IMPLEMENTATION-NOTES Part 4, H6).
 */
export function stageTargets(nodes: PostNodes, build: PostBuild): Map<RenderTarget, BudgetPass> {
  const map = new Map<RenderTarget, BudgetPass>();
  const scene = (nodes.scenePass as unknown as { renderTarget?: RenderTarget }).renderTarget;
  if (scene) map.set(scene, 'opaque');
  const keep = new Set<Node>([nodes.scenePass, nodes.beautyT, nodes.maskT] as unknown as Node[]);
  for (const st of build.stages) {
    for (const n of collectOwnedNodes(st.node, keep)) {
      keep.add(n);
      for (const rt of renderTargetsOf(n)) if (!map.has(rt)) map.set(rt, st.pass);
    }
  }
  return map;
}

/** Nodes whose `updateBefore` renders into targets they own (the ones that must be disposed on rebuild). */
function ownsTargets(n: Node): boolean {
  const any = n as Node & { isRTTNode?: boolean; isPassNode?: boolean; updateBeforeType?: string };
  return any.isRTTNode === true || any.isPassNode === true || (any.updateBeforeType !== undefined && any.updateBeforeType !== 'none');
}

/** Collects every render-target-owning node reachable from `root` (cycle-safe), excluding `keep`. */
export function collectOwnedNodes(root: Node, keep: ReadonlySet<Node>): Node[] {
  const seen = new Set<Node>();
  const owned: Node[] = [];
  const stack: Node[] = [root];
  while (stack.length > 0) {
    const n = stack.pop()!;
    if (seen.has(n)) continue;
    seen.add(n);
    if (keep.has(n)) continue;                 // the persistent scene pass and its texture nodes
    if (ownsTargets(n)) owned.push(n);
    for (const c of (n as Node & { getChildren(): Iterable<Node> }).getChildren()) stack.push(c);
  }
  return owned;
}

const _camFwd = new Vector3();

/** Owns the one `RenderPipeline` (§10.0.3 rule 1) and rebuilds its output on effect/pass changes. */
export class PostStack {
  readonly pipeline: RenderPipeline;
  readonly uniforms: PostUniforms;
  readonly nodes: PostNodes;
  private current: PostBuild;
  private owned: Node[] = [];
  private readonly keep: ReadonlySet<Node>;
  private grade: GradePalette = GROVE_GRADE;
  private buildOpts: PostBuildOptions = {};
  private targets = new Map<RenderTarget, BudgetPass>();
  /**
   * three's render call depth at which the scene pass last rendered (`RenderContexts` keys contexts by it; the
   * pre-compile must use the same context, IMPLEMENTATION-NOTES Part 4, H4). It is the depth of whichever display
   * node's quad first reads a scene-pass texture, + 1 — 2 with the full graph (the DOF CoC quad), so it is measured,
   * not assumed. Null before the first frame.
   */
  sceneCallDepth: number | null = null;
  private flags: EffectsFlags;
  private passes: PassSwitches;
  private disposed = false;

  constructor(
    gpu: WebGPURenderer,
    scene: Scene,
    private readonly camera: PerspectiveCamera,
    private backend: Backend,
    f: EffectsFlags,
    passes: PassSwitches = ALL_PASSES_ON,
  ) {
    this.uniforms = createPostUniforms();
    this.flags = f;
    this.passes = passes;
    this.nodes = createScenePass(scene, camera);
    {
      const pass = this.nodes.scenePass as unknown as { updateBefore(frame: unknown): unknown };
      const r = gpu as unknown as { _callDepth?: number };
      const updateBefore = pass.updateBefore.bind(pass);
      pass.updateBefore = (frame: unknown): unknown => {
        if (typeof r._callDepth === 'number') this.sceneCallDepth = r._callDepth + 1;   // its renderer.render() nests one deeper
        return updateBefore(frame);
      };
    }
    this.keep = new Set<Node>([this.nodes.scenePass, this.nodes.beautyT, this.nodes.maskT]);
    this.current = buildPostOutput(this.nodes, camera, this.uniforms, planPostGraph(f, backend, passes));
    this.owned = collectOwnedNodes(this.current.outputNode, this.keep);
    this.targets = stageTargets(this.nodes, this.current);
    this.pipeline = new RenderPipeline(gpu, this.current.outputNode);
    this.pipeline.outputColorTransform = false;   // the graph ends in renderOutput(…, NoToneMapping, SRGBColorSpace)
  }

  /** The realised stage order (for tests, the harness and the sandbox overlay). */
  get plan(): readonly PostStage[] { return this.current.plan; }

  /** Rebuilds the chain for new flags / pass switches; retired display nodes are disposed. */
  rebuild(f: EffectsFlags, passes: PassSwitches = ALL_PASSES_ON): void {
    if (this.disposed) return;
    this.flags = f;
    this.passes = passes;
    const retired = this.owned;
    this.current = buildPostOutput(this.nodes, this.camera, this.uniforms, planPostGraph(f, this.backend, passes), this.buildOpts);
    this.owned = collectOwnedNodes(this.current.outputNode, this.keep);
    this.targets = stageTargets(this.nodes, this.current);
    this.pipeline.outputNode = this.current.outputNode;
    this.pipeline.needsUpdate = true;
    for (const n of retired) n.dispose();
  }

  /** The §50.2.1 row a render into `rt` belongs to (scene pass, a stage's own targets), or null (not the graph's). */
  passOfTarget(rt: RenderTarget): BudgetPass | null {
    return this.targets.get(rt) ?? null;
  }

  /** A/B switches for comparisons (sandbox shots); rebuilds with the current flags and passes. */
  setBuildOptions(o: PostBuildOptions): void {
    this.buildOpts = { ...o };
    this.rebuild(this.flags, this.passes);
  }

  /** Per-frame: DOF focal plane through `focus` (§10.7.3). Zero allocation. */
  setFocus(focus: Vector3): void {
    this.uniforms.focusPoint.value.copy(focus);
    this.camera.getWorldDirection(_camFwd);
    tiltPlaneNormal(_camFwd, this.uniforms.planeNormal.value);
  }

  setPixelRatio(pr: number): void {
    this.uniforms.bokehScale.value = POST_PARAMS.dof.bokehPx * pr;
  }

  setAspect(aspect: number): void {
    this.uniforms.vignetteAspect.value = aspect > 0 ? 1 / aspect : 0.5625;
  }

  setGrade(g: GradePalette): void {
    this.grade = g;
    this.uniforms.gamma.value.set(...g.gamma);
    this.uniforms.gain.value.set(...g.gain);
    this.setDaylight(1);
  }

  /** Blends the lift between the palette's night lift and day lift by daylight 0..1 (§10.5.3). */
  setDaylight(d: number): void {
    const k = Math.min(1, Math.max(0, d));
    const { lift, nightLift } = this.grade;
    this.uniforms.lift.value.set(
      nightLift[0] + (lift[0] - nightLift[0]) * k,
      nightLift[1] + (lift[1] - nightLift[1]) * k,
      nightLift[2] + (lift[2] - nightLift[2]) * k,
    );
  }

  render(): void {
    this.pipeline.render();
  }

  /** §10.1.5 `pipeline.dispose()` — plus the display nodes and the scene pass it does not free itself. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const n of this.owned) n.dispose();
    this.owned = [];
    this.nodes.scenePass.dispose();
    this.pipeline.dispose();
  }
}
