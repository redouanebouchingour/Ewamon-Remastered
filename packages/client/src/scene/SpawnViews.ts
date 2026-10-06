/**
 * Wild spawns in the world (`room.state.spawns`, AOI-scoped): one creature billboard per spawn from the renderer's
 * sprite pool, standing on the terrain at the spawn's (x, z), plus a `spawn` interactable (1.2 u, SPEC §20.4.7) whose
 * `E` sends `engageSpawn`. A spawn engaged by anyone (`engagedBy !== ''`) is hidden: its battle is on an arena.
 * Render has no world-creature API beyond the pool (`CreatureBillboard.object` "add to the zone/arena root"): the
 * billboards live under one client group in the scene and are disposed before the zone (IMPLEMENTATION-NOTES
 * part 2, S3). Membership changes come from schema callbacks, never from the tick.
 */
import type { Group } from 'three/webgpu';
import { VARIANT_KEYS } from '@ewa/render';
import type { CreatureBillboard, SpriteDescriptor } from '@ewa/render';
import { speciesName } from '../data/content';
import type { InteractionTargets } from './interaction';
import { makeInteractable } from './interaction';

export interface SpawnLike {
  readonly id: string;
  readonly speciesId: string;
  readonly level: number;
  readonly x: number;
  readonly z: number;
  readonly variantKey: string;
  readonly isAlpha: boolean;
  /** Phase D4 (SpawnState.isShiny); absent = false */
  readonly isShiny?: boolean;
  readonly engagedBy: string;
}

export interface SpawnViewDeps {
  readonly parent: Group;
  acquire(d: SpriteDescriptor): CreatureBillboard;
  descriptor(speciesId: string, key: string, variant: SpriteDescriptor['variant'], isAlpha: boolean, isShiny?: boolean): SpriteDescriptor | null;
  ensureSpecies(speciesId: string): void;
  height(x: number, z: number): number;
  readonly targets: InteractionTargets;
  interactKey(): string;
}

/** render's five variant keys (a string list here would spell a badge id that shares its name) */
const VARIANTS: ReadonlySet<string> = new Set(VARIANT_KEYS);

interface View { bb: CreatureBillboard | null; x: number; z: number; engaged: boolean }

export class SpawnViews {
  private readonly views = new Map<string, View>();

  constructor(private readonly d: SpawnViewDeps) {}

  get size(): number {
    return this.views.size;
  }

  add(s: SpawnLike): void {
    this.remove(s.id);
    const variant = (VARIANTS.has(s.variantKey) ? s.variantKey : 'normal') as SpriteDescriptor['variant'];
    const desc = this.d.descriptor(s.speciesId, `spawn:${s.id}`, variant, s.isAlpha, s.isShiny === true);
    let bb: CreatureBillboard | null = null;
    if (desc !== null) {
      this.d.ensureSpecies(s.speciesId);
      bb = this.d.acquire(desc);
      bb.setFacing('front');
      bb.setPosition(s.x, this.d.height(s.x, s.z), s.z);
      this.d.parent.add(bb.object);
    }
    const view: View = { bb, x: s.x, z: s.z, engaged: s.engagedBy !== '' };
    this.views.set(s.id, view);
    const label = `${s.isShiny === true ? 'shiny ' : ''}${s.isAlpha ? 'alpha ' : ''}${speciesName(s.speciesId)} Lv ${s.level}`;
    const e = makeInteractable(s.id, 'spawn', s.x, s.z, 'Battle the wild', label, this.d.interactKey());
    e.enabled = !view.engaged;
    this.d.targets.addDynamic(e);
    this.applyVisibility(view);
  }

  update(s: SpawnLike): void {
    const v = this.views.get(s.id);
    if (v === undefined) {
      this.add(s);
      return;
    }
    if (s.x !== v.x || s.z !== v.z) {
      v.x = s.x;
      v.z = s.z;
      v.bb?.setPosition(s.x, this.d.height(s.x, s.z), s.z);
      const e = this.d.targets.dynamicEntry(s.id);
      if (e !== undefined) {
        e.x = s.x;
        e.z = s.z;
      }
    }
    const engaged = s.engagedBy !== '';
    if (engaged !== v.engaged) {
      v.engaged = engaged;
      const e = this.d.targets.dynamicEntry(s.id);
      if (e !== undefined) e.enabled = !engaged;
      this.applyVisibility(v);
    }
  }

  remove(id: string): void {
    const v = this.views.get(id);
    if (v === undefined) return;
    v.bb?.object.removeFromParent();
    v.bb?.dispose();
    this.views.delete(id);
    this.d.targets.removeDynamic(id);
  }

  /** Re-lays every billboard on the ground (a new zone collider). */
  reground(): void {
    for (const v of this.views.values()) v.bb?.setPosition(v.x, this.d.height(v.x, v.z), v.z);
  }

  clear(): void {
    for (const id of [...this.views.keys()]) this.remove(id);
  }

  private applyVisibility(v: View): void {
    if (v.bb !== null) v.bb.object.visible = !v.engaged;
  }
}
