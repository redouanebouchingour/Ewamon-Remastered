/**
 * Camp bases (SPEC §3.19, §20.4.9): the camp of the zone the player stands in as the zone room shows it (`ZoneState`
 * `campOwner` / `campName` / `campTrophies`). The world's `CampViews` writes it; the Camp screen reads it to know when
 * to fetch again (a claim, an edit, a raid that took the camp over).
 */
import { create } from 'zustand';
import type { TrophyKind } from '@ewa/content';

export interface ZoneCamp {
  /** the zone whose camp this is (null: none, or no world) */
  readonly zoneId: string | null;
  /** the holder's name ('' = free) */
  readonly owner: string;
  readonly name: string;
  readonly trophies: readonly TrophyKind[];
}

export interface CampState extends ZoneCamp {
  setCamp(c: ZoneCamp): void;
}

export const NO_CAMP: ZoneCamp = Object.freeze({ zoneId: null, owner: '', name: '', trophies: [] });

export const useCampStore = create<CampState>()((set) => ({
  ...NO_CAMP,
  setCamp: (c) => set({ zoneId: c.zoneId, owner: c.owner, name: c.name, trophies: c.trophies }),
}));
