/** Logout here: refresh token, session, notifications and UI state. The storage event reaches other tabs. */
import { useNotificationsStore } from '../state/notifications';
import { useSessionStore } from '../state/session';
import { useUiStore } from '../state/ui';
import { clearRefreshToken } from './tokens';

export function endSession(): void {
  clearRefreshToken();
  useSessionStore.getState().clearSession();
  useNotificationsStore.getState().clear();
  useUiStore.getState().reset();
}
