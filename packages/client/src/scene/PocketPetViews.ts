/**
 * Team Ewamon HQ's pets (content `devTeamPets`): each of the original team's own Ewamon stands beside its owner's chair
 * (Darkone by Red1, Moflame by Mohaned, Resilian by Yasser, Yaschamp by Yasin) while the player is in the house. The
 * same billboard pattern as `LegendaryViews` (renderer sprite pool, its 3D body when models are on), without an
 * interactable: they are dressing. The SceneDirector syncs them on entering / leaving a pocket; a battle hides them.
 */
import type { Group } from 'three/webgpu';
import { devTeamIn, devTeamPets } from '@ewa/content';
import type { PlacedInterior } from '@ewa/content';
import type { CreatureBillboard, SpriteDescriptor } from '@ewa/render';
import { NO_LEASE, sideFor } from './creatureTextures';
import type { LeaseSprites, SpriteLease } from './creatureTextures';

export interface PocketPetDeps {
  readonly parent: Group;
  acquire(d: SpriteDescriptor): CreatureBillboard;
  descriptor(speciesId: string, key: string): SpriteDescriptor | null;
  readonly leaseSprites: LeaseSprites;
  height(x: number, z: number): number;
}

const SIDE = sideFor('static');

interface PetView {
  readonly bb: CreatureBillboard | null;
  readonly still: SpriteLease;
}

export class PocketPetViews {
  private views: PetView[] = [];
  private pocket: string | null = null;
  private hidden = false;

  constructor(private readonly d: PocketPetDeps) {}

  /** The pocket the player stands in (null = outside): the team's house shows its pets, anything else none. */
  sync(p: PlacedInterior | null): void {
    const id = p !== null && devTeamIn(p.def.id) !== null ? p.def.id : null;
    if (id === this.pocket) return;
    this.clear();
    this.pocket = id;
    if (p === null || id === null) return;
    for (const pet of devTeamPets(p.at)) {
      const desc = this.d.descriptor(pet.species, `pet:${pet.owner}`);
      if (desc === null) {
        this.views.push({ bb: null, still: NO_LEASE });
        continue;
      }
      const still = this.d.leaseSprites(pet.species, SIDE, 'still');
      const bb = this.d.acquire(desc);
      bb.setFacing(SIDE);
      bb.setFlipbook(false);
      bb.setPosition(pet.x, this.d.height(pet.x, pet.z), pet.z);
      bb.object.visible = !this.hidden;
      this.d.parent.add(bb.object);
      this.views.push({ bb, still });
    }
  }

  /** Hidden while a battle is on (World3D `enterBattle` / `exitBattle`). */
  setHidden(hidden: boolean): void {
    this.hidden = hidden;
    for (const v of this.views) if (v.bb !== null) v.bb.object.visible = !hidden;
  }

  get size(): number {
    return this.views.filter((v) => v.bb !== null).length;
  }

  clear(): void {
    for (const v of this.views) {
      v.bb?.object.removeFromParent();
      v.bb?.dispose();
      v.still.release();
    }
    this.views = [];
    this.pocket = null;
  }
}
