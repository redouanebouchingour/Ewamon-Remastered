/**
 * SPEC §20.8.6: panels trap focus while open and return it on close; modals likewise. Tab / Shift+Tab cycle
 * inside `ref`; the element focused before activation gets focus back on deactivation.
 */
import { useEffect } from 'react';
import type { RefObject } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function focusablesIn(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.closest('[inert]') && el.getAttribute('aria-hidden') !== 'true');
}

export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean, opts: { readonly autoFocus?: boolean } = {}): void {
  const autoFocus = opts.autoFocus ?? true;
  useEffect(() => {
    const root = ref.current;
    if (!active || root === null) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (autoFocus && !root.contains(document.activeElement)) {
      const first = focusablesIn(root)[0];
      (first ?? root).focus({ preventScroll: true });
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Tab') return;
      const items = focusablesIn(root);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const current = document.activeElement;
      if (e.shiftKey && (current === first || !root.contains(current))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (current === last || !root.contains(current))) {
        e.preventDefault();
        first.focus();
      }
    };
    root.addEventListener('keydown', onKey);
    return () => {
      root.removeEventListener('keydown', onKey);
      if (previous !== null && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, [ref, active, autoFocus]);
}
