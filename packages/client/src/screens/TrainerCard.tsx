/**
 * Phase C4 — the trainer pieces `/play/profile` and `/play/players/:username` share: the identity header, the stat
 * grid, the eight-badge strip and the showcase. Everything shown comes from a `PublicProfile` (GET /players/:username,
 * the §5.3 allow-list) — badges included: the client never decides one (§50.1 #13).
 */
import type { PublicProfile } from '@ewa/protocol';
import { BADGE_CASE } from '../data/badgeIcon';
import { DEX_TOTAL } from '../data/content';
import { bodyLabel, memberSince, tierLabel } from '../data/trainer';
import { CreatureCard } from '../ui/CreatureCard';
import { EmptyState } from '../ui/EmptyState';
import { Pill } from '../ui/Pill';
import { cx } from '../ui/cx';
import l from './layout.module.css';
import s from './TrainerCard.module.css';

export function TrainerAvatar({ username, size = 'md' }: { readonly username: string; readonly size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={cx(s.avatar, s[size])} aria-hidden>
      {username.slice(0, 1).toUpperCase()}
    </span>
  );
}

export interface TrainerIdentityProps {
  readonly username: string;
  readonly title: string;
  readonly motto: string;
  readonly body: string;
  readonly guildTag: string | null;
  readonly tier: string;
  readonly you?: boolean;
}

export function TrainerIdentity({ username, title, motto, body, guildTag, tier, you = false }: TrainerIdentityProps) {
  return (
    <header className={s.identity}>
      <TrainerAvatar username={username} size="lg" />
      <div className={s.identityText}>
        <p className={s.titleLine}>{title}</p>
        <h3 className={s.name}>
          {username}
          {guildTag !== null && <span className={s.guild}>[{guildTag}]</span>}
        </h3>
        <div className={s.chips}>
          <Pill tone="accent">{tierLabel(tier)}</Pill>
          <Pill>{bodyLabel(body)}</Pill>
          {you && <Pill tone="info">You</Pill>}
        </div>
        {motto.length > 0 ? <p className={s.motto}>“{motto}”</p> : <p className={l.caption}>No motto yet.</p>}
      </div>
    </header>
  );
}

/** `compact`: two columns (beside the profile editor) instead of three. */
export function TrainerStats({ pub, compact = false }: { readonly pub: PublicProfile; readonly compact?: boolean }) {
  const stats: readonly { readonly label: string; readonly value: string }[] = [
    { label: 'Rating', value: String(pub.rating) },
    { label: 'Peak rating', value: String(pub.peakRating) },
    { label: 'Trainer level', value: String(pub.trainerLevel) },
    { label: 'Dex caught', value: `${pub.dexCaughtCount} / ${DEX_TOTAL}` },
    { label: 'Badges', value: `${pub.badges.length} / ${BADGE_CASE.length}` },
    { label: 'Trainer since', value: memberSince(pub.createdAt) },
  ];
  return (
    <dl className={cx(s.stats, compact && s.statsCompact)} aria-label="Stats">
      {stats.map((st) => (
        <div key={st.label} className={s.stat}>
          <dt className={l.kvLabel}>{st.label}</dt>
          <dd className={s.statValue}>{st.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function BadgeStrip({ earned }: { readonly earned: readonly string[] }) {
  return (
    <ul className={s.badges} aria-label={`${earned.length} of ${BADGE_CASE.length} badges`}>
      {BADGE_CASE.map((b) => {
        const has = earned.includes(b.id);
        return (
          <li key={b.id} className={cx(s.badge, has && s.badgeEarned)} data-type={b.type} title={has ? b.name : `${b.name} — not earned`}>
            <span className={s.badgeGlyph} aria-hidden>
              {b.glyph}
            </span>
            <span className={s.badgeName}>{b.name}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function Showcase({ pub }: { readonly pub: PublicProfile }) {
  if (pub.showcase.length === 0) return <EmptyState icon="party" title="No creatures on show" hint="The first three party slots are shown here." />;
  return (
    <div className={s.showcase}>
      {pub.showcase.map((c) => (
        <CreatureCard key={c.id} creature={c} variant="showcase" />
      ))}
    </div>
  );
}
