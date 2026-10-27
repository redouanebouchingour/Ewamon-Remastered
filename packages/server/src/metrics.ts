/**
 * §30.10.2 metrics. Rooms keep raw counters (cheap increments on the hot path); `rollRoomMetrics` turns them into
 * per-second rates once a second and recomputes the tick percentiles over the last 60 s of ticks. REST keeps a
 * bounded latency sample per route; the DB wrapper times every transaction. `MetricsRegistry.snapshot()` is the
 * `ProcessMetrics` JSON of `GET /admin/metrics`, and rooms log one `info` line each every 60 s.
 *
 * Pure except for the injected `now`; no Colyseus import.
 */
import type { ZoneId } from '@ewa/content';
import type { Db } from '@ewa/persist';
import type { RejectReason } from './rooms/movement';

export const RATE_WINDOW_MS = 1_000;
/** 60 s of 20 Hz ticks */
export const TICK_SAMPLES = 1_200;
export const LOG_EVERY_MS = 60_000;
const LATENCY_SAMPLES = 1_000;

export interface RoomMetrics {
  readonly roomId: string;
  readonly zoneId: ZoneId;
  readonly shard: number;
  players: number;
  spawns: number;
  battles: number;
  raid: boolean;
  msgsInPerSec: number;
  msgsOutPerSec: number;
  patchBytesPerSec: number;
  tickMsP50: number;
  tickMsP99: number;
  tickOverruns: number;
  rejectedInputs: Record<RejectReason, number>;
  aoiAddsPerSec: number;
  aoiRemovesPerSec: number;
  battleFaults: number;
  unknownMessages: number;
  kicks: number;
  // ---- additions (IMPLEMENTATION-NOTES Q16) ----
  /** websocket frames the server sent per second: schema patch frames + message frames (§30.10.3 "msgsOut/s") */
  framesOutPerSec: number;
  /** schema patch frames per second (one per client per tick with a change) */
  patchFramesPerSec: number;
  /** raw counters behind the per-second rates */
  msgsIn: number;
  msgsOut: number;
  aoiAdds: number;
  aoiRemoves: number;
  patchFrames: number;
  patchBytes: number;
  lastTickMs: number;
}

interface RoomWindow {
  at: number;
  msgsIn: number;
  msgsOut: number;
  aoiAdds: number;
  aoiRemoves: number;
  patchFrames: number;
  patchBytes: number;
}

const windows = new WeakMap<RoomMetrics, RoomWindow>();
const tickRings = new WeakMap<RoomMetrics, { buf: Float64Array; n: number; i: number }>();

export function createRoomMetrics(roomId: string, zoneId: ZoneId, shard: number): RoomMetrics {
  return {
    roomId,
    zoneId,
    shard,
    players: 0,
    spawns: 0,
    battles: 0,
    raid: false,
    msgsInPerSec: 0,
    msgsOutPerSec: 0,
    patchBytesPerSec: 0,
    tickMsP50: 0,
    tickMsP99: 0,
    tickOverruns: 0,
    rejectedInputs: { staleSeq: 0, dtBudget: 0, speed: 0, unwalkable: 0, bounds: 0, inBattle: 0 },
    aoiAddsPerSec: 0,
    aoiRemovesPerSec: 0,
    battleFaults: 0,
    unknownMessages: 0,
    kicks: 0,
    framesOutPerSec: 0,
    patchFramesPerSec: 0,
    msgsIn: 0,
    msgsOut: 0,
    aoiAdds: 0,
    aoiRemoves: 0,
    patchFrames: 0,
    patchBytes: 0,
    lastTickMs: 0,
  };
}

/** Nearest-rank percentile of a sample (q in [0, 1]). */
export function percentile(values: ArrayLike<number>, q: number): number {
  const n = values.length;
  if (n === 0) return 0;
  const sorted = Array.from(values).sort((a, b) => a - b);
  const rank = Math.min(n - 1, Math.max(0, Math.ceil(q * n) - 1));
  return sorted[rank]!;
}

/** Records one tick duration (the ring holds the last 60 s). */
export function recordTick(m: RoomMetrics, ms: number): void {
  let r = tickRings.get(m);
  if (r === undefined) {
    r = { buf: new Float64Array(TICK_SAMPLES), n: 0, i: 0 };
    tickRings.set(m, r);
  }
  r.buf[r.i] = ms;
  r.i = (r.i + 1) % TICK_SAMPLES;
  if (r.n < TICK_SAMPLES) r.n++;
  m.lastTickMs = ms;
}

/** Once per RATE_WINDOW_MS: counters → per-second rates, tick p50/p99. Returns true when it rolled. */
export function rollRoomMetrics(m: RoomMetrics, now: number): boolean {
  const w = windows.get(m);
  if (w === undefined) {
    windows.set(m, { at: now, msgsIn: m.msgsIn, msgsOut: m.msgsOut, aoiAdds: m.aoiAdds, aoiRemoves: m.aoiRemoves, patchFrames: m.patchFrames, patchBytes: m.patchBytes });
    return false;
  }
  const dt = now - w.at;
  if (dt < RATE_WINDOW_MS) return false;
  const per = 1000 / dt;
  m.msgsInPerSec = (m.msgsIn - w.msgsIn) * per;
  m.msgsOutPerSec = (m.msgsOut - w.msgsOut) * per;
  m.aoiAddsPerSec = (m.aoiAdds - w.aoiAdds) * per;
  m.aoiRemovesPerSec = (m.aoiRemoves - w.aoiRemoves) * per;
  m.patchFramesPerSec = (m.patchFrames - w.patchFrames) * per;
  m.patchBytesPerSec = (m.patchBytes - w.patchBytes) * per;
  m.framesOutPerSec = m.patchFramesPerSec + m.msgsOutPerSec;
  windows.set(m, { at: now, msgsIn: m.msgsIn, msgsOut: m.msgsOut, aoiAdds: m.aoiAdds, aoiRemoves: m.aoiRemoves, patchFrames: m.patchFrames, patchBytes: m.patchBytes });
  const r = tickRings.get(m);
  if (r !== undefined) {
    const sample = r.buf.subarray(0, r.n);
    m.tickMsP50 = percentile(sample, 0.5);
    m.tickMsP99 = percentile(sample, 0.99);
  }
  return true;
}

/** The per-room log line (never chat text, tokens or emails — numbers only). */
export function roomLogLine(m: RoomMetrics): Record<string, unknown> {
  const round = (x: number): number => Math.round(x * 100) / 100;
  return {
    roomId: m.roomId,
    zoneId: m.zoneId,
    shard: m.shard,
    players: m.players,
    spawns: m.spawns,
    battles: m.battles,
    raid: m.raid,
    msgsInPerSec: round(m.msgsInPerSec),
    msgsOutPerSec: round(m.msgsOutPerSec),
    framesOutPerSec: round(m.framesOutPerSec),
    patchBytesPerSec: round(m.patchBytesPerSec),
    tickMsP50: round(m.tickMsP50),
    tickMsP99: round(m.tickMsP99),
    tickOverruns: m.tickOverruns,
    rejectedInputs: { ...m.rejectedInputs },
    aoiAddsPerSec: round(m.aoiAddsPerSec),
    aoiRemovesPerSec: round(m.aoiRemovesPerSec),
    battleFaults: m.battleFaults,
    unknownMessages: m.unknownMessages,
    kicks: m.kicks,
  };
}

interface RouteStats {
  count: number;
  s4xx: number;
  s5xx: number;
  ms: number[];
  i: number;
}

function pushSample(r: { ms: number[]; i: number }, ms: number): void {
  if (r.ms.length < LATENCY_SAMPLES) r.ms.push(ms);
  else {
    r.ms[r.i] = ms;
    r.i = (r.i + 1) % LATENCY_SAMPLES;
  }
}

export interface ProcessMetrics {
  rooms: RoomMetrics[];
  rest: Record<string, { count: number; p50Ms: number; p99Ms: number; s4xx: number; s5xx: number }>;
  db: { txPerSec: number; txP99Ms: number; poolInUse: number };
  presenceSize: number;
  heapMb: number;
}

/** Process-wide registry: live rooms' metrics, REST per route, DB transactions. */
export class MetricsRegistry {
  private readonly rooms = new Map<string, RoomMetrics>();
  private readonly routes = new Map<string, RouteStats>();
  private readonly tx = { count: 0, ms: [] as number[], i: 0, windowAt: 0, windowCount: 0, perSec: 0 };
  private pool: (() => number) | null = null;

  constructor(private readonly clock: () => number = Date.now) {}

  register(m: RoomMetrics): void {
    this.rooms.set(m.roomId, m);
  }

  unregister(roomId: string): void {
    this.rooms.delete(roomId);
  }

  all(): readonly RoomMetrics[] {
    return [...this.rooms.values()];
  }

  /** `onResponse`: one request of `route` answered `status` in `ms`. */
  recordRest(route: string, status: number, ms: number): void {
    let r = this.routes.get(route);
    if (r === undefined) {
      r = { count: 0, s4xx: 0, s5xx: 0, ms: [], i: 0 };
      this.routes.set(route, r);
    }
    r.count++;
    if (status >= 500) r.s5xx++;
    else if (status >= 400) r.s4xx++;
    pushSample(r, ms);
  }

  recordTx(ms: number): void {
    this.tx.count++;
    pushSample(this.tx, ms);
  }

  /** the pg pool's in-use connection count */
  setPoolProbe(probe: (() => number) | null): void {
    this.pool = probe;
  }

  snapshot(presenceSize: number): ProcessMetrics {
    const now = this.clock();
    const dt = now - this.tx.windowAt;
    if (this.tx.windowAt === 0) {
      this.tx.windowAt = now;
      this.tx.windowCount = this.tx.count;
    } else if (dt >= RATE_WINDOW_MS) {
      this.tx.perSec = ((this.tx.count - this.tx.windowCount) * 1000) / dt;
      this.tx.windowAt = now;
      this.tx.windowCount = this.tx.count;
    }
    const rest: ProcessMetrics['rest'] = {};
    for (const [route, r] of this.routes) rest[route] = { count: r.count, p50Ms: percentile(r.ms, 0.5), p99Ms: percentile(r.ms, 0.99), s4xx: r.s4xx, s5xx: r.s5xx };
    return {
      rooms: this.all().map((m) => ({ ...m, rejectedInputs: { ...m.rejectedInputs } })),
      rest,
      db: { txPerSec: this.tx.perSec, txP99Ms: percentile(this.tx.ms, 0.99), poolInUse: this.pool?.() ?? 0 },
      presenceSize,
      heapMb: Math.round((process.memoryUsage().heapUsed / 1048576) * 10) / 10,
    };
  }
}

/** A `Db` whose every transaction is timed into the registry (the same object otherwise). */
export function timedDb(db: Db, metrics: MetricsRegistry, now: () => number = () => performance.now()): Db {
  const pool = (db as { pool?: { totalCount: number; idleCount: number } }).pool;
  if (pool !== undefined) metrics.setPoolProbe(() => pool.totalCount - pool.idleCount);
  return {
    close: () => db.close(),
    async transaction(fn) {
      const t0 = now();
      try {
        return await db.transaction(fn);
      } finally {
        metrics.recordTx(now() - t0);
      }
    },
  };
}
