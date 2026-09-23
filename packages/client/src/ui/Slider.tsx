import { useId } from 'react';
import s from './Slider.module.css';
import { cssVars } from './cssVars';
import { cx } from './cx';

export interface SliderProps {
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly label: string;
  readonly format?: (v: number) => string;
  readonly onChange: (v: number) => void;
  readonly className?: string;
  readonly disabled?: boolean;
}

export function Slider({ value, min, max, step, label, format, onChange, className, disabled = false }: SliderProps) {
  const id = useId();
  const frac = max > min ? (value - min) / (max - min) : 0;
  const text = format !== undefined ? format(value) : String(value);
  return (
    <div data-testid="slider" className={cx(s.slider, disabled && s.disabled, className)}>
      <div className={s.row}>
        <label htmlFor={id} className={s.label}>
          {label}
        </label>
        <output htmlFor={id} className={s.value}>
          {text}
        </output>
      </div>
      <input
        id={id}
        className={s.input}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-valuetext={text}
        style={cssVars({ '--fill': frac })}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
      />
    </div>
  );
}
