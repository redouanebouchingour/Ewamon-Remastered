/**
 * One roaming legendary per season on the Dex entry of a roamer species (content ROAMERS): where it roams this season
 * and every season's first catcher (data/legends.ts). Nothing shows for any other species, or before the server answers.
 */
import { useEffect, useState } from 'react';
import { ROAMERS } from '@ewa/content';
import type { LegendsView } from '@ewa/protocol';
import { roamerLines } from '../data/legends';
import { apiFetch } from '../net/api';
import l from './layout.module.css';

export function RoamerNote({ speciesId, speciesName }: { readonly speciesId: string; readonly speciesName: string }) {
  const [view, setView] = useState<LegendsView | null>(null);
  const roams = ROAMERS.includes(speciesId);
  useEffect(() => {
    if (!roams) return;
    const ctl = new AbortController();
    apiFetch('legends', { signal: ctl.signal })
      .then(setView)
      .catch(() => undefined);
    return () => ctl.abort();
  }, [roams]);
  if (!roams || view === null) return null;
  const lines = roamerLines(view, speciesId, speciesName);
  if (lines.length === 0) return null;
  return (
    <section className={l.section} aria-label="Roaming legend" data-testid="dex-roamer">
      <h4 className={l.sectionTitle}>Roaming legend</h4>
      {lines.map((t) => (
        <p key={t} className={l.body}>
          {t}
        </p>
      ))}
    </section>
  );
}
