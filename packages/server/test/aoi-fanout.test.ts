/**
 * §50.4.5 aoi-fanout.test.ts + §50.5 M2/M4 + §30.10.3 contract (the pure checks in src/netcode/harness.ts).
 *
 * N ∈ {50, 100, 200} real `@colyseus/sdk` bots in one `mire_route` room (ZONE_CAPACITY 200), placed on a uniform
 * grid across the playable field, each sending a LEGAL running input every 50 ms along its row (0.30 m per 45 ms
 * input, 6.7 m/s < the 8.05 m/s cap; the spec's "1 unit per tick" = 20 m/s would be a speed reject — Q17), bouncing
 * off unwalkable samples and a 14 m margin (no handover triggers). Over the measured window (10 s, override with
 * EWA_FANOUT_SECONDS):
 * - per client: PlayerState patches ≤ (players in its view, self included) × ticks × 1.1; patch bytes/s ≤
 *   (neighbours + spawns + 1) × 48 × 20 × 1.2
 * - total PlayerState patches ≤ 0.3 × 20·N·(N−1) (the quadratic model is printed beside the measured figure)
 * - server frames/s power-law exponent over the three runs < 1.3; no honest bot rejected; tick p99 < 25 ms at 200
 * - N = 200 with a live RaidState broadcast: per-client raid patches ≤ 20/s
 * Also: a leaving bot's view is disposed and it is removed from every other view before `players.delete`.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { matchMaker } from '@colyseus/core';
import { StateView } from '@colyseus/schema';
import { getStateCallbacks } from '@colyseus/sdk';
import { getHeightfield, isWalkable, nearestWalkable, playableBounds } from '@ewa/content';
import type { PlayerState } from '@ewa/protocol';
import { newCreature } from '../src/game/creatures';
import { dayKey } from '../src/liveops/schedule';
import { checkRun, checkScaling, quadraticModel } from '../src/netcode/harness';
import type { ClientSample, HarnessRun } from '../src/netcode/harness';
import type { ZoneRoom } from '../src/rooms/ZoneRoom';
import { api, content, joinSeat, sleep, startServer, uniqueName, waitFor } from './helpers';
import type { Joined, TestServer } from './helpers';

const SECONDS = Number(process.env['EWA_FANOUT_SECONDS'] ?? 10);
const STEP_M = 0.3;
const DT_MS = 45;
const MARGIN_M = 14;
const H = getHeightfield('mire_route');
const B = playableBounds(H);

let s: TestServer;
beforeAll(async () => {
  s = await startServer({ ZONE_CAPACITY: 200 });
}, 120_000);
afterAll(async () => {
  await s?.stop();
}, 120_000);

interface Bot {
  readonly id: string;
  readonly j: Joined;
  x: number;
  z: number;
  dir: 1 | -1;
  seq: number;
  playerPatches: number;
  raidPatches: number;
  sizeSum: number;
  spawnSum: number;
  samples: number;
}

async function makeBots(n: number): Promise<{ id: string; token: string }[]> {
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const minX = B.minX + MARGIN_M;
  const maxX = B.maxX - MARGIN_M;
  const minZ = B.minZ + MARGIN_M;
  const maxZ = B.maxZ - MARGIN_M;
  const out: { id: string; token: string }[] = [];
  await s.repos.db.transaction(async (tx) => {
    for (let i = 0; i < n; i++) {
      const cx = minX + ((i % cols) + 0.5) * ((maxX - minX) / cols);
      const cz = minZ + (Math.floor(i / cols) + 0.5) * ((maxZ - minZ) / rows);
      const p = nearestWalkable(H, cx, cz, 16) ?? [cx, cz];
      const username = uniqueName('fan');
      const { id } = await s.repos.players.create(tx, { username, email: `${username}@fan.test`, passwordHash: 'x' }, new Date());
      await s.repos.creatures.insert(tx, newCreature(content, 'bramblecub', 5, { ownerId: id, moves: 'default' }), { kind: 'party', index: 0 });
      await s.repos.players.setPosition(tx, id, 'mire_route', p[0], p[1], 0);
      // today's login already granted: the join does no extra write (bots are not the subject here)
      await s.repos.progress.setFlags(tx, id, ['streak:1', `streak:last:${dayKey(s.time.clock())}`], new Date());
      out.push({ id, token: s.booted.rest.jwt.sign({ sub: id, usr: username, adm: false }) });
    }
  });
  return out;
}

function stepFor(b: Bot): { x: number; z: number } | null {
  for (const dir of [b.dir, -b.dir as 1 | -1]) {
    const nx = b.x + dir * STEP_M;
    const ok = nx > B.minX + MARGIN_M && nx < B.maxX - MARGIN_M && isWalkable(H, nx, b.z) && isWalkable(H, (nx + b.x) / 2, b.z);
    if (ok) {
      b.dir = dir;
      return { x: nx, z: b.z };
    }
  }
  return null;
}

function roomOf(j: Joined): ZoneRoom {
  return matchMaker.getLocalRoomById(j.room.roomId) as unknown as ZoneRoom;
}

async function run(n: number, withRaid: boolean): Promise<{ run: HarnessRun; bots: Bot[]; room: ZoneRoom; joinMs: number }> {
  const accounts = await makeBots(n);
  const t0 = Date.now();
  const bots: Bot[] = [];
  // joins in parallel batches (§30.10.3 #5: 200 joins within 5 s, every join succeeds)
  for (let i = 0; i < accounts.length; i += 50) {
    const batch = await Promise.all(
      accounts.slice(i, i + 50).map(async (a) => {
        const r = await api(s, 'POST', '/zone/enter', a.token, { zoneId: 'mire_route' });
        expect(r.status).toBe(200);
        return { a, j: await joinSeat(s, a.token, r.body.seat) };
      }),
    );
    for (const { a, j } of batch) {
      const bot: Bot = { id: a.id, j, x: 0, z: 0, dir: 1, seq: 0, playerPatches: 0, raidPatches: 0, sizeSum: 0, spawnSum: 0, samples: 0 };
      const $ = getStateCallbacks(j.room);
      $(j.room.state).players.onAdd((p: PlayerState) => {
        $(p).onChange(() => void (bot.playerPatches += 1));
      });
      $(j.room.state).listen('raid', (r) => {
        if (r !== null && r !== undefined) $(r).onChange(() => void (bot.raidPatches += 1));
      });
      bots.push(bot);
    }
  }
  await waitFor(() => bots.every((b) => b.j.room.state.players.get(b.id) !== undefined), 10_000);
  const joinMs = Date.now() - t0;
  for (const b of bots) {
    const me = b.j.room.state.players.get(b.id)!;
    b.x = me.x;
    b.z = me.z;
    b.seq = me.seq;
  }
  const room = roomOf(bots[0]!.j);
  expect(room.state.players.size).toBe(n);
  if (withRaid) {
    const runner = room.openRaid({ id: 'fanout_raid', zoneId: 'mire_route', x: 0, z: 0, boss: { species: 'mossling', level: 5, hpMultiplier: 50 }, minBadges: 0, window: { utcHour: 0, minutes: 1440 } }, s.time.clock());
    await waitFor(() => bots.every((b) => b.j.room.state.raid?.id === runner.id), 5000);
    // a fight-round clock (20 s): the lobby's 90 s countdown sits at the uint16 clamp (65 535 ms) and never changes
    runner.session.deadlineAt = s.time.clock() + 20_000;
  }
  // drive: every 50 ms each bot sends one legal input
  let driving = true;
  const drive = setInterval(() => {
    if (!driving) return;
    for (const b of bots) {
      const next = stepFor(b);
      if (next === null) continue;
      b.seq += 1;
      b.x = next.x;
      b.z = next.z;
      b.j.room.send('input', { seq: b.seq, x: next.x, z: next.z, angle: b.dir > 0 ? Math.PI / 2 : -Math.PI / 2, running: true, dtMs: DT_MS });
    }
  }, 50);
  await sleep(2000); // warm-up: AOI adds of the join settle
  // measured window
  const traffic0 = new Map([...room.traffic].map(([k, v]) => [k, { ...v }]));
  const rejected0 = { ...room.metrics.rejectedInputs };
  for (const b of bots) {
    b.playerPatches = 0;
    b.raidPatches = 0;
  }
  const sampler = setInterval(() => {
    for (const b of bots) {
      b.sizeSum += b.j.room.state.players.size;
      b.spawnSum += b.j.room.state.spawns.size;
      b.samples += 1;
    }
  }, 250);
  const w0 = Date.now();
  await sleep(SECONDS * 1000);
  const secs = (Date.now() - w0) / 1000;
  clearInterval(sampler);
  driving = false;
  clearInterval(drive);
  let frames = 0;
  const clients: ClientSample[] = bots.map((b) => {
    const sid = b.j.room.sessionId;
    const t = room.traffic.get(sid)!;
    const t0v = traffic0.get(sid) ?? { patchFrames: 0, patchBytes: 0, msgFrames: 0 };
    frames += t.patchFrames - t0v.patchFrames + (t.msgFrames - t0v.msgFrames);
    const meanSize = b.sizeSum / Math.max(1, b.samples);
    return {
      id: b.id,
      neighbours: meanSize - 1,
      spawns: b.spawnSum / Math.max(1, b.samples),
      patchBytesPerSec: (t.patchBytes - t0v.patchBytes) / secs,
      playerPatchesPerSec: b.playerPatches / secs,
    };
  });
  const r = room.metrics.rejectedInputs;
  return {
    run: {
      n,
      clients,
      framesOutPerSec: frames / secs,
      tickMsP99: room.metrics.tickMsP99,
      rejected: { speed: r.speed - rejected0.speed, unwalkable: r.unwalkable - rejected0.unwalkable, bounds: r.bounds - rejected0.bounds, staleSeq: r.staleSeq - rejected0.staleSeq },
    },
    bots,
    room,
    joinMs,
  };
}

async function teardown(bots: readonly Bot[]): Promise<void> {
  await Promise.all(bots.map((b) => b.j.room.leave(true).catch(() => undefined)));
  await sleep(300);
}

describe('aoi fan-out (§50.4.5, §30.10.3)', () => {
  const runs: HarnessRun[] = [];

  for (const n of [50, 100, 200] as const) {
    it(`N = ${n}${n === 200 ? ' with a live RaidState broadcast' : ''}: per-client and total PlayerState patches, bytes, frames`, async () => {
      const r = await run(n, n === 200);
      const ticks = SECONDS * 20;
      for (let i = 0; i < r.bots.length; i++) {
        const b = r.bots[i]!;
        const c = r.run.clients[i]!;
        // ≤ (bots in its 3×3, self included) × ticks + 10 %
        expect(c.playerPatchesPerSec * SECONDS).toBeLessThanOrEqual((c.neighbours + 1) * ticks * 1.1);
        if (n === 200) expect(b.raidPatches / SECONDS).toBeLessThanOrEqual(20);
      }
      if (n === 200) expect(r.bots.every((b) => b.raidPatches > 0)).toBe(true); // the broadcast is live for everyone
      const report = checkRun(r.run, { checkTick: n === 200 });
      const quad = quadraticModel(n);
      console.log(
        `[aoi-fanout] N=${n}: PlayerState patches/s ${report.totalPlayerPatchesPerSec.toFixed(0)} (quadratic model ${quad}, ratio ${(report.totalPlayerPatchesPerSec / quad).toFixed(3)}), ` +
          `server frames/s ${r.run.framesOutPerSec.toFixed(0)}, mean neighbours ${report.meanNeighbours.toFixed(1)}, ` +
          `mean patch bytes/s/client ${(r.run.clients.reduce((a, c) => a + c.patchBytesPerSec, 0) / n).toFixed(0)}, tick p99 ${r.run.tickMsP99.toFixed(2)} ms, joins ${r.joinMs} ms` +
          (n === 200 ? `, max raid patches/s/client ${(Math.max(...r.bots.map((b) => b.raidPatches)) / SECONDS).toFixed(2)}` : ''),
      );
      expect(report.violations).toEqual([]);
      // every join succeeded (asserted in run()); §30.10.3 #5's 5 s is the harness's figure against a Postgres-backed
      // server — in-process PGlite serialises every join's transactions (Q17), so the bound here is looser
      if (n === 200) expect(r.joinMs).toBeLessThan(15_000);
      runs.push(r.run);
      await teardown(r.bots);
    }, 240_000);
  }

  it('the frames/s power law over N = 50/100/200 has exponent < 1.3 (the legacy relay was quadratic)', () => {
    expect(runs).toHaveLength(3);
    const { exponent, violations } = checkScaling(runs);
    console.log(`[aoi-fanout] frames/s power-law exponent ${exponent.toFixed(3)}; PlayerState-patch exponent ${(Math.log(runs[2]!.clients.reduce((a, c) => a + c.playerPatchesPerSec, 0) / runs[0]!.clients.reduce((a, c) => a + c.playerPatchesPerSec, 0)) / Math.log(4)).toFixed(3)} (fixed area: density grows with N)`);
    expect(violations).toEqual([]);
  });

  it('a leaving bot: view.dispose() is called and it leaves every other view before players.delete', async () => {
    const accounts = await makeBots(3);
    // put all three on the same spot so each sees the others
    const spot = nearestWalkable(H, 0, 0, 16)!;
    for (const a of accounts) await s.repos.db.transaction((tx) => s.repos.players.setPosition(tx, a.id, 'mire_route', spot[0], spot[1], 0));
    const joined: Joined[] = [];
    for (const a of accounts) {
      const r = await api(s, 'POST', '/zone/enter', a.token, { zoneId: 'mire_route' });
      joined.push(await joinSeat(s, a.token, r.body.seat));
    }
    await waitFor(() => joined.every((j) => j.room.state.players.size === 3), 5000);
    const room = roomOf(joined[0]!);
    const leaver = accounts[0]!.id;
    const ps = room.state.players.get(leaver)!;
    const dispose = vi.spyOn(StateView.prototype, 'dispose');
    const del = room.state.players.delete.bind(room.state.players);
    let stillVisibleAtDelete = -1;
    room.state.players.delete = ((key: string) => {
      if (key === leaver) stillVisibleAtDelete = room.clients.filter((c) => c.userData?.playerId !== leaver && (c.view?.items ?? []).includes(ps as never)).length;
      return del(key);
    }) as typeof room.state.players.delete;
    try {
      await joined[0]!.room.leave(true);
      await waitFor(() => joined.slice(1).every((j) => !j.room.state.players.has(leaver)), 5000);
      expect(stillVisibleAtDelete).toBe(0);
      expect(dispose).toHaveBeenCalled();
    } finally {
      room.state.players.delete = del as typeof room.state.players.delete;
      dispose.mockRestore();
    }
    for (const j of joined.slice(1)) await j.room.leave(true);
  }, 60_000);
});
