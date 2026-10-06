/**
 * Phase D13 — the ranked queue as the client sees it. Written ONLY from the server's `rankedStatus` (messageRouter) and
 * reset when the world connection ends (the server drops a queue entry on a real leave). Display state: the rating
 * shown is the server's; the elapsed time is counted locally from `waitedMs` at receipt.
 */
import { create } from 'zustand';
import type { RankedIdleReason, RankedState, ServerMessageOf } from '@ewa/protocol';

/** A 'matched' that never turns into a battle (the arena move failed silently) reads as idle after this long. */
export const MATCHED_STALE_MS = 30_000;

export interface RankedUi {
  readonly state: RankedState;
  /** the server's rating at the last status; null before any status this session */
  readonly rating: number | null;
  /** Date.now() the player joined the queue (receipt time − waitedMs) */
  readonly queuedAt: number;
  /** Date.now() a match was announced */
  readonly matchedAt: number;
  readonly opponent: { readonly name: string; readonly rating: number } | null;
  readonly reason: RankedIdleReason | null;
  apply(m: ServerMessageOf<'rankedStatus'>, now?: number): void;
  reset(): void;
}

const INITIAL = { state: 'idle', rating: null, queuedAt: 0, matchedAt: 0, opponent: null, reason: null } as const;

export const useRankedStore = create<RankedUi>()((set) => ({
  ...INITIAL,
  apply(m, now = Date.now()) {
    set({
      state: m.state,
      rating: m.rating,
      queuedAt: m.state === 'queued' ? now - m.waitedMs : 0,
      matchedAt: m.state === 'matched' ? now : 0,
      opponent: m.opponent,
      reason: m.reason,
    });
  },
  reset() {
    set({ ...INITIAL });
  },
}));

/** The state to show at `now`: a stale 'matched' (no battle came) is idle again. */
export function shownRankedState(r: Pick<RankedUi, 'state' | 'matchedAt'>, now: number): RankedState {
  return r.state === 'matched' && now - r.matchedAt > MATCHED_STALE_MS ? 'idle' : r.state;
}

/** Toast copy for a status change (null = no toast). */
export function rankedStatusText(m: ServerMessageOf<'rankedStatus'>): { readonly level: 'info' | 'success' | 'warn'; readonly text: string } | null {
  if (m.state === 'matched' && m.opponent !== null) return { level: 'success', text: `Match found: ${m.opponent.name} (${m.opponent.rating}). Heading to the arena.` };
  if (m.state !== 'idle') return null;
  switch (m.reason) {
    case 'busy':
      return { level: 'warn', text: 'Finish your battle, trade or raid before queueing.' };
    case 'party':
      return { level: 'warn', text: 'Your party needs healing before a ranked battle.' };
    case 'cancelled':
      return { level: 'info', text: 'The match fell through. You can queue again.' };
    default:
      return null;
  }
}

/** mm:ss */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
