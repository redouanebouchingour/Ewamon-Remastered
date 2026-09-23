import { useState } from 'react';
import type { VariantKey } from '@ewa/core';
import { primaryType, speciesName } from '../data/content';
import { thumbUrl, useThumbSet } from '../data/thumbs';
import s from './CreatureSprite.module.css';
import { cx } from './cx';

export interface CreatureSpriteProps {
  readonly speciesId: string;
  readonly variantKey?: VariantKey;
  /** 40 / 56 / 72 / 120 px */
  readonly size?: 'sm' | 'md' | 'lg' | 'xl';
  /** unknown dex entry: dark silhouette, no name */
  readonly silhouette?: boolean;
  /** seen-but-not-caught dex entry */
  readonly desaturate?: boolean;
  readonly className?: string;
}

/**
 * The pipeline thumbnail when it exists, otherwise a type-tinted monogram disc — never a broken image and
 * never the game atlases (§20.10.2 rule 6). `loading="lazy"`, `decoding="async"`.
 */
export function CreatureSprite({ speciesId, variantKey = 'normal', size = 'md', silhouette = false, desaturate = false, className }: CreatureSpriteProps) {
  const thumbs = useThumbSet();
  const [failed, setFailed] = useState(false);
  const name = speciesName(speciesId);
  const showImg = thumbs.has(speciesId) && !failed;
  return (
    <span
      data-type={primaryType(speciesId)}
      className={cx(s.sprite, s[size], silhouette && s.silhouette, desaturate && s.desaturate, s[variantKey], className)}
      aria-hidden
    >
      {showImg ? (
        <img className={s.img} src={thumbUrl(speciesId)} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
      ) : (
        <span className={s.monogram}>{silhouette ? '?' : name.slice(0, 1).toUpperCase()}</span>
      )}
    </span>
  );
}
