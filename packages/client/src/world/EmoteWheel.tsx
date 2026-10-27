/**
 * The emote wheel (2026-10-27): a PUBG-style ring of eight emotes over the live world, opened by G or the Emotes button
 * in the key legend (`state/emotes`). The pointer's direction from the centre picks a slice (anywhere on screen, like
 * a stick); a click plays it, or hold G, aim and let go. A tap of G leaves the wheel up; G again, Escape, a right click
 * or a click in the hub closes it. ←/→ step through the slices and Enter plays the lit one.
 */
import { useEffect, useRef, useState } from 'react';
import { WHEEL, playEmote, useEmoteWheelStore } from '../state/emotes';
import s from './EmoteWheel.module.css';

const R_OUT = 190;
const R_IN = 78;
const SLICE = 360 / WHEEL.length;
/** Degrees of gap between slices. */
const GAP = 1.6;
/** Held longer than this, letting go of G plays the lit slice (a shorter tap leaves the wheel up). */
export const HOLD_MS = 220;

function polar(deg: number, r: number): string {
  const a = (deg * Math.PI) / 180;
  return `${(Math.sin(a) * r).toFixed(2)} ${(-Math.cos(a) * r).toFixed(2)}`;
}

function slicePath(i: number): string {
  const a0 = i * SLICE - SLICE / 2 + GAP / 2;
  const a1 = i * SLICE + SLICE / 2 - GAP / 2;
  return `M ${polar(a0, R_IN)} L ${polar(a0, R_OUT)} A ${R_OUT} ${R_OUT} 0 0 1 ${polar(a1, R_OUT)} L ${polar(a1, R_IN)} A ${R_IN} ${R_IN} 0 0 0 ${polar(a0, R_IN)} Z`;
}

const PATHS = WHEEL.map((_, i) => slicePath(i));
const GLYPH_AT = WHEEL.map((_, i) => polar(i * SLICE, (R_IN + R_OUT) / 2).split(' ').map(Number) as [number, number]);

/** The slice under a pointer at (dx, dy) px from the wheel's centre; null inside the hub's dead zone. */
export function sliceAt(dx: number, dy: number, deadPx: number): number | null {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || dx * dx + dy * dy < deadPx * deadPx) return null;
  const deg = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360 + SLICE / 2) % 360;
  return Math.floor(deg / SLICE) % WHEEL.length;
}

export function EmoteWheel() {
  const open = useEmoteWheelStore((st) => st.open);
  const setOpen = useEmoteWheelStore((st) => st.setOpen);
  const [lit, setLit] = useState<number | null>(null);
  const litRef = useRef<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  litRef.current = lit;

  const close = (): void => {
    setOpen(false);
    setLit(null);
  };
  const play = (i: number | null): void => {
    if (i === null) return;
    playEmote(WHEEL[i]!.id);
    close();
  };

  useEffect(() => {
    if (!open) return;
    const openedAt = performance.now();
    const onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === 'Escape' || (e.code === 'KeyG' && !e.repeat)) {
        e.preventDefault();
        e.stopPropagation();
        close();
      } else if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        const step = e.code === 'ArrowRight' ? 1 : WHEEL.length - 1;
        setLit((l) => (l === null ? 0 : (l + step) % WHEEL.length));
      } else if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        play(litRef.current);
      }
    };
    const onKeyUp = (e: KeyboardEvent): void => {
      if (e.code === 'KeyG' && performance.now() - openedAt >= HOLD_MS && litRef.current !== null) play(litRef.current);
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKeyUp, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKeyUp, true);
    };
  }, [open]);

  // leaving the live world (a panel, a battle) takes the wheel down with it
  useEffect(() => () => useEmoteWheelStore.getState().setOpen(false), []);

  if (!open) return null;

  /** The slice the pointer at (x, y) client px aims at (null in the hub). */
  const sliceOf = (x: number, y: number): number | null => {
    const box = svgRef.current?.getBoundingClientRect();
    if (box === undefined || box.width === 0) return null;
    const scale = box.width / (R_OUT * 2 + 20);
    return sliceAt(x - (box.left + box.width / 2), y - (box.top + box.height / 2), R_IN * scale * 0.6);
  };
  const entry = lit === null ? null : WHEEL[lit]!;

  return (
    <div
      className={s.layer}
      data-testid="emote-wheel"
      onPointerMove={(e) => setLit(sliceOf(e.clientX, e.clientY))}
      onClick={(e) => {
        const i = sliceOf(e.clientX, e.clientY);
        if (i === null) close();
        else play(i);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <svg ref={svgRef} className={s.wheel} viewBox={`${-R_OUT - 10} ${-R_OUT - 10} ${R_OUT * 2 + 20} ${R_OUT * 2 + 20}`} role="menu" aria-label="Emotes">
        <circle className={s.rim} r={R_OUT + 6} />
        {WHEEL.map((em, i) => (
          <g
            key={em.id}
            className={s.slice}
            data-lit={lit === i || undefined}
            role="menuitem"
            aria-label={em.label}
            data-testid={`emote-${em.id}`}
            onPointerEnter={() => setLit(i)}
          >
            <path d={PATHS[i]} />
            <text className={s.glyph} x={GLYPH_AT[i]![0]} y={GLYPH_AT[i]![1]} textAnchor="middle" dominantBaseline="central">
              {em.glyph}
            </text>
          </g>
        ))}
        <circle className={s.hub} r={R_IN - 8} />
        <text className={s.label} y={entry === null ? -6 : 0} textAnchor="middle" dominantBaseline="central">
          {entry === null ? 'Emotes' : entry.label}
        </text>
        {entry === null && (
          <text className={s.sub} y={20} textAnchor="middle" dominantBaseline="central">
            Pick one
          </text>
        )}
      </svg>
    </div>
  );
}
