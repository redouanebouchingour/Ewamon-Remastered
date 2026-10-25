/**
 * Followers with field powers (content fieldPowers.ts, SPEC §3.18) on the server.
 *
 * Pure:
 *   - the glide in movement validation: a take-off along content's plan is accepted (and held) only with `canGlide`,
 *     positions on the glide line until the landing, nothing off it; with FIELD_POWERS off nothing changes;
 *   - an unburnt bramble's blocker (`brambleSolidsFor`) is unstandable like a shut gate;
 *   - the lead (`fieldLeadOf`), the sense list (`senseGhosts`, `hauntingNear`) and the refusal copy.
 * Integration (real server + SDK client, PGlite, FIELD_POWERS on):
 *   - `PlayerState.lead` / `leadFlags` at join and after a REST reorder (`ewa:party`); `state.fieldPowers`;
 *   - burn: refused without a Fire lead, the bramble blocks until burnt, then the cache and a clear path;
 *   - dig: once per camp per UTC day (the next day digs again); dive: only out on the water;
 *   - sense: this zone's ghosts (never the player's own), the wanted flag, the cooldown;
 *   - a glide off a cliff with a Flying lead, and the same take-off refused for a lead that cannot fly.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { matchMaker } from '@colyseus/core';
import {
  DIG_SPOTS,
  DIVE_SPOTS,
  GLIDE,
  HAUNT,
  brambleFlag,
  brambleSolid,
  brambleSolidsFor,
  bramblesFor,
  digFlag,
  getHeightfield,
  hauntPath,
  hauntPosition,
  isWalkable,
  planGlide,
  reachFromSpawn,
  zone as zoneById,
  zonePlan,
} from '@ewa/content';
import type { GlidePlan, Heightfield, ZoneId } from '@ewa/content';
import { decodeLeadFlags } from '@ewa/protocol';
import type { ZoneRoom } from '../src/rooms/ZoneRoom';
import { standable, validateInput } from '../src/rooms/movement';
import type { MovePrev } from '../src/rooms/movement';
import { fieldLeadOf, fieldRefusalText, hauntingNear, leadCan, senseGhosts } from '../src/game/fieldPowers';
import { newCreature } from '../src/game/creatures';
import { FIELD_POWER_REFUSALS, FIELD_POWER_ACTIONS } from '@ewa/protocol';
import { api, content, enter, ofType, placePlayer, rawQuery, register, sleep, startServer, storyOnly, waitFor } from './helpers';
import type { Account, Joined, TestServer } from './helpers';

const GLIDE_ZONE: ZoneId = 'mire_route';

/** The first glide found scanning the zone's walkable ground (a cliff edge, 8 headings), and its heading. */
function findGlide(zoneId: ZoneId, minDist = 6): GlidePlan {
  const h = getHeightfield(zoneId);
  const reach = reachFromSpawn(zoneId);
  const z = zoneById(zoneId);
  for (let x = -60; x <= 60; x += 1) {
    for (let zz = -60; zz <= 60; zz += 1) {
      if (!isWalkable(h, x, zz) || Math.hypot(x - z.spawn.x, zz - z.spawn.z) < 12) continue;
      const col = Math.round((x - h.originX) / h.step);
      const row = Math.round((zz - h.originZ) / h.step);
      if (reach[row * h.res + col] !== 1) continue;
      for (let a = 0; a < 8; a++) {
        const dx = Math.cos((a * Math.PI) / 4);
        const dz = Math.sin((a * Math.PI) / 4);
        if (isWalkable(h, x + dx * 0.5, zz + dz * 0.5)) continue;
        const p = planGlide(h, x, zz, dx, dz, (px, pz) => isWalkable(h, px, pz), reach);
        if (p !== null && p.dist >= minDist) return p;
      }
    }
  }
  throw new Error(`no glide in ${zoneId}`);
}

const prev = (x: number, z: number, o: Partial<MovePrev> = {}): MovePrev => ({ x, z, lastSeq: 0, budgetMs: 250, inBattle: false, ...o });
const input = (seq: number, x: number, z: number, glide?: GlidePlan, dtMs = 50) => ({
  seq, x, z, angle: 0, running: true, dtMs, ...(glide !== undefined ? { glide: { x: glide.x0, z: glide.z0, dx: glide.dx, dz: glide.dz } } : {}),
});
const along = (p: GlidePlan, t: number): { x: number; z: number } => ({ x: p.x0 + p.dx * t, z: p.z0 + p.dz * t });
/** How far along the plan the first sample a walker cannot stand on lies (the cliff's edge). */
function edgeOf(p: GlidePlan): number {
  const h = getHeightfield(GLIDE_ZONE);
  let t = 0.25;
  while (standable(h, along(p, t).x, along(p, t).z, false)) t += 0.25;
  return t;
}

describe('the glide in movement validation (pure)', () => {
  const h: Heightfield = getHeightfield(GLIDE_ZONE);
  const reach = reachFromSpawn(GLIDE_ZONE);
  const plan = findGlide(GLIDE_ZONE);

  it('content found a real glide: off a cliff, down at least the minimum drop, onto ground the spawn reaches', () => {
    expect(plan.topY - plan.landY).toBeGreaterThanOrEqual(GLIDE.minDropM);
    const land = along(plan, plan.dist);
    expect(isWalkable(h, land.x, land.z)).toBe(true);
    // a step straight off the edge is unwalkable on foot
    const off = along(plan, edgeOf(plan) + 0.05);
    expect(validateInput(prev(plan.x0, plan.z0), input(1, off.x, off.z, undefined, 100), h)).toMatchObject({ ok: false, reason: 'unwalkable' });
  });

  it('accepts the take-off with a Flying lead and holds the plan until the landing', () => {
    const glider = { canGlide: true, reach };
    const first = along(plan, 0.35);
    const v1 = validateInput(prev(plan.x0, plan.z0, glider), input(1, first.x, first.z, plan), h);
    expect(v1.ok).toBe(true);
    if (!v1.ok) return;
    expect(v1.glide).not.toBeNull();
    let held: GlidePlan | null = v1.glide;
    let at = first;
    let seq = 1;
    for (let t = 0.35 + 0.35; t < plan.dist; t += 0.35) {
      const next = along(plan, t);
      const v = validateInput(prev(at.x, at.z, { ...glider, glide: held, lastSeq: seq }), input(seq + 1, next.x, next.z), h);
      expect(v.ok, `t=${t}`).toBe(true);
      if (!v.ok) return;
      held = v.glide;
      at = next;
      seq++;
    }
    const land = along(plan, plan.dist);
    const v = validateInput(prev(at.x, at.z, { ...glider, glide: held, lastSeq: seq }), input(seq + 1, land.x, land.z), h);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.glide).toBeNull();
  });

  it('refuses the take-off without canGlide, off the glide line, and a second take-off mid-flight', () => {
    const first = along(plan, edgeOf(plan) + 0.05);
    expect(validateInput(prev(plan.x0, plan.z0), input(1, first.x, first.z, plan, 100), h)).toMatchObject({ ok: false, reason: 'unwalkable' });
    expect(validateInput(prev(plan.x0, plan.z0, { canGlide: true, reach }), input(1, first.x, first.z, plan, 100), h).ok).toBe(true);
    const glider = { canGlide: true, reach, glide: plan };
    const mid = along(plan, Math.min(2, plan.dist / 2));
    const side = { x: mid.x + plan.dz * 0.36, z: mid.z - plan.dx * 0.36 };
    const from = along(plan, Math.min(2, plan.dist / 2) - 0.1);
    if (!standable(h, side.x, side.z, false)) {
      expect(validateInput(prev(from.x, from.z, glider), input(1, side.x, side.z), h)).toMatchObject({ ok: false, reason: 'unwalkable' });
    }
    // a second take-off from where the flier is now, mid-flight
    const other = { ...plan, x0: from.x, z0: from.z, dx: plan.dz, dz: -plan.dx };
    expect(validateInput(prev(from.x, from.z, glider), input(1, mid.x, mid.z, other), h)).toMatchObject({ ok: false });
  });

  it('refuses a take-off where content plans no glide (flat ground)', () => {
    const z = zoneById(GLIDE_ZONE).spawn;
    const v = validateInput(prev(z.x, z.z, { canGlide: true, reach }), input(1, z.x + 0.3, z.z, { x0: z.x, z0: z.z, dx: 1, dz: 0, dist: 3, topY: 0, landY: 0 }), h);
    expect(v.ok).toBe(false);
  });
});

describe('brambles, the lead, the sense (pure)', () => {
  it('an unburnt bramble is unstandable like a shut gate; burnt, it is gone from the list', () => {
    const zoneId: ZoneId = 'mire_route';
    const h = getHeightfield(zoneId);
    const b = bramblesFor(zoneId)[0]!;
    expect(isWalkable(h, b.x, b.z)).toBe(true);
    const gates = brambleSolidsFor(zoneId, new Set());
    expect(gates.length).toBe(bramblesFor(zoneId).length);
    expect(standable(h, b.x, b.z, false, gates)).toBe(false);
    expect(standable(h, b.x + 2.5, b.z, false, gates)).toBe(true);
    expect(brambleSolidsFor(zoneId, new Set([brambleFlag(zoneId, b.id)])).some((s) => s.x === b.x && s.z === b.z)).toBe(false);
    expect(brambleSolid(b).hw).toBeGreaterThan(1);
  });

  it('the lead is the first creature standing; its look packs into leadFlags', () => {
    const a = { ...newCreature(content, 'flampling', 12, { ownerId: 'x', moves: 'level' }), hp: 0 };
    const b = { ...newCreature(content, 'mudbub', 10, { ownerId: 'x', moves: 'level' }), isShiny: true };
    const lead = fieldLeadOf([a, b], (id) => content.species(id));
    expect(lead?.speciesId).toBe('mudbub');
    expect(decodeLeadFlags(lead!.flags).isShiny).toBe(true);
    expect(decodeLeadFlags(lead!.flags).form).toBe(0);
    expect(fieldLeadOf([a], (id) => content.species(id))).toBeNull();
  });

  it('a lead holding a relic walks in its form: the form rides in leadFlags and its types give the powers', () => {
    const base = newCreature(content, 'ravatar', 50, { ownerId: 'x', moves: 'level' });
    const forms = content.species('ravatar').battleForms!;
    const plain = fieldLeadOf([base], (id) => content.species(id))!;
    expect(plain.types).toEqual(['Normal']);
    expect(decodeLeadFlags(plain.flags).form).toBe(0);
    const water = fieldLeadOf([{ ...base, heldItem: 'spirit_koi_scale' }], (id) => content.species(id))!;
    expect(water.types).toEqual(['Water']);
    expect(forms[decodeLeadFlags(water.flags).form - 1]!.id).toBe('water');
    expect(leadCan(water, 'dive')).toBe(true);
    const earth = fieldLeadOf([{ ...base, heldItem: 'badgermole_gem' }], (id) => content.species(id))!;
    expect(earth.types).toEqual(['Ground', 'Rock']);
    expect(leadCan(earth, 'dig')).toBe(true);
    // the Vial's Avatar State opens below its hp line in a battle, never on the road
    const vial = fieldLeadOf([{ ...base, heldItem: 'spirit_water_vial' }], (id) => content.species(id))!;
    expect(vial.types).toEqual(['Normal']);
    expect(decodeLeadFlags(vial.flags).form).toBe(0);
  });

  it('senses this zone ghosts on their haunts, never your own; the wanted ones wherever they walk', () => {
    const zoneId: ZoneId = 'mire_route';
    const patches = zonePlan(zoneId).grassPatches;
    const ghosts = [
      { playerId: 'g1', name: 'alpha' },
      { playerId: 'g2', name: 'beta' },
      { playerId: 'me', name: 'mine' },
    ];
    const at = hauntPosition(hauntPath('g1', zoneId, patches), 1_000_000)!;
    const list = senseGhosts(ghosts, new Set(['g2']), 'me', zoneId, patches, at[0], at[1], 1_000_000);
    expect(list.map((g) => g.name)).toContain('alpha');
    expect(list.map((g) => g.name)).toContain('beta');
    expect(list.map((g) => g.name)).not.toContain('mine');
    expect(list.find((g) => g.name === 'beta')!.wanted).toBe(true);
    expect(list[0]!.name).toBe('alpha');
    expect(list[0]!.path.length).toBe(Math.min(HAUNT.patches, patches.length));
    expect(hauntingNear(ghosts, zoneId, patches, at[0], at[1], 1_000_000)?.playerId).toBe('g1');
    const far = senseGhosts(ghosts, new Set(), 'me', zoneId, patches, 9999, 9999, 1_000_000);
    expect(far).toEqual([]);
  });

  it('every refusal has player copy without em-dashes', () => {
    for (const why of FIELD_POWER_REFUSALS) for (const a of FIELD_POWER_ACTIONS) expect(fieldRefusalText(why, a)).not.toMatch(/\u2014/);
  });
});

// ─── integration ────────────────────────────────────────────────────────────

let s: TestServer;
beforeAll(async () => {
  s = await startServer({ FIELD_POWERS: 'on' });
}, 120_000);
afterAll(async () => {
  await s?.stop();
}, 60_000);

const tx = <T>(f: (t: Parameters<Parameters<typeof s.repos.db.transaction>[0]>[0]) => Promise<T>): Promise<T> => s.repos.db.transaction(f);
function roomOf(j: Joined): ZoneRoom {
  return matchMaker.getLocalRoomById(j.room.roomId) as unknown as ZoneRoom;
}
/** The account's starter becomes a fresh `species` at `level` (its lead). */
async function leadAs(id: string, species: string, level = 20): Promise<void> {
  await tx(async (t) => {
    const cur = (await s.repos.creatures.party(t, id))[0]!;
    const fresh = newCreature(content, species, level, { ownerId: id, moves: 'level' });
    await s.repos.creatures.update(t, { ...cur, speciesId: species, level, exp: fresh.exp, hp: fresh.hp, moves: fresh.moves, ability: fresh.ability });
  });
}
async function at(acc: Account, zoneId: ZoneId, x: number, z: number): Promise<Joined> {
  await placePlayer(s, acc.id, zoneId, x, z);
  return enter(s, acc, zoneId);
}
function me(j: Joined, acc: Account) {
  return j.room.state.players.get(acc.id)!;
}
async function power(j: Joined, payload: { power: string; targetId: string }, until: (m: Joined['msgs']) => boolean): Promise<Joined['msgs']> {
  const n = j.msgs.length;
  j.room.send('fieldPower', payload);
  await waitFor(() => until(j.msgs.slice(n)), 4000).catch(() => undefined);
  await sleep(150);
  return j.msgs.slice(n);
}
const answered = (m: Joined['msgs']): boolean => m.some((x) => x.type === 'fieldPower' || x.type === 'error');

/** One input (optionally a glide take-off); resolves with whether the authoritative pose moved there. */
async function step(j: Joined, acc: Account, x: number, z: number, glide?: GlidePlan, dtMs = 50): Promise<boolean> {
  const p = me(j, acc);
  const seq = p.seq + 1;
  j.room.send('input', input(seq, x, z, glide, dtMs));
  await waitFor(() => me(j, acc).seq >= seq, 3000);
  await sleep(30);
  const q = me(j, acc);
  return Math.hypot(q.x - x, q.z - z) < 0.05;
}

describe('followers (integration)', () => {
  it('the lead walks with the player: PlayerState.lead / leadFlags at join and after a REST reorder', async () => {
    const acc = await register(s, 'glimfin');
    await tx(async (t) => s.repos.creatures.insert(t, { ...newCreature(content, 'zaptus', 9, { ownerId: acc.id, moves: 'level' }), isShiny: true }, { kind: 'party', index: 1 }));
    const spawn = zoneById('mire_route').spawn;
    const j = await at(acc, 'mire_route', spawn.x, spawn.z);
    expect(j.room.state.fieldPowers).toBe(true);
    await waitFor(() => me(j, acc).lead === 'glimfin', 3000);
    const party = await tx((t) => s.repos.creatures.party(t, acc.id));
    const r = await api(s, 'POST', '/party/reorder', acc.access, { order: [party[1]!.id, party[0]!.id] });
    expect(r.status).toBe(200);
    await waitFor(() => me(j, acc).lead === 'zaptus', 3000);
    expect(decodeLeadFlags(me(j, acc).leadFlags).isShiny).toBe(true);
    await j.room.leave(true);
  }, 60_000);

  it('giving the lead a relic puts its follower in that form at once; taking it back returns the base form', async () => {
    const acc = await register(s, 'glimfin');
    await leadAs(acc.id, 'ravatar', 50);
    await tx((t) => s.repos.inventory.add(t, acc.id, 'sun_dragon_ember', 1));
    const spawn = zoneById('mire_route').spawn;
    const j = await at(acc, 'mire_route', spawn.x, spawn.z);
    await waitFor(() => me(j, acc).lead === 'ravatar', 3000);
    expect(decodeLeadFlags(me(j, acc).leadFlags).form).toBe(0);
    const lead = (await tx((t) => s.repos.creatures.party(t, acc.id)))[0]!;
    const fire = content.species('ravatar').battleForms!.findIndex((f) => f.id === 'fire') + 1;
    const give = await api(s, 'POST', `/creature/${lead.id}/setup`, acc.access, { ability: lead.ability, heldItem: 'sun_dragon_ember' });
    expect(give.status).toBe(200);
    await waitFor(() => decodeLeadFlags(me(j, acc).leadFlags).form === fire, 3000);
    const take = await api(s, 'POST', `/creature/${lead.id}/setup`, acc.access, { ability: lead.ability, heldItem: null });
    expect(take.status).toBe(200);
    await waitFor(() => decodeLeadFlags(me(j, acc).leadFlags).form === 0, 3000);
    await j.room.leave(true);
  }, 60_000);
});

describe('burn (integration)', () => {
  const zoneId: ZoneId = 'mire_route';
  const b = bramblesFor(zoneId)[0]!;
  const west = { x: b.x - 2.6, z: b.z };
  const east = { x: b.x + 2.6, z: b.z };

  it('needs a Fire lead; the patch blocks until burnt, then gives its cache and the way through', async () => {
    const grass = await register(s, 'bramblecub');
    let j = await at(grass, zoneId, west.x, west.z);
    let out = await power(j, { power: 'burn', targetId: b.id }, answered);
    expect(ofType(out, 'error')[0]).toMatchObject({ code: 'notAllowed', detail: 'noPower' });
    await j.room.leave(true);

    const fire = await register(s, 'cindercap');
    j = await at(fire, zoneId, west.x, west.z);
    // straight through the patch: refused while it stands
    let blocked = false;
    for (let x = west.x + 0.35; x <= east.x; x += 0.35) if (!(await step(j, fire, x, b.z))) { blocked = true; break; }
    expect(blocked).toBe(true);
    await j.room.leave(true);
    j = await at(fire, zoneId, west.x, west.z);
    out = await power(j, { power: 'burn', targetId: b.id }, answered);
    expect(ofType(out, 'error')).toEqual([]);
    expect(ofType(out, 'fieldPower')[0]).toMatchObject({ power: 'burn', spotId: b.id, item: b.item.item, qty: b.item.qty });
    expect(ofType(out, 'inventoryDelta')[0]?.items[b.item.item]).toBeGreaterThanOrEqual(b.item.qty);
    const flags = storyOnly((await rawQuery(s.db, 'select flag from story_flags where player_id = $1', [fire.id])).map((x) => x['flag']));
    expect(flags).toContain(brambleFlag(zoneId, b.id));
    for (let x = west.x + 0.35; x <= east.x; x += 0.35) expect(await step(j, fire, x, b.z)).toBe(true);
    out = await power(j, { power: 'burn', targetId: b.id }, answered);
    expect(ofType(out, 'error')[0]).toMatchObject({ code: 'notAllowed' });
    await j.room.leave(true);
  }, 90_000);
});

describe('dig and dive (integration)', () => {
  it('digs at a camp once per UTC day; refuses away from it and without a Ground lead', async () => {
    const zoneId: ZoneId = 'mire_route';
    const camp = DIG_SPOTS[zoneId]![0]!;
    const acc = await register(s);
    await leadAs(acc.id, 'mudbub');
    const far = zoneById(zoneId).spawn;
    let j = await at(acc, zoneId, far.x, far.z);
    let out = await power(j, { power: 'dig', targetId: camp.id }, answered);
    expect(ofType(out, 'error')[0]).toMatchObject({ code: 'notAllowed', detail: 'spotFar' });
    await j.room.leave(true);
    j = await at(acc, zoneId, camp.x, camp.z);
    out = await power(j, { power: 'dig', targetId: camp.id }, answered);
    const found = ofType(out, 'fieldPower')[0];
    expect(found, JSON.stringify(out)).toMatchObject({ power: 'dig', spotId: camp.id });
    expect(found!.item).not.toBeNull();
    out = await power(j, { power: 'dig', targetId: camp.id }, answered);
    expect(ofType(out, 'error')[0]).toMatchObject({ code: 'notAllowed', detail: 'usedToday' });
    s.time.advance(86_400_000);
    out = await power(j, { power: 'dig', targetId: camp.id }, answered);
    expect(ofType(out, 'fieldPower')[0]).toMatchObject({ power: 'dig' });
    const flags = storyOnly((await rawQuery(s.db, 'select flag from story_flags where player_id = $1', [acc.id])).map((x) => x['flag']));
    expect(flags.filter((f) => f === digFlag(zoneId, camp.id)).length).toBe(1);
    await j.room.leave(true);
  }, 60_000);

  it('dives only out on the dark water', async () => {
    const zoneId: ZoneId = 'mire_route';
    const spot = DIVE_SPOTS[zoneId]![0]!;
    const acc = await register(s, 'glimfin');
    const spawn = zoneById(zoneId).spawn;
    const j = await at(acc, zoneId, spawn.x, spawn.z);
    let out = await power(j, { power: 'dive', targetId: spot.id }, answered);
    expect(ofType(out, 'error')[0]).toMatchObject({ detail: 'spotFar' });
    // out on the water over the spot (surfing there is the surf tests' business)
    const ps = roomOf(j).state.players.get(acc.id)!;
    ps.x = spot.x + 0.5;
    ps.z = spot.z;
    out = await power(j, { power: 'dive', targetId: spot.id }, answered);
    expect(ofType(out, 'fieldPower')[0], JSON.stringify(out)).toMatchObject({ power: 'dive', spotId: spot.id });
    await j.room.leave(true);
  }, 60_000);
});

describe('sense (integration)', () => {
  it('a Psychic lead senses the zone ghost trainers, never its own, then rests', async () => {
    const zoneId: ZoneId = 'mire_route';
    const ghost = await register(s);
    await tx(async (t) => s.repos.ghosts.save(t, ghost.id, ghost.username, zoneId, await s.repos.creatures.party(t, ghost.id), new Date(s.time.clock())));
    const acc = await register(s);
    await leadAs(acc.id, 'zaptus');
    await tx(async (t) => s.repos.ghosts.save(t, acc.id, acc.username, zoneId, await s.repos.creatures.party(t, acc.id), new Date(s.time.clock())));
    const g = hauntPosition(hauntPath(ghost.id, zoneId, zonePlan(zoneId).grassPatches), s.time.clock())!;
    const j = await at(acc, zoneId, g[0], g[1]);
    // the room reads its ghosts with the shadow, once a minute (the first tick)
    await sleep(400);
    let out = await power(j, { power: 'sense', targetId: 'here' }, answered);
    const sensed = ofType(out, 'fieldPower')[0];
    expect(sensed, JSON.stringify(out)).toBeDefined();
    expect(sensed!.ghosts.map((x) => x.name)).toContain(ghost.username);
    expect(sensed!.ghosts.map((x) => x.name)).not.toContain(acc.username);
    out = await power(j, { power: 'sense', targetId: 'here' }, answered);
    expect(ofType(out, 'error')[0]).toMatchObject({ detail: 'senseResting' });
    await j.room.leave(true);
  }, 60_000);
});

describe('glide (integration)', () => {
  it('a Flying lead glides off the cliff to the landing; a lead that cannot fly is held at the edge', async () => {
    const plan = findGlide(GLIDE_ZONE);
    const flier = await register(s, 'cindercap');
    await leadAs(flier.id, 'flampling');
    let j = await at(flier, GLIDE_ZONE, plan.x0, plan.z0);
    await waitFor(() => me(j, flier).lead === 'flampling', 3000);
    const start = me(j, flier);
    expect(Math.hypot(start.x - plan.x0, start.z - plan.z0)).toBeLessThan(0.05);
    expect(await step(j, flier, along(plan, 0.35).x, along(plan, 0.35).z, plan)).toBe(true);
    for (let t = 0.7; t < plan.dist; t += 0.35) expect(await step(j, flier, along(plan, t).x, along(plan, t).z, plan), `t=${t}`).toBe(true);
    expect(await step(j, flier, along(plan, plan.dist).x, along(plan, plan.dist).z, plan)).toBe(true);
    expect(roomOf(j).clientOf(flier.id)!.userData!.glide).toBeNull();
    await j.room.leave(true);

    const walker = await register(s, 'bramblecub');
    j = await at(walker, GLIDE_ZONE, plan.x0, plan.z0);
    const off = along(plan, edgeOf(plan) + 0.05);
    expect(await step(j, walker, off.x, off.z, plan, 100)).toBe(false);
    await j.room.leave(true);
  }, 90_000);
});
