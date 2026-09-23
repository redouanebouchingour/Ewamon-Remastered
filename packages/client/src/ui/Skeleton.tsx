import s from './Skeleton.module.css';
import { cx } from './cx';

/**
 * §20.9.13 loading (first): blocks matching the final layout, `--bg-2` with a 1.2 s shimmer (none under
 * reduced motion). Never a spinner, never over the canvas.
 */
export interface SkeletonProps {
  readonly shape: 'rows' | 'tiles' | 'table' | 'track' | 'block';
  readonly count?: number;
  readonly className?: string;
  readonly label?: string;
}

export function Skeleton({ shape, count = shape === 'tiles' ? 24 : shape === 'track' ? 10 : 6, className, label = 'Loading' }: SkeletonProps) {
  const items = Array.from({ length: count }, (_, i) => i);
  return (
    <div data-testid="skeleton" className={cx(s.root, s[shape], className)} role="status" aria-label={label} aria-busy>
      {shape === 'table' && <div className={cx(s.bone, s.header)} />}
      {shape === 'block' ? <div className={cx(s.bone, s.blockBone)} /> : items.map((i) => <div key={i} className={s.bone} />)}
    </div>
  );
}
