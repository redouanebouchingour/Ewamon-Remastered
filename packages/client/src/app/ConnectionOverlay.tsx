/**
 * SPEC §20.3.4 / §20.9.13: after 2 000 ms in 'reconnecting' (attempt counter visible), or when 'offline' (with a
 * "Return to login" button). A full-panel scrim over the DOM chrome — never over the canvas HUD itself.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { endSession } from '../net/api';
import { getWorldSession, RECONNECT_DELAYS_MS } from '../net/WorldSession';
import { useSessionStore } from '../state/session';
import { useUiStore } from '../state/ui';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import s from './ConnectionOverlay.module.css';

export const OVERLAY_DELAY_MS = 2000;

export function ConnectionOverlay() {
  const connection = useUiStore((st) => st.connection);
  const attempt = useUiStore((st) => st.reconnectAttempt);
  const reason = useUiStore((st) => st.leaveReason);
  const zoneId = useSessionStore((st) => st.zoneId);
  const navigate = useNavigate();
  const [late, setLate] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (connection !== 'reconnecting') {
      setLate(false);
      return;
    }
    const t = setTimeout(() => setLate(true), OVERLAY_DELAY_MS);
    return () => clearTimeout(t);
  }, [connection]);

  if (connection === 'connected' || (connection === 'reconnecting' && !late)) return null;

  const retry = async (): Promise<void> => {
    if (zoneId === null) return;
    setRetrying(true);
    try {
      await getWorldSession().enter(zoneId);
    } catch (_e) {
      // the session already toasted the reason
    } finally {
      setRetrying(false);
    }
  };

  const title =
    connection === 'reconnecting'
      ? 'Reconnecting to the world'
      : reason === 'replaced'
        ? 'Playing somewhere else?'
        : reason === 'restarted'
          ? 'The world server restarted'
          : reason === 'kicked'
            ? 'Disconnected by the server'
            : 'Connection lost';
  const detail =
    connection === 'reconnecting'
      ? `Attempt ${Math.max(1, attempt)} of ${RECONNECT_DELAYS_MS.length}. Your progress is safe on the server.`
      : reason === 'replaced'
        ? 'This account joined the world from another tab or device. Only one session can play at a time.'
        : reason === 'restarted'
          ? 'Your progress is saved on the server. Rejoin when it is back up.'
          : 'The world server stopped answering. Your progress is saved on the server.';

  return (
    <div className={s.scrim} role="alertdialog" aria-modal="true" aria-labelledby="conn-title" data-testid="connectionoverlay">
      <div className={s.card}>
        <span className={connection === 'reconnecting' ? s.iconBusy : s.icon} aria-hidden>
          <Icon name={connection === 'reconnecting' ? 'refresh' : 'warn'} size="lg" />
        </span>
        <h2 id="conn-title" className={s.title}>
          {title}
        </h2>
        <p className={s.detail}>{detail}</p>
        {connection === 'offline' && (
          <div className={s.actions}>
            <Button variant="primary" onClick={() => void retry()} busy={retrying} icon="refresh">
              {reason === 'replaced' ? 'Play here instead' : 'Try again'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                endSession();
                void navigate('/login', { replace: true });
              }}
            >
              Return to login
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
