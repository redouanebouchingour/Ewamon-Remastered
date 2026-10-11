/**
 * SPEC §20.4.3 — SceneDirector: zone lifecycle and the battle framing on top of the renderer.
 *
 * loadZone: `zoneSpecFor(zone, harvestStateFor(id, flags))` → `renderer.loadZone`; the zone collider becomes the
 * prediction collider; static actors (NPCs present for the player's flags, trainers) are spawned from the spec; the
 * interactables (NPCs, trainers, pickups not yet taken, tablets, warps, and — Phase A — everything inside the town's
 * pockets: door warps, one league challenge per trainer at its hall `leaderAt`, gym trainers, switches, the shop
 * keeper / nurse / PC inside the shop and healer) are registered; the zone banner plays (§20.2.6 timing) and the zone
 * theme starts. Loads are serialised (a handover while loading waits). unloadZone despawns everything, disposes the
 * ZoneHandle, drops the audio stems' theme and clears remote buffers. Idempotent.
 * enterBattle: Pillar 7 — `camera.pushIn` 600 ms to the BattleSummary (x, z), `stage.dress(terrainFor(biome))`;
 * nothing is unloaded. exitBattle: `stage.undress(400)`, `camera.release(600)`; input returns after the camera settles.
 *
 * Pockets (Phase A): `updatePocket(x, z)` runs every fixed step (allocation-free unless the pocket changes). Entering a
 * pocket activates its hall (`interiors.setActive`), turns the camera down the hall axis (`setYawBase(pocket yaw)`,
 * heading 0, `setView`) and spawns the pocket's NPCs, gym trainers and league trainers; leaving restores the default
 * diagonal and the heading the player had outside, and despawns them. A battle whose arena lies on a pocket's floor
 * fights along the hall axis (no `pickBattleHeading`), dresses the stage inside the hall (`HallBounds`) and returns to
 * the pocket camera afterwards. Gates and switch tiles follow the player's flags (`GateSync`).
 *
 * Phase D10 obstacles: each Cut tree / Strength boulder is an interactable ('Cut the small tree' / 'Push the
 * boulder') until the player's `obstacle:<zone>:<id>` flag arrives; then the renderer swaps it (`ObstaclesHandle`)
 * and the prediction collider re-opens its stamped samples (`ObstacleSink.setObstacles`) — on load and on every flag
 * change, only when the cleared set changed.
 */
import { getHeightfield, harvestStateFor, interiorAt, interiorsFor, obstacleAt, obstacleFlag, zone as zoneDef } from '@ewa/content';
import type { HarvestState, PlacedInterior, ZoneDef, ZoneId } from '@ewa/content';
import type { BattleFormat } from '@ewa/core';
import { BATTLER_SEPARATION, BATTLE_DISTANCE, BATTLE_PITCH, BATTLE_YAW_OFFSET, doorOf, fitCentre, headingYaw, trainerSlot } from '@ewa/render';
import type { CameraRig, Renderer, Terrain, TerrainCollider, WeatherKind, ZoneHandle } from '@ewa/render';
import { itemInfo } from '../data/content';
import type { AudioDirector } from '../audio/AudioDirector';
import { reverbKindFor } from '../audio/mixer';
import { PUSH_IN, RELEASE, UNDRESS_MS } from '../battle/constants';
import { HARVEST_LEVEL, withNeighbours, zoneSpecFor } from './zoneSpecFor';
import type { HudWriter } from './HudWriter';
import type { Interactable, InteractionTargets } from './interaction';
import { makeInteractable } from './interaction';
import { npcVisible } from './dialogue';
import type { GateBlockers } from './collider';
import { FloorIndex, GateSync, hallBoundsOf, interiorInteractables, leaderSpots, pocketActors, pocketYawDeg, refreshInteriorTargets } from './interiors';
import type { PocketActor } from './interiors';
/** §20.2.6 zone banner: 400 in, 2 000 hold, 400 out (the HUD draws it statically; hold only under reduced motion). */
export const BANNER_MS = 2800;

const TERRAIN: Readonly<Record<ZoneDef['biome'], Terrain>> = {
  grove: 'grove', cinder: 'cinder', salt: 'salt', storm: 'storm', marrow: 'marrow', vesper: 'vesper', forge: 'forge', sky: 'sky',
  capital: 'none', shrine: 'shrine', rift: 'rift',
};
export function terrainFor(biome: ZoneDef['biome']): Terrain {
  return TERRAIN[biome];
}

const DEG = Math.PI / 180;
/**
 * The battle look-at offset toward the camera from the arena centre. 0 since render Part 5 (T2): the battle camera
 * itself frames both battlers above the DOM panel's real height (`setBattleInsets`), where this 1.0 m shift used to
 * approximate it (and failed at the impact cue, audit M2-battle-5).
 */
export const FRAME_SHIFT_M = 0;
/** A trainer's battle pose: feet (x, z) and facing angle (the actor pool's atan2(dx, dz) convention). */
export interface TrainerPose { x: number; z: number; angle: number }
const _slot: [number, number] = [0, 0];
/**
 * Where trainer `side` stands while battle frame `bf` is dressed (render `trainerSlot`: beside and behind its own
 * battler, out of the battle camera's ray to it — M3 independent review R-all-1; side 1 is the point reflection),
 * facing the arena centre. Allocation-free: writes `out`.
 */
export function trainerPose(bf: { readonly x: number; readonly z: number; readonly fx: number; readonly fz: number }, side: 0 | 1, out: TrainerPose): TrainerPose {
  const t = trainerSlot(bf.x, bf.z, bf.fx, bf.fz, side, _slot);
  out.x = t[0];
  out.z = t[1];
  out.angle = Math.atan2(bf.x - t[0], bf.z - t[1]);
  return out;
}

/** A tree's crown reaches this far around its trunk blocker (m); the battle camera must not sit inside one. */
export const CANOPY_R = 2.8;
/**
 * Render's margin forest: the band `MARGIN_M` inside the heightfield edge (zone builder `ih = half − 16`) is dense
 * trees WITHOUT collider blockers, so it is scored from the zone size instead of `blocked`.
 */
export const MARGIN_M = 16;
/** The camera → battler line is above the crown base (~2.5 m of the camera's 5.6 m) for this first fraction. */
const CROWN_U = 0.55;
const RING = 8;

/**
 * Occluders between the battle camera and the arena for a diorama heading: prop blockers (trunks, houses, rocks)
 * sampled every 0.5 m on the ground lines from the camera's ground point to both battlers and the centre, plus crowns
 * over the upper part of those lines and at the camera — a trunk within CANOPY_R of the sample, or the blocker-free
 * margin forest (`half` = the heightfield's half size; Infinity skips it). Found live: the camera sat inside a crown at
 * a spawn beside the treeline although no trunk crossed the ground lines.
 */
export function arenaOcclusion(c: Pick<TerrainCollider, 'blocked'>, x: number, z: number, heading: number, half = Number.POSITIVE_INFINITY): number {
  const yaw = headingYaw(heading) + BATTLE_YAW_OFFSET * DEG;
  const horiz = BATTLE_DISTANCE * Math.cos(-BATTLE_PITCH * DEG);
  const fy = headingYaw(heading);
  const fx = -Math.sin(fy);
  const fz = -Math.cos(fy);
  // the push-in look-at sits FRAME_SHIFT_M toward the camera
  const camX = x - fx * FRAME_SHIFT_M + Math.sin(yaw) * horiz;
  const camZ = z - fz * FRAME_SHIFT_M + Math.cos(yaw) * horiz;
  const inner = half - MARGIN_M;
  const crown = (px: number, pz: number): number => {
    if (Math.max(Math.abs(px), Math.abs(pz)) > inner) return 2;
    if (c.blocked(px, pz)) return 1;
    for (let k = 0; k < RING; k++) {
      const a = (k / RING) * Math.PI * 2;
      if (c.blocked(px + Math.cos(a) * CANOPY_R, pz + Math.sin(a) * CANOPY_R)) return 1;
    }
    return 0;
  };
  let n = crown(camX, camZ) * 3;
  for (const along of [-BATTLER_SEPARATION / 2, 0, BATTLER_SEPARATION / 2]) {
    const tx = x + fx * along;
    const tz = z + fz * along;
    const len = Math.hypot(tx - camX, tz - camZ);
    const steps = Math.max(1, Math.ceil(len / 0.5));
    for (let i = 1; i < steps; i++) {
      const u = i / steps;
      const px = camX + (tx - camX) * u;
      const pz = camZ + (tz - camZ) * u;
      if (c.blocked(px, pz)) n++;
      if (u <= CROWN_U && i % 2 === 0) n += crown(px, pz);
    }
  }
  return n;
}

/** The least-occluded heading (ties keep the current one). */
export function pickBattleHeading(c: Pick<TerrainCollider, 'blocked'> | null, x: number, z: number, current: number, half = Number.POSITIVE_INFINITY): 0 | 1 | 2 | 3 {
  if (c === null) return (current & 3) as 0 | 1 | 2 | 3;
  let best = current & 3;
  let bestN = arenaOcclusion(c, x, z, best, half);
  for (const d of [1, 3, 2]) {
    if (bestN === 0) break;
    const h = (current + d) & 3;
    const n = arenaOcclusion(c, x, z, h, half);
    if (n < bestN) {
      best = h;
      bestN = n;
    }
  }
  return best as 0 | 1 | 2 | 3;
}

export interface SceneDirector {
  /** `focus`: where the player will stand (render T4 compiles what the first view there draws before resolving). */
  loadZone(id: ZoneId, harvestState: HarvestState, focus?: { readonly x: number; readonly z: number } | null): Promise<void>;
  /**
   * Handover (render `prepareZone`): builds and compiles `id` off the scene while the current zone stays up, so the
   * crossing's `loadZone(id, …)` adopts it. Resolves when it is compiled; a no-op on a renderer without it.
   */
  prepareZone(id: ZoneId, harvestState: HarvestState, focus?: { readonly x: number; readonly z: number } | null): Promise<void>;
  unloadZone(): void;
  /**
   * `yaw`: the hall battle axis from `battleStart` (null / absent outside a hall; the arena's pocket decides anyway).
   * `terrain`: the ring's dressing when no zone decides it (arena PvP: the stadium's own floor, 'none').
   */
  enterBattle(summary: {
    readonly battleId: string; readonly x: number; readonly z: number; readonly format: BattleFormat; readonly yaw?: number | null; readonly terrain?: Terrain;
  }): Promise<void>;
  exitBattle(): Promise<void>;
  setTimeOfDay(t: number): void;
  setWeather(w: WeatherKind): void;
  setHarvest(h: HarvestState): void;
  readonly currentZone: ZoneId | null;
  // ---- additions ----
  readonly handle: ZoneHandle | null;
  readonly inBattle: boolean;
  /** arena centre + forward while a battle is dressed (the trainers stand at `trainerPose`) */
  readonly battleFrame: { readonly x: number; readonly z: number; readonly fx: number; readonly fz: number } | null;
  /** Re-evaluates NPC presence / pickups / gates / switch tiles for new flags (a restore beat, a pickup, a beaten gym trainer). */
  refreshFlags(flags: ReadonlySet<string>): void;
  /** Phase A: the pocket whose floor the player stands on (null outside); call after every step / warp / correction. */
  updatePocket(x: number, z: number): void;
  readonly pocket: PlacedInterior | null;
  /** The rig's current yaw (radians); forwarded to `interiors.setView` when it changed while a pocket is active. */
  syncView(yaw: number): void;
  /** The active pocket's actors (nameplates), [] outside. */
  readonly pocketActors: readonly PocketActor[];
  /** True for an actor the director spawned (zone NPC / trainer, pocket NPC / trainer / leader). */
  isStaticActor(id: string): boolean;
  /** Phase B7: where a director actor stands when no battle restages it (the foe actor puts it back), else null. */
  staticPose(id: string): { readonly x: number; readonly z: number; readonly angle: number } | null;
}

export interface SceneDirectorDeps {
  readonly renderer: Renderer;
  readonly hud: HudWriter;
  readonly audio: AudioDirector;
  readonly targets: InteractionTargets;
  readonly selfId: () => string;
  readonly flags: () => ReadonlySet<string>;
  readonly interactKey: () => string;
  /** the zone collider changed (prediction, spawns, remotes) */
  readonly onZone: (handle: ZoneHandle | null, zone: ZoneDef | null) => void;
  /** input lock around battles / camera travel */
  readonly setInputEnabled: (on: boolean) => void;
  /** accent type (gym beacon + arena ring colour) for the part-3 stage */
  readonly setAccentType: (t: ZoneDef['type']) => void;
  readonly reducedMotion: () => boolean;
  /** Phase A: the prediction collider's removable blockers (gates); read after `onZone` gave it the new zone. */
  readonly blockers?: () => GateBlockers | null;
  /** Phase B1: the legendary statics' billboards + interactables (`LegendaryViews`), synced on load / flags / unload. */
  readonly legendaries?: () => { sync(zoneId: ZoneId | null, flags: ReadonlySet<string>): void } | null;
  /** Phase D10: the prediction collider's obstacle hook (read after `onZone` gave it the new zone). */
  readonly obstacles?: () => ObstacleSink | null;
}

/** Phase D10: what re-opens a cleared obstacle's stamped samples for prediction (the client `StepCollider`). */
export interface ObstacleSink {
  setObstacles(lookup: ((x: number, z: number) => string | null) | null, cleared: ReadonlySet<string>): void;
}

/** Phase D10: the ids of `zone`'s obstacles `flags` say the player cleared. */
export function clearedObstacles(zone: ZoneDef, flags: ReadonlySet<string>): ReadonlySet<string> {
  const out = new Set<string>();
  for (const o of zone.obstacles ?? []) if (flags.has(obstacleFlag(zone.id, o.id))) out.add(o.id);
  return out;
}

interface StaticActor { readonly id: string; readonly npc: boolean; readonly x: number; readonly z: number; readonly angle: number; readonly pocket: boolean }

type Heading = 0 | 1 | 2 | 3;
/** The rig as the director drives it (setYawBase is Phase A; a rig without it keeps the default diagonal). */
type Rig = CameraRig & { readonly headingIndex?: Heading };
function setYawBase(rig: Rig, deg: number | null): void {
  const f = (rig as Partial<CameraRig>).setYawBase;
  if (typeof f === 'function') f.call(rig, deg);
}
const DEG2RAD = Math.PI / 180;

export function createSceneDirector(d: SceneDirectorDeps): SceneDirector {
  let current: ZoneId | null = null;
  let def: ZoneDef | null = null;
  let handle: ZoneHandle | null = null;
  let loading: Promise<void> | null = null;
  let lastFlags: ReadonlySet<string> = new Set();
  let statics: StaticActor[] = [];
  let bannerTimer: ReturnType<typeof setTimeout> | null = null;
  let inBattle = false;
  let settleTimer: ReturnType<typeof setTimeout> | null = null;
  let harvest: HarvestState = 'intact';
  let battleFrame: { x: number; z: number; fx: number; fz: number } | null = null;
  let savedHeading: Heading | null = null;
  /** the pocket the current battle is fought in (hall axis), else null */
  let battleHall: PlacedInterior | null = null;
  let pocket: PlacedInterior | null = null;
  let floors: FloorIndex | null = null;
  let outsideHeading: Heading | null = null;
  let viewYaw = Number.NaN;
  let activeActors: PocketActor[] = [];
  let gates: GateSync | null = null;
  /** Phase D7: the zone's overworld weather (state.weather); interiors and battles render none */
  let overworldWeather: WeatherKind = 'none';
  /** Phase D10: the cleared-obstacle key last pushed (renderer + collider), '' = none */
  let obstacleKey: string | null = null;

  function syncObstacles(z: ZoneDef, flags: ReadonlySet<string>, force: boolean): void {
    if ((z.obstacles?.length ?? 0) === 0) return;
    const cleared = clearedObstacles(z, flags);
    const key = [...cleared].sort().join(',');
    if (!force && key === obstacleKey) return;
    obstacleKey = key;
    for (const o of z.obstacles!) handle?.obstacles?.setCleared(o.id, cleared.has(o.id));
    const h = getHeightfield(z.id);
    d.obstacles?.()?.setObstacles(cleared.size === 0 ? null : (x, zz) => obstacleAt(h, x, zz), cleared);
  }

  function applyWeather(): void {
    if (!inBattle) d.renderer.setWeather(pocket === null ? overworldWeather : 'none');
  }

  function faceOrigin(x: number, z: number): number {
    return Math.atan2(-x, -z);
  }

  function spawnStatics(z: ZoneDef, flags: ReadonlySet<string>): void {
    for (const n of z.npcs) {
      if (!npcVisible(n, flags)) continue;
      spawnStatic(n.id, n.look, n.name, n.x, n.z, faceOrigin(n.x, n.z), true, false);
    }
    for (const t of z.trainers) spawnStatic(t.id, t.look, t.name, t.x, t.z, faceOrigin(t.x, t.z), false, false);
  }

  function spawnStatic(id: string, look: string, name: string, x: number, z: number, angle: number, npc: boolean, inPocket: boolean): void {
    const actors = d.renderer.actors;
    actors.spawn(id, { look, name, guildTag: '', isLocal: false });
    actors.setTransform(id, x, z, angle, false, false);
    statics.push({ id, npc, x, z, angle, pocket: inPocket });
  }

  function despawnStatics(): void {
    for (const s of statics) d.renderer.actors.despawn(s.id);
    statics = [];
    activeActors = [];
  }

  /** Puts every static actor back where it stands (a battle restaged the foe trainer behind its creature). */
  function restoreStatics(): void {
    for (const s of statics) d.renderer.actors.setTransform(s.id, s.x, s.z, s.angle, false, false);
  }

  // ---- pockets ------------------------------------------------------------------------------------------------

  function rig(): Rig {
    return d.renderer.camera as Rig;
  }

  function enterPocket(p: PlacedInterior): void {
    const c = rig();
    if (pocket === null) outsideHeading = c.headingIndex ?? 0;
    else leavePocketActors();
    pocket = p;
    handle?.interiors?.setActive(p.def.id);
    applyWeather();
    setYawBase(c, pocketYawDeg(p));
    c.setHeading(0);
    viewYaw = Number.NaN;
    director.syncView(pocketYawDeg(p) * DEG2RAD);
    const z = current;
    if (z === null) return;
    // the player's flags NOW (a greeting leader — Kirei until `wardens_met` — stands by them; `lastFlags` may still be
    // empty when the first pocket is entered before the first flag refresh)
    activeActors = pocketActors(z, p, d.flags());
    for (const a of activeActors) spawnStatic(a.id, a.look, a.name, a.x, a.z, a.angle, a.kind === 'npc', true);
  }

  function leavePocketActors(): void {
    const keep: StaticActor[] = [];
    for (const s of statics) {
      if (s.pocket) d.renderer.actors.despawn(s.id);
      else keep.push(s);
    }
    statics = keep;
    activeActors = [];
  }

  function leavePocket(): void {
    if (pocket === null) return;
    leavePocketActors();
    pocket = null;
    viewYaw = Number.NaN;
    handle?.interiors?.setActive(null);
    applyWeather();
    const c = rig();
    setYawBase(c, null);
    c.setHeading(outsideHeading ?? 0);
    outsideHeading = null;
  }

  function interactables(z: ZoneDef, flags: ReadonlySet<string>): Interactable[] {
    const key = d.interactKey();
    const out: Interactable[] = [];
    for (const n of z.npcs) {
      const e = makeInteractable(n.id, 'npc', n.x, n.z, 'Talk to', n.name, key);
      e.enabled = npcVisible(n, flags);
      out.push(e);
    }
    for (const t of z.trainers) out.push(makeInteractable(t.id, 'trainer', t.x, t.z, 'Challenge', t.name, key));
    for (const i of z.items) {
      const e = makeInteractable(i.id, 'item', i.x, i.z, 'Pick up', `${itemInfo(i.item).name}${i.qty > 1 ? ` ×${i.qty}` : ''}`, key);
      e.enabled = !flags.has(`item:${z.id}:${i.id}`);
      out.push(e);
    }
    for (const l of z.lore) out.push(makeInteractable(l.id, 'lore', l.x, l.z, 'Read', l.title, key));
    for (const w of z.warps) out.push(makeInteractable(w.id, 'warp', w.x, w.z, 'Enter', w.label, key));
    // Phase D10: Cut trees / Strength boulders until cleared
    for (const o of z.obstacles ?? []) {
      const e = makeInteractable(o.id, 'obstacle', o.x, o.z, o.kind === 'tree' ? 'Cut' : 'Push', o.kind === 'tree' ? 'the small tree' : 'the boulder', key);
      e.enabled = !flags.has(obstacleFlag(z.id, o.id));
      out.push(e);
    }
    // Phase A: league trainers, the shop counter and the healer live inside the town's pockets
    out.push(...interiorInteractables(z.id, flags, key));
    const spec = handleSpec;
    if (spec !== null) {
      const inside = new Set(interiorsFor(z.id).map((p) => p.def.building));
      for (const b of spec.buildings) {
        if (b.kind !== 'healer' && b.kind !== 'shop') continue;
        if (inside.has(b.id)) continue; // served by the keeper / nurse inside its pocket
        const door = doorOf(b);
        const x = door.x + door.nx * 1.2;
        const zz = door.z + door.nz * 1.2;
        out.push(makeInteractable(`${b.kind}:${b.id}`, b.kind, x, zz, b.kind === 'healer' ? 'Rest at' : 'Shop at', b.kind === 'healer' ? 'the healer' : 'the market stall', key));
      }
    }
    return out;
  }

  let handleSpec: ReturnType<typeof zoneSpecFor> | null = null;

  function playBanner(name: string): void {
    if (bannerTimer !== null) clearTimeout(bannerTimer);
    d.hud.setZoneName(name);
    bannerTimer = setTimeout(() => {
      bannerTimer = null;
      d.hud.setZoneName(null);
    }, BANNER_MS);
  }

  async function doLoad(id: ZoneId, h: HarvestState, focus: { readonly x: number; readonly z: number } | null): Promise<void> {
    const z = zoneDef(id);
    const spec = withNeighbours(zoneSpecFor(z, h), z);   // E3: the skirt continues into the linked zones
    // E3: a handover keeps the next zone's texture sets through the old zone's dispose (shared surfaces stay resident)
    if (handle !== null) d.renderer.prepareHandover?.(spec);
    unload();
    handleSpec = spec;
    const zh = await d.renderer.loadZone(spec, { focus: focus ?? { x: z.spawn.x, z: z.spawn.z } });
    handle = zh;
    def = z;
    current = id;
    harvest = h;
    d.setAccentType(z.type);
    const flags = d.flags();
    spawnStatics(z, flags);
    d.targets.setStatics(interactables(z, flags));
    d.onZone(zh, z);
    syncObstacles(z, flags, true);
    floors = new FloorIndex(interiorsFor(id));
    gates = new GateSync(id, d.blockers?.() ?? null);
    gates.sync(flags, zh.interiors);
    d.legendaries?.()?.sync(id, flags);
    playBanner(z.name);
    d.audio.setTheme(d.audio.themeFor(id, z.biome), 400);
    d.audio.setReverbZone(reverbKindFor(z.kind, z.biome));
    d.audio.setHarvested(h === 'harvested');
  }

  function unload(): void {
    if (handle === null && current === null) return;
    leavePocket();
    floors = null;
    gates = null;
    obstacleKey = null;
    despawnStatics();
    d.legendaries?.()?.sync(null, lastFlags);
    d.targets.clear();
    d.onZone(null, null);
    handle?.dispose();
    handle = null;
    handleSpec = null;
    current = null;
    def = null;
  }

  const director: SceneDirector = {
    get currentZone() {
      return current;
    },
    get handle() {
      return handle;
    },
    get inBattle() {
      return inBattle;
    },
    get battleFrame() {
      return battleFrame;
    },
    get pocket() {
      return pocket;
    },
    get pocketActors() {
      return activeActors;
    },

    prepareZone(id, h, focus = null) {
      if (id === current) return Promise.resolve();
      const z = zoneDef(id);
      return d.renderer.prepareZone?.(withNeighbours(zoneSpecFor(z, h), z), { focus }) ?? Promise.resolve();
    },
    loadZone(id, h, focus = null) {
      const run = async (): Promise<void> => {
        if (loading !== null) await loading.catch(() => undefined);
        if (current === id && handle !== null) return;
        await doLoad(id, h, focus);
      };
      const p = run().finally(() => {
        if (loading === p) loading = null;
      });
      loading = p;
      return p;
    },

    unloadZone() {
      unload();
    },

    async enterBattle(summary) {
      inBattle = true;
      if (settleTimer !== null) clearTimeout(settleTimer);
      d.setInputEnabled(false);
      const cam = rig();
      const cur = cam.headingIndex ?? 0;
      // Phase A: an arena on a pocket's floor fights along the hall axis (player by the door, foe toward the far end)
      const hall = def === null ? null : interiorAt(def.id, summary.x, summary.z);
      battleHall = hall;
      let fy: number;
      if (hall !== null) {
        savedHeading = cur;
        setYawBase(cam, pocketYawDeg(hall));
        cam.setHeading(0);
        fy = hall.at.yaw;
      } else {
        const half = def === null ? Number.POSITIVE_INFINITY : getHeightfield(def.id).size / 2;
        const best = pickBattleHeading(handle?.collider ?? null, summary.x, summary.z, cur, half);
        if (best !== cur) {
          savedHeading = cur;
          cam.setHeading(best);
        } else savedHeading = null;
        fy = headingYaw(best);
      }
      const fx = -Math.sin(fy);
      const fz = -Math.cos(fy);
      // in a hall the stage pulls the ring centre in to keep it on the floor (`fitCentre`): the trainers stand around that
      const at = hall === null ? null : fitCentre(hallBoundsOf(hall), summary.x, summary.z, fy, [0, 0]);
      battleFrame = { x: at === null ? summary.x : at[0], z: at === null ? summary.z : at[1], fx, fz };
      cam.pushIn({ x: summary.x - fx * FRAME_SHIFT_M, z: summary.z - fz * FRAME_SHIFT_M }, PUSH_IN);
      const terrain = summary.terrain ?? terrainFor(def?.biome ?? 'grove');
      if (hall !== null) d.renderer.stage.dress({ x: summary.x, z: summary.z }, terrain, [d.selfId()], hallBoundsOf(hall));
      else d.renderer.stage.dress({ x: summary.x, z: summary.z }, terrain, [d.selfId()]);
    },

    async exitBattle() {
      if (!inBattle) return;
      inBattle = false;
      battleFrame = null;
      d.renderer.stage.undress(UNDRESS_MS);
      const cam = rig();
      cam.release(RELEASE);
      if (battleHall !== null) {
        // back to the pocket camera (the hall axis and the heading the player had in it), not the town default
        setYawBase(cam, pocket === null ? null : pocketYawDeg(pocket));
        cam.setHeading(savedHeading ?? 0);
        viewYaw = Number.NaN;
      } else if (savedHeading !== null) cam.setHeading(savedHeading);
      battleHall = null;
      savedHeading = null;
      restoreStatics();
      applyWeather();
      if (settleTimer !== null) clearTimeout(settleTimer);
      await new Promise<void>((resolve) => {
        settleTimer = setTimeout(() => {
          settleTimer = null;
          if (!inBattle) d.setInputEnabled(true);
          resolve();
        }, RELEASE);
      });
    },

    setTimeOfDay(t) {
      d.renderer.setTimeOfDay(t);
      d.audio.setNight(t);
    },

    setWeather(w) {
      overworldWeather = w;
      applyWeather();
    },

    setHarvest(h) {
      if (h === harvest) return;
      harvest = h;
      d.renderer.setHarvestLevel(HARVEST_LEVEL[h]);
      d.audio.setHarvested(h === 'harvested');
    },

    refreshFlags(flags) {
      if (def === null) return;
      const z = def;
      // NPC presence
      const present = new Set(statics.filter((s) => s.npc).map((s) => s.id));
      for (const n of z.npcs) {
        const want = npcVisible(n, flags);
        if (want && !present.has(n.id)) {
          spawnStatic(n.id, n.look, n.name, n.x, n.z, faceOrigin(n.x, n.z), true, false);
        } else if (!want && present.has(n.id)) {
          d.renderer.actors.despawn(n.id);
          statics = statics.filter((s) => s.id !== n.id);
        }
      }
      for (const e of d.targets.staticEntries()) {
        if (e.kind === 'npc') {
          const n = z.npcs.find((x) => x.id === e.id);
          if (n !== undefined) e.enabled = npcVisible(n, flags);
        } else if (e.kind === 'item') {
          e.enabled = !flags.has(`item:${z.id}:${e.id}`);
        } else if (e.kind === 'obstacle') {
          e.enabled = !flags.has(obstacleFlag(z.id, e.id));
        }
      }
      syncObstacles(z, flags, false);
      refreshInteriorTargets(z.id, d.targets.staticEntries(), flags);
      lastFlags = flags;
      // a hall leader who greets until a story flag (Kirei in the league foyer) moves to her chamber once it is held
      for (const [id, at] of leaderSpots(z.id, flags)) {
        for (const e of d.targets.staticEntries()) if (e.kind === 'gym' && e.id === id) { e.x = at.x; e.z = at.z; }
        const k = statics.findIndex((s) => s.id === id);
        const st = statics[k];
        if (st !== undefined && (st.x !== at.x || st.z !== at.z)) {
          statics[k] = { ...st, x: at.x, z: at.z };
          d.renderer.actors.setTransform(id, at.x, at.z, st.angle, false, false);
        }
        activeActors = activeActors.map((a) => (a.id === id ? { ...a, x: at.x, z: at.z } : a));
      }
      gates?.sync(flags, handle?.interiors);
      d.legendaries?.()?.sync(z.id, flags);
      const h = harvestStateFor(z.id, flags);
      director.setHarvest(h);
    },

    updatePocket(x, z) {
      if (floors === null || inBattle || floors.size === 0) return;
      const p = floors.at(x, z);
      if (p === pocket) return;
      if (p === null) leavePocket();
      else enterPocket(p);
    },

    syncView(yaw) {
      if (pocket === null || yaw === viewYaw || !Number.isFinite(yaw)) return;
      viewYaw = yaw;
      handle?.interiors?.setView(yaw);
    },

    isStaticActor(id) {
      for (const s of statics) if (s.id === id) return true;
      return false;
    },

    staticPose(id) {
      for (const s of statics) if (s.id === id) return { x: s.x, z: s.z, angle: s.angle };
      return null;
    },
  };
  return director;
}
