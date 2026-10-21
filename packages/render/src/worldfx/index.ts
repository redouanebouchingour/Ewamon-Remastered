/**
 * World effects (SPEC §10.7.8): the overworld's small motion: what feet throw up, the prints they leave, the grass
 * an encounter shakes. One bundle per renderer, built with the part-3 subsystems (`stage/wiring.ts`) and driven from
 * their frame hook after the actor pool moved its rigs. It reads the zone through the handle (`onZone`) and the
 * actors through `CharacterPool.forEachWalker`; the client calls nothing per frame.
 *
 * Budget: one draw call and one program for the particles, one of each for the prints (both compiled in the warm-up
 * frame, `warmupObjects`). Reduced effects (§10.8.4) keep the footsteps and prints (they are small and slow) and drop
 * the encounter rustle's burst to a few blades.
 */
import type { Object3D, PerspectiveCamera, UniformNode, Vector3, Vector4 } from 'three/webgpu';
import { Group, InstancedMesh, Sprite } from 'three/webgpu';
import type { EffectsFlags, WeatherKind } from '../descriptors.js';
import type { ZoneHandle } from '../contracts.js';
import type { ZoneHandleImpl } from '../zone/builder.js';
import { WORLD_BURSTS, WorldParticles } from './particles.js';
import { FootprintDecals } from './prints.js';
import { Footsteps, type WalkerSource } from './footsteps.js';
import { classify, type GroundSource } from './ground.js';
import { GrassPush } from './grass.js';
import { AmbientMotes } from './ambient.js';

export interface WorldFxDeps {
  readonly camera: PerspectiveCamera;
  readonly harvestLevel: UniformNode<'float', number>;
  readonly walkers: WalkerSource;
  readonly focus: () => Vector3;
  /** weather wetness 0..1 (the shared uniform) */
  readonly wetness: () => number;
  /** the light lit particles take (linear rgb, written into `out`) */
  readonly light: (out: Vector3) => void;
  readonly effects: () => EffectsFlags;
  /** sun-elevation daylight 0..1 (the ambient motes: fireflies at night) */
  readonly daylight: () => number;
  /** the shared grass pushers (`SharedUniforms.push`); null = no push field */
  readonly push: readonly UniformNode<'vec4', Vector4>[] | null;
}

/** The ground a zone handle describes, or null when it carries no plan (a test zone, the arena). */
export function groundOf(z: ZoneHandle | null): GroundSource | null {
  const h = z as (ZoneHandleImpl & { readonly splat?: ZoneHandleImpl['splat'] }) | null;
  if (h === null || h.splat === undefined || h.palette === undefined) return null;
  const c = h.collider;
  return {
    splat: h.splat,
    layers: h.palette.terrainLayers,
    plaza: h.palette.plaza,
    water: (x, z2) => c.water(x, z2),
    onWater: (x, z2) => c.onWater(x, z2),
  };
}

export class WorldFx {
  readonly root = new Group();
  readonly particles: WorldParticles;
  readonly prints: FootprintDecals;
  readonly steps: Footsteps;
  readonly grass: GrassPush;
  readonly ambient: AmbientMotes;
  private ground: GroundSource | null = null;
  private disposed = false;

  constructor(private readonly d: WorldFxDeps) {
    this.root.name = 'ewa:worldfx';
    this.particles = new WorldParticles();
    this.prints = new FootprintDecals(this.particles.clock, d.harvestLevel);
    this.steps = new Footsteps(this.particles, this.prints);
    this.grass = new GrassPush(d.push);
    this.ambient = new AmbientMotes(this.particles.light);
    this.root.add(this.particles.object, this.prints.mesh, this.ambient.object);
  }

  /** The loaded zone (null while none is): the footsteps' ground, a clean slate of particles and prints. */
  onZone(z: ZoneHandle | null): void {
    const h = z as ZoneHandleImpl | null;
    this.ground = groundOf(z);
    this.steps.setGround(this.ground, h?.spec?.biome === 'cinder');
    this.ambient.setBiome(h?.spec?.biome ?? null);
    this.particles.clear();
    this.prints.clear();
    this.grass.clear();
  }

  /** Per frame (the part-3 hook, after the actor pool): scaled ms. Zero allocation. */
  update(dtScaledMs: number): void {
    if (this.disposed) return;
    this.particles.update(dtScaledMs, this.d.camera);
    this.d.light(this.particles.light.value);
    const focus = this.d.focus();
    this.steps.update(dtScaledMs / 1000, this.d.walkers, focus, this.d.wetness());
    this.grass.update(dtScaledMs / 1000, this.d.walkers, focus);
    this.ambient.update(dtScaledMs, focus, this.d.daylight(), this.d.camera);
  }

  /** The zone's weather, honor shadow and sky mood, and whether the air moves at all (off indoors): the motes. */
  setWeather(w: WeatherKind): void { this.ambient.setWeather(w); }
  setShadow(level: number): void { this.ambient.setShadow(level); }
  setSkyMood(mood: 'majin' | 'tenjin' | null): void { this.ambient.setSkyMood(mood); }
  setAmbient(on: boolean): void { this.ambient.setOn(on); }

  /**
   * The encounter rustle: tall grass bursting round (x, y, z) as a wild encounter starts (the client calls it with the
   * battle's start). `strength` 0..1; reduced effects keep a few blades.
   */
  rustle(x: number, y: number, z: number, strength = 1): void {
    const s = Math.min(1.5, Math.max(0, strength)) * (this.d.effects().shake ? 1 : 0.3);
    this.particles.emit(WORLD_BURSTS.rustle, x, y, z, 0, 0, s);
    this.grass.rustle(x, z, s);
  }

  /**
   * A wild battle starts with the player at (x, y, z): in tall grass the grass bursts and shakes round them (`rustle`),
   * on the water a spray goes up; anywhere else nothing. Returns what played.
   */
  encounterAt(x: number, y: number, z: number): 'grass' | 'water' | null {
    const g = this.ground;
    if (g === null) return null;
    if (g.onWater(x, z)) {
      const s = this.d.effects().shake ? 1 : 0.3;
      this.particles.emit(WORLD_BURSTS.splash, x, y, z, 0, 0, 3 * s);
      this.particles.emit(WORLD_BURSTS.ripple, x, y, z, 0, 0, 1);
      return 'water';
    }
    if (classify(g, x, z) !== 'grass') return null;
    this.rustle(x, y, z, 1);
    return 'grass';
  }

  /** The warm-up frame's objects (§10.1.2 step 8): the particle material and the print material. */
  warmupObjects(): Object3D[] {
    const fx = new Sprite(this.particles.material);
    fx.count = 1;
    const print = new InstancedMesh(this.prints.mesh.geometry, this.prints.material, 1);
    const motes = new Sprite(this.ambient.material);
    motes.count = 1;
    return [fx, print, motes];
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.particles.dispose();
    this.prints.dispose();
    this.ambient.dispose();
    this.root.removeFromParent();
  }
}
