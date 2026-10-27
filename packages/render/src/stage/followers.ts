/**
 * Followers (SPEC §10.7.9): each trainer's party lead walks behind them as its creature billboard.
 *
 * The pool keeps, per owner (an actor id of the `CharacterPool`), a short history of where the owner's feet went (a
 * point every `FOLLOWER.sampleM`) and moves the follower toward the point `FOLLOWER.gapM` back along that path, so it
 * trails round corners instead of cutting them, at the owner's measured pace plus a catch-up that grows linearly with
 * the lag (never an exponential ease). It stands on the owner's ground sampler (the water level on open water, a ring's
 * level pad), floats along a glide when the owner's feet are lifted, hops a little while it walks (billboards have no
 * walk cycle), and turns its back when it walks away from the camera. A jump of more than `FOLLOWER.snapM` (a teleport,
 * a warp, a handover) puts it straight behind the owner.
 *
 * It is a walker for the world effects (`forEachWalker`, slots from `FOLLOWER.slot0` = after the character rigs), so
 * it gets footsteps, grass bend and the surf wake like any actor. Which sprite it shows, and which atlas holds it, is the
 * client's business (`set(owner, descriptor, …)`); a billboard whose atlas is not bound stays hidden until it is.
 * Allocation-free per frame.
 */
import { Group, PointLight, Vector3 } from 'three/webgpu';
import type { PerspectiveCamera } from 'three/webgpu';
import type { SpriteDescriptor } from '../contracts.js';
import type { BillboardPool, CreatureBillboard } from '../sprites/billboard.js';
import { ACTOR_POOL_SIZE } from './actors.js';
import { LIGHT_DECAY } from '../lighting/rig.js';

export const FOLLOWER = Object.freeze({
  /** followers drawn at once (walker slots slot0 .. slot0 + max − 1) */
  max: 16,
  slot0: ACTOR_POOL_SIZE,
  /**
   * distance kept behind the owner, along the owner's path (m): at least gapM, and for a wide creature the owner's
   * radius plus half its body (`bodyOfWidth` of its card is body), so a big one never stands in its owner
   */
  gapM: 1.45,
  ownerR: 0.45,
  bodyOfWidth: 0.86,
  /** the path history: a point every sampleM, `historyN` of them (covers 6 m) */
  sampleM: 0.2,
  historyN: 30,
  /** a lag past this (m) snaps the follower behind the owner (a teleport, a warp) */
  snapM: 7,
  /** catch-up speed per metre of lag beyond the gap (m/s per m), and its cap (m/s) */
  catchPerM: 3.5,
  maxMps: 16,
  /** the walking hop (m, Hz) */
  hopM: 0.07,
  hopHz: 3.4,
  /** below this speed (m/s) it stands */
  standMps: 0.25,
  /**
   * it faces the camera again once it and its owner have stood this long (s): a frame on which the owner did not move
   * (the fixed movement step and the frame rate beating) is not a stop, or a follower walking away flashes its face
   */
  faceFrontAfterS: 0.3,
  /** a Fire lead's light (`setLight`): twice a lantern's intensity at full dark, its range (m), its height over the follower (m) */
  lightIntensity: 60,
  lightRangeM: 14,
  lightLiftM: 1.1,
  lightColor: '#ff9a3c',
});

interface Entry {
  readonly owner: string;
  readonly slot: number;
  bb: CreatureBillboard;
  frontOnly: boolean;
  shown: boolean;
  /** the follower's feet */
  readonly pos: Vector3;
  readonly normal: Vector3;
  /** ring of the owner's path: x, y, z per point; head = newest */
  readonly hist: Float32Array;
  head: number;
  count: number;
  placed: boolean;
  speed: number;
  yaw: number;
  hop: number;
  /** how long it and its owner have stood still (s) */
  stillS: number;
  readonly ownerLast: Vector3;
  ownerSpeed: number;
}

/** What the pool reads from the owners (the `CharacterPool`). */
export interface FollowerOwners {
  feetOf(id: string, out: Vector3): Vector3 | null;
  /** the ground under (x, z) as the actors stand on it (water level on open water) */
  groundAt(x: number, z: number): number;
}

const _o = new Vector3();
const _t = new Vector3();
const _dir = new Vector3();

export class FollowerPool {
  readonly root = new Group();
  /**
   * A Fire lead's light (one, for the local player's follower): a non-shadow point light, always in the scene at
   * intensity 0 until `setLight` turns it up, so adding it changes no program (the layout loops every local light).
   */
  readonly light: PointLight;
  private lightOwner: string | null = null;
  private lightLevel = 0;
  private readonly entries = new Map<string, Entry>();
  private readonly slots: (Entry | null)[] = new Array<Entry | null>(FOLLOWER.max).fill(null);

  constructor(
    private readonly sprites: BillboardPool,
    private readonly owners: FollowerOwners,
    private camera: PerspectiveCamera | null = null,
  ) {
    this.root.name = 'ewa:followers';
    this.light = new PointLight(FOLLOWER.lightColor, 0, FOLLOWER.lightRangeM, LIGHT_DECAY);
    this.light.name = 'ewa:follower-light';
    this.light.castShadow = false;
    this.root.add(this.light);
  }

  /**
   * A Fire lead lights the dark round it: `owner`'s follower carries the light at `level` 0..1 of a lantern (0 or null =
   * off). The light flickers gently. One owner at a time.
   */
  setLight(owner: string | null, level: number): void {
    this.lightOwner = owner;
    this.lightLevel = owner === null || !Number.isFinite(level) ? 0 : Math.min(1, Math.max(0, level));
    if (this.lightLevel === 0) this.light.intensity = 0;
  }

  /** The light's intensity now (tests, the dev handle). */
  get lightIntensity(): number { return this.light.intensity; }

  setCamera(c: PerspectiveCamera): void { this.camera = c; }

  /** Followers live now. */
  get size(): number { return this.entries.size; }

  /**
   * The follower of `owner`: `d` its sprite (null = none). `frontOnly`: the client could bind only the front cell (a
   * party single), so it never turns its back. A new descriptor id swaps the billboard; a full pool refuses (false).
   */
  set(owner: string, d: SpriteDescriptor | null, frontOnly = false): boolean {
    const cur = this.entries.get(owner);
    if (d === null) {
      if (cur !== undefined) this.remove(cur);
      return true;
    }
    if (cur !== undefined && cur.bb.descriptor === d) {
      cur.frontOnly = frontOnly;
      if (frontOnly) cur.bb.setFacing('front');
      return true;
    }
    if (cur !== undefined) {
      // a new lead: the same place, a new card
      cur.bb.object.removeFromParent();
      cur.bb.dispose();
      cur.bb = this.makeCard(d);
      cur.frontOnly = frontOnly;
      cur.bb.setShown(cur.shown && cur.placed);
      this.root.add(cur.bb.object);
      if (cur.placed) cur.bb.setPosition(cur.pos.x, cur.pos.y, cur.pos.z);
      return true;
    }
    const slot = this.slots.indexOf(null);
    if (slot < 0) return false;
    const e: Entry = {
      owner, slot, bb: this.makeCard(d), frontOnly, shown: true, pos: new Vector3(), normal: new Vector3(0, 1, 0),
      hist: new Float32Array(FOLLOWER.historyN * 3), head: 0, count: 0, placed: false, speed: 0, yaw: 0, hop: 0, stillS: 0,
      ownerLast: new Vector3(), ownerSpeed: 0,
    };
    e.bb.setShown(false);
    this.slots[slot] = e;
    this.entries.set(owner, e);
    this.root.add(e.bb.object);
    return true;
  }

  /** Shows / hides a follower (a battle, an interior, the arena) without dropping its sprite; shown again, it reappears behind the owner. */
  setShown(owner: string, on: boolean): void {
    const e = this.entries.get(owner);
    if (e === undefined || e.shown === on) return;
    e.shown = on;
    if (!on) { e.placed = false; e.count = 0; }
    e.bb.setShown(on && e.placed);
  }

  has(owner: string): boolean { return this.entries.has(owner); }

  /** The follower's feet (null: none, or not placed yet). */
  positionOf(owner: string, out: Vector3): Vector3 | null {
    const e = this.entries.get(owner);
    return e === undefined || !e.placed ? null : out.copy(e.pos);
  }

  /** The follower's billboard (tests, the client's effects). */
  billboardOf(owner: string): CreatureBillboard | null {
    return this.entries.get(owner)?.bb ?? null;
  }

  forEachOwner(cb: (owner: string) => void): void {
    for (const k of this.entries.keys()) cb(k);
  }

  /** Per frame: trails every follower behind its owner, then carries the light. Zero allocation. */
  update(dtMs: number): void {
    const dt = Number.isFinite(dtMs) && dtMs > 0 ? Math.min(0.25, dtMs / 1000) : 0;
    if (this.camera !== null) this.camera.getWorldDirection(_dir);
    this.trail(dt);
    const lit = this.lightOwner === null ? undefined : this.entries.get(this.lightOwner);
    if (lit === undefined || !lit.placed || !lit.shown || this.lightLevel === 0) {
      this.light.intensity = 0;
      return;
    }
    this.flicker = (this.flicker + dt * 7.3) % (Math.PI * 2);
    const f = 1 + 0.06 * Math.sin(this.flicker) + 0.04 * Math.sin(this.flicker * 2.7 + 1.3);
    this.light.intensity = FOLLOWER.lightIntensity * this.lightLevel * f;
    this.light.position.set(lit.pos.x, lit.pos.y + FOLLOWER.lightLiftM, lit.pos.z);
  }

  private flicker = 0;

  private trail(dt: number): void {
    for (let i = 0; i < this.slots.length; i++) {
      const e = this.slots[i];
      if (e === null || e === undefined || !e.shown) continue;
      if (this.owners.feetOf(e.owner, _o) === null) { if (e.placed) { e.placed = false; e.count = 0; e.bb.setShown(false); } continue; }
      if (!e.placed || e.count === 0) { this.place(e, _o); continue; }
      // the owner's pace and path
      if (dt > 0) {
        const d = Math.hypot(_o.x - e.ownerLast.x, _o.z - e.ownerLast.z);
        if (d > FOLLOWER.snapM) { this.place(e, _o); continue; }
        e.ownerSpeed = d / dt;
      }
      e.ownerLast.copy(_o);
      this.record(e, _o);
      this.target(e, _o, _t);
      const dx = _t.x - e.pos.x;
      const dz = _t.z - e.pos.z;
      const lag = Math.hypot(dx, dz);
      if (lag > FOLLOWER.snapM) { this.place(e, _o); continue; }
      const behind = Math.hypot(_o.x - e.pos.x, _o.z - e.pos.z);
      const want = Math.min(FOLLOWER.maxMps, e.ownerSpeed + FOLLOWER.catchPerM * Math.max(0, behind - this.gapOf(e)) + (lag > 0.05 ? 0.8 : 0));
      const step = Math.min(lag, want * dt);
      if (lag > 1e-6 && step > 0) {
        e.pos.x += (dx / lag) * step;
        e.pos.z += (dz / lag) * step;
        e.yaw = Math.atan2(dx, dz);
      }
      e.speed = dt > 0 ? step / dt : 0;
      // ground (or the owner's lifted path: a glide), and the hop
      const g = this.owners.groundAt(e.pos.x, e.pos.z);
      const ground = Number.isFinite(g) ? g : _t.y;
      e.pos.y = Math.max(ground, _t.y - 0.05);
      const walking = e.speed > FOLLOWER.standMps;
      e.hop = walking ? (e.hop + dt * FOLLOWER.hopHz) % 1 : 0;
      const hopY = walking ? FOLLOWER.hopM * Math.abs(Math.sin(e.hop * Math.PI)) : 0;
      this.normalAt(e);
      e.bb.setGroundNormal(e.normal.x, e.normal.y, e.normal.z);
      e.bb.setPosition(e.pos.x, e.pos.y + hopY, e.pos.z);
      // the back when it walks away from the camera, its face once it and its owner have stood a moment
      e.stillS = !walking && e.ownerSpeed < FOLLOWER.standMps ? e.stillS + dt : 0;
      if (!e.frontOnly && walking && this.camera !== null) {
        const away = Math.sin(e.yaw) * _dir.x + Math.cos(e.yaw) * _dir.z;
        if (away > 0.35) e.bb.setFacing('back');
        else if (away < -0.1) e.bb.setFacing('front');
      } else if (e.stillS >= FOLLOWER.faceFrontAfterS && e.bb.facing === 'back' && !e.frontOnly) {
        e.bb.setFacing('front');
      }
    }
  }

  /**
   * World effects: each shown follower's slot (from `FOLLOWER.slot0`), feet, ground normal, speed, heading and squared
   * camera distance. The vectors are the pool's own: read them, never keep them.
   */
  forEachWalker(visit: (slot: number, feet: Vector3, normal: Vector3, speed: number, yaw: number, dist2: number) => void): void {
    const cam = this.camera;
    for (let i = 0; i < this.slots.length; i++) {
      const e = this.slots[i];
      if (e === null || e === undefined || !e.shown || !e.placed) continue;
      visit(FOLLOWER.slot0 + e.slot, e.pos, e.normal, e.speed, e.yaw, cam !== null ? cam.position.distanceToSquared(e.pos) : 0);
    }
  }

  clear(): void {
    for (const e of [...this.entries.values()]) this.remove(e);
  }

  dispose(): void {
    this.clear();
    this.root.removeFromParent();
  }

  // ---- internals ---------------------------------------------------------------------------------------------------

  private makeCard(d: SpriteDescriptor): CreatureBillboard {
    const bb = this.sprites.acquire(d);
    bb.setFacing('front');
    return bb;
  }

  /** How far behind its owner a follower walks (FOLLOWER.gapM, more for a wide one); its card is drawn at its true size. */
  private gapOf(e: Entry): number {
    return Math.max(FOLLOWER.gapM, FOLLOWER.ownerR + (FOLLOWER.bodyOfWidth * e.bb.widthM) / 2);
  }

  private remove(e: Entry): void {
    e.bb.object.removeFromParent();
    e.bb.dispose();
    this.entries.delete(e.owner);
    this.slots[e.slot] = null;
  }

  /** Straight behind the owner (its facing unknown: the history is reset, the follower appears a gap back toward the camera side). */
  private place(e: Entry, owner: Vector3): void {
    e.count = 0;
    e.head = 0;
    // a gap behind toward the camera (the owner's back is unknown after a jump): it is seen at once
    const cx = this.camera !== null ? -_dir.x : 0;
    const cz = this.camera !== null ? -_dir.z : 1;
    const l = Math.hypot(cx, cz) || 1;
    e.pos.set(owner.x + (cx / l) * this.gapOf(e) * 0.7, owner.y, owner.z + (cz / l) * this.gapOf(e) * 0.7);
    const g = this.owners.groundAt(e.pos.x, e.pos.z);
    if (Number.isFinite(g)) e.pos.y = g;
    e.ownerLast.copy(owner);
    e.ownerSpeed = 0;
    e.speed = 0;
    e.stillS = 0;
    e.placed = true;
    this.record(e, e.pos);
    this.record(e, owner);
    this.normalAt(e);
    e.bb.setGroundNormal(e.normal.x, e.normal.y, e.normal.z);
    e.bb.setPosition(e.pos.x, e.pos.y, e.pos.z);
    e.bb.setFacing('front');
    e.bb.setShown(e.shown);
  }

  /** Appends the owner's feet to the path when they moved a sample's length (always the first point). */
  private record(e: Entry, p: Vector3): void {
    const h = e.hist;
    if (e.count > 0) {
      const i = e.head * 3;
      if (Math.hypot(p.x - h[i]!, p.z - h[i + 2]!) < FOLLOWER.sampleM) return;
      e.head = (e.head + 1) % FOLLOWER.historyN;
    }
    const j = e.head * 3;
    h[j] = p.x; h[j + 1] = p.y; h[j + 2] = p.z;
    if (e.count < FOLLOWER.historyN) e.count++;
  }

  /** The point `gapM` back along the owner's path from its feet (the oldest point when the path is shorter). */
  private target(e: Entry, owner: Vector3, out: Vector3): void {
    const h = e.hist;
    let ax = owner.x; let ay = owner.y; let az = owner.z;
    let left = this.gapOf(e);
    for (let k = 0; k < e.count; k++) {
      const i = ((e.head - k + FOLLOWER.historyN) % FOLLOWER.historyN) * 3;
      const bx = h[i]!; const by = h[i + 1]!; const bz = h[i + 2]!;
      const seg = Math.hypot(bx - ax, bz - az);
      if (seg >= left && seg > 1e-6) {
        const t = left / seg;
        out.set(ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t);
        return;
      }
      left -= seg;
      ax = bx; ay = by; az = bz;
    }
    // the path is shorter than the gap: stay where the follower is unless it is ahead of the oldest point
    out.set(e.pos.x, Math.max(ay, e.pos.y), e.pos.z);
    if (Math.hypot(owner.x - e.pos.x, owner.z - e.pos.z) > this.gapOf(e)) out.set(ax, ay, az);
  }

  private normalAt(e: Entry): void {
    const g = this.owners;
    const d = 0.35;
    const hx = g.groundAt(e.pos.x + d, e.pos.z) - g.groundAt(e.pos.x - d, e.pos.z);
    const hz = g.groundAt(e.pos.x, e.pos.z + d) - g.groundAt(e.pos.x, e.pos.z - d);
    e.normal.set(-hx, 2 * d, -hz);
    if (!Number.isFinite(e.normal.x + e.normal.z) || e.normal.lengthSq() < 1e-8) e.normal.set(0, 1, 0);
    e.normal.normalize();
  }
}

/** A walker source over the character rigs and the followers (the world effects read both). */
export function combinedWalkers(a: { forEachWalker(v: Parameters<FollowerPool['forEachWalker']>[0]): void }, b: FollowerPool): { forEachWalker(v: Parameters<FollowerPool['forEachWalker']>[0]): void } {
  return {
    forEachWalker(v) {
      a.forEachWalker(v);
      b.forEachWalker(v);
    },
  };
}
