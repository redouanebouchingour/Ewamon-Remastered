import type { KeyboardEvent, ReactNode } from 'react';
import s from './Card.module.css';
import { cx } from './cx';

export interface CardProps {
  readonly selected?: boolean;
  readonly interactive?: boolean;
  readonly onClick?: () => void;
  readonly children: ReactNode;
  readonly className?: string;
  /** optional accessible name when interactive */
  readonly label?: string;
}

export function Card({ selected = false, interactive = false, onClick, children, className, label }: CardProps) {
  const isButton = interactive || onClick !== undefined;
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (!isButton || onClick === undefined) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };
  return (
    <div
      data-testid="card"
      className={cx(s.card, isButton && s.interactive, selected && s.selected, className)}
      role={isButton ? 'button' : undefined}
      tabIndex={isButton ? 0 : undefined}
      aria-pressed={isButton ? selected : undefined}
      aria-label={label}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  );
}
