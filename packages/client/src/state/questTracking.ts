/**
 * Phase B3 — which story quest the journal's "Track" toggle pinned (UI-owned, persisted per browser under
 * 'ewa.questTrack'). The HUD quest hint reads it (World3D → `questHintFor`); a claimed or unknown id simply falls
 * back to the default hint. Storage failures (private mode, blocked site data) keep the choice for this tab only.
 */
import { create } from 'zustand';
import { createJSONStorage, persist, subscribeWithSelector } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';

export interface QuestTrackingState {
  readonly tracked: string | null;
  setTracked(questId: string | null): void;
  /** Track `questId`, or untrack it when it is already the tracked one. */
  toggle(questId: string): void;
}

const memory = new Map<string, string>();
const safeStorage: StateStorage = {
  getItem: (k) => {
    try {
      return localStorage.getItem(k);
    } catch (_e) {
      return memory.get(k) ?? null;
    }
  },
  setItem: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch (_e) {
      memory.set(k, v);
    }
  },
  removeItem: (k) => {
    try {
      localStorage.removeItem(k);
    } catch (_e) {
      memory.delete(k);
    }
  },
};

export const useQuestTracking = create<QuestTrackingState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        tracked: null,
        setTracked(questId) {
          set({ tracked: questId });
        },
        toggle(questId) {
          set({ tracked: get().tracked === questId ? null : questId });
        },
      }),
      {
        name: 'ewa.questTrack',
        version: 1,
        storage: createJSONStorage(() => safeStorage),
        partialize: (s) => ({ tracked: s.tracked }),
      },
    ),
  ),
);
