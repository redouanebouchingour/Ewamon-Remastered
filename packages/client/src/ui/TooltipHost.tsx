/**
 * The app's one tooltip (SPEC §20.2.4): every `title` attribute in the client shows a Broadcast slab instead of the
 * browser's native box, without changing a single call site. Mounted once in `main.tsx`.
 *
 * On hover (after a short delay; instantly while another tip was just showing) or keyboard focus (`:focus-visible`),
 * the nearest `[title]` element lends its text: the attribute is moved aside while the tip shows — so the native
 * tooltip never fires — and put back when it hides, so accessible names, tests and React's own diffing still see it.
 * An anchor with a `data-type` (type badges, gym badges) colours the tip's edge bar in that type.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import s from './Tooltip.module.css';
import { cssVars } from './cssVars';

const SHOW_DELAY_MS = 380;
/** Moving from one titled element to the next within this window skips the delay (a row of badges reads quickly). */
const WARM_MS = 300;
const GAP = 8;
const EDGE = 8;

interface Shown {
  readonly text: string;
  readonly anchor: DOMRect;
  /** the anchor's `data-type` (type badges, gym badges): the tip's edge takes that type colour */
  readonly type: string | null;
}

interface Placed {
  readonly x: number;
  readonly y: number;
  readonly below: boolean;
  /** the pointer's x inside the tip, so it still points at the anchor when the tip is clamped to the viewport */
  readonly arrow: number;
}

function focusVisible(el: Element): boolean {
  try {
    return el.matches(':focus-visible');
  } catch {
    return false; // engines without the selector (jsdom): hover only
  }
}

export function TooltipHost() {
  const [shown, setShown] = useState<Shown | null>(null);
  const [placed, setPlaced] = useState<Placed | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let target: Element | null = null;
    let stashed: string | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let hiddenAt = -Infinity;
    let shownNow = false;

    const release = (): void => {
      clearTimeout(timer);
      timer = undefined;
      // React may have re-set the attribute (a new value) while it was stashed; that one wins.
      if (target !== null && stashed !== null && !target.hasAttribute('title')) target.setAttribute('title', stashed);
      if (target !== null && shownNow) hiddenAt = performance.now();
      target = null;
      stashed = null;
      shownNow = false;
      setShown(null);
      setPlaced(null);
    };

    const claim = (el: Element): void => {
      if (el === target) return;
      release();
      const text = el.getAttribute('title')?.trim() ?? '';
      if (text === '') return;
      target = el;
      stashed = el.getAttribute('title');
      el.removeAttribute('title');
      const show = (): void => {
        if (target !== el || !el.isConnected) return;
        shownNow = true;
        const type = el.getAttribute('data-type')?.toLowerCase() ?? null;
        setShown({ text, anchor: el.getBoundingClientRect(), type: type !== null && /^[a-z]+$/.test(type) ? type : null });
      };
      if (performance.now() - hiddenAt < WARM_MS) show();
      else timer = setTimeout(show, SHOW_DELAY_MS);
    };

    const titled = (n: EventTarget | null): Element | null => (n instanceof Element ? n.closest('[title]') : null);

    const onOver = (e: PointerEvent): void => {
      if (e.pointerType === 'touch') return;
      const el = titled(e.target);
      if (el !== null) claim(el);
      else if (target !== null && !(e.target instanceof Node && target.contains(e.target))) release();
    };
    const onOut = (e: PointerEvent): void => {
      if (target === null) return;
      const to = e.relatedTarget;
      if (to instanceof Node && target.contains(to)) return;
      // Leaving into another titled element is handled by its pointerover; leaving into nothing hides.
      if (titled(to) === null) release();
    };
    const onFocusIn = (e: FocusEvent): void => {
      const el = e.target instanceof Element ? e.target : null;
      if (el === null || !el.hasAttribute('title') || !focusVisible(el)) return;
      claim(el);
    };
    const onFocusOut = (e: FocusEvent): void => {
      if (target !== null && e.target === target) release();
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && target !== null) release();
    };
    const hide = (): void => {
      if (target !== null) release();
    };

    document.addEventListener('pointerover', onOver, true);
    document.addEventListener('pointerout', onOut, true);
    document.addEventListener('pointerdown', hide, true);
    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('focusout', onFocusOut, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('blur', hide);
    return () => {
      release();
      document.removeEventListener('pointerover', onOver, true);
      document.removeEventListener('pointerout', onOut, true);
      document.removeEventListener('pointerdown', hide, true);
      document.removeEventListener('focusin', onFocusIn, true);
      document.removeEventListener('focusout', onFocusOut, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('blur', hide);
    };
  }, []);

  // Measure the rendered (still invisible) tip, then place it above the anchor — below when the top edge is too close —
  // clamped to the viewport. Runs before paint, so the tip never flashes at the wrong spot.
  useLayoutEffect(() => {
    const tip = tipRef.current;
    if (shown === null || tip === null) return;
    const { width, height } = tip.getBoundingClientRect();
    const a = shown.anchor;
    const vw = document.documentElement.clientWidth;
    const below = a.top - GAP - height < EDGE;
    const center = a.left + a.width / 2;
    const x = Math.round(Math.min(Math.max(center - width / 2, EDGE), Math.max(EDGE, vw - width - EDGE)));
    const y = Math.round(below ? a.bottom + GAP : a.top - GAP - height);
    const arrow = Math.round(Math.min(Math.max(center - x, 10), width - 10));
    setPlaced({ x, y, below, arrow });
  }, [shown]);

  if (shown === null) return null;
  return createPortal(
    <div
      ref={tipRef}
      role="tooltip"
      data-testid="tooltip"
      data-placed={placed !== null ? (placed.below ? 'below' : 'above') : undefined}
      className={s.tip}
      style={cssVars({
        '--tip-x': `${placed?.x ?? 0}px`,
        '--tip-y': `${placed?.y ?? 0}px`,
        '--tip-arrow': `${placed?.arrow ?? 0}px`,
        '--tip-edge': shown.type !== null ? `var(--type-${shown.type}, var(--text-hi))` : undefined,
      })}
    >
      {shown.text}
    </div>,
    document.body,
  );
}
