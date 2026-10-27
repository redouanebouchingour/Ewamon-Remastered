/**
 * Phase C1 — the raid den in the world. While `room.state.raid` is open (phases 0–3) its boss stands at the hotspot
 * `(x, z)` as a glowing billboard (the renderer's alpha treatment: `alphaGlow` rim, at `RAID_DEN_SCALE` × its size)
 * inside a spectator ring (render `dressSpectator`: the 7 m ring + the two glowing beacon pylons — no new render code),
 * with a `raid` interactable of range 8 m (the server's `RAID_JOIN_RANGE_M`,
 * measured from the same unsnapped hotspot point): "Join raid" in the lobby, "View raid" once the fight is on. `E`
 * opens the RaidLobby modal (and sends `raidJoin` first when the player is not in yet). The den goes when the raid
 * is over (phase 4) or the room drops it, and hides while the player's own raid battle is on (the boss stands on
 * the arena then). Same billboard pattern as `LegendaryViews` (renderer sprite pool, the client group, a lease on the
 * textures of the front it shows while the den stands); World3D drives `sync` from its patch handler.
 */
import type { Group } from 'three/webgpu';
import type { CreatureBillboard, SpriteDescriptor } from '@ewa/render';
import { speciesName } from '../data/content';
import { RAID_JOIN_RANGE_M } from '../battle/raid';
import { NO_LEASE, sideFor } from './creatureTextures';
import type { LeaseSprites, SpriteLease } from './creatureTextures';
import type { InteractionTargets } from './interaction';
import { makeInteractable } from './interaction';

export const RAID_PREFIX = 'raid:';
/** the den's boss stands this much larger than the species' own billboard */
export const RAID_DEN_SCALE = 1.8;

/** The raid id of a den interactable id. */
export function raidTargetId(interactableId: string): string {
  return interactableId.startsWith(RAID_PREFIX) ? interactableId.slice(RAID_PREFIX.length) : interactableId;
}

/** What the den needs of `room.state.raid`. */
export interface RaidDenInfo {
  readonly id: string;
  readonly bossSpecies: string;
  readonly bossLevel: number;
  readonly phase: number;
  readonly x: number;
  readonly z: number;
}

export interface RaidDenDeps {
  readonly parent: Group;
  acquire(d: SpriteDescriptor): CreatureBillboard;
  /** the glowing (alpha) descriptor of the boss species */
  descriptor(speciesId: string, key: string): SpriteDescriptor | null;
  /** the textures of the side the boss shows, held while the den stands (`CreatureTextures.show`) */
  readonly leaseSprites: LeaseSprites;
  height(x: number, z: number): number;
  readonly targets: InteractionTargets;
  interactKey(): string;
  /** the ring + beacons around the den (render `stage.dressSpectator` / `undressSpectator`) */
  dress?(x: number, z: number): void;
  undress?(x: number, z: number): void;
}

export function denVerb(phase: number): string {
  return phase === 0 ? 'Join raid' : 'View raid';
}

export class RaidDen {
  private cur: RaidDenInfo | null = null;
  private bb: CreatureBillboard | null = null;
  private lease: SpriteLease = NO_LEASE;
  private hidden = false;
  private dressedAt: { readonly x: number; readonly z: number } | null = null;

  constructor(private readonly d: RaidDenDeps) {}

  /** the raid the den shows, null when none */
  get raidId(): string | null {
    return this.cur?.id ?? null;
  }

  get phase(): number | null {
    return this.cur?.phase ?? null;
  }

  get visible(): boolean {
    return this.cur !== null && this.bb !== null && !this.hidden;
  }

  /** Shows the den for an open raid (phase < 4), re-prompts on a phase change, removes it otherwise. */
  sync(info: RaidDenInfo | null): void {
    if (info === null || info.id === '' || info.phase >= 4) {
      this.clear();
      return;
    }
    const cur = this.cur;
    if (cur !== null && cur.id === info.id && cur.bossSpecies === info.bossSpecies && cur.x === info.x && cur.z === info.z) {
      if (cur.phase !== info.phase) {
        this.cur = { ...info };
        this.addTarget(info);
      }
      return;
    }
    this.clear();
    this.cur = { ...info };
    const base = this.d.descriptor(info.bossSpecies, `${RAID_PREFIX}${info.id}`);
    if (base !== null) {
      this.lease = this.d.leaseSprites(info.bossSpecies, sideFor('raid'));
      const bb = this.d.acquire({ ...base, heightM: base.heightM * RAID_DEN_SCALE });
      bb.setFacing(sideFor('raid'));
      bb.setPosition(info.x, this.d.height(info.x, info.z), info.z);
      bb.object.visible = !this.hidden;
      this.d.parent.add(bb.object);
      this.bb = bb;
    }
    if (!this.hidden) this.setDressed(true);
    this.addTarget(info);
  }

  /** The zone's ground arrived (or changed): stand the den on it again. */
  reground(): void {
    const c = this.cur;
    if (c !== null) this.bb?.setPosition(c.x, this.d.height(c.x, c.z), c.z);
  }

  /** While the player's own raid battle is on, the den's boss would stand beside the arena's copy of it. */
  setHidden(on: boolean): void {
    this.hidden = on;
    if (this.bb !== null) this.bb.object.visible = !on;
    this.setDressed(!on && this.cur !== null);
  }

  /** whether the den's ring is up (tests / debug) */
  get dressed(): boolean {
    return this.dressedAt !== null;
  }

  private setDressed(on: boolean): void {
    const c = this.cur;
    if (on && c !== null && this.dressedAt === null) {
      this.d.dress?.(c.x, c.z);
      this.dressedAt = { x: c.x, z: c.z };
    } else if (!on && this.dressedAt !== null) {
      this.d.undress?.(this.dressedAt.x, this.dressedAt.z);
      this.dressedAt = null;
    }
  }

  clear(): void {
    this.setDressed(false);
    if (this.cur !== null) this.d.targets.removeDynamic(`${RAID_PREFIX}${this.cur.id}`);
    this.bb?.object.removeFromParent();
    this.bb?.dispose();
    this.bb = null;
    this.lease.release();
    this.lease = NO_LEASE;
    this.cur = null;
  }

  private addTarget(info: RaidDenInfo): void {
    // a new prompt object per phase: the targeting step swaps prompts by reference
    this.d.targets.addDynamic(
      makeInteractable(`${RAID_PREFIX}${info.id}`, 'raid', info.x, info.z, denVerb(info.phase), `${speciesName(info.bossSpecies)} Lv ${info.bossLevel}`, this.d.interactKey(), RAID_JOIN_RANGE_M),
    );
  }
}
