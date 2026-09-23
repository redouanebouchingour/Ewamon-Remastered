import s from './Toast.module.css';
import { cx } from './cx';
import { Icon } from './Icon';
import type { IconName } from './Icon';

export interface ToastProps {
  readonly id: string;
  readonly level: 'info' | 'success' | 'warn' | 'danger';
  readonly text: string;
  readonly ttlMs: number;
  /** extension: dismiss button + exit state (NotificationHost owns the timers) */
  readonly onDismiss?: (id: string) => void;
  readonly leaving?: boolean;
}

const ICON: Readonly<Record<ToastProps['level'], IconName>> = { info: 'info', success: 'check', warn: 'warn', danger: 'warn' };

export function Toast({ id, level, text, onDismiss, leaving = false }: ToastProps) {
  return (
    <div data-testid="toast" className={cx(s.toast, s[level], leaving && s.leaving)} role={level === 'danger' ? 'alert' : 'status'}>
      <span className={s.mark} aria-hidden>
        <Icon name={ICON[level]} size="sm" />
      </span>
      <p className={s.text}>{text}</p>
      {onDismiss !== undefined && (
        <button type="button" className={s.dismiss} onClick={() => onDismiss(id)} aria-label="Dismiss notification">
          <Icon name="close" size="sm" />
        </button>
      )}
    </div>
  );
}
