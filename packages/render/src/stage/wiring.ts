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
import type { Object3D, Vector3 } from 'three/webgpu';
import type { FrameHook, HostContext, Renderer, RendererSubsystems } from '../renderer.js';
import { rendererInternals } from '../renderer.js';
import type { HarvestLevel } from '../descriptors.js';
import type { ZoneHandle } from '../contracts.js';
import { DioramaRig } from '../camera/rig.js';
import { createSpritePool, type BillboardPool } from '../sprites/billboard.js';
import { CanvasHudLayer, HUD, type HudAnchors, type Ref } from '../hud/layer.js';
import { PANEL_DEFAULT_FRACTION } from '../camera/battle.js';
import { CharacterPool } from './actors.js';
import { createGltfCharacterSource } from './looks.js';
import { isDevBuild } from '../env.js';
import { Stage, type StageGround } from './battleStage.js';
import { VfxSystem } from './vfx.js';
import { GroundCoverReveal } from './groundCover.js';
import { PropCutaway } from './propCutaway.js';
import { TerrainPad } from './terrainPad.js';
import { TerrainCollider } from '../terrain/collider.js';
import { scatterMaskFor } from '../zone/scatter.js';
import { WorldFx } from '../worldfx/index.js';
import { sunDirection } from '../lighting/daycycle.js';
import { SPEC_LIGHT_UNIT } from '../lighting/rig.js';

/** §10.7.8 the sun's rim on creature billboards at the noon key's intensity (scene-linear emissive). */
export const SUN_RIM_GAIN = 0.45;

export interface Part3 {
  readonly sprites: BillboardPool;
  readonly rig: DioramaRig;
  readonly actors: CharacterPool;
  readonly vfx: VfxSystem;
  readonly stage: Stage;
  readonly hud: CanvasHudLayer;
  /** Flattens the grass around shown creatures near the camera focus (IMPLEMENTATION-NOTES Part 5, T3). */
  readonly reveal: GroundCoverReveal;
  /** The level pad a dressed ring cuts into a slope (M3 review R-forgewall-2). */
  readonly pad: TerrainPad;
  /** World effects (§10.7.8): footsteps, prints, the encounter rustle. */
  readonly worldFx: WorldFx;
  readonly hook: FrameHook;
  /** Ground for the stage, the actors and the inspector (the zone's collider; null = flat 0). */
  setGround(g: StageGround | null): void;
  /** CSS viewport (from the last `hud.resize`). */
  viewport(): { readonly w: number; readonly h: number };
  /**
   * T2 (IMPLEMENTATION-NOTES Part 5): CSS px of the canvas covered by DOM chrome during a battle — `bottomPx` the battle
   * panel (null = the SPEC's bottom 28 % + margin), `topPx` anything over the canvas top. The battle camera frames both
   * battlers (and the far battler's HP bar) in the band between; the HUD keeps the bars above the panel.
   */
  setBattleInsets(topPx: number, bottomPx: number | null): void;
}

const BUNDLES = new WeakMap<HostContext, Part3>();

function build(ctx: HostContext): Part3 {
  const vp = { w: 1, h: 1 };
  const viewport = (): { w: number; h: number } => vp;
  const harvestUniform = ctx.materials.uniforms.harvestLevel;
  let slowmoLeft = 0;
  let chromaAmount = 0; let chromaMs = 0; let chromaLeft = 0;

  const sprites = createSpritePool({ harvestLevel: harvestUniform, camera: ctx.camera3, upload: (t) => ctx.gpu.initTexture(t) });
  // characters: KayKit 3D bodies from models.manifest.json (§10.7.7); the decal reads the sprite pool's camera uniforms
  const warnCharacters = (m: string): void => { if (isDevBuild()) console.warn(`[@ewa/render characters] ${m}`); };
  const actors = new CharacterPool({
    harvestLevel: harvestUniform, camera: ctx.camera3, viewport, uniforms: sprites.uniforms, warn: warnCharacters,
    source: ctx.modelsUrl === null ? null : createGltfCharacterSource({ baseUrl: ctx.modelsUrl, ktx2: ctx.ktx2, warn: warnCharacters }),
  });
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
    typeColors: (t) => hud.setTypeColors(t),
    post: ctx.post.uniforms,
  });
  const reveal = new GroundCoverReveal(sprites, () => rig.focus);
  const worldFx = new WorldFx({
    camera: ctx.camera3, harvestLevel: harvestUniform, walkers: actors, focus: () => rig.focus as Vector3,
    wetness: () => ctx.materials.uniforms.wetness.value,
    light: (out) => {
      // what lit dust looks like: the key colour, dimmed toward night, over a cool fill
      const d = ctx.day.sample;
      const k = 0.3 + 0.7 * d.daylight;
      out.set(d.linear[0] * k + 0.05, d.linear[1] * k + 0.06, d.linear[2] * k + 0.09);
    },
    effects: () => ctx.effects(),
    push: ctx.materials.uniforms.push ?? null,
    daylight: () => ctx.day.sample.daylight,
    sun: (dir) => { sunDirection(ctx.day.timeOfDay, dir); return { golden: ctx.day.sample.golden, color: ctx.day.sample.linear }; },
    clouds: ctx.materials.uniforms.clouds,
    frost: ctx.materials.uniforms.frost,
    haze: { amount: ctx.post.uniforms.haze, time: ctx.post.uniforms.hazeTime },
  });
  ctx.scene.add(worldFx.root);
  const cutaway = new PropCutaway();
  const pad = new TerrainPad();
  const anchors: HudAnchors = {
    nameplate: (id, out, offset) => actors.projectHead(id, out, offset),
    battler: (ref: Ref, out, offset) => stage.projectBattler(ref, out, offset),
    emotes: (visit) => actors.forEachLive((id, _n, _g, emote, left) => { if (emote > 0) visit(id, emote, left); }),
  };
  const hud = new CanvasHudLayer({ anchors });
  let insetTopPx = 0; let insetBottomPx: number | null = null;
  const applyInsets = (): void => {
    const h = Math.max(1, vp.h);
    const bottom = insetBottomPx ?? PANEL_DEFAULT_FRACTION * h;
    // the far battler's bar sits HUD.barLift + barH above its head, under the top margin (at the HUD's UI scale)
    const bars = (HUD.margin + HUD.barLift + HUD.barH) * hud.uiScale;
    rig.setShotInsets((insetTopPx + bars) / h, bottom / h);
    hud.setBottomInset(bottom);
  };
  const hudResize = hud.resize.bind(hud);
  hud.resize = (w: number, h: number, pr: number): void => { vp.w = w; vp.h = h; hudResize(w, h, pr); applyInsets(); };
  const hudScale = hud.setScale.bind(hud);
  hud.setScale = (s: number): void => { hudScale(s); applyInsets(); };

  const hook: FrameHook & { onZone(z: ZoneHandle | null): void } = {
    update(dtScaledMs: number, dtRealMs?: number): void {
      const real = dtRealMs ?? dtScaledMs;
      sprites.update(dtScaledMs);
      // §10.7.8: the sun's rim on the creatures follows the real key light (its colour, weather, honor shadow included)
      const su = sprites.uniforms;
      if (su.sunDir !== undefined && su.sunRim !== undefined) {
        sunDirection(ctx.day.timeOfDay, su.sunDir.value);
        const sun = ctx.lighting.sun;
        const k = SUN_RIM_GAIN * Math.min(1, sun.intensity / SPEC_LIGHT_UNIT) * (su.sunDir.value.y > 0 ? 1 : 0);
        su.sunRim.value.set(sun.color.r * k, sun.color.g * k, sun.color.b * k);
      }
      vfx.update(dtScaledMs, ctx.camera3);
      actors.update(dtScaledMs);
      worldFx.update(dtScaledMs);
      stage.update(dtScaledMs, real);
      reveal.update(real);
      if (slowmoLeft > 0) { slowmoLeft -= real; if (slowmoLeft <= 0) host.setTimeScale(1); }
      if (chromaLeft > 0) {
        chromaLeft = Math.max(0, chromaLeft - real);
        const k = chromaMs > 0 ? chromaLeft / chromaMs : 0;
        ctx.post.uniforms.chroma.value = ctx.effects().chroma ? chromaAmount * k * k : 0;   // ease-out
      }
      hud.tick(real);
    },
    setHarvestLevel(l: HarvestLevel): void { sprites.setHarvestLevel(l); },
    setWeather: (w) => worldFx.setWeather(w),
    setShadow: (l) => worldFx.setShadow(l),
    setSkyMood: (m) => worldFx.setSkyMood(m),
    setAmbient: (on) => worldFx.setAmbient(on),
    textureOvercountBytes: () => sprites.infoOvercountBytes(),
    onZone(z: ZoneHandle | null): void {
      bundle.setGround(z === null ? null : z.collider);
      zoneRef = z;
      // T1 / T3: the zone's ground-cover mask (arena rings, revealed creatures); per-instance scale, never a rebuild
      const mask = z === null ? null : scatterMaskFor(z.group);
      cutaway.setRoot(z === null ? null : z.group);
      pad.setRoot(z === null ? null : z.group);
      stage.setGroundCover(mask, z === null ? null : cutaway, z === null ? null : pad);
      reveal.setMask(mask);
      worldFx.onZone(z);
    },
    dispose(): void { reveal.dispose(); worldFx.dispose(); vfx.dispose(); sprites.dispose(); },
  };

  const bundle: Part3 = {
    sprites, rig, actors, vfx, stage, hud, reveal, pad, worldFx, hook,
    setGround(g) {
      stage.setGround(g);
      // Phase D8: surfers ride the water level (the collider's surfaceY) with a ripple where it says open water
      if (g === null) actors.setGround(null);
      // M3 review R-forgewall-2: actors stand on a dressed ring's level pad (`TerrainPad.adjust`), not on the cut ground
      else actors.setGround((x, z) => pad.adjust(x, z, g.surfaceY !== undefined ? g.surfaceY(x, z) : g.sample(x, z)), g.onWater !== undefined ? (x, z) => g.onWater!(x, z) : null);
    },
    viewport,
    setBattleInsets(topPx, bottomPx) {
      insetTopPx = Number.isFinite(topPx) ? Math.max(0, topPx) : 0;
      insetBottomPx = bottomPx === null || !Number.isFinite(bottomPx) ? null : Math.max(0, bottomPx);
      applyInsets();
    },
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
  const character = p.actors.warmupMesh();                     // a 23-bone skinned body + an accessory on the character material
  character.position.set(-1, 0, -2);
  const housing = p.stage.warmupHousing();                     // the beacon housing material
  housing.position.set(2, 0, -2);
  p.stage.armWarmupShadows();                                  // the beacons' spot-shadow pass programs (battles, evolutions)
  const aura = p.stage.aura.warmupObjects();                   // the battle-form aura's flames + floor sigil materials
  aura.forEach((o, i) => o.position.set(3 + i, 0.5, -2));
  const world = p.worldFx.warmupObjects();                   // the world effects' particle + footprint materials
  world.forEach((o, i) => o.position.set(-2 - i, 0.2, -2));
  return [bb, fx, character, housing, ...aura, ...world];
}

/** The subsystem factories part 3 provides (merged into `DEFAULT_SUBSYSTEMS`). */
export const PART3_SUBSYSTEMS: Pick<RendererSubsystems, 'camera' | 'stage' | 'hud' | 'actors' | 'hooks' | 'warmup'> & { persistent(ctx: HostContext): readonly Object3D[] } = {
  camera: (ctx) => part3For(ctx).rig,
  stage: (ctx) => part3For(ctx).stage,
  hud: (ctx) => { const h = part3For(ctx).hud; return { layer: h, overlay: { scene: h.scene, camera: h.camera } }; },
  actors: (ctx) => part3For(ctx).actors,
  hooks: (ctx) => [part3For(ctx).hook],
  warmup: (ctx) => warmupObjects(ctx),
  // T4: the main arena (hidden until a battle) compiles at boot and in every zone's background phase
  persistent: (ctx) => [part3For(ctx).stage.arenaRoot],
};

