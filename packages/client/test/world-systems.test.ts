/**
 * Phase D8–D11 on the client:
 *   - D9 `FishingController`: a press inside the '!' window lands the catch, a press while waiting is early, no press
 *     is late; the window is longer under reduced motion; cancel drops everything; `waterAhead` finds the cast point;
 *   - D8 `StepCollider.setSurf`: prediction steps off a pier onto open water only in surf mode and floats on the level;
 *   - D10 `StepCollider.setObstacles`: a cleared obstacle's stamped samples are passable again, for that id only;
 *     `SceneDirector` offers 'Cut the small tree' until the flag arrives, then swaps the prop and re-opens the disc;
 *   - D11 bike: the controller rides at bike speed, flags every ridden window `bike: true`, replays ridden steps;
 *     the bike key is bindable (KeyV by default) and labelled.
 */
import { describe, expect, it } from 'vitest';
import { getHeightfield, obstacleAt, obstacleFlag, zone } from '@ewa/content';
import { MOVEMENT, maxStep } from '@ewa/protocol';
import { TerrainCollider } from '@ewa/render';
import type { ObstaclesHandle, Renderer, ZoneHandle, ZoneSpec } from '@ewa/render';
import { createAudioDirector } from '../src/audio/AudioDirector';
import { createStepCollider } from '../src/scene/collider';
import type { StepCollider } from '../src/scene/collider';
import { FISHING, FishingController, waterAhead } from '../src/scene/fishing';
import type { FishingPhase } from '../src/scene/fishing';
import { HudWriter } from '../src/scene/HudWriter';
import { HELD } from '../src/scene/input';
import { InteractionTargets } from '../src/scene/interaction';
import { LocalPlayerController } from '../src/scene/LocalPlayerController';
import type { InputPayload } from '../src/scene/LocalPlayerController';
import { createSceneDirector } from '../src/scene/SceneDirector';
import { ACTION_LABEL } from '../src/screens/SettingsScreen';
import { DEFAULT_KEYBINDS } from '../src/state/settings';

// ─── D9 fishing prompt ───────────────────────────────────────────────────────

function fishingHarness(reduced = false) {
  let now = 0;
  const timers: { at: number; fn: () => void; id: number }[] = [];
  let next = 1;
  const phases: FishingPhase[] = [];
  const events: string[] = [];
  const c = new FishingController({
    setTimer: (fn, ms) => {
      const id = next++;
      timers.push({ at: now + ms, fn, id });
      return id;
    },
    clearTimer: (h) => {
      const i = timers.findIndex((t) => t.id === h);
      if (i >= 0) timers.splice(i, 1);
    },
    random: () => 0.5,
    reduced: () => reduced,
    onPhase: (p) => phases.push(p),
    onCatch: () => events.push('catch'),
    onMiss: (w) => events.push(`miss ${w}`),
  });
  const advance = (ms: number): void => {
    const until = now + ms;
    for (;;) {
      timers.sort((a, b) => a.at - b.at);
      const t = timers[0];
      if (t === undefined || t.at > until) break;
      timers.shift();
      now = t.at;
      t.fn();
    }
    now = until;
  };
  return { c, phases, events, advance };
}

const WAIT = FISHING.waitMinMs + Math.floor(0.5 * (FISHING.waitMaxMs - FISHING.waitMinMs));

describe('Phase D9 FishingController', () => {
  it('a press inside the window lands the catch', () => {
    const h = fishingHarness();
    expect(h.c.start()).toBe(true);
    expect(h.c.start()).toBe(false); // one cast at a time
    expect(h.c.phase).toBe('waiting');
    h.advance(WAIT - 1);
    expect(h.c.phase).toBe('waiting');
    h.advance(1);
    expect(h.c.phase).toBe('bite');
    h.advance(FISHING.biteMs - 50);
    h.c.press();
    expect(h.events).toEqual(['catch']);
    expect(h.c.phase).toBe('idle');
    expect(h.phases).toEqual(['waiting', 'bite', 'idle']);
  });

  it('too early, too late, then idle again; the window is longer under reduced motion', () => {
    const early = fishingHarness();
    early.c.start();
    early.advance(300);
    early.c.press();
    expect(early.events).toEqual(['miss early']);
    expect(early.c.phase).toBe('missed');
    early.advance(FISHING.missedMs);
    expect(early.c.phase).toBe('idle');

    const late = fishingHarness();
    late.c.start();
    late.advance(WAIT + FISHING.biteMs);
    expect(late.events).toEqual(['miss late']);
    late.c.press(); // pressing on the 'missed' card does nothing
    expect(late.events).toEqual(['miss late']);

    const slow = fishingHarness(true);
    slow.c.start();
    slow.advance(WAIT + FISHING.biteMs + 100);
    expect(slow.c.phase).toBe('bite');
    slow.c.press();
    expect(slow.events).toEqual(['catch']);
    expect(FISHING.reducedBiteMs).toBeGreaterThan(FISHING.biteMs);
  });

  it('cancel drops the cast silently', () => {
    const h = fishingHarness();
    h.c.start();
    h.advance(WAIT + 10);
    h.c.cancel();
    expect(h.c.phase).toBe('idle');
    h.advance(10_000);
    expect(h.events).toEqual([]);
  });

  it('waterAhead: the first water sample along the heading within reach', () => {
    const water = (x: number, _z: number): boolean => x >= 2;
    expect(waterAhead(water, 0, 0, Math.PI / 2, 2.5)).toEqual({ x: 2, z: expect.closeTo(0, 9) });
    expect(waterAhead(water, 0, 0, -Math.PI / 2, 2.5)).toBeNull();
    expect(waterAhead(water, 0, 0, Math.PI / 2, 1.5)).toBeNull();
  });
});

// ─── D8 surf prediction ──────────────────────────────────────────────────────

function pier(c: TerrainCollider): { x: number; z: number } {
  const h = c.heightfield;
  for (let row = 0; row < h.res; row++) {
    for (let col = 0; col < h.res; col++) {
      const i = row * h.res + col;
      if (h.walkable[i] !== 1 || h.water[i] !== 1) continue;
      const x = h.originX + col * h.step;
      const z = h.originZ + row * h.step;
      if (c.onWater(x, z + 2.5) && c.onWater(x, z + 3.5)) return { x, z };
    }
  }
  throw new Error('no pier');
}

function stepTo(c: StepCollider, x0: number, z0: number, x1: number, z1: number): { x: number; z: number } {
  const pose = { x: x1, z: z1, angle: 0, vx: 0, vz: 0 };
  c.begin(x0, z0);
  c.resolve(pose, MOVEMENT.radius);
  return { x: pose.x, z: pose.z };
}

describe('Phase D8 surf prediction (StepCollider)', () => {
  it('steps off the pier onto open water only in surf mode, floating on the level', () => {
    const terrain = new TerrainCollider(getHeightfield('mire_route'));
    const c = createStepCollider(terrain);
    const p = pier(terrain);
    let z = p.z;
    while (terrain.walkable(p.x, z + 0.25)) z += 0.25;
    const dry = stepTo(c, p.x, z, p.x, z + 0.3);
    expect(terrain.onWater(dry.x, dry.z)).toBe(false);
    expect(c.surfing).toBe(false);
    c.setSurf(true);
    expect(c.surfing).toBe(true);
    const wet = stepTo(c, p.x, z, p.x, z + 0.3);
    expect(wet.z).toBeCloseTo(z + 0.3, 9);
    expect(c.onWater(wet.x, wet.z)).toBe(true);
    expect(c.passable(wet.x, wet.z)).toBe(true);
    expect(c.height(wet.x, wet.z)).toBeCloseTo(terrain.surfaceY(wet.x, wet.z), 9);
    expect(c.height(wet.x, wet.z)).toBeGreaterThanOrEqual(terrain.sample(wet.x, wet.z));
    // out over the pond the surface is the level, above the bowl
    expect(c.height(p.x, p.z + 3)).toBeGreaterThan(terrain.sample(p.x, p.z + 3));
    c.setSurf(false);
    expect(c.passable(wet.x, wet.z)).toBe(false);
  });
});

// ─── D10 obstacles ───────────────────────────────────────────────────────────

const MIRE = zone('mire_route');
const THICKET = MIRE.obstacles!.find((o) => o.id === 'mire_route.thicket')!;

describe('Phase D10 obstacles on the client', () => {
  it('a cleared obstacle re-opens exactly its stamped samples for prediction', () => {
    const h = getHeightfield('mire_route');
    const terrain = new TerrainCollider(h);
    const c = createStepCollider(terrain);
    const lookup = (x: number, z: number): string | null => obstacleAt(h, x, z);
    expect(c.passable(THICKET.x, THICKET.z)).toBe(false);
    c.setObstacles(lookup, new Set(['mire_route.other']));
    expect(c.passable(THICKET.x, THICKET.z)).toBe(false);
    c.setObstacles(lookup, new Set([THICKET.id]));
    expect(c.passable(THICKET.x, THICKET.z)).toBe(true);
    const r = 1.6;
    const through = stepTo(c, THICKET.x - 0.3, THICKET.z, THICKET.x + 0.05, THICKET.z);
    expect(through.x).toBeCloseTo(THICKET.x + 0.05, 9);
    c.setObstacles(null, new Set());
    expect(c.passable(THICKET.x, THICKET.z)).toBe(false);
    expect(c.passable(THICKET.x - r, THICKET.z)).toBe(true);
  });

  it('SceneDirector: Cut the small tree until the flag; then the prop swaps and the collider re-opens it', async () => {
    const cleared = new Map<string, boolean>();
    const handle: ObstaclesHandle = { ids: [THICKET.id], setCleared: (id, on) => void cleared.set(id, on), isCleared: (id) => cleared.get(id) === true };
    const r = {
      loadZone: async (spec: ZoneSpec): Promise<ZoneHandle> => ({
        id: spec.id, group: {} as ZoneHandle['group'], collider: { blocked: () => false, sample: () => 0 } as unknown as ZoneHandle['collider'],
        bounds: { minX: -104, maxX: 104, minZ: -104, maxZ: 104 }, geometryDigest: '00000000', stats: () => ({}) as ReturnType<ZoneHandle['stats']>,
        obstacles: handle, dispose: () => undefined,
      }),
      actors: { spawn: () => undefined, setTransform: () => undefined, despawn: () => undefined },
      camera: { headingIndex: 0, setHeading: () => undefined, pushIn: () => undefined, release: () => undefined },
      stage: { dress: () => undefined, undress: () => undefined },
      setWeather: () => undefined, setTimeOfDay: () => undefined, setHarvestLevel: () => undefined,
    } as unknown as Renderer;
    const sink: { lookup: ((x: number, z: number) => string | null) | null; cleared: ReadonlySet<string> }[] = [];
    let flags = new Set<string>();
    const prompts: unknown[] = [];
    const targets = new InteractionTargets((p) => prompts.push(p));
    const d = createSceneDirector({
      renderer: r, hud: new HudWriter(null), audio: createAudioDirector({ createContext: () => null }), targets, selfId: () => 'me',
      flags: () => flags, interactKey: () => 'E', onZone: () => undefined, setInputEnabled: () => undefined, setAccentType: () => undefined,
      reducedMotion: () => false, obstacles: () => ({ setObstacles: (lookup, ids) => void sink.push({ lookup, cleared: ids }) }),
    });
    await d.loadZone('mire_route', 'intact');
    const e = targets.staticEntries().find((x) => x.kind === 'obstacle' && x.id === THICKET.id)!;
    expect(e).toMatchObject({ x: THICKET.x, z: THICKET.z, enabled: true });
    targets.step(THICKET.x - 1.6, THICKET.z, false);
    expect(prompts.at(-1)).toEqual({ key: 'E', verb: 'Cut', target: 'the small tree' });
    expect(cleared.get(THICKET.id)).toBe(false);
    expect(sink.at(-1)!.cleared.size).toBe(0);
    flags = new Set([obstacleFlag('mire_route', THICKET.id)]);
    d.refreshFlags(flags);
    expect(e.enabled).toBe(false);
    expect(cleared.get(THICKET.id)).toBe(true);
    const last = sink.at(-1)!;
    expect([...last.cleared]).toEqual([THICKET.id]);
    expect(last.lookup!(THICKET.x, THICKET.z)).toBe(THICKET.id);
    const n = sink.length;
    d.refreshFlags(new Set(flags)); // no change: nothing pushed again
    expect(sink.length).toBe(n);
    d.unloadZone();
  });
});

// ─── D11 bike ────────────────────────────────────────────────────────────────

describe('Phase D11 bike (LocalPlayerController)', () => {
  const open = { terrain: null, begin() {}, resolve() {}, height: () => 0 } as unknown as StepCollider;
  function controller() {
    const held = new Uint8Array(5);
    const sent: InputPayload[] = [];
    const c = new LocalPlayerController({ held, cameraYaw: () => 0, blocked: () => false, send: (p) => sent.push({ ...p }) });
    c.setCollider(open);
    c.reconcile(0, 0, 0, 0);
    return { c, held, sent };
  }

  it('rides at bike speed and flags every ridden window; on foot the flag is false', () => {
    const { c, held, sent } = controller();
    held[HELD.forward] = 1;
    c.setBike(true);
    expect(c.biking).toBe(true);
    for (let i = 0; i < 120; i++) {
      c.sample();
      c.step(MOVEMENT.stepMs);
    }
    expect(Math.hypot(c.pose.vx, c.pose.vz)).toBeCloseTo(MOVEMENT.bikeSpeed, 6);
    const ridden = sent.slice(-5);
    for (const m of ridden) expect(m.bike).toBe(true);
    // consecutive messages stay under the bike cap and over the run cap
    const a = sent.at(-2)!;
    const b = sent.at(-1)!;
    const dist = Math.hypot(b.x - a.x, b.z - a.z);
    expect(dist).toBeLessThanOrEqual(maxStep(false, b.dtMs, true));
    expect(dist).toBeGreaterThan(maxStep(true, b.dtMs));
    c.setBike(false);
    for (let i = 0; i < 30; i++) {
      c.sample();
      c.step(MOVEMENT.stepMs);
    }
    expect(sent.at(-1)!.bike).toBe(false);
  });

  it('a correction replays unsent ridden steps at bike speed', () => {
    const { c, held, sent } = controller();
    held[HELD.forward] = 1;
    c.setBike(true);
    for (let i = 0; i < 60; i++) {
      c.sample();
      c.step(MOVEMENT.stepMs);
    }
    const ack = sent.at(-3)!;
    // the server put the player 0.5 m aside of the acked pose: rebase + replay (bike speed kept)
    c.reconcile(ack.x + 0.5, ack.z, ack.angle, ack.seq);
    for (let i = 0; i < 6; i++) {
      c.sample();
      c.step(MOVEMENT.stepMs);
    }
    expect(Math.hypot(c.pose.vx, c.pose.vz)).toBeCloseTo(MOVEMENT.bikeSpeed, 6);
    expect(sent.at(-1)!.bike).toBe(true);
  });

  it('the bike key: KeyV by default, labelled in Controls, free of conflicts', () => {
    expect(DEFAULT_KEYBINDS.bike).toEqual(['KeyV']);
    expect(ACTION_LABEL.bike).toMatch(/bicycle/i);
    const all = Object.values(DEFAULT_KEYBINDS).flat();
    expect(all.filter((k) => k === 'KeyV')).toHaveLength(1);
  });
});
