/**
 * Breeding (content daycare.ts; routes/daycare.ts; rooms/eggWalk.ts), on a real server with an SDK client:
 * - two creatures left at the Daycare (Mirevale) that can breed start the egg timer; the egg is collected once it is
 *   ready and is carried; a pair that cannot breed says why; a third is refused; taking one back stops the timer;
 * - a carried egg counts the metres the player walks and hatches when they reach its total: the inventoryDelta adds
 *   the hatchling to the party, then `eggHatched`; the hatchling is the first parent's first stage at level 1 with the
 *   egg moves, the parents' average honor, bandborn from a Majin + Tenjin pair, and its history starts `hatched`;
 * - the Daycare is refused away from Mirevale, and during an active challenge run.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CHALLENGE_MODE_FLAG, EGG_READY_MS, getHeightfield, nearestWalkable } from '@ewa/content';
import type { ZoneId } from '@ewa/content';
import { newCreature } from '../src/game/creatures';
import { api, content, enter, ofType, placePlayer, rawQuery, register, sleep, startServer, waitFor } from './helpers';
import type { Account, Joined, TestServer } from './helpers';

let s: TestServer;
beforeAll(async () => {
  s = await startServer();
}, 120_000);
afterAll(async () => {
  await s?.stop();
}, 60_000);

async function inZone(zoneId: ZoneId, x: number, z: number): Promise<{ acc: Account; j: Joined }> {
  const a = await register(s);
  const p = nearestWalkable(getHeightfield(zoneId), x, z, 12)!;
  await placePlayer(s, a.id, zoneId, p[0], p[1]);
  return { acc: a, j: await enter(s, a, zoneId) };
}

async function grant(acc: Account, speciesId: string, level: number, over: { moves?: string[]; honor?: number; nickname?: string } = {}): Promise<string> {
  const base = newCreature(content, speciesId, level, { ownerId: acc.id, nickname: over.nickname ?? null });
  const moves = over.moves === undefined ? base.moves : over.moves.map((id) => ({ id, pp: content.move(id).pp, ppMax: content.move(id).pp }));
  const c = await s.repos.db.transaction((tx) => s.repos.creatures.insert(tx, { ...base, moves, ...(over.honor !== undefined ? { honor: over.honor } : {}) }, { kind: 'box', index: 'nextBox' }));
  return c.id;
}

/** Runs back and forth along x in legal running steps until `done` (or `maxSteps`). */
async function walk(j: Joined, id: string, maxSteps: number, done: () => boolean): Promise<void> {
  let seq = j.room.state.players.get(id)!.seq;
  let dir = 1;
  const x0 = j.room.state.players.get(id)!.x;
  for (let i = 0; i < maxSteps && !done(); i++) {
    const me = j.room.state.players.get(id);
    if (me === undefined) return;
    if (Math.abs(me.x + dir * 0.34 - x0) > 6) dir = -dir;
    seq += 1;
    j.room.send('input', { seq, x: me.x + dir * 0.34, z: me.z, angle: dir > 0 ? Math.PI / 2 : -Math.PI / 2, running: true, dtMs: 50 });
    const target = seq;
    await waitFor(() => (j.room.state.players.get(id)?.seq ?? target) >= target || done(), 2000).catch(() => undefined);
    await sleep(52);
  }
}

describe('the Daycare', () => {
  it('a Majin + Tenjin pair lays a bandborn egg that hatches after the steps: moves, honor, history', async () => {
    const { acc, j } = await inZone('mirevale', 0, 6);
    const bad = await grant(acc, 'badlander', 35, { moves: ['Crunch', 'Night Slash', 'Bulldoze', 'Sucker Punch'], honor: -2, nickname: 'Rex' });
    const law = await grant(acc, 'lawlander', 35, { moves: ['Earthquake', 'Mach Punch', 'Protect'], honor: 8 });

    expect((await api(s, 'GET', '/daycare', acc.access)).body).toMatchObject({ zoneId: 'mirevale', pair: [], refusal: null, hatches: null, eggAt: null, eggs: [] });
    const one = await api(s, 'POST', '/daycare/leave', acc.access, { id: bad });
    expect(one.status).toBe(200);
    expect(one.body.daycare).toMatchObject({ pair: [{ id: bad }], hatches: null, eggAt: null });
    expect(one.body.box.some((c: { id: string }) => c.id === bad)).toBe(false);
    const two = await api(s, 'POST', '/daycare/leave', acc.access, { id: law });
    expect(two.body.daycare).toMatchObject({ refusal: null, hatches: 'dustcub', bandborn: true, eggReady: false });
    expect(Date.parse(two.body.daycare.eggAt)).toBeGreaterThan(s.time.clock() + EGG_READY_MS - 5_000);
    // a third is refused; the egg is not ready yet
    const third = await grant(acc, 'dustcub', 10);
    expect((await api(s, 'POST', '/daycare/leave', acc.access, { id: third })).body.code).toBe('daycareFull');
    expect((await api(s, 'POST', '/daycare/collect', acc.access, {})).body.code).toBe('noEgg');

    s.time.advance(EGG_READY_MS + 1_000);
    expect((await api(s, 'GET', '/daycare', acc.access)).body.eggReady).toBe(true);
    const got = await api(s, 'POST', '/daycare/collect', acc.access, {});
    expect(got.status).toBe(200);
    expect(got.body.daycare.eggReady).toBe(false);
    expect(got.body.daycare.eggs).toEqual([expect.objectContaining({ place: 'party', stepsWalked: 0, stepsTotal: 900, bandborn: true, parents: ['Rex', 'Lawlander'] })]);
    expect((await api(s, 'POST', '/daycare/collect', acc.access, {})).body.code).toBe('noEgg');

    // the egg is nearly there: the next written metres hatch it
    await rawQuery(s.db, 'update eggs set steps_walked = steps_total - 3 where owner_id = $1', [acc.id]);
    await walk(j, acc.id, 150, () => ofType(j.msgs, 'eggHatched').length > 0);
    const hatched = ofType(j.msgs, 'eggHatched');
    expect(hatched).toHaveLength(1);
    const h = hatched[0]!;
    expect(h).toMatchObject({ placement: 'party', parents: ['Rex', 'Lawlander'], zoneId: 'mirevale' });
    expect(h.creature).toMatchObject({ speciesId: 'dustcub', level: 1, honor: 3, bandborn: true, caughtAt: null });
    // egg moves: what the parents know that dustcub learns by level-up or TM, in place of its oldest level moves
    expect(h.creature.moves.map((m) => m.id)).toEqual(['Crunch', 'Night Slash', 'Bulldoze', 'Sucker Punch']);
    const delta = ofType(j.msgs, 'inventoryDelta').find((m) => m.creaturesAdded.some((c) => c.id === h.creature.id))!;
    expect(delta.placement).toEqual({ [h.creature.id]: 'party' });
    expect(j.msgs.indexOf(delta)).toBeLessThan(j.msgs.indexOf(h));
    expect(ofType(j.msgs, 'progressionDelta').some((m) => m.dexCaught?.includes('dustcub'))).toBe(true);
    const hist = await api(s, 'GET', `/creature/${h.creature.id}/history`, acc.access);
    expect(hist.body.events).toEqual([expect.objectContaining({ kind: 'hatched', speciesId: 'dustcub', zoneId: 'mirevale', parents: ['Rex', 'Lawlander'], trainer: acc.username })]);
    expect((await api(s, 'GET', '/daycare', acc.access)).body.eggs).toEqual([]);

    // taking one back: to the party while it has room; the timer stops
    const back = await api(s, 'POST', '/daycare/take', acc.access, { id: bad });
    expect(back.status).toBe(200);
    expect(back.body.party.some((c: { id: string }) => c.id === bad)).toBe(true);
    expect(back.body.daycare).toMatchObject({ pair: [{ id: law }], eggAt: null, hatches: null });
    j.room.leave();
  }, 90_000);

  it("says why a pair cannot breed; an egg moves to the box and back, never someone else's", async () => {
    const { acc, j } = await inZone('mirevale', 0, 6);
    const a = await grant(acc, 'dustcub', 12);
    const b = await grant(acc, 'glimp', 12);
    await api(s, 'POST', '/daycare/leave', acc.access, { id: a });
    const r = await api(s, 'POST', '/daycare/leave', acc.access, { id: b });
    expect(r.body.daycare).toMatchObject({ refusal: 'unrelated', hatches: null, eggAt: null });
    expect((await api(s, 'POST', '/daycare/collect', acc.access, {})).body.code).toBe('noEgg');
    // an egg to move: laid directly
    const egg = await s.repos.db.transaction((tx) =>
      s.repos.breeding.insertEgg(tx, { ownerId: acc.id, place: 'party', speciesId: 'dustcub', stepsTotal: 900, honor: 0, variantKey: 'normal', ability: 'Sand Veil', moves: [], isShiny: false, bandborn: false, parents: [{ speciesId: 'dustcub', nickname: null }, { speciesId: 'glimp', nickname: null }], zoneId: 'mirevale' }, new Date()),
    );
    const moved = await api(s, 'POST', `/eggs/${egg.id}/move`, acc.access, { place: 'box' });
    expect(moved.body.daycare.eggs).toEqual([expect.objectContaining({ id: egg.id, place: 'box' })]);
    expect((await api(s, 'POST', `/eggs/${egg.id}/move`, acc.access, { place: 'party' })).body.daycare.eggs[0].place).toBe('party');
    const other = await register(s);
    expect((await api(s, 'POST', `/eggs/${egg.id}/move`, other.access, { place: 'box' })).status).toBe(404);
    j.room.leave();
  }, 60_000);

  it('refuses away from Mirevale, a legendary pair, and during a challenge run', async () => {
    const { acc, j } = await inZone('mire_route', 0, 0);
    const a = await grant(acc, 'dustcub', 12);
    expect((await api(s, 'POST', '/daycare/leave', acc.access, { id: a })).body.code).toBe('notAtDaycare');
    j.room.leave();

    const run = await inZone('mirevale', 0, 6);
    const c = await grant(run.acc, 'dustcub', 12);
    await s.repos.db.transaction((tx) => s.repos.progress.setFlags(tx, run.acc.id, [CHALLENGE_MODE_FLAG.nuzlocke], new Date()));
    expect((await api(s, 'POST', '/daycare/leave', run.acc.access, { id: c })).body.code).toBe('challenge');
    run.j.room.leave();

    const leg = await inZone('mirevale', 0, 6);
    const l1 = await grant(leg.acc, 'hyoryu', 60);
    const l2 = await grant(leg.acc, 'glacinid', 50);
    await api(s, 'POST', '/daycare/leave', leg.acc.access, { id: l1 });
    expect((await api(s, 'POST', '/daycare/leave', leg.acc.access, { id: l2 })).body.daycare).toMatchObject({ refusal: 'legendary', hatches: null });
    leg.j.room.leave();
  }, 60_000);
});
