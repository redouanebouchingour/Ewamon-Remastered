import { useState } from 'react';
import { formsOf } from '@ewa/core';
import type { VariantKey } from '@ewa/core';
import { primaryType, species, speciesName } from '../data/content';
import { thumbUrl, useThumbSet } from '../data/thumbs';
import s from './CreatureSprite.module.css';
import { cx } from './cx';

export interface CreatureSpriteProps {
  readonly speciesId: string;
  /** a form the creature wears outside a battle (`wornForm`, ravatar's relic forms): its `<species>_<form>` thumb */
  readonly form?: string | null;
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
export function CreatureSprite({ speciesId, form = null, variantKey = 'normal', size = 'md', silhouette = false, desaturate = false, className }: CreatureSpriteProps) {
  const thumbs = useThumbSet();
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const name = speciesName(speciesId);
  // a form without its own thumb (the pipeline output absent) falls back to the species' one
  const formKey = form === null ? null : `${speciesId}_${form}`;
  const key = formKey !== null && thumbs.has(formKey) ? formKey : speciesId;
  const showImg = thumbs.has(key) && failedKey !== key;
  const sp = form === null ? undefined : species(speciesId);
  const formType = sp === undefined ? undefined : formsOf(sp).find((f) => f.id === form)?.types?.[0];
  return (
    <span
      data-type={formType ?? primaryType(speciesId)}
      data-form={form ?? undefined}
      className={cx(s.sprite, s[size], silhouette && s.silhouette, desaturate && s.desaturate, s[variantKey], className)}
      aria-hidden
    >
      {showImg ? (
        <img key={key} className={s.img} src={thumbUrl(key)} alt="" loading="lazy" decoding="async" onError={() => setFailedKey(key)} />
      ) : (
        <span className={s.monogram}>{silhouette ? '?' : name.slice(0, 1).toUpperCase()}</span>
      )}
    </span>
  );
}
