import type { MoveDef } from '@ewa/core';
import s from './MoveButton.module.css';
import { cx } from './cx';

export type Effectiveness = 0 | 0.25 | 0.5 | 1 | 2 | 4;

export interface MoveButtonProps {
  readonly move: MoveDef;
  readonly pp: number;
  readonly ppMax: number;
  /** shown only once the target species is dex-`seen` (§20.2.4); null/undefined = nothing */
  readonly effectiveness?: Effectiveness | null;
  readonly disabled?: boolean;
  readonly onClick?: () => void;
  readonly hotkey?: '1' | '2' | '3' | '4';
  /** Broadcast UI: 'lg' is the battle deck's card (fills its cell, the move name big); 'md' everywhere else */
  readonly size?: 'md' | 'lg';
  readonly className?: string;
}

/** Shape-coded chevrons (§20.8.3): colour is never the only signal. */
export const EFFECTIVENESS_MARK: Readonly<Record<Effectiveness, { readonly mark: string; readonly label: string } | null>> = {
  4: { mark: '▲▲', label: 'Extremely effective' },
  2: { mark: '▲', label: 'Super effective' },
  1: null,
  0.5: { mark: '▼', label: 'Not very effective' },
  0.25: { mark: '▼▼', label: 'Mostly ineffective' },
  0: { mark: '✕', label: 'No effect' },
};

const MULT: Readonly<Record<Effectiveness, string>> = { 4: '×4', 2: '×2', 1: '×1', 0.5: '×½', 0.25: '×¼', 0: '×0' };

/**
 * One move (Broadcast UI, 2026-10-11). Interactive (a <button>, the battle menu and the learn/teach prompts): a solid
 * slab of the move's TYPE colour (`[data-type]` → --tc / --tc-ink, so the colourblind palettes swap it) with a slanted
 * right edge — key chip, type name, the effectiveness chevrons in a black box, the name in the display face, POW and
 * PP. Hover / focus lift it and put the orange bar under it. Static (a <div>, the party detail): a carbon row with a
 * type stripe. The type is always spelled out, so colour is never the only signal.
 */
export function MoveButton({ move, pp, ppMax, effectiveness = null, disabled = false, onClick, hotkey, size = 'md', className }: MoveButtonProps) {
  const eff = effectiveness === null ? null : EFFECTIVENESS_MARK[effectiveness];
  const low = ppMax > 0 && pp / ppMax <= 0.25;
  const empty = pp <= 0;
  const ppText = (
    <span className={cx(s.pp, low && s.low, empty && s.empty)}>
      <span className={s.statLabel}>PP</span> <b className={s.num}>{pp}</b>
      <span className={s.max}>/{ppMax}</span>
    </span>
  );
  const pow = (
    <span className={s.pow}>
      <span className={s.statLabel}>POW</span> <b className={s.num}>{move.power > 0 ? move.power : '—'}</b>
    </span>
  );
  const acc = <span className={s.acc}>{move.accuracy !== null ? `${move.accuracy}% acc` : 'never misses'}</span>;
  const effBox = eff !== null && (
    <span className={cx(s.eff, effectiveness !== null && effectiveness > 1 ? s.good : s.bad)} title={eff.label} aria-label={eff.label}>
      <span aria-hidden>{eff.mark}</span>
      {effectiveness !== null && <span className={s.mult} aria-hidden>{MULT[effectiveness]}</span>}
    </span>
  );
  if (onClick === undefined) {
    return (
      <div data-testid="movebutton" data-type={move.type} className={cx(s.row, className)} title={move.description}>
        <span className={s.stripe} aria-hidden />
        <span className={s.rowBody}>
          <span className={s.rowName}>{move.id}</span>
          {effBox}
          <span className={s.rowType}>{move.type}</span>
          <span className={s.rowStats}>
            {pow}
            {ppText}
            {acc}
          </span>
        </span>
      </div>
    );
  }
  return (
    <button
      data-testid="movebutton"
      data-type={move.type}
      type="button"
      className={cx(s.move, s[size], className)}
      disabled={disabled}
      onClick={onClick}
      title={move.description}
      aria-keyshortcuts={hotkey}
    >
      <span className={s.slab}>
        <span className={s.top}>
          {hotkey !== undefined && <kbd className={s.hotkey}>{hotkey}</kbd>}
          <span className={s.type}>{move.type}</span>
          {effBox}
        </span>
        <span className={s.name}>{move.id}</span>
        <span className={s.stats}>
          {pow}
          {ppText}
          {size === 'md' && acc}
        </span>
      </span>
      <span className={s.bar} aria-hidden />
    </button>
  );
}
