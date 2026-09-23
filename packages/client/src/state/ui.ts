/**
 * UiState (SPEC §20.3.1): UI-owned data only. `room.state` is never assigned here (§20.0 rule 2).
 * `battle` is written by part 2's BattleController (applyServer) — the setter below is its seam.
 */
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { BattleFormat, BattleState } from '@ewa/core';
import type { TradeOffer } from '@ewa/protocol';

export interface BattleUi {
  readonly battleId: string;
  readonly format: BattleFormat;
  readonly seat: 0 | 1;
  /** last server state (from battleStart/battleResync + applied events' hpAfter) */
  readonly authoritative: BattleState;
  readonly phase: 'selecting' | 'submitted' | 'playing' | 'replacement' | 'ended';
  readonly menu: 'root' | 'moves' | 'party' | 'bag' | 'orbs';
  readonly turnLabel: string;
  /** last 40 lines */
  readonly log: readonly { readonly id: number; readonly text: string; readonly tone: 'neutral' | 'good' | 'bad' }[];
  readonly desyncs: number;
}

export type ModalKind = 'none' | 'evolve' | 'learnMove' | 'trade' | 'challenge' | 'raidLobby' | 'nickname' | 'release' | 'listing';
export type Connection = 'connected' | 'reconnecting' | 'offline';

export interface TradeUi {
  readonly tradeId: string;
  readonly phase: 'requested' | 'open' | 'confirming' | 'complete' | 'cancelled';
  readonly offers: readonly [TradeOffer, TradeOffer];
  readonly offerHash: string;
}

export interface DialogueUi {
  readonly speaker: string;
  readonly lines: readonly string[];
  readonly index: number;
  readonly targetId: string;
}

/** Why the world connection ended, for the overlay copy (§20.3.4: 4001 "Playing in another tab"). */
export type LeaveReason = 'replaced' | 'kicked' | 'failed' | null;

export interface UiState {
  readonly battle: BattleUi | null;
  readonly dialogue: DialogueUi | null;
  readonly chatOpen: boolean;
  readonly modal: ModalKind;
  /** narrowed by the modal component through a zod schema */
  readonly modalPayload: unknown;
  readonly trade: TradeUi | null;
  readonly challenge: { readonly fromId: string; readonly fromName: string; readonly expiresAt: number } | null;
  /** F1 toggles; screenshots */
  readonly hudVisible: boolean;
  readonly connection: Connection;
  /** reconnect attempt shown by ConnectionOverlay (0 when connected) */
  readonly reconnectAttempt: number;
  /** performance.now() when `connection` last left 'connected' (the overlay waits 2 000 ms) */
  readonly disconnectedAt: number;
  readonly leaveReason: LeaveReason;
  /** dev HUD only, written at 1 Hz */
  readonly fps: number;

  setBattle(b: BattleUi | null): void;
  setDialogue(d: DialogueUi | null): void;
  setChatOpen(open: boolean): void;
  openModal(kind: Exclude<ModalKind, 'none'>, payload?: unknown): void;
  closeModal(): void;
  setTrade(t: TradeUi | null): void;
  setChallenge(c: UiState['challenge']): void;
  toggleHud(): void;
  setConnection(c: Connection, attempt?: number, reason?: LeaveReason): void;
  setFps(fps: number): void;
  reset(): void;
}

const INITIAL = {
  battle: null,
  dialogue: null,
  chatOpen: false,
  modal: 'none',
  modalPayload: null,
  trade: null,
  challenge: null,
  hudVisible: true,
  connection: 'connected',
  reconnectAttempt: 0,
  disconnectedAt: 0,
  leaveReason: null,
  fps: 0,
} as const satisfies Partial<UiState>;

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export const useUiStore = create<UiState>()(
  subscribeWithSelector((set, get) => ({
    ...INITIAL,
    setBattle: (battle) => set({ battle }),
    setDialogue: (dialogue) => set({ dialogue }),
    setChatOpen: (chatOpen) => set({ chatOpen }),
    openModal: (modal, modalPayload = null) => set({ modal, modalPayload }),
    closeModal: () => set({ modal: 'none', modalPayload: null }),
    setTrade: (trade) => set({ trade }),
    setChallenge: (challenge) => set({ challenge }),
    toggleHud: () => set({ hudVisible: !get().hudVisible }),
    setConnection: (connection, attempt = 0, reason = null) => {
      const prev = get();
      if (prev.connection === connection && prev.reconnectAttempt === attempt && prev.leaveReason === reason) return;
      set({
        connection,
        reconnectAttempt: attempt,
        leaveReason: reason,
        disconnectedAt: connection === 'connected' ? 0 : prev.connection === 'connected' ? now() : prev.disconnectedAt,
      });
    },
    setFps: (fps) => set({ fps }),
    reset: () => set({ ...INITIAL }),
  })),
);
