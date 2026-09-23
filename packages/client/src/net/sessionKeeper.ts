/**
 * SessionKeeper (SPEC §20.1.2): refreshes the in-memory access token 60 s before its `exp`, and follows a
 * logout in another tab (a `storage` event removing the refresh key) by clearing this tab's session too.
 * Started once by main.tsx with the navigation callback for "you are logged out".
 */
import { useNotificationsStore } from '../state/notifications';
import { useSessionStore } from '../state/session';
import { useUiStore } from '../state/ui';
import { REFRESH_KEY } from './tokens';

/** api.ts (protocol's zod route table) loads with the first lazy route; the keeper only needs it at refresh time. */
const refreshSession = async (): Promise<'ok' | 'invalid' | 'network'> => (await import('./api')).refreshSession();

export const REFRESH_EARLY_MS = 60_000;
/** never schedule tighter than this, so a clock skew cannot spin the timer */
const MIN_DELAY_MS = 5_000;

export interface SessionKeeperOptions {
  /** called when the session is gone (refresh refused, or logout in another tab) */
  readonly onLoggedOut: () => void;
  readonly now?: () => number;
}

export function startSessionKeeper(opts: SessionKeeperOptions): () => void {
  const now = opts.now ?? Date.now;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const schedule = (accessExp: number, accessToken: string | null): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    if (accessToken === null || accessExp === 0) return;
    const delay = Math.max(MIN_DELAY_MS, accessExp - REFRESH_EARLY_MS - now());
    timer = setTimeout(() => {
      timer = null;
      void refreshSession().then((r) => {
        if (r === 'invalid') opts.onLoggedOut();
        // 'network': keep the old token; apiFetch retries the refresh on its next 401
      });
    }, delay);
  };

  const unsub = useSessionStore.subscribe(
    (s) => [s.accessExp, s.accessToken] as const,
    ([exp, token]) => schedule(exp, token),
    { equalityFn: (a, b) => a[0] === b[0] && a[1] === b[1] },
  );
  const s0 = useSessionStore.getState();
  schedule(s0.accessExp, s0.accessToken);

  const onStorage = (e: StorageEvent): void => {
    if (e.key !== REFRESH_KEY && e.key !== null) return;
    if (e.key === null || e.newValue === null) {
      useSessionStore.getState().clearSession();
      useNotificationsStore.getState().clear();
      useUiStore.getState().reset();
      opts.onLoggedOut();
    }
  };
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);

  return () => {
    unsub();
    if (timer !== null) clearTimeout(timer);
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
  };
}
