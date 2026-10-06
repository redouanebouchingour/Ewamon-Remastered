/**
 * Phase B1 — legendary statics in the world (content `staticsFor(zoneId)`, `LegendaryStatic`). Each static whose gate
 * (`when`: `badge:<id>` → the `badge:<id>` flag, `flag:<f>` → `f`) is held and whose capture / win flag is not, stands
 * as a creature billboard at `nearestWalkable(h, x, z, 8)` — exactly where the server snaps it before its range check
 * (ZoneRoom `onInteract`) — with a `static` interactable ("Challenge"); `E` sends `interact {kind:'static', targetId:
 * species}`. A static disappears as soon as its flag arrives (`sync` on every flag refresh). Same billboard pattern as
 * `SpawnViews` (renderer sprite pool, one client group); the SceneDirector drives `sync` / `clear`.
 */
import type { Group } from 'three/webgpu';
import { getHeightfield, nearestWalkable, staticsFor } from '@ewa/content';
import type { LegendaryStatic, ZoneId } from '@ewa/content';
import type { CreatureBillboard, SpriteDescriptor } from '@ewa/render';
import { speciesName } from '../data/content';
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
  ensureSpecies(speciesId: string): void;
  height(x: number, z: number): number;
  readonly targets: InteractionTargets;
  interactKey(): string;
}

export class LegendaryViews {
  private readonly views = new Map<string, CreatureBillboard | null>();

  constructor(private readonly d: LegendaryViewDeps) {}

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
    if (desc !== null) {
      this.d.ensureSpecies(w.species);
      bb = this.d.acquire(desc);
      bb.setFacing('front');
      bb.setPosition(w.x, this.d.height(w.x, w.z), w.z);
      this.d.parent.add(bb.object);
    }
    this.views.set(w.species, bb);
    this.d.targets.addDynamic(makeInteractable(`${STATIC_PREFIX}${w.species}`, 'static', w.x, w.z, 'Challenge', `${speciesName(w.species)} Lv ${w.level}`, this.d.interactKey()));
  }

  private remove(species: string): void {
    if (!this.views.has(species)) return;
    const bb = this.views.get(species) ?? null;
    bb?.object.removeFromParent();
    bb?.dispose();
    this.views.delete(species);
    this.d.targets.removeDynamic(`${STATIC_PREFIX}${species}`);
  }
}
