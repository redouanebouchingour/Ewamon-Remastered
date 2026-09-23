import type { ReactNode } from 'react';
import s from './Button.module.css';
import { cx } from './cx';
import { Icon } from './Icon';
import type { IconName } from './Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

/** SPEC §20.2.4 props, plus optional `icon`, `ariaLabel`, `title`, `name`/`value` (form submit) and `pressed`. */
export interface ButtonProps {
  /** default 'secondary' */
  readonly variant?: ButtonVariant;
  /** heights 28 / 36 / 44 px */
  readonly size?: 'sm' | 'md' | 'lg';
  readonly disabled?: boolean;
  /** fetcher.state === 'submitting': keeps width, shows a 3-dot mark, disables */
  readonly busy?: boolean;
  readonly onClick?: () => void;
  readonly type?: 'button' | 'submit';
  readonly children: ReactNode;
  readonly className?: string;
  readonly icon?: IconName;
  readonly ariaLabel?: string;
  readonly title?: string;
  readonly name?: string;
  readonly value?: string;
  readonly pressed?: boolean;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  disabled = false,
  busy = false,
  onClick,
  type = 'button',
  children,
  className,
  icon,
  ariaLabel,
  title,
  name,
  value,
  pressed,
}: ButtonProps) {
  return (
    <button
      data-testid="button"
      type={type}
      className={cx(s.button, s[variant], s[size], busy && s.busy, className)}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      aria-label={ariaLabel}
      aria-pressed={pressed}
      title={title}
      name={name}
      value={value}
      onClick={onClick}
    >
      <span className={s.label}>
        {icon !== undefined && <Icon name={icon} size={size === 'lg' ? 'md' : 'sm'} />}
        {children}
      </span>
      {busy && (
        <span className={s.dots} aria-hidden>
          <span className={s.dot} />
          <span className={s.dot} />
          <span className={s.dot} />
        </span>
      )}
    </button>
  );
}
