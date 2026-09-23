import { useRef } from 'react';
import type { KeyboardEvent } from 'react';
import s from './Tabs.module.css';
import { cx } from './cx';

export interface TabsProps<K extends string> {
  readonly tabs: readonly { readonly key: K; readonly label: string; readonly count?: number }[];
  readonly value: K;
  /** callers bind this to a ?tab= search param */
  readonly onChange: (k: K) => void;
  readonly className?: string;
  readonly label?: string;
}

export function Tabs<K extends string>({ tabs, value, onChange, className, label }: TabsProps<K>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    const i = tabs.findIndex((t) => t.key === value);
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const t = tabs[next]!;
    onChange(t.key);
    refs.current[next]?.focus();
  };
  return (
    <div data-testid="tabs" role="tablist" aria-label={label} className={cx(s.tabs, className)} onKeyDown={onKeyDown}>
      {tabs.map((t, i) => {
        const selected = t.key === value;
        return (
          <button
            key={t.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className={cx(s.tab, selected && s.selected)}
            onClick={() => onChange(t.key)}
          >
            <span>{t.label}</span>
            {t.count !== undefined && t.count > 0 && <span className={s.count}>{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
