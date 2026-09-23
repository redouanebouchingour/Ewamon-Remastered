import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import s from './Modal.module.css';
import { cx } from './cx';
import { Icon } from './Icon';
import { useFocusTrap } from './useFocusTrap';

export interface ModalProps {
  readonly open: boolean;
  readonly title: string;
  readonly onClose: () => void;
  /** widths 420 / 640 / 920 px */
  readonly size?: 'sm' | 'md' | 'lg';
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly description?: string;
}

function ModalDialog({ title, onClose, size = 'md', children, footer, description }: Omit<ModalProps, 'open'>) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  useFocusTrap(ref, true);
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className={s.root}>
      <div className={s.scrim} onClick={onClose} aria-hidden />
      <div
        ref={ref}
        data-testid="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description !== undefined ? descId : undefined}
        className={cx(s.dialog, s[size])}
      >
        <header className={s.header}>
          <div>
            <h2 id={titleId} className={s.title}>
              {title}
            </h2>
            {description !== undefined && (
              <p id={descId} className={s.description}>
                {description}
              </p>
            )}
          </div>
          <button type="button" className={s.close} onClick={onClose} aria-label="Close dialog">
            <Icon name="close" />
          </button>
        </header>
        <div className={s.body}>{children}</div>
        {footer !== undefined && <footer className={s.footer}>{footer}</footer>}
      </div>
    </div>
  );
}

export function Modal({ open, ...rest }: ModalProps) {
  if (!open || typeof document === 'undefined') return null;
  return createPortal(<ModalDialog {...rest} />, document.body);
}
