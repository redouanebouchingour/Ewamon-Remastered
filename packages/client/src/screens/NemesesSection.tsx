/**
 * Nemeses on the Profile (GET /nemeses): the wild creatures that knocked out one of the player's creatures or broke out
 * of their orb and got away, risen against them (at most `max`): each with its sprite on its type colour, name and
 * title, species and level, rank, scar, the move it gained, where it was last met and what it remembers. Reloads when
 * a `nemesisNews` arrives.
 */
import { useEffect, useState } from 'react';
import { NEMESIS_SCAR_TEXT } from '@ewa/content';
import type { NemesesView, NemesisView } from '@ewa/protocol';
import { itemInfo, primaryType, speciesName, zoneName } from '../data/content';
import { apiFetch } from '../net/api';
import { useNemesisStore } from '../state/nemesis';
import { CreatureSprite } from '../ui/CreatureSprite';
import l from './layout.module.css';
import s from './NemesesSection.module.css';
import { relativeTime } from './shared';

/** What it remembers of the last fight, as a line. */
export function memoryLine(n: Pick<NemesisView, 'memory'>): string {
  const m = n.memory;
  const foe = m.foeName ?? speciesName(m.foeSpecies);
  if (m.how === 'breakout') return `Broke out of your ${m.orb !== null ? itemInfo(m.orb).name : 'orb'} in front of ${foe} on ${zoneName(m.zoneId)}.`;
  return `Knocked out your ${foe}${m.move !== null ? ` with ${m.move}` : ''} on ${zoneName(m.zoneId)}.`;
}

export function NemesesSection() {
  const [view, setView] = useState<NemesesView | null>(null);
  const version = useNemesisStore((st) => st.version);
  useEffect(() => {
    const ctl = new AbortController();
    apiFetch('nemeses', { signal: ctl.signal })
      .then(setView)
      .catch(() => undefined);
    return () => ctl.abort();
  }, [version]);
  if (view === null) return null;
  return (
    <section className={l.section} aria-label="Nemeses" data-testid="nemeses-section">
      <h4 className={l.sectionTitle}>Nemeses</h4>
      {view.nemeses.length === 0 ? (
        <p className={l.caption}>
          None yet. A wild creature that knocks out one of yours, or breaks out of your orb, and gets away may rise against you. It will remember, and it
          will find you somewhere else.
        </p>
      ) : (
        <>
          <p className={l.caption}>
            They remember you and wait in the tall grass of other zones. Beat one for a trophy, or catch it: it keeps its name and its scar. At most {view.max}{' '}
            at a time.
          </p>
          <ol className={s.list}>
            {view.nemeses.map((n) => (
              <li key={n.id} className={s.row} data-type={primaryType(n.speciesId)}>
                <span className={s.slab}>
                  <CreatureSprite speciesId={n.speciesId} size="md" />
                </span>
                <span className={s.body}>
                  <span className={s.head}>
                    <span className={s.name}>{n.name}</span>
                    <span className={s.title}>{n.title}</span>
                  </span>
                  <span className={s.tags}>
                    <span className={s.rank}>Rank {n.rank}</span>
                    <span className={s.scar}>{NEMESIS_SCAR_TEXT[n.scar].label}</span>
                    <span className={l.caption}>
                      {speciesName(n.speciesId)} · Lv {n.level}
                      {n.move !== null ? ` · knows ${n.move}` : ''}
                    </span>
                  </span>
                  <span className={l.body}>{memoryLine(n)}</span>
                  <span className={l.caption}>
                    Last seen on {zoneName(n.lastZone)} {relativeTime(n.lastSeenAt)}
                    {n.bornZone !== n.lastZone ? ` · rose on ${zoneName(n.bornZone)}` : ''}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
