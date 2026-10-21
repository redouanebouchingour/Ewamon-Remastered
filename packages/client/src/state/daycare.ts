/**
 * Breeding: the Daycare and the trainer's eggs as the server last answered (`GET /daycare`, and every daycare / egg
 * action's `daycare`). The Daycare screen, the Party screen's carried eggs and the Box's waiting eggs read it; a hatch
 * refreshes it. The hatch reveal queue lives here too: `eggHatched` pushes, the reveal shows one at a time.
 */
import { create } from 'zustand';
import type { CreatureInstance } from '@ewa/core';
import type { DaycareView } from '@ewa/protocol';
import { apiFetch } from '../net/api';

export interface HatchReveal {
  readonly eggId: string;
  readonly creature: CreatureInstance;
  readonly placement: 'party' | 'box';
  readonly parents: readonly [string, string];
  readonly zoneId: string;
}

export interface DaycareUi {
  readonly view: DaycareView | null;
  /** hatches waiting to be shown, oldest first; [0] is on screen */
  readonly hatches: readonly HatchReveal[];
  set(view: DaycareView): void;
  refresh(): Promise<void>;
  pushHatch(h: HatchReveal): void;
  /** the reveal on screen was dismissed */
  shiftHatch(): void;
  reset(): void;
}

export const useDaycareStore = create<DaycareUi>()((set) => ({
  view: null,
  hatches: [],
  set(view) {
    set({ view });
  },
  async refresh() {
    try {
      set({ view: await apiFetch('daycare') });
    } catch (_e) {
      // the screens keep what they had; a later action answers with the view again
    }
  },
  pushHatch(h) {
    set((st) => (st.hatches.some((x) => x.eggId === h.eggId) ? st : { hatches: [...st.hatches, h] }));
  },
  shiftHatch() {
    set((st) => ({ hatches: st.hatches.slice(1) }));
  },
  reset() {
    set({ view: null, hatches: [] });
  },
}));

/** "412 steps to go" / "Ready to hatch" */
export function stepsLeftText(e: { readonly stepsTotal: number; readonly stepsWalked: number }): string {
  const left = Math.max(0, e.stepsTotal - e.stepsWalked);
  return left === 0 ? 'Ready to hatch' : `${left} step${left === 1 ? '' : 's'} to go`;
}
