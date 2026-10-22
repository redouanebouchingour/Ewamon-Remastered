/**
 * Followers with field powers (SPEC §3.18): the spots, a layer of their own (never `ZoneDef`, so no zone's layout RNG
 * or heightfield moves). Positions were surveyed on the sculpted fields (validate rule 13 keeps them honest):
 *
 * - Brambles (Fire burns them): two thorn patches on every route and in the rift, on open ground off the roads and the
 *   tall grass, a few metres from a cliff, each hiding a small cache. A patch is a per-player blocker while the server
 *   env FIELD_POWERS is on; it never plugs a path (validate keeps a walkable ring round it).
 * - Dig spots (Ground digs): beside the campfire of each route's travellers' camp (the zone sculpts' tent + campfire).
 * - Dive spots (Water dives): the dark middle of a lake or the sea, open water at least 3 m from any shore, so the diver
 *   surfs out to it.
 */
import type { ZoneId } from '../types';

export interface BrambleDef {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  /** the cache it hides, granted once with the burning */
  readonly item: { readonly item: string; readonly qty: number };
}

export interface FieldSpotDef {
  readonly id: string;
  readonly x: number;
  readonly z: number;
}

export const BRAMBLES: Readonly<Partial<Record<ZoneId, readonly BrambleDef[]>>> = {
  mire_route: [
    { id: 'thorns_a', x: -2, z: -50, item: { item: 'superpotion', qty: 2 } },
    { id: 'thorns_b', x: 58, z: -48, item: { item: 'stardust', qty: 1 } },
  ],
  ash_route: [
    { id: 'thorns_a', x: -76, z: -62, item: { item: 'burn_heal', qty: 2 } },
    { id: 'thorns_b', x: -30, z: 14, item: { item: 'ember_stone', qty: 1 } },
  ],
  tide_route: [
    { id: 'thorns_a', x: -44, z: 80, item: { item: 'revive', qty: 1 } },
    { id: 'thorns_b', x: 76, z: 82, item: { item: 'star_piece', qty: 1 } },
  ],
  galvan_route: [
    { id: 'thorns_a', x: -70, z: -52, item: { item: 'paralyze_heal', qty: 2 } },
    { id: 'thorns_b', x: -64, z: 54, item: { item: 'storm_stone', qty: 1 } },
  ],
  deepcut_route: [
    { id: 'thorns_a', x: -70, z: 68, item: { item: 'hyper_potion', qty: 1 } },
    { id: 'thorns_b', x: -62, z: -22, item: { item: 'nugget', qty: 1 } },
  ],
  hollow_route: [
    { id: 'thorns_a', x: -78, z: 50, item: { item: 'dusk_stone', qty: 1 } },
    { id: 'thorns_b', x: -60, z: 2, item: { item: 'max_ether', qty: 1 } },
  ],
  siege_route: [
    { id: 'thorns_a', x: -54, z: -56, item: { item: 'full_heal', qty: 2 } },
    { id: 'thorns_b', x: -50, z: 58, item: { item: 'max_potion', qty: 1 } },
  ],
  ascent_route: [
    { id: 'thorns_a', x: -52, z: 56, item: { item: 'moon_stone', qty: 1 } },
    { id: 'thorns_b', x: -48, z: -48, item: { item: 'max_revive', qty: 1 } },
  ],
  the_rift: [
    { id: 'thorns_a', x: -64, z: -32, item: { item: 'elixir', qty: 1 } },
    { id: 'thorns_b', x: -38, z: 60, item: { item: 'big_nugget', qty: 1 } },
  ],
};

/** Beside each route's campfire (2.5 m out, on the side away from the tent). */
export const DIG_SPOTS: Readonly<Partial<Record<ZoneId, readonly FieldSpotDef[]>>> = {
  mire_route: [{ id: 'camp', x: 45.5, z: -21 }],
  ash_route: [{ id: 'camp', x: -39.5, z: -41 }],
  tide_route: [{ id: 'camp', x: -13, z: 15 }],
  galvan_route: [{ id: 'camp', x: -25, z: 54 }],
  deepcut_route: [{ id: 'camp', x: 15, z: -36 }],
  hollow_route: [{ id: 'camp', x: 16, z: 32 }],
  siege_route: [{ id: 'camp', x: -20, z: -19.5 }],
  ascent_route: [{ id: 'camp', x: -18, z: -42 }],
};

/** The dark middle of a lake or the sea (open water ≥ 3 m from any shore). */
export const DIVE_SPOTS: Readonly<Partial<Record<ZoneId, readonly FieldSpotDef[]>>> = {
  mire_route: [{ id: 'lake', x: -0.5, z: 5 }],
  saltmourn: [{ id: 'sea', x: 0.5, z: 58 }],
  tide_route: [
    { id: 'sea', x: 61.5, z: -79.5 },
    { id: 'lagoon', x: -87.5, z: 64.5 },
  ],
  vesperveil: [{ id: 'pool', x: 30, z: 53 }],
  hollow_route: [{ id: 'mere', x: 16, z: -57 }],
  skyrend: [{ id: 'tarn', x: -17, z: 51 }],
  ascent_route: [{ id: 'tarn', x: -84, z: -47 }],
  solenne: [{ id: 'basin', x: 1, z: 56 }],
  umbral_observatory: [{ id: 'pool', x: 10, z: 50 }],
  the_rift: [
    { id: 'black_pool', x: -57.5, z: -49 },
    { id: 'deep_pool', x: -57.5, z: 55.5 },
  ],
};

/** What a dig turns up (one draw per camp, player and UTC day). */
export const DIG_LOOT: readonly { readonly item: string; readonly qty: number; readonly weight: number }[] = [
  { item: 'potion', qty: 2, weight: 26 },
  { item: 'superpotion', qty: 1, weight: 20 },
  { item: 'escape_rope', qty: 1, weight: 12 },
  { item: 'revive', qty: 1, weight: 12 },
  { item: 'stardust', qty: 1, weight: 12 },
  { item: 'nugget', qty: 1, weight: 8 },
  { item: 'moon_stone', qty: 1, weight: 5 },
  { item: 'rarecandy', qty: 1, weight: 5 },
];

/** What a dive brings up (one draw per spot, player and UTC day). */
export const DIVE_LOOT: readonly { readonly item: string; readonly qty: number; readonly weight: number }[] = [
  { item: 'tide_orb', qty: 2, weight: 24 },
  { item: 'stardust', qty: 1, weight: 20 },
  { item: 'star_piece', qty: 1, weight: 14 },
  { item: 'max_ether', qty: 1, weight: 12 },
  { item: 'tide_stone', qty: 1, weight: 10 },
  { item: 'big_nugget', qty: 1, weight: 8 },
  { item: 'full_restore', qty: 1, weight: 7 },
  { item: 'rarecandy', qty: 1, weight: 5 },
];
