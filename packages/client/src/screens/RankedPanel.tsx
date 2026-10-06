/**
 * Phase D13 — the ranked queue, at the top of `/play/rankings`. One block: the player's rating, then the queue state —
 * idle (Find a match), queued (elapsed time, the current rating window, Cancel), matched (the opponent; both players are
 * moved to the Mirevale arena and the normal pvp battle starts). Every state is the server's `rankedStatus`
 * (state/ranked.ts); the button only sends `rankedQueue { join | leave }`. Refusals arrive as toasts.
 */
import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { rankedWindow } from '@ewa/protocol';
import { getWorldSession } from '../net/WorldSession';
import { formatElapsed, shownRankedState, useRankedStore } from '../state/ranked';
import { partyCanBattle, useSessionStore } from '../state/session';
import { useUiStore } from '../state/ui';
import { Button } from '../ui/Button';
import l from './layout.module.css';
import s from './RankedPanel.module.css';

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

export function RankedPanel() {
  const ranked = useRankedStore(useShallow((st) => ({ state: st.state, rating: st.rating, queuedAt: st.queuedAt, matchedAt: st.matchedAt, opponent: st.opponent })));
  const sessionRating = useSessionStore((st) => st.progression?.rating ?? null);
  const canBattle = useSessionStore((st) => partyCanBattle(st.inventory));
  const inBattle = useUiStore((st) => st.battle !== null);
  const connected = useUiStore((st) => st.connection === 'connected');
  const now = useNow(ranked.state !== 'idle');
  const state = shownRankedState(ranked, now);
  const rating = sessionRating ?? ranked.rating;
  const elapsed = state === 'queued' ? now - ranked.queuedAt : 0;
  const send = (action: 'join' | 'leave'): void => getWorldSession().send('rankedQueue', { action });
  const blocked = inBattle ? 'Finish your battle first.' : !canBattle ? 'Heal your party to queue.' : !connected ? 'Not connected to the world.' : null;

  return (
    <section className={s.panel} aria-labelledby="ranked-title">
      <div className={s.head}>
        <h3 id="ranked-title" className={s.title}>
          Ranked battle
        </h3>
        <span className={s.rating}>
          <span className={l.caption}>Your rating</span>
          <span className={s.ratingValue}>{rating ?? '—'}</span>
        </span>
      </div>
      <div className={s.body} aria-live="polite">
        {state === 'idle' && (
          <>
            <p className={s.copy}>You are paired with a trainer near your rating. You both go to the Mirevale arena and the battle starts there.</p>
            <div className={s.actions}>
              <Button variant="primary" icon="trophy" disabled={blocked !== null} onClick={() => send('join')}>
                Find a match
              </Button>
              {blocked !== null && <span className={l.caption}>{blocked}</span>}
            </div>
          </>
        )}
        {state === 'queued' && (
          <>
            <dl className={s.stats}>
              <div>
                <dt className={l.caption}>Searching</dt>
                <dd className={s.statValue} data-testid="ranked-elapsed">
                  {formatElapsed(elapsed)}
                </dd>
              </div>
              <div>
                <dt className={l.caption}>Rating window</dt>
                <dd className={s.statValue}>±{rankedWindow(elapsed)}</dd>
              </div>
            </dl>
            <p className={s.copy}>The window widens the longer you wait. You can keep playing; the match finds you anywhere.</p>
            <div className={s.actions}>
              <Button variant="secondary" onClick={() => send('leave')}>
                Leave queue
              </Button>
            </div>
          </>
        )}
        {state === 'matched' && ranked.opponent !== null && (
          <p className={s.copy}>
            Match found: <strong className={s.opponent}>{ranked.opponent.name}</strong> ({ranked.opponent.rating}). Heading to the arena.
          </p>
        )}
      </div>
    </section>
  );
}
