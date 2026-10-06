/**
 * Phase C3 — visited flags and fast travel (room-level, real server + SDK clients):
 * - registration writes `visited:<starting zone>`; joining another zone writes `visited:<zone>` once (story_flags + one
 *   progressionDelta); a rejoin writes nothing;
 * - `fastTravel { zoneId }` to a visited town answers with a `handover` to that town's arrival point (content
 *   `arrivalPoint`: Mirevale's spawn (0, 6); the plaza of every other town, not its west-road spawn); the destination
 *   validates it like an edge crossing, faces the player toward the plaza, and the ack writes the row;
 * - refusals are a warn toast + `error notAllowed <reason>`: notVisited, notTown, travelGated, travelBusy (in battle), travelCooldown.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { arrivalPoint, getHeightfield, isWalkable, nearestWalkable, visitedFlag, zone } from '@ewa/content';
import type { ZoneId } from '@ewa/content';
import type { SeatReservation, ServerMessage } from '@ewa/protocol';
import { pickZoneRoom, reserveZoneSeat } from '../src/rooms/matchmaking';
import { enter, joinSeat, ofType, placePlayer, rawQuery, register, sleep, startServer, waitFor } from './helpers';
import type { Account, Joined, TestServer } from './helpers';

let s: TestServer;

beforeAll(async () => {
  s = await startServer();
}, 120_000);
afterAll(async () => {
  await s?.stop();
}, 60_000);

async function inZone(zoneId: ZoneId, x: number, z: number, acc?: Account): Promise<{ acc: Account; j: Joined }> {
  const a = acc ?? (await register(s));
  const p = nearestWalkable(getHeightfield(zoneId), x, z, 12)!;
  await placePlayer(s, a.id, zoneId, p[0], p[1]);
  return { acc: a, j: await enter(s, a, zoneId) };
}

async function grantFlags(acc: Account, flags: readonly string[]): Promise<void> {
  await s.repos.db.transaction((tx) => s.repos.progress.setFlags(tx, acc.id, flags, new Date()));
}

async function dbFlags(acc: Account): Promise<string[]> {
  return (await rawQuery(s.db, 'select flag from story_flags where player_id = $1', [acc.id])).map((r) => String(r['flag']));
}

const visitedDeltas = (msgs: readonly ServerMessage[]): string[][] =>
  ofType(msgs, 'progressionDelta')
    .map((m) => (m.flags ?? []).filter((f) => f.startsWith('visited:')))
    .filter((f) => f.length > 0);

/** Sends `fastTravel` and waits for the answer (a handover, an error, or a toast for a same-zone hop). */
async function travel(j: Joined, zoneId: ZoneId): Promise<ServerMessage[]> {
  const n = j.msgs.length;
  j.room.send('fastTravel', { zoneId });
  await waitFor(() => j.msgs.slice(n).some((m) => m.type === 'handover' || m.type === 'error' || m.type === 'toast'), 5000);
  await sleep(100);
  return j.msgs.slice(n);
}

describe('Phase C3 visited flags', () => {
  it('registration marks the starting zone visited; joining it sends nothing', async () => {
    const acc = await register(s);
    expect(await dbFlags(acc)).toContain(visitedFlag('mirevale'));
    const j = await enter(s, acc, 'mirevale');
    await sleep(500);
    expect(visitedDeltas(j.msgs)).toEqual([]);
    await j.room.leave(true);
  }, 60_000);

  it('the first join of another zone writes visited:<zone> once (row + progressionDelta); a rejoin writes nothing', async () => {
    const { acc, j } = await inZone('mire_route', 0, 0);
    await waitFor(() => visitedDeltas(j.msgs).length > 0, 5000);
    expect(visitedDeltas(j.msgs)).toEqual([[visitedFlag('mire_route')]]);
    expect(await dbFlags(acc)).toContain(visitedFlag('mire_route'));
    await j.room.leave(true);
    await sleep(250);
    const again = await enter(s, acc, 'mire_route');
    await sleep(500);
    expect(visitedDeltas(again.msgs)).toEqual([]);
    expect((await dbFlags(acc)).filter((f) => f === visitedFlag('mire_route'))).toHaveLength(1);
    await again.room.leave(true);
  }, 60_000);
});

describe('Phase C3 fast travel', () => {
  it('accepted: a visited town answers with a handover to its spawn; the destination takes the player; the ack writes the row', async () => {
    const acc = await register(s); // visited:mirevale from registration
    const { j } = await inZone('mire_route', 0, 0, acc);
    await waitFor(() => visitedDeltas(j.msgs).length > 0, 5000); // visited:mire_route
    const out = await travel(j, 'mirevale');
    expect(ofType(out, 'error')).toEqual([]);
    const ho = ofType(out, 'handover')[0]!;
    expect(ho).toMatchObject({ zoneId: 'mirevale', x: zone('mirevale').spawn.x, z: zone('mirevale').spawn.z });
    expect(isWalkable(getHeightfield('mirevale'), ho.x, ho.z)).toBe(true);
    const dest = await joinSeat(s, acc.access, ho.seat as SeatReservation);
    await waitFor(() => dest.room.state.players.get(acc.id) !== undefined, 5000);
    expect(dest.room.state.players.get(acc.id)!.x).toBeCloseTo(ho.x, 3);
    expect(dest.room.state.players.get(acc.id)!.z).toBeCloseTo(ho.z, 3);
    dest.room.send('handoverAck', { roomId: dest.room.roomId, seat: dest.room.sessionId });
    await waitFor(() => j.left.code !== null, 6000);
    expect(j.left.code).toBe(4002);
    await sleep(300);
    const [row] = await rawQuery(s.db, 'select zone_id, x, z from players where id = $1', [acc.id]);
    expect(row!['zone_id']).toBe('mirevale');
    expect(Number(row!['z'])).toBeCloseTo(ho.z, 3);
    // an arrival starts the cooldown: travelling again at once is refused
    const again = await travel(dest, 'mirevale');
    expect(ofType(again, 'error')).toEqual([{ type: 'error', code: 'notAllowed', detail: 'travelCooldown' }]);
    await dest.room.leave(true);
  }, 90_000);

  it('another town: the handover lands on its plaza arrival point (not the west-road spawn), facing the centre; a same-zone hop teleports there', async () => {
    const acc = await register(s);
    await s.repos.db.transaction((tx) => s.repos.progress.awardBadge(tx, acc.id, 'bloom', new Date()));
    await grantFlags(acc, [visitedFlag('cinderhold')]);
    const land = arrivalPoint('cinderhold');
    const spawn = zone('cinderhold').spawn;
    expect(Math.hypot(land.x - spawn.x, land.z - spawn.z)).toBeGreaterThan(40);
    const { j } = await inZone('mire_route', 0, 0, acc);
    const out = await travel(j, 'cinderhold');
    expect(ofType(out, 'error')).toEqual([]);
    const ho = ofType(out, 'handover')[0]!;
    expect(ho).toMatchObject({ zoneId: 'cinderhold', x: land.x, z: land.z });
    const dest = await joinSeat(s, acc.access, ho.seat as SeatReservation);
    await waitFor(() => dest.room.state.players.get(acc.id) !== undefined, 5000);
    const me = dest.room.state.players.get(acc.id)!;
    expect([me.x, me.z]).toEqual([land.x, land.z]);
    expect(me.angle).toBeCloseTo(land.angle, 3);
    dest.room.send('handoverAck', { roomId: dest.room.roomId, seat: dest.room.sessionId });
    await waitFor(() => j.left.code !== null, 6000);
    await dest.room.leave(true);
    await sleep(250);
    // standing elsewhere in the town, a hop to it teleports to the same point
    const far = await inZone('cinderhold', 20, 30, acc);
    s.time.advance(3_100);
    const hop = await travel(far.j, 'cinderhold');
    expect(ofType(hop, 'error')).toEqual([]);
    await waitFor(() => far.j.room.state.players.get(acc.id)!.x === land.x && far.j.room.state.players.get(acc.id)!.z === land.z, 3000);
    expect(far.j.room.state.players.get(acc.id)!.angle).toBeCloseTo(land.angle, 3);
    await far.j.room.leave(true);
  }, 90_000);

  it('a fallback join (a seat in a zone the row is not in, no handover) lands on the arrival point, facing the plaza', async () => {
    const acc = await register(s); // row: mirevale (0, 6)
    await s.repos.db.transaction((tx) => s.repos.progress.awardBadge(tx, acc.id, 'bloom', new Date()));
    const other = await register(s);
    await s.repos.db.transaction((tx) => s.repos.progress.awardBadge(tx, other.id, 'bloom', new Date()));
    const keeper = await inZone('cinderhold', 20, 30, other); // keeps the room alive while the seat is reserved
    const room = await pickZoneRoom('cinderhold', s.booted.runtime.ticket);
    const seat = await reserveZoneSeat(room!, { zoneId: 'cinderhold', shard: 0, ticket: s.booted.runtime.ticket });
    const j = await joinSeat(s, acc.access, seat);
    await waitFor(() => j.room.state.players.get(acc.id) !== undefined, 5000);
    const land = arrivalPoint('cinderhold');
    const me = j.room.state.players.get(acc.id)!;
    expect([me.x, me.z]).toEqual([land.x, land.z]);
    expect(me.angle).toBeCloseTo(land.angle, 3);
    await j.room.leave(true);
    await keeper.j.room.leave(true);
  }, 90_000);

  it('refused: not visited, not a town, travelGated; same-zone hop then travelCooldown', async () => {
    const acc = await register(s);
    const { j } = await inZone('mirevale', 0, 6, acc);

    let out = await travel(j, 'cinderhold');
    expect(ofType(out, 'error')).toEqual([{ type: 'error', code: 'notAllowed', detail: 'notVisited' }]);
    expect(ofType(out, 'toast')[0]).toMatchObject({ level: 'warn' });
    expect(ofType(out, 'handover')).toEqual([]);

    await grantFlags(acc, [visitedFlag('mire_route')]);
    out = await travel(j, 'mire_route');
    expect(ofType(out, 'error')).toEqual([{ type: 'error', code: 'notAllowed', detail: 'notTown' }]);

    // the flag cache is per join: rejoin to pick up visited:cinderhold (still without the bloom badge)
    await grantFlags(acc, [visitedFlag('cinderhold')]);
    await j.room.leave(true);
    await sleep(250);
    const k = await enter(s, acc, 'mirevale');
    await sleep(300);
    out = await travel(k, 'cinderhold');
    expect(ofType(out, 'error')).toEqual([{ type: 'error', code: 'notAllowed', detail: 'travelGated' }]);

    // a hop to the town you stand in teleports to its spawn; a second one inside 3 s is the cooldown
    out = await travel(k, 'mirevale');
    expect(ofType(out, 'error')).toEqual([]);
    expect(ofType(out, 'toast')[0]).toMatchObject({ level: 'info' });
    out = await travel(k, 'mirevale');
    expect(ofType(out, 'error')).toEqual([{ type: 'error', code: 'notAllowed', detail: 'travelCooldown' }]);
    s.time.advance(3_100);
    out = await travel(k, 'mirevale');
    expect(ofType(out, 'error')).toEqual([]);
    await k.room.leave(true);
  }, 90_000);

  it('refused while in a battle (travelBusy)', async () => {
    const lane = (() => {
      const h = getHeightfield('mirevale');
      for (let x = -10; x <= 10; x += 1) {
        for (let z = 0; z <= 12; z += 1) if (isWalkable(h, x, z) && isWalkable(h, x + 2, z)) return [x, z] as const;
      }
      throw new Error('no lane');
    })();
    const a = await inZone('mirevale', lane[0], lane[1]);
    const b = await inZone('mirevale', lane[0] + 2, lane[1]);
    await waitFor(() => a.j.room.state.players.has(b.acc.id), 5000);
    a.j.room.send('challenge', { targetId: b.acc.id });
    await waitFor(() => ofType(b.j.msgs, 'challengeReceived').length > 0, 5000);
    b.j.room.send('challengeReply', { fromId: a.acc.id, accept: true });
    await waitFor(() => ofType(a.j.msgs, 'battleStart').length > 0, 8000);
    const out = await travel(a.j, 'mirevale');
    expect(ofType(out, 'error')).toEqual([{ type: 'error', code: 'notAllowed', detail: 'travelBusy' }]);
    expect(ofType(out, 'handover')).toEqual([]);
    await b.j.room.leave(true);
    await a.j.room.leave(true);
  }, 90_000);
});
