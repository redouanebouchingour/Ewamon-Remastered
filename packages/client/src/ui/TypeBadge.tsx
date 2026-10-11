import type { TypeName } from '@ewa/core';
import s from './TypeBadge.module.css';
import { cx } from './cx';
import { TYPE_ICON_PATHS } from './typeIcons';

export { TYPE_ICON_PATHS };

export interface TypeBadgeProps {
  readonly type: TypeName;
  readonly size?: 'sm' | 'md';
  readonly className?: string;
  /** icon only (dense grids); the name stays available to assistive tech */
  readonly compact?: boolean;
}

/**
 * Renders the type's icon + name (Broadcast UI, 2026-10-11: the icon replaced the 2-letter glyph, so colour is still
 * never the only signal, §20.8.3); colour from tokens.css `[data-type]` → --tc / --tc-ink (colourblind palettes swap it).
 */
export function TypeBadge({ type, size = 'md', className, compact = false }: TypeBadgeProps) {
  return (
    <span data-testid="typebadge" data-type={type} className={cx(s.badge, s[size], compact && s.compact, className)} title={type}>
      <span className={s.glyph} aria-hidden>
        <svg className={s.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" focusable="false">
          <path d={TYPE_ICON_PATHS[type]} />
        </svg>
      </span>
      <span className={compact ? 'visually-hidden' : s.name}>{type}</span>
    </span>
  );
}
