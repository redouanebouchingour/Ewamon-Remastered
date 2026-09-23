import s from './ProgressBar.module.css';
import { cssVars } from './cssVars';
import { cx } from './cx';

export interface ProgressBarProps {
  /** 0..1 */
  readonly value: number;
  /** optional second, lighter segment drawn under `value` (dex: seen-only as hatched) */
  readonly secondary?: number;
  readonly label: string;
  readonly valueText?: string;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly className?: string;
}

export function ProgressBar({ value, secondary, label, valueText, size = 'md', className }: ProgressBarProps) {
  const v = Math.min(1, Math.max(0, value));
  const sec = secondary === undefined ? undefined : Math.min(1, Math.max(v, secondary));
  return (
    <div
      data-testid="progressbar"
      className={cx(s.track, s[size], className)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      aria-valuetext={valueText}
    >
      {sec !== undefined && <div className={s.secondary} style={cssVars({ '--p': sec })} />}
      <div className={s.fill} style={cssVars({ '--p': v })} />
    </div>
  );
}
