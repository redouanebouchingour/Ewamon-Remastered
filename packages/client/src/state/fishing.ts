/**
 * Phase D9: the fishing prompt's display state (`FishingPrompt` reads it) and the reel / cancel actions World3D binds
 * to its `FishingController` (the overlay owns the keys while a cast is out, like the dialogue box).
 */
import { create } from 'zustand';
import type { FishingPhase } from '../scene/fishing';

export interface FishingState {
  readonly phase: FishingPhase;
  setPhase(p: FishingPhase): void;
}

export const useFishingStore = create<FishingState>()((set) => ({
  phase: 'idle',
  setPhase: (phase) => set({ phase }),
}));

export interface FishingActions {
  press(): void;
  cancel(): void;
}

let actions: FishingActions | null = null;

export function setFishingActions(a: FishingActions | null): void {
  actions = a;
}

export function fishingActions(): FishingActions | null {
  return actions;
}
