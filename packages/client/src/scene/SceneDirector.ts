/**
 * SPEC §20.4.3 — SceneDirector: zone lifecycle and the battle framing on top of the renderer.
 *
 * loadZone: `zoneSpecFor(zone, harvestStateFor(id, flags))` → `renderer.loadZone`; the zone collider becomes the
 * prediction collider; static actors (NPCs present for the player's flags, trainers) are spawned from the spec; the
 * interactables (NPCs, trainers, pickups not yet taken, tablets, warps, the gym at the league marker (0, −26), the
 * healer / shop doors) are registered; the zone banner plays (§20.2.6 timing) and the zone theme starts. Loads are
 * serialised (a handover while loading waits). unloadZone despawns everything, disposes the ZoneHandle, drops the
 * audio stems' theme and clears remote buffers. Idempotent.
 * enterBattle: Pillar 7 — `camera.pushIn` 600 ms to the BattleSummary (x, z), `stage.dress(terrainFor(biome))`;
 * nothing is unloaded. exitBattle: `stage.undress(400)`, `camera.release(600)`; input returns after the camera settles.
 */
import { LEAGUE, getHeightfield, harvestStateFor, zone as zoneDef } from '@ewa/content';
import type { HarvestState, ZoneDef, ZoneId } from '@ewa/content';
import type { BattleFormat } from '@ewa/core';
import { BATTLER_SEPARATION, BATTLE_DISTANCE, BATTLE_PITCH, BATTLE_YAW_OFFSET, doorOf, headingYaw } from '@ewa/render';
import type { Renderer, Terrain, TerrainCollider, WeatherKind, ZoneHandle } from '@ewa/render';
import { itemInfo } from '../data/content';
import type { AudioDirector } from '../audio/AudioDirector';
import { reverbKindFor } from '../audio/mixer';
import { PUSH_IN, RELEASE, UNDRESS_MS } from '../battle/constants';
import { HARVEST_LEVEL, zoneSpecFor } from './zoneSpecFor';
import type { HudWriter } from './HudWriter';
import type { Interactable, InteractionTargets } from './interaction';
import { makeInteractable } from './interaction';
import { npcVisible } from './dialogue';

/** The gym / league door the server checks (server IMPLEMENTATION-NOTES R5). */
export const LEAGUE_MARKER = { x: 0, z: -26 } as const;
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
/** The trainer stands behind their own creature during a battle. */
export const TRAINER_BACK_M = BATTLER_SEPARATION / 2 + 1.7;

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
  unloadZone(): void;
  enterBattle(summary: { readonly battleId: string; readonly x: number; readonly z: number; readonly format: BattleFormat }): Promise<void>;
  exitBattle(): Promise<void>;
  setTimeOfDay(t: number): void;
  setWeather(w: WeatherKind): void;
  setHarvest(h: HarvestState): void;
  readonly currentZone: ZoneId | null;
  // ---- additions ----
  readonly handle: ZoneHandle | null;
  readonly inBattle: boolean;
  /** arena centre + forward while a battle is dressed (the trainer stands behind their creature) */
  readonly battleFrame: { readonly x: number; readonly z: number; readonly fx: number; readonly fz: number } | null;
  /** Re-evaluates NPC presence / pickups for new flags (a restore beat, a pickup). */
  refreshFlags(flags: ReadonlySet<string>): void;
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
}

interface StaticActor { readonly id: string; readonly npc: boolean }

export function createSceneDirector(d: SceneDirectorDeps): SceneDirector {
  let current: ZoneId | null = null;
  let def: ZoneDef | null = null;
  let handle: ZoneHandle | null = null;
  let loading: Promise<void> | null = null;
  let statics: StaticActor[] = [];
  let bannerTimer: ReturnType<typeof setTimeout> | null = null;
  let inBattle = false;
  let settleTimer: ReturnType<typeof setTimeout> | null = null;
  let harvest: HarvestState = 'intact';
  let battleFrame: { x: number; z: number; fx: number; fz: number } | null = null;
  let savedHeading: 0 | 1 | 2 | 3 | null = null;

  function faceOrigin(x: number, z: number): number {
    return Math.atan2(-x, -z);
  }

  function spawnStatics(z: ZoneDef, flags: ReadonlySet<string>): void {
    const actors = d.renderer.actors;
    for (const n of z.npcs) {
      if (!npcVisible(n, flags)) continue;
      actors.spawn(n.id, { look: n.look, name: n.name, guildTag: '', isLocal: false });
      actors.setTransform(n.id, n.x, n.z, faceOrigin(n.x, n.z), false, false);
      statics.push({ id: n.id, npc: true });
    }
    for (const t of z.trainers) {
      actors.spawn(t.id, { look: t.look, name: t.name, guildTag: '', isLocal: false });
      actors.setTransform(t.id, t.x, t.z, faceOrigin(t.x, t.z), false, false);
      statics.push({ id: t.id, npc: false });
    }
  }

  function despawnStatics(): void {
    for (const s of statics) d.renderer.actors.despawn(s.id);
    statics = [];
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
    const league = LEAGUE.filter((l) => l.zoneId === z.id).sort((a, b) => (a.stage === b.stage ? a.order - b.order : a.stage === 'gym' ? -1 : 1));
    const leader = z.gym !== null ? LEAGUE.find((l) => l.id === z.gym) : league[0];
    if (leader !== undefined) out.push(makeInteractable(leader.id, 'gym', LEAGUE_MARKER.x, LEAGUE_MARKER.z, 'Challenge', leader.name, key));
    const spec = handleSpec;
    if (spec !== null) {
      for (const b of spec.buildings) {
        if (b.kind !== 'healer' && b.kind !== 'shop') continue;
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
    unload();
    const z = zoneDef(id);
    const spec = zoneSpecFor(z, h);
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
    playBanner(z.name);
    d.audio.setTheme(d.audio.themeFor(id, z.biome), 400);
    d.audio.setReverbZone(reverbKindFor(z.kind, z.biome));
    d.audio.setHarvested(h === 'harvested');
  }

  function unload(): void {
    if (handle === null && current === null) return;
    despawnStatics();
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
      const cam = d.renderer.camera;
      const rig = cam as typeof cam & { headingIndex?: 0 | 1 | 2 | 3 };
      const cur = rig.headingIndex ?? 0;
      const half = def === null ? Number.POSITIVE_INFINITY : getHeightfield(def.id).size / 2;
      const best = pickBattleHeading(handle?.collider ?? null, summary.x, summary.z, cur, half);
      if (best !== cur) {
        savedHeading = cur;
        cam.setHeading(best);
      } else savedHeading = null;
      const fy = headingYaw(best);
      const fx = -Math.sin(fy);
      const fz = -Math.cos(fy);
      battleFrame = { x: summary.x, z: summary.z, fx, fz };
      cam.pushIn({ x: summary.x - fx * FRAME_SHIFT_M, z: summary.z - fz * FRAME_SHIFT_M }, PUSH_IN);
      d.renderer.stage.dress({ x: summary.x, z: summary.z }, terrainFor(def?.biome ?? 'grove'), [d.selfId()]);
    },

    async exitBattle() {
      if (!inBattle) return;
      inBattle = false;
      battleFrame = null;
      d.renderer.stage.undress(UNDRESS_MS);
      d.renderer.camera.release(RELEASE);
      if (savedHeading !== null) d.renderer.camera.setHeading(savedHeading);
      savedHeading = null;
      d.renderer.setWeather('none');
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
      if (!inBattle) d.renderer.setWeather(w);
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
          d.renderer.actors.spawn(n.id, { look: n.look, name: n.name, guildTag: '', isLocal: false });
          d.renderer.actors.setTransform(n.id, n.x, n.z, faceOrigin(n.x, n.z), false, false);
          statics.push({ id: n.id, npc: true });
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
        }
      }
      const h = harvestStateFor(z.id, flags);
      director.setHarvest(h);
    },
  };
  return director;
}
