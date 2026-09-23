import type { TypeName } from '@ewa/core';
import s from './TypeBadge.module.css';
import { cx } from './cx';

/** SPEC §20.2.4: the 2-letter glyph every badge carries, so colour is never the only signal (§20.8.3). */
export const TYPE_GLYPHS: Readonly<Record<TypeName, string>> = {
  Normal: 'NO',
  Fire: 'FI',
  Water: 'WA',
  Grass: 'GR',
  Electric: 'EL',
  Ice: 'IC',
  Fighting: 'FT',
  Poison: 'PO',
  Ground: 'GD',
  Flying: 'FL',
  Psychic: 'PS',
  Bug: 'BU',
  Rock: 'RO',
  Ghost: 'GH',
  Dragon: 'DR',
  Steel: 'ST',
  Fairy: 'FA',
  Dark: 'DK',
  Cosmic: 'CO',
};

export interface TypeBadgeProps {
  readonly type: TypeName;
  readonly size?: 'sm' | 'md';
  readonly className?: string;
  /** glyph only (dense grids); the name stays available to assistive tech */
  readonly compact?: boolean;
}

/** Renders glyph + name; colour from tokens.css `[data-type]` → --tc / --tc-ink (colourblind palettes swap it). */
export function TypeBadge({ type, size = 'md', className, compact = false }: TypeBadgeProps) {
  return (
    <span data-testid="typebadge" data-type={type} className={cx(s.badge, s[size], compact && s.compact, className)} title={type}>
      <span className={s.glyph} aria-hidden>
        {TYPE_GLYPHS[type]}
      </span>
      <span className={compact ? 'visually-hidden' : s.name}>{type}</span>
    </span>
  );
}
