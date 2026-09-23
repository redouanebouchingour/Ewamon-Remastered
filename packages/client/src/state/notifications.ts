/** NotificationsState (SPEC §20.3.1): toasts (max 4 visible, FIFO), unread DM counts, badge counters. */
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export type ToastLevel = 'info' | 'success' | 'warn' | 'danger';

export interface ToastEntry {
  readonly id: string;
  readonly level: ToastLevel;
  readonly text: string;
  readonly ttlMs: number;
  /** Date.now() when pushed */
  readonly at: number;
}

export const MAX_TOASTS = 4;
/** §20.9.13: action errors as a danger toast live 6 000 ms */
export const TOAST_TTL = { info: 4000, success: 4000, warn: 5000, danger: 6000 } as const satisfies Record<ToastLevel, number>;

export interface NotificationsState {
  readonly toasts: readonly ToastEntry[];
  /** username -> count */
  readonly unreadDm: Readonly<Record<string, number>>;
  readonly friendRequests: number;
  readonly pendingBattlePassClaims: number;
  push(t: Omit<ToastEntry, 'id' | 'at'>): void;
  dismiss(id: string): void;
  seed(s: { readonly unreadDm: Readonly<Record<string, number>>; readonly friendRequests: number; readonly pendingBattlePassClaims: number }): void;
  bumpDm(username: string): void;
  markDmRead(username: string): void;
  setPendingClaims(n: number): void;
  clear(): void;
}

let seq = 0;

export const useNotificationsStore = create<NotificationsState>()(
  subscribeWithSelector((set, get) => ({
    toasts: [],
    unreadDm: {},
    friendRequests: 0,
    pendingBattlePassClaims: 0,
    push(t) {
      seq += 1;
      const entry: ToastEntry = { ...t, id: `t${seq}`, at: Date.now() };
      const next = [...get().toasts, entry];
      set({ toasts: next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next });
    },
    dismiss(id) {
      set({ toasts: get().toasts.filter((t) => t.id !== id) });
    },
    seed(s) {
      set({ unreadDm: { ...s.unreadDm }, friendRequests: s.friendRequests, pendingBattlePassClaims: s.pendingBattlePassClaims });
    },
    bumpDm(username) {
      const cur = get().unreadDm;
      set({ unreadDm: { ...cur, [username]: (cur[username] ?? 0) + 1 } });
    },
    markDmRead(username) {
      const { [username]: _drop, ...rest } = get().unreadDm;
      set({ unreadDm: rest });
    },
    setPendingClaims(n) {
      set({ pendingBattlePassClaims: n });
    },
    clear() {
      set({ toasts: [], unreadDm: {}, friendRequests: 0, pendingBattlePassClaims: 0 });
    },
  })),
);

/** Shorthand for non-React code: `toast('danger', 'Not enough money')`. */
export function toast(level: ToastLevel, text: string, ttlMs: number = TOAST_TTL[level]): void {
  useNotificationsStore.getState().push({ level, text, ttlMs });
}
