/**
 * Ghost trainers on the Profile (GET /ghost): where the player's ghost haunts (the zone they last left, with the party
 * it fights with) until it fades, its record, and the latest trainers it fought. Nothing shows before the player ever
 * left the world.
 */
import { useEffect, useState } from 'react';
import type { GhostView } from '@ewa/protocol';
import { speciesName, zoneName } from '../data/content';
import { apiFetch } from '../net/api';
import { CreatureSprite } from '../ui/CreatureSprite';
import l from './layout.module.css';
import s from './GhostSection.module.css';
import { relativeTime } from './shared';

export function GhostSection() {
  const [view, setView] = useState<GhostView | null>(null);
  useEffect(() => {
    const ctl = new AbortController();
    apiFetch('ghost', { signal: ctl.signal })
      .then(setView)
      .catch(() => undefined);
    return () => ctl.abort();
  }, []);
  if (view === null || (view.haunting === null && view.fights.length === 0)) return null;
  return (
    <section className={l.section} aria-label="Your ghost" data-testid="ghost-section">
      <h4 className={l.sectionTitle}>Your ghost</h4>
      <p className={l.caption}>
        When you leave the world your party stays behind as a ghost. Trainers in that zone's tall grass may meet it and fight it, healed copies against
        them. Nothing of yours is touched.
      </p>
      {view.haunting !== null && (
        <div className={s.haunt}>
          <p className={l.body}>
            It haunts <b>{zoneName(view.haunting.zoneId)}</b> since you left {relativeTime(view.haunting.leftAt)}.
          </p>
          <span className={s.party} aria-label="The party it fights with">
            {view.haunting.party.map((c, i) => (
              <span key={`${c.speciesId}:${i}`} className={s.member} title={`${speciesName(c.speciesId)} Lv ${c.level}`}>
                <CreatureSprite speciesId={c.speciesId} size="sm" />
              </span>
            ))}
          </span>
        </div>
      )}
      <p className={l.body}>
        Record: <b>{view.won}</b> won, <b>{view.lost}</b> lost.
      </p>
      {view.fights.length > 0 && (
        <ol className={s.fights} aria-label="Latest fights">
          {view.fights.map((f) => (
            <li key={`${f.at}:${f.challenger}`} className={s.fight}>
              <span className={f.won ? s.won : s.lost}>{f.won ? 'Won' : 'Lost'}</span>
              <span>
                against {f.challenger} on {zoneName(f.zoneId)}
              </span>
              <span className={l.caption}>{relativeTime(f.at)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
