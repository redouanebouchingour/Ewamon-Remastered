import { useRef } from 'react';
import type { StatusId } from '@ewa/core';
import s from './HpBar.module.css';
import { cssVars } from './cssVars';
import { cx } from './cx';

export interface HpBarProps {
  readonly hp: number;
  readonly maxHp: number;
  /** drain duration override; default §20.2.6 350 + 650 × damageFraction ms, max 1 000 */
  readonly animateMs?: number;
  readonly showNumbers?: boolean;
  readonly status?: readonly StatusId[];
  readonly className?: string;
  readonly size?: 'sm' | 'md';
}

export const STATUS_LABEL: Readonly<Record<StatusId, string>> = {
  burn: 'BRN',
  poison: 'PSN',
  paralyze: 'PAR',
  sleep: 'SLP',
  freeze: 'FRZ',
  confuse: 'CNF',
};

/** §20.2.4: the colour switches at 0.5 and 0.2 — three classes chosen here, not a container query. */
export function hpTone(frac: number): 'hi' | 'mid' | 'lo' {
  return frac > 0.5 ? 'hi' : frac >= 0.2 ? 'mid' : 'lo';
}

export function drainMs(prevFrac: number, nextFrac: number): number {
  const damage = Math.max(0, prevFrac - nextFrac);
  return Math.min(1000, Math.round(350 + 650 * damage));
}

export function StatusChip({ status }: { readonly status: StatusId }) {
  return (
    <span className={cx(s.status, s[status])} title={status}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function HpBar({ hp, maxHp, animateMs, showNumbers = false, status = [], className, size = 'md' }: HpBarProps) {
  const frac = maxHp > 0 ? Math.min(1, Math.max(0, hp / maxHp)) : 0;
  const prev = useRef(frac);
  const ms = animateMs ?? drainMs(prev.current, frac);
  prev.current = frac;
  const tone = hpTone(frac);
  return (
    <div data-testid="hpbar" className={cx(s.root, s[size], className)}>
      <div
        className={s.track}
        role="meter"
        aria-label="HP"
        aria-valuemin={0}
        aria-valuemax={maxHp}
        aria-valuenow={hp}
        aria-valuetext={`${hp} of ${maxHp} HP`}
      >
        <div className={s.trail} style={cssVars({ '--hp': frac, '--hp-ms': `${ms}ms` })} />
        <div className={cx(s.fill, s[tone])} style={cssVars({ '--hp': frac, '--hp-ms': `${ms}ms` })} />
      </div>
      {(showNumbers || status.length > 0) && (
        <div className={s.meta}>
          {status.map((st) => (
            <StatusChip key={st} status={st} />
          ))}
          {showNumbers && (
            <span className={s.numbers}>
              {hp}
              <span className={s.max}> / {maxHp}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
