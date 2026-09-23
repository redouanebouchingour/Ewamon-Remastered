import type { MoveDef } from '@ewa/core';
import s from './MoveButton.module.css';
import { cx } from './cx';
import { TypeBadge } from './TypeBadge';

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

/**
 * One move: name (+ hotkey, effectiveness chevrons), its TypeBadge and PP, then power · accuracy. The type is
 * carried by the badge and a restrained type tint in the fill; the border is uniform (type-tinted on hover/focus).
 * Rendered as a <div> when not interactive (party detail), a <button> in the battle menu.
 */
export function MoveButton({ move, pp, ppMax, effectiveness = null, disabled = false, onClick, hotkey, className }: MoveButtonProps) {
  const eff = effectiveness === null ? null : EFFECTIVENESS_MARK[effectiveness];
  const low = ppMax > 0 && pp / ppMax <= 0.25;
  const empty = pp <= 0;
  const body = (
    <>
      <span className={s.top}>
        {hotkey !== undefined && <kbd className={s.hotkey}>{hotkey}</kbd>}
        <span className={s.name}>{move.id}</span>
        {eff !== null && (
          <span className={cx(s.eff, effectiveness !== null && effectiveness > 1 ? s.good : s.bad)} title={eff.label} aria-label={eff.label}>
            {eff.mark}
          </span>
        )}
      </span>
      <span className={s.middle}>
        <TypeBadge type={move.type} size="sm" />
        <span className={cx(s.pp, low && s.low, empty && s.empty)}>
          {pp}/{ppMax} PP
        </span>
      </span>
      <span className={s.stats}>
        {move.power > 0 ? `Power ${move.power}` : 'Status move'}
        {move.accuracy !== null ? ` · ${move.accuracy}% acc` : ' · never misses'}
      </span>
    </>
  );
  if (onClick === undefined) {
    return (
      <div data-testid="movebutton" data-type={move.type} className={cx(s.move, s.static, className)} title={move.description}>
        {body}
      </div>
    );
  }
  return (
    <button
      data-testid="movebutton"
      data-type={move.type}
      type="button"
      className={cx(s.move, className)}
      disabled={disabled}
      onClick={onClick}
      title={move.description}
      aria-keyshortcuts={hotkey}
    >
      {body}
    </button>
  );
}
