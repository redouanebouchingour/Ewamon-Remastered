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
 */
import { Group, LinearSRGBColorSpace, NoToneMapping, Vector3 } from 'three/webgpu';
import type { Node } from 'three/webgpu';
import { float, renderOutput, vec3, vec4 } from 'three/tsl';
import { BODIES, harvestStateFor, zone as zoneDef } from '@ewa/content';
import type { HarvestState, ZoneDef, ZoneId } from '@ewa/content';
import type { CreatureInstance } from '@ewa/core';
import { ALL_EFFECTS, applyReducedEffects, createBudgetProbe, createRenderer, part3Of, rendererInternals } from '@ewa/render';
import type { BudgetCounts, EffectsFlags, Renderer, RendererProbe, VfxId, WeatherKind, ZoneSpec } from '@ewa/render';
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
import { LocalPlayerController } from '../scene/LocalPlayerController';
import { RemoteInterpolator } from '../scene/RemoteInterpolator';
import { TRAINER_BACK_M, createSceneDirector, terrainFor } from '../scene/SceneDirector';
import type { SceneDirector } from '../scene/SceneDirector';
import { SpawnViews } from '../scene/SpawnViews';
import type { SpawnLike } from '../scene/SpawnViews';
import { bindCatalogAtlas, createSpriteCatalog, loadCreatureManifest, speciesAtlases } from '../scene/spriteCatalog';
import type { SpriteCatalog } from '../scene/spriteCatalog';
import { zoneSpecFor } from '../scene/zoneSpecFor';
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

const gpuQueue = (r: Renderer): { onSubmittedWorkDone(): Promise<void> } | null =>
  (r.renderer.backend as unknown as { device?: { queue: { onSubmittedWorkDone(): Promise<void> } } }).device?.queue ?? null;

export interface TickTiming { readonly simMs: number; readonly frameMs: number }

export class HarnessWorld {
  renderer!: Renderer;
  probe!: RendererProbe;
  director!: SceneDirector;
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
  readonly flags: ReadonlySet<string> = new Set<string>();
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
  private readonly bound = new Set<string>();
  private battleScript: ScriptedBattle | null = null;
  private maskSaved: Node | null = null;
  private maskNode: Node | null = null;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly log: HarnessLog) {
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
    });
  }

  // ---- boot ------------------------------------------------------------------------------------------------------

  async boot(zoneId: ZoneId, extraSpecies: readonly string[]): Promise<void> {
    const t0 = performance.now();
    const r = await createRenderer({
      canvas: this.canvas,
      pixelRatio: typeof devicePixelRatio === 'number' ? devicePixelRatio : 1,
      effects: ALL_EFFECTS,
      trackTimestamp: true,
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
      this.evolution = new EvolutionDirector({
        stage: p3.stage,
        descriptor: (sp, key, v, a) => this.catalog?.descriptor(sp, key, v, a) ?? null,
        ensureSpecies: (sp) => void this.bindSpecies([sp]),
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
        ensureSpecies: (sp) => void this.bindSpecies([sp]),
        height: (x, z) => this.director.handle?.collider.sample(x, z) ?? 0,
        targets: this.targets,
        interactKey: () => 'E',
      });
    }
    this.zone = zoneDef(zoneId);
    this.harvest = harvestStateFor(zoneId, this.flags);
    this.spec = zoneSpecFor(this.zone, this.harvest);
    await this.bindAtlases([...(this.catalog?.zoneAtlases(zoneId) ?? [])], [LEAD.speciesId, ...extraSpecies]);
    const tz = performance.now();
    await this.director.loadZone(zoneId, this.harvest);
    this.log(`zone ${zoneId} loaded in ${Math.round(performance.now() - tz)} ms (layoutSeed ${this.zone.layoutSeed >>> 0}, harvest ${this.harvest})`);
    const body = BODIES.find((b) => b.id === SELF_BODY);
    // the same `look:palette` id World3D's lookOf gives the local player
    const look = body === undefined ? 'casual_male' : body.palette ? `${body.look}:${body.palette}` : body.look;
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

  private async bindAtlases(ids: string[], species: readonly string[]): Promise<void> {
    const cat = this.catalog;
    if (cat === null) return;
    for (const sp of species) for (const a of speciesAtlases(cat, sp)) if (!ids.includes(a)) ids.push(a);
    await this.bindIds(ids);
  }

  private async bindSpecies(species: readonly string[]): Promise<void> {
    const cat = this.catalog;
    if (cat === null) return;
    await this.bindIds(species.flatMap((sp) => [...speciesAtlases(cat, sp)]));
  }

  private async bindIds(ids: readonly string[]): Promise<void> {
    const cat = this.catalog;
    const p3 = part3Of(this.renderer);
    if (cat === null || p3 === undefined) return;
    await Promise.all(
      ids.filter((id) => !this.bound.has(id)).map(async (id) => {
        const bind = bindCatalogAtlas(p3.sprites, cat, id);
        if (bind === null) return;
        this.bound.add(id);
        try {
          await bind;
        } catch (e) {
          this.log(`atlas bind failed ${id}: ${String(e)}`);
        }
      }),
    );
  }

  // ---- placement / shot state -----------------------------------------------------------------------------------

  /** Places the local player (a fresh placement, as a join does) and snaps the camera onto it. */
  place(x: number, z: number, angle: number): void {
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
      this.renderer.actors.setTransform(SELF_ID, bf.x - bf.fx * TRAINER_BACK_M, bf.z - bf.fz * TRAINER_BACK_M, Math.atan2(bf.fx, bf.fz), false, false);
    } else if (this.evolution?.active === true) {
      this.renderer.actors.setTransform(SELF_ID, this.input.renderX, this.input.renderZ, this.evolution.faceAngle(this.input.renderX, this.input.renderZ), false, false);
    } else {
      this.renderer.actors.setTransform(SELF_ID, this.input.renderX, this.input.renderZ, this.input.pose.angle, this.input.moving, this.input.running);
    }
    this.nameplateLeft -= dtMs;
    if (this.nameplateLeft <= 0) {
      this.nameplateLeft = NAMEPLATE_MS;
      this.updateNameplates();
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
   */
  async drawMask(): Promise<void> {
    const host = rendererInternals(this.renderer);
    if (host === undefined) throw new Error('no renderer internals');
    const pipe = host.post.pipeline;
    if (this.maskNode === null) {
      const m = host.post.nodes.maskT;
      this.maskNode = renderOutput(vec4(vec3(m.y), float(1)), NoToneMapping, LinearSRGBColorSpace) as unknown as Node;
    }
    this.maskSaved = pipe.outputNode as unknown as Node;
    pipe.outputNode = this.maskNode as never;
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

  startBattle(s: ScriptedBattle): void {
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
      exitBattle: () => void this.director.exitBattle(),
      setBattler: (ref, c, key) => {
        const catalog = cat();
        if (c === null || catalog === null) {
          r.stage.setBattler(ref, null);
          return;
        }
        void this.bindSpecies([c.speciesId]);
        r.stage.setBattler(ref, catalog.descriptor(c.speciesId, key, c.variantKey, c.isAlpha));
      },
      setPose: (ref, pose, ms) => r.stage.setPose(ref, pose, ms),
      hurt: (ref, s) => r.stage.hurt(ref, s),
      vfx: (id, from, to, ms) => r.stage.vfx(id as VfxId, from, to, ms),
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
