/**
 * ZoneRoom integration (§30.2): a real server on ephemeral ports, two `@colyseus/sdk` clients.
 * Join via REST `/zone/enter` → seat → consumeSeatReservation; AOI through per-client StateView; validated
 * movement acked by the `seq` echo; chat rides the AOI; leave writes the last authoritative pose.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, enter, placePlayer, rawQuery, register, sleep, startServer, waitFor } from './helpers';
import type { TestServer } from './helpers';

let s: TestServer;

beforeAll(async () => {
  s = await startServer();
}, 120_000);

afterAll(async () => {
  await s?.stop();
}, 60_000);

describe('ZoneRoom — join, AOI, movement, chat, leave', () => {
  it('two clients in one cell see each other; a third far away sees neither', async () => {
    const a = await register(s);
    const b = await register(s);
    const c = await register(s);
    await placePlayer(s, a.id, 'mirevale', 0, 6);
    await placePlayer(s, b.id, 'mirevale', 2, 8);
    await placePlayer(s, c.id, 'mirevale', -55, -55);
    const ja = await enter(s, a, 'mirevale');
    const jb = await enter(s, b, 'mirevale');
    const jc = await enter(s, c, 'mirevale');
    // same room (shard 0)
    expect(jb.room.roomId).toBe(ja.room.roomId);
    expect(jc.room.roomId).toBe(ja.room.roomId);
    await waitFor(() => ja.room.state.players.has(b.id) && jb.room.state.players.has(a.id), 5000);
    // AOI: c is 2 cells away in both axes → invisible to a and b, and they are invisible to c
    await sleep(300);
    expect(ja.room.state.players.has(c.id)).toBe(false);
    expect(jc.room.state.players.has(a.id)).toBe(false);
    expect(jc.room.state.players.size).toBe(1);
    // broadcast fields arrive everywhere
    expect(jc.room.state.tick).toBeGreaterThan(0);
    expect(jc.room.state.harvestState).toBe('intact');

    // a legal step is applied and acked
    const pa = ja.room.state.players.get(a.id)!;
    const x0 = pa.x;
    ja.room.send('input', { seq: 1, x: x0 + 0.2, z: pa.z, angle: 0.5, running: false, dtMs: 50 });
    await waitFor(() => ja.room.state.players.get(a.id)!.seq === 1, 3000);
    expect(ja.room.state.players.get(a.id)!.x).toBeCloseTo(x0 + 0.2, 4);
    await waitFor(() => Math.abs(jb.room.state.players.get(a.id)!.x - (x0 + 0.2)) < 1e-4, 3000);

    // `moving` clears once inputs stop; an emote is broadcast through the AOI and cleared after 2 s
    await waitFor(() => jb.room.state.players.get(a.id)!.moving === false, 3000);
    ja.room.send('emote', { emote: 3 });
    await waitFor(() => jb.room.state.players.get(a.id)!.emote === 3, 3000);
    await waitFor(() => jb.room.state.players.get(a.id)!.emote === 0, 5000);
    ja.room.send('emote', { emote: 9 });
    await waitFor(() => ja.msgs.some((m) => m.type === 'error' && m.code === 'invalidPayload'), 3000);
    // the breakdance (emote 7) outlasts the 2 s emote cards: still on after 3 s, cleared by its 6 s
    await sleep(1_600);
    ja.room.send('emote', { emote: 7 });
    await waitFor(() => jb.room.state.players.get(a.id)!.emote === 7, 3000);
    await sleep(3_000);
    expect(jb.room.state.players.get(a.id)!.emote).toBe(7);
    await waitFor(() => jb.room.state.players.get(a.id)!.emote === 0, 5000);

    // chat rides the AOI: b hears a, c does not
    ja.room.send('chat', { text: '  hello \u0007 there  ' });
    await waitFor(() => jb.msgs.some((m) => m.type === 'chat'), 3000);
    const chat = jb.msgs.find((m) => m.type === 'chat');
    expect(chat).toMatchObject({ type: 'chat', id: a.id, text: 'hello there' });
    await sleep(200);
    expect(jc.msgs.some((m) => m.type === 'chat')).toBe(false);

    // a consented leave removes a from b's view and writes a's last authoritative pose
    await ja.room.leave(true);
    await waitFor(() => !jb.room.state.players.has(a.id), 5000);
    await sleep(300);
    const rows = await rawQuery(s.db, 'select zone_id, x, z from players where id = $1', [a.id]);
    expect(rows[0]!['zone_id']).toBe('mirevale');
    expect(Number(rows[0]!['x'])).toBeCloseTo(x0 + 0.2, 3);
    await jb.room.leave(true);
    await jc.room.leave(true);
  }, 120_000);

  it('a gated zone refuses /zone/enter with 403 gated and a zone other than the player\'s with 409 wrongZone', async () => {
    const a = await register(s);
    const gated = await api(s, 'POST', '/zone/enter', a.access, { zoneId: 'cinderhold' });
    expect(gated.status).toBe(403);
    expect(gated.body).toMatchObject({ code: 'gated', badge: 'bloom' });
    const wrong = await api(s, 'POST', '/zone/enter', a.access, { zoneId: 'mire_route' });
    expect(wrong.status).toBe(409);
    expect(wrong.body.code).toBe('wrongZone');
  }, 60_000);
});
