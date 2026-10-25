/**
 * §10.7.5 evolution sequence (amended 2026-10-05; `stage/evolution.ts`), node, no GPU:
 * - the state machine's timing (phase spans, phase entries through the stage's frame hook);
 * - WCAG 2.3.1: the silhouette swaps never exceed 3 Hz, and no 1 s window holds more than 3 flashes (6 opposing
 *   luminance changes), the burst included;
 * - effective reduced effects: a gentle cross-fade — no swap, no burst light, no flash, no shake, no ring cards;
 * - the atlas gate (the swap waits for the new form's bind), skip (→ reveal, → exit), cancel (a battle's `dress`);
 * - the cleanup restores the camera, the borrowed beacon light, the post uniforms, the ground-cover / prop-cutaway
 *   slots and the sprite pool's bindings exactly; no light is added (the light set never changes).
 */
import { describe, expect, it, vi } from 'vitest';
import { Group, NearestFilter, PerspectiveCamera, PointLight, SpotLight, Texture } from 'three/webgpu';
import type { Object3D, UniformNode } from 'three/webgpu';
import { uniform } from 'three/tsl';
import { ALL_EFFECTS, applyReducedEffects } from '../src/index.js';
import type { EffectsFlags } from '../src/descriptors.js';
import { createMaterialLibraryWith } from '../src/materials/library.js';
import { DioramaRig } from '../src/camera/rig.js';
import { BillboardPool } from '../src/sprites/billboard.js';
import { neutralAtlasTextures, stampAtlasTexture } from '../src/sprites/atlas.js';
import type { AtlasDecoder, AtlasSet } from '../src/sprites/atlas.js';
import { VfxSystem } from '../src/stage/vfx.js';
import { CharacterPool } from '../src/stage/actors.js';
import { Stage } from '../src/stage/battleStage.js';
import {
  EVOLUTION, EVOLUTION_TIMELINE, alternationHz, createEvolutionSample, evolutionDurationMs, evolutionPhaseAt, evolutionRecipes, sampleEvolution, spotScore,
  type EvolutionSample,
} from '../src/stage/evolution.js';
import type { EvolutionPhase, SpriteDescriptor } from '../src/contracts.js';

// ---- pure timeline ---------------------------------------------------------------------------------------------

/** A luminance proxy of the creature (the white silhouettes' glow × their area, the new form being larger) + the light. */
function luminance(s: EvolutionSample): number {
  const areaOld = 1; const areaNew = 1.6;
  const o = s.oldShown ? (0.25 + 0.75 * s.glowOld) * areaOld * (1 - s.oldDissolve) : 0;
  const n = s.newShown ? (0.25 + 0.75 * s.glowNew) * areaNew * (1 - s.newDissolve) : 0;
  return o + n + 0.25 * s.light;
}

/**
 * WCAG-style change detector: walks the signal and records a "change" each time it moves ≥ `threshold` away from the
 * last extreme in the direction opposite to the previous change. Returns the change times (ms).
 */
function opposingChanges(signal: readonly number[], threshold: number): number[] {
  const out: number[] = [];
  let ext = signal[0]!; let dir = 0;
  for (let t = 1; t < signal.length; t++) {
    const v = signal[t]!;
    if (dir >= 0 && v > ext) ext = v;
    if (dir <= 0 && v < ext) ext = v;
    if (dir <= 0 && v - ext >= threshold) { out.push(t); dir = 1; ext = v; }
    else if (dir >= 0 && ext - v >= threshold) { out.push(t); dir = -1; ext = v; }
  }
  return out;
}

function maxInWindow(times: readonly number[], windowMs: number): number {
  let best = 0; let j = 0;
  for (let i = 0; i < times.length; i++) {
    while (times[i]! - times[j]! >= windowMs) j++;
    best = Math.max(best, i - j + 1);
  }
  return best;
}

function sampleAll(reduced: boolean): EvolutionSample[] {
  const out: EvolutionSample[] = [];
  const n = evolutionDurationMs(reduced) + 50;
  for (let t = 0; t <= n; t++) out.push({ ...sampleEvolution(t, reduced, createEvolutionSample()) });
  return out;
}

describe('§10.7.5 evolution sequence — timeline', () => {
  it('phase spans: full 9.5 s (stage · charge · alternate · peak · reveal · hold · exit), reduced 7.1 s (fade replaces the build-up)', () => {
    expect(EVOLUTION_TIMELINE.full.map((s) => s.phase)).toEqual(['stage', 'charge', 'alternate', 'peak', 'reveal', 'hold', 'exit']);
    expect(EVOLUTION_TIMELINE.reduced.map((s) => s.phase)).toEqual(['stage', 'fade', 'reveal', 'hold', 'exit']);
    expect(evolutionDurationMs(false)).toBe(9500);
    expect(evolutionDurationMs(true)).toBe(7100);
    for (const tl of [EVOLUTION_TIMELINE.full, EVOLUTION_TIMELINE.reduced]) {
      for (let i = 1; i < tl.length; i++) expect(tl[i]!.start).toBe(tl[i - 1]!.end);   // contiguous
    }
    expect(evolutionPhaseAt(false, 'reveal')!.start).toBe(6100);
    expect(evolutionPhaseAt(true, 'reveal')!.start).toBe(3700);
    const s = createEvolutionSample();
    expect(sampleEvolution(0, false, s).phase).toBe('stage');
    expect(sampleEvolution(1099.9, false, s).phase).toBe('stage');
    expect(sampleEvolution(1100, false, s).phase).toBe('charge');
    expect(sampleEvolution(6100, false, s).phase).toBe('reveal');
    expect(sampleEvolution(9500, false, s).phase).toBe('done');
    expect(sampleEvolution(Number.NaN, false, s).phase).toBe('stage');
  });

  it('WCAG 2.3.1: the alternation never exceeds 3 Hz, swaps are ≥ 1/6 s apart, and no 1 s window holds more than 3 flashes', () => {
    for (let tau = 0; tau <= EVOLUTION.alternateMs; tau += 1) expect(alternationHz(tau)).toBeLessThanOrEqual(3);
    const all = sampleAll(false);
    let maxHz = 0;
    for (const s of all) maxHz = Math.max(maxHz, s.pulseHz);
    expect(maxHz).toBeGreaterThan(2);                    // it does accelerate (slow → fast)
    expect(maxHz).toBeLessThanOrEqual(EVOLUTION.pulseHzMax);
    // every silhouette swap (old ↔ new shown) — each is one luminance change (the forms differ in area)
    const swaps: number[] = [];
    for (let t = 1; t < all.length; t++) if (all[t]!.newShown !== all[t - 1]!.newShown || all[t]!.oldShown !== all[t - 1]!.oldShown) swaps.push(t);
    expect(swaps.length).toBeGreaterThan(8);              // a real build-up
    for (let i = 1; i < swaps.length; i++) expect(swaps[i]! - swaps[i - 1]!).toBeGreaterThanOrEqual(1000 / 6 - 1);
    expect(maxInWindow(swaps, 1000)).toBeLessThanOrEqual(6);
    // the full luminance proxy (glow, swaps, the burst light): ≤ 6 opposing changes of ≥ 10 % of its range per second
    const lum = all.map(luminance);
    const range = Math.max(...lum) - Math.min(...lum);
    const changes = opposingChanges(lum, 0.1 * range);
    expect(maxInWindow(changes, 1000)).toBeLessThanOrEqual(6);
    // and the gap before the burst: the peak holds the new silhouette still
    const peak = evolutionPhaseAt(false, 'peak')!;
    for (let t = peak.start; t < peak.end; t++) { expect(all[t]!.newShown).toBe(true); expect(all[t]!.oldShown).toBe(false); }
  });

  it('reduced effects: one gentle cross-fade — no swap, no burst light, no flash at any moment', () => {
    const all = sampleAll(true);
    expect(all.some((s) => s.phase === 'alternate' || s.phase === 'charge' || s.phase === 'peak')).toBe(false);
    // each form is shown over one contiguous span (old fades out once, new fades in once)
    const runs = (k: 'oldShown' | 'newShown'): number => { let n = 0; for (let t = 0; t < all.length; t++) if (all[t]![k] && (t === 0 || !all[t - 1]![k])) n++; return n; };
    expect(runs('oldShown')).toBe(1);
    expect(runs('newShown')).toBe(1);
    for (const s of all) {
      expect(s.pulseHz).toBe(0);
      expect(s.light).toBeLessThanOrEqual(EVOLUTION.lightCharge + 1e-9);   // no burst spike
      expect(Math.max(s.glowOld, s.glowNew)).toBeLessThanOrEqual(EVOLUTION.reducedGlow + 1e-9);
    }
    // no pair of opposing changes inside any 1 s window (that would be a flash)
    const lum = all.map(luminance);
    const changes = opposingChanges(lum, 0.1 * (Math.max(...lum) - Math.min(...lum)));
    expect(maxInWindow(changes, 1000)).toBeLessThanOrEqual(1);
    // the reduced effects carry no burst and no ring cards
    const r = evolutionRecipes('Grass', true);
    expect(r.converge).toBeNull();
    for (const ph of [...r.motes.phases, ...r.burst.phases]) { expect(ph.shape).not.toBe('ring'); expect(ph.motion).not.toBe('burst'); }
    const full = evolutionRecipes('Grass', false);
    expect(full.burst.phases.some((p) => p.motion === 'burst')).toBe(true);
    for (const rec of [full.motes, full.converge!, full.burst, r.motes, r.burst]) for (const p of rec.phases) expect(p.count).toBeLessThanOrEqual(512);
  });

  it('no program at sequence time: the warm-up billboard neutral set samples like the atlases (filterable)', () => {
    // three's WGSL builder treats Nearest min + mag as unfilterable (textureLoad): a different billboard program from
    // the atlases' (Nearest mag, trilinear min) — the first creature drawn, or a sequence, compiled it (Part 7 E6)
    const unfilterable = (t: Texture): boolean => t.minFilter === NearestFilter && t.magFilter === NearestFilter;
    const n = neutralAtlasTextures();
    for (const t of [n.albedo, n.normal, n.emissive]) expect(unfilterable(t)).toBe(false);
    const a = stampAtlasTexture(new Texture(), 'albedo');
    expect(unfilterable(a)).toBe(false);
    expect(n.albedo.magFilter).toBe(a.magFilter);
  });

  it('spot choice: footprints under the creature or between it and the camera push it to the next candidate', () => {
    expect(spotScore(0, 0, 0, 1, null, null)).toBe(0);
    const wall = (x: number, z: number): boolean => z > 1 && z < 2 && Math.abs(x) < 3;   // between the spot and the camera (+z)
    expect(spotScore(0, 0, 0, 1, wall, null)).toBeGreaterThan(0);
    expect(spotScore(5, 0, 0, 1, wall, null)).toBe(0);
    expect(spotScore(0, 0, 0, 1, null, () => false)).toBeGreaterThanOrEqual(100);
  });
});

// ---- the runtime on a stage ---------------------------------------------------------------------------------------

function fakeDecoder(): AtlasDecoder {
  return { decode: async (_url, crop) => ({ width: crop ? crop[2] : 2048, height: crop ? crop[3] : 2048, close: () => {} }) };
}
function fakeSet(id: string): AtlasSet {
  const m = (k: string) => ({ url: `/c/${id}.${k}.webp`, mips: ['1', '2', '3'].map((i) => `/c/${id}.${k}.m${i}.webp`) });
  return { id, albedo: m('albedo'), normal: m('normal'), emissive: m('emissive'), size: 2048, normalScale: 0.5 };
}
function desc(id: string, atlas: string, sizeScale = 1): SpriteDescriptor {
  const f = (x: number) => ({ atlas, rect: [x, 0.5, x + 0.5, 1] as const, px: [x * 2048, 0, 1024, 1024] as const, footV: 0.08, aspect: 1 });
  return { id, front: f(0.5), back: f(0), sizeScale, types: ['Grass'], variant: 'normal', isAlpha: false };
}

interface Fixture {
  stage: Stage; rig: DioramaRig; cam: PerspectiveCamera; sprites: BillboardPool; vfx: VfxSystem; actors: CharacterPool; scene: Group;
  post: { exposure: UniformNode<'float', number>; vignette: UniformNode<'float', number> };
  cover: { set: ReturnType<typeof vi.fn>; clear: ReturnType<typeof vi.fn>; active: Set<number> };
  cut: { hide: ReturnType<typeof vi.fn>; restore: ReturnType<typeof vi.fn>; active: Set<number> };
  frame(ms?: number): void;
  effects: { current: EffectsFlags };
}

async function makeFixture(bindTo = true): Promise<Fixture> {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const lib = createMaterialLibraryWith({ baseUrl: '/m/', source: { load: async () => new Texture() }, fetchJson: async () => { throw new Error('none'); } });
  await lib.ready;
  const scene = new Group();
  const cam = new PerspectiveCamera(28, 16 / 9, 0.5, 220);
  const sprites = new BillboardPool({ decoder: fakeDecoder(), camera: cam });
  await sprites.bindAtlas(fakeSet('a-000'));
  if (bindTo) await sprites.bindAtlas(fakeSet('a-001'));
  const vfx = new VfxSystem();
  const actors = new CharacterPool({ harvestLevel: lib.uniforms.harvestLevel, camera: cam, viewport: () => ({ w: 1280, h: 720 }) });
  scene.add(actors.root);
  const effects = { current: ALL_EFFECTS };
  const rig = new DioramaRig(cam, { effects: () => effects.current, feet: (id, out) => actors.feetOf(id, out) });
  const post = { exposure: uniform(1), vignette: uniform(0.22) };
  const stage = new Stage({
    parent: scene, sprites, vfx, rig, actors, materials: lib, effects: () => effects.current, harvestLevel: () => 0, camera: cam,
    viewport: () => ({ w: 1280, h: 720 }), post,
  });
  const coverActive = new Set<number>(); const cutActive = new Set<number>();
  const cover = {
    set: vi.fn((slot: number) => { coverActive.add(slot); }), clear: vi.fn((slot: number) => { coverActive.delete(slot); }), active: coverActive,
  };
  const cut = { hide: vi.fn((slot: number) => { cutActive.add(slot); }), restore: vi.fn((slot: number) => { cutActive.delete(slot); }), active: cutActive };
  stage.setGroundCover(cover, cut);
  actors.spawn('me', { look: 'ranger_m', name: 'Rowan', guildTag: '', isLocal: true });
  actors.setTransform('me', 4, -3, 0, false, false);
  rig.follow('me');
  // the host's order: camera, then the hooks (sprites, VFX, actors, stage) — real and scaled dt alike here
  const frame = (ms = 1000 / 60): void => { rig.update(ms); sprites.update(ms); vfx.update(ms, cam); actors.update(ms); stage.update(ms, ms); };
  for (let i = 0; i < 30; i++) frame();
  return { stage, rig, cam, sprites, vfx, actors, scene, post, cover, cut, frame, effects };
}

function lights(root: Object3D): (SpotLight | PointLight)[] {
  const out: (SpotLight | PointLight)[] = [];
  root.traverse((o) => { if (o instanceof SpotLight || o instanceof PointLight) out.push(o); });
  return out;
}

function snapshotLight(L: SpotLight): unknown {
  return {
    p: L.position.toArray(), t: L.target.position.toArray(), c: L.color.toArray(), i: L.intensity, a: L.angle, pe: L.penumbra, d: L.distance, de: L.decay,
  };
}

const usersOf = (sprites: BillboardPool, key: string): number => (sprites as unknown as { cache: { users(k: string): number } }).cache.users(key);

describe('§10.7.5 evolution sequence — runtime on the stage', () => {
  it('plays every phase in order on time, then restores camera, beacon, post, site and bindings exactly', async () => {
    const f = await makeFixture();
    const { stage, rig, cam, sprites, scene, post, cover, cut } = f;
    const L = stage.beaconLights[0]!;
    const lightIds = lights(scene).map((l) => l.uuid);
    const lightBefore = snapshotLight(L);
    const camBefore = cam.position.clone();
    const liveBefore = sprites.stats().live;
    const usersBefore = [usersOf(sprites, 'a-000'), usersOf(sprites, 'a-001')];
    const phases: { phase: EvolutionPhase; at: number }[] = [];
    let clock = 0;
    const h = stage.evolve({
      from: desc('evo:old', 'a-000', 0.8), to: desc('evo:new', 'a-001', 1.1), at: { x: 4, z: -3 }, reduced: false, cheer: 'me',
      onPhase: (p) => phases.push({ phase: p, at: clock }),
    });
    expect(stage.evolution).not.toBeNull();
    expect(rig.currentMode).toBe('inspect');
    expect(sprites.stats().live).toBe(liveBefore + 2);
    expect(lights(scene).map((l) => l.uuid)).toEqual(lightIds);      // the light set never changes
    let sawDim = false; let sawLight = false; let sawSite = false; let cheered = false; let sawGlow = false;
    const shake = vi.spyOn(rig, 'shake');
    const dt = 1000 / 60;
    for (let i = 0; i < 700 && h.phase !== 'done'; i++) {
      f.frame(dt); clock += dt;
      if (post.exposure.value < 0.8) sawDim = true;
      if (L.intensity > 0) { sawLight = true; expect(L.castShadow).toBe(false); }
      if (cover.active.has(0) && cut.active.has(0)) sawSite = true;
      if (f.actors.emoteOf('me').n === 2) cheered = true;
      const e = stage.evolution;
      if (e !== null && e.newForm.userDataRecord.glow > 0.9) sawGlow = true;
    }
    expect(await h.done).toBe('done');
    expect(phases.map((p) => p.phase)).toEqual(['stage', 'charge', 'alternate', 'peak', 'reveal', 'hold', 'exit', 'done']);
    for (const p of phases) {
      if (p.phase === 'stage') continue;
      const span = p.phase === 'done' ? { start: evolutionDurationMs(false) } : evolutionPhaseAt(false, p.phase)!;
      expect(Math.abs(p.at - span.start)).toBeLessThanOrEqual(dt + 1e-6);   // on time (one frame)
    }
    expect(sawDim && sawLight && sawSite && cheered && sawGlow).toBe(true);
    expect(shake).toHaveBeenCalledWith(EVOLUTION.shakeAmp, EVOLUTION.shakeMs);
    // cleanup: bindings, beacon, post, site; the camera back on the diorama pose
    expect(stage.evolution).toBeNull();
    expect(sprites.stats().live).toBe(liveBefore);
    expect([usersOf(sprites, 'a-000'), usersOf(sprites, 'a-001')]).toEqual(usersBefore);
    for (let i = 0; i < 60; i++) f.frame(dt);
    expect(snapshotLight(L)).toEqual(lightBefore);
    expect(post.exposure.value).toBe(1);
    expect(post.vignette.value).toBe(0.22);
    expect(cover.active.size).toBe(0);
    expect(cut.active.size).toBe(0);
    expect(rig.currentMode).toBe('diorama');
    expect(rig.shotBlend).toBe(0);
    expect(cam.position.distanceTo(camBefore)).toBeLessThan(1e-6);
    expect(lights(scene).map((l) => l.uuid)).toEqual(lightIds);
  });

  it('the swap waits for the new form\'s atlas; past the wait it goes straight to the reveal', async () => {
    const f = await makeFixture(false);
    const h = f.stage.evolve({ from: desc('o', 'a-000'), to: desc('n', 'a-001'), reduced: false });
    for (let i = 0; i < 120; i++) f.frame();                     // 2 s: the stage would have ended at 1.1 s
    expect(h.phase).toBe('stage');
    expect(f.stage.evolution!.clock).toBeLessThan(EVOLUTION.stageMs);
    await f.sprites.bindAtlas(fakeSet('a-001'));
    f.frame();
    expect(h.phase).toBe('charge');
    h.cancel();
    expect(await h.done).toBe('cancelled');
    // never bound: after the wait the sequence reveals (the new form shows when its bind lands)
    const g = await makeFixture(false);
    const h2 = g.stage.evolve({ from: desc('o', 'a-000'), to: desc('n', 'a-002'), reduced: false });
    for (let i = 0; i < Math.ceil((EVOLUTION.stageMs + EVOLUTION.bindWaitMaxMs) / (1000 / 60)) + 2; i++) g.frame();
    expect(h2.phase).toBe('reveal');
  });

  it('skip: before the reveal → the reveal (burst once), during the hold → the exit; skipping ends early', async () => {
    const f = await makeFixture();
    const phases: EvolutionPhase[] = [];
    const h = f.stage.evolve({ from: desc('o', 'a-000'), to: desc('n', 'a-001'), reduced: false, onPhase: (p) => phases.push(p) });
    for (let i = 0; i < 90; i++) f.frame();                      // into the charge
    expect(h.phase).toBe('charge');
    h.skip();
    expect(h.phase).toBe('reveal');
    expect(phases).toEqual(['stage', 'charge', 'reveal']);       // the build-up's own events never run
    const e = f.stage.evolution!;
    expect(e.oldForm.object.visible).toBe(false);
    expect(e.newForm.object.visible).toBe(true);
    for (let i = 0; i < 70; i++) f.frame();                      // into the hold
    expect(h.phase).toBe('hold');
    h.skip();
    expect(h.phase).toBe('exit');
    for (let i = 0; i < 60; i++) f.frame();
    expect(await h.done).toBe('done');
    expect(f.rig.currentMode).toBe('diorama');
  });

  it('reduced effects: the cross-fade shows both forms dithered, never shakes, never spikes the light', async () => {
    const f = await makeFixture();
    f.effects.current = applyReducedEffects(ALL_EFFECTS);
    const shake = vi.spyOn(f.rig, 'shake');
    const h = f.stage.evolve({ from: desc('o', 'a-000'), to: desc('n', 'a-001'), reduced: true });
    const L = f.stage.beaconLights[0]!;
    let both = false; let maxLight = 0;
    for (let i = 0; i < 600 && h.phase !== 'done'; i++) {
      f.frame();
      const e = f.stage.evolution;
      if (e !== null && e.oldForm.object.visible && e.newForm.object.visible) both = true;
      maxLight = Math.max(maxLight, L.intensity);
    }
    expect(await h.done).toBe('done');
    expect(both).toBe(true);
    expect(shake).not.toHaveBeenCalled();
    expect(maxLight).toBeLessThanOrEqual(EVOLUTION.lightIntensity * EVOLUTION.lightCharge + 1e-6);
  });

  it('a battle (dress) cancels it: the camera stays the battle\'s, everything borrowed is given back', async () => {
    const f = await makeFixture();
    const L = f.stage.beaconLights[0]!;
    const before = snapshotLight(L);
    const h = f.stage.evolve({ from: desc('o', 'a-000'), to: desc('n', 'a-001'), reduced: false });
    for (let i = 0; i < 200; i++) f.frame();
    expect(h.phase).toBe('alternate');
    f.rig.pushIn({ x: 4, z: -3 }, 600);                          // SceneDirector.enterBattle: push-in, then dress
    f.stage.dress({ x: 4, z: -3 }, 'grove', ['me']);
    expect(await h.done).toBe('cancelled');
    expect(f.stage.evolution).toBeNull();
    expect(f.rig.currentMode).toBe('battle');
    expect(f.post.exposure.value).toBe(1);
    expect(f.sprites.stats().live).toBe(0);
    f.stage.undress(1);
    for (let i = 0; i < 60; i++) f.frame();
    const after = snapshotLight(L) as Record<string, unknown>;
    const b = before as Record<string, unknown>;
    // the battle moved the beacon (its own placement); the evolution's own settings are gone
    expect(after.a).toBe(b.a); expect(after.pe).toBe(b.pe); expect(after.d).toBe(b.d);
    expect(after.i).toBe(0);
    // a second evolve after the battle starts cleanly; evolve() also cancels a running one
    const h2 = f.stage.evolve({ from: desc('o', 'a-000'), to: desc('n', 'a-001'), reduced: false });
    const h3 = f.stage.evolve({ from: desc('o', 'a-000'), to: desc('n', 'a-001'), reduced: true });
    expect(await h2.done).toBe('cancelled');
    h3.cancel();
    expect(await h3.done).toBe('cancelled');
    expect(f.sprites.stats().live).toBe(0);
  });
});
