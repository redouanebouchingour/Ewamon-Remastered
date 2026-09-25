/**
 * Contracts for the subsystems LATER agents implement on top of this foundation (SPEC §10.4–§10.7,
 * §10.9). They are declared here, verbatim from the SPEC, so `Renderer` (§10.1.1) can be typed today;
 * the owning agent implements them in `sprites/`, `zone/`, `terrain/`, `camera/`, `stage/`, `hud/` and
 * may move a declaration into its own file (re-exporting it from here keeps imports stable).
 *
 * Two placeholders are NOT verbatim and are marked: `HudModel` (20-client.md §20.6 is the client's
 * type; the HUD agent mirrors it) and `TerrainColliderLike` (§10.6.1 declares a class; the terrain
 * agent's `TerrainCollider` must satisfy this structure and replace it in `ZoneHandle`).
 */
import type { Group, PerspectiveCamera, Vector3 } from 'three/webgpu';
import type { HarvestLevel, LightSource, RenderStats, WeatherKind } from './descriptors.js';
import type { TerrainCollider } from './terrain/collider.js';

// ---- §10.4.1 descriptors (verbatim) ----------------------------------------------------------------------

// text-identical mirrors of spine §2.8 / §2.2 (render imports only `three`; 50-verification-budget.md §50.7 rule 5 allows a mirror whose declaration text is identical)
export type VariantKey = 'normal' | 'dawn' | 'dusk' | 'verdant' | 'ember';
export type TypeName =
  | 'Normal' | 'Fire' | 'Water' | 'Grass' | 'Electric' | 'Ice' | 'Fighting' | 'Poison'
  | 'Ground' | 'Flying' | 'Psychic' | 'Bug' | 'Rock' | 'Ghost' | 'Dragon' | 'Steel'
  | 'Fairy' | 'Dark' | 'Cosmic';

/** One side of a creature. The client builds it from 40-pipelines.md's SpriteManifestV2 (`uv → rect`, `footV`, `aspect`, `px` for singles). */
export interface SpriteFrame {
  readonly atlas: string;                  // ManifestAtlasV2.id, e.g. 'a-017'
  readonly rect: readonly [number, number, number, number];   // u0, v0, u1, v1 in the atlas, v up (= ManifestSpriteV2.<side>.uv)
  readonly px: readonly [number, number, number, number];     // x, y, w, h level-0 texels, y down (= .px); used only by bindSingle's crop
  readonly footV: number;                  // 0..1 from the bottom of the rect where the feet touch the ground (pipeline value 0.08)
  readonly aspect: number;                 // rect width / height in texels (1 for the 1024² normalised frames)
}
export interface SpriteDescriptor {
  readonly id: string;                     // creature/spawn/battler id (render-side key)
  readonly front: SpriteFrame; readonly back: SpriteFrame;
  readonly sizeScale: number;              // SpeciesDef.sizeScale 0.5..2.2
  readonly types: readonly [TypeName] | readonly [TypeName, TypeName];
  readonly variant: VariantKey;
  readonly isAlpha: boolean;
}

export type BattlerPose = 'idle' | 'lunge' | 'windup' | 'hurt' | 'recoil' | 'faint' | 'enter' | 'exit' | 'celebrate';

// ---- §10.5.1 ZoneSpec / ZoneHandle (verbatim) ---------------------------------------------------------------

export type Biome = 'grove' | 'cinder' | 'salt' | 'storm' | 'marrow' | 'vesper' | 'forge' | 'sky' | 'capital' | 'shrine' | 'rift';   // text-identical mirror of spine §3.1
export type Layout = 'town' | 'route' | 'story';
export type Dir = 'n' | 'e' | 's' | 'w';
export type GeneratorSet = 'grove' | 'cinder' | 'salt' | 'storm' | 'marrow' | 'vesper' | 'forge' | 'sky' | 'capital' | 'shrine' | 'rift';   // BIOME_GENERATORS keys = Biome
export type SetPieceId =
  | 'grove_heart_tree' | 'mire_boardwalk' | 'cinder_caldera' | 'ash_lava_bridge' | 'salt_lighthouse' | 'tide_wreck'
  | 'storm_coil_tower' | 'galvan_span' | 'marrow_mineshaft' | 'deepcut_arch' | 'vesper_witch_hut' | 'hollow_lantern_road'
  | 'forge_great_gate' | 'siege_trebuchet' | 'sky_shrine' | 'ascent_stair' | 'solenne_cathedral' | 'eclipse_engine'
  | 'umbral_dome' | 'celestial_spire' | 'rift_maw';                                        // exactly 21; one per zone

export interface HeightfieldData {          // structurally identical to @ewa/content Heightfield (00-spine.md §3.11); the client passes content's object as-is
  readonly zoneId: string; readonly size: number; readonly step: 0.5; readonly res: number;
  readonly originX: number; readonly originZ: number;
  readonly heights: Float32Array; readonly walkable: Uint8Array; readonly water: Uint8Array; readonly digest: string;
}
export interface Marker { readonly id: string; readonly x: number; readonly z: number }   // warps (door markers), pickups, tablets share this shape
export interface PropPlacement { readonly kind: string; readonly x: number; readonly z: number; readonly yaw: number; readonly scale: number; readonly seed: number }   // kind = a generator prop id (§10.5.4)
export interface BuildingSpec { readonly id: string; readonly kind: 'house' | 'gym' | 'shop' | 'healer' | 'landmark'; readonly x: number; readonly z: number; readonly yaw: number; readonly w: number; readonly d: number; readonly floors: 1 | 2; readonly roof: 'slate' | 'thatch' | 'tile' | 'plate'; readonly seed: number }
export interface ActorSpawn { readonly id: string; readonly look: string; readonly x: number; readonly z: number; readonly kind: 'npc' | 'trainer' }
export interface Pickup { readonly id: string; readonly x: number; readonly z: number }
export interface Tablet { readonly id: string; readonly x: number; readonly z: number }
export interface Edge { readonly toZone: string; readonly x: number; readonly z: number }
export interface WaterSpec { readonly kind: 'pond' | 'sea' | 'river' | 'lava' | 'bog'; readonly level: number; readonly polygon: readonly (readonly [number, number])[] }

export interface ZoneSpec {
  readonly id: string;
  readonly seed: number;                                      // ZoneDef.layoutSeed, uint32
  readonly biome: Biome;
  readonly palette: string;                                   // ZoneDef.palette -> PALETTES[palette] (§10.5.3)
  readonly generators: GeneratorSet;
  readonly layout: Layout;
  readonly size: { readonly w: number; readonly d: number };  // the playable interior: town 128×128, route 208×208, story 168×168 (00-spine.md §3.1 extents) — reconciled 2026-09-18
  readonly heightfield: HeightfieldData;                      // the full field (160 / 240 / 200 m): the 16 m margin is scenery, never walkable (walkable = 0 there)
  readonly warps: readonly Marker[];                          // ZoneDef.warps → door markers (interior sub-areas are laid out by the builder at the warp's toX/toZ)
  readonly setPiece: SetPieceId;
  readonly edges: Readonly<Partial<Record<Dir, Edge>>>;
  readonly buildings: readonly BuildingSpec[];
  readonly props: readonly PropPlacement[];                   // hand-placed props; scatter is generated from seed + layout
  readonly lights: readonly LightSource[];                    // ≤ 8 shadow + ≤ 24 non-shadow
  readonly actors: readonly ActorSpawn[];
  readonly pickups: readonly Pickup[];
  readonly tablets: readonly Tablet[];
  readonly tallGrass: boolean;
  readonly water: WaterSpec | null;
  readonly accentType: TypeName | null;                       // gym beacon + arena ring colour
  readonly harvestLevel: HarvestLevel;
}

/** The structure of §10.6.1 `TerrainCollider` (kept for callers typed against part 1; `ZoneHandle.collider` is the class). */
export interface TerrainColliderLike {
  sample(x: number, z: number): number;
  normal(x: number, z: number, out: Vector3): Vector3;
  walkable(x: number, z: number): boolean;
  water(x: number, z: number): boolean;
  slopeDeg(x: number, z: number): number;
  readonly bounds: { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number };
}

export interface ZoneHandle {
  readonly id: string;
  readonly group: Group;                                      // the zone root (Pillar 7: never removed during a battle)
  readonly collider: TerrainCollider;                         // §10.6
  readonly bounds: { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number };
  readonly geometryDigest: string;                            // fnv1a32 over every geometry's position attribute bytes, in build order, 8 hex chars (§10.5.9)
  stats(): RenderStats;
  dispose(): void;                                            // idempotent; §10.5.9
}

// ---- §10.7.2 CameraRig (verbatim) ----------------------------------------------------------------------------

export interface CameraRig {
  setHeading(h: 0 | 1 | 2 | 3): void;
  setZoomStop(z: 0 | 1 | 2): void;
  follow(actorId: string | null): void;                     // null = hold position
  /** Pillar 7: eases from the current pose to the battle pose (§10.7.4) over ms; input to the rig is ignored until release. */
  pushIn(target: { readonly x: number; readonly z: number }, ms: number): void;
  release(ms: number): void;                                // back to the diorama pose
  /** Additive rotational shake: amplitude in world units at the focus distance (20-client.md SHAKE_AMP ≤ 0.5), decays over ms; ignored when effects.shake is false. */
  shake(amp: number, ms: number): void;
  /** Battle camera cue from the timeline (20-client.md MoveAnimDef.camera and Keyframe.camera.shot). */
  cue(kind: 'attacker' | 'defender' | 'impact' | 'wide' | 'ko' | 'throw', ms: number): void;   // reconciled 2026-09-18: 'throw' added for the orb sequence
  update(dtMs: number): void;                               // called by frame(); zero allocation
  readonly focus: Readonly<Vector3>;                        // the point the DOF plane passes through (feet of the followed actor)
  readonly camera: PerspectiveCamera;
  setAspect(aspect: number): void;
}

// ---- §10.7.5 BattleStage (verbatim) -------------------------------------------------------------------------

export type Terrain = 'none' | 'grove' | 'cinder' | 'salt' | 'storm' | 'marrow' | 'vesper' | 'forge' | 'sky' | 'shrine' | 'rift';   // text-identical mirror of spine §2.9
export interface BattlerRef { readonly side: 0 | 1; readonly slot: number }

export type VfxId =
  | `type_${Lowercase<TypeName>}`                        // 19 projectile/burst effects, one per type, colour from the type table
  | 'impact_normal' | 'impact_super' | 'impact_resist' | 'impact_crit'
  | 'status_burn' | 'status_poison' | 'status_paralyze' | 'status_sleep' | 'status_freeze' | 'status_confuse'
  | 'stat_up' | 'stat_down' | 'heal' | 'drain' | 'recoil'
  | 'weather_sun' | 'weather_rain' | 'weather_sand' | 'weather_hail'
  | 'orb_throw' | 'orb_shake' | 'orb_catch' | 'orb_break'
  | 'switch_out' | 'switch_in' | 'faint' | 'trap' | 'flinch';

export interface BattleStage {
  /** Dresses the arena at (x, z): a 7 m ring (surface cobble / the biome's plaza stone), 2 shadow-casting beacons whose colour is accentType, ≤ 6 spectator billboards (npc looks), rope posts; all within the zone's light budget (the 2 beacons are reserved slots). */
  dress(at: { readonly x: number; readonly z: number }, terrain: Terrain, participants: readonly string[]): void;
  dressSpectator(x: number, z: number): void;           // ring + beacons only
  undress(ms: number): void;                            // fades and removes the dressing; disposes nothing shared
  setBattler(ref: BattlerRef, d: SpriteDescriptor | null): void;   // null = empty slot; the two active refs get sharp = true
  setPose(ref: BattlerRef, pose: BattlerPose, ms: number): void;
  hurt(ref: BattlerRef, strength: number): void;
  faint(ref: BattlerRef, ms: number): void;
  setWeather(w: WeatherKind): void;                     // arena-local: the battle's Field.weather
  vfx(id: VfxId, from: BattlerRef | null, to: BattlerRef | null, ms: number): void;
  prewarm(ids: readonly VfxId[]): void;                 // compiles/instantiates the pooled effects (20-client.md preview rule 1)
  syncFrom(hp: readonly { readonly ref: BattlerRef; readonly hpFrac: number }[]): void;   // after battleResync: poses reset, no animation
  setTypeColors(table: Readonly<Record<TypeName, string>>): void;   // colourblind palettes (20-client.md §20.8.3)
  inspect(d: SpriteDescriptor | null): void;            // 4 m close-up pose for the party/dex inspector; null exits
  dispose(): void;
}

// ---- §10.7.6 ActorPool (verbatim) ---------------------------------------------------------------------------

export interface ActorDescriptor { readonly look: string; readonly name: string; readonly guildTag: string; readonly isLocal: boolean }
export interface ActorPool {
  spawn(id: string, d: ActorDescriptor): void;                 // character mesh from the look table (§10.7.7); pool of 48 rigs preallocated
  setTransform(id: string, x: number, z: number, angle: number, moving: boolean, running: boolean): void;   // y from the collider; walk/run blend by speed
  setEmote(id: string, n: 0 | 1 | 2 | 3 | 4 | 5 | 6): void;    // 0 clears; 1..6 = wave happy sad alert heart cool (spine §4.1) — a 2 s card over the head
  despawn(id: string): void;
  feetOf(id: string, out: Vector3): Vector3 | null;            // for CameraRig.follow and the DOF focus
  screenPositions(out: Float32Array): number;                  // xy pairs in CSS px for HudLayer nameplates; returns count
  dispose(): void;
}

// ---- §10.9 HudLayer (verbatim interface; HudModel placeholder) -----------------------------------------------

/** 20-client.md §20.6 `HudModel`, mirrored verbatim in `hud/layer.ts` (render may not import the client). */
export type { HudModel } from './hud/layer.js';
import type { HudModel } from './hud/layer.js';

export interface HudLayer {
  /** Accepts exactly the HudModel field names of 20-client.md §20.6; unknown keys throw in dev. Marks the touched regions dirty. */
  set(partial: Partial<HudModel>): void;
  /** Called by frame(); redraws only dirty regions into the 2D canvas and uploads (`texture.needsUpdate = true`) only when something was drawn. Never called from the fixed step. */
  drawIfDirty(): boolean;
  setFonts(body: string, display: string): void;      // CSS font strings; the client waits on document.fonts.load before the first draw
  setScale(uiScale: number): void;                     // 0.9..1.4; every metric below multiplies by it
  resize(cssWidth: number, cssHeight: number, pr: number): void;
  dispose(): void;
}
