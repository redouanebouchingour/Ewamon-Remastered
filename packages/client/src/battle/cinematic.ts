/**
 * The signature move cinematic on screen (SignatureCinematic.tsx). BattleController writes it off the timeline step
 * (`cinematic` frames: 'start' shows a cue, 'aim' updates its battler points, 'clear' drops it); the overlay clears
 * its own cue once its clock has run out.
 */
import { create } from 'zustand';

/** A battler on screen in CSS px: its sprite's centre and height. */
export interface CinematicPoint {
  readonly x: number;
  readonly y: number;
  readonly h: number;
}

export interface CinematicCue {
  readonly id: number;
  /** the signature move id (a key of SIGNATURE_CINEMATICS) */
  readonly move: string;
  readonly mode: 'full' | 'short';
  /** the attacker stands on the near (viewer's) side: the overlay's fallback layout when a point is unknown */
  readonly fromNear: boolean;
  readonly from: CinematicPoint | null;
  readonly to: CinematicPoint | null;
  /** effective reduced motion: the cut-in fades in and out, no effect layer */
  readonly reduced: boolean;
}

interface CinematicState {
  readonly cue: CinematicCue | null;
  show(cue: CinematicCue): void;
  aim(id: number, from: CinematicPoint | null, to: CinematicPoint | null): void;
  /** drops cue `id` (any cue when omitted) */
  clear(id?: number): void;
}

export const useCinematicStore = create<CinematicState>()((set, get) => ({
  cue: null,
  show: (cue) => set({ cue }),
  aim: (id, from, to) => {
    const c = get().cue;
    if (c === null || c.id !== id) return;
    set({ cue: { ...c, from: from ?? c.from, to: to ?? c.to } });
  },
  clear: (id) => {
    const c = get().cue;
    if (c === null || (id !== undefined && c.id !== id)) return;
    set({ cue: null });
  },
}));
