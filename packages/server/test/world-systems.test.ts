/**
 * Phase D8–D11 world systems on the server.
 *
 * Pure (movement / spawn director):
 *   - D11 bike: the bike cap only for an owner outdoors (`canBike`); an unearned `bike` flag is checked against the run
 *     cap; a ridden segment never touches open water, HM Surf or not;
 *   - D10 obstacles: a stamped sample is unstandable until the obstacle id is in `clearedObstacles`;
 *   - D9 `rollFishing`: water slots only, deterministic per seed, null without an eligible water slot.
 * Integration (real server + SDK client, scratch Postgres), all in mire_route:
 *   - D8 surf: HM Surf lets a player step off the boardwalk onto open water (`PlayerState.surfing`), never without it;
 *   - D9 fish: refused without the rod (`noRod`) and away from water (`noWater`); a cast from the boardwalk starts a
 *     wild battle against one of the zone's water species; a zone with water but no water slots → `nothingBites`;
 *   - D10 Cut: refused without HM Cut (`needHm`) and without a Grass / Bug / Steel / Dark member (`needType`); cleared
 *     with both — the flag, the hidden item, and the stamped disc is walkable for that player from then on;
 *   - D11 bike: a bike-speed step is accepted for an owner (`PlayerState.biking`) and refused for a non-owner.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { matchMaker } from '@colyseus/core';
import {
  ENCOUNTER_TABLES,
  encounterTableFor,
  getHeightfield,
  isWalkable,
  isWater,
  nearestWalkable,
  obstacleAt,
  obstacleFlag,
  obstacleStampRadius,
  zone as zoneById,
} from '@ewa/content';
import type { Heightfield, ZoneId } from '@ewa/content';
import { createRng } from '@ewa/core';
import type { ZoneRoom } from '../src/rooms/ZoneRoom';
import { MAX_BIKE_STEP, MAX_RUN_STEP, standable, validateInput } from '../src/rooms/movement';
import type { MovePrev } from '../src/rooms/movement';
import { rollFishing } from '../src/rooms/spawnDirector';
import { content, enter, ofType, placePlayer, rawQuery, register, sleep, startServer, storyOnly, waitFor } from './helpers';
import type { Account, Joined, TestServer } from './helpers';

const ZONE: ZoneId = 'mire_route';
const H = getHeightfield(ZONE);
const THICKET = zoneById(ZONE).obstacles!.find((o) => o.id === 'mire_route.thicket')!;

/** A boardwalk sample (walkable + water) with open water 2.5 m to its +z and −z (a pier over the middle of a pond). */
function pierSample(h: Heightfield): { x: number; z: number } {
  for (let row = 0; row < h.res; row++) {
    for (let col = 0; col < h.res; col++) {
      const i = row * h.res + col;
      if (h.walkable[i] !== 1 || h.water[i] !== 1) continue;
      const x = h.originX + col * h.step;
      const z = h.originZ + row * h.step;
      const open = (zz: number): boolean => isWater(h, x, zz) && !isWalkable(h, x, zz);
      if (open(z + 2.5) && open(z - 2.5) && open(z + 3.5)) return { x, z };
    }
  }
  throw new Error('no pier sample');
}

const prev = (x: number, z: number, o: Partial<MovePrev> = {}): MovePrev => ({ x, z, lastSeq: 0, budgetMs: 250, inBattle: false, ...o });
const input = (x: number, z: number, o: { running?: boolean; bike?: boolean } = {}) => ({ seq: 1, x, z, angle: 0, running: o.running ?? true, dtMs: 50, ...(o.bike !== undefined ? { bike: o.bike } : {}) });

describe('Phase D11 bike cap (pure)', () => {
  const at = nearestWalkable(H, zoneById(ZONE).spawn.x, zoneById(ZONE).spawn.z, 4)!;
  // a walkable 0.55 m step east of the spawn (bike cap 12.075 × 0.05 + 0.02 = 0.62; run cap 0.4225)
  const step = 0.55;
  it('accepts a bike-speed step only for an owner outdoors, and only when flagged', () => {
    expect(step).toBeGreaterThan((MAX_RUN_STEP * 50) / 1000 + 0.02);
    expect(step).toBeLessThan((MAX_BIKE_STEP * 50) / 1000 + 0.02);
    const ok = validateInput(prev(at[0], at[1], { canBike: true }), input(at[0] + step, at[1], { bike: true }), H);
    expect(ok.ok && ok.bike).toBe(true);
    expect(validateInput(prev(at[0], at[1], { canBike: false }), input(at[0] + step, at[1], { bike: true }), H)).toMatchObject({ ok: false, reason: 'speed' });
    expect(validateInput(prev(at[0], at[1], { canBike: true }), input(at[0] + step, at[1], { bike: false }), H)).toMatchObject({ ok: false, reason: 'speed' });
    const walk = validateInput(prev(at[0], at[1], { canBike: true }), input(at[0] + 0.2, at[1], { bike: false }), H);
    expect(walk.ok && !walk.bike).toBe(true);
  });

  it('a ridden segment never enters open water, HM Surf or not', () => {
    const p = pierSample(H);
    const surfOk = validateInput(prev(p.x, p.z, { canSurf: true }), input(p.x, p.z + 0.4), H);
    expect(surfOk.ok).toBe(true);
    // 2.5 m off the pier in 0.5 m bike steps would need several messages; one bike step off the boardwalk edge is refused
    let z = p.z;
    while (isWalkable(H, p.x, z + 0.25)) z += 0.25;
    expect(validateInput(prev(p.x, z, { canSurf: true, canBike: true }), input(p.x, z + 0.5, { bike: true }), H)).toMatchObject({ ok: false, reason: 'unwalkable' });
    expect(validateInput(prev(p.x, z, { canSurf: true, canBike: true }), input(p.x, z + 0.4, { bike: false }), H).ok).toBe(true);
  });
});

describe('Phase D10 obstacles in movement (pure)', () => {
  it('the stamped disc is unstandable until the obstacle is cleared, for that player only', () => {
    expect(obstacleAt(H, THICKET.x, THICKET.z)).toBe(THICKET.id);
    expect(isWalkable(H, THICKET.x, THICKET.z)).toBe(false);
    expect(standable(H, THICKET.x, THICKET.z, false)).toBe(false);
    expect(standable(H, THICKET.x, THICKET.z, false, undefined, new Set([THICKET.id]))).toBe(true);
    expect(standable(H, THICKET.x, THICKET.z, true, undefined, new Set(['mire_route.other']))).toBe(false);
    const r = obstacleStampRadius(THICKET.kind);
    const from = { x: THICKET.x - r - 0.6, z: THICKET.z };
    expect(isWalkable(H, from.x, from.z)).toBe(true);
    expect(validateInput(prev(from.x, from.z), input(from.x + 0.1, from.z), H).ok).toBe(true); // still outside (nearest sample ≥ 1.15 m away)
    const into = (cleared: ReadonlySet<string>) => validateInput(prev(THICKET.x - 0.3, THICKET.z, { clearedObstacles: cleared }), input(THICKET.x + 0.1, THICKET.z), H);
    expect(into(new Set()).ok).toBe(false);
    expect(into(new Set([THICKET.id])).ok).toBe(true);
  });
});

describe('Phase D9 rollFishing (pure)', () => {
  const table = encounterTableFor(ZONE);
  it('rolls only water slots, deterministically per seed', () => {
    const water = new Set(table!.slots.filter((s) => s.medium === 'water').map((s) => s.species));
    expect(water.size).toBeGreaterThan(0);
    const a = createRng('fish-seed');
    const b = createRng('fish-seed');
    for (let i = 0; i < 200; i++) {
      const tod = (i % 20) / 20;
      const ra = rollFishing(table, a, content, tod, { x: 1, z: 2 }, `f${i}`, 0)!;
      const rb = rollFishing(table, b, content, tod, { x: 1, z: 2 }, `f${i}`, 0)!;
      expect(ra).toEqual(rb);
      expect(water.has(ra.speciesId)).toBe(true);
      expect(ra.medium).toBe('water');
      const slot = table!.slots.find((s) => s.species === ra.speciesId && s.medium === 'water')!;
      expect(ra.level).toBeGreaterThanOrEqual(slot.levelMin);
      expect(ra.level).toBeLessThanOrEqual(slot.levelMax);
    }
  });
  it('nothing bites in a table without water slots (or without a table)', () => {
    const dry = ENCOUNTER_TABLES.find((t) => !t.slots.some((s) => s.medium === 'water'))!;
    expect(rollFishing(dry, createRng(1), content, 0.5, { x: 0, z: 0 }, 'x', 0)).toBeNull();
    expect(rollFishing(null, createRng(1), content, 0.5, { x: 0, z: 0 }, 'x', 0)).toBeNull();
  });
});

// ─── integration ────────────────────────────────────────────────────────────

let s: TestServer;

beforeAll(async () => {
  s = await startServer();
}, 120_000);
afterAll(async () => {
  await s?.stop();
}, 60_000);

function roomOf(j: Joined): ZoneRoom {
  return matchMaker.getLocalRoomById(j.room.roomId) as unknown as ZoneRoom;
}

async function give(acc: Account, items: Readonly<Record<string, number>>): Promise<void> {
  await s.repos.db.transaction(async (tx) => {
    for (const [item, qty] of Object.entries(items)) await s.repos.inventory.add(tx, acc.id, item, qty);
  });
}

async function at(acc: Account, zoneId: ZoneId, x: number, z: number): Promise<Joined> {
  await placePlayer(s, acc.id, zoneId, x, z);
  return enter(s, acc, zoneId);
}

function me(j: Joined, acc: Account): { x: number; z: number; seq: number; surfing: boolean; biking: boolean } {
  return j.room.state.players.get(acc.id)!;
}

/** One input; resolves with whether the authoritative pose moved there. */
async function step(j: Joined, acc: Account, x: number, z: number, o: { bike?: boolean } = {}): Promise<boolean> {
  const p = me(j, acc);
  const seq = p.seq + 1;
  j.room.send('input', { seq, x, z, angle: Math.atan2(x - p.x, z - p.z), running: true, dtMs: 50, ...(o.bike !== undefined ? { bike: o.bike } : {}) });
  await waitFor(() => me(j, acc).seq >= seq, 3000);
  await sleep(60);
  const q = me(j, acc);
  return Math.hypot(q.x - x, q.z - z) < 0.05;
}

async function walk(j: Joined, acc: Account, tx: number, tz: number): Promise<boolean> {
  for (let guard = 0; guard < 400; guard++) {
    const p = me(j, acc);
    const d = Math.hypot(tx - p.x, tz - p.z);
    if (d < 0.05) return true;
    const k = Math.min(1, 0.35 / d);
    if (!(await step(j, acc, p.x + (tx - p.x) * k, p.z + (tz - p.z) * k))) return false;
  }
  return false;
}

async function send(j: Joined, type: 'fish' | 'interact', payload: unknown, until: () => boolean): Promise<Joined['msgs']> {
  const n = j.msgs.length;
  j.room.send(type, payload);
  await waitFor(until, 3000).catch(() => undefined);
  await sleep(200);
  return j.msgs.slice(n);
}

describe('Phase D8 surf (integration)', () => {
  it('steps off the boardwalk onto open water only with HM Surf; PlayerState.surfing follows', async () => {
    const p = pierSample(H);
    const surfer = await register(s);
    await give(surfer, { 'HM Surf': 1 });
    const j = await at(surfer, ZONE, p.x, p.z);
    expect(me(j, surfer).surfing).toBe(false);
    expect(await walk(j, surfer, p.x, p.z + 2.5)).toBe(true);
    await waitFor(() => me(j, surfer).surfing, 2000);
    expect(await walk(j, surfer, p.x, p.z)).toBe(true);
    await waitFor(() => !me(j, surfer).surfing, 2000);
    await j.room.leave(true);

    const walker = await register(s);
    const k = await at(walker, ZONE, p.x, p.z);
    expect(await walk(k, walker, p.x, p.z + 2.5)).toBe(false);
    expect(me(k, walker).surfing).toBe(false);
    await k.room.leave(true);
  }, 60_000);
});

describe('Phase D9 fishing (integration)', () => {
  it('needs the rod and water ahead; a cast from the pier starts a wild battle against a water species', async () => {
    const p = pierSample(H);
    const acc = await register(s);
    const j = await at(acc, ZONE, p.x, p.z);
    let out = await send(j, 'fish', { angle: 0 }, () => ofType(j.msgs, 'error').length > 0);
    expect(ofType(out, 'error')[0]).toMatchObject({ code: 'notAllowed', detail: 'noRod' });
    expect(ofType(out, 'toast').length).toBe(1);
    await j.room.leave(true);
    await sleep(250);

    await give(acc, { old_rod: 1 });
    const spawn = zoneById(ZONE).spawn;
    const dry = await at(acc, ZONE, spawn.x, spawn.z);
    out = await send(dry, 'fish', { angle: 0 }, () => ofType(dry.msgs, 'error').length > 0);
    expect(ofType(out, 'error')[0]).toMatchObject({ code: 'notAllowed', detail: 'noWater' });
    await dry.room.leave(true);
    await sleep(250);

    const wet = await at(acc, ZONE, p.x, p.z);
    out = await send(wet, 'fish', { angle: 0 }, () => ofType(wet.msgs, 'battleStart').length > 0);
    const start = ofType(out, 'battleStart')[0];
    expect(start, JSON.stringify(out)).toBeDefined();
    expect(start!.format).toBe('wild');
    const water = new Set(encounterTableFor(ZONE)!.slots.filter((x) => x.medium === 'water').map((x) => x.species));
    expect(water.has(start!.state.sides[1].party[0]!.creature.speciesId)).toBe(true);
    expect(roomOf(wet).clientOf(acc.id)!.userData!.battleId).toBe(start!.battleId);
    // a second cast while battling is busy
    await sleep(1600);
    out = await send(wet, 'fish', { angle: 0 }, () => ofType(wet.msgs, 'error').length > 0);
    expect(ofType(out, 'error')[0]).toMatchObject({ code: 'busy' });
    await wet.room.leave(true);
  }, 60_000);

  it('a zone with water but no water slots: nothing bites', async () => {
    const town: ZoneId = 'mirevale';
    const h = getHeightfield(town);
    expect(encounterTableFor(town)).toBeNull();
    let spot: { x: number; z: number } | null = null;
    for (let i = 0; i < h.walkable.length && spot === null; i++) {
      if (h.walkable[i] !== 1 || h.water[i] !== 1) continue;
      const row = Math.floor(i / h.res);
      spot = { x: h.originX + (i - row * h.res) * h.step, z: h.originZ + row * h.step };
    }
    const acc = await register(s);
    await give(acc, { old_rod: 1 });
    const j = await at(acc, town, spot!.x, spot!.z);
    const out = await send(j, 'fish', { angle: 0 }, () => ofType(j.msgs, 'error').length > 0);
    expect(ofType(out, 'error')[0]).toMatchObject({ code: 'notAllowed', detail: 'nothingBites' });
    await j.room.leave(true);
  }, 60_000);
});

describe('Phase D10 Cut (integration)', () => {
  const r = obstacleStampRadius(THICKET.kind);
  const west = { x: THICKET.x - r - 0.8, z: THICKET.z };
  const east = { x: THICKET.x + r + 0.8, z: THICKET.z };

  it('refuses without HM Cut and without a Grass / Bug / Steel / Dark member; clears with both', async () => {
    expect(isWalkable(H, west.x, west.z) && isWalkable(H, east.x, east.z)).toBe(true);
    const fire = await register(s, 'cindercap');
    let j = await at(fire, ZONE, west.x, west.z);
    let out = await send(j, 'interact', { kind: 'obstacle', targetId: THICKET.id }, () => ofType(j.msgs, 'error').length > 0);
    expect(ofType(out, 'error')[0]).toMatchObject({ code: 'notAllowed', detail: 'needHm' });
    await j.room.leave(true);
    await sleep(250);
    await give(fire, { 'HM Cut': 1 });
    j = await at(fire, ZONE, west.x, west.z);
    out = await send(j, 'interact', { kind: 'obstacle', targetId: THICKET.id }, () => ofType(j.msgs, 'error').length > 0);
    expect(ofType(out, 'error')[0]).toMatchObject({ code: 'notAllowed', detail: 'needType' });
    expect(await walk(j, fire, east.x, east.z)).toBe(false); // the tree still stands for this player
    await j.room.leave(true);

    const grass = await register(s, 'bramblecub');
    await give(grass, { 'HM Cut': 1 });
    const g = await at(grass, ZONE, west.x, west.z);
    expect(await walk(g, grass, east.x, east.z)).toBe(false);
    const back = await walk(g, grass, west.x, west.z);
    expect(back).toBe(true);
    const flag = obstacleFlag(ZONE, THICKET.id);
    out = await send(g, 'interact', { kind: 'obstacle', targetId: THICKET.id }, () => ofType(g.msgs, 'progressionDelta').some((d) => d.flags?.includes(flag) === true));
    expect(ofType(out, 'error')).toEqual([]);
    expect(ofType(out, 'inventoryDelta')[0]?.items).toEqual({ [THICKET.item!.item]: 1 });
    expect(ofType(out, 'toast').some((t) => t.level === 'success')).toBe(true);
    const flags = storyOnly((await rawQuery(s.db, 'select flag from story_flags where player_id = $1', [grass.id])).map((x) => x['flag']));
    expect(flags).toContain(flag);
    // the disc is walkable for this player now (straight through the trunk)
    expect(await walk(g, grass, east.x, east.z)).toBe(true);
    // a second clear is refused
    await sleep(300);
    out = await send(g, 'interact', { kind: 'obstacle', targetId: THICKET.id }, () => ofType(g.msgs, 'error').length > ofType(out, 'error').length);
    expect(ofType(g.msgs, 'error').at(-1)).toMatchObject({ code: 'notAllowed', detail: 'alreadyCleared' });
    await g.room.leave(true);
  }, 90_000);
});

describe('Phase D11 bike (integration)', () => {
  it('a bike-speed step is accepted for an owner (PlayerState.biking) and refused for a non-owner', async () => {
    const sp = zoneById(ZONE).spawn;
    const start = nearestWalkable(H, sp.x, sp.z, 4)!;
    const owner = await register(s);
    await give(owner, { bike: 1 });
    const j = await at(owner, ZONE, start[0], start[1]);
    expect(await step(j, owner, start[0] + 0.55, start[1], { bike: true })).toBe(true);
    await waitFor(() => me(j, owner).biking, 2000);
    expect(await step(j, owner, start[0] + 0.75, start[1], { bike: false })).toBe(true);
    await waitFor(() => !me(j, owner).biking, 2000);
    await j.room.leave(true);

    const other = await register(s);
    const k = await at(other, ZONE, start[0], start[1]);
    expect(await step(k, other, start[0] + 0.55, start[1], { bike: true })).toBe(false);
    expect(me(k, other).biking).toBe(false);
    await k.room.leave(true);
  }, 60_000);
});
