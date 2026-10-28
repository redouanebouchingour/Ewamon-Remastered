import { describe, expect, it } from 'vitest';
import { TYPE_NAMES } from '@ewa/core';
import {
  BANNER_BACKDROPS,
  BANNER_FRAMES,
  BANNER_PINS,
  BANNER_TRACKERS,
  DEFAULT_BANNER,
  bannerFrame,
  bannerPin,
  bannerProgress,
  bannerRefusal,
  bannerShown,
  bannerUnlocked,
  pinTier,
} from '../src/index';
import type { BannerStats } from '../src/index';

const ZERO: BannerStats = {
  badges: 0, dexCaught: 1, trainerLevel: 1, rating: 1000, peakRating: 1000, towerBest: 0, shinies: 0, legendaries: 0, pvpWins: 0,
  achievements: 0, champion: false, seasonBest: 0, typeCaught: { Grass: 1 },
};

describe('banner content', () => {
  it('has unique ids, a backdrop per type and a default that a new trainer may wear', () => {
    for (const list of [BANNER_FRAMES, BANNER_BACKDROPS, BANNER_PINS, BANNER_TRACKERS]) expect(new Set(list.map((x) => x.id)).size).toBe(list.length);
    for (const t of TYPE_NAMES) expect(BANNER_BACKDROPS.some((b) => b.type === t)).toBe(true);
    expect(bannerRefusal(DEFAULT_BANNER, ZERO)).toBeNull();
  });

  it('every unlock can be met (a type backdrop never asks more species than the type has)', () => {
    const max: BannerStats = { ...ZERO, badges: 8, dexCaught: 999, trainerLevel: 100, peakRating: 9999, towerBest: 999, shinies: 99, legendaries: 15, pvpWins: 999, achievements: 99, champion: true, seasonBest: 1, typeCaught: Object.fromEntries(TYPE_NAMES.map((t) => [t, 99])) };
    for (const f of BANNER_FRAMES) expect(bannerUnlocked(f.unlock, max)).toBe(true);
    for (const b of BANNER_BACKDROPS) expect(bannerUnlocked(b.unlock, max)).toBe(true);
    for (const p of BANNER_PINS) expect(pinTier(p, max)).toBe(p.tiers.length);
  });

  it('pins climb tiers with the count', () => {
    const gyms = bannerPin('gym_conqueror')!;
    expect(pinTier(gyms, ZERO)).toBe(0);
    expect(pinTier(gyms, { ...ZERO, badges: 5 })).toBe(2);
    expect(pinTier(gyms, { ...ZERO, badges: 8 })).toBe(4);
    expect(pinTier(bannerPin('season_finalist')!, { ...ZERO, seasonBest: 6 })).toBe(1);
    expect(pinTier(bannerPin('season_champion')!, { ...ZERO, seasonBest: 6 })).toBe(0);
  });

  it('refuses locked, unknown and doubled picks', () => {
    expect(bannerRefusal({ ...DEFAULT_BANNER, frame: 'laurel' }, ZERO)).toBe('frameLocked');
    expect(bannerRefusal({ ...DEFAULT_BANNER, frame: 'laurel' }, { ...ZERO, champion: true })).toBeNull();
    expect(bannerRefusal({ ...DEFAULT_BANNER, backdrop: 'type_fire' }, ZERO)).toBe('backdropLocked');
    expect(bannerRefusal({ ...DEFAULT_BANNER, backdrop: 'type_fire' }, { ...ZERO, typeCaught: { Fire: 5 } })).toBeNull();
    expect(bannerRefusal({ ...DEFAULT_BANNER, frame: 'gold' }, ZERO)).toBe('unknownFrame');
    expect(bannerRefusal({ ...DEFAULT_BANNER, trackers: ['rating', 'rating'] }, ZERO)).toBe('trackers');
    expect(bannerRefusal({ ...DEFAULT_BANNER, trackers: ['rating', 'badges', 'shinies', 'pvpWins'] }, ZERO)).toBe('trackers');
  });

  it('shows the default in place of what no longer stands', () => {
    const shown = bannerShown({ frame: 'prismatic', backdrop: 'aurora', pins: ['shiny_hunter', 'collector'], trackers: ['shinies'], featuredId: null }, { ...ZERO, dexCaught: 30 });
    expect(shown).toEqual({ frame: DEFAULT_BANNER.frame, backdrop: DEFAULT_BANNER.backdrop, pins: ['collector'], trackers: ['shinies'], featuredId: null });
  });

  it('measures progress toward an unlock', () => {
    expect(bannerProgress(bannerFrame('circuit')!.unlock, { ...ZERO, badges: 2 })).toBe(0.5);
    expect(bannerProgress(bannerFrame('laurel')!.unlock, ZERO)).toBe(0);
  });
});
