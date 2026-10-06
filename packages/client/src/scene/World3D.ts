/**
 * SPEC §20.4.2 — World3D: the one scene instance behind GameCanvas (registered with `setWorldFactory`).
 *
 * tick(now), every animation frame: (1) `input.sample()`; (2) per fixed 16.667 ms step (max 4, remainder carried):
 * `input.step` (prediction), `remotes.step`, interaction targeting, `battle.player.step`, `audio.step`; then the
 * local avatar transform; (3) `hudWriter.flush()` — dirty fields only; (4) ONE `renderer.frame(frameDt)`. While the
 * tab is hidden the loop is a 250 ms `setTimeout` stepping the simulation without rendering. Nothing in tick writes a
 * Zustand store except `ui.fps` at 1 Hz in dev builds (the battle's phase / log writes are deferred off the tick).
 *
 * Boot (§20.10.3, IMPLEMENTATION-NOTES part 2 W1): the world subscribes to the WorldSession at construction (a
 * battleResync on rejoin, chat and room changes are never lost while the renderer compiles), then creates the
 * renderer (≈ 16 s synchronous shader warm-up on the dev iGPU — the DOM world-boot overlay says so before the main
 * thread blocks), reads the creature manifest, binds the zone's atlases with a real byte bar, builds the zone and
 * reveals the canvas on its first rendered frame (`performance.mark('ewa:first-frame')`). Phase 5 (hero materials)
 * starts after that, never awaited.
 *
 * Phase D8–D11 world systems: prediction surfs where the server would let it (HM Surf held, the zone's water not lava,
 * not riding — `StepCollider.setSurf`, every fixed step); a 'fish' target rides the first water sample ahead of a
 * player holding the Old Rod, and E on it runs the `FishingController` prompt (a landed bite sends `fish { angle }`);
 * Cut / Strength obstacles are pre-checked against the bag and party before the interact goes out; the bike key mounts
 * the bicycle when owned, outdoors and on land, and it folds itself in a hall or when the item is gone.
 */
import { getStateCallbacks } from '@colyseus/sdk';
import { Group, Vector3 } from 'three/webgpu';
import { BIKE_ITEM, BODIES, harvestStateFor, interiorNpcs, interiorTrainers, obstacleRefusal, obstacleRefusalText, zone as zoneDef } from '@ewa/content';
import type { BadgeId, ZoneDef, ZoneId } from '@ewa/content';
import type { CreatureInstance } from '@ewa/core';
import { FISH_REACH_M } from '@ewa/protocol';
import type { PlayerState, ServerMessage, SpawnState, ZoneState } from '@ewa/protocol';
import { ACTOR_POOL_SIZE, createRenderer, heroSurfaces, part3Of } from '@ewa/render';
import type { CompileProgress, Renderer, SurfaceId, VfxId, WeatherKind, ZoneHandle } from '@ewa/render';
import { createAudioDirector } from '../audio/AudioDirector';
import type { AudioDirector } from '../audio/AudioDirector';
import { loadAudioManifest, validateAudioManifest } from '../audio/manifest';
import { navigateTo } from '../app/navigation';
import { getWorldBoot, setWorldBoot } from '../app/bootProgress';
import { battlePanelTop, onBattlePanelTop } from '../battle/panelInset';
import { createBattleController } from '../battle/BattleController';
import type { BattleController, BattleView } from '../battle/BattleController';
import { setBattleActions } from '../battle/controllerRef';
import { foeIdentity } from '../battle/foe';
import { STEP_MS } from '../battle/constants';
import { TIMELINE_SFX } from '../battle/timeline';
import { MOVE_ANIMS } from '../battle/moveAnims';
import { content, maxHpOf, species as speciesDef } from '../data/content';
import { apiFetch } from '../net/api';
import { getWorldSession } from '../net/WorldSession';
import type { WorldSession, ZoneRoom } from '../net/WorldSession';
import { onEffectiveSettings, getEffectiveSettings } from '../state/applySettings';
import { toast, useNotificationsStore } from '../state/notifications';
import { applyInventoryDelta, partyCanBattle, toInventoryDelta, useSessionStore } from '../state/session';
import { useQuestTracking } from '../state/questTracking';
import { useSettingsStore } from '../state/settings';
import { setFishingActions, useFishingStore } from '../state/fishing';
import { useUiStore } from '../state/ui';
import { FONT, TYPE_COLORS } from '../ui/tokens';
import { createStepCollider } from './collider';
import type { StepCollider } from './collider';
import { beatDialogue, gymPlan, leaguePostDialogue, leagueSpeaker, npcPlan, storyFlagSet, trainerPlan } from './dialogue';
import { questHintFor } from './questHint';
import type { DialogueLines, InteractPlan } from './dialogue';
import { HudWriter, partyStrip } from './HudWriter';
import type { HudNameplates } from './HudWriter';
import { createInputCapture } from './input';
import type { InputCapture } from './input';
import { InteractionTargets, PLAYER_RANGE, makeInteractable } from './interaction';
import type { Interactable } from './interaction';
import { FishingController } from './fishing';
import { pocketActorMax } from './interiors';
import { LocalPlayerController } from './LocalPlayerController';
import { RemoteInterpolator } from './RemoteInterpolator';
import { EMOTE_CHEER, EMOTE_SAD, FoeActor, foeSpecOf } from './foeActor';
import { TRAINER_BACK_M, createSceneDirector } from './SceneDirector';
import type { SceneDirector } from './SceneDirector';
import { SpawnViews } from './SpawnViews';
import { LegendaryViews, staticTargetId } from './LegendaryViews';
import { RaidDen, raidTargetId } from './RaidViews';
import { raidInfoOf } from '../battle/raid';
import { createSpriteCatalog, loadCreatureManifest } from './spriteCatalog';
import type { SpriteCatalog } from './spriteCatalog';
import type { WorldInstance } from './worldHost';

const MAX_STEPS = 4;
const NO_ITEMS: Readonly<Record<string, number>> = Object.freeze({});
const HIDDEN_STEP_MS = 250;
const NAMEPLATE_MS = 500;
const DEV_MS = 1000;
/** actor-pool budget: statics + the local avatar + the 6 arena spectators come first (render §10.7.6: 48 rigs) */
const SPECTATOR_RIGS = 6;

export interface World3D extends WorldInstance {
  readonly renderer: Renderer;
  readonly director: SceneDirector;
  readonly input: LocalPlayerController;
  readonly remotes: RemoteInterpolator;
  readonly battle: BattleController;
  readonly audio: AudioDirector;
  readonly hudWriter: HudWriter;
  tick(nowMs: number): void;
}

/**
 * The render look id for a player body: `<look>` or `<look>:<palette>` — `models.manifest.json` lists every BODIES
 * palette variant as its own look (a recoloured atlas tile, render §10.7.7); an unknown palette falls back to the base look.
 */
function lookOf(body: string): string {
  const def = BODIES.find((b) => b.id === body);
  if (!def) return 'casual_male';
  return def.palette ? `${def.look}:${def.palette}` : def.look;
}

function devBuild(): boolean {
  const env = (import.meta as { env?: { DEV?: boolean } }).env;
  return Boolean(env?.DEV) || (typeof location !== 'undefined' && new URLSearchParams(location.search).get('dev') === '1');
}

const nextFrame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()));

/**
 * The HUD hint line (≤ 60 chars in the writer): `questHintFor` (Phase B3: the journal's tracked quest first, then the
 * story beat the player can play next, the first started quest's undone objective, the next gym badge).
 */
function questHint(): string | null {
  return questHintFor(useSessionStore.getState().progression, useQuestTracking.getState().tracked);
}

class World implements World3D {
  renderer!: Renderer;
  director!: SceneDirector;
  readonly input: LocalPlayerController;
  readonly remotes: RemoteInterpolator;
  readonly battle: BattleController;
  readonly audio: AudioDirector;
  readonly hudWriter = new HudWriter(null);
  private readonly targets: InteractionTargets;
  private readonly ws: WorldSession = getWorldSession();
  private readonly capture: InputCapture;
  private catalog: SpriteCatalog | null = null;
  private spawns: SpawnViews | null = null;
  /** Phase B1: legendary statics (the director syncs them on load / flags / unload) */
  private legendaries: LegendaryViews | null = null;
  /** Phase C1: the open raid's den (synced from the patch handler) */
  private raidDen: RaidDen | null = null;
  /** the last `state.raid` id / phase / hpPct seen by the patch handler (no allocation per patch) */
  private raidSeenId = '';
  private raidSeenPhase = -1;
  private raidSeenHp = -1;
  private readonly clientGroupName = 'ewa:client-creatures';
  private ready = false;
  private running = false;
  private disposed = false;
  private raf = 0;
  private hiddenTimer: ReturnType<typeof setTimeout> | null = null;
  private last = -1;
  private acc = 0;
  private firstFrame = false;
  private zoneLoaded = false;
  /** a handover's zone is loading: the boot overlay is back until its first frame (render T4 phase 1) */
  private awaitingZoneFrame = false;
  private room: ZoneRoom | null = null;
  private roomZone: ZoneId | null = null;
  private roomDisposers: (() => void)[] = [];
  private readonly offs: (() => void)[] = [];
  private nameplateLeft = 0;
  /**
   * Phase B7: the trainer at the far slot — a pvp foe's remote avatar, a restaged director actor (route / hall trainer,
   * league leader) or a temporary `battle:foe` actor with the content look (a story trainer fought from a beat).
   */
  private readonly foe = new FoeActor({
    actors: {
      spawn: (id, d) => this.ready && this.renderer.actors.spawn(id, d),
      setTransform: (id, x, z, a, m, r) => this.ready && this.renderer.actors.setTransform(id, x, z, a, m, r),
      setEmote: (id, n) => this.ready && this.renderer.actors.setEmote(id, n),
      despawn: (id) => this.ready && this.renderer.actors.despawn(id),
    },
    isStatic: (id) => this.ready && this.director.isStaticActor(id),
    isRemote: (id) => this.remotes.isSpawned(id),
    restPose: (id) => (this.ready ? this.director.staticPose(id) : null),
  });
  /** the prediction collider of the loaded zone (gates are its removable blockers) */
  private stepCollider: StepCollider | null = null;
  private devLeft = 0;
  private devOn = false;
  private frames = 0;
  private frameMsSum = 0;
  private frameMsMax = 0;
  private readonly dev = devBuild();
  private readonly bound = new Set<string>();
  private readonly selfTmp = { x: 0, z: 0 };
  private spectatorArenas = new Map<string, { x: number; z: number }>();
  private zone: ZoneDef | null = null;
  /** the beat whose lines the player already read before its interact was sent (its `storyBeat start` is no news) */
  private readBeat: string | null = null;
  /** Phase D9: the Old Rod's prompt and the cast point it is offered at (kept on the water ahead, every fixed step) */
  private readonly fishing: FishingController;
  private readonly fishSpot: Interactable = makeInteractable('fish:spot', 'fish', 0, 0, 'Fish in', 'the water', this.keyLabel('interact'));

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.audio = createAudioDirector();
    this.targets = new InteractionTargets((p) => this.hudWriter.setPrompt(p));
    this.capture = createInputCapture(window, canvas, {
      interact: () => this.ready && this.activate(),
      openChat: () => useUiStore.getState().setChatOpen(true),
      emote: (n) => this.ws.send('emote', { emote: n }),
      challenge: () => this.challengeNearest(),
      rotate: (dir) => this.ready && this.renderer.camera.setHeading(((this.headingIndex() + dir + 4) & 3) as 0 | 1 | 2 | 3),
      zoom: (dir) => this.ready && this.renderer.camera.setZoomStop(Math.max(0, Math.min(2, this.zoomStop() + dir)) as 0 | 1 | 2),
      jump: () => undefined,
      toggleBike: () => this.toggleBike(),
      toggleDev: () => {
        if (!this.dev) return;
        this.devOn = !this.devOn;
        if (!this.devOn) this.hudWriter.setDev(null);
      },
      blocked: () => this.worldBlocked(),
    });
    this.fishSpot.enabled = false;
    this.fishing = new FishingController({
      setTimer: (fn, ms) => setTimeout(fn, ms),
      clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
      random: () => Math.random(),
      reduced: () => getEffectiveSettings().reduced,
      onPhase: (ph) => useFishingStore.getState().setPhase(ph),
      onCatch: () => this.ws.send('fish', { angle: this.input.pose.angle }),
      onMiss: () => undefined,
    });
    setFishingActions({ press: () => this.fishing.press(), cancel: () => this.fishing.cancel() });
    this.input = new LocalPlayerController({
      held: this.capture.held,
      cameraYaw: () => this.cameraYaw(),
      blocked: () => this.movementBlocked(),
      send: (p) => this.ws.send('input', p),
      onSnap: () => {
        if (this.ready) this.renderer.camera.follow(this.ws.selfId);
      },
    });
    this.remotes = new RemoteInterpolator(
      {
        spawn: (id, name, look, guildTag) => this.ready && this.renderer.actors.spawn(id, { look, name, guildTag, isLocal: false }),
        setTransform: (id, x, z, a, m, r) => this.ready && this.renderer.actors.setTransform(id, x, z, a, m, r),
        despawn: (id) => this.ready && this.renderer.actors.despawn(id),
      },
      () => performance.now(),
      ACTOR_POOL_SIZE - 1 - SPECTATOR_RIGS,
    );
    this.battle = createBattleController({
      content: content(),
      send: (type, payload) => this.ws.send(type, payload),
      reduced: () => getEffectiveSettings().reduced,
      instantText: () => useSettingsStore.getState().accessibility.battleTextSpeed === 'instant',
      selfPosition: () => ({ x: this.input.pose.x, z: this.input.pose.z }),
      summaryAt: (id) => {
        const b = this.room?.state.battles?.get(id);
        return b === undefined ? null : { x: b.x, z: b.z };
      },
      selfId: () => this.ws.selfId,
      raidId: () => this.room?.state.raid?.id ?? null,
      raidInfo: () => (this.room === null ? null : raidInfoOf(this.room.state, this.ws.selfId)),
      view: null,
    });
    setBattleActions({
      submit: (a) => this.battle.submit(a),
      check: (a) => this.battle.check(a),
      dismissResult: () => this.battle.dismissResult(),
      undoPick: () => this.battle.undoPick(),
    });
    this.subscribe();
    // dev builds / ?dev=1 only: the console + harness handle (debug(), walkTo(), lastSecond)
    if (this.dev) (window as unknown as { __ewaWorld?: World }).__ewaWorld = this;
  }

  // ---- boot --------------------------------------------------------------------------------------------------

  async boot(): Promise<void> {
    setWorldBoot({ ready: false, label: 'Starting the renderer', loadedBytes: null, totalBytes: null, error: null });
    const eff = getEffectiveSettings();
    const manifestP = loadCreatureManifest();
    // let the overlay paint its label before the synchronous shader warm-up blocks the main thread
    setWorldBoot({ label: 'Compiling shaders (first start can take ~20 s on integrated GPUs)' });
    await nextFrame();
    await nextFrame();
    let r: Renderer;
    try {
      r = await createRenderer({
        canvas: this.canvas, pixelRatio: this.pixelRatio(), effects: eff.effects, transcoderPath: '/basis/', clock: () => performance.now(),
        onCompileProgress: (p) => this.onCompileProgress(p),
      });
    } catch (e) {
      setWorldBoot({ error: e instanceof Error ? e.message : String(e) });
      throw e;
    }
    if (this.disposed) {
      r.dispose();
      return;
    }
    this.renderer = r;
    this.director = createSceneDirector({
      renderer: r,
      hud: this.hudWriter,
      audio: this.audio,
      targets: this.targets,
      selfId: () => this.ws.selfId,
      flags: () => this.flags(),
      interactKey: () => this.keyLabel('interact'),
      onZone: (h, z) => this.onZoneChanged(h, z),
      setInputEnabled: (on) => this.input.setEnabled(on),
      setAccentType: (t) => part3Of(r)?.stage.setAccentType(t),
      reducedMotion: () => getEffectiveSettings().reduced,
      blockers: () => this.stepCollider,
      legendaries: () => this.legendaries,
      obstacles: () => this.stepCollider,
    });
    this.hudWriter.bind(r.hud);
    this.hudWriter.setConnection(useUiStore.getState().connection);
    void this.loadFonts();
    this.observeSize();
    this.offs.push(
      onEffectiveSettings((s) => {
        r.setEffects(s.effects);
        r.hud.setScale(s.uiScale);
        r.stage.setTypeColors(TYPE_COLORS[s.colorblind === 'none' ? 'default' : s.colorblind]);
      }),
    );
    const cat = await manifestP;
    if (cat !== null) this.catalog = createSpriteCatalog(cat, speciesDef);
    const p3 = part3Of(r);
    const group = new Group();
    group.name = this.clientGroupName;
    r.scene.add(group);
    if (p3 !== undefined) {
      this.spawns = new SpawnViews({
        parent: group,
        acquire: (d) => p3.sprites.acquire(d),
        descriptor: (sp, key, v, a, s) => this.catalog?.descriptor(sp, key, v, a, s) ?? null,
        ensureSpecies: (sp) => this.ensureSpecies(sp),
        height: (x, z) => this.director.handle?.collider.sample(x, z) ?? 0,
        targets: this.targets,
        interactKey: () => this.keyLabel('interact'),
      });
      this.legendaries = new LegendaryViews({
        parent: group,
        acquire: (d) => p3.sprites.acquire(d),
        descriptor: (sp, key) => this.catalog?.descriptor(sp, key) ?? null,
        ensureSpecies: (sp) => this.ensureSpecies(sp),
        height: (x, z) => this.director.handle?.collider.sample(x, z) ?? 0,
        targets: this.targets,
        interactKey: () => this.keyLabel('interact'),
      });
      // Phase C1: the boss in the alpha treatment (glow rim) marks the den
      this.raidDen = new RaidDen({
        parent: group,
        acquire: (d) => p3.sprites.acquire(d),
        descriptor: (sp, key) => this.catalog?.descriptor(sp, key, 'normal', true) ?? null,
        ensureSpecies: (sp) => this.ensureSpecies(sp),
        height: (x, z) => this.director.handle?.collider.sample(x, z) ?? 0,
        targets: this.targets,
        interactKey: () => this.keyLabel('interact'),
        dress: (x, z) => p3.stage.dressSpectator(x, z),
        undress: (x, z) => p3.stage.undressSpectator(x, z),
      });
    }
    this.audio.armOnGesture(window);
    void loadAudioManifest().then(async (m) => {
      if (m !== null && this.dev) {
        const ids = [...TIMELINE_SFX, ...Object.values(MOVE_ANIMS).map((d) => d.sfx).filter((x): x is string => x !== undefined)];
        const problems = validateAudioManifest(m, ids);
        if (problems.length > 0) console.error('audio manifest', problems);
      }
      await this.audio.init(m);
    });
    this.battle.attach(this.battleView());
    this.ready = true;
    // a room joined while the renderer compiled
    if (this.room !== null && this.roomZone !== null) void this.enterZone(this.room, this.roomZone);
    else setWorldBoot({ label: 'Joining the world' });
  }

  private async loadFonts(): Promise<void> {
    const body = `${FONT.text}`;
    const display = `${FONT.display}`;
    try {
      await Promise.race([
        Promise.all([document.fonts.load(`14px ${FONT.text}`), document.fonts.load(`24px ${FONT.display}`)]),
        new Promise((r) => setTimeout(r, 1000)),
      ]);
    } catch (_e) {
      // fallbacks
    }
    if (!this.disposed) this.renderer.hud.setFonts(body, display);
  }

  /**
   * render `onCompileProgress` (T5): the blocking phases ('boot', a zone's phase 1) drive the boot overlay's real bar;
   * the background phase after a zone became playable drives the small corner pill. Store writes happen here, from
   * the compile callbacks, never from the tick.
   */
  private onCompileProgress(p: CompileProgress): void {
    if (p.phase === 'background') {
      setWorldBoot({ background: p.done ? null : { loaded: p.loaded, total: p.total } });
      return;
    }
    if (getWorldBoot().ready) return;
    if (p.done) {
      setWorldBoot({ compile: null });
      return;
    }
    const label = p.phase === 'boot' ? 'Compiling shaders' : `Preparing ${this.zone?.name ?? 'the world'}`;
    setWorldBoot({ label, loadedBytes: null, totalBytes: null, compile: { loaded: p.loaded, total: p.total } });
  }

  private pixelRatio(): number {
    const scale = useSettingsStore.getState().graphics.renderScale;
    return (typeof devicePixelRatio === 'number' ? devicePixelRatio : 1) * scale;
  }

  private observeSize(): void {
    const apply = (): void => {
      const rect = this.canvas.getBoundingClientRect();
      this.renderer.resize(rect.width, rect.height);
      this.applyBattleInset();
    };
    apply();
    this.offs.push(onBattlePanelTop(() => this.applyBattleInset()));
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(apply);
      ro.observe(this.canvas);
      this.offs.push(() => ro.disconnect());
    }
    this.offs.push(
      useSettingsStore.subscribe(
        (s) => s.graphics.renderScale,
        () => this.renderer.setPixelRatio(this.pixelRatio()),
      ),
    );
  }

  /**
   * render T2: the DOM battle panel's real height over the canvas (canvas bottom − panel top) → the battle camera
   * frames both battlers above it and the HUD keeps the HP bars off it; no panel → render's SPEC default (28 % + margin).
   */
  private applyBattleInset(): void {
    const p3 = part3Of(this.renderer);
    if (p3 === undefined) return;
    const top = battlePanelTop();
    if (top === null) {
      p3.setBattleInsets(0, null);
      return;
    }
    const rect = this.canvas.getBoundingClientRect();
    p3.setBattleInsets(0, Math.max(0, Math.min(rect.height, rect.bottom - top)));
  }

  // ---- session / room wiring ------------------------------------------------------------------------------------

  private subscribe(): void {
    const ws = this.ws;
    this.offs.push(ws.onMessage((m) => this.onMessage(m)));
    this.offs.push(
      ws.onRoom((room, zoneId) => {
        this.detachRoom();
        this.room = room;
        this.roomZone = zoneId;
        if (room === null || zoneId === null) return;
        this.attachRoom(room);
        if (this.ready) void this.enterZone(room, zoneId);
      }),
    );
    this.offs.push(
      ws.onReconnected(() => {
        this.input.clear();
        this.remotes.clearBuffers();
      }),
    );
    this.offs.push(
      useSessionStore.subscribe(
        (s) => s.inventory?.party,
        (party) => this.writeParty(party ?? []),
        { fireImmediately: true },
      ),
    );
    this.offs.push(
      useSessionStore.subscribe(
        (s) => s.progression,
        () => {
          this.hudWriter.setQuestHint(questHint());
          if (this.ready) this.director.refreshFlags(this.flags());
        },
        { fireImmediately: true },
      ),
    );
    // Phase B3: the journal's Track toggle re-points the hint
    this.offs.push(
      useQuestTracking.subscribe(
        (s) => s.tracked,
        () => this.hudWriter.setQuestHint(questHint()),
      ),
    );
    this.offs.push(
      useUiStore.subscribe(
        (s) => s.connection,
        (c) => this.hudWriter.setConnection(c),
      ),
    );
    this.offs.push(
      useUiStore.subscribe(
        (s) => s.hudVisible,
        (v) => this.hudWriter.setVisible(v),
      ),
    );
    this.offs.push(
      useUiStore.subscribe(
        (s) => s.dialogue !== null || s.modal !== 'none' || s.prompts.length > 0,
        (on) => this.audio.duck(on),
      ),
    );
    // Settings › Audio sliders → the four buses (linear 0..1, applied as gain² by the director)
    this.offs.push(
      useSettingsStore.subscribe(
        (s) => s.audio,
        (a) => {
          this.audio.setBus('master', a.master);
          this.audio.setBus('music', a.music);
          this.audio.setBus('sfx', a.sfx);
          this.audio.setBus('ui', a.ui);
        },
        { fireImmediately: true },
      ),
    );
    if (ws.room !== null && ws.zoneId !== null) {
      this.room = ws.room;
      this.roomZone = ws.zoneId;
      this.attachRoom(ws.room);
    }
    const onVis = (): void => this.onVisibility();
    document.addEventListener('visibilitychange', onVis);
    this.offs.push(() => document.removeEventListener('visibilitychange', onVis));
  }

  private writeParty(party: readonly CreatureInstance[]): void {
    this.hudWriter.setParty(partyStrip(party, (i) => maxHpOf(party[i]!)));
  }

  private flags(): ReadonlySet<string> {
    const p = useSessionStore.getState().progression;
    return storyFlagSet(p?.flags ?? [], (p?.badges ?? []) as readonly BadgeId[]);
  }

  private attachRoom(room: ZoneRoom): void {
    const $ = getStateCallbacks(room);
    const state = room.state as ZoneState;
    const self = (): string => this.ws.selfId;
    const d: (() => void)[] = [];
    const onPlayer = (p: PlayerState, key: string): void => {
      if (key === self()) {
        this.input.reconcile(p.x, p.z, p.angle, p.seq);
        d.push($(p).onChange(() => this.input.reconcile(p.x, p.z, p.angle, p.seq)));
        return;
      }
      this.remotes.add(key, { name: p.name, look: lookOf(p.body), guildTag: p.guildTag, inBattle: p.inBattle });
      this.remotes.push(key, state.tick, p.x, p.z, p.angle, p.moving, p.running);
      d.push($(p).listen('emote', (v: number) => this.ready && this.renderer.actors.setEmote(key, Math.max(0, Math.min(6, v)) as 0 | 1 | 2 | 3 | 4 | 5 | 6)));
      d.push(
        $(p).onChange(() => this.remotes.update(key, { name: p.name, look: lookOf(p.body), guildTag: p.guildTag, inBattle: p.inBattle })),
      );
    };
    d.push($(state).players.onAdd(onPlayer, true));
    d.push($(state).players.onRemove((_p: PlayerState, key: string) => this.remotes.remove(key)));
    // A collection's onChange fires for adds / removals only: each spawn's own fields (a wandering x / z, engagedBy)
    // need a per-instance listener, dropped with the spawn.
    const spawnOffs = new Map<string, () => void>();
    d.push(() => {
      for (const off of spawnOffs.values()) off();
      spawnOffs.clear();
    });
    d.push(
      $(state).spawns.onAdd((s: SpawnState) => {
        this.spawns?.add(s);
        spawnOffs.get(s.id)?.();
        spawnOffs.set(s.id, $(s).onChange(() => this.spawns?.update(s)));
      }, true),
    );
    d.push(
      $(state).spawns.onRemove((s: SpawnState) => {
        spawnOffs.get(s.id)?.();
        spawnOffs.delete(s.id);
        this.spawns?.remove(s.id);
      }),
    );
    d.push(
      $(state).battles.onAdd((b) => {
        const mine = [...b.participants].includes(self());
        if (mine || !this.ready) return;
        if (Math.hypot(b.x - this.input.pose.x, b.z - this.input.pose.z) > 40) return;
        this.renderer.stage.dressSpectator(b.x, b.z);
        this.spectatorArenas.set(b.id, { x: b.x, z: b.z });
      }, true),
    );
    d.push(
      $(state).battles.onRemove((b) => {
        const a = this.spectatorArenas.get(b.id);
        if (a === undefined || !this.ready) return;
        this.spectatorArenas.delete(b.id);
        part3Of(this.renderer)?.stage.undressSpectator(a.x, a.z);
      }),
    );
    d.push(
      $(state).listen('timeOfDay', (t: number) => {
        this.hudWriter.setTimeOfDay(t);
        if (this.ready) this.director.setTimeOfDay(t);
      }, true),
    );
    d.push(
      $(state).listen('weather', (w: string) => {
        if (this.ready) this.director.setWeather(w as WeatherKind);
      }, true),
    );
    // one sample per remote per applied patch (the interpolation ring), + the server-time offset
    const onPatch = (): void => {
      this.remotes.observeTick(state.tick);
      state.players.forEach(this.pushSample);
      this.syncRaid(state, false);
    };
    this.pushSampleState = state;
    room.onStateChange(onPatch);
    d.push(() => room.onStateChange.remove(onPatch));
    this.roomDisposers = d;
  }

  private pushSampleState: ZoneState | null = null;
  private readonly pushSample = (p: PlayerState, key: string): void => {
    if (key === this.ws.selfId || this.pushSampleState === null) return;
    this.remotes.push(key, this.pushSampleState.tick, p.x, p.z, p.angle, p.moving, p.running);
  };

  /**
   * Phase C1: `state.raid` → the den (on a new raid / phase) and the battle controller (hpPct, phase, removal). Runs
   * per applied patch (network callback, not the tick); compares three fields, allocates only on a change.
   */
  private syncRaid(state: ZoneState, force: boolean): void {
    const r = state.raid ?? null;
    const id = r?.id ?? '';
    const phase = r?.phase ?? -1;
    const hp = r?.hpPct ?? -1;
    if (!force && id === this.raidSeenId && phase === this.raidSeenPhase && hp === this.raidSeenHp) return;
    const denChanged = force || id !== this.raidSeenId || phase !== this.raidSeenPhase;
    this.raidSeenId = id;
    this.raidSeenPhase = phase;
    this.raidSeenHp = hp;
    if (denChanged && this.ready && this.zoneLoaded) {
      this.raidDen?.sync(r === null || id === '' ? null : { id, bossSpecies: r.bossSpecies, bossLevel: r.bossLevel, phase, x: r.x, z: r.z });
      if (r !== null && id !== '') this.ensureSpecies(r.bossSpecies);
    }
    this.battle.onRaidState();
  }

  private detachRoom(): void {
    for (const f of this.roomDisposers) f();
    this.roomDisposers = [];
    this.pushSampleState = null;
    this.raidDen?.clear();
    this.raidSeenId = '';
    this.raidSeenPhase = -1;
    this.raidSeenHp = -1;
    this.remotes.clear();
    this.spawns?.clear();
    this.input.clear();
    this.spectatorArenas.clear();
  }

  /** A room (join / handover) is live and the renderer exists: load its zone. */
  private async enterZone(room: ZoneRoom, zoneId: ZoneId): Promise<void> {
    if (this.director.currentZone === zoneId && this.zoneLoaded) return;
    const z = zoneDef(zoneId);
    this.zone = z;
    // a dev-harness walk targets the old zone's coordinates: stop it at the crossing (walkTo resolves false)
    if (this.autopilotTarget !== null) {
      this.autopilotTarget = null;
      this.input.override = null;
    }
    const flags = this.flags();
    // a handover: the overlay covers the blocking part of the next zone's load (its first frame lifts it again)
    if (this.firstFrame) {
      this.awaitingZoneFrame = true;
      setWorldBoot({ ready: false, label: `Travelling to ${z.name}`, loadedBytes: null, totalBytes: null, compile: null, background: null });
    }
    // where the player will stand: render compiles what the first view there draws before loadZone resolves (T4)
    const arrival = room.state.players.get(this.ws.selfId);
    const focus = arrival !== undefined ? { x: arrival.x, z: arrival.z } : null;
    try {
      await this.bindZoneAtlases(zoneId);
      setWorldBoot({ label: `Building ${z.name}`, loadedBytes: null, totalBytes: null });
      await nextFrame();
      this.zoneLoaded = false;
      await this.director.loadZone(zoneId, harvestStateFor(zoneId, flags), focus);
    } catch (e) {
      console.error('zone load failed', e);
      toast('danger', `Could not build ${z.name}.`);
      return;
    }
    if (this.room !== room) return;
    this.zoneLoaded = true;
    const profile = useSessionStore.getState().profile;
    const selfId = this.ws.selfId;
    const me = room.state.players.get(selfId);
    this.renderer.actors.spawn(selfId, { look: lookOf(me?.body ?? profile?.body ?? 'ranger_m'), name: me?.name ?? profile?.username ?? '', guildTag: me?.guildTag ?? '', isLocal: true });
    if (me !== undefined) this.input.reconcile(me.x, me.z, me.angle, me.seq);
    this.renderer.actors.setTransform(selfId, this.input.renderX, this.input.renderZ, this.input.pose.angle, false, false);
    this.renderer.camera.follow(selfId);
    // statics took rigs: shrink the remote budget (+ the most any one pocket spawns while the player stands in it,
    // + Phase B7's temporary battle foe)
    const statics = z.npcs.length + z.trainers.length + pocketActorMax(zoneId) + 1;
    this.remotes.cap = Math.max(8, ACTOR_POOL_SIZE - 1 - SPECTATOR_RIGS - statics);
    // spawns already in view
    room.state.spawns.forEach((s) => this.spawns?.add(s));
    this.director.setTimeOfDay(room.state.timeOfDay);
    this.hudWriter.setTimeOfDay(room.state.timeOfDay);
    this.director.setWeather(room.state.weather as WeatherKind);
    this.input.setEnabled(useUiStore.getState().battle === null);
    this.battle.attach(this.battleView());
    // Phase C1: a raid already open in this room (or opened while the zone built)
    this.syncRaid(room.state, true);
  }

  private onZoneChanged(h: ZoneHandle | null, z: ZoneDef | null): void {
    this.stepCollider = h === null ? null : createStepCollider(h.collider);
    this.input.setCollider(this.stepCollider);
    this.zone = z;
    // Phase D9: a cast never survives a zone change; the cast point is a dynamic target of the new zone
    this.fishing.cancel();
    this.fishSpot.enabled = false;
    if (h !== null) this.targets.addDynamic(this.fishSpot);
    this.spawns?.reground();
    this.raidDen?.reground();
  }

  /** §20.10.3 phase 3: the zone's bind set, parallel, real byte progress from the manifest sizes. */
  private async bindZoneAtlases(zoneId: ZoneId): Promise<void> {
    const cat = this.catalog;
    const p3 = part3Of(this.renderer);
    if (cat === null || p3 === undefined) return;
    const ids = cat.zoneAtlases(zoneId).filter((id) => !this.bound.has(id));
    // the party's creatures too (battle leads)
    for (const c of useSessionStore.getState().inventory?.party ?? []) for (const a of cat.atlasesOf(c.speciesId)) if (!this.bound.has(a) && !ids.includes(a)) ids.push(a);
    if (ids.length === 0) return;
    const total = cat.bytesOf(ids);
    let loaded = 0;
    setWorldBoot({ label: 'Loading creature sprites', loadedBytes: 0, totalBytes: total > 0 ? total : null });
    await Promise.all(
      ids.map(async (id) => {
        const set = cat.atlas(id);
        if (set === null) return;
        this.bound.add(id);
        try {
          await p3.sprites.bindAtlas(set);
        } catch (e) {
          console.warn('atlas bind failed', id, e);
        }
        loaded += cat.bytesOf([id]);
        if (!this.firstFrame) setWorldBoot({ label: 'Loading creature sprites', loadedBytes: loaded, totalBytes: total > 0 ? total : null });
      }),
    );
  }

  /** A species outside the bind set (a swarm, a trade, the other player's party) is bound on demand. */
  private ensureSpecies(speciesId: string): void {
    const cat = this.catalog;
    const p3 = this.ready ? part3Of(this.renderer) : undefined;
    if (cat === null || p3 === undefined) return;
    for (const id of cat.atlasesOf(speciesId)) {
      if (this.bound.has(id)) continue;
      const set = cat.atlas(id);
      if (set === null) continue;
      this.bound.add(id);
      void p3.sprites.bindAtlas(set).catch((e: unknown) => console.warn('atlas bind failed', id, e));
    }
  }

  // ---- messages -----------------------------------------------------------------------------------------------

  private onMessage(m: ServerMessage): void {
    switch (m.type) {
      case 'battleStart':
        this.input.setEnabled(false);
        this.fishing.cancel();
        for (const s of m.state.sides) for (const b of s.party) this.ensureSpecies(b.creature.speciesId);
        useUiStore.getState().setDialogue(null);
        this.battle.onBattleStart(m);
        return;
      case 'battleEvents':
        this.battle.onBattleEvents(m);
        return;
      case 'battleResync':
        this.input.setEnabled(false);
        for (const s of m.state.sides) for (const b of s.party) this.ensureSpecies(b.creature.speciesId);
        // Phase C1: a raid's fight starts with this resync — the lobby yields to the battle
        if (useUiStore.getState().modal === 'raidLobby') useUiStore.getState().closeModal();
        this.battle.onBattleResync(m);
        return;
      case 'battleEnd': {
        // a won gym battle: the leader's `post` lines once the result card is dismissed (then the evolve / learn prompts)
        const b = useUiStore.getState().battle;
        if (b !== null && b.battleId === m.battleId && b.format === 'league' && 'winner' in m.outcome && m.outcome.winner === b.seat) {
          const post = leaguePostDialogue(b.authoritative.sides[b.seat === 0 ? 1 : 0].trainerId);
          if (post !== null) this.showAfterBattle(post, `league:${m.battleId}:post`);
        }
        this.battle.onBattleEnd(m);
        return;
      }
      case 'chat':
        if (useSettingsStore.getState().social.showChat) this.hudWriter.pushChat(m.name, m.text);
        return;
      case 'storyBeat': {
        const ui = useUiStore.getState();
        const open = ui.dialogue;
        const lines = beatDialogue(m.beatId, m.phase, (id) => this.speakerName(id));
        if (m.phase === 'start') {
          // the client already shows (or has shown, before sending the interact) the beat it predicted; an
          // unpredicted start replaces the dialogue
          if (this.readBeat === m.beatId) {
            this.readBeat = null;
            return;
          }
          if (open !== null && open.targetId === `beat:${m.beatId}`) return;
          if (open !== null && lines !== null && open.lines === lines.lines) return;
          if (lines !== null && ui.battle === null) ui.setDialogue({ speaker: lines.speaker, lines: lines.lines, index: 0, targetId: `beat:${m.beatId}` });
          return;
        }
        if (lines !== null) this.showAfterBattle(lines, `beat:${m.beatId}:after`);
        return;
      }
      case 'raidEvents':
        // Phase C1: a raid round's (or the catch roll's) events drive the battle view
        this.battle.onRaidEvents(m);
        return;
      default:
        return;
    }
  }

  private speakerName(id: string): string {
    const npc = this.zone?.npcs.find((n) => n.id === id);
    if (npc !== undefined) return npc.name;
    return leagueSpeaker(id);
  }

  /** Opens `d` now, or — during a battle — once the result card is dismissed (the post-battle prompts wait for it). */
  private showAfterBattle(d: DialogueLines, targetId: string): void {
    const show = (): void => useUiStore.getState().setDialogue({ speaker: d.speaker, lines: d.lines, index: 0, targetId });
    if (useUiStore.getState().battle === null) {
      show();
      return;
    }
    const off = useUiStore.subscribe(
      (s) => s.battle === null,
      (done) => {
        if (!done) return;
        off();
        show();
      },
    );
  }

  /**
   * Runs an interact plan: the lines open now; the interact is sent now or, for a beat battle / a gym challenge, when
   * the player pages past the last line (Escape = walk away: nothing is sent).
   */
  private runPlan(plan: InteractPlan, targetId: string, send: () => void): void {
    const d = plan.dialogue;
    if (d === null) {
      send();
      return;
    }
    const target = d.beatId !== null ? `beat:${d.beatId}` : targetId;
    if (!plan.sendOnFinish) {
      useUiStore.getState().setDialogue({ speaker: d.speaker, lines: d.lines, index: 0, targetId: target });
      send();
      return;
    }
    useUiStore.getState().setDialogue({
      speaker: d.speaker, lines: d.lines, index: 0, targetId: target,
      onFinish: () => {
        this.readBeat = d.beatId;
        send();
      },
    });
  }

  // ---- interaction (called from DOM keydown, never from the tick) ------------------------------------------------

  private activate(): void {
    const t = this.targets.current;
    const z = this.zone;
    if (t === null || z === null) return;
    const ui = useUiStore.getState();
    switch (t.kind) {
      case 'npc': {
        const npc = z.npcs.find((n) => n.id === t.id);
        if (npc === undefined) {
          // Phase A: residents and guides inside the pockets talk client-side (the server has no record of them)
          const inside = interiorNpcs(z.id).find((n) => n.id === t.id);
          if (inside !== undefined) ui.setDialogue({ speaker: inside.name, lines: inside.lines, index: 0, targetId: inside.id });
          return;
        }
        const plan = npcPlan(z.id, npc, this.flags());
        const talk = (): void => this.ws.send('interact', { targetId: npc.id, kind: 'npc' });
        // Phase D2 move tutor: its lines, then (paging past the last one) the party's Teach section with its moves
        if (npc.tutor !== undefined && (plan.dialogue === null || plan.dialogue.beatId === null)) {
          const lines = plan.dialogue?.lines ?? npc.lines;
          ui.setDialogue({ speaker: npc.name, lines, index: 0, targetId: npc.id, onFinish: () => navigateTo(`/play/party?tutor=${encodeURIComponent(npc.id)}`) });
          talk();
          return;
        }
        this.runPlan(plan, npc.id, talk);
        return;
      }
      case 'trainer': {
        const plan = trainerPlan(z.id, t.id, this.flags());
        const tr = z.trainers.find((x) => x.id === t.id) ?? interiorTrainers(z.id).find((x) => x.id === t.id);
        if (plan.dialogue === null && tr !== undefined && tr.lines.length > 0) toast('info', `${tr.name}: ${tr.lines[0]}`);
        this.runPlan(plan, t.id, () => this.ws.send('interact', { targetId: t.id, kind: 'npc' }));
        return;
      }
      case 'gym': {
        const p = useSessionStore.getState().progression;
        const plan = gymPlan(z.id, t.id, this.flags(), (p?.badges ?? []) as readonly BadgeId[]);
        this.runPlan(plan, t.id, () => this.ws.send('interact', { targetId: t.id, kind: 'gym' }));
        return;
      }
      case 'item':
        this.ws.send('interact', { targetId: t.id, kind: 'item' });
        return;
      case 'lore': {
        const l = z.lore.find((x) => x.id === t.id);
        if (l !== undefined) ui.setDialogue({ speaker: l.title, lines: l.text, index: 0, targetId: l.id });
        this.ws.send('interact', { targetId: t.id, kind: 'lore' });
        return;
      }
      case 'warp':
        this.ws.send('interact', { targetId: t.id, kind: 'warp' });
        return;
      case 'switch':
        // the server refuses (toast) unless `requires` is held, sets the flag, and may teleport (a snap re-tracks the pocket)
        this.ws.send('interact', { targetId: t.id, kind: 'switch' });
        return;
      case 'pc':
        navigateTo('/play/box');
        return;
      case 'healer':
        this.ws.send('interact', { targetId: z.id, kind: 'healer' });
        void apiFetch('heal', {})
          .then((res) => {
            applyInventoryDelta(toInventoryDelta({ party: res.party }));
            toast('success', 'Your party is fully healed.');
          })
          .catch(() => toast('warn', 'The healer cannot help right now.'));
        return;
      case 'shop':
        this.ws.send('interact', { targetId: z.id, kind: 'shop' });
        navigateTo('/play/shop');
        return;
      case 'spawn':
        this.ws.send('engageSpawn', { spawnId: t.id });
        return;
      case 'obstacle': {
        // Phase D10: the server re-checks; the same rule here saves a round trip and words the refusal
        const o = z.obstacles?.find((x) => x.id === t.id);
        if (o === undefined) return;
        const inv = useSessionStore.getState().inventory;
        const types = (inv?.party ?? []).map((c) => speciesDef(c.speciesId)?.types ?? []);
        const why = obstacleRefusal(o.kind, inv?.items ?? {}, types);
        if (why !== null) {
          toast('info', obstacleRefusalText(o.kind, why));
          return;
        }
        this.ws.send('interact', { targetId: o.id, kind: 'obstacle' });
        return;
      }
      case 'fish':
        // Phase D9: the prompt runs client-side; only a landed bite reaches the server
        if (!partyCanBattle(useSessionStore.getState().inventory)) {
          toast('warn', 'Your party needs healing before a battle.');
          return;
        }
        this.fishing.start();
        return;
      case 'static':
        // Phase B1: a legendary static (no flee; BattleMenu reads canFlee=false); the server re-checks gate + flag
        if (!partyCanBattle(useSessionStore.getState().inventory)) {
          toast('warn', 'Your party needs healing before a battle.');
          return;
        }
        this.ws.send('interact', { targetId: staticTargetId(t.id), kind: 'static' });
        return;
      case 'raid': {
        // Phase C1: the den — join (lobby, not in yet) and open the lobby; later phases open it as a view
        const r = this.room?.state.raid ?? null;
        const raidId = raidTargetId(t.id);
        if (r === null || r.id !== raidId) return;
        if (r.phase === 0 && !r.damageBoard.has(this.ws.selfId)) {
          if (!partyCanBattle(useSessionStore.getState().inventory)) {
            toast('warn', 'Your party needs healing before a raid.');
            return;
          }
          this.ws.send('raidJoin', { raidId });
        }
        ui.openModal('raidLobby', { raidId });
        return;
      }
    }
  }

  private challengeNearest(): void {
    let best: { id: string; name: string } | null = null;
    let bd = PLAYER_RANGE;
    const sx = this.input.pose.x;
    const sz = this.input.pose.z;
    this.remotes.forEach((id, x, z, info) => {
      if (info.inBattle) return;
      const d = Math.hypot(x - sx, z - sz);
      if (d <= bd) {
        bd = d;
        best = { id, name: info.name };
      }
    });
    const b = best as { id: string; name: string } | null;
    if (b === null) {
      toast('info', 'No trainer close enough to challenge.');
      return;
    }
    if (!partyCanBattle(useSessionStore.getState().inventory)) {
      toast('warn', 'Your party needs healing before a battle.');
      return;
    }
    this.ws.send('challenge', { targetId: b.id }); // the server confirms with its own "Challenge sent" toast
  }

  private keyLabel(action: 'interact'): string {
    const code = useSettingsStore.getState().keybinds[action][0] ?? 'KeyE';
    return code.replace(/^Key|^Digit/, '');
  }

  private movementBlocked(): boolean {
    if (this.capture.typing()) return true;
    return this.worldBlocked();
  }

  private worldBlocked(): boolean {
    const ui = useUiStore.getState();
    return (
      ui.battle !== null || ui.dialogue !== null || ui.modal !== 'none' || ui.chatOpen || ui.prompts.length > 0 || ui.trade !== null || ui.challenge !== null ||
      this.fishing.active
    );
  }

  // ---- Phase D8–D11 world systems ---------------------------------------------------------------------------------

  private items(): Readonly<Record<string, number>> {
    return useSessionStore.getState().inventory?.items ?? NO_ITEMS;
  }

  /** Phase D8: prediction surfs where the server lets this player (HM Surf, water that is not lava, not riding). */
  private canSurf(): boolean {
    return (this.items()['HM Surf'] ?? 0) > 0 && this.zone !== null && this.zone.biome !== 'cinder' && !this.input.biking;
  }

  /** Phase D11: why the bike cannot come out here (null = it can): the server's bike cap rules. */
  private bikeRefusal(): string | null {
    if ((this.items()[BIKE_ITEM] ?? 0) <= 0) return 'You have no bicycle.';
    if (this.director.pocket !== null) return 'No riding indoors.';
    if (this.stepCollider?.onWater(this.input.pose.x, this.input.pose.z) === true) return 'You cannot ride on water.';
    return null;
  }

  private toggleBike(): void {
    if (!this.ready || !this.zoneLoaded) return;
    if (this.input.biking) {
      this.input.setBike(false);
      toast('info', 'You fold the bicycle.');
      return;
    }
    const why = this.bikeRefusal();
    if (why !== null) {
      toast('info', why);
      return;
    }
    this.input.setBike(true);
    toast('info', 'You ride the bicycle.');
  }

  /**
   * Once per fixed step (allocation-free): the bike folds itself where riding stops being allowed, prediction's surf
   * mode follows the bag, and the 'fish' target sits on the first water sample ahead (Old Rod held, outdoors, on foot).
   */
  private stepWorldSystems(): void {
    if (this.input.biking && (this.director.pocket !== null || (this.items()[BIKE_ITEM] ?? 0) <= 0)) {
      this.input.setBike(false);
      setTimeout(() => toast('info', 'You fold the bicycle.'), 0);
    }
    const c = this.stepCollider;
    if (c !== null) c.setSurf(this.canSurf());
    const spot = this.fishSpot;
    spot.enabled = false;
    const terrain = c?.terrain ?? null;
    if (terrain === null || this.zone === null || this.zone.biome === 'cinder' || this.input.biking || this.director.pocket !== null || (this.items()['old_rod'] ?? 0) <= 0) return;
    const pose = this.input.pose;
    const dx = Math.sin(pose.angle);
    const dz = Math.cos(pose.angle);
    for (let d = 0.5; d <= FISH_REACH_M + 1e-9; d += 0.5) {
      const wx = pose.x + dx * d;
      const wz = pose.z + dz * d;
      if (!terrain.water(wx, wz)) continue;
      spot.x = wx;
      spot.z = wz;
      spot.enabled = true;
      return;
    }
  }

  private cameraYaw(): number {
    if (!this.ready) return 0;
    const rig = this.renderer.camera as unknown as { dioramaYaw?: number };
    return rig.dioramaYaw ?? 0;
  }
  private headingIndex(): number {
    return (this.renderer.camera as unknown as { headingIndex?: number }).headingIndex ?? 0;
  }
  private zoomStop(): number {
    return (this.renderer.camera as unknown as { zoomStop?: number }).zoomStop ?? 1;
  }

  // ---- battle view --------------------------------------------------------------------------------------------

  private battleView(): BattleView | null {
    if (!this.ready) return null;
    const r = this.renderer;
    const p3 = part3Of(r);
    const cat = this.catalog;
    const flags = (): { hitstop: boolean; slowmo: boolean } => getEffectiveSettings().effects;
    return {
      enterBattle: (s) => {
        // from the battle state (the BattleSummary patch can arrive after battleStart)
        this.foe.begin(foeSpecOf(s.foeId, s.foeNpc, this.ws.selfId, (id) => foeIdentity(id)));
        // Phase C1: the den's boss steps aside while its arena copy fights
        if (s.format === 'raid') this.raidDen?.setHidden(true);
        void this.director.enterBattle(s);
        this.audio.setTheme(s.format === 'raid' ? 'raid' : 'battle', 400);
      },
      ended: (foeWon) => {
        // Phase B7: the winner cheers, the loser bows (the player's own avatar too)
        this.foe.react(foeWon);
        if (foeWon !== null) r.actors.setEmote(this.ws.selfId, foeWon ? EMOTE_SAD : EMOTE_CHEER);
      },
      exitBattle: () => {
        this.foe.end();
        this.raidDen?.setHidden(false);
        void this.director.exitBattle();
        if (this.zone !== null) this.audio.setTheme(this.audio.themeFor(this.zone.id, this.zone.biome), 400);
      },
      setBattler: (ref, c, key) => {
        if (c === null || cat === null) {
          r.stage.setBattler(ref, null);
          return;
        }
        this.ensureSpecies(c.speciesId);
        r.stage.setBattler(ref, cat.descriptor(c.speciesId, key, c.variantKey, c.isAlpha, c.isShiny === true));
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
      playSfx: (id, at) => {
        if (at === null || p3 === undefined) {
          this.audio.play(id, null);
          return;
        }
        const bb = p3.stage.battler(at);
        if (bb === null) {
          this.audio.play(id, null);
          return;
        }
        this.audio.play(id, bb.feet(this.sfxVec));
      },
      setBattleHud: (m) => this.hudWriter.setBattle(m),
      setThreat: (on) => this.audio.setThreat(on),
    };
  }

  private readonly sfxVec = new Vector3();

  // ---- the loop ------------------------------------------------------------------------------------------------

  start(): void {
    if (this.running || this.disposed) return;
    this.running = true;
    this.last = -1;
    this.schedule();
  }

  stop(): void {
    this.running = false;
    if (this.raf !== 0) cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.hiddenTimer !== null) clearTimeout(this.hiddenTimer);
    this.hiddenTimer = null;
  }

  private schedule(): void {
    if (!this.running) return;
    if (typeof document !== 'undefined' && document.hidden) {
      this.hiddenTimer = setTimeout(() => {
        this.hiddenTimer = null;
        this.stepHidden(performance.now());
        this.schedule();
      }, HIDDEN_STEP_MS);
      return;
    }
    this.raf = requestAnimationFrame(this.onFrame);
  }

  private readonly onFrame = (now: number): void => {
    this.raf = 0;
    if (!this.running) return;
    this.tick(now);
    this.schedule();
  };

  private onVisibility(): void {
    if (!this.running) return;
    if (this.raf !== 0) cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.hiddenTimer !== null) clearTimeout(this.hiddenTimer);
    this.hiddenTimer = null;
    if (document.hidden) {
      if (useSettingsStore.getState().audio.muteWhenHidden) setTimeout(() => document.hidden && this.audio.suspend(), 2000);
    } else {
      this.audio.resume();
    }
    this.last = -1;
    this.schedule();
  }

  /** Hidden tab: simulation only (prediction, remotes, timeline, audio), no render. */
  private stepHidden(now: number): void {
    const dt = this.last < 0 ? HIDDEN_STEP_MS : Math.min(1000, now - this.last);
    this.last = now;
    let left = dt;
    while (left >= STEP_MS) {
      this.fixedStep();
      left -= STEP_MS;
    }
  }

  private fixedStep(): void {
    if (this.ready && this.zoneLoaded) this.stepWorldSystems();
    this.input.step(STEP_MS);
    // Phase A: pockets are reached only by warps / switch teleports / corrections; the floor test is allocation-free
    if (this.ready && this.zoneLoaded) this.director.updatePocket(this.input.pose.x, this.input.pose.z);
    this.remotes.step(STEP_MS, this.input.pose.x, this.input.pose.z);
    this.targets.step(this.input.pose.x, this.input.pose.z, this.worldBlocked());
    this.battle.player.step(STEP_MS);
    this.audio.step();
  }

  tick(now: number): void {
    if (!this.ready) return;
    const t0 = performance.now();
    const frameDt = this.last < 0 ? STEP_MS : Math.min(250, now - this.last);
    this.last = now;
    // (1)
    this.steerAutopilot();
    this.input.sample();
    // (2)
    this.acc += frameDt;
    let steps = 0;
    while (this.acc >= STEP_MS && steps < MAX_STEPS) {
      this.fixedStep();
      this.acc -= STEP_MS;
      steps++;
    }
    if (steps === MAX_STEPS && this.acc > STEP_MS) this.acc = STEP_MS;
    if (this.zoneLoaded) {
      const selfId = this.ws.selfId;
      const bf = this.director.battleFrame;
      if (bf !== null) {
        // the trainer stands behind their own creature, facing the foe; the foe actor behind theirs (a pvp foe's remote
        // interpolator wrote its server pose this step — both players are frozen in battle, so this only restages it)
        this.renderer.actors.setTransform(selfId, bf.x - bf.fx * TRAINER_BACK_M, bf.z - bf.fz * TRAINER_BACK_M, Math.atan2(bf.fx, bf.fz), false, false);
        this.foe.stage(bf.x, bf.z, bf.fx, bf.fz, TRAINER_BACK_M);
      } else {
        this.renderer.actors.setTransform(selfId, this.input.renderX, this.input.renderZ, this.input.pose.angle, this.input.moving, this.input.running || this.input.biking);
      }
    }
    this.nameplateLeft -= frameDt;
    if (this.nameplateLeft <= 0) {
      this.nameplateLeft = NAMEPLATE_MS;
      this.updateNameplates();
    }
    // the active pocket drops the walls facing the camera (only on a yaw change)
    if (this.director.pocket !== null) this.director.syncView(this.cameraYaw());
    // (3)
    this.hudWriter.flush();
    // (4)
    this.renderer.frame(frameDt);
    this.listen();
    const ms = performance.now() - t0;
    this.frames++;
    this.frameMsSum += ms;
    if (ms > this.frameMsMax) this.frameMsMax = ms;
    this.devLeft -= frameDt;
    if (this.devLeft <= 0) this.onSecond();
    if (!this.firstFrame && this.zoneLoaded) {
      this.firstFrame = true;
      this.awaitingZoneFrame = false;
      performance.mark('ewa:first-frame');
      setTimeout(() => {
        setWorldBoot({ ready: true, label: 'Ready', loadedBytes: null, totalBytes: null, compile: null });
        this.startPhase5();
      }, 0);
    } else if (this.awaitingZoneFrame && this.zoneLoaded) {
      this.awaitingZoneFrame = false;
      setTimeout(() => setWorldBoot({ ready: true, label: 'Ready', loadedBytes: null, totalBytes: null, compile: null }), 0);
    }
  }

  /** Listener = camera position / forward, once per rendered frame. */
  private listen(): void {
    const cam = this.renderer.camera.camera;
    const e = cam.matrixWorld.elements;
    this.audio.setListener(cam.position.x, cam.position.y, cam.position.z, -e[8]!, -e[9]!, -e[10]!);
  }

  private onSecond(): void {
    this.devLeft = DEV_MS;
    const fps = this.frames;
    const avg = fps > 0 ? this.frameMsSum / fps : 0;
    const st = this.renderer.stats();
    this.lastSecond = { fps, avgMs: avg, maxMs: this.frameMsMax, drawCalls: st.drawCalls, gpuMs: st.gpuMs, frameMs: st.frameMs, triangles: st.triangles, programs: st.programs };
    this.frames = 0;
    this.frameMsSum = 0;
    this.frameMsMax = 0;
    if (this.dev) {
      setTimeout(() => useUiStore.getState().setFps(fps), 0);
      if (this.devOn) {
        const b = useUiStore.getState().battle;
        this.hudWriter.setDev({ fps, drawCalls: st.drawCalls, gpuMs: st.gpuMs ?? 0, desyncs: b?.desyncs ?? 0, rubberBands: this.input.rubberBands });
      }
    }
  }

  // ---- dev / harness surface (window.__ewaWorld; never used by the game itself) ----------------------------------

  private autopilotTarget: { x: number; z: number; run: boolean } | null = null;

  /** Walks the local player toward (x, z) through the real prediction + server path; resolves on arrival / timeout. */
  walkTo(x: number, z: number, run = true, timeoutMs = 30000): Promise<boolean> {
    this.autopilotTarget = { x, z, run };
    const t0 = performance.now();
    return new Promise((resolve) => {
      const check = (): void => {
        const tgt = this.autopilotTarget;
        if (tgt === null || tgt.x !== x || tgt.z !== z) return resolve(false);
        const d = Math.hypot(this.input.pose.x - x, this.input.pose.z - z);
        if (d < 0.6) {
          this.autopilotTarget = null;
          this.input.override = null;
          return resolve(true);
        }
        if (performance.now() - t0 > timeoutMs) {
          this.autopilotTarget = null;
          this.input.override = null;
          return resolve(false);
        }
        setTimeout(check, 50);
      };
      check();
    });
  }

  private steerAutopilot(): void {
    const t = this.autopilotTarget;
    if (t === null) return;
    const dx = t.x - this.input.pose.x;
    const dz = t.z - this.input.pose.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.5) {
      this.input.override = { ax: 0, az: 0, running: false };
      return;
    }
    const k = d > 1.5 ? 1 : d / 1.5;
    const o = this.input.override ?? { ax: 0, az: 0, running: false };
    o.ax = (dx / d) * k;
    o.az = (dz / d) * k;
    o.running = t.run && d > 2;
    this.input.override = o;
  }

  /** A snapshot for the harness / console. */
  debug(): Record<string, unknown> {
    const room = this.room;
    const selfId = this.ws.selfId;
    const me = room?.state.players.get(selfId);
    const ui = useUiStore.getState();
    return {
      ready: this.ready, zone: this.director?.currentZone ?? null, zoneLoaded: this.zoneLoaded, firstFrame: this.firstFrame,
      pose: { x: this.input.pose.x, z: this.input.pose.z, angle: this.input.pose.angle }, placed: this.input.isPlaced,
      server: me === undefined ? null : { x: me.x, z: me.z, seq: me.seq, inBattle: me.inBattle }, lastSeq: this.input.lastSeq, pending: this.input.pendingCount,
      rubberBands: this.input.rubberBands, lastError: this.input.lastError,
      remotes: this.remotes.size, spawnedRemotes: this.remotes.spawnedCount, spawns: this.spawns?.size ?? 0,
      spawnList: room === null ? [] : [...room.state.spawns.values()].map((s) => ({ id: s.id, speciesId: s.speciesId, level: s.level, x: s.x, z: s.z, engagedBy: s.engagedBy })),
      target: this.targets.current === null ? null : { id: this.targets.current.id, kind: this.targets.current.kind },
      battle: ui.battle === null ? null : { phase: ui.battle.phase, turn: ui.battle.turnLabel, log: ui.battle.log.slice(-4).map((l) => l.text), desyncs: ui.battle.desyncs, result: ui.battle.result, raid: ui.battle.raid ?? null },
      raid: room === null ? null : raidInfoOf(room.state, selfId), raidDen: this.raidDen === null ? null : { id: this.raidDen.raidId, phase: this.raidDen.phase, visible: this.raidDen.visible, dressed: this.raidDen.dressed }, modal: ui.modal,
      dialogue: ui.dialogue, chat: this.hudWriter.current().chat.map((c) => `${c.name}: ${c.text}`), connection: ui.connection,
      hudSetCalls: this.hudWriter.setCalls, lastSecond: this.lastSecond, audio: this.audio.state,
      party: useSessionStore.getState().inventory?.party.map((c) => `${c.speciesId} L${c.level} ${c.hp}hp`) ?? [],
      box: useSessionStore.getState().inventory?.box.length ?? 0,
      toasts: useNotificationsStore.getState().toasts.map((t) => `${t.level}: ${t.text}`),
      items: useSessionStore.getState().inventory?.items ?? {},
      authoritativeTurn: ui.battle?.authoritative.turn ?? null,
    };
  }

  /** Last 1 s window (dev tooling / verification: `window.__ewaWorld.lastSecond`). */
  lastSecond: { fps: number; avgMs: number; maxMs: number; drawCalls: number; gpuMs: number | null; frameMs: number; triangles: number; programs: number } | null = null;

  /** ≤ 16 nearest players + NPCs, every 500 ms (the one allocating HUD write outside chat / party). */
  private updateNameplates(): void {
    const sx = this.input.pose.x;
    const sz = this.input.pose.z;
    const list: { id: string; name: string; guildTag: string; inBattle: boolean; d: number }[] = [];
    this.remotes.forEach((id, x, z, info, spawned) => {
      if (!spawned) return;
      list.push({ id, name: info.name, guildTag: info.guildTag, inBattle: info.inBattle, d: Math.hypot(x - sx, z - sz) });
    });
    const zone = this.zone;
    if (zone !== null) {
      const flags = this.flags();
      for (const n of zone.npcs) {
        const d = Math.hypot(n.x - sx, n.z - sz);
        if (d > 18) continue;
        if (n.when !== null && !flags.has(n.when)) continue;
        if (n.until !== null && flags.has(n.until)) continue;
        list.push({ id: n.id, name: n.name, guildTag: '', inBattle: false, d });
      }
    }
    for (const a of this.director.pocketActors) {
      const d = Math.hypot(a.x - sx, a.z - sz);
      if (d <= 18) list.push({ id: a.id, name: a.name, guildTag: '', inBattle: false, d });
    }
    list.sort((a, b) => a.d - b.d);
    const next: HudNameplates = list.slice(0, 16).map(({ id, name, guildTag, inBattle }) => ({ id, name, guildTag, inBattle }));
    const cur = this.hudWriter.current().nameplates;
    if (cur.length === next.length && cur.every((c, i) => c.id === next[i]!.id && c.name === next[i]!.name && c.inBattle === next[i]!.inBattle && c.guildTag === next[i]!.guildTag)) return;
    this.hudWriter.setNameplates(next);
  }

  /** §20.10.3 phase 5: hero-tier textures of the zone's hero surfaces, swapped in place, never awaited. */
  private startPhase5(): void {
    const handle = this.director.handle;
    if (handle === null) return;
    try {
      const ids = heroSurfaces() as readonly SurfaceId[];
      void this.renderer.materials.preloadHero(ids).catch(() => undefined);
    } catch (_e) {
      // no hero table
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    for (const f of this.offs) f();
    this.offs.length = 0;
    this.detachRoom();
    this.capture.dispose();
    this.battle.reset();
    setBattleActions(null);
    this.audio.dispose();
    if (this.ready) {
      this.director.unloadZone();
      this.renderer.dispose();
    }
    this.ready = false;
    setWorldBoot({ ready: false, label: 'Starting the renderer', loadedBytes: null, totalBytes: null, error: null });
    const w = window as unknown as { __ewaWorld?: World };
    if (w.__ewaWorld === this) delete w.__ewaWorld;
  }
}

/** The factory `worldHost.setWorldFactory` receives (GameCanvas imports this module lazily). */
export async function createWorld3D(canvas: HTMLCanvasElement): Promise<World3D> {
  const w = new World(canvas);
  try {
    await w.boot();
  } catch (e) {
    w.dispose();
    throw e;
  }
  return w;
}
