/**
 * Watching battles in the open world: the battle the player follows in the Watch panel (`world/WatchPanel.tsx`) and
 * its running log. World3D starts it (E at a ring, or Watch on a player card), feeds it the `battleWatch` turns and
 * stops it when the player walks away from the ring; the panel stops it on Close / Escape and a while after the end.
 */
import { WATCH_LOG_MAX } from '@ewa/protocol';
import { create } from 'zustand';

export interface WatchLine {
  readonly seq: number;
  readonly text: string;
}

export interface WatchState {
  /** the watched battle (a `room.state.battles` key), null when not watching */
  readonly battleId: string | null;
  readonly log: readonly WatchLine[];
  /** the last turn's final line once the battle ended (the panel closes itself a while after) */
  readonly ended: string | null;
  start(battleId: string): void;
  stop(): void;
  push(battleId: string, lines: readonly string[]): void;
  end(battleId: string, line: string): void;
}

let seq = 0;

export const useWatchStore = create<WatchState>()((set, get) => ({
  battleId: null,
  log: [],
  ended: null,
  start: (battleId) => {
    if (get().battleId === battleId) return;
    set({ battleId, log: [], ended: null });
  },
  stop: () => set({ battleId: null, log: [], ended: null }),
  push: (battleId, lines) => {
    if (get().battleId !== battleId || lines.length === 0) return;
    const next = [...get().log, ...lines.map((text) => ({ seq: ++seq, text }))];
    set({ log: next.slice(-WATCH_LOG_MAX) });
  },
  end: (battleId, line) => {
    if (get().battleId !== battleId || get().ended !== null) return;
    set({ ended: line });
  },
}));
