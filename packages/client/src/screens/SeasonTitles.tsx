/**
 * Ranked seasons on a trainer's profile (GET /seasons/titles/:username): every season they ended as Champion or in the
 * top eight, newest first. Nothing shows for a trainer with no title.
 */
import { useEffect, useState } from 'react';
import type { RouteResponse } from '@ewa/protocol';
import { apiFetch } from '../net/api';
import { Pill } from '../ui/Pill';
import l from './layout.module.css';

type Title = RouteResponse<'seasonTitles'>['titles'][number];

/** "Season 2 Champion", "Season 1 Finalist · 4th". */
export function titleLabel(t: Title): string {
  return t.title === 'champion' ? `Season ${t.season} Champion` : `Season ${t.season} Finalist · ${ordinal(t.rank)}`;
}

function ordinal(n: number): string {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th';
  return `${n}${suffix}`;
}

export function SeasonTitles({ username }: { readonly username: string }) {
  const [titles, setTitles] = useState<readonly Title[]>([]);
  useEffect(() => {
    const ctl = new AbortController();
    apiFetch('seasonTitles', { params: { username }, signal: ctl.signal })
      .then((r) => setTitles(r.titles))
      .catch(() => undefined);
    return () => ctl.abort();
  }, [username]);
  if (titles.length === 0) return null;
  return (
    <section className={l.section} aria-label="Season titles" data-testid="season-titles">
      <h3 className={l.sectionTitle}>Season titles</h3>
      <div className={l.row}>
        {titles.map((t) => (
          <Pill key={t.season} tone={t.title === 'champion' ? 'accent' : 'neutral'}>
            {titleLabel(t)}
          </Pill>
        ))}
      </div>
    </section>
  );
}
