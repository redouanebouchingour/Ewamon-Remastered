/**
 * §3.2 encounter tables — the 15 tables of .design/roster-coverage.md §6 transcribed row for row
 * (8 routes, 3 towns, 4 story tables; A1 and A2 accepted per the spec CHANGELOG), plus the spawn constants. Phase D8
 * added water slots where the heightfield has ponds a table did not fish yet (mire_route, skyrend, umbral_observatory)
 * — species already placed elsewhere, so the directly-placed set stayed 79. The post-legacy hollowmane (#131) adds a
 * night rare slot to the_rift and dustcub (#132) an uncommon slot to deepcut_route: 81 placed directly.
 */
import type { EncounterSlot, EncounterTable, EncounterTier, Medium, SpawnTuning, TimeOfDay, ZoneId } from '../types';

/** per spawn roll, independent of tier weights */
export const ALPHA_CHANCE = 0.02;
/** per spawn roll; palette uniform over the 4 non-normal keys */
export const VARIANT_CHANCE = 0.03;

export const ROUTE_TUNING: SpawnTuning = {
  targetCount: 14,
  respawnMinMs: 8_000,
  respawnMaxMs: 20_000,
  lifetimeMs: 180_000,
  engagedTimeoutMs: 90_000,
};
export const TOWN_SPAWN_TUNING: SpawnTuning = {
  targetCount: 4,
  respawnMinMs: 8_000,
  respawnMaxMs: 20_000,
  lifetimeMs: 180_000,
  engagedTimeoutMs: 90_000,
};
export const STORY_TUNING: SpawnTuning = {
  targetCount: 6,
  respawnMinMs: 12_000,
  respawnMaxMs: 30_000,
  lifetimeMs: 180_000,
  engagedTimeoutMs: 90_000,
};

/** roster-coverage §5 level bands per zone with a table (RC-2). */
export const ENCOUNTER_BANDS: Readonly<Partial<Record<ZoneId, readonly [number, number]>>> = {
  mire_route: [2, 6],
  ash_route: [7, 11],
  tide_route: [11, 15],
  galvan_route: [15, 20],
  deepcut_route: [20, 25],
  hollow_route: [25, 30],
  siege_route: [30, 35],
  ascent_route: [35, 42],
  saltmourn: [14, 24],
  skyrend: [38, 44],
  solenne: [40, 45],
  eclipse_shrine: [45, 50],
  umbral_observatory: [42, 48],
  celestial_spire: [50, 55],
  the_rift: [55, 60],
};

const s = (
  species: string,
  weight: number,
  levelMin: number,
  levelMax: number,
  timeOfDay: TimeOfDay,
  tier: EncounterTier,
  medium: Medium = 'land',
): EncounterSlot =>
  medium === 'land'
    ? { species, weight, levelMin, levelMax, timeOfDay, tier }
    : { species, weight, levelMin, levelMax, timeOfDay, tier, medium };

const table = (zoneId: ZoneId, slots: readonly EncounterSlot[]): EncounterTable => ({
  id: `enc_${zoneId}`,
  zoneId,
  slots,
});

export const ENCOUNTER_TABLES: readonly EncounterTable[] = [
  // 6.1 mire_route — grove, Grass, L2–6
  table('mire_route', [
    s('mossling', 8, 2, 5, 'any', 'common'),
    s('glimp', 7, 2, 4, 'any', 'common'),
    s('smellduck', 7, 2, 5, 'any', 'common'),
    s('mufflo', 6, 2, 4, 'any', 'common'),
    s('seedrift', 6, 3, 5, 'day', 'common'),
    s('resilian', 5, 2, 5, 'day', 'uncommon'),
    s('dreambud', 5, 3, 5, 'night', 'uncommon'),
    s('snapling', 5, 3, 6, 'night', 'uncommon'),
    s('bramblecub', 3, 4, 6, 'any', 'rare'),
    s('bloomsprite', 2, 4, 6, 'day', 'rare'),
    // Phase D8: the mire's ponds (boardwalk, Old Rod, later HM Surf)
    s('mossling', 5, 3, 6, 'day', 'uncommon', 'water'),
    s('mudbub', 5, 3, 6, 'night', 'uncommon', 'water'),
    s('mossling', 1, 6, 6, 'any', 'alpha'),
  ]),
  // 6.2 ash_route — cinder, Fire, L7–11
  table('ash_route', [
    s('flampling', 8, 7, 10, 'day', 'common'),
    s('embrock', 7, 7, 10, 'any', 'common'),
    s('fennorange', 7, 7, 10, 'any', 'common'),
    s('pebfist', 6, 7, 9, 'any', 'common'),
    s('coalette', 5, 8, 11, 'any', 'uncommon'),
    s('wickling', 5, 7, 10, 'night', 'uncommon'),
    s('cindercap', 3, 8, 11, 'any', 'rare'),
    s('moflame', 2, 9, 11, 'night', 'rare'),
    s('flampling', 1, 11, 11, 'day', 'alpha'),
  ]),
  // 6.3 tide_route — salt, Water, L11–15 (surf zone)
  table('tide_route', [
    s('mudbub', 8, 11, 14, 'any', 'common'),
    s('brookrawl', 7, 11, 14, 'any', 'common'),
    s('shiveruff', 7, 11, 14, 'any', 'common'),
    s('slushpup', 6, 12, 15, 'any', 'common'),
    s('mossling', 6, 11, 13, 'any', 'common'),
    s('glowtent', 5, 12, 15, 'night', 'uncommon', 'water'),
    s('tidespine', 5, 12, 15, 'any', 'uncommon', 'water'),
    s('glimfin', 3, 13, 15, 'any', 'rare', 'water'),
    s('ripshell', 3, 13, 15, 'any', 'rare', 'water'),
    s('kygra', 2, 14, 15, 'day', 'rare', 'water'),
    s('mudbub', 1, 15, 15, 'any', 'alpha'),
  ]),
  // 6.4 galvan_route — storm, Electric, L15–20
  table('galvan_route', [
    s('ampmite', 8, 15, 18, 'any', 'common'),
    s('stormchick', 7, 15, 18, 'day', 'common'),
    s('gustuff', 7, 15, 18, 'any', 'common'),
    s('mufflo', 6, 15, 17, 'any', 'common'),
    s('shardling', 5, 17, 20, 'any', 'uncommon'),
    s('glimfin', 5, 16, 20, 'any', 'uncommon', 'water'),
    s('wooltug', 4, 20, 20, 'any', 'rare'),
    s('darkone', 3, 17, 20, 'night', 'rare'),
    s('raidori', 2, 18, 20, 'night', 'rare'),
    s('ampmite', 1, 20, 20, 'any', 'alpha'),
  ]),
  // 6.5 deepcut_route — marrow, Rock, L20–25
  table('deepcut_route', [
    s('pebblit', 8, 20, 23, 'any', 'common'),
    s('fennorange', 7, 20, 23, 'any', 'common'),
    s('pebfist', 7, 20, 23, 'any', 'common'),
    s('embrock', 6, 20, 23, 'any', 'common'),
    s('coalette', 5, 22, 25, 'any', 'uncommon'),
    s('berkest', 5, 21, 24, 'any', 'uncommon'),
    s('dustcub', 5, 20, 24, 'any', 'uncommon'),
    s('wooltug', 5, 20, 23, 'any', 'uncommon'),
    s('rimeidol', 5, 21, 25, 'night', 'uncommon'),
    s('yahit', 3, 22, 25, 'any', 'rare'),
    s('pyrecap', 2, 20, 23, 'any', 'rare'),
    s('lithokrysm', 2, 24, 25, 'any', 'rare'),
    s('pebblit', 1, 25, 25, 'any', 'alpha'),
  ]),
  // 6.6 hollow_route — vesper, Ghost, L25–30
  table('hollow_route', [
    s('nettlewisp', 8, 25, 28, 'night', 'common'),
    s('murkrat', 7, 25, 28, 'night', 'common'),
    s('zaptus', 7, 25, 28, 'any', 'common'),
    s('hexroach', 6, 26, 29, 'any', 'common'),
    s('fibrostis', 5, 25, 28, 'any', 'uncommon'),
    s('nerohat', 5, 27, 30, 'night', 'uncommon'),
    s('umbrit', 5, 27, 30, 'night', 'uncommon'),
    s('briarbear', 5, 25, 28, 'any', 'uncommon'),
    s('nebucloak', 5, 25, 28, 'any', 'uncommon'),
    s('murmink', 5, 25, 28, 'night', 'uncommon'),
    s('darkone', 3, 28, 30, 'night', 'rare'),
    s('miscarmen', 3, 26, 29, 'night', 'rare'),
    s('malice', 2, 27, 30, 'night', 'rare'),
    s('wraithtide', 2, 28, 30, 'night', 'rare', 'water'),
    s('nettlewisp', 1, 30, 30, 'night', 'alpha'),
  ]),
  // 6.7 siege_route — forge, Steel, L30–35
  table('siege_route', [
    s('grubolt', 8, 30, 33, 'any', 'common'),
    s('coldplate', 7, 30, 33, 'any', 'common'),
    s('shardling', 7, 30, 33, 'any', 'common'),
    s('scraphog', 6, 32, 35, 'any', 'common'),
    s('alloylark', 5, 32, 35, 'day', 'uncommon'),
    s('lithokrysm', 5, 30, 33, 'any', 'uncommon'),
    s('yaschamp', 5, 30, 33, 'any', 'uncommon'),
    s('coalette', 5, 30, 33, 'night', 'uncommon'),
    s('flowbot', 2, 33, 35, 'any', 'rare'),
    s('acier', 2, 33, 35, 'any', 'rare'),
    s('grubolt', 1, 35, 35, 'any', 'alpha'),
  ]),
  // 6.8 ascent_route — sky, Dragon, L35–42 (surf: the glacier melt)
  table('ascent_route', [
    s('scalewisp', 8, 35, 38, 'any', 'common'),
    s('budwing', 7, 35, 38, 'day', 'common'),
    s('shiveruff', 7, 35, 38, 'any', 'common'),
    s('glacifang', 6, 36, 39, 'any', 'common'),
    s('tidalfang', 5, 36, 39, 'any', 'uncommon', 'water'),
    s('blizzhowl', 5, 35, 38, 'night', 'uncommon'),
    s('bloomdrake', 5, 36, 39, 'day', 'uncommon'),
    s('resilith', 5, 35, 38, 'any', 'uncommon'),
    s('serpyre', 3, 39, 42, 'any', 'rare'),
    s('umbrit', 3, 38, 42, 'night', 'rare'),
    s('scalewisp', 1, 42, 42, 'any', 'alpha'),
  ]),
  // 6.9 saltmourn — town static: the drowned harbour, L14–24 (all water)
  table('saltmourn', [
    s('tidespine', 5, 14, 18, 'any', 'uncommon', 'water'),
    s('ripshell', 5, 15, 19, 'any', 'uncommon', 'water'),
    s('glimfin', 3, 14, 18, 'any', 'rare', 'water'),
    s('kygra', 2, 16, 20, 'day', 'rare', 'water'),
    s('wraithtide', 2, 16, 20, 'night', 'rare', 'water'),
    s('voltide', 2, 20, 24, 'any', 'rare', 'water'),
  ]),
  // 6.10 skyrend — town static: the cliff roosts, L38–44
  table('skyrend', [
    s('scalewisp', 6, 38, 42, 'any', 'common'),
    s('budwing', 5, 38, 42, 'any', 'uncommon'),
    s('alloylark', 5, 38, 42, 'day', 'uncommon'),
    s('glacifang', 5, 39, 44, 'night', 'uncommon'),
    s('resilith', 3, 40, 44, 'any', 'rare'),
    // Phase D8: the meltwater tarn under the roosts
    s('tidalfang', 3, 39, 44, 'any', 'rare', 'water'),
  ]),
  // 6.11 solenne — town static: the suburb park and pond, L40–45
  table('solenne', [
    s('glimp', 6, 40, 43, 'any', 'common'),
    s('smellduck', 6, 40, 43, 'any', 'common', 'water'),
    s('mufflo', 6, 40, 43, 'any', 'common'),
    s('dreambud', 5, 40, 44, 'night', 'uncommon'),
    s('wooltug', 5, 41, 45, 'any', 'uncommon'),
    s('bloomsprite', 3, 42, 45, 'day', 'rare'),
  ]),
  // 6.12 eclipse_shrine — story, Cosmic, L45–50
  table('eclipse_shrine', [
    s('zaptus', 7, 45, 48, 'any', 'common'),
    s('scalewisp', 6, 45, 48, 'day', 'common'),
    s('umbrit', 6, 45, 48, 'night', 'common'),
    s('nebucloak', 5, 45, 49, 'any', 'uncommon'),
    s('shardling', 5, 45, 48, 'any', 'uncommon'),
    s('nerohat', 5, 45, 48, 'night', 'uncommon'),
    s('miscarmen', 3, 45, 48, 'night', 'rare'),
    s('malice', 2, 46, 50, 'night', 'rare'),
    s('devourest', 2, 46, 50, 'night', 'rare'),
  ]),
  // 6.13 umbral_observatory — story, Ghost/Dark, L42–48
  table('umbral_observatory', [
    s('darkone', 7, 42, 45, 'night', 'common'),
    s('zaptus', 6, 42, 45, 'any', 'common'),
    s('hexroach', 6, 42, 45, 'any', 'common'),
    s('rimeidol', 5, 42, 46, 'night', 'uncommon'),
    s('nerohat', 5, 42, 46, 'night', 'uncommon'),
    s('murmink', 5, 43, 47, 'night', 'uncommon'),
    s('nebucloak', 5, 42, 46, 'any', 'uncommon'),
    s('fibrostis', 5, 42, 46, 'any', 'uncommon'),
    s('miscarmen', 3, 43, 47, 'night', 'rare'),
    s('aonred', 2, 44, 48, 'night', 'rare'),
    s('darkyon', 2, 44, 48, 'night', 'rare'),
    // Phase D8: the black moat under the dome
    s('wraithtide', 3, 43, 47, 'night', 'rare', 'water'),
  ]),
  // 6.14 celestial_spire — story, Cosmic, L50–55
  table('celestial_spire', [
    s('gustuff', 7, 50, 53, 'any', 'common'),
    s('seedrift', 6, 50, 53, 'day', 'common'),
    s('stormchick', 6, 50, 53, 'day', 'common'),
    s('dreambud', 5, 50, 53, 'any', 'uncommon'),
    s('shardling', 5, 50, 53, 'any', 'uncommon'),
    s('alloylark', 5, 51, 55, 'any', 'uncommon'),
    s('resilith', 5, 52, 55, 'any', 'uncommon'),
    s('bloomsprite', 3, 52, 55, 'day', 'rare'),
    s('flowbot', 2, 53, 55, 'any', 'rare'),
  ]),
  // 6.15 the_rift — story, Cosmic, L55–60 (surf: the black water)
  table('the_rift', [
    s('umbrit', 7, 55, 58, 'night', 'common'),
    s('glacifang', 6, 55, 58, 'any', 'common'),
    s('murkrat', 6, 55, 58, 'night', 'common'),
    s('tidalfang', 5, 55, 58, 'any', 'uncommon', 'water'),
    s('yaschamp', 5, 55, 58, 'any', 'uncommon'),
    s('serpyre', 3, 57, 60, 'any', 'rare'),
    s('malice', 2, 56, 60, 'night', 'rare'),
    s('devourest', 2, 57, 60, 'night', 'rare'),
    s('wraithtide', 2, 56, 60, 'night', 'rare', 'water'),
    s('acier', 2, 58, 60, 'any', 'rare'),
    s('ripshell', 2, 57, 60, 'any', 'rare', 'water'),
    s('kygra', 2, 58, 60, 'day', 'rare', 'water'),
    s('hollowmane', 2, 57, 60, 'night', 'rare'),
  ]),
];
