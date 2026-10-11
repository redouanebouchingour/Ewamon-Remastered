/**
 * The bond cinematic ("Heartsync", `.design/majin-tenjin.md` §9): when a trainer's Majin or Tenjin Band transforms
 * a creature, a DOM overlay plays before the form's 3D burst (BondCinematic.tsx). The trainer's band and the
 * creature's portrait come in on two slanted bands, each with its own heartbeat; the beats speed up and close in on
 * each other until they land together (SYNC 100 %); a light thread runs from the band's lens to the creature, and
 * then the two bands give the two answers of the story:
 *   - Majin (the Provision's lens: it shows the memory being unsaid): a ledger line reads "<NAME> · UNSAID" and is
 *     struck through; the strike cracks, crimson cracks race across the screen, the cracked ring breaks and the
 *     stamp says REFUSED;
 *   - Tenjin (Wynn's Attestor lens: it shows the memory it is held): the screen cracks too, gold seams run into every
 *     crack and mend it (kintsugi), the whole gold ring closes and the stamp says HELD.
 * The overlay then breaks away and the 3D burst, the sprite swap and the aura play underneath.
 *
 * One clock from the `bond` timeline frame (ms). The sound (`bond_majin` / `bond_tenjin`, tools/audio-pipeline
 * cc0-tools/mix.py "bond") is timed from the same frame: its heartbeats sit on BOND_BEATS, the crack / bell on
 * BOND_LOCK_MS, the roar / choir on BOND_BURST_MS. Change the numbers here and there together.
 *
 * Only a trainer's transformation plays it (a band in a side's pocket); a wild Majin breaks open alone, with the
 * plain burst — nobody holds it.
 */
import type { BandKind } from '@ewa/core';
import { create } from 'zustand';

/** The trainer's and the creature's heartbeats (ms from the frame): they speed up and close in, the last pair lands together. */
export const BOND_BEATS: { readonly trainer: readonly number[]; readonly creature: readonly number[] } = {
  trainer: [380, 940, 1420, 1820, 2120],
  creature: [600, 1080, 1500, 1850, 2120],
};
/** Both hearts have met: the SYNC readout reaches 100 %. */
export const BOND_SYNC_MS = 2120;
/** The answer: the strike cracks (Majin) / the gold seams flow (Tenjin), the ring breaks / closes, the stamp. */
export const BOND_LOCK_MS = 2400;
/** The overlay breaks away; the timeline's form burst, flash and shake start here (the sprite swaps just after). */
export const BOND_BURST_MS = 2700;
/** The overlay's full length (it is gone by then). */
export const BOND_TOTAL_MS = 3300;

export interface BondStyle {
  /** small caps over the trainer's name */
  readonly kicker: string;
  /** the ledger line's verdict after the creature's name */
  readonly verdict: string;
  /** the stamp at the lock */
  readonly stamp: string;
  readonly palette: { readonly accent: string; readonly deep: string; readonly hot: string };
  /** the sound design (audio manifest), played from the frame */
  readonly sfx: string;
}

export const BOND_STYLE: Readonly<Record<BandKind, BondStyle>> = {
  majin: {
    kicker: 'Majin Band',
    verdict: 'Unsaid',
    stamp: 'Refused',
    palette: { accent: '#e0193a', deep: '#2a0309', hot: '#ff5a48' },
    sfx: 'bond_majin',
  },
  tenjin: {
    kicker: 'Tenjin Band',
    verdict: 'Held',
    stamp: 'Held',
    palette: { accent: '#f2c14e', deep: '#2a1d05', hot: '#fff1c2' },
    sfx: 'bond_tenjin',
  },
};

/** The sound ids the bond can play (TIMELINE_SFX). */
export const BOND_SFX: readonly string[] = [BOND_STYLE.majin.sfx, BOND_STYLE.tenjin.sfx];

/** The cut-in portraits (`public/signature/<id>.webp`, `pnpm --filter @ewa/sprite-pipeline portraits`): before and after. */
export function bondPortraits(speciesId: string, form: string): { readonly before: string; readonly after: string } {
  return { before: `/signature/${speciesId}.webp`, after: `/signature/${speciesId}_${form}.webp` };
}

export interface BondCue {
  readonly id: number;
  readonly kind: BandKind;
  readonly speciesId: string;
  readonly form: string;
  /** the creature's display name ("Toxshade", a nickname) */
  readonly name: string;
  /** the trainer's name on the band ("Reeve", the player's username) */
  readonly trainer: string;
  /** the transforming battler stands on the near (viewer's) side: the layout mirrors for the far side */
  readonly near: boolean;
  /** effective reduced motion: still cards that fade, no cracks flying, no flash */
  readonly reduced: boolean;
  /**
   * ms since the `bond` frame on the battle timeline's clock (TimelinePlayer.clock), so the overlay keeps the sound's
   * and the burst's beats when the world steps slower than real time. Absent (dev preview, tests): the wall clock.
   */
  readonly clock?: () => number;
}

interface BondState {
  readonly cue: BondCue | null;
  show(cue: BondCue): void;
  /** drops cue `id` (any cue when omitted) */
  clear(id?: number): void;
}

export const useBondStore = create<BondState>()((set, get) => ({
  cue: null,
  show: (cue) => set({ cue }),
  clear: (id) => {
    const c = get().cue;
    if (c === null || (id !== undefined && c.id !== id)) return;
    set({ cue: null });
  },
}));
