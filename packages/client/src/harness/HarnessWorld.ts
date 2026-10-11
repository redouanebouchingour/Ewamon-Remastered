/**
 * The offline harness world (SPEC §50.2.3 `/harness/budget`, §50.6.1 shots): the real renderer, SceneDirector,
 * LocalPlayerController, RemoteInterpolator, InteractionTargets, HudWriter, SpawnViews and BattleController, wired the
 * way World3D wires them — but with no WorldSession: the zone comes from content, the player is placed by the harness,
 * the wild creature is a local `SpawnLike`, and a battle is scripted with `@ewa/core` (`battleScript.ts`) and fed to
 * the controller as `battleStart` / `battleEvents` messages. Frames are driven by the harness with a fixed 16.667 ms
 * dt (deterministic animation), never by requestAnimationFrame.
 *
 * `tick()` is World3D.tick's order: sample → fixed step (prediction, remotes, targeting, timeline, audio) → actor
 * transforms → nameplates → HUD flush → one `renderer.frame`. The fixed-step portion is the §50.2.1 `sim` row and is
 * pushed to the probe (`setSimMs`).
 *
 * Creature textures go through World3D's `CreatureTextures` (zone hold, per-view side leases, battle holds, grace /
 * LRU, budget guard — client IMPLEMENTATION-NOTES "Creature textures"). `residency: 'legacy'` (`?residency=legacy`)
 * replays the binding before it — every atlas of a species (static + both flipbooks) bound on first sight, never
 * released — so the before / after texture-memory runs drive the same page.
 */
import { ACESFilmicToneMapping, Group, LinearSRGBColorSpace, NoToneMapping, SRGBColorSpace, Vector3 } from 'three/webgpu';
import type { Node } from 'three/webgpu';
import { float, renderOutput, texture, vec3, vec4 } from 'three/tsl';
import { BODIES, harvestStateFor, staticsFor, zone as zoneDef } from '@ewa/content';
import type { HarvestState, ZoneDef, ZoneId } from '@ewa/content';
import type { CreatureInstance } from '@ewa/core';
import { ALL_EFFECTS, applyReducedEffects, createBudgetProbe, createRenderer, edgePoint, part3Of, rendererInternals, zoneSurfaces } from '@ewa/render';
import type { BudgetCounts, EffectsFlags, Renderer, RendererProbe, TypeName, VfxId, WeatherKind, ZoneSpec } from '@ewa/render';
import { createAudioDirector } from '../audio/AudioDirector';
import type { AudioDirector } from '../audio/AudioDirector';
import { createBattleController } from '../battle/BattleController';
import type { BattleController, BattleView } from '../battle/BattleController';
import { setBattleActions } from '../battle/controllerRef';
import { STEP_MS } from '../battle/constants';
import { content, maxHpOf, species as speciesDef } from '../data/content';
import { createStepCollider } from '../scene/collider';
import { EvolutionDirector } from '../scene/EvolutionDirector';
import { npcVisible } from '../scene/dialogue';
import { HudWriter, partyStrip } from '../scene/HudWriter';
import type { HudNameplates } from '../scene/HudWriter';
import { InteractionTargets } from '../scene/interaction';
import { LegendaryViews, STATIC_FLIPBOOK_NEAR_M, visibleStatics } from '../scene/LegendaryViews';
import { BattleSprites, CreatureTextures, NO_LEASE, creatureBudget } from '../scene/creatureTextures';
import type { AtlasHold, CreatureSide, CreatureTextureStats, SpritePart, SpriteLease } from '../scene/creatureTextures';
import { LocalPlayerController } from '../scene/LocalPlayerController';
import { RemoteInterpolator } from '../scene/RemoteInterpolator';
import { createSceneDirector, terrainFor, trainerPose } from '../scene/SceneDirector';
import type { TrainerPose } from '../scene/SceneDirector';
import type { SceneDirector } from '../scene/SceneDirector';
import { SpawnViews } from '../scene/SpawnViews';
import type { SpawnLike } from '../scene/SpawnViews';
import { bindCatalogAtlas, createSpriteCatalog, loadCreatureManifest, speciesAtlases } from '../scene/spriteCatalog';
import type { SpriteCatalog } from '../scene/spriteCatalog';
import { withNeighbours, zoneSpecFor } from '../scene/zoneSpecFor';
import { useUiStore } from '../state/ui';
import { FONT, TYPE_COLORS } from '../ui/tokens';
import { makeCreature, scriptWildBattle } from './battleScript';
import type { ScriptedBattle } from './battleScript';

export const SELF_ID = 'harness-player';
export const SELF_BODY = 'ranger_m';
/** The player's lead (Mirevale's grass starter line) and its level. */
export const LEAD = { speciesId: 'bramblecub', level: 5 } as const;
export const WILD_ID = 'harness-wild';
const NAMEPLATE_MS = 500;
const NAMEPLATE_RANGE = 18;

export type HarnessLog = (line: string) => void;

/** `managed`: World3D's `CreatureTextures`; `legacy`: the pre-residency binding (everything, forever) for before / after runs. */
export type HarnessResidency = 'managed' | 'legacy';

/** E3: one measured zone crossing (`handover-hitch.spec.ts`, SPEC §20.10.3 / §50.4.7). */
export interface HandoverResult {
  readonly from: string;
  readonly to: string;
  readonly preloaded: boolean;
  /** ms from the crossing (`handoverAck`: the director starts the next zone's load) to the first frame of the new zone */
  readonly firstFrameMs: number | null;
  /** `director.loadZone` wall ms (renderer phase 1 + build + texture preload) */
  readonly loadMs: number;
  /** frames rendered by the rAF loop from the crossing until `frames` frames after the first destination frame */
  readonly frames: number;
  readonly maxFrameMs: number;
  readonly p95FrameMs: number;
  /** frame gaps over 33 ms (§20.10.3: none allowed during the crossing) */
  readonly framesOver33: number;
  /** the harness has no world-boot overlay: a crossing here never fades the screen (World3D shows "Travelling to …") */
  readonly fade: false;
  readonly zone: string | null;
  readonly programs: number;
  /** programs with the source zone loaded, right before the crossing (fixed light layout: the destination adds few) */
  readonly programsBefore: number;
  /** programs once the destination's background compile ended (`compileIdle()`) */
  readonly programsSettled: number;
  /** preloaded: the off-scene prepare of the destination (`prepareZone`) before the crossing, with its frame gaps */
  readonly prepare: {
    readonly ms: number; readonly frames: number; readonly maxFrameMs: number; readonly framesOver33: number; readonly framesOver100: number;
    /** render Handover II: the prepare's sliced build (slices, work ms, the longest slice and step) */
    readonly build: { readonly slices: number; readonly workMs: number; readonly maxSliceMs: number; readonly maxStepMs: number; readonly maxStepLabel: string } | null;
  } | null;
  readonly backgroundCompile: boolean;
}

const gpuQueue = (r: Renderer): { onSubmittedWorkDone(): Promise<void> } | null =>
  (r.renderer.backend as unknown as { device?: { queue: { onSubmittedWorkDone(): Promise<void> } } }).device?.queue ?? null;

export interface TickTiming { readonly simMs: number; readonly frameMs: number }

export class HarnessWorld {
  renderer!: Renderer;
  probe!: RendererProbe;
  director!: SceneDirector;
  private readonly trainerAt: TrainerPose = { x: 0, z: 0, angle: 0 };
  readonly hud = new HudWriter(null);
  /** §20.5.6 the evolution sequence, as World3D builds it (the harness's `evolve()` plays through `app/evolution.ts`) */
  evolution: EvolutionDirector | null = null;
  readonly targets: InteractionTargets;
  readonly input: LocalPlayerController;
  readonly remotes: RemoteInterpolator;
  readonly battle: BattleController;
  readonly audio: AudioDirector;
  catalog: SpriteCatalog | null = null;
  spawns: SpawnViews | null = null;
  zone!: ZoneDef;
  spec!: ZoneSpec;
  harvest: HarvestState = 'intact';
  /** the story flags the zone reads (harvest state, legendary statics' gates); the texture runs set them */
  readonly flags = new Set<string>();
  /** Phase B1 legendary statics, synced by the director like World3D's */
  legendaries: LegendaryViews | null = null;
  /** the party's species: their static atlases are held with the zone (World3D's zone hold) */
  party: string[] = [LEAD.speciesId];
  /** creature atlas residency (`managed` only) */
  textures: CreatureTextures | null = null;
  readonly lead: CreatureInstance;
  reduced = false;
  frames = 0;
  /**
   * Counts of the last frame, read right after `renderer.frame` returns: three's own rAF loop resets
   * `renderer.info` once per display frame, so a read after any await would see an empty frame.
   */
  lastCounts: BudgetCounts | null = null;
  private readonly held = new Uint8Array(16);
  private nameplateLeft = 0;
  /** `legacy` residency: every atlas ever bound */
  private readonly legacyBound = new Set<string>();
  private zoneHold: AtlasHold | null = null;
  /** E3 sprite-edge scan: the inspected species' front side, held until the next `prepareSpecies` */
  private preparedHold: AtlasHold | null = null;
  private readonly battleSprites = new BattleSprites(() => this.textures);
  private battleScript: ScriptedBattle | null = null;
  private maskSaved: Node | null = null;
  private maskNode: Node | null = null;
  private outputNode: Node | null = null;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly log: HarnessLog, readonly residency: HarnessResidency = 'managed') {
    this.lead = makeCreature(content(), LEAD.speciesId, LEAD.level, 'harness-lead', SELF_ID);
    this.audio = createAudioDirector({ createContext: () => null });
    this.targets = new InteractionTargets((p) => this.hud.setPrompt(p));
    this.input = new LocalPlayerController({
      held: this.held,
      cameraYaw: () => (this.renderer?.camera as unknown as { dioramaYaw?: number } | undefined)?.dioramaYaw ?? 0,
      blocked: () => useUiStore.getState().battle !== null,
      send: () => undefined,
      onSnap: () => this.renderer?.camera.follow(SELF_ID),
    });
    this.remotes = new RemoteInterpolator(
      { spawn: () => undefined, setTransform: () => undefined, despawn: () => undefined },
      () => performance.now(),
      8,
    );
    this.battle = createBattleController({
      content: content(),
      send: (type, payload) => this.onClientMessage(type, payload),
      reduced: () => this.reduced,
      instantText: () => false,
      selfPosition: () => ({ x: this.input.pose.x, z: this.input.pose.z }),
      summaryAt: () => null,
      selfId: () => SELF_ID,
      raidId: () => null,
      view: null,
    });
    setBattleActions({
      submit: (a) => this.battle.submit(a),
      check: (a) => this.battle.check(a),
      dismissResult: () => this.battle.dismissResult(),
      undoPick: () => this.battle.undoPick(),
    });
  }

  // ---- boot ------------------------------------------------------------------------------------------------------

  /** E3: `?bg=1` — the zone's background compile on (the client's default; the shot / budget harness measures fully compiled zones). */
  backgroundCompile = false;

  async boot(zoneId: ZoneId, extraSpecies: readonly string[]): Promise<void> {
    const t0 = performance.now();
    const r = await createRenderer({
      canvas: this.canvas,
      pixelRatio: typeof devicePixelRatio === 'number' ? devicePixelRatio : 1,
      effects: ALL_EFFECTS,
      trackTimestamp: true,
      backgroundCompile: this.backgroundCompile,
      transcoderPath: '/basis/',
      clock: () => performance.now(),
      onCompileProgress: (p) => {
        if (p.done) this.log(`compile ${p.phase}${p.zone ? ` ${p.zone}` : ''}: ${p.total} objects in ${p.ms === null ? '?' : Math.round(p.ms)} ms`);
      },
    });
    this.renderer = r;
    this.log(`renderer ready in ${Math.round(performance.now() - t0)} ms (backend ${r.backend}, adapter ${r.caps.adapter ?? '?'}, timestamp-query ${r.caps.timestampQuery})`);
    this.director = createSceneDirector({
      renderer: r,
      hud: this.hud,
      audio: this.audio,
      targets: this.targets,
      selfId: () => SELF_ID,
      flags: () => this.flags,
      interactKey: () => 'E',
      onZone: (h) => {
        this.input.setCollider(h === null ? null : createStepCollider(h.collider));
        this.spawns?.reground();
      },
      setInputEnabled: (on) => this.input.setEnabled(on),
      setAccentType: (t) => part3Of(r)?.stage.setAccentType(t),
      reducedMotion: () => this.reduced,
      legendaries: () => this.legendaries,
    });
    this.hud.bind(r.hud);
    this.hud.setConnection('connected');
    this.hud.setParty(partyStrip([this.lead], () => maxHpOf(this.lead)));
    r.stage.setTypeColors(TYPE_COLORS.default);
    await this.loadFonts();
    this.resize();

    const manifest = await loadCreatureManifest();
    if (manifest !== null) this.catalog = createSpriteCatalog(manifest, speciesDef);
    else this.log('creature manifest missing: no creature sprites');
    const p3 = part3Of(r);
    const group = new Group();
    group.name = 'ewa:client-creatures';
    r.scene.add(group);
    if (p3 !== undefined) {
      if (this.residency === 'managed') {
        this.textures = new CreatureTextures({
          catalog: () => this.catalog, pool: () => p3.sprites, warn: (m) => this.log(m),
          budgetBytes: () => creatureBudget(r.stats().textureBytes, p3.sprites.stats().bytes),
        });
      }
      this.evolution = new EvolutionDirector({
        stage: p3.stage,
        descriptor: (sp, key, v, a) => this.catalog?.descriptor(sp, key, v, a) ?? null,
        leaseSprites: (sp, side, part) => this.leaseSprites(sp, side, part),
        canPlay: () => useUiStore.getState().battle === null && !this.director.inBattle,
        position: () => ({ x: this.input.renderX, z: this.input.renderZ }),
        selfId: () => SELF_ID,
        reduced: () => this.reduced,
        setInputEnabled: (on) => this.input.setEnabled(on),
        inputAfter: () => useUiStore.getState().battle === null,
        setHudVisible: (on) => this.hud.setVisible(on),
        hudVisible: () => true,
        target: window,
      });
      this.spawns = new SpawnViews({
        parent: group,
        acquire: (d) => p3.sprites.acquire(d),
        descriptor: (sp, key, v, a) => this.catalog?.descriptor(sp, key, v, a) ?? null,
        leaseSprites: (sp, side, part) => this.leaseSprites(sp, side, part),
        height: (x, z) => this.director.handle?.collider.sample(x, z) ?? 0,
        targets: this.targets,
        interactKey: () => 'E',
      });
      this.legendaries = new LegendaryViews({
        parent: group,
        acquire: (d) => p3.sprites.acquire(d),
        descriptor: (sp, key) => this.catalog?.descriptor(sp, key) ?? null,
        leaseSprites: (sp, side, part) => this.leaseSprites(sp, side, part),
        height: (x, z) => this.director.handle?.collider.sample(x, z) ?? 0,
        targets: this.targets,
        interactKey: () => 'E',
      });
    }
    this.zone = zoneDef(zoneId);
    this.harvest = harvestStateFor(zoneId, this.flags);
    this.spec = zoneSpecFor(this.zone, this.harvest);
    const preload = await this.bindZone(zoneId, extraSpecies);
    this.legendaries?.setViewer(this.zone.spawn.x, this.zone.spawn.z);
    const tz = performance.now();
    try {
      await this.director.loadZone(zoneId, this.harvest);
    } finally {
      preload.release();
    }
    this.log(`zone ${zoneId} loaded in ${Math.round(performance.now() - tz)} ms (layoutSeed ${this.zone.layoutSeed >>> 0}, harvest ${this.harvest})`);
    const body = BODIES.find((b) => b.id === SELF_BODY);
    // the same `look:palette` id World3D's lookOf gives the local player
    const look = body === undefined ? 'casual_male' : body.palette ? `${body.look}:${body.palette}` : body.look;
    this.selfLook = look;
    r.actors.spawn(SELF_ID, { look, name: 'Harness', guildTag: '', isLocal: true });
    this.battle.attach(this.battleView());
    this.probe = createBudgetProbe(r, zoneId);
    this.director.setWeather('none');
    this.place(this.zone.spawn.x, this.zone.spawn.z, 0);
  }

  private async loadFonts(): Promise<void> {
    try {
      await Promise.race([
        Promise.all([document.fonts.load(`14px ${FONT.text}`), document.fonts.load(`24px ${FONT.display}`)]),
        new Promise((res) => setTimeout(res, 1000)),
      ]);
    } catch (_e) {
      // fallbacks
    }
    this.renderer.hud.setFonts(FONT.text, FONT.display);
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.renderer.resize(rect.width, rect.height);
  }

  /**
   * World3D's zone binds: the zone's static set + the party's (and `extraSpecies'`, the shots' wild species) static
   * atlases held for the zone's life (the previous zone's hold idles as this one is taken), and the front flipbooks of
   * the legendary statics standing for the flags, returned as a short hold the caller drops after the zone's load.
   */
  private async bindZone(zoneId: ZoneId, extraSpecies: readonly string[]): Promise<SpriteLease> {
    const cat = this.catalog;
    const tex = this.textures;
    if (cat === null) return NO_LEASE;
    if (tex === null) {
      // legacy: the zone set + every static's flipbooks + every atlas of the party's and the extra species
      const ids = [...cat.zoneAtlases(zoneId)];
      for (const st of staticsFor(zoneId)) for (const a of cat.animAtlasesOf(st.species)) if (!ids.includes(a)) ids.push(a);
      for (const sp of [...this.party, ...extraSpecies]) for (const a of speciesAtlases(cat, sp)) if (!ids.includes(a)) ids.push(a);
      await this.bindLegacy(ids);
      return NO_LEASE;
    }
    const statics = [...cat.zoneAtlases(zoneId), ...tex.staticAtlasesOf([...this.party, ...extraSpecies])];
    const zone = tex.hold(statics, undefined, this.zoneHold);
    this.zoneHold = zone;
    const at = zoneDef(zoneId).spawn;                          // boot and loadZone place the player there
    const near = visibleStatics(zoneId, this.flags).filter((st) => Math.hypot(st.x - at.x, st.z - at.z) <= STATIC_FLIPBOOK_NEAR_M);
    const preload = tex.hold(near.flatMap((st) => tex.sideAtlases(st.species, 'front')));
    await Promise.all([zone.ready, preload.ready]);
    return preload;
  }

  /**
   * E3 sprite-edge scan: binds the front side (the inspector shows the front) of each species before its billboard is
   * shown, held until the next call (resolves when bound); `legacy` binds every atlas of the species.
   */
  async prepareSpecies(species: readonly string[]): Promise<void> {
    const cat = this.catalog;
    if (cat === null) return;
    const tex = this.textures;
    if (tex === null) {
      await this.bindLegacy(species.flatMap((sp) => [...speciesAtlases(cat, sp)]));
      return;
    }
    const hold = tex.hold(species.flatMap((sp) => tex.sideAtlases(sp, 'front')), undefined, this.preparedHold);
    this.preparedHold = hold;
    await hold.ready;
  }

  /** A view's lease on the side it shows; `legacy` binds every atlas of the species and never releases. */
  private leaseSprites(speciesId: string, side: CreatureSide, part?: SpritePart): SpriteLease {
    if (this.textures !== null) return this.textures.show(speciesId, side, part);
    const cat = this.catalog;
    if (cat !== null) void this.bindLegacy(speciesAtlases(cat, speciesId));
    return NO_LEASE;
  }

  private async bindLegacy(ids: readonly string[]): Promise<void> {
    const cat = this.catalog;
    const p3 = part3Of(this.renderer);
    if (cat === null || p3 === undefined) return;
    await Promise.all(
      ids.filter((id) => !this.legacyBound.has(id)).map(async (id) => {
        const bind = bindCatalogAtlas(p3.sprites, cat, id);
        if (bind === null) return;
        this.legacyBound.add(id);
        try {
          await bind;
        } catch (e) {
          this.log(`atlas bind failed ${id}: ${String(e)}`);
        }
      }),
    );
  }

  /**
   * Switches zones the way World3D.enterZone does: the zone's binds (`bindZone`), then the director's load (the old
   * zone, its statics and the wild spawn go), the player at the zone's spawn. Dev hook for the texture-memory runs (CDP).
   */
  async loadZone(zoneId: ZoneId): Promise<void> {
    this.spawns?.clear();
    const preload = await this.bindZone(zoneId, []);
    this.legendaries?.setViewer(zoneDef(zoneId).spawn.x, zoneDef(zoneId).spawn.z);   // the arrival point, as World3D
    this.zone = zoneDef(zoneId);
    this.harvest = harvestStateFor(zoneId, this.flags);
    this.spec = zoneSpecFor(this.zone, this.harvest);
    try {
      await this.director.loadZone(zoneId, this.harvest);
    } finally {
      preload.release();
    }
    this.probe = createBudgetProbe(this.renderer, zoneId);
    this.place(this.zone.spawn.x, this.zone.spawn.z, 0);
  }

  /**
   * Texture memory now: render's corrected `texturesSize` (§50.2.2) and the same before the sprite level-0 correction
   * (`rawTexturesSize`, render IMPLEMENTATION-NOTES Part 9), the sprite pool's GPU estimate and its atlases, and
   * (managed) the residency's bound bytes / idle / refused entries.
   */
  textureReadout(): {
    readonly texturesSize: number; readonly rawTexturesSize: number; readonly textures: number; readonly spriteBytes: number; readonly spriteAtlases: number; readonly liveBillboards: number;
    readonly residency: HarnessResidency; readonly managed: Omit<CreatureTextureStats, 'entries'> & { readonly held: readonly string[]; readonly idleIds: readonly string[] } | null;
  } {
    const c = this.probe.counts();
    const st = part3Of(this.renderer)?.sprites.stats();
    const m = this.textures?.stats() ?? null;
    return {
      texturesSize: c.texturesSize, rawTexturesSize: c.texturesSize + (part3Of(this.renderer)?.sprites.infoOvercountBytes() ?? 0), textures: c.textures,
      spriteBytes: st?.bytes ?? 0, spriteAtlases: st?.atlases ?? 0, liveBillboards: st?.live ?? 0, residency: this.residency,
      managed: m === null ? null : {
        boundBytes: m.boundBytes, budgetBytes: m.budgetBytes, bound: m.bound, idle: m.idle, denied: m.denied, binds: m.binds, releases: m.releases,
        held: m.entries.filter((e) => e.refs > 0).map((e) => `${e.id}x${e.refs}${e.denied ? ' (waits)' : ''}`),
        idleIds: m.entries.filter((e) => e.idle).map((e) => e.id),
      },
    };
  }

  // ---- placement / shot state -----------------------------------------------------------------------------------

  /** Places the local player (a fresh placement, as a join does) and snaps the camera onto it. */
  place(x: number, z: number, angle: number): void {
    this.legendaries?.setViewer(x, z);
    this.input.clear();
    this.input.reconcile(x, z, angle, 0);
    this.renderer.actors.setTransform(SELF_ID, this.input.renderX, this.input.renderZ, this.input.pose.angle, false, false);
    this.renderer.camera.follow(SELF_ID);
  }

  setView(rigHeading: 0 | 1 | 2 | 3, zoomStop: 0 | 1 | 2): void {
    this.renderer.camera.setHeading(rigHeading);
    this.renderer.camera.setZoomStop(zoomStop);
  }

  setTimeOfDay(t: number): void {
    this.director.setTimeOfDay(t);
    this.hud.setTimeOfDay(t);
  }

  setEffects(reduced: boolean): EffectsFlags {
    this.reduced = reduced;
    const f = reduced ? applyReducedEffects(ALL_EFFECTS) : ALL_EFFECTS;
    this.renderer.setEffects(f);
    document.documentElement.dataset['reduced'] = reduced ? '1' : '0';
    return f;
  }

  setWild(s: { readonly speciesId: string; readonly level: number; readonly x: number; readonly z: number } | null, engaged = false): void {
    if (s === null) {
      this.spawns?.remove(WILD_ID);
      return;
    }
    const like: SpawnLike = { id: WILD_ID, speciesId: s.speciesId, level: s.level, x: s.x, z: s.z, variantKey: 'normal', isAlpha: false, engagedBy: engaged ? SELF_ID : '' };
    this.spawns?.update(like);
  }

  // ---- the loop ---------------------------------------------------------------------------------------------------

  /** One World3D-order tick with a fixed dt. */
  tick(dtMs: number = STEP_MS): TickTiming {
    const t0 = performance.now();
    this.input.sample();
    this.input.step(dtMs);
    this.remotes.step(dtMs, this.input.pose.x, this.input.pose.z);
    this.targets.step(this.input.pose.x, this.input.pose.z, useUiStore.getState().battle !== null);
    this.battle.player.step(dtMs);
    this.audio.step();
    const t1 = performance.now();
    const bf = this.director.battleFrame;
    if (bf !== null) {
      const me = trainerPose(bf, 0, this.trainerAt);
      this.renderer.actors.setTransform(SELF_ID, me.x, me.z, me.angle, false, false);
    } else if (this.evolution?.active === true) {
      this.renderer.actors.setTransform(SELF_ID, this.input.renderX, this.input.renderZ, this.evolution.faceAngle(this.input.renderX, this.input.renderZ), false, false);
    } else {
      this.renderer.actors.setTransform(SELF_ID, this.input.renderX, this.input.renderZ, this.input.pose.angle, this.input.moving, this.input.running);
    }
    this.nameplateLeft -= dtMs;
    if (this.nameplateLeft <= 0) {
      this.nameplateLeft = NAMEPLATE_MS;
      this.updateNameplates();
      // World3D's 2 Hz cadence: near statics play their flipbooks; the residency retries what its budget refused
      this.legendaries?.setViewer(this.input.pose.x, this.input.pose.z);
      this.textures?.refresh();
    }
    this.hud.flush();
    const simMs = t1 - t0;
    this.probe.setSimMs(simMs);
    const t2 = performance.now();
    this.renderer.frame(dtMs);
    const frameMs = performance.now() - t2;
    this.lastCounts = this.probe.counts();
    this.frames++;
    return { simMs, frameMs };
  }

  async gpuIdle(): Promise<void> {
    const q = gpuQueue(this.renderer);
    if (q !== null) await q.onSubmittedWorkDone();
  }

  /**
   * Runs frames until at least `minFrames` ran AND the program count held still for `stableFrames` frames (the
   * shader compile finished), capped at `maxFrames`. Returns the frames run and whether it stabilised.
   */
  async settle(minFrames: number, stableFrames = 30, maxFrames = 1500): Promise<{ frames: number; stable: boolean; programs: number }> {
    let last = -1;
    let same = 0;
    let n = 0;
    while (n < maxFrames) {
      this.tick();
      await this.gpuIdle();
      await yieldTask();
      n++;
      const p = this.renderer.renderer.info.memory.programs;
      if (p === last) same++;
      else {
        same = 0;
        last = p;
      }
      if (n >= minFrames && same >= stableFrames) return { frames: n, stable: true, programs: p };
    }
    return { frames: n, stable: false, programs: last };
  }

  /** Runs frames while `cond` holds (or until `maxFrames`); returns the frames run. */
  async runWhile(cond: () => boolean, maxFrames: number): Promise<number> {
    let n = 0;
    while (n < maxFrames && cond()) {
      this.tick();
      await this.gpuIdle();
      await yieldTask();
      n++;
    }
    return n;
  }

  private updateNameplates(): void {
    const sx = this.input.pose.x;
    const sz = this.input.pose.z;
    const list: { id: string; name: string; d: number }[] = [];
    for (const n of this.zone?.npcs ?? []) {
      const d = Math.hypot(n.x - sx, n.z - sz);
      if (d > NAMEPLATE_RANGE || !npcVisible(n, this.flags)) continue;
      list.push({ id: n.id, name: n.name, d });
    }
    list.sort((a, b) => a.d - b.d);
    const next: HudNameplates = list.slice(0, 16).map(({ id, name }) => ({ id, name, guildTag: '', inBattle: false }));
    const cur = this.hud.current().nameplates;
    if (cur.length === next.length && cur.every((c, i) => c.id === next[i]!.id)) return;
    this.hud.setNameplates(next);
  }

  // ---- DOF mask visualisation -----------------------------------------------------------------------------------

  /**
   * Draws the scene pass's `mask.y` (DOF-sharp, §10.8.2) as greyscale straight to the canvas: one pipeline render
   * with the output node swapped (no HUD overlay, no tone mapping, no transfer function — grey = mask.y × 255).
   *
   * Phase E3: the swapped output samples the scene pass's MRT texture as a plain texture (`texture(pass.getTexture)`),
   * not through its pass texture node, so this render shows the last full frame's mask and does NOT re-render the
   * scene pass. Re-rendering it here ran the scene without TRAA (no velocity projection, H4 fact c) at another render
   * call depth, which built a second render object — and a second, TRAA-less program — for every visible material:
   * +31 programs kept for the rest of the session (the 139–144 of the shots runs after the first mask variant, render
   * Part 6 Open 1 / audit M2-gym-dusk-8).
   */
  async drawMask(): Promise<void> {
    const host = rendererInternals(this.renderer);
    if (host === undefined) throw new Error('no renderer internals');
    const pipe = host.post.pipeline;
    if (this.maskNode === null) {
      const m = texture(host.post.nodes.scenePass.getTexture('mask'));
      this.maskNode = renderOutput(vec4(vec3(m.y), float(1)), NoToneMapping, LinearSRGBColorSpace) as unknown as Node;
    }
    if (this.maskSaved === null) this.maskSaved = pipe.outputNode as unknown as Node;
    pipe.outputNode = this.maskNode as never;
    pipe.needsUpdate = true;
    host.post.render();
    await this.gpuIdle();
  }

  /**
   * E3 sprite-edge scan: draws the scene pass's `output` MRT (pre-TRAA, pre-DOF, pre-bloom) to the canvas, tone-mapped
   * and sRGB-encoded so it can be looked at — the image §10.4.3 defines the soft-pixel test on. Same swap as `drawMask`.
   */
  async drawOutput(): Promise<void> {
    const host = rendererInternals(this.renderer);
    if (host === undefined) throw new Error('no renderer internals');
    const pipe = host.post.pipeline;
    if (this.outputNode === null) this.outputNode = renderOutput(texture(host.post.nodes.scenePass.getTexture('output')), ACESFilmicToneMapping, SRGBColorSpace) as unknown as Node;
    if (this.maskSaved === null) this.maskSaved = pipe.outputNode as unknown as Node;
    pipe.outputNode = this.outputNode as never;
    pipe.needsUpdate = true;
    host.post.render();
    await this.gpuIdle();
  }

  restoreOutput(): void {
    const host = rendererInternals(this.renderer);
    if (host === undefined || this.maskSaved === null) return;
    host.post.pipeline.outputNode = this.maskSaved as never;
    host.post.pipeline.needsUpdate = true;
    this.maskSaved = null;
  }

  // ---- screen rects (for the sidecar and the mask readback) ------------------------------------------------------

  private project(p: Vector3): readonly [number, number] {
    const cam = this.renderer.camera.camera;
    const v = p.clone().project(cam);
    const rect = this.canvas.getBoundingClientRect();
    return [(v.x * 0.5 + 0.5) * rect.width, (-v.y * 0.5 + 0.5) * rect.height];
  }

  private selfLook = 'casual_male';

  /**
   * E3 sprite-edge scan: hides the zone root (the probe's `opaque` switch) and the player's figure, so the only
   * DOF-sharp pixels left in `mask.y` are the inspected billboard's and every sampled edge is its silhouette.
   */
  isolateInspector(on: boolean): void {
    this.probe.setPassEnabled('opaque', !on);
    if (on) this.renderer.actors.despawn(SELF_ID);
    else {
      this.renderer.actors.spawn(SELF_ID, { look: this.selfLook, name: 'Harness', guildTag: '', isLocal: true });
      this.renderer.actors.setTransform(SELF_ID, this.input.renderX, this.input.renderZ, this.input.pose.angle, false, false);
    }
  }

  /** E3 sprite-edge scan: the camera's vertical fov before the scan narrowed it (null = untouched). */
  edgeFov0: number | null = null;

  /** CSS-px rect of world points (the sprite-edge scan's billboard quad). */
  rectOfWorld(points: readonly Vector3[]): readonly [number, number, number, number] {
    return this.rectOf(points);
  }

  private rectOf(points: readonly Vector3[]): readonly [number, number, number, number] {
    let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
    for (const p of points) {
      const [x, y] = this.project(p);
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    return [Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1)];
  }

  /** CSS-px rect of the local player's figure (a 0.4 m × 1.6 m cylinder at its feet: the KayKit chibi stands 1.55 m with a wide head). */
  playerRect(): readonly [number, number, number, number] | null {
    const f = this.renderer.actors.feetOf(SELF_ID, new Vector3());
    if (f === null) return null;
    const pts: Vector3[] = [];
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      for (const y of [0, 1.6]) pts.push(new Vector3(f.x + Math.cos(a) * 0.4, f.y + y, f.z + Math.sin(a) * 0.4));
    }
    return this.rectOf(pts);
  }

  /** CSS-px rects of the two active battlers' billboards (feet → top, ± half width along the camera right). */
  battlerRects(): { readonly side: 0 | 1; readonly rect: readonly [number, number, number, number] }[] {
    const p3 = part3Of(this.renderer);
    if (p3 === undefined) return [];
    const cam = this.renderer.camera.camera;
    const right = new Vector3().setFromMatrixColumn(cam.matrixWorld, 0).setY(0).normalize();
    const out: { side: 0 | 1; rect: readonly [number, number, number, number] }[] = [];
    for (const side of [0, 1] as const) {
      const bb = p3.stage.battler({ side, slot: 0 });
      if (bb === null) continue;
      const feet = bb.feet(new Vector3());
      const top = bb.topWorld(new Vector3());
      const half = (bb.heightM * (bb.descriptor.front.aspect || 1)) / 2;
      out.push({ side, rect: this.rectOf([feet.clone().addScaledVector(right, -half), feet.clone().addScaledVector(right, half), top.clone().addScaledVector(right, -half), top.clone().addScaledVector(right, half)]) });
    }
    return out;
  }

  // ---- E3: a measured zone crossing ---------------------------------------------------------------------------------

  /**
   * Crosses from the loaded zone into its linked neighbour `to` the way World3D does on `handover`: the player stands
   * 6 m inside the link edge, then `director.loadZone(to, …, arrival)` (which keeps the shared texture sets through the
   * dispose, `renderer.prepareHandover`) and the player is placed at the arrival, 8 m inside the destination's edge.
   * A requestAnimationFrame loop ticks the world throughout and records every frame gap. `preload`: the destination's
   * field materials and creature atlases are made resident first (§20.10.3 phase 5 complete).
   */
  async handover(to: ZoneId, o: { readonly preload: boolean; readonly framesAfter?: number }): Promise<HandoverResult> {
    const from = this.zone;
    const dir = (['n', 'e', 's', 'w'] as const).find((d) => from.links[d] === to);
    if (dir === undefined) throw new Error(`${to} is not linked to ${from.id}`);
    const opp = ({ n: 's', s: 'n', e: 'w', w: 'e' } as const)[dir];
    const inward = (d: 'n' | 'e' | 's' | 'w', k: number): readonly [number, number] => (d === 'e' ? [-k, 0] : d === 'w' ? [k, 0] : d === 's' ? [0, -k] : [0, k]);
    const [ex, ez] = edgePoint(from.kind, dir);
    const [ix, iz] = inward(dir, 6);
    this.setWild(null);
    this.setTimeOfDay(0.5);
    this.place(ex + ix, ez + iz, 0);
    await this.settle(30, 10, 600);
    const next = zoneDef(to);
    const harvest = harvestStateFor(to, this.flags);
    let preloaded: SpriteLease = NO_LEASE;
    let prepare: HandoverResult['prepare'] = null;
    const [ax0, az0] = edgePoint(next.kind, opp);
    const [aix, aiz] = inward(opp, 8);
    const arrival = { x: ax0 + aix, z: az0 + aiz };
    if (o.preload) {
      await this.renderer.materials.preload(zoneSurfaces(withNeighbours(zoneSpecFor(next, harvest), next)));
      preloaded = await this.bindZone(to, []);
      // handover (b): the destination built and compiled off the scene while this zone is up (World3D does it near an
      // edge); the world keeps ticking meanwhile, and those frame gaps are recorded too
      const pg: number[] = [];
      let pl = performance.now();
      let ticking = true;
      const tickLoop = (now: number): void => { if (!ticking) return; pg.push(now - pl); pl = now; this.tick(); requestAnimationFrame(tickLoop); };
      requestAnimationFrame(tickLoop);
      const tp = performance.now();
      await this.director.prepareZone(to, harvest, arrival);
      const bs = (this.renderer as Renderer & { readonly prepareStats?: { slices: number; workMs: number; maxSliceMs: number; maxStepMs: number; maxStepLabel: string } | null }).prepareStats ?? null;
      const build = bs === null ? null : { slices: bs.slices, workMs: Math.round(bs.workMs), maxSliceMs: Math.round(bs.maxSliceMs * 10) / 10, maxStepMs: Math.round(bs.maxStepMs * 10) / 10, maxStepLabel: bs.maxStepLabel };
      prepare = { ms: Math.round(performance.now() - tp), frames: pg.length, maxFrameMs: Math.round(Math.max(0, ...pg) * 10) / 10, framesOver33: pg.filter((g) => g > 33).length, framesOver100: pg.filter((g) => g > 100).length, build };
      ticking = false;
      await this.settle(30, 10, 600);
    }
    const gaps: number[] = [];
    let last = performance.now();
    let firstFrameAt: number | null = null;
    let loaded = false;
    let after = 0;
    const want = o.framesAfter ?? 120;
    let stop!: () => void;
    const done = new Promise<void>((res) => { stop = res; });
    const loop = (now: number): void => {
      gaps.push(now - last);
      last = now;
      this.tick();
      if (loaded) {
        if (firstFrameAt === null) firstFrameAt = performance.now();
        if (++after >= want) { stop(); return; }
      }
      requestAnimationFrame(loop);
    };
    const programsBefore = this.renderer.renderer.info.memory.programs;
    const t0 = performance.now();
    requestAnimationFrame(loop);
    try {
      await this.director.loadZone(to, harvest, arrival);
    } finally {
      preloaded.release();
    }
    const loadMs = performance.now() - t0;
    this.zone = next;
    this.harvest = harvest;
    this.spec = zoneSpecFor(next, harvest);
    this.place(arrival.x, arrival.z, 0);
    loaded = true;
    await done;
    const programs = this.renderer.renderer.info.memory.programs;
    await this.renderer.compileIdle?.();
    const programsSettled = this.renderer.renderer.info.memory.programs;
    const sorted = [...gaps].sort((a, b) => a - b);
    const r1 = (v: number): number => Math.round(v * 10) / 10;
    return {
      from: from.id, to, preloaded: o.preload, firstFrameMs: firstFrameAt === null ? null : r1(firstFrameAt - t0), loadMs: r1(loadMs), frames: gaps.length,
      maxFrameMs: r1(sorted[sorted.length - 1] ?? 0), p95FrameMs: r1(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0),
      framesOver33: gaps.filter((g) => g > 33).length, fade: false, zone: this.director.currentZone, programs, programsBefore, programsSettled, prepare,
      backgroundCompile: this.backgroundCompile,
    };
  }

  // ---- the scripted battle -----------------------------------------------------------------------------------------

  script(wildSpecies: string, wildLevel: number): ScriptedBattle {
    if (this.battleScript === null) {
      this.battleScript = scriptWildBattle(content(), {
        playerId: SELF_ID, playerSpecies: LEAD.speciesId, playerLevel: LEAD.level, wildSpecies, wildLevel, zoneId: this.zone.id,
        terrain: terrainFor(this.zone.biome),
      });
    }
    return this.battleScript;
  }

  /** A scripted wild battle `mine` (the player's lead) vs `foe`, both at `level` (dev hook for the texture runs). */
  scriptBattle(mine: string, foe: string, level = 50): ScriptedBattle {
    this.battleScript = scriptWildBattle(content(), {
      playerId: SELF_ID, playerSpecies: mine, playerLevel: level, wildSpecies: foe, wildLevel: level, zoneId: this.zone.id,
      terrain: terrainFor(this.zone.biome),
    });
    return this.battleScript;
  }

  startBattle(s: ScriptedBattle): void {
    // World3D's battleStart: both teams' static atlases for the battle's life
    const species = s.start.state.sides.flatMap((side) => side.party.map((b) => b.creature.speciesId));
    if (this.textures !== null) this.battleSprites.begin(species);
    else for (const sp of species) this.leaseSprites(sp, 'front');
    this.battle.onBattleStart({ type: 'battleStart', battleId: s.battleId, format: 'wild', seat: 0, state: s.start.state, events: s.start.events, stateDigest: s.start.digest });
  }

  /** The server's side of `battleAction`: the scripted turn's events, one task later (a message never arrives inside submit). */
  private onClientMessage(type: string, payload: unknown): void {
    if (type !== 'battleAction') return;
    const s = this.battleScript;
    const p = payload as { battleId: string; turn: number };
    if (s === null || p.battleId !== s.battleId) return;
    const t = s.turns[p.turn - 1];
    if (t === undefined) return;
    setTimeout(() => this.battle.onBattleEvents({ type: 'battleEvents', battleId: s.battleId, turn: p.turn, events: t.events, stateDigest: t.digest, rng: t.state.rng }), 0);
  }

  endBattle(): void {
    if (this.battle.active) this.battle.reset();
  }

  private battleView(): BattleView {
    const r = this.renderer;
    const cat = (): SpriteCatalog | null => this.catalog;
    const flags = (): EffectsFlags => (this.reduced ? applyReducedEffects(ALL_EFFECTS) : ALL_EFFECTS);
    return {
      enterBattle: (s) => void this.director.enterBattle(s),
      exitBattle: () => {
        void this.director.exitBattle();
        this.battleSprites.end();
      },
      setBattler: (ref, c, key, spriteId) => {
        const catalog = cat();
        if (c === null || catalog === null) {
          r.stage.setBattler(ref, null);
          this.battleSprites.set(ref, null);
          return;
        }
        // a battle form shows its own manifest entry (`spriteId`, `<species>_<form>`) and its aura, as in World3D
        if (this.textures !== null) this.battleSprites.set(ref, spriteId ?? c.speciesId);
        else this.leaseSprites(spriteId ?? c.speciesId, 'front');
        r.stage.setBattler(ref, catalog.descriptor(c.speciesId, key, c.variantKey, c.isAlpha, c.isShiny === true, spriteId));
      },
      setPose: (ref, pose, ms) => r.stage.setPose(ref, pose, ms),
      hurt: (ref, s) => r.stage.hurt(ref, s),
      vfx: (id, from, to, ms, type) => r.stage.vfx(id as VfxId, from, to, ms, type as TypeName | undefined),
      prewarm: (ids) => r.stage.prewarm(ids as readonly VfxId[]),
      syncFrom: (hp) => r.stage.syncFrom(hp),
      setWeather: (k) => r.stage.setWeather(k as WeatherKind),
      cue: (shot, ms) => r.camera.cue(shot, ms),
      shake: (amp, ms) => r.camera.shake(amp, ms),
      setTimeScale: (s) => r.setTimeScale(s),
      hitstopEnabled: () => flags().hitstop,
      slowmoEnabled: () => flags().slowmo,
      playSfx: (id) => this.audio.play(id, null),
      setBattleHud: (m) => this.hud.setBattle(m),
      setThreat: (on) => this.audio.setThreat(on),
      // the signature cinematic's aim, as World3D does it
      project: (ref, out) => {
        const bb = part3Of(r)?.stage.battler(ref) ?? null;
        if (bb === null) return false;
        const rect = this.canvas.getBoundingClientRect();
        const [tx, ty] = this.project(bb.topWorld(new Vector3()));
        const [fx, fy] = this.project(bb.feet(new Vector3()));
        out[0] = rect.left + tx;
        out[1] = rect.top + ty;
        out[2] = rect.left + fx;
        out[3] = rect.top + fy;
        return true;
      },
    };
  }

  /** Used by shot 5's sidecar: which part3 pieces exist. */
  get hasStage(): boolean {
    return part3Of(this.renderer) !== undefined;
  }
}

/** One macrotask: lets deferred store writes (setTimeout 0) and message deliveries run between frames. */
export function yieldTask(): Promise<void> {
  return new Promise((res) => setTimeout(res, 0));
}
