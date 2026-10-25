/**
 * Followers (SPEC §3.18, §20.4.8): every player's party lead walks behind them. The lead comes from the server
 * (`PlayerState.lead` / `leadFlags`, the AOI view, written only when it changes); this keeps render's `FollowerPool`
 * fed with a sprite for each trainer near the player, and holds the textures that sprite needs.
 *
 * Creature atlases are bound per zone (two species a 2048² atlas), so a lead may not be on the GPU here:
 * - the player's own follower holds its species' static atlas like any view (`CreatureTextures.show`, both sides; the
 *   zone load already holds the party's), so it always shows, front and back;
 * - another trainer's follower shows at once when its species' static atlas is already bound (the zone's set, the
 *   player's party, an idle battle sheet): held for as long as it walks there;
 * - otherwise it takes a party single (render `bindSingle`: just the front cell of its home atlas, a 1024² set) while
 *   fewer than `FOLLOWER_SINGLES` are out, and faces the camera only;
 * - beyond that (a crowd of trainers with leads from far zones), it does not walk with them: the graceful fallback is
 *   no follower rather than a whole atlas bound per passer-by (the texture budget belongs to the zone and the battles).
 * At most `FOLLOWER.max` followers (the player's own and the nearest remotes with a rig), re-chosen at 2 Hz.
 */
import { FOLLOWER, MAX_SINGLES, VARIANT_KEYS } from '@ewa/render';
import type { AtlasSet, FollowerPool, SpriteDescriptor, SpriteFrame } from '@ewa/render';
import { formsOf } from '@ewa/core';
import { decodeLeadFlags } from '@ewa/protocol';
import { species } from '../data/content';
import type { SpriteCatalog } from './spriteCatalog';
import type { CreatureTextures, SpriteLease } from './creatureTextures';

/** Party singles followers may hold at once (render allows `MAX_SINGLES` in all). */
export const FOLLOWER_SINGLES = 3;

export interface SingleBinder {
  bindSingle(set: AtlasSet, frame: SpriteFrame): Promise<void>;
  releaseSingle(atlasId: string, px: readonly number[]): void;
  singlesBound(): number;
}

export interface FollowerViewDeps {
  pool(): FollowerPool | null;
  catalog(): SpriteCatalog | null;
  textures(): CreatureTextures | null;
  singles(): SingleBinder | null;
  selfId(): string;
}

interface Want { readonly speciesId: string; readonly flags: number }

interface Live {
  readonly speciesId: string;
  readonly flags: number;
  /** the manifest entry it walks as (`followerSprite`) */
  readonly sprite: string;
  readonly lease: SpriteLease;
  readonly single: { readonly atlas: string; readonly px: readonly number[] } | null;
}

const VARIANTS: ReadonlySet<string> = new Set(VARIANT_KEYS);

/**
 * The manifest entry a lead walks as: `<species>_<form>` for the form its held item opens (`leadFlags` bits 5..7, the
 * 1-based slot in `formsOf`: ravatar holding a relic), else the species' own.
 */
export function followerSprite(speciesId: string, form: number): string {
  const sp = form === 0 ? undefined : species(speciesId);
  const f = sp === undefined ? undefined : formsOf(sp)[form - 1];
  return f === undefined ? speciesId : `${speciesId}_${f.id}`;
}

export class FollowerViews {
  private readonly wants = new Map<string, Want>();
  private readonly live = new Map<string, Live>();
  private readonly hidden = new Set<string>();
  private order: readonly string[] = [];

  constructor(private readonly d: FollowerViewDeps) {}

  /** Live followers (tests, the dev handle). */
  get size(): number {
    return this.live.size;
  }

  /** How a player's follower is drawn now: 'atlas', 'single', or null (none). */
  modeOf(id: string): 'atlas' | 'single' | null {
    const l = this.live.get(id);
    return l === undefined ? null : l.single === null ? 'atlas' : 'single';
  }

  /** The manifest entry a player's follower walks as (its species, or `<species>_<form>`), null when none (tests, the dev handle). */
  spriteOf(id: string): string | null {
    return this.live.get(id)?.sprite ?? null;
  }

  /** A player's lead from the room state ('' = none). Takes effect on the next `sync` (the player's own: at once). */
  setLead(id: string, speciesId: string, flags: number): void {
    const cur = this.wants.get(id);
    if (speciesId === '') {
      if (cur === undefined) return;
      this.wants.delete(id);
    } else {
      if (cur !== undefined && cur.speciesId === speciesId && cur.flags === flags) return;
      this.wants.set(id, { speciesId, flags });
    }
    if (id === this.d.selfId()) this.sync(this.order);
  }

  remove(id: string): void {
    this.wants.delete(id);
    this.hidden.delete(id);
    this.drop(id);
  }

  /** Shows / hides a follower (its owner in a battle, inside a hall, in the arena) without dropping its textures. */
  setShown(id: string, on: boolean): void {
    if (on) this.hidden.delete(id);
    else this.hidden.add(id);
    this.d.pool()?.setShown(id, on);
  }

  /**
   * Re-chooses who walks with a follower: the player first, then `nearest` (remote ids with a rig, nearest first) while
   * the pool has room and the textures allow. 2 Hz and on a lead change; allocates only then.
   */
  sync(nearest: readonly string[]): void {
    this.order = nearest;
    const pool = this.d.pool();
    if (pool === null) return;
    const self = this.d.selfId();
    const want: string[] = [];
    if (this.wants.has(self)) want.push(self);
    for (const id of nearest) {
      if (want.length >= FOLLOWER.max) break;
      if (id !== self && this.wants.has(id)) want.push(id);
    }
    const keep = new Set(want);
    for (const id of [...this.live.keys()]) if (!keep.has(id)) this.drop(id);
    for (const id of want) {
      const w = this.wants.get(id)!;
      const cur = this.live.get(id);
      if (cur !== undefined && cur.speciesId === w.speciesId && cur.flags === w.flags) continue;
      if (cur !== undefined) this.drop(id);
      this.make(id, w, id === self);
    }
  }

  clear(): void {
    for (const id of [...this.live.keys()]) this.drop(id);
    this.wants.clear();
    this.hidden.clear();
    this.order = [];
  }

  /** The renderer went away (a lost device): the pool and its textures with it; leads are kept for the new one. */
  detach(): void {
    for (const l of this.live.values()) l.lease.release();
    this.live.clear();
  }

  private make(id: string, w: Want, self: boolean): void {
    const pool = this.d.pool();
    const cat = this.d.catalog();
    const tex = this.d.textures();
    if (pool === null || cat === null || tex === null) return;
    const look = decodeLeadFlags(w.flags);
    const variant = (VARIANTS.has(look.variantKey) ? look.variantKey : 'normal') as SpriteDescriptor['variant'];
    const sprite = followerSprite(w.speciesId, look.form);
    const desc = cat.descriptor(w.speciesId, `follower:${id}`, variant, look.isAlpha, look.isShiny, sprite === w.speciesId ? undefined : sprite);
    if (desc === null) return;
    const side = cat.sideAtlases(sprite, 'front');
    if (side === null) return;
    let lease: SpriteLease;
    let single: Live['single'] = null;
    if (self || tex.isBound(side.atlas)) {
      // the static atlas both sides are drawn from, held while it walks (no flipbook: a follower stays still-framed)
      const front = tex.show(sprite, 'front', 'still');
      const back = tex.show(sprite, 'back', 'still');
      lease = { release: () => { front.release(); back.release(); } };
    } else {
      const s = this.d.singles();
      const set = cat.atlas(side.atlas);
      let singlesHere = 0;
      for (const l of this.live.values()) if (l.single !== null) singlesHere++;
      if (s === null || set === null || singlesHere >= FOLLOWER_SINGLES || s.singlesBound() >= MAX_SINGLES) return; // the fallback: no follower
      void s.bindSingle(set, desc.front).catch(() => undefined);
      single = { atlas: side.atlas, px: desc.front.px };
      lease = { release: () => s.releaseSingle(side.atlas, desc.front.px) };
    }
    if (!pool.set(id, desc, single !== null)) {
      lease.release();
      return;
    }
    this.live.set(id, { speciesId: w.speciesId, flags: w.flags, sprite, lease, single });
    if (this.hidden.has(id)) pool.setShown(id, false);
  }

  private drop(id: string): void {
    const l = this.live.get(id);
    if (l === undefined) return;
    this.live.delete(id);
    this.d.pool()?.set(id, null);
    l.lease.release();
  }
}
