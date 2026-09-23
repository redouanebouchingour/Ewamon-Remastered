/**
 * Toasts bottom-right (SPEC §20.9.2), max 4 visible, FIFO. Enter 160 ms, exit 80 ms (§20.2.6); each toast lives
 * its ttlMs, pauses while hovered, and can be dismissed. Rendered by PlayShell and by the auth/admin pages.
 */
import { useEffect, useRef, useState } from 'react';
import { MAX_TOASTS, useNotificationsStore } from '../state/notifications';
import type { ToastEntry } from '../state/notifications';
import { Toast } from '../ui/Toast';
import s from './NotificationHost.module.css';

const EXIT_MS = 80;

function TimedToast({ t }: { readonly t: ToastEntry }) {
  const dismiss = useNotificationsStore((st) => st.dismiss);
  const [leaving, setLeaving] = useState(false);
  const [paused, setPaused] = useState(false);
  const remaining = useRef(t.ttlMs);
  const started = useRef(0);

  useEffect(() => {
    if (paused || leaving) return;
    started.current = Date.now();
    const timer = setTimeout(() => setLeaving(true), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - started.current));
    };
  }, [paused, leaving]);

  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => dismiss(t.id), EXIT_MS);
    return () => clearTimeout(timer);
  }, [leaving, dismiss, t.id]);

  return (
    <li onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <Toast id={t.id} level={t.level} text={t.text} ttlMs={t.ttlMs} leaving={leaving} onDismiss={() => setLeaving(true)} />
    </li>
  );
}

export function NotificationHost() {
  const toasts = useNotificationsStore((st) => st.toasts);
  const visible = toasts.slice(-MAX_TOASTS);
  return (
    <ol className={s.host} aria-live="polite" aria-label="Notifications" data-testid="notificationhost">
      {visible.map((t) => (
        <TimedToast key={t.id} t={t} />
      ))}
    </ol>
  );
}
