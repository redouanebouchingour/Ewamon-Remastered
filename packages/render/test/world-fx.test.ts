/**
 * World effects (SPEC §10.7.8): what a foot lands on (`classify`, from the zone's own plan, palette and water mask),
 * the stride cadence and what each landing leaves (particles, prints).
 */
import { describe, expect, it } from 'vitest';
import { Vector3, Vector4 } from 'three/webgpu';
import { uniform } from 'three/tsl';
import type { ZoneId } from '@ewa/content';
import { TerrainCollider } from '../src/terrain/collider.js';
import { createSplatContext, layoutOf } from '../src/zone/layout.js';
import { paletteFor } from '../src/zone/palettes.js';
import { classify, keepsPrint, wetKind, type GroundKind, type GroundSource } from '../src/worldfx/ground.js';
import { Footsteps, STEPS, strideFor, type WalkerSource } from '../src/worldfx/footsteps.js';
import { WORLD_BURSTS, WORLD_PARTICLES, WorldParticles } from '../src/worldfx/particles.js';
import { FootprintDecals, PRINT_SLOTS } from '../src/worldfx/prints.js';
import { GRASS_PUSH, GrassPush, rustleStrength, springStrength } from '../src/worldfx/grass.js';
import { surfaceExtras } from '../src/materials/surfaces.js';
import { SHAFTS, shaftLevel } from '../src/worldfx/shafts.js';
import { CLOUD_STRENGTH, WorldFx } from '../src/worldfx/index.js';
import { ALL_EFFECTS } from '../src/descriptors.js';
import { PerspectiveCamera } from 'three/webgpu';
import { AMBIENT_PROFILES, AmbientMotes, biomeProfile, moodProfile, weatherThins } from '../src/worldfx/ambient.js';
import { realSpec } from './zone-helpers.js';

function groundFor(id: ZoneId): { g: GroundSource; c: TerrainCollider; half: number } {
  const spec = realSpec(id);
  const c = new TerrainCollider(spec.heightfield);
  const pal = paletteFor(spec.palette, spec.biome);
  const g: GroundSource = {
    splat: createSplatContext(layoutOf(spec), spec.buildings, spec.seed, spec.interiors),
    layers: pal.terrainLayers, plaza: pal.plaza,
    water: (x, z) => c.water(x, z), onWater: (x, z) => c.onWater(x, z),
  };
  return { g, c, half: spec.size.w / 2 };
}

/** Kinds found on a 2 m grid over the playable ground. */
function kindsOn(id: ZoneId): Map<GroundKind, { x: number; z: number }> {
  const { g, c, half } = groundFor(id);
  const out = new Map<GroundKind, { x: number; z: number }>();
  for (let x = -half + 2; x < half - 2; x += 2) for (let z = -half + 2; z < half - 2; z += 2) {
    if (!c.walkable(x, z) && !c.water(x, z)) continue;
    const k = classify(g, x, z);
    if (!out.has(k)) out.set(k, { x, z });
  }
  return out;
}

describe('classify (what a foot lands on)', () => {
  it('a grove route: gravel road dust, moss soil, tall grass', () => {
    const k = kindsOn('mire_route');
    expect(k.has('dust')).toBe(true);
    expect(k.has('soil')).toBe(true);
    expect(k.has('grass')).toBe(true);
  });

  it('the coast keeps sand, the heights snow', () => {
    expect(kindsOn('tide_route').has('sand')).toBe(true);
    expect(kindsOn('ascent_route').has('snow')).toBe(true);
  });

  it('every tall-grass patch centre reads grass (the encounter grass)', () => {
    const { g } = groundFor('mire_route');
    expect(g.splat.plan.grassPatches.length).toBeGreaterThan(0);
    for (const p of g.splat.plan.grassPatches) expect(classify(g, p.x, p.z)).toBe('grass');
  });

  it('rain turns earth to mud and paving to puddles; sand, snow and grass keep their own', () => {
    expect(wetKind('dust')).toBe('mud');
    expect(wetKind('soil')).toBe('mud');
    expect(wetKind('stone')).toBe('shallow');
    for (const k of ['sand', 'snow', 'grass', 'shallow'] as const) expect(wetKind(k)).toBe(k);
    const { g } = groundFor('mire_route');
    const road = kindsOn('mire_route').get('dust')!;
    expect(classify(g, road.x, road.z, 1)).toBe('mud');
  });

  it('only sand, snow and mud keep prints', () => {
    expect(['sand', 'snow', 'mud'].every((k) => keepsPrint(k as GroundKind))).toBe(true);
    expect(['dust', 'grass', 'stone', 'shallow', 'soil', 'ash'].some((k) => keepsPrint(k as GroundKind))).toBe(false);
  });
});

/** One walker in slot 0 at `at`, moving at `speed` facing +z. */
function walker(at: Vector3, speed: number): WalkerSource {
  const n = new Vector3(0, 1, 0);
  return { forEachWalker: (visit) => visit(0, at, n, speed, 0, 0) };
}

describe('footsteps', () => {
  it('the stride lengthens from a walk to a run', () => {
    expect(strideFor(1)).toBeCloseTo(STEPS.strideWalkM);
    expect(strideFor(6)).toBeCloseTo(STEPS.strideRunM);
    expect(strideFor(3)).toBeGreaterThan(strideFor(2));
  });

  it('a walker lands one foot per stride and throws its ground; sand keeps prints, a standing walker none', () => {
    const { g } = groundFor('tide_route');
    const sand = kindsOn('tide_route').get('sand')!;
    const p = new WorldParticles();
    const prints = new FootprintDecals(p.clock, uniform(0));
    const steps = new Footsteps(p, prints);
    steps.setGround(g);
    const at = new Vector3(sand.x, 0, sand.z);
    for (let i = 0; i < 60; i++) steps.update(1 / 30, walker(at, 1.5), at, 0);   // 2 s at 1.5 m/s = 3 m
    expect(steps.steps).toBe(Math.floor(3 / strideFor(1.5)));
    expect(p.count).toBeGreaterThan(0);
    expect(prints.count).toBe(steps.steps);
    const before = steps.steps;
    for (let i = 0; i < 60; i++) steps.update(1 / 30, walker(at, 0), at, 0);
    expect(steps.steps).toBe(before);
  });

  it('walkers beyond the range of the camera focus take no steps', () => {
    const { g } = groundFor('tide_route');
    const p = new WorldParticles();
    const steps = new Footsteps(p, new FootprintDecals(p.clock, uniform(0)));
    steps.setGround(g);
    const at = new Vector3(0, 0, 0);
    const far = new Vector3(STEPS.rangeM + 5, 0, 0);
    for (let i = 0; i < 60; i++) steps.update(1 / 30, walker(at, 2), far, 0);
    expect(steps.steps).toBe(0);
  });

  it('the pools are fixed: the particle ring and the prints wrap instead of growing', () => {
    const p = new WorldParticles();
    for (let i = 0; i < 1000; i++) p.emit(WORLD_BURSTS.dust, 0, 0, 0, 0, 1);
    expect(p.count).toBe(1000 * WORLD_BURSTS.dust.count);
    expect((p.object as { count: number }).count).toBe(WORLD_PARTICLES);
    const prints = new FootprintDecals(p.clock, uniform(0));
    for (let i = 0; i < PRINT_SLOTS * 2; i++) prints.place('snow', i, 0, 0, 0, new Vector3(0, 1, 0), 0);
    expect(prints.count).toBe(PRINT_SLOTS * 2);
    expect(prints.mesh.count).toBe(PRINT_SLOTS);
  });
});

describe('grass that makes way (GrassPush)', () => {
  const uniforms = () => [0, 1, 2, 3].map(() => uniform(new Vector4(0, 0, 1, 0)));

  it('the nearest walkers hold the discs, eased in; a walker who leaves springs back to nothing', () => {
    const u = uniforms();
    const g = new GrassPush(u);
    const at = new Vector3(3, 0, 4);
    for (let i = 0; i < 30; i++) g.update(1 / 30, walker(at, 1.5), new Vector3(0, 0, 0));
    expect(g.active).toBe(1);
    const held = u.find((x) => x.value.w > 0)!;
    expect(held.value.x).toBe(3);
    expect(held.value.y).toBe(4);
    expect(held.value.z).toBe(GRASS_PUSH.radiusM);
    expect(held.value.w).toBeGreaterThan(0.95);
    const none: WalkerSource = { forEachWalker: () => undefined };
    let negative = false;
    for (let i = 0; i < 60; i++) { g.update(1 / 60, none, new Vector3()); if (u.some((x) => x.value.w < -0.01)) negative = true; }
    expect(negative).toBe(true);                       // the wobble swings back past upright
    expect(g.active).toBe(0);
    expect(u.every((x) => x.value.w === 0)).toBe(true);
  });

  it('walkers beyond the range hold nothing; a standing walker presses softer', () => {
    const u = uniforms();
    const g = new GrassPush(u);
    for (let i = 0; i < 10; i++) g.update(1 / 30, walker(new Vector3(GRASS_PUSH.rangeM + 1, 0, 0), 1), new Vector3());
    expect(g.active).toBe(0);
    for (let i = 0; i < 60; i++) g.update(1 / 30, walker(new Vector3(1, 0, 0), 0), new Vector3());
    expect(Math.max(...u.map((x) => x.value.w))).toBeCloseTo(GRASS_PUSH.standing, 2);
  });

  it('the encounter rustle shakes a wide disc and ends', () => {
    const u = uniforms();
    const g = new GrassPush(u);
    g.rustle(5, 6);
    g.update(1 / 60, { forEachWalker: () => undefined }, new Vector3());
    const r = u.find((x) => x.value.z === GRASS_PUSH.rustleRadiusM)!;
    expect(r.value.x).toBe(5);
    expect(Math.abs(r.value.w)).toBeGreaterThan(1);
    expect(rustleStrength(GRASS_PUSH.rustleS)).toBe(0);
    expect(springStrength(1, GRASS_PUSH.springS)).toBe(0);
    for (let i = 0; i < 120; i++) g.update(1 / 60, { forEachWalker: () => undefined }, new Vector3());
    expect(g.active).toBe(0);
  });

  it('only the tall grass card takes the push', () => {
    expect(surfaceExtras('tall_grass').pushable).toBe(true);
    expect(surfaceExtras('grove_leaf_canopy').pushable).not.toBe(true);
  });
});

describe('ambient motes', () => {
  it('each biome has its air, by day and by night', () => {
    expect(biomeProfile('grove', 0.1)).toBe('fireflies');
    expect(biomeProfile('grove', 0.9)).toBe('pollen');
    expect(biomeProfile('cinder', 0.9)).toBe('embers');
    expect(biomeProfile('sky', 0.5)).toBe('snow');
    expect(biomeProfile('rift', 0.5)).toBe('void');
    expect(biomeProfile(null, 0.5)).toBe('none');
  });

  it('a shadowed zone gets ash, denser per level, over the sky mood; level 0 leaves the mood', () => {
    expect(moodProfile(0, null).id).toBe('none');
    expect(moodProfile(0, 'tenjin').id).toBe('tenjin');
    expect(moodProfile(2, 'tenjin')).toEqual({ id: 'ash', density: 0.44 });
    expect(moodProfile(4, null).density).toBeGreaterThan(moodProfile(1, null).density);
    expect(weatherThins('rain')).toBeLessThan(1);
    expect(weatherThins('none')).toBe(1);
  });

  it('a profile change fades the old air out before the new one fades in; indoors stills it', () => {
    const a = new AmbientMotes(uniform(new Vector3(1, 1, 1)));
    a.setBiome('grove');
    const step = (n: number, day: number) => { for (let i = 0; i < n; i++) a.update(1000 / 30, new Vector3(), day, null); };
    step(120, 0.9);
    expect(a.profiles[0]).toBe('pollen');
    expect(a.densities[0]).toBeCloseTo(AMBIENT_PROFILES.pollen.density, 2);
    step(3, 0.1);
    expect(a.profiles[0]).toBe('pollen');                      // still fading out
    expect(a.densities[0]).toBeLessThan(AMBIENT_PROFILES.pollen.density);
    step(150, 0.1);
    expect(a.profiles[0]).toBe('fireflies');
    expect(a.densities[0]).toBeCloseTo(AMBIENT_PROFILES.fireflies.density, 2);
    a.setShadow(3);
    step(150, 0.1);
    expect(a.profiles[1]).toBe('ash');
    a.setOn(false);
    step(200, 0.1);
    expect(a.object.visible).toBe(false);
  });
});

describe('cloud shadows and light shafts', () => {
  function fx(daylight: number, golden: number) {
    const clouds = uniform(new Vector4());
    const w = new WorldFx({
      camera: new PerspectiveCamera(), harvestLevel: uniform(0), walkers: { forEachWalker: () => undefined }, focus: () => new Vector3(),
      wetness: () => 0, light: (o) => o.set(1, 1, 1), effects: () => ALL_EFFECTS, daylight: () => daylight,
      sun: (d) => { d.set(0.6, 0.2, 0.1); return { golden, color: [1, 0.7, 0.4] }; }, clouds, push: null,
    });
    return { w, clouds };
  }

  it('clouds shade the ground by day in the weather coverage, never at night, faintly under overcast rain', () => {
    const day = fx(1, 0);
    day.w.update(16);
    expect(day.clouds.value.x).toBeCloseTo(CLOUD_STRENGTH);
    expect(day.clouds.value.y).toBeCloseTo(0.35);
    day.w.setWeather('rain');
    day.w.update(16);
    expect(day.clouds.value.x).toBeLessThan(CLOUD_STRENGTH * 0.3);
    expect(day.clouds.value.y).toBeCloseTo(0.85);
    const night = fx(0, 0);
    night.w.update(16);
    expect(night.clouds.value.x).toBe(0);
  });

  it('shafts stand only in the golden hours under a broken sky', () => {
    expect(shaftLevel(0, 1, 1)).toBe(0);
    expect(shaftLevel(1, 1, 1)).toBe(1);
    expect(shaftLevel(1, 1, 0)).toBe(0);
    const dusk = fx(0.5, 1);
    dusk.w.update(16);
    expect(dusk.w.shafts.mesh.visible).toBe(true);
    dusk.w.setWeather('rain');
    dusk.w.update(16);
    expect(dusk.w.shafts.mesh.visible).toBe(false);
    expect(SHAFTS.side * SHAFTS.side).toBe(9);
  });
});
