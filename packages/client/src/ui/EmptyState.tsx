import type { ReactNode } from 'react';
import s from './EmptyState.module.css';
import { cx } from './cx';
import { Icon } from './Icon';
import type { IconName } from './Icon';

/** §20.9.13: title `--t-h3`, hint `--t-body` in `--text-2`, one optional action. Every list passes one explicitly. */
export interface EmptyStateProps {
  readonly icon: IconName;
  readonly title: string;
  readonly hint?: ReactNode;
  readonly action?: ReactNode;
  readonly tone?: 'neutral' | 'unavailable' | 'error';
  readonly className?: string;
}

export function EmptyState({ icon, title, hint, action, tone = 'neutral', className }: EmptyStateProps) {
  return (
    <div data-testid="emptystate" className={cx(s.empty, s[tone], className)}>
      <span className={s.icon} aria-hidden>
        <Icon name={icon} size="lg" />
      </span>
      <h3 className={s.title}>{title}</h3>
      {hint !== undefined && <p className={s.hint}>{hint}</p>}
      {action !== undefined && <div className={s.action}>{action}</div>}
    </div>
  );
}
