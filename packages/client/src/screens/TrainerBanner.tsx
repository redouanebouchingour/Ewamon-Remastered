/**
 * Trainer banners (content `data/banners.ts`): the card another trainer sees when they inspect you in the world, at the
 * head of your public profile, and live in the profile's banner editor. A frame (its rarity sets how loud the edge is:
 * epic and up glow, legendary and mythic frames carry a moving edge), a backdrop (a type backdrop paints in its type
 * colour behind its icon), the featured creature, up to three pins at their tier and up to three stat trackers.
 * Display only: what a banner may show is the server's to decide (`GET /players/:username` `banner`).
 */
import type { ReactNode } from 'react';
import type { CreatureInstance } from '@ewa/core';
import { bannerBackdrop, bannerForms, bannerFrame, bannerPin, bannerTracker } from '@ewa/content';
import type { PublicProfile } from '@ewa/protocol';
import { speciesName } from '../data/content';
import { tierLabel } from '../data/trainer';
import { CreatureSprite } from '../ui/CreatureSprite';
import { FormSigil } from '../ui/FormSigil';
import { Icon } from '../ui/Icon';
import type { IconName } from '../ui/Icon';
import { cx } from '../ui/cx';
import { TYPE_ICON_PATHS } from '../ui/typeIcons';
import s from './TrainerBanner.module.css';

export interface BannerModel {
  readonly username: string;
  readonly title: string;
  readonly guildTag: string | null;
  readonly tier: string;
  readonly frame: string;
  readonly backdrop: string;
  readonly pins: readonly { readonly id: string; readonly tier: number }[];
  readonly trackers: readonly { readonly id: string; readonly value: number }[];
  readonly featured: CreatureInstance | null;
  /** the featured creature's Majin / Tenjin form (content `bannerForms`), null its own look */
  readonly featuredForm: string | null;
}

/** A public profile as a banner; an older server's profile (no `banner`) shows the default with the showcase lead. */
export function bannerModelOf(pub: PublicProfile): BannerModel {
  const b = pub.banner;
  return {
    username: pub.username,
    title: pub.title,
    guildTag: pub.guildTag,
    tier: pub.tier,
    frame: b?.frame ?? 'standard',
    backdrop: b?.backdrop ?? 'midnight',
    pins: b?.pins ?? [],
    trackers: b?.trackers ?? [
      { id: 'rating', value: pub.rating },
      { id: 'dexCaught', value: pub.dexCaughtCount },
      { id: 'badges', value: pub.badges.length },
    ],
    featured: (b === undefined ? pub.showcase[0] : b.featured) ?? null,
    featuredForm: b?.featuredForm ?? null,
  };
}

const PIN_ICONS: Readonly<Record<string, IconName>> = {
  gym_conqueror: 'shield',
  collector: 'dex',
  duelist: 'sword',
  ranked: 'star',
  spire_climber: 'arrowUp',
  shiny_hunter: 'sparkle',
  legend_seeker: 'orb',
  veteran: 'user',
  achiever: 'trophy',
  champion: 'trophy',
  season_finalist: 'star',
  season_champion: 'trophy',
};

const NUMERALS = ['I', 'II', 'III', 'IV', 'V'];
const METALS = ['bronze', 'silver', 'gold', 'diamond', 'master'] as const;

/** A pin's look at a tier: the top tier of every pin is the brightest metal, a one-tier pin is master. */
export function pinMetal(tiers: number, tier: number): (typeof METALS)[number] {
  if (tiers <= 1) return 'master';
  return METALS[Math.max(0, METALS.length - 1 - (tiers - tier))] ?? 'bronze';
}

export function pinLabel(id: string, tier: number): string {
  const pin = bannerPin(id);
  if (pin === undefined) return id;
  return pin.tiers.length > 1 ? `${pin.name} ${NUMERALS[tier - 1] ?? tier}` : pin.name;
}

export function BannerPin({ id, tier, size = 'md' }: { readonly id: string; readonly tier: number; readonly size?: 'sm' | 'md' }) {
  const pin = bannerPin(id);
  if (pin === undefined) return null;
  const label = pinLabel(id, tier);
  return (
    <span className={cx(s.pin, size === 'sm' && s.pinSm)} data-metal={pinMetal(pin.tiers.length, tier)} title={`${label} · ${pin.blurb}`} aria-label={label}>
      <span className={s.pinFace} aria-hidden>
        <Icon name={PIN_ICONS[id] ?? 'star'} size="sm" />
      </span>
      {pin.tiers.length > 1 && (
        <span className={s.pinTier} aria-hidden>
          {NUMERALS[tier - 1] ?? tier}
        </span>
      )}
    </span>
  );
}

function TypeMark({ type }: { readonly type: keyof typeof TYPE_ICON_PATHS }) {
  return (
    <svg className={s.watermark} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
      <path d={TYPE_ICON_PATHS[type]} />
    </svg>
  );
}

export interface TrainerBannerProps {
  readonly model: BannerModel;
  /** md: the world's inspect card and the editor; lg: the head of a public profile */
  readonly size?: 'md' | 'lg';
  readonly className?: string;
}

export function TrainerBanner({ model, size = 'md', className }: TrainerBannerProps) {
  const frame = bannerFrame(model.frame) ?? bannerFrame('standard')!;
  const backdrop = bannerBackdrop(model.backdrop) ?? bannerBackdrop('midnight')!;
  const f = model.featured;
  const form = f === null || model.featuredForm === null ? undefined : bannerForms(f.speciesId).find((x) => x.id === model.featuredForm);
  return (
    <article
      className={cx(s.banner, s[size], className)}
      data-testid="trainerbanner"
      data-frame={frame.id}
      data-rarity={frame.rarity}
      data-backdrop={backdrop.id}
      data-type={backdrop.type ?? undefined}
      aria-label={`${model.username}'s banner, ${frame.name} frame`}
    >
      <span className={s.edge} aria-hidden />
      <div className={s.card}>
        <div className={s.backdrop} aria-hidden>
          {backdrop.type !== null && <TypeMark type={backdrop.type} />}
        </div>
        <span className={s.sheen} aria-hidden />
        <header className={s.head}>
          <p className={s.titleLine}>{model.title}</p>
          <h3 className={s.name}>{model.username}</h3>
          <div className={s.headRow}>
            {model.guildTag !== null && <span className={s.guild}>[{model.guildTag}]</span>}
            <span className={s.tier} data-tier={model.tier}>
              {tierLabel(model.tier)}
            </span>
          </div>
        </header>
        <div className={s.stage}>
          {f !== null ? (
            <>
              <CreatureSprite speciesId={f.speciesId} form={form?.id ?? null} variantKey={f.variantKey} shiny={f.isShiny === true} animated size="xxl" className={s.hero} />
              <p className={s.heroName}>
                {f.nickname ?? speciesName(f.speciesId)} <span className={s.heroLevel}>Lv {f.level}</span>
              </p>
              {form !== undefined && (
                <p className={s.heroForm} data-band={form.kind}>
                  {form.kind !== undefined && <FormSigil kind={form.kind} size="sm" />}
                  {form.name}
                </p>
              )}
            </>
          ) : (
            <span className={s.heroEmpty}>No partner</span>
          )}
        </div>
        <div className={s.foot}>
          {model.pins.length > 0 && (
            <ul className={s.pins} aria-label="Pins">
              {model.pins.map((p) => (
                <li key={p.id}>
                  <BannerPin id={p.id} tier={p.tier} />
                </li>
              ))}
            </ul>
          )}
          {model.trackers.length > 0 && (
            <dl className={s.trackers} aria-label="Trackers">
              {model.trackers.map((t) => (
                <div key={t.id} className={s.tracker}>
                  <dt className={s.trackerLabel}>{bannerTracker(t.id)?.label ?? t.id}</dt>
                  <dd className={s.trackerValue}>{t.value.toLocaleString('en-US')}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        {frame.id === 'laurel' && <span className={s.laurel} aria-hidden />}
        {frame.rarity === 'mythic' && (
          <span className={s.embers} aria-hidden>
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
        )}
      </div>
    </article>
  );
}

/** The head of a public profile: the banner large, the rest of the card beside it (below it on a narrow panel). */
export function BannerHero({ model, children }: { readonly model: BannerModel; readonly children: ReactNode }) {
  return (
    <div className={s.heroLayout}>
      <TrainerBanner model={model} size="lg" />
      <div className={s.heroSide}>{children}</div>
    </div>
  );
}
