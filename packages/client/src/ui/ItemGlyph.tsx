import { useState } from 'react';
import { itemSpriteUrl } from '../data/content';
import type { ItemKind } from '../data/content';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import s from './ItemGlyph.module.css';

const KIND_ICON: Readonly<Record<ItemKind, IconName>> = { consumable: 'heart', orb: 'orb', held: 'bag', key: 'star' };

export interface ItemGlyphProps {
  readonly id: string;
  readonly kind: ItemKind;
}

/** The item's own sprite when it has one, otherwise its kind's icon; a sprite that fails to load falls back to the icon. */
export function ItemGlyph({ id, kind }: ItemGlyphProps) {
  const [failed, setFailed] = useState<string | null>(null);
  const url = itemSpriteUrl(id);
  if (url === null || failed === id) return <Icon name={KIND_ICON[kind]} size="sm" />;
  return <img key={id} className={s.sprite} src={url} alt="" loading="lazy" decoding="async" onError={() => setFailed(id)} />;
}
