import { useState } from 'react';
import { shinyPaletteOf } from '@ewa/content';
import { formsOf } from '@ewa/core';
import type { VariantKey } from '@ewa/core';
import { primaryType, species, speciesName } from '../data/content';
import { animatedThumbUrl, thumbUrl, useAnimatedThumbSet, useThumbSet } from '../data/thumbs';
import s from './CreatureSprite.module.css';
import { cssVars } from './cssVars';
import { cx } from './cx';

export interface CreatureSpriteProps {
  readonly speciesId: string;
  /** a form the creature wears outside a battle (`wornForm`, ravatar's relic forms): its `<species>_<form>` thumb */
  readonly form?: string | null;
  readonly variantKey?: VariantKey;
  /** 40 / 56 / 72 / 120 / 176 px (xxl: the Dex entry's hero) */
  readonly size?: 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
  /** a shiny: its species' shiny palette (content `shinyPaletteOf`, the world billboard's triple) and a gold glint sweeping over the thumbnail */
  readonly shiny?: boolean;
  /** unknown dex entry: dark silhouette, no name */
  readonly silhouette?: boolean;
  /** seen-but-not-caught dex entry */
  readonly desaturate?: boolean;
  /** plays the animated dex thumb when the sprite has one (a front flipbook: the animated legendaries / mythicals); never for a silhouette */
  readonly animated?: boolean;
  readonly className?: string;
}

/**
 * The pipeline thumbnail when it exists, otherwise a type-tinted monogram disc — never a broken image and
 * never the game atlases (§20.10.2 rule 6). `loading="lazy"`, `decoding="async"`. `animated`: the looping dex thumb
 * in its place where the sprite has one; one that fails to load falls back to the still.
 */
export function CreatureSprite({ speciesId, form = null, variantKey = 'normal', size = 'md', shiny = false, silhouette = false, desaturate = false, animated = false, className }: CreatureSpriteProps) {
  const thumbs = useThumbSet();
  const moving = useAnimatedThumbSet();
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [failedAnimKey, setFailedAnimKey] = useState<string | null>(null);
  const name = speciesName(speciesId);
  // a form without its own thumb (the pipeline output absent) falls back to the species' one
  const formKey = form === null ? null : `${speciesId}_${form}`;
  const key = formKey !== null && thumbs.has(formKey) ? formKey : speciesId;
  const showImg = thumbs.has(key) && failedKey !== key;
  const anim = animated && !silhouette && moving.has(key) && failedAnimKey !== key;
  const sp = form === null ? undefined : species(speciesId);
  const formType = sp === undefined ? undefined : formsOf(sp).find((f) => f.id === form)?.types?.[0];
  const pal = shiny && !silhouette ? shinyPaletteOf(speciesId) : null;
  return (
    <span
      data-type={formType ?? primaryType(speciesId)}
      data-form={form ?? undefined}
      className={cx(s.sprite, s[size], silhouette && s.silhouette, desaturate && s.desaturate, s[variantKey], shiny && !silhouette && s.shiny, className)}
      style={cssVars({ '--shiny-pal-hue': pal === null ? undefined : `${pal.hue}deg`, '--shiny-pal-sat': pal?.saturation, '--shiny-pal-lit': pal?.lightness })}
      aria-hidden
    >
      {showImg ? (
        anim ? (
          <img key={`${key}:anim`} className={s.img} src={animatedThumbUrl(key)} alt="" loading="lazy" decoding="async" data-animated="" onError={() => setFailedAnimKey(key)} />
        ) : (
          <img key={key} className={s.img} src={thumbUrl(key)} alt="" loading="lazy" decoding="async" onError={() => setFailedKey(key)} />
        )
      ) : (
        <span className={s.monogram}>{silhouette ? '?' : name.slice(0, 1).toUpperCase()}</span>
      )}
    </span>
  );
}
