import { useId } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import s from './Field.module.css';
import { cx } from './cx';
import { Icon } from './Icon';
import type { IconName } from './Icon';

export interface TextFieldProps {
  readonly label: string;
  readonly name?: string;
  readonly type?: 'text' | 'password' | 'email' | 'search' | 'number';
  readonly value?: string;
  readonly defaultValue?: string;
  readonly onChange?: (v: string) => void;
  readonly placeholder?: string;
  /** field-specific error from the server/action (§20.9.1): rendered under the field */
  readonly error?: string | null;
  readonly hint?: ReactNode;
  readonly autoComplete?: string;
  readonly autoFocus?: boolean;
  readonly required?: boolean;
  readonly minLength?: number;
  readonly maxLength?: number;
  /** show `n / max` once the length reaches this (§20.9.7 composer: visible from 250) */
  readonly counterFrom?: number;
  readonly icon?: IconName;
  readonly hideLabel?: boolean;
  readonly disabled?: boolean;
  readonly className?: string;
  readonly inputMode?: 'text' | 'numeric' | 'email' | 'search';
  readonly pattern?: string;
  readonly min?: number;
  readonly max?: number;
}

export function TextField({
  label,
  name,
  type = 'text',
  value,
  defaultValue,
  onChange,
  placeholder,
  error = null,
  hint,
  autoComplete,
  autoFocus,
  required,
  minLength,
  maxLength,
  counterFrom,
  icon,
  hideLabel = false,
  disabled = false,
  className,
  inputMode,
  pattern,
  min,
  max,
}: TextFieldProps) {
  const id = useId();
  const msgId = useId();
  const length = value?.length ?? 0;
  const showCounter = counterFrom !== undefined && maxLength !== undefined && length >= counterFrom;
  return (
    <div data-testid="textfield" className={cx(s.field, error !== null && s.invalid, disabled && s.disabled, className)}>
      <label htmlFor={id} className={hideLabel ? 'visually-hidden' : s.label}>
        {label}
      </label>
      <div className={s.control}>
        {icon !== undefined && <Icon name={icon} size="sm" className={s.icon} />}
        <input
          id={id}
          className={cx(s.input, icon !== undefined && s.withIcon)}
          name={name}
          type={type}
          value={value}
          defaultValue={defaultValue}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          required={required}
          minLength={minLength}
          maxLength={maxLength}
          disabled={disabled}
          inputMode={inputMode}
          pattern={pattern}
          min={min}
          max={max}
          aria-invalid={error !== null || undefined}
          aria-describedby={error !== null || hint !== undefined ? msgId : undefined}
          onChange={onChange !== undefined ? (e: ChangeEvent<HTMLInputElement>) => onChange(e.currentTarget.value) : undefined}
        />
      </div>
      {(error !== null || hint !== undefined || showCounter) && (
        <div className={s.foot}>
          {error !== null ? (
            <p id={msgId} className={s.error} role="alert">
              {error}
            </p>
          ) : hint !== undefined ? (
            <p id={msgId} className={s.hint}>
              {hint}
            </p>
          ) : (
            <span />
          )}
          {showCounter && (
            <span className={cx(s.counter, length >= (maxLength ?? 0) && s.counterFull)}>
              {length} / {maxLength}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export interface SelectOption<V extends string> {
  readonly value: V;
  readonly label: string;
}

export interface SelectProps<V extends string> {
  readonly label: string;
  readonly value: V;
  readonly options: readonly SelectOption<V>[];
  readonly onChange: (v: V) => void;
  readonly hideLabel?: boolean;
  readonly disabled?: boolean;
  readonly className?: string;
  readonly name?: string;
}

export function Select<V extends string>({ label, value, options, onChange, hideLabel = false, disabled = false, className, name }: SelectProps<V>) {
  const id = useId();
  return (
    <div data-testid="select" className={cx(s.field, disabled && s.disabled, className)}>
      <label htmlFor={id} className={hideLabel ? 'visually-hidden' : s.label}>
        {label}
      </label>
      <div className={s.control}>
        <select id={id} name={name} className={cx(s.input, s.select)} value={value} disabled={disabled} onChange={(e) => onChange(e.currentTarget.value as V)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Icon name="chevronDown" size="sm" className={s.chevron} />
      </div>
    </div>
  );
}

export interface SegmentedProps<V extends string> {
  readonly label: string;
  readonly value: V;
  readonly options: readonly SelectOption<V>[];
  readonly onChange: (v: V) => void;
  readonly className?: string;
}

/** A radio group drawn as one pill (tri-state reduced motion, battle text speed, DM policy). */
export function Segmented<V extends string>({ label, value, options, onChange, className }: SegmentedProps<V>) {
  return (
    <div data-testid="segmented" role="radiogroup" aria-label={label} className={cx(s.segmented, className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={cx(s.segment, o.value === value && s.segmentOn)}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export interface StepperProps {
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly onChange: (v: number) => void;
  readonly label: string;
  readonly className?: string;
}

/** Quantity 1..99 (§20.9.6). */
export function Stepper({ value, min, max, onChange, label, className }: StepperProps) {
  const clamp = (v: number): number => Math.min(max, Math.max(min, Math.round(v)));
  return (
    <div data-testid="stepper" className={cx(s.stepper, className)} role="group" aria-label={label}>
      <button type="button" className={s.stepBtn} onClick={() => onChange(clamp(value - 1))} disabled={value <= min} aria-label={`Decrease ${label}`}>
        <Icon name="minus" size="sm" />
      </button>
      <input
        className={s.stepInput}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        aria-label={label}
        onChange={(e) => {
          const n = Number(e.currentTarget.value);
          if (Number.isFinite(n)) onChange(clamp(n));
        }}
      />
      <button type="button" className={s.stepBtn} onClick={() => onChange(clamp(value + 1))} disabled={value >= max} aria-label={`Increase ${label}`}>
        <Icon name="plus" size="sm" />
      </button>
    </div>
  );
}

export function FormError({ children }: { readonly children: ReactNode }) {
  return (
    <p className={s.formError} role="alert">
      <Icon name="warn" size="sm" />
      <span>{children}</span>
    </p>
  );
}
