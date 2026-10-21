/**
 * Breeding: an egg, drawn (no sprite: the atlases stay as they are). A paper-white shell with a carbon band; a bandborn
 * egg carries the two form colours instead, a crimson crack over a gold mended seam (the cracked ring and the whole
 * ring of the form sigil). `stage` drives the hatch: 'rest', 'wobble' (it rocks), 'crack' (the shell splits).
 */
import { cx } from './cx';
import s from './Egg.module.css';

export interface EggProps {
  readonly bandborn?: boolean;
  readonly size?: 'sm' | 'md' | 'xl';
  readonly stage?: 'rest' | 'wobble' | 'crack';
  /** the accessible name; absent = decorative */
  readonly label?: string;
  readonly className?: string;
}

export function Egg({ bandborn = false, size = 'md', stage = 'rest', label, className }: EggProps) {
  return (
    <span
      data-testid="egg"
      data-stage={stage}
      data-bandborn={bandborn || undefined}
      className={cx(s.egg, s[size], className)}
      role={label === undefined ? undefined : 'img'}
      aria-label={label}
      aria-hidden={label === undefined ? true : undefined}
    >
      <span className={s.shell}>
        <span className={s.band} />
        <span className={s.crack} />
      </span>
    </span>
  );
}
