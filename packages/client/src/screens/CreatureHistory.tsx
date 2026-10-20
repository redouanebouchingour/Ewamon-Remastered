/**
 * Creature history (GET /creature/:id/history): the original trainer and what happened to the creature, newest first
 * (how its first trainer got it, every change of hands, evolutions, the badges, the Champion and the legendaries its
 * party won against). Shown in the creature detail (Party, Box) and on a marketplace listing.
 */
import { useEffect, useState } from 'react';
import type { CreatureEvent, CreatureHistory as History } from '@ewa/protocol';
import { badgeDisplay } from '../data/badgeIcon';
import { speciesName, zoneName } from '../data/content';
import { apiFetch } from '../net/api';
import { Skeleton } from '../ui/Skeleton';
import l from './layout.module.css';
import s from './CreatureHistory.module.css';
import { relativeTime } from './shared';

/** One event as a sentence. */
export function eventLine(e: CreatureEvent): string {
  switch (e.kind) {
    case 'met':
      return e.how === 'caught' ? `Caught by ${e.trainer} on ${zoneName(e.zoneId)} at level ${e.level}.` : `Received by ${e.trainer} at level ${e.level}.`;
    case 'traded':
      return `Traded from ${e.from} to ${e.to}.`;
    case 'sold':
      return `Sold by ${e.from} to ${e.to} on the market.`;
    case 'gift':
      return `Given by ${e.from} to ${e.to}.`;
    case 'evolved':
      return `Evolved from ${speciesName(e.from)} into ${speciesName(e.into)}.`;
    case 'badge':
      return `In the party that won the ${badgeDisplay(e.badge as Parameters<typeof badgeDisplay>[0])?.name ?? e.badge} Badge.`;
    case 'champion':
      return 'In the party that beat the Champion.';
    case 'legendary':
      return `In the party that ${e.caught ? 'caught' : 'defeated'} ${speciesName(e.species)}.`;
  }
}

type Load = { readonly state: 'loading' } | { readonly state: 'error' } | { readonly state: 'ok'; readonly history: History };

export function CreatureHistory({ creatureId, title = 'History', strip = false }: { readonly creatureId: string; readonly title?: string; readonly strip?: boolean }) {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  useEffect(() => {
    const ctl = new AbortController();
    setLoad({ state: 'loading' });
    apiFetch('creatureHistory', { params: { id: creatureId }, signal: ctl.signal })
      .then((history) => setLoad({ state: 'ok', history }))
      .catch(() => {
        if (!ctl.signal.aborted) setLoad({ state: 'error' });
      });
    return () => ctl.abort();
  }, [creatureId]);

  return (
    <section className={l.section} aria-label="History">
      <h4 className={strip ? l.labelStrip : l.sectionTitle}>{title}</h4>
      {load.state === 'loading' && <Skeleton shape="rows" count={2} label="Loading the history" />}
      {load.state === 'error' && <p className={l.caption}>The history could not be loaded.</p>}
      {load.state === 'ok' && (
        <>
          <p className={s.ot}>
            <span className={s.otLabel}>Original trainer</span>
            <span className={s.otName}>{load.history.originalTrainer ?? 'Not recorded'}</span>
          </p>
          {load.history.events.length === 0 ? (
            <p className={l.caption}>Nothing recorded yet: this creature is older than the history.</p>
          ) : (
            <ol className={s.events}>
              {[...load.history.events].reverse().map((e, i) => (
                <li key={`${e.at}:${i}`} className={s.event} data-kind={e.kind}>
                  <span className={s.line}>{eventLine(e)}</span>
                  <time className={l.caption} dateTime={e.at}>
                    {relativeTime(e.at)}
                  </time>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </section>
  );
}
