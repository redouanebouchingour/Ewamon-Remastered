/**
 * Phase B1 — legendary statics in the world (content `staticsFor(zoneId)`, `LegendaryStatic`). Each static whose gate
 * (`when`: `badge:<id>` → the `badge:<id>` flag, `flag:<f>` → `f`) is held and whose capture / win flag is not, stands
 * as a creature billboard at `nearestWalkable(h, x, z, 8)` — exactly where the server snaps it before its range check
 * (ZoneRoom `onInteract`) — with a `static` interactable ("Challenge"); `E` sends `interact {kind:'static', targetId:
 * species}`. A static disappears as soon as its flag arrives (`sync` on every flag refresh). Same billboard pattern as
 * `SpawnViews` (renderer sprite pool, one client group); the SceneDirector drives `sync` / `clear`.
 *
 * Textures (client IMPLEMENTATION-NOTES "Creature textures"): a static holds its front's static atlas while it stands,
 * and its front flipbook only while the player is near (`setViewer`, ≤ `STATIC_FLIPBOOK_NEAR_M`, let go past
 * `STATIC_FLIPBOOK_FAR_M`). The diorama camera's ground footprint ends ≈ 24 m from the player at the widest zoom stop
 * (34 m, −52°, 28° FOV), so a far static is never on screen; it plays its still frame (`CreatureBillboard.setFlipbook
 * (false)`) and its flipbook can leave the GPU. galvan_route's two statics stand 222 m apart: one flipbook at a time.
 */
import type { Group } from 'three/webgpu';
import { getHeightfield, nearestWalkable, staticsFor } from '@ewa/content';
import type { LegendaryStatic, ZoneId } from '@ewa/content';
import type { CreatureBillboard, SpriteDescriptor } from '@ewa/render';
import { speciesName } from '../data/content';
import { NO_LEASE, sideFor } from './creatureTextures';
import type { LeaseSprites, SpriteLease } from './creatureTextures';

/** A static's flipbook is held from this distance to the player (m; the camera shows ≤ ≈ 24 m around the player) … */
export const STATIC_FLIPBOOK_NEAR_M = 40;
/** … and let go beyond this one (hysteresis: walking the edge never thrashes a bind). */
export const STATIC_FLIPBOOK_FAR_M = 52;
import type { InteractionTargets } from './interaction';
import { makeInteractable } from './interaction';

/** The interactable id of a static (spawn ids are server-generated; the prefix keeps them apart). */
export const STATIC_PREFIX = 'static:';
export function staticTargetId(interactableId: string): string {
  return interactableId.startsWith(STATIC_PREFIX) ? interactableId.slice(STATIC_PREFIX.length) : interactableId;
}

/** The flag a static's `when` gate needs (the client flag set carries `badge:<id>` for held badges). */
export function staticGateFlag(st: Pick<LegendaryStatic, 'when'>): string {
  return st.when.startsWith('badge:') ? st.when : st.when.slice('flag:'.length);
}

export interface PlacedStatic {
  readonly species: string;
  readonly level: number;
  readonly flag: string;
  readonly x: number;
  readonly z: number;
}

/** The statics of `zoneId` that stand for these flags, at the server's snapped position. */
export function visibleStatics(zoneId: ZoneId, flags: ReadonlySet<string>): PlacedStatic[] {
  const list = staticsFor(zoneId);
  if (list.length === 0) return [];
  const h = getHeightfield(zoneId);
  const out: PlacedStatic[] = [];
  for (const st of list) {
    if (!flags.has(staticGateFlag(st)) || flags.has(st.flag)) continue;
    const p = nearestWalkable(h, st.x, st.z, 8);
    const [x, z] = p ?? [st.x, st.z];
    out.push({ species: st.species, level: st.level, flag: st.flag, x, z });
  }
  return out;
}

export interface LegendaryViewDeps {
  readonly parent: Group;
  acquire(d: SpriteDescriptor): CreatureBillboard;
  descriptor(speciesId: string, key: string): SpriteDescriptor | null;
  /** the textures of the side a static shows, held while it stands (`CreatureTextures.show`) */
  readonly leaseSprites: LeaseSprites;
  height(x: number, z: number): number;
  readonly targets: InteractionTargets;
  interactKey(): string;
}

const SIDE = sideFor('static');

interface StaticView {
  readonly species: string;
  readonly bb: CreatureBillboard | null;
  readonly x: number;
  readonly z: number;
  /** the front's static atlas, while it stands */
  readonly still: SpriteLease;
  /** the front's flipbook, while the player is near (null = far: the still frame plays) */
  flip: SpriteLease | null;
}

export class LegendaryViews {
  private readonly views = new Map<string, StaticView>();
  /** the player's position (NaN until known: every static counts as near) */
  private viewerX = Number.NaN;
  private viewerZ = Number.NaN;

  constructor(private readonly d: LegendaryViewDeps) {}

  /** The player moved (World3D: the zone's arrival point, then every nameplate refresh, 2 Hz): near statics play. */
  setViewer(x: number, z: number): void {
    this.viewerX = x;
    this.viewerZ = z;
    for (const v of this.views.values()) this.applyNear(v);
  }

  /** Whether the static of `species` holds (and plays) its flipbook (tests / debug). */
  playing(species: string): boolean {
    return this.views.get(species)?.flip != null;
  }

  get size(): number {
    return this.views.size;
  }

  has(species: string): boolean {
    return this.views.has(species);
  }

  /** Spawns the statics that should stand for these flags and despawns the rest (null zone = clear). */
  sync(zoneId: ZoneId | null, flags: ReadonlySet<string>): void {
    const want = zoneId === null ? [] : visibleStatics(zoneId, flags);
    const keep = new Set(want.map((w) => w.species));
    for (const id of [...this.views.keys()]) if (!keep.has(id)) this.remove(id);
    for (const w of want) if (!this.views.has(w.species)) this.add(w);
  }

  /** Despawns every static (zone unload). */
  clear(): void {
    for (const id of [...this.views.keys()]) this.remove(id);
  }

  private add(w: PlacedStatic): void {
    const desc = this.d.descriptor(w.species, `${STATIC_PREFIX}${w.species}`);
    let bb: CreatureBillboard | null = null;
    let still = NO_LEASE;
    if (desc !== null) {
      still = this.d.leaseSprites(w.species, SIDE, 'still');
      bb = this.d.acquire(desc);
      bb.setFacing(SIDE);
      bb.setFlipbook(false);
      bb.setPosition(w.x, this.d.height(w.x, w.z), w.z);
      this.d.parent.add(bb.object);
    }
    const v: StaticView = { species: w.species, bb, x: w.x, z: w.z, still, flip: null };
    this.views.set(w.species, v);
    this.applyNear(v);
    this.d.targets.addDynamic(makeInteractable(`${STATIC_PREFIX}${w.species}`, 'static', w.x, w.z, 'Challenge', `${speciesName(w.species)} Lv ${w.level}`, this.d.interactKey()));
  }

  private remove(species: string): void {
    const v = this.views.get(species);
    if (v === undefined) return;
    v.bb?.object.removeFromParent();
    v.bb?.dispose();
    v.flip?.release();
    v.flip = null;
    v.still.release();
    this.views.delete(species);
    this.d.targets.removeDynamic(`${STATIC_PREFIX}${species}`);
  }

  /** Near: lease the flipbook, then let the card play it. Far: back to the still frame, then let the flipbook go. */
  private applyNear(v: StaticView): void {
    if (v.bb === null) return;
    const d = Math.hypot(v.x - this.viewerX, v.z - this.viewerZ);
    const near = !(d > (v.flip !== null ? STATIC_FLIPBOOK_FAR_M : STATIC_FLIPBOOK_NEAR_M));   // NaN (no viewer yet) = near
    if (near && v.flip === null) {
      v.flip = this.d.leaseSprites(v.species, SIDE, 'flipbook');
      v.bb.setFlipbook(true);
    } else if (!near && v.flip !== null) {
      v.bb.setFlipbook(false);
      v.flip.release();
      v.flip = null;
    }
  }
}
