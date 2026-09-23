/**
 * §3.6 live-ops re-keyed to ZoneIds (roster-coverage.md §12.2–§12.4) and §3.7 variant palettes (legacy
 * liveOps.js VARIANT_PALETTES / WEEKDAY_VARIANT_SCHEDULE verbatim).
 */
import type { DailySwarm, RaidHotspot, SeasonalEvent, VariantPalettes, WeekdayVariant } from '../types';

export const SEASONAL_EVENTS: readonly SeasonalEvent[] = [
  {
    id: 'verdant_bloom',
    name: 'Verdant Bloom',
    description: 'The hedgerows flare green at the equinox. Early routes teem with colourful variants and fresh witnesses.',
    startsAt: '2027-03-20T00:00:00Z',
    endsAt: '2027-04-03T00:00:00Z',
    alphaBonus: 0.008,
    variantBonus: 0.04,
    featuredZones: ['mire_route', 'solenne'],
    featuredSpecies: ['bloomsprite', 'seedrift', 'bramblecub', 'resilian', 'snapling'],
  },
  {
    id: 'tideglass_festival',
    name: 'Tideglass Festival',
    description: 'Midsummer on the salt coast. The basin and the boardwalk glitter with polished ocean-born variants.',
    startsAt: '2027-06-21T00:00:00Z',
    endsAt: '2027-07-05T00:00:00Z',
    alphaBonus: 0.012,
    variantBonus: 0.028,
    featuredZones: ['tide_route', 'saltmourn'],
    featuredSpecies: ['kygra', 'ripshell', 'glimfin', 'shiveruff', 'wraithtide'],
  },
  {
    id: 'starfall_surge',
    name: 'Starfall Surge',
    description: 'Static in the autumn sky sharpens rare encounters over the span and on the top step.',
    startsAt: '2027-09-22T00:00:00Z',
    endsAt: '2027-10-06T00:00:00Z',
    alphaBonus: 0.018,
    variantBonus: 0.03,
    featuredZones: ['galvan_route', 'celestial_spire'],
    featuredSpecies: ['raidori', 'flowbot', 'alloylark', 'stormchick', 'gustuff'],
  },
  {
    id: 'long_night',
    name: 'The Long Night',
    description: 'The solstice fortnight. The night roster walks a little further into the day in every loose-memoried place.',
    startsAt: '2027-12-21T00:00:00Z',
    endsAt: '2028-01-04T00:00:00Z',
    alphaBonus: 0.015,
    variantBonus: 0.035,
    featuredZones: ['hollow_route', 'umbral_observatory', 'the_rift'],
    featuredSpecies: ['darkone', 'malice', 'rimeidol', 'umbrit', 'miscarmen'],
  },
];

/** 7 entries, index = Date#getUTCDay() (0 = Sunday); RC-12: species ⊆ the zone's table. */
export const DAILY_SWARMS: readonly DailySwarm[] = [
  { id: 'swarm_sun_mire', zoneId: 'mire_route', species: ['mossling', 'seedrift', 'resilian'], weightBoost: 3 },
  { id: 'swarm_mon_ash', zoneId: 'ash_route', species: ['flampling', 'fennorange', 'wickling'], weightBoost: 3 },
  { id: 'swarm_tue_tide', zoneId: 'tide_route', species: ['shiveruff', 'brookrawl', 'ripshell'], weightBoost: 3 },
  { id: 'swarm_wed_galvan', zoneId: 'galvan_route', species: ['ampmite', 'gustuff', 'darkone'], weightBoost: 3 },
  { id: 'swarm_thu_deepcut', zoneId: 'deepcut_route', species: ['pebblit', 'rimeidol', 'yahit'], weightBoost: 3 },
  { id: 'swarm_fri_hollow', zoneId: 'hollow_route', species: ['nettlewisp', 'hexroach', 'wraithtide'], weightBoost: 3 },
  { id: 'swarm_sat_siege', zoneId: 'siege_route', species: ['grubolt', 'coldplate', 'acier'], weightBoost: 3 },
];

/** One per route; boss level above the route band; minBadges = the route's index in badge order. */
export const RAID_HOTSPOTS: readonly RaidHotspot[] = [
  { id: 'raid_mire_thornback', zoneId: 'mire_route', x: 60, z: -40, boss: { species: 'thornback', level: 18, hpMultiplier: 6 }, minBadges: 0, window: { utcHour: 17, minutes: 30 } },
  { id: 'raid_ash_moblaze', zoneId: 'ash_route', x: -72, z: 36, boss: { species: 'moblaze', level: 26, hpMultiplier: 8 }, minBadges: 1, window: { utcHour: 18, minutes: 30 } },
  { id: 'raid_tide_kygra', zoneId: 'tide_route', x: 88, z: 64, boss: { species: 'kygra', level: 30, hpMultiplier: 10 }, minBadges: 2, window: { utcHour: 19, minutes: 30 } },
  { id: 'raid_galvan_raidori', zoneId: 'galvan_route', x: -40, z: -90, boss: { species: 'raidori', level: 34, hpMultiplier: 12 }, minBadges: 3, window: { utcHour: 20, minutes: 30 } },
  { id: 'raid_deepcut_prismolith', zoneId: 'deepcut_route', x: 30, z: 100, boss: { species: 'prismolith', level: 40, hpMultiplier: 14 }, minBadges: 4, window: { utcHour: 21, minutes: 30 } },
  { id: 'raid_hollow_wraithtide', zoneId: 'hollow_route', x: -96, z: -20, boss: { species: 'wraithtide', level: 44, hpMultiplier: 16 }, minBadges: 5, window: { utcHour: 22, minutes: 30 } },
  { id: 'raid_siege_acier', zoneId: 'siege_route', x: 70, z: -70, boss: { species: 'acier', level: 48, hpMultiplier: 18 }, minBadges: 6, window: { utcHour: 23, minutes: 30 } },
  { id: 'raid_ascent_pyrothal', zoneId: 'ascent_route', x: 0, z: 104, boss: { species: 'pyrothal', level: 56, hpMultiplier: 20 }, minBadges: 7, window: { utcHour: 0, minutes: 30 } },
];

/** Mon dawn, Tue dusk, Wed verdant, Thu ember (legacy WEEKDAY_VARIANT_SCHEDULE). */
export const WEEKDAY_VARIANT: WeekdayVariant = {
  0: null,
  1: 'dawn',
  2: 'dusk',
  3: 'verdant',
  4: 'ember',
  5: null,
  6: null,
};

/** §3.7 — sprite material uniforms; no pixel is re-baked. */
export const VARIANT_PALETTES: VariantPalettes = {
  normal: null,
  dawn: { hue: 18, saturation: 1.08, lightness: 1.04 },
  dusk: { hue: 204, saturation: 1.1, lightness: 0.95 },
  verdant: { hue: 110, saturation: 1.12, lightness: 1.05 },
  ember: { hue: -18, saturation: 1.15, lightness: 1.02 },
};
