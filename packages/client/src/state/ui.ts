/**
 * UiState (SPEC §20.3.1): UI-owned data only. `room.state` is never assigned here (§20.0 rule 2).
 * `battle` is written by part 2's BattleController (applyServer) — the setter below is its seam.
 */
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { BattleFormat, BattleOutcome, BattleState } from '@ewa/core';
import type { RewardsSummary, TradeOffer } from '@ewa/protocol';

/** `battleEnd` for the result card: display only (the rewards reached the session through the delta writers). */
export interface BattleResult {
  readonly outcome: BattleOutcome;
  readonly rewards: RewardsSummary;
  /** evolve / learn-move prompts queued after the card */
  readonly prompts: number;
}

/** An explicit post-battle REST prompt (§20.5.6): each is its own modal, in order; never automatic. */
export type QueuedPrompt =
  | { readonly kind: 'evolve'; readonly creatureId: string; readonly into: string }
  | { readonly kind: 'learnMove'; readonly creatureId: string; readonly move: string };

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
  /** set when the final timeline has played (BattleResultCard) */
  readonly result: BattleResult | null;
  /** the preview's timeline duration while 'submitted' (sizes the waiting indicator); 0 = unknown */
  readonly expectedMs: number;
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

/**
 * Why the world connection ended, for the overlay copy (§20.3.4 "Playing in another tab"): `replaced` is protocol
 * `CLOSE_CODES.replaced` (4101), `restarted` is Colyseus' own SERVER_SHUTDOWN (4001), `kicked` is 4003.
 */
export type LeaveReason = 'replaced' | 'restarted' | 'kicked' | 'failed' | null;

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
  /** post-battle evolve / learn-move prompts still to show (the head is the open modal) */
  readonly prompts: readonly QueuedPrompt[];

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
  enqueuePrompt(p: QueuedPrompt): void;
  /** drops the head prompt (answered or skipped) */
  shiftPrompt(): void;
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
  prompts: [] as readonly QueuedPrompt[],
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
    enqueuePrompt: (p) => set({ prompts: [...get().prompts, p] }),
    shiftPrompt: () => set({ prompts: get().prompts.slice(1) }),
    reset: () => set({ ...INITIAL }),
  })),
);
