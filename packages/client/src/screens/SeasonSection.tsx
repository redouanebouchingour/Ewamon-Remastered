/**
 * Ranked seasons on the Rating board (GET /seasons): the season now, when Finals week starts or that it is on, when the
 * season ends, the top eight so far (the Finalists if it ended now), and the latest closed seasons' Champion and
 * Finalists. At a season's end the standings are kept and every rating moves halfway back to 1000.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { SeasonsView } from '@ewa/protocol';
import { apiFetch } from '../net/api';
import { timeLeft } from '../state/arena';
import { cx } from '../ui/cx';
import l from './layout.module.css';
import s from './SeasonSection.module.css';

export function SeasonSection() {
  const [view, setView] = useState<SeasonsView | null>(null);
  useEffect(() => {
    const ctl = new AbortController();
    apiFetch('seasons', { signal: ctl.signal })
      .then(setView)
      .catch(() => undefined);
    return () => ctl.abort();
  }, []);
  if (view === null) return null;
  const now = Date.now();
  const c = view.current;
  return (
    <section className={s.season} aria-label={`Season ${c.season}`} data-testid="season-section">
      <div className={s.head}>
        <h4 className={s.title}>Season {c.season}</h4>
        {c.finals ? <span className={s.finals}>League Finals week</span> : <span className={l.caption}>Finals week in {timeLeft(c.finalsAt, now)}</span>}
        <span className={l.caption}>Ends in {timeLeft(c.endsAt, now)}</span>
      </div>
      <p className={l.caption}>
        Ranked wins count. When the season ends the top eight are its Finalists, the first its Champion, and every rating moves halfway back to 1000.
      </p>
      {c.top.length === 0 ? (
        <p className={l.caption}>No ranked battle yet this season.</p>
      ) : (
        <ol className={s.top} aria-label="Top eight so far">
          {c.top.map((r) => (
            <li key={r.username} className={s.row}>
              <span className={cx(s.rank, r.rank === 1 && s.leader)}>{r.rank}</span>
              <Link to={`/play/players/${r.username}`} className={s.name}>
                {r.username}
              </Link>
              <span className={s.figure}>
                {r.rating} · {r.wins}-{r.losses}
              </span>
            </li>
          ))}
        </ol>
      )}
      {view.past.length > 0 && (
        <ul className={s.past} aria-label="Past seasons">
          {view.past.map((p) => {
            const champion = p.top.find((r) => r.title === 'champion');
            const finalists = p.top.filter((r) => r.title === 'finalist').map((r) => r.username);
            return (
              <li key={p.season} className={l.caption}>
                Season {p.season}: {champion === undefined ? 'no ranked battles' : `${champion.username} Champion (${champion.rating})`}
                {finalists.length > 0 ? ` · Finalists ${finalists.join(', ')}` : ''}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
