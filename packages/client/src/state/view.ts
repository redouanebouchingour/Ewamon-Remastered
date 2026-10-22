/**
 * First-person view (2026-10-22): the toggle under the minimap (and F) switches the world camera between the diorama
 * and the player's eyes. World3D reads `firstPerson` every frame (it stays in the diorama during battles and the
 * arena); the choice is remembered per browser.
 */
import { create } from 'zustand';

const KEY = 'ewa:firstPerson';

function load(): boolean {
  try {
    return globalThis.localStorage?.getItem(KEY) === '1';
  } catch (_e) {
    return false;
  }
}

export interface ViewState {
  readonly firstPerson: boolean;
  setFirstPerson(on: boolean): void;
  toggle(): void;
}

export const useViewStore = create<ViewState>()((set, get) => ({
  firstPerson: load(),
  setFirstPerson: (on) => {
    set({ firstPerson: on });
    try {
      globalThis.localStorage?.setItem(KEY, on ? '1' : '0');
    } catch (_e) {
      // private mode / blocked storage: the toggle still works for this visit
    }
  },
  toggle: () => get().setFirstPerson(!get().firstPerson),
}));
