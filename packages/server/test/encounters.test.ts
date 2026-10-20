/**
 * Old-game wild encounters and trainer sight (2026-10-20): `WILD_ENCOUNTERS=grass` (no overworld spawns; tall grass and
 * surfing roll a battle) and `TRAINER_SIGHT=on` (an unbeaten trainer who sees the player holds them until its fight).
 * testEnv keeps both off for the other suites; this file turns them on.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { encounterTableFor, getHeightfield, isWalkable, zone as zoneById, zonePlan } from '@ewa/content';
import type { PlanEllipse, RectSolid, TrainerDef, ZoneId } from '@ewa/content';
import { createRng } from '@ewa/core';
import { ENCOUNTER_GRACE_M, SIGHT_M, encounterChance, inTallGrass, lineOfSight, spotter } from '../src/rooms/encounters';
import { isStoryTrainer } from '../src/rooms/storyBeats';
import { rollFishing, rollWild } from '../src/rooms/spawnDirector';
import { content, enter, ofType, placePlayer, register, sleep, startServer, waitFor } from './helpers';
import type { Account, Joined, TestServer } from './helpers';

const ZONE: ZoneId = 'mire_route';
const H = getHeightfield(ZONE);
const PATCHES = zonePlan(ZONE).grassPatches;

/** A walkable chord through a patch's centre along its long axis (every 0.25 m walkable and in the grass). */
function grassChord(e: PlanEllipse): { a: [number, number]; b: [number, number] } | null {
  const ux = Math.cos(e.yaw);
  const uz = -Math.sin(e.yaw);
  for (const k of [0.6, 0.5, 0.4]) {
    const a: [number, number] = [e.x - ux * e.rx * k, e.z - uz * e.rx * k];
    const b: [number, number] = [e.x + ux * e.rx * k, e.z + uz * e.rx * k];
    let ok = true;
    for (let t = 0; t <= 1.0001 && ok; t += 0.25 / (2 * e.rx * k)) {
      const x = a[0] + (b[0] - a[0]) * t;
      const z = a[1] + (b[1] - a[1]) * t;
      ok = isWalkable(H, x, z) && inTallGrass(PATCHES, x, z);
    }
    if (ok) return { a, b };
  }
  return null;
}

/** A plain (non-story) trainer of the zone and a walkable spot `d` m from it with a clear line. */
function trainerApproach(d: number): { t: TrainerDef; x: number; z: number; ux: number; uz: number } {
  for (const t of zoneById(ZONE).trainers) {
    if (isStoryTrainer(t.id)) continue;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 16) {
      const ux = Math.sin(a);
      const uz = Math.cos(a);
      const x = t.x + ux * d;
      const z = t.z + uz * d;
      let ok = true;
      for (let r = 1; r <= d && ok; r += 0.25) ok = isWalkable(H, t.x + ux * r, t.z + uz * r) && !inTallGrass(PATCHES, t.x + ux * r, t.z + uz * r);
      if (ok) return { t, x, z, ux, uz };
    }
  }
  throw new Error('no plain trainer with a clear approach on mire_route');
}

describe('grass encounters (pure)', () => {
  it('every zone with land slots has tall grass to roll in; the patches are the plan the renderer grows grass in', () => {
    expect(PATCHES.length).toBeGreaterThan(0);
    const e = PATCHES[0]!;
    expect(inTallGrass(PATCHES, e.x, e.z)).toBe(true);
    expect(inTallGrass(PATCHES, e.x, e.z + e.rx + e.rz + 2)).toBe(false);
  });

  it('the chance per move grows with the metres walked and is 0 standing still', () => {
    expect(encounterChance(0, 0.07)).toBe(0);
    expect(encounterChance(1, 0.07)).toBeCloseTo(0.07, 10);
    expect(encounterChance(0.35, 0.07)).toBeLessThan(encounterChance(1, 0.07));
    expect(encounterChance(10, 0.07)).toBeCloseTo(1 - 0.93 ** 10, 10);
  });

  it('rollWild rolls only its medium; the fishing bite is rollWild(water) draw for draw', () => {
    const table = encounterTableFor(ZONE);
    const land = new Set(table!.slots.filter((s) => (s.medium ?? 'land') === 'land').map((s) => s.species));
    for (let i = 0; i < 40; i++) {
      const r = rollWild(table, 'land', createRng(`grass:${i}`), content, 0.5, { x: 0, z: 0 }, `g${i}`, 0);
      expect(r).not.toBeNull();
      expect(land.has(r!.speciesId)).toBe(true);
      expect(r!.medium).toBe('land');
      expect(rollFishing(table, createRng(`f:${i}`), content, 0.5, { x: 1, z: 2 }, 'f', 7)).toEqual(rollWild(table, 'water', createRng(`f:${i}`), content, 0.5, { x: 1, z: 2 }, 'f', 7));
    }
  });
});

describe('trainer sight (pure)', () => {
  it('sees within SIGHT_M along a clear line; not past it, not once beaten, not through a shut gate', () => {
    const { t, x, z, ux, uz } = trainerApproach(SIGHT_M - 1);
    const all = zoneById(ZONE).trainers;
    const any = (): boolean => true;
    expect(lineOfSight(H, [], t.x, t.z, x, z)).toBe(true);
    expect(spotter(all, (c) => c.id === t.id, H, [], x, z, any)?.id).toBe(t.id);
    expect(spotter(all, (c) => c.id === t.id, H, [], t.x + ux * (SIGHT_M + 1), t.z + uz * (SIGHT_M + 1), any)).toBeNull();
    expect(spotter(all, () => false, H, [], x, z, any)).toBeNull();
    expect(spotter(all, (c) => c.id === t.id, H, [], x, z, () => false)).toBeNull();
    const mx = (t.x + x) / 2;
    const mz = (t.z + z) / 2;
    const gate: RectSolid = { kind: 'rect', x: mx, z: mz, yaw: 0, hw: 0.6, hd: 0.6 };
    expect(lineOfSight(H, [gate], t.x, t.z, x, z)).toBe(false);
  });
});

let s: TestServer;

beforeAll(async () => {
  s = await startServer({ WILD_ENCOUNTERS: 'grass', TRAINER_SIGHT: 'on' });
});

afterAll(async () => {
  await s?.stop();
});

async function at(acc: Account, x: number, z: number): Promise<Joined> {
  await placePlayer(s, acc.id, ZONE, x, z);
  return enter(s, acc, ZONE);
}

function me(j: Joined, acc: Account): { x: number; z: number; seq: number } {
  return j.room.state.players.get(acc.id)!;
}

/** One 50 ms input toward (x, z); resolves once acked, with whether the pose moved. */
async function step(j: Joined, acc: Account, x: number, z: number): Promise<boolean> {
  const p = me(j, acc);
  const seq = p.seq + 1;
  j.room.send('input', { seq, x, z, angle: Math.atan2(x - p.x, z - p.z), running: true, dtMs: 50 });
  await waitFor(() => me(j, acc).seq >= seq, 3000);
  await sleep(55);
  const q = me(j, acc);
  return Math.hypot(q.x - x, q.z - z) < 0.05;
}

/** Walks toward (tx, tz) in 0.35 m steps; stops early when `stop()` holds or a step is refused. Returns metres walked. */
async function walk(j: Joined, acc: Account, tx: number, tz: number, stop: () => boolean): Promise<number> {
  let walked = 0;
  for (let guard = 0; guard < 400 && !stop(); guard++) {
    const p = me(j, acc);
    const d = Math.hypot(tx - p.x, tz - p.z);
    if (d < 0.05) break;
    const k = Math.min(1, 0.35 / d);
    if (!(await step(j, acc, p.x + (tx - p.x) * k, p.z + (tz - p.z) * k))) break;
    walked += Math.min(0.35, d);
  }
  return walked;
}

describe('WILD_ENCOUNTERS=grass (integration)', () => {
  it('no creature stands in the overworld; walking in tall grass starts a wild battle against a land species', async () => {
    const chord = PATCHES.map(grassChord).find((c) => c !== null);
    expect(chord).toBeDefined();
    const { a, b } = chord!;
    const acc = await register(s);
    const j = await at(acc, a[0], a[1]);
    await sleep(1500);
    expect(j.room.state.spawns.size).toBe(0);
    const started = (): boolean => ofType(j.msgs, 'battleStart').length > 0;
    let walked = 0;
    for (let leg = 0; leg < 30 && !started(); leg++) {
      const [tx, tz] = leg % 2 === 0 ? b : a;
      walked += await walk(j, acc, tx, tz, started);
    }
    await waitFor(started, 5000);
    expect(walked).toBeGreaterThan(ENCOUNTER_GRACE_M - 0.5);
    const start = ofType(j.msgs, 'battleStart')[0]!;
    expect(start.format).toBe('wild');
    const land = new Set(encounterTableFor(ZONE)!.slots.filter((x) => (x.medium ?? 'land') === 'land').map((x) => x.species));
    expect(land.has(start.state.sides[1].party[0]!.creature.speciesId)).toBe(true);
    // the battle holds the player where it began
    const p = me(j, acc);
    expect(await step(j, acc, p.x + 0.3, p.z)).toBe(false);
    await j.room.leave(true);
  }, 120_000);

  it('walking outside the grass never rolls', async () => {
    const { x, z, ux, uz } = trainerApproach(SIGHT_M + 6);
    // well away from any trainer's sight: walk 12 m on a grass-free line at the far end of the approach ray
    const acc = await register(s);
    const j = await at(acc, x, z);
    const far: [number, number] = [x + ux * 0.01, z + uz * 0.01];
    let ok = true;
    for (let r = 0; r <= 4 && ok; r += 0.25) ok = isWalkable(H, x + ux * r, z + uz * r) && !inTallGrass(PATCHES, x + ux * r, z + uz * r);
    const end: [number, number] = ok ? [x + ux * 4, z + uz * 4] : far;
    for (let i = 0; i < 3; i++) {
      await walk(j, acc, end[0], end[1], () => false);
      await walk(j, acc, x, z, () => false);
    }
    expect(ofType(j.msgs, 'battleStart')).toHaveLength(0);
    await j.room.leave(true);
  }, 120_000);
});

describe('TRAINER_SIGHT=on (integration)', () => {
  it('an unbeaten trainer who sees the player holds them; its interact from where they stand starts the fight', async () => {
    const { t, x, z, ux, uz } = trainerApproach(SIGHT_M + 2.5);
    const acc = await register(s);
    const j = await at(acc, x, z);
    const spotted = (): boolean => ofType(j.msgs, 'trainerSpotted').length > 0;
    await walk(j, acc, t.x + ux * 1.5, t.z + uz * 1.5, spotted);
    await waitFor(spotted, 3000);
    expect(ofType(j.msgs, 'trainerSpotted')[0]).toEqual({ type: 'trainerSpotted', trainerId: t.id });
    const p = me(j, acc);
    expect(Math.hypot(p.x - t.x, p.z - t.z)).toBeLessThanOrEqual(SIGHT_M + 0.05);
    expect(Math.hypot(p.x - t.x, p.z - t.z)).toBeGreaterThan(3); // farther than the 3 m interact range
    // held: no step is accepted, and nothing else may be started
    expect(await step(j, acc, p.x - ux * 0.3, p.z - uz * 0.3)).toBe(false);
    const n = j.msgs.length;
    j.room.send('interact', { kind: 'lore', targetId: zoneById(ZONE).lore[0]?.id ?? 'x' });
    await waitFor(() => ofType(j.msgs.slice(n), 'error').length > 0, 3000);
    expect(ofType(j.msgs.slice(n), 'error')[0]).toMatchObject({ code: 'busy', detail: 'spotted' });
    j.room.send('interact', { kind: 'npc', targetId: t.id });
    await waitFor(() => ofType(j.msgs, 'battleStart').length > 0, 5000);
    expect(ofType(j.msgs, 'battleStart')[0]!.format).toBe('trainer');
    await j.room.leave(true);
  }, 120_000);

  it('a beaten trainer looks the other way', async () => {
    const { t, x, z, ux, uz } = trainerApproach(SIGHT_M + 2.5);
    const acc = await register(s);
    await s.repos.db.transaction((tx) => s.repos.progress.setFlags(tx, acc.id, [`trainer:${t.id}:beaten`], new Date()));
    const j = await at(acc, x, z);
    await walk(j, acc, t.x + ux * 3.5, t.z + uz * 3.5, () => false);
    await sleep(300);
    expect(ofType(j.msgs, 'trainerSpotted')).toHaveLength(0);
    expect(Math.hypot(me(j, acc).x - (t.x + ux * 3.5), me(j, acc).z - (t.z + uz * 3.5))).toBeLessThan(0.05);
    await j.room.leave(true);
  }, 120_000);
});
