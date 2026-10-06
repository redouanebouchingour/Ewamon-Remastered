/**
 * Phase A interiors on the client: the pocket interactables (Mirevale's gym hall: Enter / Leave, the leader at its
 * `leaderAt`, two gym trainers, two root-stones; the shop / healer counters and the PC inside; Solenne's four league
 * chambers), pocket tracking (active hall, camera yaw base down the hall axis, heading saved / restored, pocket actors
 * spawned / despawned, `setView` on a yaw change), gates → prediction blockers and the renderer as flags change,
 * switch tiles, and a battle in a hall (hall axis, no heading pick, `HallBounds`, back to the pocket camera).
 */
import { describe, expect, it } from 'vitest';
import { leaderSpot,
  LEAGUE,
  getHeightfield,
  interiorGates,
  interiorLeaders,
  interiorNpcs,
  interiorSwitches,
  interiorTrainerFlag,
  interiorTrainers,
  interiorWarps,
  interiorsFor,
  localToWorld,
} from '@ewa/content';
import type { PlacedInterior } from '@ewa/content';
import { TerrainCollider } from '@ewa/render';
import type { Renderer, ZoneHandle, ZoneSpec } from '@ewa/render';
import { createAudioDirector } from '../src/audio/AudioDirector';
import { createStepCollider } from '../src/scene/collider';
import type { GateBlockers, GateSolid } from '../src/scene/collider';
import { HudWriter } from '../src/scene/HudWriter';
import { InteractionTargets } from '../src/scene/interaction';
import { FloorIndex, pcId, pocketYawDeg, splitLabel } from '../src/scene/interiors';
import { createSceneDirector } from '../src/scene/SceneDirector';
import type { SceneDirector } from '../src/scene/SceneDirector';

function fakeWorld() {
  const log: string[] = [];
  const actors = new Map<string, { x: number; z: number; a: number }>();
  let heading = 0;
  let base: number | null = null;
  const interiors = {
    setActive: (id: string | null) => log.push(`active ${id}`),
    setView: (yaw: number) => log.push(`view ${yaw.toFixed(3)}`),
    setGateOpen: (id: string, open: boolean) => log.push(`gate ${id} ${open}`),
    setSwitchOn: (id: string, on: boolean) => log.push(`switch ${id} ${on}`),
  };
  const r = {
    loadZone: async (spec: ZoneSpec): Promise<ZoneHandle> => {
      log.push(`loadZone ${spec.id}`);
      return {
        id: spec.id, group: {} as ZoneHandle['group'], collider: { blocked: () => false, sample: () => 0 } as unknown as ZoneHandle['collider'],
        bounds: { minX: -64, maxX: 64, minZ: -64, maxZ: 64 }, geometryDigest: '00000000', stats: () => ({}) as ReturnType<ZoneHandle['stats']>,
        dispose: () => undefined, interiors,
      };
    },
    actors: {
      spawn: (id: string) => { actors.set(id, { x: Number.NaN, z: Number.NaN, a: 0 }); },
      setTransform: (id: string, x: number, z: number, a: number) => { if (actors.has(id)) actors.set(id, { x, z, a }); },
      despawn: (id: string) => { actors.delete(id); },
    },
    camera: {
      get headingIndex() { return heading; },
      setHeading: (h: number) => { heading = h; log.push(`heading ${h}`); },
      setYawBase: (d: number | null) => { base = d; log.push(`yawBase ${d}`); },
      pushIn: (t: { x: number; z: number }, ms: number) => log.push(`pushIn ${t.x.toFixed(2)} ${t.z.toFixed(2)} ${ms}`),
      release: (ms: number) => log.push(`release ${ms}`),
    },
    stage: {
      dress: (at: { x: number; z: number }, terrain: string, _p: readonly string[], hall?: { x: number; z: number; yaw: number; hw: number; hd: number }) =>
        log.push(`dress ${at.x.toFixed(2)} ${at.z.toFixed(2)} ${terrain}${hall === undefined ? '' : ` hall ${hall.x} ${hall.z} ${hall.yaw.toFixed(3)} ${hall.hw} ${hall.hd}`}`),
      undress: (ms: number) => log.push(`undress ${ms}`),
    },
    setWeather: (w: string) => log.push(`weather ${w}`),
    setTimeOfDay: () => undefined,
    setHarvestLevel: () => undefined,
  };
  return { r: r as unknown as Renderer, log, actors, heading: () => heading, base: () => base };
}

/** A recording GateBlockers (the director's view of the prediction collider). */
function fakeBlockers() {
  const live = new Map<string, GateSolid>();
  const b: GateBlockers = {
    addBlocker: (id, s) => { live.set(id, s); },
    removeBlocker: (id) => { live.delete(id); },
    blockerIds: () => [...live.keys()],
  };
  return { b, live };
}

async function director(zoneId: 'mirevale' | 'solenne', flags: { current: Set<string> }, blockers: GateBlockers | null = null) {
  const w = fakeWorld();
  const targets = new InteractionTargets(() => undefined);
  const d: SceneDirector = createSceneDirector({
    renderer: w.r, hud: new HudWriter(null), audio: createAudioDirector({ createContext: () => null }), targets, selfId: () => 'me',
    flags: () => flags.current, interactKey: () => 'E', onZone: () => undefined, setInputEnabled: () => undefined, setAccentType: () => undefined,
    reducedMotion: () => false, blockers: () => blockers,
  });
  await d.loadZone(zoneId, 'intact');
  return { d, targets, ...w };
}

const gymOf = (zoneId: 'mirevale' | 'solenne'): PlacedInterior =>
  interiorsFor(zoneId).find((p) => p.def.template === 'gym_hall' || p.def.template === 'league_hall')!;
const entryOf = (p: PlacedInterior): readonly [number, number] => localToWorld(p, p.def.entry.lx, p.def.entry.lz);

describe('Phase A interiors (client)', () => {
  it('Mirevale: Enter / Leave the gym, the leader at its leaderAt, two gym trainers, two root-stones, counters and the PC inside', async () => {
    const { targets } = await director('mirevale', { current: new Set() });
    const all = targets.staticEntries();
    const byId = (id: string) => all.find((e) => e.id === id);
    const gym = gymOf('mirevale');
    // door warps: 'Enter Mirevale Gym' at the door approach, 'Leave Mirevale Gym' by the hall's exit
    const warps = interiorWarps('mirevale');
    const inW = warps.find((w) => w.id === 'mirevale.gym.in')!;
    const outW = warps.find((w) => w.id === 'mirevale.gym.out')!;
    expect(byId('mirevale.gym.in')).toMatchObject({ kind: 'warp', x: inW.x, z: inW.z, prompt: { key: 'E', verb: 'Enter', target: 'Mirevale Gym' } });
    expect(byId('mirevale.gym.out')).toMatchObject({ kind: 'warp', x: outW.x, z: outW.z, prompt: { verb: 'Leave', target: 'Mirevale Gym' } });
    // every pocket has its pair
    expect(all.filter((e) => e.kind === 'warp' && e.id.endsWith('.in'))).toHaveLength(interiorsFor('mirevale').length);
    // one gym interactable, at the leader's spot inside the hall (no league marker any more)
    const gyms = all.filter((e) => e.kind === 'gym');
    const leader = interiorLeaders('mirevale')[0]!;
    expect(gyms).toHaveLength(1);
    expect(gyms[0]).toMatchObject({ id: 'verdant_gym', x: leader.x, z: leader.z, prompt: { verb: 'Challenge', target: 'Mira Thornwell' } });
    expect(gyms[0]!.range).toBeLessThanOrEqual(4); // the server checks 4 m
    // two gym trainers, both challengeable
    const tr = all.filter((e) => e.kind === 'trainer' && e.id.startsWith('mirevale.gym.'));
    expect(tr.map((e) => e.id).sort()).toEqual(['mirevale.gym.t1', 'mirevale.gym.t2']);
    expect(tr.every((e) => e.enabled)).toBe(true);
    // two root-stones with the content label as the prompt
    const sw = all.filter((e) => e.kind === 'switch');
    expect(sw.map((e) => e.id).sort()).toEqual(['mirevale.gym.stone_a', 'mirevale.gym.stone_b']);
    expect(sw[0]!.prompt).toMatchObject({ verb: 'Wake', target: 'the root-stone' });
    for (const s of interiorSwitches('mirevale')) expect(byId(s.id)).toMatchObject({ x: s.x, z: s.z });
    expect(gym.def.switches).toHaveLength(2);
    // the shop / healer moved from the building door to the keeper / nurse inside; the PC beside the healer's counter
    const keeper = interiorNpcs('mirevale').find((n) => n.role === 'shopkeeper')!;
    const nurse = interiorNpcs('mirevale').find((n) => n.role === 'nurse')!;
    expect(all.filter((e) => e.kind === 'shop')).toEqual([expect.objectContaining({ id: `shop:${keeper.id}`, x: keeper.x, z: keeper.z })]);
    expect(all.filter((e) => e.kind === 'healer')).toEqual([expect.objectContaining({ id: `healer:${nurse.id}`, x: nurse.x, z: nurse.z })]);
    const healer = interiorsFor('mirevale').find((p) => p.def.template === 'healer')!;
    expect(all.filter((e) => e.kind === 'pc').map((e) => e.id)).toEqual([pcId(healer.def.id)]);
    // the gym guide and every house resident talk (client-local)
    expect(byId('mirevale.gym.guide')?.kind).toBe('npc');
    expect(all.filter((e) => e.kind === 'npc' && e.id.endsWith('.resident')).length).toBeGreaterThan(0);
  });

  it('Solenne: one league interactable per chamber (Veil → Aurelia → Kirei → Zeon), the league nurse heals', async () => {
    const { targets } = await director('solenne', { current: new Set() });
    const gyms = targets.staticEntries().filter((e) => e.kind === 'gym');
    expect(gyms.map((e) => e.id)).toEqual(['veil', 'aurelia', 'kirei', 'zeon']);
    // with no flags Kirei greets in the foyer (she speaks `wardens_charge`); the others wait in their chambers
    for (const l of interiorLeaders('solenne')) expect(gyms.find((e) => e.id === l.leagueId)).toMatchObject({ x: leaderSpot(l, new Set()).x, z: leaderSpot(l, new Set()).z });
    const kirei = interiorLeaders('solenne').find((l) => l.leagueId === 'kirei')!;
    expect(gyms.find((e) => e.id === 'kirei')).toMatchObject({ x: kirei.greet!.x, z: kirei.greet!.z });
    const league = gymOf('solenne');
    expect(league.def.template).toBe('league_hall');
    expect(targets.staticEntries().filter((e) => e.kind === 'healer').map((e) => e.id)).toContain(`healer:${league.def.id}.nurse`);
  });

  it('a player already holding wardens_met finds Kirei in her chamber, not the foyer, on entering the league hall', async () => {
    const { d, actors } = await director('solenne', { current: new Set(['wardens_met']) });
    const hall = gymOf('solenne');
    const [ex, ez] = entryOf(hall);
    d.updatePocket(ex, ez);
    const kirei = interiorLeaders('solenne').find((l) => l.leagueId === 'kirei')!;
    expect(actors.get('kirei')).toMatchObject({ x: kirei.x, z: kirei.z });
  });

  it('pocket tracking: entering sets the hall active, the yaw base down the hall and heading 0; leaving restores both', async () => {
    const { d, r, log, actors, heading, base } = await director('mirevale', { current: new Set() });
    const gym = gymOf('mirevale');
    r.camera.setHeading(2);
    const [ex, ez] = entryOf(gym);
    expect(new FloorIndex(interiorsFor('mirevale')).at(ex, ez)).toBe(gym);
    d.updatePocket(ex, ez);
    expect(d.pocket).toBe(gym);
    expect(log).toContain('active mirevale.gym');
    expect(base()).toBe(pocketYawDeg(gym));
    expect(heading()).toBe(0);
    // the hall axis: heading 0 at base = pocket yaw looks from the door (local +z) toward the far end (local −z)
    const yaw = (pocketYawDeg(gym) * Math.PI) / 180;
    const [fx, fz] = [-Math.sin(yaw), -Math.cos(yaw)];
    const [dx, dz] = localToWorld(gym, 0, -1).map((v, i) => v - [gym.at.x, gym.at.z][i]!);
    expect(fx).toBeCloseTo(dx!, 9);
    expect(fz).toBeCloseTo(dz!, 9);
    expect(log).toContain(`view ${yaw.toFixed(3)}`);
    // the hall's actors: guide, both gym trainers, the leader facing the door
    for (const id of ['mirevale.gym.guide', 'mirevale.gym.t1', 'mirevale.gym.t2', 'verdant_gym']) expect(actors.has(id), id).toBe(true);
    const leader = interiorLeaders('mirevale')[0]!;
    expect(actors.get('verdant_gym')).toMatchObject({ x: leader.x, z: leader.z, a: leader.facing });
    expect(d.isStaticActor('verdant_gym')).toBe(true);
    expect(d.pocketActors.map((a) => a.id)).toContain('verdant_gym');
    // the same position again: nothing new; a rotation: setView once
    const n = log.length;
    d.updatePocket(ex + 0.1, ez);
    d.syncView(yaw);
    expect(log.length).toBe(n);
    d.syncView(yaw + Math.PI / 2);
    expect(log.at(-1)).toBe(`view ${(yaw + Math.PI / 2).toFixed(3)}`);
    // leave through the door: default diagonal, heading 2 again, pocket actors gone
    const door = interiorWarps('mirevale').find((w) => w.id === 'mirevale.gym.out')!;
    d.updatePocket(door.toX, door.toZ);
    expect(d.pocket).toBeNull();
    expect(log).toContain('active null');
    expect(base()).toBeNull();
    expect(heading()).toBe(2);
    expect(actors.has('verdant_gym')).toBe(false);
    expect(actors.has('mirevale.gym.t1')).toBe(false);
    expect(d.pocketActors).toEqual([]);
  });

  it('gates: closed gates are prediction blockers (their capsule-grown solid) and drawn shut; flags open them', async () => {
    const flags = { current: new Set<string>() };
    const { b, live } = fakeBlockers();
    const { d, log, targets } = await director('mirevale', flags, b);
    const gates = interiorGates('mirevale');
    expect(gates.length).toBeGreaterThan(0);
    expect([...live.keys()].sort()).toEqual(gates.map((g) => g.id).sort());
    for (const g of gates) {
      expect(live.get(g.id)).toEqual(g.solid);
      expect(log).toContain(`gate ${g.id} false`);
    }
    for (const s of interiorSwitches('mirevale')) expect(log).toContain(`switch ${s.id} false`);
    // Gardener Fen beaten → his gate opens (and only it); the root-stone flag lights its tile
    const t1 = interiorTrainerFlag('mirevale.gym.t1');
    const stoneA = interiorSwitches('mirevale').find((s) => s.id === 'mirevale.gym.stone_a')!;
    flags.current = new Set([t1, stoneA.sets!]);
    const n = log.length;
    d.refreshFlags(flags.current);
    expect(live.has('mirevale.gym.gate.g1')).toBe(false);
    expect(live.has('mirevale.gym.gate.leader')).toBe(true);
    expect(log.slice(n)).toEqual(expect.arrayContaining(['gate mirevale.gym.gate.g1 true', `switch ${stoneA.id} true`]));
    expect(log.slice(n).filter((l) => l.startsWith('gate '))).toEqual(['gate mirevale.gym.gate.g1 true']);
    // the same flags again: nothing; a beaten trainer and a used stone are no longer offered
    d.refreshFlags(flags.current);
    expect(log.length).toBe(n + 2);
    const entry = (id: string) => targets.staticEntries().find((e) => e.id === id)!;
    expect(entry('mirevale.gym.t1').enabled).toBe(false);
    expect(entry('mirevale.gym.t2').enabled).toBe(true);
    expect(entry(stoneA.id).enabled).toBe(false);
    expect(entry('mirevale.gym.stone_b').enabled).toBe(true);
    // every gym flag → every gym gate open
    const all = [
      ...interiorTrainers('mirevale').map((t) => interiorTrainerFlag(t.id)),
      ...interiorSwitches('mirevale').flatMap((s) => (s.sets === null ? [] : [s.sets])),
    ];
    d.refreshFlags(new Set(all));
    expect(live.size).toBe(0);
    // flags lost (a fresh login on a reset account): the gates close again
    d.refreshFlags(new Set());
    expect(live.size).toBe(gates.length);
  });

  it('a closed gate blocks predicted movement on the real field; removing it lets the step through', () => {
    const gate = interiorGates('mirevale').find((g) => g.id === 'mirevale.gym.gate.g1')!;
    const c = createStepCollider(new TerrainCollider(getHeightfield('mirevale')));
    const { x, z } = gate.solid;
    expect(c.passable(x, z)).toBe(true); // the gate gap is walkable floor (never stamped)
    c.addBlocker(gate.id, gate.solid);
    expect(c.passable(x, z)).toBe(false);
    expect(c.blockerIds()).toEqual([gate.id]);
    // walk across the gate along the hall axis: the pose never enters the solid
    const gym = gymOf('mirevale');
    const [ax, az] = localToWorld(gym, 0, 10 + 1.2);
    const [bx, bz] = localToWorld(gym, 0, 10 - 1.2);
    const pose = { x: ax, z: az, angle: 0, vx: 0, vz: 0 };
    for (let i = 0; i < 40; i++) {
      c.begin(pose.x, pose.z);
      pose.x += (bx - ax) / 40;
      pose.z += (bz - az) / 40;
      c.resolve(pose as never);
      expect(c.passable(pose.x, pose.z)).toBe(true);
    }
    expect(Math.hypot(pose.x - bx, pose.z - bz)).toBeGreaterThan(1);
    c.removeBlocker(gate.id);
    expect(c.passable(x, z)).toBe(true);
    expect(c.blockerIds()).toEqual([]);
  });

  it('a battle in a hall: the hall axis (no heading pick), dressed on the hall floor, back to the pocket camera after', async () => {
    const { d, r, log, actors, heading, base } = await director('mirevale', { current: new Set() });
    const gym = gymOf('mirevale');
    const [ex, ez] = entryOf(gym);
    d.updatePocket(ex, ez);
    r.camera.setHeading(1); // the player turned the view inside the hall
    const room = gym.def.rooms[0]!;
    const [ax, az] = localToWorld(gym, room.arena.lx, room.arena.lz);
    // the leader actor is restaged by the world during the battle; exitBattle puts it back
    r.actors.setTransform('verdant_gym', ax, az, 0, false, false);
    await d.enterBattle({ battleId: 'b', x: ax, z: az, format: 'league', yaw: gym.at.yaw });
    expect(base()).toBe(pocketYawDeg(gym));
    expect(heading()).toBe(0);
    const f = d.battleFrame!;
    expect(f.fx).toBeCloseTo(-Math.sin(gym.at.yaw), 9);
    expect(f.fz).toBeCloseTo(-Math.cos(gym.at.yaw), 9);
    expect(log).toContain(`dress ${ax.toFixed(2)} ${az.toFixed(2)} grove hall ${gym.at.x} ${gym.at.z} ${gym.at.yaw.toFixed(3)} ${gym.def.w / 2} ${gym.def.d / 2}`);
    // pocket tracking pauses during the battle
    d.updatePocket(0, 0);
    expect(d.pocket).toBe(gym);
    const exit = d.exitBattle();
    expect(base()).toBe(pocketYawDeg(gym));
    expect(heading()).toBe(1);
    const leader = interiorLeaders('mirevale')[0]!;
    expect(actors.get('verdant_gym')).toMatchObject({ x: leader.x, z: leader.z, a: leader.facing });
    await exit;
  });

  it('splitLabel and the yaw base are plain', () => {
    expect(splitLabel('Enter the League Hall')).toEqual({ verb: 'Enter', target: 'the League Hall' });
    expect(splitLabel('Pull')).toEqual({ verb: 'Pull', target: '' });
    for (const p of interiorsFor('solenne')) expect([0, 90, -90, 180, -180]).toContain(pocketYawDeg(p));
    expect(LEAGUE.filter((l) => l.zoneId === 'solenne')).toHaveLength(4);
  });
});

describe('Phase D7 overworld weather on the client', () => {
  it('state.weather drives the renderer outdoors; a pocket (indoors) and a battle render none; both restore it', async () => {
    const { d, log } = await director('mirevale', { current: new Set() });
    const weather = (): string[] => log.filter((l) => l.startsWith('weather '));
    d.setWeather('rain');
    expect(weather().at(-1)).toBe('weather rain');
    // a battle in the open: the stage owns the weather while it lasts; a schedule change meanwhile is remembered
    await d.enterBattle({ battleId: 'b', x: 3, z: 4, format: 'wild' });
    const during = weather().length;
    d.setWeather('sun');
    expect(weather().length).toBe(during);
    await d.exitBattle();
    expect(weather().at(-1)).toBe('weather sun');
    // inside the gym hall: none; leaving through the door: the zone weather again
    const gym = gymOf('mirevale');
    const [ex, ez] = entryOf(gym);
    d.updatePocket(ex, ez);
    expect(weather().at(-1)).toBe('weather none');
    d.setWeather('rain');
    expect(weather().at(-1)).toBe('weather none');
    const door = interiorWarps('mirevale').find((w) => w.id === 'mirevale.gym.out')!;
    d.updatePocket(door.toX, door.toZ);
    expect(weather().at(-1)).toBe('weather rain');
  });
});
