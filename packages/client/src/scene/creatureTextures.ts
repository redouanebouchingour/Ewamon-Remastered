/**
 * Creature texture residency: which creature atlases are bound on the GPU, and for how long (render §10.4.2
 * bind / release; SPEC §50.2.2 texture cap; client IMPLEMENTATION-NOTES "Creature textures").
 *
 * Render's sprite pool refcounts binds and frees an atlas once its last bind is released AND no billboard samples it.
 * This is the client's half of that contract — every bind has an owner that releases it:
 *
 * - **Holds.** Everything that shows a creature holds the atlases of the ONE side it shows (`show(species, side)`): the
 *   side's static atlas and, for an animated legendary / mythical, that side's flipbook — never the other side's.
 *   Overworld spawns, legendary statics, the raid den, remote players' creatures and the evolution / inspector close-ups
 *   show the front; in battle the player's battlers show the back and the foes the front (`sideFor`, `stageSide`). A
 *   flipbook is bound the first time a hold asks for it; the billboard shows the static frame until it lands (render
 *   re-points it once). A view may hold the still part and the flipbook part apart (`show(…, 'still' | 'flipbook')`): a
 *   legendary static plays its flipbook only while the player is near it (`LegendaryViews.setViewer`). The zone load
 *   holds the zone's static set and the party's static atlases (§20.10.3 phase 3) for the zone's life, a battle holds
 *   both parties' static atlases for the battle's life.
 * - **Refcounts.** One entry per atlas id; two holds on the same side bind it once. When the last hold goes the entry
 *   idles: it stays bound for `graceMs` (re-showing the creature costs no upload) while at most `idleAnim` flipbooks and
 *   `idleStatic` static atlases idle (least recently used go first), then it is released to render.
 * - **Budget guard.** Bound creature textures stay under the budget (GPU bytes, render's per-atlas estimate; in the
 *   world `creatureBudget`: what the §50.2.2 cap leaves once every other texture the renderer holds is counted): before
 *   a bind that would pass it, idle entries are released — flipbooks before static atlases, least recently used first,
 *   never one a hold still shows or a billboard still samples (`atlasUsers`). A flipbook that still does not fit is not
 *   bound (the creature keeps its static frame) and is retried whenever bytes are freed (and on `refresh`, the world's
 *   1 Hz call, as the budget moves); a static atlas always binds (a creature is always drawn), an overrun reported once.
 *
 * Pure bookkeeping over a `TexturePool` seam and an injected clock / timer, so node tests drive it without a GPU.
 */
import { animAtlasSetBytes, atlasSetBytes } from '@ewa/render';
import type { AnimAtlasSet, AtlasSet } from '@ewa/render';
import type { SpriteCatalog } from './spriteCatalog';

export type CreatureSide = 'front' | 'back';

/** Where a creature is shown. */
export type ShowContext = 'wild' | 'static' | 'raid' | 'remote' | 'battlePlayer' | 'battleFoe' | 'evolution' | 'inspect';

/** The side each context shows: the player's battlers turn their back to the camera, everything else faces it. */
export function sideFor(ctx: ShowContext): CreatureSide {
  return ctx === 'battlePlayer' ? 'back' : 'front';
}

/** The side a battle stage slot shows: render's stage side 0 is the near (viewer's) position (`battleStage.setBattler`). */
export function stageSide(side: 0 | 1): CreatureSide {
  return side === 0 ? sideFor('battlePlayer') : sideFor('battleFoe');
}

/** A view's hold on the textures it shows; `release()` once the view is gone (idempotent). */
export interface SpriteLease {
  release(): void;
}

/** Which atlases of a side a lease holds: both, the static atlas only, or the flipbook only. */
export type SpritePart = 'all' | 'still' | 'flipbook';

/** What views ask for: a lease on the atlases one side of a species needs (default: all of them). */
export type LeaseSprites = (speciesId: string, side: CreatureSide, part?: SpritePart) => SpriteLease;

export const NO_LEASE: SpriteLease = Object.freeze({ release: () => undefined });

/** A hold on a set of atlas ids; `ready` settles once every bind it started landed (or failed / was refused). */
export interface AtlasHold extends SpriteLease {
  readonly ready: Promise<void>;
  readonly ids: readonly string[];
  readonly released: boolean;
}

/** The sprite pool surface used here (render `BillboardPool`). */
export interface TexturePool {
  bindAtlas(set: AtlasSet): Promise<void>;
  bindAnimAtlas(set: AnimAtlasSet): Promise<void>;
  releaseAtlas(id: string): void;
  /** Billboards sampling `id` right now (render `BillboardPool.atlasUsers`); absent = 0. */
  atlasUsers?(id: string): number;
}

/**
 * Defaults (client IMPLEMENTATION-NOTES "Creature textures" documents the split of the §50.2.2 cap). Bytes are GPU
 * bytes as render estimates them (`atlasSetBytes` / `animAtlasSetBytes`: the four-level chains the GPU allocates), which
 * is what render's corrected texture metric counts for a sprite atlas (render IMPLEMENTATION-NOTES Part 9).
 */
export const CREATURE_TEXTURES = Object.freeze({
  /** SPEC §50.2.2 texture cap (700 MiB; render `COUNT_CAPS.texturesSize`) */
  capBytes: 734_003_200,
  /** kept free under the cap for what grows between two binds (HUD canvases, VFX, a hero texture landing) */
  headroomBytes: 16 * 2 ** 20,
  /** the creature budget never drops below this (static atlases bind past it anyway) … */
  minBytes: 128 * 2 ** 20,
  /** … nor rises above it (before the first frame nothing else is counted yet) */
  maxBytes: 400 * 2 ** 20,
  graceMs: 20_000,
  idleAnim: 2,
  idleStatic: 4,
});

/**
 * The creature share of the §50.2.2 texture cap, live: the cap minus every other texture byte the renderer holds
 * (`textureBytes` = render's corrected metric, minus `creatureBytes` = the sprite pool's own), minus the headroom,
 * clamped to [minBytes, maxBytes]. Zone materials and render targets (which grow with the drawing buffer) come first;
 * the creatures get what is left.
 */
export function creatureBudget(textureBytes: number, creatureBytes: number, c: Pick<typeof CREATURE_TEXTURES, 'capBytes' | 'headroomBytes' | 'minBytes' | 'maxBytes'> = CREATURE_TEXTURES): number {
  const others = Math.max(0, textureBytes - creatureBytes);
  return Math.min(c.maxBytes, Math.max(c.minBytes, c.capBytes - others - c.headroomBytes));
}

export interface CreatureTextureOptions {
  readonly catalog: () => SpriteCatalog | null;
  readonly pool: () => TexturePool | null;
  readonly now?: () => number;
  readonly setTimer?: (fn: () => void, ms: number) => unknown;
  readonly clearTimer?: (handle: unknown) => void;
  /** a fixed budget (tests) or a live one (`creatureBudget` over the renderer's stats); default `maxBytes` */
  readonly budgetBytes?: number | (() => number);
  readonly graceMs?: number;
  readonly idleAnim?: number;
  readonly idleStatic?: number;
  readonly warn?: (msg: string) => void;
}

type Kind = 'static' | 'anim';

interface Entry {
  readonly id: string;
  readonly kind: Kind;
  /** GPU bytes (render's estimate of the set) */
  readonly bytes: number;
  /** holds on it */
  refs: number;
  /** a pool bind is outstanding (not yet released) */
  bound: boolean;
  /** a flipbook the budget guard refused while held; retried when bytes free up */
  denied: boolean;
  /** when the last hold went (NaN while held) */
  idleSince: number;
  /** last hold / release: the LRU order */
  lastUse: number;
  /** the outstanding bind, settled (never rejects) */
  settled: Promise<void>;
  /** bumped per bind, so a stale settle never touches a newer bind */
  gen: number;
}

/** One row of `stats().entries` (tests, the harness, the dev console). */
export interface CreatureTextureRow {
  readonly id: string;
  readonly kind: Kind;
  readonly bytes: number;
  readonly refs: number;
  readonly bound: boolean;
  readonly denied: boolean;
  readonly idle: boolean;
}

export interface CreatureTextureStats {
  /** GPU bytes of every bound creature atlas (binds in flight included) */
  readonly boundBytes: number;
  readonly budgetBytes: number;
  readonly bound: number;
  readonly idle: number;
  readonly denied: number;
  /** binds issued / releases issued since construction */
  readonly binds: number;
  readonly releases: number;
  readonly entries: readonly CreatureTextureRow[];
}

const RESOLVED: Promise<void> = Promise.resolve();

class Hold implements AtlasHold {
  private live = true;
  constructor(private readonly owner: CreatureTextures, readonly ids: readonly string[], readonly ready: Promise<void>) {}
  get released(): boolean {
    return !this.live;
  }
  release(): void {
    if (!this.live) return;
    this.live = false;
    this.owner.unrefAll(this.ids);
  }
}

export class CreatureTextures {
  private readonly entries = new Map<string, Entry>();
  private readonly now: () => number;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (h: unknown) => void;
  private readonly budgetOf: () => number;
  readonly graceMs: number;
  private readonly idleAnim: number;
  private readonly idleStatic: number;
  private bytes = 0;
  /** held flipbooks the guard refused (waiting on their static frame) */
  private denied = 0;
  private binds = 0;
  private releases = 0;
  private timer: unknown = null;
  private timerAt = Number.POSITIVE_INFINITY;
  private readonly warned = new Set<string>();
  private disposed = false;

  constructor(private readonly o: CreatureTextureOptions) {
    this.now = o.now ?? (() => performance.now());
    this.setTimer = o.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = o.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
    const b = o.budgetBytes ?? CREATURE_TEXTURES.maxBytes;
    this.budgetOf = typeof b === 'number' ? () => b : b;
    this.graceMs = o.graceMs ?? CREATURE_TEXTURES.graceMs;
    this.idleAnim = o.idleAnim ?? CREATURE_TEXTURES.idleAnim;
    this.idleStatic = o.idleStatic ?? CREATURE_TEXTURES.idleStatic;
  }

  // ---- holds ------------------------------------------------------------------------------------------------------

  /** The atlases one side of `speciesId` needs: its static atlas, then its flipbook (when it has one). */
  sideAtlases(speciesId: string, side: CreatureSide): readonly string[] {
    const s = this.o.catalog()?.sideAtlases(speciesId, side) ?? null;
    if (s === null) return [];
    return s.anim === null ? [s.atlas] : [s.atlas, s.anim];
  }

  /**
   * A view shows `speciesId` from `side` until the lease is released: the side's static atlas and its flipbook (`all`),
   * or only one of them (`still`, `flipbook`).
   */
  show(speciesId: string, side: CreatureSide, part: SpritePart = 'all'): AtlasHold {
    const ids = this.sideAtlases(speciesId, side);
    return this.hold(part === 'all' ? ids : part === 'still' ? ids.slice(0, 1) : ids.slice(1));
  }

  /** The budget now (GPU bytes). */
  get budgetBytes(): number {
    return this.budgetOf();
  }

  /** The static atlases of both sides of each species (a zone's party, a battle's teams); flipbooks come with `show`. */
  staticAtlasesOf(species: Iterable<string>): string[] {
    const cat = this.o.catalog();
    const out: string[] = [];
    if (cat === null) return out;
    for (const sp of species) for (const a of cat.atlasesOf(sp)) if (!out.includes(a)) out.push(a);
    return out;
  }

  /**
   * Holds atlas ids (static or flipbook) until released: static atlases first, so the budget guard sees the ones that
   * must bind before the flipbooks it may refuse. `onSettled(id)` runs once per bind outstanding for this hold, when it
   * lands. `replacing` (the zone's or the battle's previous hold) is released between taking the new holds and binding:
   * what both hold never idles, what only the old one held is idle — and releasable — before anything new binds.
   */
  hold(ids: readonly string[], onSettled?: (id: string) => void, replacing?: SpriteLease | null): AtlasHold {
    if (this.disposed) {
      replacing?.release();
      return new Hold(this, [], RESOLVED);
    }
    const uniq: string[] = [];
    for (const id of ids) if (!uniq.includes(id)) uniq.push(id);
    const ordered = [...uniq.filter((id) => this.kindOf(id) === 'static'), ...uniq.filter((id) => this.kindOf(id) === 'anim')];
    const held: Entry[] = [];
    for (const id of ordered) {
      const e = this.ref(id);
      if (e !== null) held.push(e);
    }
    replacing?.release();
    for (const e of held) if (!e.bound) this.bind(e);
    const waits: Promise<void>[] = [];
    for (const e of held) if (e.bound) waits.push(onSettled === undefined ? e.settled : e.settled.then(() => onSettled(e.id)));
    return new Hold(this, held.map((e) => e.id), waits.length === 0 ? RESOLVED : Promise.all(waits).then(() => undefined));
  }

  /** Binds the side now and lets it idle at once (re-shown within the grace period it costs no upload). */
  prefetch(speciesId: string, side: CreatureSide): void {
    this.show(speciesId, side).release();
  }

  /** @internal (Hold) */
  unrefAll(ids: readonly string[]): void {
    for (const id of ids) this.unref(id);
    this.retryDenied();
  }

  // ---- grace / LRU ---------------------------------------------------------------------------------------------------

  /** Releases idle entries past their grace period (the timer calls it; exposed for tests). */
  sweep(): void {
    if (this.disposed) return;
    const now = this.now();
    for (const e of [...this.entries.values()]) {
      if (e.refs > 0 || !e.bound || now - e.idleSince < this.graceMs) continue;
      if (this.users(e.id) > 0) {
        e.idleSince = now - this.graceMs + 1000;   // a billboard still samples it: look again in a second
        continue;
      }
      this.evict(e);
    }
    this.retryDenied();
    this.schedule();
  }

  /** Retries the flipbooks the guard refused (the budget is live: other textures may have gone). The world calls it at 1 Hz. */
  refresh(): void {
    if (this.denied > 0) this.retryDenied();
  }

  /** Releases every idle entry now (tests; a teardown). */
  flushIdle(): void {
    for (const e of [...this.entries.values()]) if (e.refs === 0 && e.bound && this.users(e.id) === 0) this.evict(e);
    this.retryDenied();
    this.schedule();
  }

  // ---- reads -------------------------------------------------------------------------------------------------------

  get boundBytes(): number {
    return this.bytes;
  }

  /** Holds on `id` (0 when not held). */
  refs(id: string): number {
    return this.entries.get(id)?.refs ?? 0;
  }

  /** Whether a pool bind of `id` is outstanding. */
  isBound(id: string): boolean {
    return this.entries.get(id)?.bound === true;
  }

  stats(): CreatureTextureStats {
    const rows: CreatureTextureRow[] = [];
    let bound = 0;
    let idle = 0;
    let denied = 0;
    for (const e of this.entries.values()) {
      rows.push({ id: e.id, kind: e.kind, bytes: e.bytes, refs: e.refs, bound: e.bound, denied: e.denied, idle: e.refs === 0 && e.bound });
      if (e.bound) bound++;
      if (e.refs === 0 && e.bound) idle++;
      if (e.denied) denied++;
    }
    return { boundBytes: this.bytes, budgetBytes: this.budgetOf(), bound, idle, denied, binds: this.binds, releases: this.releases, entries: rows };
  }

  /** Releases every bind (the world is disposed; render's pool is about to go too). */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null;
    const pool = this.o.pool();
    for (const e of this.entries.values()) if (e.bound) pool?.releaseAtlas(e.id);
    this.entries.clear();
    this.bytes = 0;
  }

  // ---- internals ---------------------------------------------------------------------------------------------------

  private kindOf(id: string): Kind | null {
    const have = this.entries.get(id);
    if (have !== undefined) return have.kind;
    const cat = this.o.catalog();
    if (cat === null) return null;
    if (cat.atlas(id) !== null) return 'static';
    return cat.animAtlas(id) !== null ? 'anim' : null;
  }

  private make(id: string): Entry | null {
    const cat = this.o.catalog();
    if (cat === null) return null;
    const set = cat.atlas(id);
    const anim = set === null ? cat.animAtlas(id) : null;
    if (set === null && anim === null) return null;
    const bytes = set !== null ? atlasSetBytes(set.size, set.normalScale) : animAtlasSetBytes(anim!.width, anim!.height, anim!.normalScale);
    return { id, kind: set !== null ? 'static' : 'anim', bytes, refs: 0, bound: false, denied: false, idleSince: Number.NaN, lastUse: 0, settled: RESOLVED, gen: 0 };
  }

  private ref(id: string): Entry | null {
    let e = this.entries.get(id);
    if (e === undefined) {
      const made = this.make(id);
      if (made === null) return null;
      e = made;
      this.entries.set(id, e);
    }
    e.refs++;
    e.lastUse = this.now();
    e.idleSince = Number.NaN;
    return e;
  }

  private unref(id: string): void {
    const e = this.entries.get(id);
    if (e === undefined || e.refs === 0) return;
    e.refs--;
    e.lastUse = this.now();
    if (e.refs > 0) return;
    if (!e.bound) {
      // refused or failed: nothing is bound to keep
      if (e.denied) this.denied--;
      e.denied = false;
      this.entries.delete(id);
      return;
    }
    e.idleSince = e.lastUse;
    this.trimIdle(e.kind);
    this.schedule();
  }

  private users(id: string): number {
    return this.o.pool()?.atlasUsers?.(id) ?? 0;
  }

  private bind(e: Entry): void {
    const pool = this.o.pool();
    const cat = this.o.catalog();
    if (pool === null || cat === null || this.disposed) return;
    const budget = this.budgetOf();
    if (this.bytes + e.bytes > budget) this.makeRoom(this.bytes + e.bytes - budget);
    if (this.bytes + e.bytes > budget) {
      if (e.kind === 'anim') {
        if (!e.denied) {
          this.denied++;
          this.warnOnce(`anim:${e.id}`, `creature textures: ${e.id} waits (static frame) — ${mb(this.bytes)} of ${mb(budget)} MiB held on screen`);
        }
        e.denied = true;
        return;
      }
      this.warnOnce(`static:${e.id}`, `creature textures over budget: ${e.id} binds anyway (${mb(this.bytes + e.bytes)} of ${mb(budget)} MiB, all on screen)`);
    }
    const set = e.kind === 'static' ? cat.atlas(e.id) : null;
    const anim = e.kind === 'anim' ? cat.animAtlas(e.id) : null;
    if (set === null && anim === null) return;
    if (e.denied) this.denied--;
    e.denied = false;
    e.bound = true;
    const gen = ++e.gen;
    this.bytes += e.bytes;
    this.binds++;
    const p = set !== null ? pool.bindAtlas(set) : pool.bindAnimAtlas(anim!);
    e.settled = p.then(
      () => undefined,
      (err: unknown) => {
        this.o.warn?.(`creature atlas bind failed ${e.id}: ${err instanceof Error ? err.message : String(err)}`);
        if (e.gen !== gen || !e.bound) return;
        // render dropped its entry on the failure: nothing to release, the bytes are not held
        e.bound = false;
        this.bytes -= e.bytes;
        if (e.refs === 0 && this.entries.get(e.id) === e) this.entries.delete(e.id);
      },
    );
  }

  /** Releases idle entries until `need` bytes are free: flipbooks first, then static atlases, least recently used first. */
  private makeRoom(need: number): void {
    let freed = 0;
    for (const e of this.idleOrder(null)) {
      if (freed >= need) break;
      freed += e.bytes;
      this.evict(e);
    }
  }

  /** Idle, releasable entries (no hold, no billboard sampling them): flipbooks first, then statics; LRU within a kind. */
  private idleOrder(kind: Kind | null): Entry[] {
    const out: Entry[] = [];
    for (const e of this.entries.values()) if (e.refs === 0 && e.bound && (kind === null || e.kind === kind) && this.users(e.id) === 0) out.push(e);
    out.sort((a, b) => (a.kind === b.kind ? a.lastUse - b.lastUse : a.kind === 'anim' ? -1 : 1));
    return out;
  }

  private trimIdle(kind: Kind): void {
    const cap = kind === 'anim' ? this.idleAnim : this.idleStatic;
    const idle = this.idleOrder(kind);
    for (let i = 0; i < idle.length - cap; i++) this.evict(idle[i]!);
  }

  private evict(e: Entry): void {
    if (!e.bound) return;
    e.bound = false;
    e.gen++;
    this.bytes -= e.bytes;
    this.releases++;
    this.o.pool()?.releaseAtlas(e.id);
    if (e.refs === 0) this.entries.delete(e.id);
  }

  /** Held flipbooks the guard refused bind once room frees up (most recently shown first). */
  private retryDenied(): void {
    if (this.disposed || this.denied === 0) return;
    const want = [...this.entries.values()].filter((e) => e.denied && e.refs > 0 && !e.bound).sort((a, b) => b.lastUse - a.lastUse);
    for (const e of want) this.bind(e);
  }

  private schedule(): void {
    if (this.disposed) return;
    let at = Number.POSITIVE_INFINITY;
    for (const e of this.entries.values()) if (e.refs === 0 && e.bound) at = Math.min(at, e.idleSince + this.graceMs);
    if (at === this.timerAt) return;
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null;
    this.timerAt = at;
    if (at === Number.POSITIVE_INFINITY) return;
    this.timer = this.setTimer(() => {
      this.timer = null;
      this.timerAt = Number.POSITIVE_INFINITY;
      this.sweep();
    }, Math.max(0, at - this.now()));
  }

  private warnOnce(key: string, msg: string): void {
    if (this.warned.has(key)) return;
    this.warned.add(key);
    this.o.warn?.(msg);
  }
}

function mb(b: number): string {
  return (b / 2 ** 20).toFixed(0);
}

/**
 * The battle stage's holds: both teams' static atlases for the battle's life (a switch-in never waits for its atlas),
 * and per stage slot the ONE side that slot shows (`stageSide`: the near side's back, the far side's front) with its
 * flipbook. `set` follows `BattleView.setBattler`; `end` (the battle view's exit) releases everything.
 */
export class BattleSprites {
  private team: AtlasHold | null = null;
  private readonly slots = new Map<string, { readonly species: string; readonly side: CreatureSide; readonly lease: SpriteLease }>();

  constructor(private readonly textures: () => CreatureTextures | null) {}

  /** battleStart / battleResync: every battler's static atlases (replaces the previous battle's hold). */
  begin(species: Iterable<string>): void {
    const tex = this.textures();
    if (tex === null) return;
    this.team = tex.hold(tex.staticAtlasesOf(species), undefined, this.team);
  }

  /** The battler on stage slot `ref` (null = empty): leases the side it shows, then releases what the slot showed. */
  set(ref: { readonly side: 0 | 1; readonly slot: number }, speciesId: string | null): void {
    const key = `${ref.side}:${ref.slot}`;
    const have = this.slots.get(key);
    const side = stageSide(ref.side);
    if (have !== undefined && speciesId !== null && have.species === speciesId && have.side === side) return;
    const tex = this.textures();
    if (speciesId !== null && tex !== null) this.slots.set(key, { species: speciesId, side, lease: tex.show(speciesId, side) });
    else this.slots.delete(key);
    have?.lease.release();
  }

  /** The battle left the stage: every slot and the teams' hold go (idle, released after the grace period). */
  end(): void {
    for (const s of this.slots.values()) s.lease.release();
    this.slots.clear();
    this.team?.release();
    this.team = null;
  }

  /** Slots holding a lease (tests / debug). */
  get size(): number {
    return this.slots.size;
  }
}
