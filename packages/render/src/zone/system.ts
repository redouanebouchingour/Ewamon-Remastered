/**
 * The zone subsystem plugged into the renderer host (part-1 note M16: `RendererSubsystems.zones` + a frame hook).
 * `load` builds through `loadZone` with the host's library, light rig and scene, then applies the zone palette to
 * the lighting (sky / bounce / fog) and the post grade; the hook re-picks chunk tiers and building LODs against
 * the main camera once per frame (zero allocation).
 */
import type { Object3D } from 'three/webgpu';
import type { ZoneSpec } from '../contracts.js';
import type { HarvestLevel, LightSource } from '../descriptors.js';
import type { PunctualHandle } from '../lighting/rig.js';
import type { SurfaceId } from '../materials/surfaces.js';
import type { FrameHook, HostContext } from '../renderer.js';
import { loadZone, zoneSurfaces, type ZoneHandleImpl } from './builder.js';
import { gradeOf, lightingPaletteOf } from './palettes.js';

export class ZoneSystem implements FrameHook {
  private current: ZoneHandleImpl | null = null;
  private culled = 0;
  private pendingKeep: readonly SurfaceId[] = [];
  /** Handover (b): the surfaces of a zone prepared off-scene; every dispose keeps them resident until it is adopted or dropped. */
  private preparedKeep: readonly SurfaceId[] = [];
  private loads = 0;

  constructor(private readonly ctx: HostContext, private readonly clock: (() => number) | null = null) {}

  async load(spec: ZoneSpec, opts: { readonly heroGate?: Promise<void> } = {}): Promise<ZoneHandleImpl> {
    this.loads++;
    // a load that starts while the previous zone is still up is a handover pre-load: keep its sets on dispose
    if (this.current !== null && !this.current.disposed) this.pendingKeep = zoneSurfaces(spec);
    try {
      const ctx = this.ctx;
      const handle = await loadZone(spec, {
        materials: ctx.materials,
        lighting: ctx.lighting,
        scene: ctx.scene,
        stats: () => ctx.statsRecord,
        nextKeep: () => this.keep(),
        releaseGpu: (root) => releaseZoneAttributes(ctx, root),
        ...(opts.heroGate ? { heroGate: opts.heroGate } : {}),
      }, this.clock ?? undefined);
      ctx.setLightingPalette(lightingPaletteOf(handle.palette));
      ctx.setGrade(gradeOf(handle.palette));
      this.current = handle;
      return handle;
    } finally {
      this.loads--;
      if (this.loads === 0) this.pendingKeep = [];
    }
  }

  /**
   * Phase E3: the client is about to dispose the current zone and load `next` (a handover). The dispose's eviction then
   * keeps `next`'s texture sets resident — shared surfaces (most of a biome's set) are not fetched and transcoded
   * again. Cleared when the next load finishes.
   */
  prepareHandover(next: ZoneSpec): void {
    this.pendingKeep = zoneSurfaces(next);
  }

  private keep(): readonly SurfaceId[] {
    if (this.preparedKeep.length === 0) return this.pendingKeep;
    if (this.pendingKeep.length === 0) return this.preparedKeep;
    return [...new Set([...this.pendingKeep, ...this.preparedKeep])];
  }

  /**
   * Handover (b): builds `spec` OFF the scene while the current zone stays up — its root is not added, its lights are not
   * created (a light of the next zone would light this one: every zone is laid out around the origin), its hero tier
   * waits. `adopt` makes it the current zone; `drop` disposes it. Its surfaces stay resident through the current zone's
   * dispose. The renderer compiles it meanwhile (`Renderer.prepareZone`).
   */
  async prepare(spec: ZoneSpec): Promise<PreparedZone> {
    const ctx = this.ctx;
    const lights = deferredLights(ctx.lighting);
    let openHero!: () => void;
    const heroGate = new Promise<void>((res) => { openHero = res; });
    this.preparedKeep = zoneSurfaces(spec);
    const handle = await loadZone(spec, {
      materials: ctx.materials,
      lighting: lights.deps,
      scene: null,
      stats: () => ctx.statsRecord,
      // dropped unadopted, it must not evict the CURRENT zone's sets (adopted, it is the current zone: disposed first)
      nextKeep: () => { const cur = this.zone(); return cur !== null && cur !== handle ? [...new Set([...this.keep(), ...cur.surfaces])] : this.keep(); },
      releaseGpu: (root) => releaseZoneAttributes(ctx, root),
      heroGate,
    }, this.clock ?? undefined);
    let state: 'prepared' | 'adopted' | 'dropped' = 'prepared';
    return {
      spec,
      handle,
      adopt: (): ZoneHandleImpl => {
        if (state !== 'prepared') throw new Error(`@ewa/render: prepared zone '${spec.id}' is ${state}`);
        state = 'adopted';
        this.preparedKeep = [];
        this.pendingKeep = [];   // `prepareHandover`'s keep was for this zone: it is loaded now
        ctx.scene.add(handle.group);
        lights.activate();
        ctx.setLightingPalette(lightingPaletteOf(handle.palette));
        ctx.setGrade(gradeOf(handle.palette));
        this.current = handle;
        return handle;
      },
      openHero: () => openHero(),
      drop: (): void => {
        if (state !== 'prepared') return;
        state = 'dropped';
        this.preparedKeep = [];
        handle.dispose();
      },
    };
  }

  /** The loaded zone (null when none / disposed). */
  zone(): ZoneHandleImpl | null { return this.current !== null && !this.current.disposed ? this.current : null; }

  /** Scatter / static chunks at the impostor tier in the last frame (ZoneDump.culledChunks). */
  culledChunks(): number { return this.culled; }

  update(): void {
    const z = this.current;
    if (z === null || z.disposed) return;
    const cam = this.ctx.camera3;
    this.culled = z.updateLod(cam.position, cam);
  }

  setHarvestLevel(_l: HarvestLevel): void { /* the harvested look is the library uniform (§10.2.6) */ }

  dispose(): void {
    if (this.current !== null) this.current.dispose();
    this.current = null;
  }
}

/** Handover (b): a zone built off the scene (`ZoneSystem.prepare`). */
export interface PreparedZone {
  readonly spec: ZoneSpec;
  readonly handle: ZoneHandleImpl;
  /** Adds the root to the scene, creates its lights, applies its palette; it is the current zone from now on. */
  adopt(): ZoneHandleImpl;
  /** Lets its hero texture tier stream (after the adopting load's phase 1). */
  openHero(): void;
  /** Disposes it unless adopted (idempotent). */
  drop(): void;
}

/**
 * The builder's light dependency for a prepared zone: `createPunctuals` only records the request and returns the array
 * the builder keeps (and releases on dispose); `activate` fills it with the real lights once the zone is adopted.
 */
function deferredLights(rig: HostContext['lighting']): { deps: { createPunctuals(s: readonly LightSource[], parent: Object3D): PunctualHandle[]; releasePunctuals(h: readonly PunctualHandle[]): void }; activate(): void } {
  let pending: { sources: readonly LightSource[]; parent: Object3D; out: PunctualHandle[] } | null = null;
  return {
    deps: {
      createPunctuals: (sources, parent) => { const out: PunctualHandle[] = []; pending = { sources, parent, out }; return out; },
      releasePunctuals: (h) => rig.releasePunctuals(h),
    },
    activate: () => {
      if (pending === null) return;
      const p = pending;
      pending = null;
      p.out.push(...rig.createPunctuals(p.sources, p.parent));
    },
  };
}

interface RenderObjectLike { readonly object: Object3D; getAttributes(): readonly object[] }
interface RendererInternals { readonly _objects?: { readonly _renderObjects?: Set<RenderObjectLike> }; readonly _attributes?: { delete(a: object): unknown } }

/**
 * C26 (IMPLEMENTATION-NOTES Part 2): three frees a geometry's node attributes (instance matrices, the velocity
 * pass's previous-matrix buffers, wrapped instance colours) only through the FIRST render object that initialised
 * the geometry, so attributes first bound by a later pass stay alive (measured: +141 attributes / 9.8 MB per
 * Mirevale reload). Before the zone is disposed its render objects' attribute lists are collected; after its
 * geometries and meshes are disposed each is deleted from the renderer's attribute map (a no-op when three already
 * released it). Reads three internals (`_objects`, `_attributes`); absent → nothing happens.
 */
function releaseZoneAttributes(ctx: HostContext, root: Object3D): () => void {
  const gpu = ctx.gpu as unknown as RendererInternals;
  const set = gpu._objects?._renderObjects;
  const attrs = gpu._attributes;
  if (!set || !attrs) return () => {};
  const inZone = new Set<Object3D>();
  root.traverse((o) => { inZone.add(o); });
  const collected = new Set<object>();
  for (const ro of set) if (inZone.has(ro.object)) for (const a of ro.getAttributes()) collected.add(a);
  return () => { for (const a of collected) attrs.delete(a); };
}

const SYSTEMS = new WeakMap<object, ZoneSystem>();

/** One zone system per host (the loader and the frame hook are the same object). */
export function zoneSystemFor(ctx: HostContext, clock: (() => number) | null = null): ZoneSystem {
  let s = SYSTEMS.get(ctx);
  if (s === undefined) { s = new ZoneSystem(ctx, clock); SYSTEMS.set(ctx, s); }
  return s;
}
