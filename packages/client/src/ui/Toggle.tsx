import { useId } from 'react';
import s from './Toggle.module.css';
import { cx } from './cx';

export interface ToggleProps {
  readonly checked: boolean;
  readonly label: string;
  readonly description?: string;
  readonly onChange: (v: boolean) => void;
  readonly disabled?: boolean;
  readonly className?: string;
}

export function Toggle({ checked, label, description, onChange, disabled = false, className }: ToggleProps) {
  const id = useId();
  const descId = useId();
  return (
    <div data-testid="toggle" className={cx(s.toggle, disabled && s.disabled, className)}>
      <div className={s.text}>
        <label htmlFor={id} className={s.label}>
          {label}
        </label>
        {description !== undefined && (
          <p id={descId} className={s.description}>
            {description}
          </p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description !== undefined ? descId : undefined}
        disabled={disabled}
        className={cx(s.switch, checked && s.on)}
        onClick={() => onChange(!checked)}
      >
        <span className={s.knob} />
      </button>
    </div>
  );
}
