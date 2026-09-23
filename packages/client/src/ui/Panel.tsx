import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import s from './Panel.module.css';
import { cx } from './cx';
import { Icon } from './Icon';
import { useFocusTrap } from './useFocusTrap';

/** SPEC §20.2.4 props, plus `eyebrow` (small label above the title), `toolbar` (sticky row under the header) and `refreshing` (§20.9.13: previous content at 0.6 while a new page loads). */
export interface PanelProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly actions?: ReactNode;
  readonly onClose?: () => void;
  readonly children: ReactNode;
  readonly className?: string;
  readonly eyebrow?: string;
  readonly toolbar?: ReactNode;
  readonly refreshing?: boolean;
  readonly bodyClassName?: string;
}

export function Panel({ title, subtitle, actions, onClose, children, className, eyebrow, toolbar, refreshing = false, bodyClassName }: PanelProps) {
  const ref = useRef<HTMLElement>(null);
  const titleId = useId();
  useFocusTrap(ref, onClose !== undefined, { autoFocus: false });

  useEffect(() => {
    if (onClose === undefined) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      // an open modal owns Escape
      if (document.querySelector('[aria-modal="true"]') !== null) return;
      const target = e.target as HTMLElement | null;
      if (target !== null && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') && (target as HTMLInputElement).value !== '') return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <section ref={ref} data-testid="panel" className={cx(s.panel, className)} aria-labelledby={titleId} tabIndex={-1}>
      <header className={s.header}>
        <div className={s.heading}>
          {eyebrow !== undefined && <p className={s.eyebrow}>{eyebrow}</p>}
          <h2 id={titleId} className={s.title}>
            {title}
          </h2>
          {subtitle !== undefined && <p className={s.subtitle}>{subtitle}</p>}
        </div>
        <div className={s.actions}>
          {actions}
          {onClose !== undefined && (
            <button type="button" className={s.close} onClick={onClose} aria-label="Close panel" title="Close (Esc)">
              <Icon name="close" />
            </button>
          )}
        </div>
      </header>
      {toolbar !== undefined && <div className={s.toolbar}>{toolbar}</div>}
      <div className={cx(s.body, refreshing && s.refreshing, bodyClassName)} aria-busy={refreshing || undefined}>
        {children}
      </div>
    </section>
  );
}
