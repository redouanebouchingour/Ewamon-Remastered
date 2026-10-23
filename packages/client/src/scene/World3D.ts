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
 *
 * Creature textures (client IMPLEMENTATION-NOTES "Creature textures"): every creature atlas has an owner that releases
 * it — the zone holds its static set and the party's static atlases for its life, every view (spawn, legendary static,
 * raid den, battle slot, evolution) leases the ONE side it shows with that side's flipbook, and `CreatureTextures`
 * releases what nothing shows after a grace period, under a creature-texture budget.
 *
 * Arena PvP (client IMPLEMENTATION-NOTES "Arena PvP"): while the session is in an arena room (`WorldSession.onArena`)
 * the zone is unloaded, render's stadium backdrop (`arenaBackdrop.ts`, sky only without it) stands in as the zone root,
 * the local trainer stands at the near trainer slot of a ring at the origin and the normal battle view plays the
 * arena's battle there (`battleStart` x = z = 0); the opponent trainer is a temporary stand-in with their look. Back
 * to the world, the backdrop goes and the zone room's `enterZone` loads the zone under the boot overlay as a handover.
 */
import { getStateCallbacks } from '@colyseus/sdk';
import { Group, Vector3 } from 'three/webgpu';
import { BIKE_ITEM, BODIES, HOLLOWED_FLAG, POSTGAME_FLAG, SHADOW_MAX, harvestStateFor, interiorNpcs, interiorTrainers, obstacleRefusal, obstacleRefusalText, shadowNotice, zone as zoneDef } from '@ewa/content';
import type { BadgeId, ZoneDef, ZoneId } from '@ewa/content';
import type { CreatureInstance } from '@ewa/core';
import { BREAKDANCE_MS, FISH_REACH_M } from '@ewa/protocol';
import type { PlayerState, ServerMessage, SpawnState, ZoneState } from '@ewa/protocol';
import { ACTOR_POOL_SIZE, createRenderer, edgePoint, headingYaw, heroSurfaces, part3Of } from '@ewa/render';
import type { CompileProgress, Renderer, SurfaceId, TypeName, VfxId, WeatherKind, ZoneHandle } from '@ewa/render';
import { createAudioDirector } from '../audio/AudioDirector';
import type { AudioDirector } from '../audio/AudioDirector';
import { loadAudioManifest, validateAudioManifest } from '../audio/manifest';
import { setEvolutionPlayer } from '../app/evolution';
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
import { battleSpriteIds, content, maxHpOf, species as speciesDef } from '../data/content';
import { apiFetch } from '../net/api';
import { getWorldSession } from '../net/WorldSession';
import type { WorldSession, ZoneRoom } from '../net/WorldSession';
import { onEffectiveSettings, getEffectiveSettings } from '../state/applySettings';
import { useArenaStore } from '../state/arena';
import { toast, useNotificationsStore } from '../state/notifications';
import { applyInventoryDelta, partyCanBattle, toInventoryDelta, useSessionStore } from '../state/session';
import { useQuestTracking } from '../state/questTracking';
import { useRealWeatherStore } from '../state/realWeather';
import { factionSkyFor } from './factionSky';
import { FRAME_CAP_UNLIMITED, useSettingsStore } from '../state/settings';
import { setFishingActions, useFishingStore } from '../state/fishing';
import { setStrikeHook } from '../state/npcFx';
import { useViewStore } from '../state/view';
import { setDanceAction } from '../state/dance';
import { noteTutorialEvent } from '../state/tutorial';
import { useUiStore } from '../state/ui';
import { FONT, TYPE_COLORS } from '../ui/tokens';
import { createStepCollider } from './collider';
import type { StepCollider } from './collider';
import { beatDialogue, gymPlan, leaguePostDialogue, leagueSpeaker, npcPlan, rematchOfBattle, storyFlagSet, trainerPlan } from './dialogue';
import { questHintFor } from './questHint';
import type { DialogueLines, InteractPlan } from './dialogue';
import { HudWriter, partyStrip } from './HudWriter';
import type { HudNameplates } from './HudWriter';
import { EvolutionDirector } from './EvolutionDirector';
import { createInputCapture } from './input';
import type { InputCapture } from './input';
import { InteractionTargets, PLAYER_RANGE, makeInteractable } from './interaction';
import type { Interactable } from './interaction';
import { FishingController } from './fishing';
import { pocketActorMax } from './interiors';
import { LocalPlayerController } from './LocalPlayerController';
import { RemoteInterpolator } from './RemoteInterpolator';
import { EMOTE_CHEER, EMOTE_SAD, FoeActor, foeSpecOf } from './foeActor';
import { createSceneDirector, trainerPose } from './SceneDirector';
import { TrainerApproach } from './trainerApproach';
import { NpcStrike, PlayerStrike } from './npcStrike';
import type { StrikeKind } from './npcStrike';
import type { TrainerPose } from './SceneDirector';
import type { SceneDirector } from './SceneDirector';
import { SpawnViews } from './SpawnViews';
import { RaidDen, raidTargetId } from './RaidViews';
import { raidInfoOf } from '../battle/raid';
import { LegendaryViews, STATIC_FLIPBOOK_NEAR_M, staticTargetId, visibleStatics } from './LegendaryViews';
import { createSpriteCatalog, loadCreatureManifest } from './spriteCatalog';
import { ARENA_FALLBACK, mountArenaBackdrop } from './arenaBackdrop';
import type { MountedBackdrop } from './arenaBackdrop';
import { DeviceRecovery } from './deviceRecovery';
import { awaitArrival } from './arrival';
import { fetchIntoCache, neighbourPrefetchPlan, runPrefetch } from './prefetch';
import type { PrefetchToken } from './prefetch';
import type { SpriteCatalog } from './spriteCatalog';
import { BattleSprites, CreatureTextures, NO_LEASE, creatureBudget } from './creatureTextures';
import type { AtlasHold, CreatureSide, SpritePart, SpriteLease } from './creatureTextures';
import type { WorldInstance } from './worldHost';

/** NPC talk's kick: a short run away from the NPC (~1.5 m at run speed), through the real prediction and wire. */
const KICK_SHOVE_MS = 260;

/** First-person view: radians of turn per CSS px of left-button drag, the starting pitch and the pitch clamp. */
const LOOK_RAD_PER_PX = 0.0042;
const FP_START_PITCH = -0.12;
const FP_PITCH_MAX = 1.35;

/** The breakdance: emote 7 and how far (m) from the dancer the villagers hop along. */
const BREAKDANCE_EMOTE = 7;
const DANCE_ALONG_M = 30;

const MAX_STEPS = 4;
const NO_ITEMS: Readonly<Record<string, number>> = Object.freeze({});
const HIDDEN_STEP_MS = 250;
/**
 * Handover (render `prepareZone`): within this distance of a link's edge point the linked zone is built and compiled
 * off the scene, so the crossing adopts it instead of building and compiling it then. Checked every 30 fixed steps.
 */
const PREPARE_EDGE_M = 48;
const OPPOSITE_DIR = { n: 's', s: 'n', e: 'w', w: 'e' } as const;
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
  private readonly trainerAt: TrainerPose = { x: 0, z: 0, angle: 0 };
  /** trainer sight: the spotting trainer's "!" and walk-up (created with the renderer), and the no-battle fallback */
  private approach: TrainerApproach | null = null;
  /** NPC talk: an NPC's slap / kick lunge (`scene/npcStrike.ts`) */
  private strikeFx: NpcStrike | null = null;
  /** NPC talk: the player's slap / kick at the NPC (H / K in the dialogue) */
  private playerStrikeFx: PlayerStrike | null = null;
  /** First-person view (`state/view.ts`): on this frame, and the look (diorama yaw convention, pitch in radians) */
  private fpOn = false;
  private readonly fpView = { yaw: 0, pitch: FP_START_PITCH };
  private approachTimer: ReturnType<typeof setTimeout> | null = null;
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
  /** rAF time of the last drawn frame, snapped to the frame-cap grid (−1: draw the next one). */
  private lastDrawn = -1;
  /** graphics.frameCap unlimited: frames are posted through a MessageChannel instead of rAF (see `scheduleUnlimited`) */
  private readonly unlimitedChannel = typeof MessageChannel !== 'undefined' ? new MessageChannel() : null;
  /** bumped whenever the loop is stopped or re-scheduled, so a frame posted before it is dropped */
  private loopGen = 0;
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
    playerLook: (id) => this.arenaFoeLook(id),
  });
  /** Arena PvP: the session is in an arena (the zone is unloaded; the stadium stands in) */
  private inArena = false;
  private backdrop: MountedBackdrop | null = null;
  /** the arena ring's frame (origin, facing the camera heading at entry): where the trainers stand before a battle */
  private readonly arenaFrame = { x: 0, z: 0, fx: 0, fz: -1 };
  /** dev: the arena scene's last events (debug().arena.trace) */
  private readonly arenaTrace: string[] = [];
  private traceArena(e: string): void {
    if (!this.dev) return;
    this.arenaTrace.push(`${Math.round(performance.now())} ${e}`);
    if (this.arenaTrace.length > 30) this.arenaTrace.shift();
  }
  /** the prediction collider of the loaded zone (gates are its removable blockers) */
  private stepCollider: StepCollider | null = null;
  private devLeft = 0;
  private devOn = false;
  private frames = 0;
  private frameMsSum = 0;
  private frameMsMax = 0;
  private readonly dev = devBuild();
  /** creature atlas residency (built at boot with the sprite pool) */
  private textures: CreatureTextures | null = null;
  /** the loaded zone's static set + the party's static atlases (§20.10.3 phase 3), held for the zone's life */
  private zoneHold: AtlasHold | null = null;
  /** the battle's team atlases and the side each stage slot shows */
  private readonly battleSprites = new BattleSprites(() => this.textures);
  private readonly selfTmp = { x: 0, z: 0 };
  private spectatorArenas = new Map<string, { x: number; z: number }>();
  private zone: ZoneDef | null = null;
  /** the beat whose lines the player already read before its interact was sent (its `storyBeat start` is no news) */
  private readBeat: string | null = null;
  /** §20.5.6 the evolution sequence (render's `stage.evolve` + the input lock), built at boot */
  private evolution: EvolutionDirector | null = null;
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
      rotate: (dir) => this.ready && !this.fpOn && this.renderer.camera.setHeading(((this.headingIndex() + dir + 4) & 3) as 0 | 1 | 2 | 3),
      zoom: (dir) => this.ready && !this.fpOn && this.renderer.camera.setZoomStop(Math.max(0, Math.min(2, this.zoomStop() + dir)) as 0 | 1 | 2),
      look: (dx, dy) => this.look(dx, dy),
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
    setDanceAction(() => this.dance());
    setStrikeHook((kind, npcId, by, onHit) => (by === 'player' ? this.playerStrike(kind, npcId, onHit) : this.npcStrike(kind, npcId, onHit)));
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
    const manifestP = loadCreatureManifest();
    // let the overlay paint its label before the synchronous shader warm-up blocks the main thread
    setWorldBoot({ label: 'Compiling shaders (first start can take ~20 s on integrated GPUs)' });
    await nextFrame();
    await nextFrame();
    try {
      if (!(await this.bootRenderer(manifestP, true))) return;
    } catch (e) {
      setWorldBoot({ error: e instanceof Error ? e.message : String(e) });
      throw e;
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
    this.ready = true;
    // a room joined while the renderer compiled (an arena: a reload mid arena battle rejoined it)
    if (this.inArena) this.enterArenaScene();
    else if (this.room !== null && this.roomZone !== null) void this.enterZone(this.room, this.roomZone);
    else setWorldBoot({ label: 'Joining the world' });
  }

  /**
   * The renderer and everything bound to it: the SceneDirector, the HUD binding, size / settings observers
   * (`rendererOffs`), the client creature group and its views. Run at boot and again after a lost GPU device (Phase E6,
   * `deviceRecovery.ts`). Resolves false when the world was disposed while the renderer compiled; throws when
   * `createRenderer` rejects. `manifest` null = keep the catalog already read.
   */
  private async bootRenderer(manifest: ReturnType<typeof loadCreatureManifest> | null, attachBattle: boolean): Promise<boolean> {
    const eff = getEffectiveSettings();
    const r = await createRenderer({
      canvas: this.canvas, pixelRatio: this.pixelRatio(), effects: eff.effects, transcoderPath: '/basis/', clock: () => performance.now(),
      quality: useSettingsStore.getState().graphics.quality,
      onCompileProgress: (p) => this.onCompileProgress(p),
      onDeviceLost: (info) => void this.recovery.onLost(info),
    });
    if (this.disposed) {
      r.dispose();
      return false;
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
      setInputEnabled: (on) => this.input.setEnabled(on && !this.inArena),
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
    this.rendererOffs.push(
      onEffectiveSettings((s) => {
        // first person: the diorama's tilt-shift DOF would blur everything past a few metres
        r.setEffects(this.fpOn ? { ...s.effects, dof: false } : s.effects);
        r.hud.setScale(s.uiScale);
        r.stage.setTypeColors(TYPE_COLORS[s.colorblind === 'none' ? 'default' : s.colorblind]);
      }),
    );
    if (manifest !== null) {
      const cat = await manifest;
      if (cat !== null) this.catalog = createSpriteCatalog(cat, speciesDef);
    }
    const p3 = part3Of(r);
    const group = new Group();
    group.name = this.clientGroupName;
    r.scene.add(group);
    if (p3 !== undefined) {
      this.textures = new CreatureTextures({
        catalog: () => this.catalog,
        pool: () => (this.disposed ? null : p3.sprites),
        // what the §50.2.2 cap leaves once the zone's materials, the render targets and the rest are counted (live)
        budgetBytes: () => creatureBudget(r.stats().textureBytes, p3.sprites.stats().bytes),
        warn: (m) => console.warn(m),
      });
      this.spawns = new SpawnViews({
        parent: group,
        acquire: (d) => p3.sprites.acquire(d),
        descriptor: (sp, key, v, a, s) => this.catalog?.descriptor(sp, key, v, a, s) ?? null,
        leaseSprites: (sp, side, part) => this.leaseSprites(sp, side, part),
        height: (x, z) => this.director.handle?.collider.sample(x, z) ?? 0,
        targets: this.targets,
        interactKey: () => this.keyLabel('interact'),
      });
      this.legendaries = new LegendaryViews({
        parent: group,
        acquire: (d) => p3.sprites.acquire(d),
        descriptor: (sp, key) => this.catalog?.descriptor(sp, key) ?? null,
        leaseSprites: (sp, side, part) => this.leaseSprites(sp, side, part),
        height: (x, z) => this.director.handle?.collider.sample(x, z) ?? 0,
        targets: this.targets,
        interactKey: () => this.keyLabel('interact'),
      });
      // Phase C1: the boss in the alpha treatment (glow rim) marks the den
      this.raidDen = new RaidDen({
        parent: group,
        acquire: (d) => p3.sprites.acquire(d),
        descriptor: (sp, key) => this.catalog?.descriptor(sp, key, 'normal', true) ?? null,
        leaseSprites: (sp, side, part) => this.leaseSprites(sp, side, part),
        height: (x, z) => this.director.handle?.collider.sample(x, z) ?? 0,
        targets: this.targets,
        interactKey: () => this.keyLabel('interact'),
        dress: (x, z) => p3.stage.dressSpectator(x, z),
        undress: (x, z) => p3.stage.undressSpectator(x, z),
      });
      // §20.5.6: every evolve path plays render's evolution sequence through this player (app/evolution.ts); rebuilt with
      // the renderer after a lost device (E6)
      const evoDirector = new EvolutionDirector({
        stage: p3.stage,
        descriptor: (sp, key, v, a) => this.catalog?.descriptor(sp, key, v, a) ?? null,
        leaseSprites: (sp, side, part) => this.leaseSprites(sp, side, part),
        canPlay: () => this.zoneLoaded && !this.disposed && useUiStore.getState().battle === null && !this.director.inBattle,
        position: () => ({ x: this.input.renderX, z: this.input.renderZ }),
        selfId: () => this.ws.selfId,
        reduced: () => getEffectiveSettings().reduced,
        setInputEnabled: (on) => this.input.setEnabled(on),
        inputAfter: () => useUiStore.getState().battle === null && !this.director.inBattle,
        setHudVisible: (on) => this.hudWriter.setVisible(on),
        hudVisible: () => useUiStore.getState().hudVisible,
        target: window,
      });
      this.evolution = evoDirector;
      // the evolve prompt warms the new form's front (it idles until the sequence leases it, or the grace period ends)
      setEvolutionPlayer({ play: (req, cb) => evoDirector.play(req, cb), preload: (sp) => this.textures?.prefetch(sp, 'front') });
    }
    if (attachBattle) this.battle.attach(this.battleView());
    return true;
  }

  // ---- Phase E6: a lost GPU device -----------------------------------------------------------------------------

  /** Observers / subscriptions bound to the current renderer (rebuilt with it). */
  private rendererOffs: (() => void)[] = [];

  /** Recovery order + retry policy (`deviceRecovery.ts`); these hooks are the World's side of it. */
  private readonly recovery = new DeviceRecovery({
    teardown: () => this.teardownRenderer(),
    rebuild: async () => {
      if (this.disposed) return false;
      const ok = await this.bootRenderer(null, false);
      if (ok) this.ready = true;
      return ok;
    },
    reload: async () => {
      if (this.inArena) {
        // the stadium on the new renderer; an open battle is re-dressed by `battle.attach`
        this.backdrop = null;
        this.enterArenaScene();
        return;
      }
      const room = this.room;
      const zoneId = this.roomZone;
      if (room === null || zoneId === null) {
        setWorldBoot({ label: 'Joining the world' });
        return;
      }
      // remotes, spawns and statics are re-created against the new renderer from the room's current state (the socket
      // and the stores are untouched); the zone loads where the server has the player now; an open battle is re-dressed
      // by `battle.attach` at the end of enterZone
      this.detachRoom();
      this.attachRoom(room);
      await this.enterZone(room, zoneId, `Restoring ${zoneDef(zoneId).name}`);
    },
    overlay: (label, error) => {
      if (error !== undefined) setWorldBoot({ ready: false, error });
      else setWorldBoot({ ready: false, label: label ?? 'Restoring the renderer', loadedBytes: null, totalBytes: null, compile: null, background: null, error: null });
    },
    wait: (ms) => new Promise((res) => setTimeout(res, ms)),
    now: () => performance.now(),
    log: (m) => console.warn(`[world] ${m}`),
  });

  /**
   * E6: drops the dead renderer and everything bound to it. Every call into three is guarded (a dispose on a dead device
   * may throw); the session, the battle controller, input and audio stay.
   */
  private teardownRenderer(): void {
    const hadRenderer = this.ready;
    this.evolution?.cancel();
    this.evolution = null;
    setEvolutionPlayer(null);
    this.ready = false;
    this.zoneLoaded = false;
    for (const f of this.rendererOffs) f();
    this.rendererOffs = [];
    this.stepCollider = null;
    this.input.setCollider(null);
    this.spawns?.clear();
    this.legendaries?.clear();
    this.raidDen?.clear();
    this.spawns = null;
    this.legendaries = null;
    this.raidDen = null;
    // the creature atlases lived on the dead sprite pool: the residency goes with it (the rebuild makes a new one and
    // enterZone / battle.attach take their holds again)
    const textures = this.textures;
    this.textures = null;
    this.battleSprites.end();
    this.zoneHold = null;
    try {
      textures?.dispose();
    } catch (e) {
      console.warn('[world] creature texture release on a lost device', e);
    }
    if (!hadRenderer) return;
    try {
      this.director.unloadZone();
    } catch (e) {
      console.warn('[world] zone unload on a lost device', e);
    }
    try {
      this.renderer.dispose();
    } catch (e) {
      console.warn('[world] renderer dispose on a lost device', e);
    }
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
    this.rendererOffs.push(onBattlePanelTop(() => this.applyBattleInset()));
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(apply);
      ro.observe(this.canvas);
      this.rendererOffs.push(() => ro.disconnect());
    }
    this.rendererOffs.push(
      useSettingsStore.subscribe(
        (s) => s.graphics.renderScale,
        () => this.renderer.setPixelRatio(this.pixelRatio()),
      ),
      useSettingsStore.subscribe(
        (s) => s.graphics.quality,
        (q) => this.renderer.setQuality?.(q),
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
    // arena PvP: the stadium while the session is in an arena room
    this.offs.push(ws.onArena((_room, inArena) => this.onArenaChange(inArena)));
    if (ws.kind === 'arena') this.inArena = true;
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
          this.hudWriter.setQuestHint(this.inArena ? null : questHint());
          if (this.ready && !this.inArena) this.director.refreshFlags(this.flags());
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
    const flags = storyFlagSet(p?.flags ?? [], (p?.badges ?? []) as readonly BadgeId[]);
    // honor shapes the world: in a hollowed zone its people speak of it (scene/dialogue.ts)
    return (this.room?.state.shadow ?? 0) >= SHADOW_MAX ? new Set([...flags, HOLLOWED_FLAG]) : flags;
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
      d.push(
        $(p).listen('emote', (v: number) => {
          if (!this.ready) return;
          this.renderer.actors.setEmote(key, Math.max(0, Math.min(BREAKDANCE_EMOTE, v)) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7);
          if (v === BREAKDANCE_EMOTE) this.danceAlong(p.x, p.z);
        }),
      );
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
        // weather from real life: the player's city's weather stands in for the zone's
        if (this.ready) this.director.setWeather(useRealWeatherStore.getState().kind ?? (w as WeatherKind));
      }, true),
    );
    // honor shapes the world: the zone's shadow darkens it; the player hears when it falls on the zone or lifts
    let shadowWas = 0;
    d.push(
      $(state).listen('shadow', (n: number) => {
        if (this.ready) this.director.setShadow(n);
        const zoneId = this.roomZone;
        const text = zoneId === null ? null : shadowNotice(zoneDef(zoneId).name, n, shadowWas);
        shadowWas = n;
        if (text !== null) toast('info', text);
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
      // the den leases the boss's front (the raid battle's foe shows the same side)
      this.raidDen?.sync(r === null || id === '' ? null : { id, bossSpecies: r.bossSpecies, bossLevel: r.bossLevel, phase, x: r.x, z: r.z });
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

  /** A room (join / handover) is live and the renderer exists: load its zone (`label`: the overlay text, E6 recovery). */
  private async enterZone(room: ZoneRoom, zoneId: ZoneId, label?: string): Promise<void> {
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
      setWorldBoot({ ready: false, label: label ?? `Travelling to ${z.name}`, loadedBytes: null, totalBytes: null, compile: null, background: null });
    }
    // where the player will stand: render compiles what the first view there draws before loadZone resolves (T4). A room
    // joined with the renderer already up (back from the arena, a reconnect) has no state patch yet: wait for the one
    // that carries the player, or the first view is predicted at the zone's spawn and the real one stays gated (arrival.ts)
    const focus = await awaitArrival(room, this.ws.selfId, { stillCurrent: () => this.room === room && !this.disposed });
    if (this.room !== room || this.disposed) return;
    // the statics' flipbooks are held only until the zone's LegendaryViews lease them (sync inside loadZone)
    let preload: SpriteLease = NO_LEASE;
    try {
      preload = await this.bindZoneAtlases(zoneId, flags, focus);
      // the statics near the arrival point play their flipbooks from the first frame; the far ones stand still (no
      // arrival point: every static counts as near until the first nameplate pass)
      this.legendaries?.setViewer(focus?.x ?? Number.NaN, focus?.z ?? Number.NaN);
      setWorldBoot({ label: `Building ${z.name}`, loadedBytes: null, totalBytes: null });
      await nextFrame();
      this.zoneLoaded = false;
      await this.director.loadZone(zoneId, harvestStateFor(zoneId, flags), focus);
    } catch (e) {
      console.error('zone load failed', e);
      toast('danger', `Could not build ${z.name}.`);
      return;
    } finally {
      preload.release();
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
    this.director.setWeather(useRealWeatherStore.getState().kind ?? (room.state.weather as WeatherKind));
    this.director.setShadow(room.state.shadow);
    // Majin vs Tenjin seasons: the last season's winners hold the sky over Solenne
    const skyZone = this.roomZone;
    void factionSkyFor(skyZone).then((mood) => {
      if (this.roomZone === skyZone) this.director.setSkyMood(mood);
    });
    this.input.setEnabled(useUiStore.getState().battle === null);
    this.battle.attach(this.battleView());
    // Phase C1: a raid already open in this room (or opened while the zone built)
    this.syncRaid(room.state, true);
  }

  private prepareSteps = 0;
  private preparedFor: ZoneId | null = null;

  /** Handover: prepares the linked zone whose edge point the player is within `PREPARE_EDGE_M` of (one at a time). */
  private prepareNearEdge(): void {
    if (++this.prepareSteps < 30) return;
    this.prepareSteps = 0;
    const z = this.zone;
    if (z === null || this.director.inBattle) return;
    const { x, z: pz } = this.input.pose;
    for (const d of ['n', 'e', 's', 'w'] as const) {
      const to = z.links[d];
      if (to === undefined) continue;
      const [ex, ez] = edgePoint(z.kind, d);
      if (Math.hypot(x - ex, pz - ez) > PREPARE_EDGE_M) continue;
      if (this.preparedFor === to) return;
      this.preparedFor = to;
      const next = zoneDef(to);
      const back = OPPOSITE_DIR[d];
      const [ax, az] = edgePoint(next.kind, back);
      const k = 8;   // the arrival stands ~8 m inside the destination's edge (spine §4.6)
      const arrival = { x: ax + (back === 'e' ? -k : back === 'w' ? k : 0), z: az + (back === 's' ? -k : back === 'n' ? k : 0) };
      void this.director.prepareZone(to, harvestStateFor(to, this.flags()), arrival).catch(() => undefined);
      return;
    }
  }

  private onZoneChanged(h: ZoneHandle | null, z: ZoneDef | null): void {
    this.preparedFor = null;
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

  /**
   * §20.10.3 phase 3: the zone's static set + the party's static atlases, held for the zone's life (the previous zone's
   * hold idles as this one is taken: what both zones show never leaves the GPU), and the front flipbooks of the
   * legendary statics standing for these flags, so they play from the first frame — returned as a short hold the
   * caller drops once the zone's statics lease them. Parallel, real byte progress from the manifest sizes.
   */
  private async bindZoneAtlases(zoneId: ZoneId, flags: ReadonlySet<string>, focus: { readonly x: number; readonly z: number } | null): Promise<SpriteLease> {
    const cat = this.catalog;
    const tex = this.textures;
    if (cat === null || tex === null) return NO_LEASE;
    const party = (useSessionStore.getState().inventory?.party ?? []).map((c) => c.speciesId);
    const statics = [...cat.zoneAtlases(zoneId), ...tex.staticAtlasesOf(party)];
    const near = (s: { readonly x: number; readonly z: number }): boolean => focus === null || Math.hypot(s.x - focus.x, s.z - focus.z) <= STATIC_FLIPBOOK_NEAR_M;
    const flipbooks = visibleStatics(zoneId, flags).filter(near).flatMap((s) => tex.sideAtlases(s.species, 'front'));
    const fresh = [...statics, ...flipbooks].filter((id) => !tex.isBound(id));
    const total = cat.bytesOf(fresh);
    let loaded = 0;
    const progress = (id: string): void => {
      if (!fresh.includes(id)) return;
      loaded += cat.bytesOf([id]);
      if (!this.firstFrame) setWorldBoot({ label: 'Loading creature sprites', loadedBytes: loaded, totalBytes: total > 0 ? total : null });
    };
    if (fresh.length > 0) setWorldBoot({ label: 'Loading creature sprites', loadedBytes: 0, totalBytes: total > 0 ? total : null });
    const zone = tex.hold(statics, progress, this.zoneHold);
    this.zoneHold = zone;
    const preload = tex.hold(flipbooks, progress);
    await Promise.all([zone.ready, preload.ready]);
    return preload;
  }

  /** A view's lease on the side it shows (`CreatureTextures.show`); nothing before the sprite pool exists. */
  private leaseSprites(speciesId: string, side: CreatureSide, part?: SpritePart): SpriteLease {
    return this.textures?.show(speciesId, side, part) ?? NO_LEASE;
  }

  // ---- arena PvP ----------------------------------------------------------------------------------------------------

  private onArenaChange(inArena: boolean): void {
    if (inArena && !this.inArena) {
      this.inArena = true;
      if (this.ready) this.enterArenaScene();
    } else if (!inArena && this.inArena) {
      this.leaveArenaScene();
    }
  }

  /**
   * Into the stadium: the zone (statics, spawns, remotes, its atlas hold) is unloaded, the backdrop registered as the
   * zone root, the trainer placed at the near slot of the ring at the origin; the boot overlay covers the switch and
   * lifts on the next rendered frame (the tick sees `zoneLoaded`). A battle that arrived first is dressed by `attach`.
   */
  private enterArenaScene(): void {
    this.traceArena(`enterArenaScene battle=${this.battle.active}`);
    const r = this.renderer;
    this.evolution?.cancel();
    this.fishing.cancel();
    this.autopilotTarget = null;
    this.input.override = null;
    if (this.input.biking) this.input.setBike(false);
    this.input.setEnabled(false);
    if (this.firstFrame) {
      this.awaitingZoneFrame = true;
      setWorldBoot({ ready: false, label: 'Entering the arena', loadedBytes: null, totalBytes: null, compile: null, background: null });
    }
    this.zoneLoaded = false;
    if (this.prefetchToken !== null) this.prefetchToken.cancelled = true;
    this.director.unloadZone();
    this.renderer.dropPrepared?.();
    this.preparedFor = null;
    this.zone = null;
    this.zoneHold?.release();
    this.zoneHold = null;
    this.remotes.clear();
    this.spawns?.clear();
    this.raidDen?.clear();
    this.backdrop?.dispose();
    this.backdrop = mountArenaBackdrop(r);
    // the ring faces the camera's current heading (the battle's push-in keeps it: no zone collider to avoid)
    const fy = headingYaw(this.headingIndex());
    this.arenaFrame.fx = -Math.sin(fy);
    this.arenaFrame.fz = -Math.cos(fy);
    const tod = this.backdrop?.timeOfDay ?? ARENA_FALLBACK.timeOfDay;
    this.director.setTimeOfDay(tod);
    this.hudWriter.setTimeOfDay(tod);
    this.director.setWeather('none');
    const selfId = this.ws.selfId;
    const profile = useSessionStore.getState().profile;
    r.actors.spawn(selfId, { look: lookOf(profile?.body ?? 'ranger_m'), name: profile?.username ?? '', guildTag: '', isLocal: true });
    const me = trainerPose(this.arenaFrame, 0, this.trainerAt);
    r.actors.setTransform(selfId, me.x, me.z, me.angle, false, false);
    r.camera.follow(selfId);
    this.hudWriter.setQuestHint(null);
    this.hudWriter.setNameplates([]);
    this.audio.setTheme(this.arenaTheme(), 400);
    this.zoneLoaded = true;
    this.battle.attach(this.battleView());
    // a reload's rejoin: the server's battleResync can land before this scene existed (the router saw its id)
    const a = useArenaStore.getState();
    if (!this.battle.active && a.battleId !== null && a.match?.phase === 'fighting') this.ws.send('battleResync', { battleId: a.battleId });
  }

  /** Out of the stadium: the backdrop goes; the zone room that follows loads the zone (`enterZone`, overlay up). */
  private leaveArenaScene(): void {
    this.traceArena('leaveArenaScene');
    this.inArena = false;
    // a result card still up (the arena closed, a cancelled match): the battle view goes with the arena
    if (this.battle.active) this.battle.reset();
    this.foe.end();
    this.backdrop?.dispose();
    this.backdrop = null;
    this.zoneLoaded = false;
    if (this.firstFrame) {
      this.awaitingZoneFrame = true;
      setWorldBoot({ ready: false, label: 'Returning to the world', loadedBytes: null, totalBytes: null, compile: null, background: null });
    }
    this.hudWriter.setQuestHint(questHint());
  }

  /** The opponent's stand-in in an arena: their body from GET /players/:name (the generic trainer until it arrives). */
  private arenaFoeLook(id: string): { readonly look: string; readonly name: string } | null {
    if (!this.inArena) return null;
    const a = useArenaStore.getState();
    const seat = a.match?.players.find((p) => p.playerId === id);
    return { look: lookOf(a.bodies[id] ?? 'ranger_m'), name: seat?.name ?? 'Opponent' };
  }

  /** The stadium's music between battles: the elite theme for Ranked and the Weekly Cup, the gym theme otherwise. */
  private arenaTheme(): string {
    const kind = useArenaStore.getState().match?.kind ?? null;
    return kind === 'ranked' || kind === 'cup' ? 'elite' : 'gym';
  }

  // ---- messages -----------------------------------------------------------------------------------------------

  private onMessage(m: ServerMessage): void {
    switch (m.type) {
      case 'battleStart':
        this.input.setEnabled(false);
        this.fishing.cancel();
        this.endApproach(false);
        // both teams' static atlases for the battle's life (a switch-in never waits); flipbooks come per shown side
        this.battleSprites.begin(m.state.sides.flatMap((s) => s.party.flatMap((b) => battleSpriteIds(b.creature.speciesId))));
        useUiStore.getState().setDialogue(null);
        this.battle.onBattleStart(m);
        return;
      case 'battleEvents':
        this.battle.onBattleEvents(m);
        return;
      case 'battleResync':
        this.input.setEnabled(false);
        this.battleSprites.begin(m.state.sides.flatMap((s) => s.party.flatMap((b) => battleSpriteIds(b.creature.speciesId))));
        // Phase C1: a raid's fight starts with this resync — the lobby yields to the battle
        if (useUiStore.getState().modal === 'raidLobby') useUiStore.getState().closeModal();
        this.battle.onBattleResync(m);
        return;
      case 'battleEnd': {
        // a won gym battle: the leader's `post` lines once the result card is dismissed (then the evolve / learn prompts)
        const b = useUiStore.getState().battle;
        if (b !== null && b.battleId === m.battleId && b.format === 'league' && 'winner' in m.outcome && m.outcome.winner === b.seat) {
          // Phase D14: a won rematch says its own `post` lines
          const post = leaguePostDialogue(b.authoritative.sides[b.seat === 0 ? 1 : 0].trainerId, rematchOfBattle(b.authoritative, b.seat));
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
      case 'trainerSpotted':
        this.onTrainerSpotted(m.trainerId);
        return;
      case 'realWeather':
        // weather from real life (messageRouter keeps the store): null goes back to the zone's weather
        if (this.ready && this.room !== null) this.director.setWeather(m.kind ?? (this.room.state.weather as WeatherKind));
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

  // ---- first-person view -----------------------------------------------------------------------------------------

  /**
   * Per frame: first person is on when the player chose it (`state/view.ts`) and the world is free-roaming (no
   * battle, arena, evolution). Entering looks the way the diorama faced; the lens and the DOF follow the change.
   */
  private syncFirstPerson(): void {
    const want =
      useViewStore.getState().firstPerson && this.director.battleFrame === null && !this.inArena && this.evolution?.active !== true;
    if (want !== this.fpOn) {
      if (want) {
        const rig = this.renderer.camera as unknown as { dioramaYaw?: number };
        this.fpView.yaw = rig.dioramaYaw ?? 0;
        this.fpView.pitch = FP_START_PITCH;
      }
      this.fpOn = want;
      // the camera sits inside the chibi head: hide the player's own body while looking through its eyes
      this.renderer.actors.setHidden(this.ws.selfId, want);
      const e = getEffectiveSettings().effects;
      this.renderer.setEffects(want ? { ...e, dof: false } : e);
    }
    // re-applied every frame: a zone handover respawns the player's actor (a fresh slot shows its body)
    if (this.fpOn) this.renderer.actors.setHidden(this.ws.selfId, true);
    this.renderer.camera.setFirstPerson(this.fpOn ? this.fpView : null);
  }

  /** A left-button drag in first person: turn and tilt the view (drag right looks right, drag up looks up). */
  private look(dx: number, dy: number): boolean {
    if (!this.fpOn) return false;
    this.fpView.yaw -= dx * LOOK_RAD_PER_PX;
    this.fpView.pitch = Math.max(-FP_PITCH_MAX, Math.min(FP_PITCH_MAX, this.fpView.pitch - dy * LOOK_RAD_PER_PX));
    return true;
  }

  // ---- the breakdance (emote 7) -------------------------------------------------------------------------------------

  /**
   * G / the Dance button: the emote goes to the room (the others see it on this player's avatar), plays on the
   * player's own actor at once (the server does not echo a player's own emote), with the fanfare, and every villager
   * within DANCE_ALONG_M hops along. First person stays on: the eye rides the dancing body (render `bodyTilt`).
   */
  private dance(): void {
    if (!this.ready || this.worldBlocked() || this.director.battleFrame !== null) return;
    this.ws.send('emote', { emote: BREAKDANCE_EMOTE });
    this.renderer.actors.setEmote(this.ws.selfId, BREAKDANCE_EMOTE);
    this.audio.play('ui_stinger_victory_trainer', null);
    this.danceAlong(this.input.pose.x, this.input.pose.z);
  }

  /** The villagers near a dancer hop along for the dance's length. */
  private danceAlong(x: number, z: number): void {
    const r2 = DANCE_ALONG_M * DANCE_ALONG_M;
    this.director.forEachStatic((id, sx, sz) => {
      const dx = sx - x;
      const dz = sz - z;
      if (dx * dx + dz * dz <= r2) this.renderer.actors.setHop(id, BREAKDANCE_MS);
    });
  }

  // ---- NPC talk: slap / kick ------------------------------------------------------------------------------

  /**
   * The tool pass decided the NPC hits the player: its actor lunges in and back; at contact the sound, a camera shake
   * and (a kick) the knockback. `onHit` runs at contact, or at once when the NPC has no actor here (a beat's speaker).
   */
  private npcStrike(kind: StrikeKind, npcId: string, onHit: () => void): void {
    const home = this.ready ? this.director.staticPose(npcId) : null;
    if (home === null) return onHit();
    this.strikeFx ??= new NpcStrike(this.renderer.actors);
    this.strikeFx.start(npcId, home, this.input.renderX, this.input.renderZ, () => {
      this.audio.play(kind === 'kick' ? 'impact_fighting' : 'hit_normal', null);
      this.renderer.camera.shake(kind === 'kick' ? 0.4 : 0.18, kind === 'kick' ? 380 : 220);
      if (kind === 'kick') this.input.shove(this.input.pose.x - home.x, this.input.pose.z - home.z, KICK_SHOVE_MS);
      onHit();
    });
  }

  /** The player hits the NPC: their actor lunges in and back; at contact the sound and shake (a kick throws the NPC). */
  private playerStrike(kind: StrikeKind, npcId: string, onHit: () => void): void {
    const home = this.ready ? this.director.staticPose(npcId) : null;
    if (home === null) return onHit();
    this.strikeFx?.finish();
    this.playerStrikeFx ??= new PlayerStrike(this.renderer.actors);
    this.playerStrikeFx.start(kind, npcId, home, this.input.renderX, this.input.renderZ, () => {
      this.audio.play(kind === 'kick' ? 'impact_fighting' : 'hit_normal', null);
      this.renderer.camera.shake(kind === 'kick' ? 0.3 : 0.14, kind === 'kick' ? 300 : 180);
      onHit();
    });
  }

  // ---- trainer sight ---------------------------------------------------------------------------------------------

  /**
   * A trainer saw the player (the server holds them): input locks, the "!" goes up over the trainer with the `spotted`
   * sting, the trainer walks up, then its lines open (a story trainer's beat, else its own), and paging past them (or
   * Escape) sends the interact that starts the fight.
   */
  private onTrainerSpotted(trainerId: string): void {
    const z = this.zone;
    const send = (): void => {
      this.ws.send('interact', { targetId: trainerId, kind: 'npc' });
      this.armApproachFallback();
    };
    const tr = z === null ? undefined : (z.trainers.find((x) => x.id === trainerId) ?? interiorTrainers(z.id).find((x) => x.id === trainerId));
    if (!this.ready || z === null || tr === undefined) return send();
    this.input.setEnabled(false);
    this.fishing.cancel();
    useUiStore.getState().setDialogue(null);
    this.approach ??= new TrainerApproach(this.renderer.actors);
    const home = this.director.staticPose(trainerId) ?? { x: tr.x, z: tr.z, angle: 0 };
    this.audio.play('spotted', null);
    this.approach.start(trainerId, home, this.input.renderX, this.input.renderZ, () => {
      const plan = trainerPlan(z.id, trainerId, this.flags());
      const d = plan.dialogue ?? (tr.lines.length > 0 ? { speaker: tr.name, lines: tr.lines, beatId: null } : null);
      if (d === null) return send();
      useUiStore.getState().setDialogue({
        speaker: d.speaker, lines: d.lines, index: 0, targetId: d.beatId !== null ? `beat:${d.beatId}` : trainerId, obligatory: true,
        onFinish: () => {
          this.readBeat = d.beatId;
          send();
        },
      });
    });
  }

  /** The fight did not start (the server refused): the trainer goes back to its spot and the player may move again. */
  private armApproachFallback(): void {
    if (this.approachTimer !== null) clearTimeout(this.approachTimer);
    this.approachTimer = setTimeout(() => {
      this.approachTimer = null;
      if (useUiStore.getState().battle === null) this.endApproach(true);
    }, 6_000);
  }

  private endApproach(restore: boolean): void {
    if (this.approachTimer !== null) clearTimeout(this.approachTimer);
    this.approachTimer = null;
    const a = this.approach;
    if (a === null || !a.active) return;
    const id = a.trainerId!;
    a.end(restore ? (this.director.staticPose(id) ?? undefined) : undefined);
    if (restore) this.input.setEnabled(true);
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
          // breeding: paging past the Daycare keeper's lines opens the Daycare; the bounty board: the Marshal's, the Wanted board
          const opens = inside?.role === 'daycare' ? '/play/daycare' : inside?.role === 'bounty' ? '/play/bounties' : null;
          if (inside !== undefined) ui.setDialogue({ speaker: inside.name, lines: inside.lines, index: 0, targetId: inside.id, ...(opens !== null ? { onFinish: () => navigateTo(opens) } : {}) });
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
        if (l !== undefined) ui.setDialogue({ speaker: l.title, lines: l.text, index: 0, targetId: l.id, noTalk: true });
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
      case 'tower': {
        // Phase D14: the attendant's lines; after the Champion, paging past them opens the tower (picker, or the run)
        const inside = interiorNpcs(z.id).find((n) => n.id === t.id);
        const lines = inside?.lines ?? [];
        const speaker = inside?.name ?? 'Tower Attendant';
        if (!this.flags().has(POSTGAME_FLAG)) {
          ui.setDialogue({ speaker, lines, index: 0, targetId: t.id });
          return;
        }
        if (useUiStore.getState().tower !== null) {
          ui.openModal('tower');
          return;
        }
        ui.setDialogue({ speaker, lines, index: 0, targetId: t.id, onFinish: () => useUiStore.getState().openModal('tower') });
        return;
      }
      case 'healer':
        this.ws.send('interact', { targetId: z.id, kind: 'healer' });
        void apiFetch('heal', {})
          .then((res) => {
            applyInventoryDelta(toInventoryDelta({ party: res.party }));
            toast('success', 'Your party is fully healed.');
            noteTutorialEvent('healed');
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
      ui.battle !== null || ui.evolution !== null || ui.dialogue !== null || ui.modal !== 'none' || ui.chatOpen || ui.prompts.length > 0 || ui.trade !== null || ui.challenge !== null ||
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
    if (this.fpOn) return this.fpView.yaw;
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
        this.traceArena(`enterBattle ${s.format} inArena=${this.inArena}`);
        // from the battle state (the BattleSummary patch can arrive after battleStart)
        this.foe.begin(foeSpecOf(s.foeId, s.foeNpc, this.ws.selfId, (id) => foeIdentity(id)));
        // Phase C1: the den's boss steps aside while its arena copy fights
        if (s.format === 'raid') this.raidDen?.setHidden(true);
        // arena PvP: the stadium's own floor under the ring
        void this.director.enterBattle(this.inArena ? { ...s, terrain: this.backdrop?.terrain ?? ARENA_FALLBACK.terrain } : s);
        // render §10.7.8: a wild battle bursts the tall grass (or sprays the water) round the player as the push-in starts
        const feet = s.format === 'wild' && !this.inArena ? r.actors.feetOf(this.ws.selfId, new Vector3()) : null;
        if (feet !== null) p3?.worldFx.encounterAt(feet.x, feet.y, feet.z);
        this.audio.setTheme(s.format === 'raid' ? 'raid' : 'battle', 400);
      },
      ended: (foeWon) => {
        // Phase B7: the winner cheers, the loser bows (the player's own avatar too)
        this.foe.react(foeWon);
        if (foeWon !== null) r.actors.setEmote(this.ws.selfId, foeWon ? EMOTE_SAD : EMOTE_CHEER);
      },
      exitBattle: () => {
        this.traceArena('exitBattle');
        this.foe.end();
        this.raidDen?.setHidden(false);
        void this.director.exitBattle();
        // the stage disposed its battlers: their sides and the teams' atlases idle (released after the grace period)
        this.battleSprites.end();
        if (this.zone !== null) this.audio.setTheme(this.audio.themeFor(this.zone.id, this.zone.biome), 400);
        else if (this.inArena) this.audio.setTheme(this.arenaTheme(), 400);
      },
      setBattler: (ref, c, key, spriteId) => {
        if (c === null || cat === null) {
          r.stage.setBattler(ref, null);
          this.battleSprites.set(ref, null);
          return;
        }
        // the side this slot shows (the player's back, the foe's front), leased before the billboard asks for it;
        // a battle form shows its own manifest entry (`spriteId`)
        this.battleSprites.set(ref, spriteId ?? c.speciesId);
        r.stage.setBattler(ref, cat.descriptor(c.speciesId, key, c.variantKey, c.isAlpha, c.isShiny === true, spriteId));
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
      // music that follows the battle (battle/mood.ts)
      setMood: (m) => this.audio.setBattleMood(m),
      project: (ref, out) => {
        const bb = p3?.stage.battler(ref) ?? null;
        if (bb === null) return false;
        const rect = this.canvas.getBoundingClientRect();
        const cam = r.camera.camera;
        const top = bb.topWorld(this.sfxVec).project(cam);
        if (top.z < -1 || top.z > 1) return false;
        out[0] = rect.left + (top.x * 0.5 + 0.5) * rect.width;
        out[1] = rect.top + (-top.y * 0.5 + 0.5) * rect.height;
        const feet = bb.feet(this.sfxVec).project(cam);
        out[2] = rect.left + (feet.x * 0.5 + 0.5) * rect.width;
        out[3] = rect.top + (-feet.y * 0.5 + 0.5) * rect.height;
        return true;
      },
    };
  }

  private readonly sfxVec = new Vector3();

  // ---- the loop ------------------------------------------------------------------------------------------------

  start(): void {
    if (this.running || this.disposed) return;
    this.running = true;
    this.last = -1;
    this.lastDrawn = -1;
    this.schedule();
  }

  stop(): void {
    this.running = false;
    this.loopGen++;
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
    if (useSettingsStore.getState().graphics.frameCap === FRAME_CAP_UNLIMITED && this.unlimitedChannel !== null) {
      this.scheduleUnlimited(this.unlimitedChannel);
      return;
    }
    this.raf = requestAnimationFrame(this.onFrame);
  }

  /**
   * Unlimited frame rate: rAF never fires faster than the display, so the next frame is a posted task once the GPU queue
   * drained (WebGPU; one frame in flight, no runaway queue), else at once. Tasks interleave with input and the browser's
   * own rendering steps.
   */
  private scheduleUnlimited(channel: MessageChannel): void {
    const gen = this.loopGen;
    channel.port1.onmessage = (e: MessageEvent<number>): void => {
      if (e.data === this.loopGen) this.onFrame(performance.now());
    };
    const post = (): void => channel.port2.postMessage(gen);
    const backend = (this.renderer as Renderer | undefined)?.renderer.backend as unknown as { device?: { queue: { onSubmittedWorkDone(): Promise<void> } } } | undefined;
    const queue = backend?.device?.queue;
    if (queue) void queue.onSubmittedWorkDone().then(post, post);
    else post();
  }

  private readonly onFrame = (now: number): void => {
    this.raf = 0;
    if (!this.running) return;
    // graphics.frameCap: skip display frames until the next slot (1 ms slack for rAF jitter); the slots stay on a fixed grid so
    // a 144 Hz display averages the cap instead of rounding down to every third frame
    const cap = useSettingsStore.getState().graphics.frameCap;
    if (cap > 0 && this.lastDrawn >= 0) {
      const interval = 1000 / cap;
      const elapsed = now - this.lastDrawn;
      if (elapsed < interval - 1) {
        this.schedule();
        return;
      }
      this.lastDrawn = elapsed < 2 * interval ? Math.min(now, this.lastDrawn + interval) : now;
    } else {
      this.lastDrawn = now;
    }
    this.tick(now);
    this.schedule();
  };

  private onVisibility(): void {
    if (!this.running) return;
    this.loopGen++;
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
    this.lastDrawn = -1;
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
    if (this.ready && this.zoneLoaded) this.prepareNearEdge();
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
        // each trainer stands beside and behind their own creature, out of the battle camera's ray to it (render
        // `trainerSlot`, M3 review R-all-1), facing the arena (a pvp foe's remote interpolator wrote its server pose this
        // step — both players are frozen in battle, so this only restages it)
        const me = trainerPose(bf, 0, this.trainerAt);
        this.renderer.actors.setTransform(selfId, me.x, me.z, me.angle, false, false);
        const foe = trainerPose(bf, 1, this.trainerAt);
        this.foe.stage(foe.x, foe.z, foe.angle);
      } else if (this.inArena) {
        // arena PvP: before / after the battle the trainer waits at the near slot of the stadium's ring
        const me = trainerPose(this.arenaFrame, 0, this.trainerAt);
        this.renderer.actors.setTransform(selfId, me.x, me.z, me.angle, false, false);
      } else if (this.approach?.active === true) {
        // trainer sight: the player stands and turns toward the trainer walking up (input is locked meanwhile)
        this.approach.update(frameDt);
        const rx = this.input.renderX;
        const rz = this.input.renderZ;
        this.renderer.actors.setTransform(selfId, rx, rz, this.approach.facePlayer(rx, rz), false, false);
      } else if (this.playerStrikeFx?.active === true) {
        // NPC talk: the player runs at the NPC and back (render only; the simulation stands still)
        const ps = this.playerStrikeFx;
        ps.update(frameDt);
        if (ps.active) this.renderer.actors.setTransform(selfId, ps.x, ps.z, ps.angle, ps.moving, ps.running);
        else this.renderer.actors.setTransform(selfId, this.input.renderX, this.input.renderZ, ps.angle, false, false);
      } else if (this.strikeFx?.active === true) {
        // NPC talk: the player faces the NPC that slaps / kicks them (a kick's knockback runs backwards)
        this.strikeFx.update(frameDt);
        const rx = this.input.renderX;
        const rz = this.input.renderZ;
        this.renderer.actors.setTransform(selfId, rx, rz, this.strikeFx.facePlayer(rx, rz), false, false);
      } else if (this.evolution?.active === true) {
        // the evolution sequence: the trainer turns to the creature beside them (input is locked meanwhile)
        const rx = this.input.renderX;
        const rz = this.input.renderZ;
        this.renderer.actors.setTransform(selfId, rx, rz, this.evolution.faceAngle(rx, rz), false, false);
      } else {
        // first person: the body under the camera faces where the player looks
        const angle = this.fpOn ? Math.atan2(-Math.sin(this.fpView.yaw), -Math.cos(this.fpView.yaw)) : this.input.pose.angle;
        this.renderer.actors.setTransform(selfId, this.input.renderX, this.input.renderZ, angle, this.input.moving, this.input.running || this.input.biking);
      }
    }
    this.nameplateLeft -= frameDt;
    if (this.nameplateLeft <= 0) {
      this.nameplateLeft = NAMEPLATE_MS;
      this.updateNameplates();
    }
    // the active pocket drops the walls facing the camera (only on a yaw change)
    if (this.director.pocket !== null) this.director.syncView(this.cameraYaw());
    this.backdrop?.update(frameDt);
    // (3)
    this.hudWriter.flush();
    // (4)
    if (this.zoneLoaded) this.syncFirstPerson();
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
      setTimeout(() => {
        setWorldBoot({ ready: true, label: 'Ready', loadedBytes: null, totalBytes: null, compile: null });
        void this.prefetchNeighbours();   // E3: the new zone's neighbours (a handover / a recovered renderer)
      }, 0);
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
    // the creature budget is live (other textures come and go): flipbooks it refused get another try
    this.textures?.refresh();
    const fps = this.frames;
    const avg = fps > 0 ? this.frameMsSum / fps : 0;
    const st = this.renderer.stats();
    this.lastSecond = { fps, avgMs: avg, maxMs: this.frameMsMax, drawCalls: st.drawCalls, gpuMs: st.gpuMs, frameMs: st.frameMs, triangles: st.triangles, programs: st.programs };
    this.frames = 0;
    this.frameMsSum = 0;
    this.frameMsMax = 0;
    if (this.dev || useSettingsStore.getState().graphics.showFps) setTimeout(() => useUiStore.getState().setFps(fps), 0);
    if (this.dev) {
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
      textures: this.textureSummary(),
      arena: this.inArena
        ? { trace: this.arenaTrace.slice(), inBattle: this.director.inBattle, backdrop: this.backdrop !== null, match: useArenaStore.getState().match, outcome: useArenaStore.getState().outcome, foe: this.foe.kind, room: this.ws.arenaRoom !== null }
        : null,
      session: this.ws.kind,
    };
  }

  /** Creature texture residency at a glance (debug / harness): bound GPU bytes vs the budget, what idles, what waits. */
  private textureSummary(): Record<string, unknown> | null {
    const t = this.textures?.stats();
    if (t === undefined) return null;
    return {
      boundMB: Math.round(t.boundBytes / 2 ** 20), budgetMB: Math.round(t.budgetBytes / 2 ** 20), bound: t.bound, idle: t.idle, denied: t.denied,
      held: t.entries.filter((e) => e.refs > 0).map((e) => `${e.id}x${e.refs}`),
    };
  }

  /** Last 1 s window (dev tooling / verification: `window.__ewaWorld.lastSecond`). */
  lastSecond: { fps: number; avgMs: number; maxMs: number; drawCalls: number; gpuMs: number | null; frameMs: number; triangles: number; programs: number } | null = null;

  /** ≤ 16 nearest players + NPCs, every 500 ms (the one allocating HUD write outside chat / party). */
  private updateNameplates(): void {
    const sx = this.input.pose.x;
    const sz = this.input.pose.z;
    // the legendary statics near the player play their flipbooks; the far ones let theirs go (2 Hz)
    this.legendaries?.setViewer(sx, sz);
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

  /**
   * §20.10.3 phase 5: hero-tier textures of the zone's hero surfaces, swapped in place, never awaited; then (Phase E3)
   * the linked neighbours' field materials and atlases into the HTTP cache (`prefetch.ts`), cancelled by a zone change.
   */
  private startPhase5(): void {
    const handle = this.director.handle;
    if (handle === null) return;
    let hero: Promise<unknown> = Promise.resolve();
    try {
      const ids = heroSurfaces() as readonly SurfaceId[];
      hero = this.renderer.materials.preloadHero(ids).catch(() => undefined);
    } catch (_e) {
      // no hero table
    }
    void hero.then(() => this.prefetchNeighbours());
  }

  private prefetchToken: PrefetchToken | null = null;

  /** E3: the neighbour prefetch for the current zone (a previous zone's run is cancelled). */
  private async prefetchNeighbours(): Promise<void> {
    if (this.prefetchToken !== null) this.prefetchToken.cancelled = true;
    const z = this.zone;
    if (!this.ready || z === null) return;
    const token: PrefetchToken = { cancelled: false };
    this.prefetchToken = token;
    const r = this.renderer;
    // atlases already on the GPU (held or idling) need no HTTP-cache warm-up
    const bound = new Set((this.textures?.stats().entries ?? []).filter((e) => e.bound).map((e) => e.id));
    const plan = neighbourPrefetchPlan(z, this.flags(), this.catalog, bound);
    const bytes = await runPrefetch(plan, token, {
      ...(r.materials.prefetch !== undefined ? { materials: (ids) => r.materials.prefetch!(ids) } : {}),
      fetch: fetchIntoCache,
      wait: (ms) => new Promise((res) => setTimeout(res, ms)),
      now: () => performance.now(),
    });
    if (this.dev && !token.cancelled) console.info(`[world] prefetched ${plan.zones.join(', ')}: ${plan.surfaces.length} surfaces, ${plan.atlasUrls.length} atlas files, ${(bytes / 1048576).toFixed(1)} MB`);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    this.unlimitedChannel?.port1.close();
    for (const f of this.offs) f();
    this.offs.length = 0;
    this.detachRoom();
    this.capture.dispose();
    this.battle.reset();
    setBattleActions(null);
    setEvolutionPlayer(null);
    setStrikeHook(null);
    setDanceAction(null);
    this.strikeFx?.finish();
    this.playerStrikeFx?.finish();
    this.evolution?.cancel();
    this.audio.dispose();
    for (const f of this.rendererOffs) f();
    this.rendererOffs = [];
    this.backdrop?.dispose();
    this.backdrop = null;
    if (this.ready) {
      this.director.unloadZone();
      this.battleSprites.end();
      this.zoneHold?.release();
      this.zoneHold = null;
      this.textures?.dispose();
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
