/**
 * UiState (SPEC §20.3.1): UI-owned data only. `room.state` is never assigned here (§20.0 rule 2).
 * `battle` is written by part 2's BattleController (applyServer) — the setter below is its seam.
 */
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { BattleFormat, BattleOutcome, BattleState, TypeName } from '@ewa/core';
import type { RewardsSummary, TradeOffer } from '@ewa/protocol';

/** `battleEnd` for the result card: display only (the rewards reached the session through the delta writers). */
export interface BattleResult {
  readonly outcome: BattleOutcome;
  readonly rewards: RewardsSummary;
  /** evolve / learn-move prompts queued after the card */
  readonly prompts: number;
  /** Phase C1: a raid's summary card (RaidSummaryCard) instead of the BattleResultCard */
  readonly raid?: RaidSummary;
}

/** Phase C1 — what the raid summary card shows (written by BattleController; display only). */
export interface RaidSummary {
  readonly bossSpecies: string;
  readonly bossLevel: number;
  /** the boss went down (the catch window opened) */
  readonly cleared: boolean;
  /** the catch attempt's result; null = no attempt (not eligible, skipped or the window closed) */
  readonly caught: boolean | null;
  /** the player's whole party fainted before the boss did (they stay on the board) */
  readonly fainted: boolean;
  /** the player left the fight (`raidLeave`) */
  readonly left: boolean;
  readonly damage: number;
  /** 1-based place on the damage board; null when the board did not list the player */
  readonly rank: number | null;
  readonly board: readonly { readonly playerId: string; readonly name: string; readonly damage: number; readonly self: boolean }[];
}

/** Phase C1 — the raid half of `ui.battle` (format 'raid'; BattleController is its writer). */
export interface RaidBattleUi {
  readonly raidId: string;
  /** the round the next `raidAction` is for */
  readonly round: number;
  /** the boss is down: only orbs (one `raidCatch`) or Done */
  readonly catchWindow: boolean;
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
  /** Phase C1: set for format 'raid' */
  readonly raid?: RaidBattleUi;
}

/**
 * Phase B7: the VS intro card over the battle push-in (trainer / league battles, not under reduced motion). Written by
 * BattleController at `battleStart`; the card clears it when its time is up (or the battle ends).
 */
export interface BattleIntro {
  readonly battleId: string;
  readonly name: string;
  /** league trainers only */
  readonly title: string | null;
  readonly type: TypeName | null;
  /** the foe's render look id (no DOM thumbnail exists yet; the card shows the type emblem) */
  readonly look: string | null;
  readonly league: boolean;
}

/** Phase B7: a league trainer's mid-battle line (`LeagueTrainer.mid`), a transient banner (BattleBanner, 3 s). */
export interface BattleBanner {
  readonly id: number;
  readonly speaker: string;
  readonly text: string;
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
  /**
   * Runs when the player pages past the last line (not on Escape): a story beat with a battle, or a gym leader's
   * `pre` lines, send their `interact` only then, so the lines are read before the battle covers the world.
   */
  readonly onFinish?: () => void;
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
  readonly battleIntro: BattleIntro | null;
  /** the banner on screen; the next ones wait in `battleBannerQueue` */
  readonly battleBanner: BattleBanner | null;
  readonly battleBannerQueue: readonly BattleBanner[];

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
  setBattleIntro(i: BattleIntro | null): void;
  /** shows `b` now, or after the banner on screen */
  pushBattleBanner(b: BattleBanner): void;
  /** the banner `id` is done (its 3 s are up): the next queued one, if any, takes its place */
  dismissBattleBanner(id: number): void;
  /** drops the banner and the queue (the battle ended) */
  clearBattleBanners(): void;
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
  battleIntro: null,
  battleBanner: null,
  battleBannerQueue: [] as readonly BattleBanner[],
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
    setBattleIntro: (battleIntro) => set({ battleIntro }),
    pushBattleBanner: (b) => {
      const st = get();
      if (st.battleBanner === null) set({ battleBanner: b });
      else set({ battleBannerQueue: [...st.battleBannerQueue, b] });
    },
    dismissBattleBanner: (id) => {
      const st = get();
      if (st.battleBanner === null || st.battleBanner.id !== id) return;
      set({ battleBanner: st.battleBannerQueue[0] ?? null, battleBannerQueue: st.battleBannerQueue.slice(1) });
    },
    clearBattleBanners: () => set({ battleBanner: null, battleBannerQueue: [] }),
    reset: () => set({ ...INITIAL }),
  })),
);
