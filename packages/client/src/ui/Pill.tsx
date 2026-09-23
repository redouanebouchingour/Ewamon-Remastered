import type { ReactNode } from 'react';
import s from './Pill.module.css';
import { cx } from './cx';

export interface PillProps {
  readonly children: ReactNode;
  readonly tone?: 'neutral' | 'accent' | 'warn' | 'danger' | 'info';
  readonly className?: string;
  readonly title?: string;
}

/** Small counter / status chip (unread counts, "Online", variant names). */
export function Pill({ children, tone = 'neutral', className, title }: PillProps) {
  return (
    <span data-testid="pill" className={cx(s.pill, s[tone], className)} title={title}>
      {children}
    </span>
  );
}
