/**
 * SURFACES — every SurfaceId's base values (SPEC §10.2.2–10.2.3).
 *
 * The grove rows are the §10.2.2 table verbatim. Every other row names only the id and a few properties in
 * the spec (emissive colours, clearcoat, metal/roughness for a handful); the remaining base colours and
 * roughness values are authored here and listed in tools/material-bake/IMPLEMENTATION-NOTES.md (D9).
 *
 * `hero` is derived, never typed by hand: shared id ∨ triplanar terrain layer ∨ biome signature (§40.3.5).
 */
import { SHARED_SURFACE_IDS, SIGNATURE_SURFACES, SURFACE_IDS } from './ids';
import type { SurfaceId } from './ids';
import type { MaterialClass, SurfaceDef } from './types';

interface Opts {
  readonly emissive?: { readonly color: string; readonly intensity: number };
  readonly clearcoat?: { readonly base: number; readonly wet: number; readonly roughness: number };
  readonly triplanar?: boolean;
  readonly wind?: { readonly amplitude: number; readonly frequency: number; readonly stiffnessFromUv: boolean };
  readonly wetness?: boolean;
  readonly castShadow?: boolean;
}

const HERO_FIXED = new Set<SurfaceId>([...SHARED_SURFACE_IDS, ...Object.values(SIGNATURE_SURFACES)]);

/** §10.2.5: frequency 1.1 for trunks, 1.9 for cards; cards read stiffness from uv.y. */
const trunkWind = (amplitude: number) => ({ amplitude, frequency: 1.1, stiffnessFromUv: false });
const cardWind = (amplitude: number) => ({ amplitude, frequency: 1.9, stiffnessFromUv: true });

function def(id: SurfaceId, cls: MaterialClass, albedo: string, roughness: number, metalness: number, o: Opts = {}): SurfaceDef {
  const card = cls === 'card';
  const triplanar = o.triplanar ?? false;
  return {
    id,
    cls,
    albedo,
    roughness,
    metalness,
    emissive: o.emissive ?? null,
    clearcoat: o.clearcoat ?? null,
    triplanar,
    wind: o.wind ?? null,
    wetness: o.wetness ?? false,
    alphaTest: card ? 0.5 : null,
    doubleSide: card,
    castShadow: o.castShadow ?? !(cls === 'water' || cls === 'emissive'),
    hero: triplanar || HERO_FIXED.has(id),
  };
}

const T = { triplanar: true } as const;
const NO_SHADOW = { castShadow: false } as const;

const LIST: readonly SurfaceDef[] = [
  // ── grove (Mirevale slice, §10.2.2 verbatim; rough ranges use their midpoint as the base value) ──
  def('grove_bark', 'standard', '#5a4632', 0.85, 0, { wind: trunkWind(0.02) }),
  def('grove_leaf_canopy', 'card', '#4f7a3a', 0.62, 0, { wind: cardWind(0.12) }),
  def('grove_moss', 'standard', '#4a6b33', 0.88, 0, T),
  def('path_gravel', 'standard', '#8d8272', 0.8, 0, { triplanar: true, wetness: true }),
  def('cobble', 'physical', '#6f6a63', 0.65, 0, { wetness: true, clearcoat: { base: 0, wet: 0.25, roughness: 0.2 } }),
  def('plaster', 'standard', '#d9cfbb', 0.72, 0),
  def('timber', 'standard', '#6b4a2e', 0.66, 0),
  def('slate_roof', 'physical', '#3f444c', 0.42, 0, { wetness: true, clearcoat: { base: 0, wet: 0.4, roughness: 0.18 } }),
  def('thatch', 'standard', '#a3813f', 0.95, 0),
  def('water_pond', 'water', '#2b5666', 0.05, 0),
  def('stone_wall', 'standard', '#7d7569', 0.7, 0, { wetness: true }),
  def('lantern_metal', 'standard', '#2e2a26', 0.45, 0.85),
  def('glass_warm', 'emissive', '#ffd9a0', 0.12, 0, { emissive: { color: '#ffb35c', intensity: 3.2 } }),
  def('dirt', 'standard', '#6a5238', 0.9, 0, T),
  def('tall_grass', 'card', '#5f8a3c', 0.75, 0, { wind: cardWind(0.18) }),

  // ── cinder ──
  def('cinder_basalt', 'standard', '#3a3633', 0.85, 0, T),
  def('cinder_ash_soil', 'standard', '#5b544d', 0.95, 0, T),
  def('cinder_scoria', 'standard', '#5a3a2e', 0.9, 0, T),
  def('lava_crust', 'standard', '#2a2220', 0.8, 0),
  def('lava_glow', 'emissive', '#b8431a', 0.6, 0, { emissive: { color: '#ff5a1f', intensity: 4.0 } }),
  def('obsidian', 'physical', '#15131a', 0.15, 0, { clearcoat: { base: 0.6, wet: 0.6, roughness: 0.08 } }),
  def('charred_timber', 'standard', '#2b2420', 0.9, 0),
  def('iron_grate', 'standard', '#3b3836', 0.55, 0.9),
  def('forge_brick', 'standard', '#7a3b2a', 0.82, 0),

  // ── salt ──
  def('salt_sand', 'standard', '#cbbd9e', 0.92, 0, T),
  def('wet_rock', 'physical', '#4d4a47', 0.35, 0, { triplanar: true, clearcoat: { base: 0.5, wet: 0.7, roughness: 0.15 } }),
  def('barnacle_stone', 'standard', '#6d6a62', 0.85, 0, T),
  def('driftwood', 'standard', '#9a8f80', 0.85, 0),
  def('rope', 'standard', '#8a7450', 0.9, 0),
  def('sailcloth', 'card', '#d8cfbd', 0.85, 0),
  def('harbour_plank', 'standard', '#6a5440', 0.75, 0, { wetness: true }),
  def('sea_water', 'water', '#1f4a5a', 0.04, 0),
  def('tide_pool', 'water', '#2f5a5e', 0.06, 0),

  // ── storm ──
  def('storm_slate', 'standard', '#4a4f57', 0.55, 0, { triplanar: true, wetness: true }),
  def('copper_oxide', 'standard', '#4f8f7a', 0.35, 0.9),
  def('coil_brass', 'standard', '#b08d4a', 0.3, 1.0),
  def('insulator_glass', 'physical', '#6fa7a0', 0.08, 0, NO_SHADOW),
  def('lightning_glass', 'emissive', '#7fa8cc', 0.1, 0, { emissive: { color: '#9fd0ff', intensity: 3.6 } }),
  def('tower_stone', 'standard', '#6b6862', 0.75, 0, { wetness: true }),
  def('wet_flagstone', 'physical', '#545450', 0.4, 0, { triplanar: true, wetness: true, clearcoat: { base: 0.2, wet: 0.5, roughness: 0.15 } }),

  // ── marrow ──
  def('marrow_sandstone', 'standard', '#b07a52', 0.85, 0, T),
  def('bone_chalk', 'standard', '#d6ccb8', 0.9, 0, T),
  def('ore_vein', 'emissive', '#5a4a3a', 0.7, 0, { emissive: { color: '#ffc766', intensity: 1.6 } }),
  def('mine_timber', 'standard', '#5e4630', 0.8, 0),
  def('rail_iron', 'standard', '#4a4541', 0.45, 0.9),
  def('canyon_dust', 'standard', '#b58b62', 0.95, 0, T),
  def('gypsum_crystal', 'standard', '#d8d1c3', 0.2, 0),

  // ── vesper ──
  def('vesper_bark_black', 'standard', '#2a2626', 0.85, 0),
  def('grave_moss', 'standard', '#3f5234', 0.9, 0, T),
  def('wrought_iron', 'standard', '#2d2b2b', 0.6, 0.85),
  def('candle_wax', 'emissive', '#d9ccb0', 0.5, 0, { emissive: { color: '#ffd08a', intensity: 2.4 } }),
  def('mist_glass', 'physical', '#9fb0b8', 0.15, 0, NO_SHADOW),
  def('willow_leaf', 'card', '#56703f', 0.65, 0),
  def('bog_water', 'water', '#2c3326', 0.08, 0),
  def('lichen_stone', 'standard', '#6e7166', 0.85, 0, T),

  // ── forge ──
  def('forge_steel_plate', 'standard', '#6e7174', 0.3, 1.0),
  def('rivet_iron', 'standard', '#4d4a47', 0.5, 0.9),
  def('anvil_black', 'standard', '#1f1e1e', 0.4, 0.95),
  def('coal_glow', 'emissive', '#2a2320', 0.9, 0, { emissive: { color: '#ff7a2a', intensity: 3.0 } }),
  def('castle_granite', 'standard', '#77736d', 0.8, 0, T),
  def('banner_cloth', 'card', '#8a2a2a', 0.85, 0, { wind: cardWind(0.25) }),
  def('chain', 'standard', '#3d3a38', 0.45, 1.0),

  // ── sky ──
  def('sky_marble', 'standard', '#d0cdc7', 0.3, 0),
  def('cloud_stone', 'standard', '#bfc3c8', 0.8, 0, T),
  def('gold_leaf', 'standard', '#c9a24a', 0.22, 1.0),
  def('prayer_silk', 'card', '#c23b3b', 0.7, 0, { wind: cardWind(0.3) }),
  def('dragon_scale_tile', 'standard', '#3b6a6e', 0.45, 0),
  def('frost_glass', 'physical', '#c3d6e0', 0.1, 0, NO_SHADOW),
  def('pine_needle', 'card', '#3d5a36', 0.7, 0),
  def('snow', 'standard', '#d6dae0', 0.6, 0, T),

  // ── capital (solenne) ──
  def('sun_marble', 'standard', '#d8cdb9', 0.25, 0),
  def('gilt_bronze', 'standard', '#a07c3c', 0.3, 1.0),
  def('stained_glass', 'emissive', '#7a5a9a', 0.1, 0, { emissive: { color: '#ffffff', intensity: 2.0 } }),
  def('plaza_pale_stone', 'standard', '#c2baa9', 0.7, 0, { triplanar: true, wetness: true }),
  def('fountain_water', 'water', '#3a6a78', 0.05, 0),
  def('laurel_leaf', 'standard', '#4d6b35', 0.7, 0),

  // ── shrine (eclipse_shrine, celestial_spire) ──
  def('void_glass', 'emissive', '#1b2a33', 0.08, 0, { emissive: { color: '#7be0d0', intensity: 2.8 } }),
  def('star_iron', 'standard', '#3a3d4a', 0.4, 0.9),
  def('eclipse_stone', 'standard', '#3c3a42', 0.8, 0, T),
  def('ring_light', 'emissive', '#8fbcc6', 0.2, 0, { emissive: { color: '#c7f4ff', intensity: 3.4 } }),

  // ── rift (the_rift) ──
  def('rift_shard', 'emissive', '#4a2a6a', 0.2, 0, { emissive: { color: '#b46bff', intensity: 2.2 } }),
  def('unmade_stone', 'standard', '#6a6a6a', 0.9, 0, T),
  def('void_floor', 'standard', '#1c1a24', 0.7, 0, T),
];

function build(): Readonly<Record<SurfaceId, SurfaceDef>> {
  const out = {} as Record<SurfaceId, SurfaceDef>;
  for (const d of LIST) {
    if (out[d.id]) throw new Error(`SURFACES: duplicate id ${d.id}`);
    out[d.id] = Object.freeze(d);
  }
  for (const id of SURFACE_IDS) if (!out[id]) throw new Error(`SURFACES: missing id ${id}`);
  return Object.freeze(out);
}

export const SURFACES: Readonly<Record<SurfaceId, SurfaceDef>> = build();

/** Wind amplitudes as metadata (§10.2.5), for tools and tests. */
export const WIND_AMPLITUDES: Readonly<Partial<Record<SurfaceId, number>>> = Object.freeze(
  Object.fromEntries(LIST.filter((d) => d.wind).map((d) => [d.id, d.wind!.amplitude])),
);
