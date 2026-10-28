/**
 * Watching battles in the open world. Every battle in the zone that is not the player's own and stands within
 * `SPECTATE_RANGE_M` gets its spectator ring (render `dressSpectator`: the 7 m ring and the two beacons) with the
 * creatures on its field standing in it as billboards (the raid den's pattern: the renderer's sprite pool, a lease on
 * the textures while they stand), laid out on the stage's own battler slots around the ring centre along the axis side
 * 0's trainer faced at the start (`BattleSummary.angle`). The fighters' avatars step to the stage's trainer slots
 * (`trainerSpot`, read by World3D's remote sink), and a `watch` interactable at the centre offers "Watch".
 *
 * The field comes from the summary (`BattleSummary.field`, rewritten after every turn), so a player who walks up mid
 * fight sees it at once; the `battleWatch` turns (`play`) add the motion: a lunge for a move, the hurt flash, the faint.
 * They play one beat apart after the turn arrives; the summary's field then settles it.
 */
import { Vector3 } from 'three/webgpu';
import type { Group } from 'three/webgpu';
import { battlerSlot, trainerSlot } from '@ewa/render';
import type { CreatureBillboard, SpriteDescriptor } from '@ewa/render';
import { LEAD_VARIANTS, decodeLeadFlags, SPECTATE_RANGE_M, WATCH_RANGE_M } from '@ewa/protocol';
import type { WatchBattler, WatchEvent } from '@ewa/protocol';
import { watchSideName } from '../battle/watchLines';
import type { LeaseSprites, SpriteLease } from './creatureTextures';
import { followerSprite } from './FollowerViews';
import type { InteractionTargets } from './interaction';
import { makeInteractable } from './interaction';

export const WATCH_PREFIX = 'watch:';
/** one beat of a watched turn (ms) */
export const WATCH_BEAT_MS = 650;

/** What a ring needs of a `BattleSummary`. */
export interface SpectatedBattle {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  /** side 0's heading at the start (radians, the movement convention: forward = (sin, cos)) */
  readonly angle: number;
  readonly participants: readonly string[];
  readonly trainers: readonly string[];
  readonly field: readonly WatchBattler[];
}

export interface SpectatorDeps {
  readonly parent: Group;
  acquire(d: SpriteDescriptor): CreatureBillboard;
  descriptor(speciesId: string, key: string, variant: SpriteDescriptor['variant'], isAlpha: boolean, isShiny: boolean, spriteId?: string): SpriteDescriptor | null;
  readonly leaseSprites: LeaseSprites;
  height(x: number, z: number): number;
  dress(x: number, z: number): void;
  undress(x: number, z: number): void;
  readonly targets: InteractionTargets;
  interactKey(): string;
}

interface Stand {
  readonly key: string;
  readonly bb: CreatureBillboard;
  readonly lease: SpriteLease;
}

interface Ring {
  b: SpectatedBattle;
  readonly stands: Map<string, Stand>;
  /** turn beats waiting to play: [due ms, event] */
  readonly queue: [number, WatchEvent][];
}

const VARIANTS: ReadonlySet<string> = new Set(LEAD_VARIANTS);
const _c = new Vector3();
const _o = new Vector3();
const _slot: [number, number] = [0, 0];

/** The stage's yaw for a trainer heading: render's forward is (-sin, -cos), the movement's (sin, cos). */
export function ringYaw(angle: number): number {
  return angle + Math.PI;
}

export function standKey(b: WatchBattler): string {
  return `${b.side}:${b.pos}`;
}

export function watchTargetId(battleId: string): string {
  return `${WATCH_PREFIX}${battleId}`;
}

export class SpectatorViews {
  private readonly rings = new Map<string, Ring>();
  /** fighter id → where their avatar stands while a ring is up (the stage's trainer slot) */
  private readonly spots = new Map<string, { x: number; z: number; angle: number }>();
  private clock = 0;

  constructor(private readonly d: SpectatorDeps) {}

  /** The rings up now (tests, the dev handle). */
  get ringIds(): readonly string[] {
    return [...this.rings.keys()];
  }

  /** How many creatures a ring shows (tests, the dev handle). */
  standCount(battleId: string): number {
    return this.rings.get(battleId)?.stands.size ?? 0;
  }

  /** A fighter's avatar position while their battle's ring is up, else null (World3D's remote sink). */
  trainerSpot(playerId: string): { readonly x: number; readonly z: number; readonly angle: number } | null {
    return this.spots.get(playerId) ?? null;
  }

  /**
   * Brings the rings in line with the battles in the room: one for every battle within `SPECTATE_RANGE_M` of the viewer
   * that is not the player's own, none for the rest. Cheap when nothing changed (2 Hz from World3D plus every patch).
   */
  sync(battles: readonly SpectatedBattle[], selfId: string, vx: number, vz: number): void {
    const want = new Set<string>();
    for (const b of battles) {
      if (b.participants.includes(selfId)) continue;
      const ring = this.rings.get(b.id);
      // a little slack before a ring that is up goes, so the edge does not flicker
      const reach = ring === undefined ? SPECTATE_RANGE_M : SPECTATE_RANGE_M + 4;
      if (Math.hypot(b.x - vx, b.z - vz) > reach) continue;
      want.add(b.id);
      if (ring === undefined) this.open(b);
      else this.refresh(ring, b);
    }
    for (const id of [...this.rings.keys()]) if (!want.has(id)) this.close(id);
  }

  /** A watched turn arrived: its moves, hits and faints play one beat apart on the ring's creatures. */
  play(battleId: string, events: readonly WatchEvent[]): void {
    const ring = this.rings.get(battleId);
    if (ring === undefined) return;
    let due = this.clock;
    for (const e of events) {
      if (e.k !== 'move' && e.k !== 'hit' && e.k !== 'faint' && e.k !== 'in') continue;
      ring.queue.push([due, e]);
      due += WATCH_BEAT_MS;
    }
  }

  /** Per rendered frame: the queued beats. */
  update(dtMs: number): void {
    this.clock += dtMs;
    for (const ring of this.rings.values()) {
      while (ring.queue.length > 0 && ring.queue[0]![0] <= this.clock) this.beat(ring, ring.queue.shift()![1]);
    }
  }

  /** The zone's ground arrived (or changed): stand everything on it again. */
  reground(): void {
    for (const ring of this.rings.values()) this.place(ring);
  }

  clear(): void {
    for (const id of [...this.rings.keys()]) this.close(id);
  }

  private open(b: SpectatedBattle): void {
    const ring: Ring = { b, stands: new Map(), queue: [] };
    this.rings.set(b.id, ring);
    this.d.dress(b.x, b.z);
    this.refresh(ring, b);
  }

  private close(id: string): void {
    const ring = this.rings.get(id);
    if (ring === undefined) return;
    this.rings.delete(id);
    for (const s of ring.stands.values()) this.drop(s);
    ring.stands.clear();
    for (const p of ring.b.participants) this.spots.delete(p);
    this.d.targets.removeDynamic(watchTargetId(id));
    this.d.undress(ring.b.x, ring.b.z);
  }

  private refresh(ring: Ring, b: SpectatedBattle): void {
    ring.b = b;
    const seen = new Set<string>();
    for (const w of b.field) {
      const k = standKey(w);
      seen.add(k);
      const look = this.lookKey(w);
      const cur = ring.stands.get(k);
      if (cur !== undefined && cur.key === look) {
        // a faint still waiting in the queue plays as its beat; the field settles it otherwise
        if (ring.queue.length === 0) cur.bb.setFaint(w.hpPct === 0 ? 1 : 0);
        continue;
      }
      if (cur !== undefined) this.drop(cur);
      const s = this.stand(b.id, w, look);
      if (s === null) ring.stands.delete(k);
      else ring.stands.set(k, s);
    }
    for (const [k, s] of [...ring.stands]) {
      if (!seen.has(k)) {
        this.drop(s);
        ring.stands.delete(k);
      }
    }
    this.place(ring);
    const names = `${watchSideName(b.trainers[0])} vs ${watchSideName(b.trainers[1])}`;
    const t = this.d.targets.dynamicEntry(watchTargetId(b.id));
    if (t === undefined || t.prompt.target !== names) {
      this.d.targets.addDynamic(makeInteractable(watchTargetId(b.id), 'watch', b.x, b.z, 'Watch', names, this.d.interactKey(), WATCH_RANGE_M));
    }
  }

  /** species, look and form: a change rebinds the billboard */
  private lookKey(w: WatchBattler): string {
    return `${w.species}:${w.flags}`;
  }

  private stand(battleId: string, w: WatchBattler, key: string): Stand | null {
    const look = decodeLeadFlags(w.flags);
    const sprite = followerSprite(w.species, look.form);
    const variant = (VARIANTS.has(look.variantKey) ? look.variantKey : 'normal') as SpriteDescriptor['variant'];
    const desc = this.d.descriptor(w.species, `spectate:${battleId}:${standKey(w)}`, variant, look.isAlpha, look.isShiny, sprite === w.species ? undefined : sprite);
    if (desc === null) return null;
    const lease = this.d.leaseSprites(sprite, 'front');
    const bb = this.d.acquire(desc);
    bb.setFacing('front');
    if (w.hpPct === 0) bb.setFaint(1);
    this.d.parent.add(bb.object);
    return { key, bb, lease };
  }

  private drop(s: Stand): void {
    s.bb.object.removeFromParent();
    s.bb.dispose();
    s.lease.release();
  }

  /** The battlers on the stage's slots, the fighters on its trainer slots, all on the ground. */
  private place(ring: Ring): void {
    const b = ring.b;
    const yaw = ringYaw(b.angle);
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    _c.set(b.x, 0, b.z);
    const count = [0, 0];
    for (const w of b.field) count[w.side] = Math.max(count[w.side]!, w.pos + 1);
    for (const w of b.field) {
      const s = ring.stands.get(standKey(w));
      if (s === undefined) continue;
      battlerSlot(_c, yaw, w.side as 0 | 1, w.pos, count[w.side]!, _o);
      s.bb.setPosition(_o.x, this.d.height(_o.x, _o.z), _o.z);
      // a lunge goes toward the other side
      s.bb.setPoseAxis(w.side === 0 ? fx : -fx, w.side === 0 ? fz : -fz);
    }
    b.participants.forEach((p, i) => {
      if (i > 1) return;
      const side = i as 0 | 1;
      trainerSlot(b.x, b.z, fx, fz, side, _slot);
      // facing the ring centre (the movement convention: atan2(dx, dz))
      this.spots.set(p, { x: _slot[0], z: _slot[1], angle: Math.atan2(b.x - _slot[0], b.z - _slot[1]) });
    });
  }

  private beat(ring: Ring, e: WatchEvent): void {
    const at = (side: 0 | 1, pos: 0 | 1): Stand | undefined => ring.stands.get(`${side}:${pos}`);
    switch (e.k) {
      case 'move':
        at(e.side, e.pos)?.bb.setPose('lunge', WATCH_BEAT_MS);
        return;
      case 'hit':
        at(e.side, e.pos)?.bb.setPose('hurt', WATCH_BEAT_MS);
        return;
      case 'faint':
        // the faint pose ends dissolved and holds there; the next field refresh keeps it with setFaint(1)
        at(e.side, e.pos)?.bb.setPose('faint', WATCH_BEAT_MS * 1.5);
        return;
      case 'in': {
        const s = at(e.b.side, e.b.pos);
        if (s !== undefined && s.key === this.lookKey(e.b)) s.bb.setPose('enter', WATCH_BEAT_MS);
        return;
      }
      default:
        return;
    }
  }
}
