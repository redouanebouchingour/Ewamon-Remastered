/**
 * SPEC §20.4.6 — RemoteInterpolator: other players rendered 100 ms in the past from a ring of 8 server samples.
 *
 * - Samples `{ t, x, z, angle, moving, running }`, `t = tick × 50` ms (server time, 20 Hz), pushed on every applied
 *   patch (`observe`), one ring per tracked player, preallocated (`Float64Array(8 × 6)` per slot).
 * - Server-time offset = the median of the last 32 `(now − tick × 50)` observations.
 * - Render time = serverNow − 100. Each step finds the two samples bracketing render time and interpolates position
 *   LINEARLY and the angle along the shortest arc; past the newest sample it extrapolates with the last velocity for
 *   at most 100 ms, then holds still with `moving = false`. No exponential smoothing exists here (lint test).
 * - At most `cap` remotes get a render actor, re-chosen by distance every 500 ms (`reselect`); the rest are tracked.
 * React-free; `step` is allocation-free.
 */
import { wrapAngle } from '@ewa/protocol';

export const RING = 8;
export const INTERP_DELAY_MS = 100;
export const EXTRAPOLATE_MS = 100;
export const OFFSET_WINDOW = 32;
export const TICK_MS = 50;
export const RESELECT_MS = 500;
const F = 6; // floats per sample: t, x, z, angle, moving, running

/** What the interpolator draws into (render's ActorPool subset). */
export interface RemoteSink {
  spawn(id: string, name: string, look: string, guildTag: string): void;
  setTransform(id: string, x: number, z: number, angle: number, moving: boolean, running: boolean): void;
  despawn(id: string): void;
}

export interface RemoteInfo { name: string; look: string; guildTag: string; inBattle: boolean }

class Track {
  readonly ring = new Float64Array(RING * F);
  count = 0;
  head = 0; // index of the oldest sample
  spawned = false;
  distSq = 0;
  // the last interpolated output (for nameplates / interaction)
  x = 0;
  z = 0;
  angle = 0;
  moving = false;
  running = false;
  active = false;
  constructor(readonly id: string, public info: RemoteInfo) {}
}

export class RemoteInterpolator {
  private readonly tracks = new Map<string, Track>();
  private readonly list: Track[] = [];
  private readonly offsets = new Float64Array(OFFSET_WINDOW);
  private readonly scratch = new Float64Array(OFFSET_WINDOW);
  private offsetCount = 0;
  private offsetHead = 0;
  private offset = Number.NaN;
  private reselectLeft = 0;
  /** ms since the newest sample of the most recent observation (dev HUD) */
  extrapolations = 0;

  constructor(
    private readonly sink: RemoteSink,
    private readonly now: () => number,
    public cap = 48,
  ) {}

  get size(): number {
    return this.list.length;
  }
  get spawnedCount(): number {
    let n = 0;
    for (const t of this.list) if (t.spawned) n++;
    return n;
  }
  /** estimated server time now (ms) */
  serverNow(): number {
    return Number.isNaN(this.offset) ? Number.NaN : this.now() - this.offset;
  }

  // ---- membership (getStateCallbacks onAdd / onRemove) ------------------------------------------------------------

  add(id: string, info: RemoteInfo): void {
    const t = this.tracks.get(id);
    if (t !== undefined) {
      t.info = info;
      return;
    }
    const nt = new Track(id, info);
    this.tracks.set(id, nt);
    this.list.push(nt);
    this.reselectLeft = 0;
  }

  update(id: string, info: Partial<RemoteInfo>): void {
    const t = this.tracks.get(id);
    if (t === undefined) return;
    const was = t.info;
    t.info = { ...was, ...info };
    if (t.spawned && (info.look !== undefined && info.look !== was.look || info.name !== undefined && info.name !== was.name || info.guildTag !== undefined && info.guildTag !== was.guildTag)) {
      this.sink.spawn(id, t.info.name, t.info.look, t.info.guildTag);
    }
  }

  remove(id: string): void {
    const t = this.tracks.get(id);
    if (t === undefined) return;
    if (t.spawned) this.sink.despawn(id);
    this.tracks.delete(id);
    const i = this.list.indexOf(t);
    if (i >= 0) {
      this.list[i] = this.list[this.list.length - 1]!;
      this.list.pop();
    }
  }

  has(id: string): boolean {
    return this.tracks.has(id);
  }

  // ---- samples (room.onStateChange) ------------------------------------------------------------------------------

  /** One server tick observed at `now()`: updates the median offset. */
  observeTick(tick: number): void {
    const o = this.now() - tick * TICK_MS;
    this.offsets[this.offsetHead] = o;
    this.offsetHead = (this.offsetHead + 1) % OFFSET_WINDOW;
    if (this.offsetCount < OFFSET_WINDOW) this.offsetCount++;
    const n = this.offsetCount;
    const s = this.scratch;
    // insertion sort of ≤ 32 values into the scratch (no allocation)
    for (let i = 0; i < n; i++) {
      const v = this.offsets[i]!;
      let j = i - 1;
      while (j >= 0 && s[j]! > v) {
        s[j + 1] = s[j]!;
        j--;
      }
      s[j + 1] = v;
    }
    this.offset = n % 2 === 1 ? s[(n - 1) >> 1]! : (s[n / 2 - 1]! + s[n / 2]!) / 2;
  }

  /** A sample for `id` at server tick `tick` (pushed on every patch; duplicates of the same tick replace). */
  push(id: string, tick: number, x: number, z: number, angle: number, moving: boolean, running: boolean): void {
    const t = this.tracks.get(id);
    if (t === undefined) return;
    const ts = tick * TICK_MS;
    const r = t.ring;
    if (t.count > 0) {
      const last = (t.head + t.count - 1) % RING;
      const lt = r[last * F]!;
      if (ts < lt) return; // out of order
      if (ts === lt) {
        const j = last * F;
        r[j + 1] = x; r[j + 2] = z; r[j + 3] = angle; r[j + 4] = moving ? 1 : 0; r[j + 5] = running ? 1 : 0;
        return;
      }
    }
    let slot: number;
    if (t.count < RING) {
      slot = (t.head + t.count) % RING;
      t.count++;
    } else {
      slot = t.head;
      t.head = (t.head + 1) % RING;
    }
    const j = slot * F;
    r[j] = ts; r[j + 1] = x; r[j + 2] = z; r[j + 3] = angle; r[j + 4] = moving ? 1 : 0; r[j + 5] = running ? 1 : 0;
  }

  /** Reconnect / zone change: every buffer emptied (the next samples restart them). */
  clearBuffers(): void {
    for (const t of this.list) {
      t.count = 0;
      t.head = 0;
    }
    this.offsetCount = 0;
    this.offsetHead = 0;
    this.offset = Number.NaN;
  }

  /** Drops every track (zone unload). */
  clear(): void {
    for (const t of this.list) if (t.spawned) this.sink.despawn(t.id);
    this.tracks.clear();
    this.list.length = 0;
    this.clearBuffers();
  }

  // ---- per fixed step -------------------------------------------------------------------------------------------

  /** Interpolates every tracked remote at serverNow − 100 ms and moves the spawned actors. */
  step(dtMs: number, selfX: number, selfZ: number): void {
    this.reselectLeft -= dtMs;
    if (this.reselectLeft <= 0) {
      this.reselectLeft = RESELECT_MS;
      this.reselect(selfX, selfZ);
    }
    if (Number.isNaN(this.offset)) return;
    const renderT = this.now() - this.offset - INTERP_DELAY_MS;
    for (let i = 0; i < this.list.length; i++) {
      const t = this.list[i]!;
      if (t.count === 0) continue;
      this.sample(t, renderT);
      if (t.spawned) this.sink.setTransform(t.id, t.x, t.z, t.angle, t.moving, t.running);
    }
  }

  /** Samples one track at `renderT` into its x/z/angle/moving/running. */
  private sample(t: Track, renderT: number): void {
    const r = t.ring;
    const n = t.count;
    const oldest = t.head;
    const newest = (t.head + n - 1) % RING;
    const tNew = r[newest * F]!;
    t.active = true;
    if (n === 1 || renderT <= r[oldest * F]!) {
      const j = (renderT <= r[oldest * F]! ? oldest : newest) * F;
      t.x = r[j + 1]!; t.z = r[j + 2]!; t.angle = r[j + 3]!; t.moving = r[j + 4]! > 0.5; t.running = r[j + 5]! > 0.5;
      if (n === 1) t.moving = false;
      return;
    }
    if (renderT >= tNew) {
      // extrapolate with the last velocity for at most EXTRAPOLATE_MS, then hold still
      const prev = (t.head + n - 2) % RING;
      const jn = newest * F;
      const jp = prev * F;
      const span = tNew - r[jp]!;
      const ahead = renderT - tNew;
      const j = jn;
      if (ahead <= EXTRAPOLATE_MS && span > 0 && r[jn + 4]! > 0.5) {
        const k = ahead / span;
        t.x = r[j + 1]! + (r[jn + 1]! - r[jp + 1]!) * k;
        t.z = r[j + 2]! + (r[jn + 2]! - r[jp + 2]!) * k;
        t.moving = true;
        this.extrapolations++;
      } else {
        const cap = Math.min(ahead, EXTRAPOLATE_MS);
        const k = span > 0 && r[jn + 4]! > 0.5 ? cap / span : 0;
        t.x = r[j + 1]! + (r[jn + 1]! - r[jp + 1]!) * k;
        t.z = r[j + 2]! + (r[jn + 2]! - r[jp + 2]!) * k;
        t.moving = false;
      }
      t.angle = r[j + 3]!;
      t.running = r[j + 5]! > 0.5;
      return;
    }
    // bracket: the last sample with t <= renderT and its successor
    for (let k = n - 2; k >= 0; k--) {
      const a = (t.head + k) % RING;
      const ta = r[a * F]!;
      if (ta > renderT) continue;
      const b = (a + 1) % RING;
      const tb = r[b * F]!;
      const u = tb > ta ? (renderT - ta) / (tb - ta) : 1;
      const ja = a * F;
      const jb = b * F;
      t.x = r[ja + 1]! + (r[jb + 1]! - r[ja + 1]!) * u;
      t.z = r[ja + 2]! + (r[jb + 2]! - r[ja + 2]!) * u;
      const da = wrapAngle(r[jb + 3]! - r[ja + 3]!);
      t.angle = wrapAngle(r[ja + 3]! + da * u);
      t.moving = (u < 0.5 ? r[ja + 4]! : r[jb + 4]!) > 0.5;
      t.running = (u < 0.5 ? r[ja + 5]! : r[jb + 5]!) > 0.5;
      return;
    }
  }

  /** Nearest-N: spawns the `cap` nearest tracked remotes, despawns the rest (every 500 ms). */
  reselect(selfX: number, selfZ: number): void {
    for (const t of this.list) {
      const j = t.count > 0 ? ((t.head + t.count - 1) % RING) * F : -1;
      const x = j >= 0 ? t.ring[j + 1]! : t.x;
      const z = j >= 0 ? t.ring[j + 2]! : t.z;
      t.distSq = (x - selfX) * (x - selfX) + (z - selfZ) * (z - selfZ);
    }
    if (this.list.length > this.cap) this.list.sort((a, b) => a.distSq - b.distSq); // alloc-ok: 2 Hz nearest-N sort
    for (let i = 0; i < this.list.length; i++) {
      const t = this.list[i]!;
      const want = i < this.cap && t.count > 0;
      if (want && !t.spawned) {
        this.sink.spawn(t.id, t.info.name, t.info.look, t.info.guildTag);
        t.spawned = true;
        if (t.count > 0) {
          const j = ((t.head + t.count - 1) % RING) * F;
          t.x = t.ring[j + 1]!; t.z = t.ring[j + 2]!; t.angle = t.ring[j + 3]!;
          this.sink.setTransform(t.id, t.x, t.z, t.angle, false, false);
        }
      } else if (!want && t.spawned) {
        this.sink.despawn(t.id);
        t.spawned = false;
      }
    }
  }

  /** Visits tracked remotes nearest-first (nameplates, interaction targets); valid after the last reselect. */
  forEach(visit: (id: string, x: number, z: number, info: RemoteInfo, spawned: boolean) => void): void {
    for (let i = 0; i < this.list.length; i++) {
      const t = this.list[i]!;
      if (!t.active && t.count === 0) continue;
      visit(t.id, t.x, t.z, t.info, t.spawned);
    }
  }

  /** The current interpolated position of `id` (NaN when unknown). */
  /** Whether the remote currently has a rig (inside the cap). */
  isSpawned(id: string): boolean {
    return this.tracks.get(id)?.spawned === true;
  }

  positionOf(id: string, out: { x: number; z: number }): boolean {
    const t = this.tracks.get(id);
    if (t === undefined || (!t.active && t.count === 0)) return false;
    out.x = t.x;
    out.z = t.z;
    return true;
  }
}
