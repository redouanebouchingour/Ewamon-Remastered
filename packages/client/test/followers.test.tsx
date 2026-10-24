// @vitest-environment jsdom
/**
 * Followers with field powers on the client (SPEC §3.18, §20.4.8):
 *   - the glide in prediction: a step toward a drop asks the glider, the controller glides along the plan whatever the
 *     keys say (gait 3), every message of the window carries the take-off, it lands and walks on; a replay glides; a
 *     correction off the glide line ends it and rests take-offs;
 *   - `FollowerViews`: the player's own follower holds its atlas (both sides); another trainer's shows at once when its
 *     atlas is bound, takes a front-only single otherwise, and none at all past the singles (the fallback);
 *   - `FieldPowerSystem`: the spots are targets only for a lead with the power (and FIELD_POWERS on), unburnt brambles
 *     block prediction, E sends the power, the server's answer plays its effect; the sense trails; the chip's hints;
 *   - the chip and the party screen's field power line; the power key is bindable (F).
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BRAMBLES, DIG_SPOTS, DIVE_SPOTS, brambleFlag, zone } from '@ewa/content';
import type { GlidePlan, ZoneDef } from '@ewa/content';
import type { CreatureInstance } from '@ewa/core';
import { BillboardPool, FollowerPool } from '@ewa/render';
import type { AtlasDecoder, FieldFxKind, ObstaclesHandle } from '@ewa/render';
import { encodeLeadFlags } from '@ewa/protocol';
import { HELD } from '../src/scene/input';
import { GLIDE_INTENT_STEPS, GLIDE_REST_STEPS, LocalPlayerController } from '../src/scene/LocalPlayerController';
import type { InputPayload } from '../src/scene/LocalPlayerController';
import type { StepCollider } from '../src/scene/collider';
import { FollowerViews } from '../src/scene/FollowerViews';
import { CreatureTextures } from '../src/scene/creatureTextures';
import { createSpriteCatalog } from '../src/scene/spriteCatalog';
import type { CreatureManifest } from '../src/scene/spriteCatalog';
import { FieldPowerSystem, fieldHints, leadInfo, loopPoints } from '../src/scene/fieldPowers';
import { InteractionTargets } from '../src/scene/interaction';
import { species } from '../src/data/content';
import { useFieldPowerStore } from '../src/state/fieldPowers';
import { DEFAULT_KEYBINDS } from '../src/state/settings';
import { ACTION_LABEL } from '../src/screens/SettingsScreen';
import { FieldPowerChip } from '../src/world/FieldPowerChip';

const STEP = 1000 / 60;

// ─── the glide in prediction ─────────────────────────────────────────────────

/** Ground for x < 0 and beyond x = 4, a cliff face between (the collider stops the walker at the edge). */
function edgeCollider(): StepCollider {
  let fx = 0;
  let fz = 0;
  const cliff = (x: number): boolean => x >= -0.01 && x <= 4;
  return {
    terrain: null,
    begin(x: number, z: number) { fx = x; fz = z; },
    resolve(p: { x: number; z: number }) { if (cliff(p.x)) { p.x = fx; p.z = fz; } },
    passable: (x: number) => !cliff(x),
    height: () => 0,
  } as unknown as StepCollider;
}

const PLAN = (x0: number, z0: number): GlidePlan => ({ x0, z0, dx: 1, dz: 0, dist: 6, topY: 5, landY: 1 });

function glider() {
  const held = new Uint8Array(5);
  const sent: InputPayload[] = [];
  const c = new LocalPlayerController({ held, cameraYaw: () => 0, blocked: () => false, send: (p) => sent.push(JSON.parse(JSON.stringify(p)) as InputPayload) });
  c.setCollider(edgeCollider());
  c.reconcile(-1, 0, 0, 0);
  const asked: number[] = [];
  c.glider = (x, z, dx) => {
    asked.push(x);
    return dx > 0.5 ? PLAN(x, z) : null;
  };
  const takeoffs: GlidePlan[] = [];
  c.onGlide = (p) => takeoffs.push(p);
  return { c, held, sent, asked, takeoffs };
}

function run(c: LocalPlayerController, n: number): void {
  for (let i = 0; i < n; i++) {
    c.sample();
    c.step(STEP);
  }
}

describe('the glide in prediction', () => {
  it('walks to the edge, takes off, glides the plan whatever the keys say, carries the take-off, lands', () => {
    const t = glider();
    t.held[HELD.right] = 1; // yaw 0: right = +x, toward the drop
    t.held[HELD.run] = 1;
    run(t.c, 30);
    expect(t.takeoffs.length).toBe(1);
    const g = t.c.gliding!;
    expect(g).not.toBeNull();
    expect(g.dx).toBe(1);
    // the keys turn away: the glide goes on along its line
    t.held[HELD.right] = 0;
    t.held[HELD.left] = 1;
    run(t.c, 10);
    expect(t.c.pose.x).toBeGreaterThan(g.x0 + 0.5);
    expect(t.c.pose.z).toBeCloseTo(0, 6);
    const glided = t.sent.filter((p) => p.glide !== undefined);
    expect(glided.length).toBeGreaterThan(0);
    for (const p of glided) {
      expect(p.glide).toEqual({ x: g.x0, z: g.z0, dx: 1, dz: 0 });
      expect(p.running).toBe(true);
    }
    // 6 m at 7 m/s: landed within a second, then on the ground again
    t.held[HELD.left] = 0;
    run(t.c, 60);
    expect(t.c.gliding).toBeNull();
    expect(t.c.pose.x).toBeGreaterThanOrEqual(g.x0 + 6 - 1e-6);
    const after = t.sent.length;
    t.held[HELD.forward] = 1;
    run(t.c, 12);
    expect(t.sent.slice(after + 1).every((p) => p.glide === undefined)).toBe(true);
  });

  it('an ack that agrees keeps the glide; any correction mid-glide ends it and rests take-offs', () => {
    const t = glider();
    t.held[HELD.right] = 1;
    run(t.c, 30);
    const g = t.c.gliding!;
    // the server took the glide: its ack agrees with what was sent, the glide flies on
    const ok = t.sent.at(-1)!;
    t.c.reconcile(ok.x, ok.z, ok.angle, ok.seq);
    expect(t.c.gliding).not.toBeNull();
    // the server held the player at the edge: the glide ends, the replay walks (stopped by the edge), take-offs rest
    run(t.c, 2);
    const seq = t.sent.at(-1)!.seq;
    t.c.reconcile(g.x0 - 0.1, 0, 0, seq);
    expect(t.c.gliding).toBeNull();
    expect(t.c.pose.x).toBeLessThan(0);
    const before = t.asked.length;
    run(t.c, 30);
    expect(t.asked.length).toBe(before);
    run(t.c, GLIDE_REST_STEPS);
    expect(t.asked.length).toBeGreaterThan(before);
  });

  it('a push against an edge with no drop asks only after GLIDE_INTENT_STEPS, then rests between asks', () => {
    const t = glider();
    let asks = 0;
    t.c.glider = () => {
      asks++;
      return null;
    };
    t.held[HELD.right] = 1;
    run(t.c, 180);
    expect(t.c.gliding).toBeNull();
    expect(asks).toBeGreaterThan(0);
    // never every step: at most one ask per intent window plus its 0.2 s rest
    expect(asks).toBeLessThanOrEqual(Math.ceil(180 / (GLIDE_INTENT_STEPS + 12)) + 1);
  });

  it('no glider, no glide: the edge stops the walker as before', () => {
    const t = glider();
    t.c.glider = null;
    t.held[HELD.right] = 1;
    run(t.c, 60);
    expect(t.c.gliding).toBeNull();
    expect(t.c.pose.x).toBeLessThan(0);
  });
});

// ─── follower views ──────────────────────────────────────────────────────────

const map = (u: string) => ({ url: `atlases/${u}.webp`, mips: [1, 2, 3].map((i) => `atlases/${u}.m${i}.webp`), bytes: 10 });
const rect = (atlas: string, x: number) => ({ atlas, px: [x * 2048, 0, 1024, 1024] as const, uv: [x, 0.5, x + 0.5, 1] as const, footV: 0.08, aspect: 1 });
const SPECIES = ['bramblecub', 'cindercap', 'glimfin', 'zaptus', 'mudbub', 'flampling'];
function manifest(): CreatureManifest {
  const atlases = [0, 1, 2].map((i) => {
    const id = `a-00${i}`;
    return { id, species: [] as string[], size: 2048 as const, albedo: map(`${id}.albedo`), normal: map(`${id}.normal`), emissive: map(`${id}.emissive`), normalScale: 0.5 as const };
  });
  const sprites: Record<string, CreatureManifest['sprites'][string]> = {};
  SPECIES.forEach((sp, i) => {
    const a = `a-00${Math.floor(i / 2)}`;
    sprites[sp] = { front: rect(a, (i % 2) * 0.5), back: rect(a, (i % 2) * 0.5), sizeScale: 1, home: a };
  });
  return { version: 2, atlases, zones: { mire_route: ['a-000'] }, sprites, animAtlases: [] };
}
const decoder: AtlasDecoder = { decode: async (_u, crop) => ({ width: crop ? crop[2] : 2048, height: crop ? crop[3] : 2048, close: () => {} }) };

function followerHarness() {
  const sprites = new BillboardPool({ decoder });
  const owners = { feetOf: (_id: string, out: { set(x: number, y: number, z: number): unknown }) => (out.set(0, 0, 0), out as never), groundAt: () => 0 };
  const pool = new FollowerPool(sprites, owners as never);
  const catalog = createSpriteCatalog(manifest(), species);
  const textures = new CreatureTextures({ catalog: () => catalog, pool: () => sprites, setTimer: () => 0, clearTimer: () => undefined });
  const views = new FollowerViews({ pool: () => pool, catalog: () => catalog, textures: () => textures, singles: () => sprites, selfId: () => 'me' });
  return { sprites, pool, catalog, textures, views };
}

describe('FollowerViews', () => {
  it('the player follower holds its atlas; a remote one shows when its atlas is bound, a single otherwise, else none', async () => {
    const h = followerHarness();
    h.views.setLead('me', 'flampling', encodeLeadFlags({ isShiny: true }));
    expect(h.views.modeOf('me')).toBe('atlas');
    expect(h.textures.refs('a-002')).toBeGreaterThan(0);
    expect(h.pool.billboardOf('me')!.descriptor.isShiny).toBe(true);
    // the zone's atlas is bound: a remote bramblecub (a-000) shows at once
    const zoneHold = h.textures.hold(['a-000']);
    await zoneHold.ready;
    h.views.setLead('r1', 'bramblecub', 0);
    // the player's own sheet (a-002) is bound too: a remote mudbub shares it
    h.views.setLead('r2', 'mudbub', 0);
    // remotes whose atlas is not bound take front-only singles; past the singles, nothing
    h.views.setLead('r3', 'glimfin', 0);
    h.views.setLead('r4', 'zaptus', 0);
    h.views.setLead('r5', 'glimfin', encodeLeadFlags({ isAlpha: true }));
    h.views.setLead('r6', 'zaptus', 0);
    h.views.sync(['r1', 'r2', 'r3', 'r4', 'r5', 'r6']);
    expect(h.views.modeOf('r1')).toBe('atlas');
    expect(h.views.modeOf('r2')).toBe('atlas');
    expect(h.views.modeOf('r3')).toBe('single');
    expect(h.views.modeOf('r4')).toBe('single');
    expect(h.views.modeOf('r5')).toBe('single');
    expect(h.views.modeOf('r6')).toBeNull();
    // two glimfins share one single (one cell of one sheet): render binds it once
    expect(h.sprites.singlesBound()).toBe(2);
    // a remote that walks away gives its single back to the next one
    h.views.sync(['r1', 'r2', 'r4', 'r5', 'r6']);
    expect(h.views.modeOf('r3')).toBeNull();
    expect(h.views.modeOf('r6')).toBe('single');
    h.views.remove('r6');
    h.views.sync(['r1', 'r2', 'r4', 'r5']);
    expect(h.pool.has('r6')).toBe(false);
    // a lead that faints away: no follower
    h.views.setLead('r1', '', 0);
    h.views.sync(['r1', 'r2', 'r4', 'r5']);
    expect(h.views.modeOf('r1')).toBeNull();
    h.views.clear();
    expect(h.pool.size).toBe(0);
    zoneHold.release();
  });
});

// ─── field powers ────────────────────────────────────────────────────────────

const mon = (speciesId: string, hp = 20): CreatureInstance => ({ id: speciesId, speciesId, nickname: null, level: 20, hp, variantKey: 'normal', isAlpha: false } as unknown as CreatureInstance);

function fieldHarness(party: CreatureInstance[], o: { enabled?: boolean; flags?: string[] } = {}) {
  const targets = new InteractionTargets(() => undefined);
  const sent: { power: string; targetId: string }[] = [];
  const toasts: string[] = [];
  const fx: [FieldFxKind, number, number][] = [];
  const cleared = new Map<string, boolean>();
  const blockers = new Set<string>();
  const collider = {
    passable: () => true,
    onWater: () => false,
    addBlocker: (id: string) => blockers.add(id),
    removeBlocker: (id: string) => blockers.delete(id),
    height: () => 0,
  } as unknown as StepCollider;
  const obstacles: ObstaclesHandle = { ids: [], setCleared: (id, c) => void cleared.set(id, c), isCleared: (id) => cleared.get(id) === true };
  let flags = new Set(o.flags ?? []);
  const sys = new FieldPowerSystem({
    targets,
    interactKey: () => 'E',
    powerKey: () => 'F',
    send: (p) => sent.push(p),
    toast: (t) => toasts.push(t),
    enabled: () => o.enabled ?? true,
    shadow: () => 0,
    daylight: () => 1,
    party: () => party,
    typesOf: (id) => species(id)?.types,
    flags: () => flags,
    indoors: () => false,
    collider: () => collider,
    obstacles: () => obstacles,
    followers: () => null,
    fx: (k, x, _y, z) => void fx.push([k, x, z]),
    height: () => 0,
    selfId: () => 'me',
    player: () => ({ x: 0, z: 0 }),
  });
  return { sys, targets, sent, toasts, fx, cleared, blockers, setFlags: (f: string[]) => (flags = new Set(f)) };
}

/** The field targets of a zone (the system registers them as dynamic entries `bramble:` / `dig:` / `dive:`). */
function fieldEntries(targets: InteractionTargets, z: ZoneDef) {
  const ids = [
    ...(BRAMBLES[z.id] ?? []).map((b) => `bramble:${b.id}`),
    ...(DIG_SPOTS[z.id] ?? []).map((b) => `dig:${b.id}`),
    ...(DIVE_SPOTS[z.id] ?? []).map((b) => `dive:${b.id}`),
  ];
  return ids.map((id) => targets.dynamicEntry(id)!).filter((e) => e !== undefined);
}

describe('FieldPowerSystem', () => {
  const route: ZoneDef = zone('mire_route');

  it('the spots are targets only for a lead with the power; unburnt brambles block until burnt', () => {
    const fire = fieldHarness([mon('cindercap')]);
    fire.sys.onZone(route);
    const entries = fieldEntries(fire.targets, route);
    const brambles = entries.filter((e) => e.kind === 'bramble');
    expect(brambles.length).toBe(BRAMBLES.mire_route!.length);
    expect(brambles.every((e) => e.enabled)).toBe(true);
    expect(entries.filter((e) => e.kind === 'dig').every((e) => !e.enabled)).toBe(true);
    expect(fire.blockers.size).toBe(BRAMBLES.mire_route!.length);
    fire.sys.activate(brambles[0]!);
    expect(fire.sent).toEqual([{ power: 'burn', targetId: BRAMBLES.mire_route![0]!.id }]);
    // burnt: the flag arrives, the patch is gone for this player and no longer blocks
    fire.setFlags([brambleFlag('mire_route', BRAMBLES.mire_route![0]!.id)]);
    fire.sys.refresh();
    expect(fire.blockers.size).toBe(BRAMBLES.mire_route!.length - 1);
    expect(fire.cleared.get(`bramble:${BRAMBLES.mire_route![0]!.id}`)).toBe(true);
    expect(brambles[0]!.enabled).toBe(false);

    const ground = fieldHarness([mon('mudbub')]);
    ground.sys.onZone(route);
    const dig = fieldEntries(ground.targets, route).find((e) => e.kind === 'dig')!;
    expect(dig.enabled).toBe(true);
    ground.sys.activate(dig);
    expect(ground.sent).toEqual([{ power: 'dig', targetId: DIG_SPOTS.mire_route![0]!.id }]);
    const dive = fieldEntries(ground.targets, route).find((e) => e.kind === 'dive')!;
    expect(dive.enabled).toBe(true);
    expect(ground.sys.diveNear(dive.x + 1, dive.z)).toBe(true);
    expect(ground.sys.diveNear(dive.x + 9, dive.z)).toBe(false);
    ground.sys.activate(dive); // on land: told to swim out first, nothing sent
    expect(ground.sent.length).toBe(1);
    expect(ground.toasts.at(-1)).toMatch(/swim out/i);
  });

  it('with FIELD_POWERS off nothing blocks, every patch is hidden and no spot is a target', () => {
    const off = fieldHarness([mon('cindercap')], { enabled: false });
    off.sys.onZone(route);
    expect(off.blockers.size).toBe(0);
    expect(fieldEntries(off.targets, route).every((e) => !e.enabled)).toBe(true);
    for (const b of BRAMBLES.mire_route!) expect(off.cleared.get(`bramble:${b.id}`)).toBe(true);
    off.sys.usePower();
    expect(off.sent).toEqual([]);
  });

  it('the power key: a Psychic lead senses; the answer glows along each haunt; others say what they do', () => {
    const psy = fieldHarness([mon('zaptus')]);
    psy.sys.onZone(route);
    psy.sys.usePower();
    expect(psy.sent).toEqual([{ power: 'sense', targetId: 'here' }]);
    psy.sys.onMessage({ type: 'fieldPower', power: 'sense', spotId: '', x: 0, z: 0, item: null, qty: 0, ghosts: [{ name: 'rival', wanted: true, x: 10, z: 4, path: [[0, 0], [10, 0], [10, 10]] }] }, 1000);
    expect(psy.sys.sensed.map((g) => g.name)).toEqual(['rival']);
    psy.fx.length = 0;
    psy.sys.frame(200, 1200);
    expect(psy.fx.some(([k]) => k === 'wanted')).toBe(true);
    expect(psy.fx.some(([k]) => k === 'wantedRing')).toBe(true);
    psy.sys.frame(16, 1000 + 13_000);
    expect(psy.sys.sensed).toEqual([]);

    const fire = fieldHarness([mon('cindercap')]);
    fire.sys.onZone(route);
    fire.sys.usePower();
    expect(fire.sent).toEqual([]);
    expect(fire.toasts.at(-1)).toMatch(/brambles/);
    fire.sys.onMessage({ type: 'fieldPower', power: 'burn', spotId: 'thorns_a', x: 3, z: 4, item: 'superpotion', qty: 2, ghosts: [] }, 0);
    expect(fire.fx[0]).toEqual(['burn', 3, 4]);
    expect(fire.cleared.get('bramble:thorns_a')).toBe(true);
  });

  it('the lead is the first creature standing; its powers by type', () => {
    expect(leadInfo([mon('flampling', 0), mon('mudbub')], (id) => species(id)?.types)?.powers).toEqual(['dig', 'dive']);
    expect(leadInfo([mon('flampling')], (id) => species(id)?.types)?.powers).toEqual(['light', 'glide']);
    expect(leadInfo([mon('zaptus', 0)], (id) => species(id)?.types)).toBeNull();
  });

  it('the chip says what each power does in this zone; a dive in a zone without dark water is dimmed', () => {
    const hints = fieldHints(route, ['dig', 'dive', 'light', 'sense', 'glide'], { flags: new Set(), dark: false, indoors: false, powerKey: 'F' });
    expect(hints.map((h) => h.power)).toEqual(['dig', 'dive', 'light', 'sense', 'glide']);
    expect(hints.every((h) => h.here)).toBe(true);
    expect(hints.find((h) => h.power === 'sense')!.key).toBe('F');
    const town = fieldHints(zone('mirevale'), ['dig', 'dive'], { flags: new Set(), dark: false, indoors: false, powerKey: 'F' });
    expect(town.every((h) => !h.here)).toBe(true);
    expect(DIVE_SPOTS.mirevale).toBeUndefined();
    for (const h of [...hints, ...town]) expect(h.text).not.toMatch(/\u2014/);
    expect(loopPoints([[0, 0], [4, 0]]).length).toBeGreaterThan(3);
  });
});

describe('the chip, the party line, the key', () => {
  it('the chip shows the lead and a line per power, the sense key on a paper chip', () => {
    useFieldPowerStore.getState().setChip({
      lead: { speciesId: 'zaptus', name: 'Zaptus', types: ['Psychic'], variantKey: 'normal' },
      enabled: true,
      hints: [{ power: 'sense', text: 'Sense the ghost trainers walking here', here: true, key: 'F' }],
    });
    render(<FieldPowerChip />);
    expect(screen.getByTestId('field-power-chip').textContent).toMatch(/Zaptus/);
    expect(screen.getByTestId('field-power-sense').textContent).toMatch(/Sense/);
    expect(screen.getByTestId('field-power-sense').querySelector('kbd')?.textContent).toBe('F');
  });

  it('the power key is F by default and labelled in the controls', () => {
    expect(DEFAULT_KEYBINDS.fieldPower).toEqual(['KeyF']);
    expect(ACTION_LABEL.fieldPower).toMatch(/field power/i);
  });
});
