import type { KeyboardEvent, ReactNode } from 'react';
import type { CreatureInstance } from '@ewa/core';
import { displayName, itemInfo, maxHpOf, species } from '../data/content';
import s from './CreatureCard.module.css';
import { CreatureSprite } from './CreatureSprite';
import { cx } from './cx';
import { HpBar } from './HpBar';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { TypeBadge } from './TypeBadge';

export type CreatureBadge = 'favorite' | 'locked' | 'alpha' | 'listed';

/** SPEC §20.2.4 props, plus `caption` (showcase flavour line) and `trailing` (row-end slot). */
export interface CreatureCardProps {
  readonly creature: CreatureInstance;
  readonly variant?: 'row' | 'tile' | 'showcase';
  readonly selected?: boolean;
  readonly draggable?: boolean;
  readonly onClick?: () => void;
  readonly badges?: readonly CreatureBadge[];
  readonly caption?: string;
  readonly trailing?: ReactNode;
  readonly className?: string;
}

const BADGE_ICON: Readonly<Record<CreatureBadge, IconName>> = { favorite: 'star', locked: 'lock', alpha: 'alpha', listed: 'tag' };
const BADGE_LABEL: Readonly<Record<CreatureBadge, string>> = { favorite: 'Favourite', locked: 'Locked', alpha: 'Alpha', listed: 'Listed' };

/** favourite / locked / alpha from the instance itself; `listed` only when the caller says so. */
export function badgesOf(c: CreatureInstance, extra: readonly CreatureBadge[] = []): CreatureBadge[] {
  const out: CreatureBadge[] = [];
  if (c.favorite) out.push('favorite');
  if (c.locked) out.push('locked');
  if (c.isAlpha) out.push('alpha');
  for (const b of extra) if (!out.includes(b)) out.push(b);
  return out;
}

function Badges({ list }: { readonly list: readonly CreatureBadge[] }) {
  if (list.length === 0) return null;
  return (
    <span className={s.badges}>
      {list.map((b) => (
        <span key={b} className={cx(s.badge, s[`badge_${b}`])} title={BADGE_LABEL[b]}>
          <Icon name={BADGE_ICON[b]} size="sm" label={BADGE_LABEL[b]} />
        </span>
      ))}
    </span>
  );
}

export function CreatureCard({
  creature,
  variant = 'row',
  selected = false,
  draggable = false,
  onClick,
  badges,
  caption,
  trailing,
  className,
}: CreatureCardProps) {
  const sp = species(creature.speciesId);
  const name = displayName(creature);
  const maxHp = maxHpOf(creature);
  const list = badges ?? badgesOf(creature);
  const interactive = onClick !== undefined;
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (onClick !== undefined && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };
  const common = {
    'data-testid': 'creaturecard',
    'data-type': sp?.types[0] ?? 'Normal',
    role: interactive ? 'button' : undefined,
    tabIndex: interactive ? 0 : undefined,
    'aria-pressed': interactive ? selected : undefined,
    'aria-label': interactive ? `${name}, level ${creature.level}` : undefined,
    draggable: draggable || undefined,
    onClick,
    onKeyDown: interactive ? onKeyDown : undefined,
  } as const;

  if (variant === 'tile') {
    return (
      <div {...common} className={cx(s.card, s.tile, interactive && s.interactive, selected && s.selected, draggable && s.draggable, className)} title={`${name} · Lv ${creature.level}`}>
        <CreatureSprite speciesId={creature.speciesId} variantKey={creature.variantKey} size="lg" className={s.tileSprite} />
        <span className={s.tileLevel}>{creature.level}</span>
        <Badges list={list} />
      </div>
    );
  }

  if (variant === 'showcase') {
    return (
      <div {...common} className={cx(s.card, s.showcase, interactive && s.interactive, selected && s.selected, className)}>
        <span className={s.showcaseGlow} aria-hidden />
        <CreatureSprite speciesId={creature.speciesId} variantKey={creature.variantKey} size="xl" />
        <div className={s.showcaseText}>
          <h3 className={s.showcaseName}>{name}</h3>
          <div className={s.types}>{sp?.types.map((t) => <TypeBadge key={t} type={t} size="sm" />)}</div>
          {caption !== undefined && <p className={s.caption}>{caption}</p>}
        </div>
        {selected && (
          <span className={s.check} aria-hidden>
            <Icon name="check" size="sm" />
          </span>
        )}
      </div>
    );
  }

  const held = creature.heldItem === null ? null : itemInfo(creature.heldItem);
  return (
    <div {...common} className={cx(s.card, s.row, interactive && s.interactive, selected && s.selected, draggable && s.draggable, className)}>
      <CreatureSprite speciesId={creature.speciesId} variantKey={creature.variantKey} size="md" />
      <div className={s.rowMain}>
        <div className={s.rowTop}>
          <span className={s.name}>{name}</span>
          <span className={s.level}>Lv {creature.level}</span>
          <Badges list={list} />
        </div>
        <div className={s.rowMid}>
          <div className={s.types}>{sp?.types.map((t) => <TypeBadge key={t} type={t} size="sm" compact />)}</div>
          {held !== null && (
            <span className={s.held} title={`Holding ${held.name}`}>
              <Icon name="bag" size="sm" />
              {held.name}
            </span>
          )}
        </div>
        <HpBar hp={creature.hp} maxHp={maxHp} showNumbers status={creature.status} size="sm" />
      </div>
      {trailing}
    </div>
  );
}
