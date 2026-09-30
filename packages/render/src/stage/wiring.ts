/**
 * Part 3 → renderer host wiring (`DEFAULT_SUBSYSTEMS` in `renderer.ts`).
 *
 * One bundle per renderer, built lazily by the first subsystem factory the host calls (§10.1.2 step 7, before
 * `createRenderer` resolves): the sprite pool (§10.4), the diorama rig (§10.7.1–2), the actor pool (§10.7.6), the
 * VFX pool (§10.7.5), the battle stage (§10.7.5) and the HUD (§10.9). They reference each other (the rig follows
 * actor feet, the stage drives the rig's cue targets, the HUD anchors to actors and battlers), which is why they
 * are built together. The per-frame hook runs after the camera update (host step 3): sprite yaw/lean uniforms and
 * poses, VFX clock, character gait, arena fades, chroma/slow-mo requests, then the HUD's anchor polling.
 */
import { Sprite } from 'three/webgpu';
import type { Object3D } from 'three/webgpu';
import type { FrameHook, HostContext, Renderer, RendererSubsystems } from '../renderer.js';
import { rendererInternals } from '../renderer.js';
import type { HarvestLevel } from '../descriptors.js';
import type { ZoneHandle } from '../contracts.js';
import { DioramaRig } from '../camera/rig.js';
import { createSpritePool, type BillboardPool } from '../sprites/billboard.js';
import { CanvasHudLayer, type HudAnchors, type Ref } from '../hud/layer.js';
import { CHARACTER, CharacterPool } from './actors.js';
import { createGlbLookSource } from './looks.js';
import { isDevBuild } from '../env.js';
import { Stage, type StageGround } from './battleStage.js';
import { VfxSystem } from './vfx.js';
import { TerrainCollider } from '../terrain/collider.js';

export interface Part3 {
  readonly sprites: BillboardPool;
  readonly rig: DioramaRig;
  readonly actors: CharacterPool;
  readonly vfx: VfxSystem;
  readonly stage: Stage;
  readonly hud: CanvasHudLayer;
  readonly hook: FrameHook;
  /** Ground for the stage, the actors and the inspector (the zone's collider; null = flat 0). */
  setGround(g: StageGround | null): void;
  /** CSS viewport (from the last `hud.resize`). */
  viewport(): { readonly w: number; readonly h: number };
}

const BUNDLES = new WeakMap<HostContext, Part3>();

function build(ctx: HostContext): Part3 {
  const vp = { w: 1, h: 1 };
  const viewport = (): { w: number; h: number } => vp;
  const harvestUniform = ctx.materials.uniforms.harvestLevel;
  let slowmoLeft = 0;
  let chromaAmount = 0; let chromaMs = 0; let chromaLeft = 0;

  const sprites = createSpritePool({ harvestLevel: harvestUniform, camera: ctx.camera3, upload: (t) => ctx.gpu.initTexture(t) });
  const looks = ctx.modelsUrl === null ? undefined : createGlbLookSource({
    baseUrl: ctx.modelsUrl, heightM: CHARACTER.heightM, ktx2: ctx.ktx2, warn: (m) => { if (isDevBuild()) console.warn(`[@ewa/render looks] ${m}`); },
  });
  const actors = new CharacterPool({ harvestLevel: harvestUniform, camera: ctx.camera3, viewport, ...(looks ? { looks } : {}) });
  ctx.scene.add(actors.root);
  const host = ctx as unknown as Renderer;
  // the loaded zone's collider carries the tree crowns the shot camera avoids (H11); nothing once it is disposed
  let zoneRef: (ZoneHandle & { readonly disposed?: boolean; readonly collider?: unknown }) | null = null;
  const crowns = (): TerrainCollider | null => (zoneRef !== null && zoneRef.disposed !== true && zoneRef.collider instanceof TerrainCollider ? zoneRef.collider : null);
  const rig = new DioramaRig(ctx.camera3, {
    occluders: crowns,
    effects: () => ctx.effects(),
    feet: (id, out) => actors.feetOf(id, out),
    onSettled: () => ctx.lighting.updateFrustums(),
    onSlowmo: (scale, ms) => { host.setTimeScale(scale); slowmoLeft = ms; },
  });
  const vfx = new VfxSystem({
    chroma: (amount, ms) => { if (!ctx.effects().chroma) return; chromaAmount = amount; chromaMs = ms; chromaLeft = ms; },
  });
  ctx.scene.add(vfx.object);
  const stage = new Stage({
    parent: ctx.scene, sprites, vfx, rig, actors, materials: ctx.materials, effects: () => ctx.effects(), harvestLevel: () => ctx.harvestLevel(),
    camera: ctx.camera3, viewport, weather: (w) => host.setWeather(w),
  });
  const anchors: HudAnchors = {
    nameplate: (id, out, offset) => actors.projectHead(id, out, offset),
    battler: (ref: Ref, out, offset) => stage.projectBattler(ref, out, offset),
    emotes: (visit) => actors.forEachLive((id, _n, _g, emote, left) => { if (emote > 0) visit(id, emote, left); }),
  };
  const hud = new CanvasHudLayer({ anchors });
  const hudResize = hud.resize.bind(hud);
  hud.resize = (w: number, h: number, pr: number): void => { vp.w = w; vp.h = h; hudResize(w, h, pr); };

  const hook: FrameHook & { onZone(z: ZoneHandle | null): void } = {
    update(dtScaledMs: number, dtRealMs?: number): void {
      const real = dtRealMs ?? dtScaledMs;
      sprites.update(dtScaledMs);
      vfx.update(dtScaledMs, ctx.camera3);
      actors.update(dtScaledMs);
      stage.update(dtScaledMs, real);
      if (slowmoLeft > 0) { slowmoLeft -= real; if (slowmoLeft <= 0) host.setTimeScale(1); }
      if (chromaLeft > 0) {
        chromaLeft = Math.max(0, chromaLeft - real);
        const k = chromaMs > 0 ? chromaLeft / chromaMs : 0;
        ctx.post.uniforms.chroma.value = ctx.effects().chroma ? chromaAmount * k * k : 0;   // ease-out
      }
      hud.tick(real);
    },
    setHarvestLevel(l: HarvestLevel): void { sprites.setHarvestLevel(l); },
    onZone(z: ZoneHandle | null): void {
      bundle.setGround(z === null ? null : z.collider);
      zoneRef = z;
    },
    dispose(): void { vfx.dispose(); sprites.dispose(); },
  };

  const bundle: Part3 = {
    sprites, rig, actors, vfx, stage, hud, hook,
    setGround(g) { stage.setGround(g); actors.setGround(g === null ? null : (x, z) => g.sample(x, z)); },
    viewport,
  };
  return bundle;
}

/** The part-3 bundle of a host (built on first use). */
export function part3For(ctx: HostContext): Part3 {
  let b = BUNDLES.get(ctx);
  if (b === undefined) { b = build(ctx); BUNDLES.set(ctx, b); }
  return b;
}

/** The part-3 bundle of a renderer from `createRenderer` (sandbox, harness, client extras); undefined otherwise. */
export function part3Of(r: Renderer): Part3 | undefined {
  const ctx = rendererInternals(r);
  return ctx === undefined ? undefined : part3For(ctx);
}

/** Objects rendered in the §10.1.2 step-8 warm-up frame so their programs exist before the first zone. */
function warmupObjects(ctx: HostContext): Object3D[] {
  const p = part3For(ctx);
  const bb = p.sprites.warmupObject();                       // billboard + contact decal
  bb.position.set(0, 0, -2);
  const fx = new Sprite(p.vfx.material);                       // one particle of the shared VFX material
  fx.count = 1;
  fx.position.set(1, 1, -2);
  const character = p.actors.warmupMesh();                     // one skinned character (shared 'character' material)
  character.position.set(-1, 0, -2);
  const housing = p.stage.warmupHousing();                     // the beacon housing material
  housing.position.set(2, 0, -2);
  return [bb, fx, character, housing];
}

/** The subsystem factories part 3 provides (merged into `DEFAULT_SUBSYSTEMS`). */
export const PART3_SUBSYSTEMS: Pick<RendererSubsystems, 'camera' | 'stage' | 'hud' | 'actors' | 'hooks' | 'warmup'> = {
  camera: (ctx) => part3For(ctx).rig,
  stage: (ctx) => part3For(ctx).stage,
  hud: (ctx) => { const h = part3For(ctx).hud; return { layer: h, overlay: { scene: h.scene, camera: h.camera } }; },
  actors: (ctx) => part3For(ctx).actors,
  hooks: (ctx) => [part3For(ctx).hook],
  warmup: (ctx) => warmupObjects(ctx),
};

