/**
 * Verified speedruns on the Profile screen (GET /speedrun): the server's play clock, whether the run counts (it holds
 * the first story beat), the Champion time once reached, and every split in order.
 */
import { useEffect, useState } from 'react';
import { STORY, beatDoneFlag } from '@ewa/content';
import type { SpeedrunView } from '@ewa/protocol';
import { formatPlayMs, splitLabel } from '../data/speedrun';
import { apiFetch } from '../net/api';
import { useSessionStore } from '../state/session';
import l from './layout.module.css';
import s from './SpeedrunSection.module.css';

export function SpeedrunSection() {
  const [run, setRun] = useState<SpeedrunView | null>(null);
  const [failed, setFailed] = useState(false);
  // a run counts from the first story beat: before it the run has not started; past it without its split, never will
  const startedStory = useSessionStore((st) => (st.progression?.flags ?? []).includes(beatDoneFlag(STORY[0]!.id)));
  useEffect(() => {
    const ctl = new AbortController();
    apiFetch('speedrun', { signal: ctl.signal })
      .then(setRun)
      .catch(() => {
        if (!ctl.signal.aborted) setFailed(true);
      });
    return () => ctl.abort();
  }, []);

  return (
    <section className={l.section} aria-label="Speedrun" data-testid="speedrun-section">
      <h4 className={l.sectionTitle}>Speedrun</h4>
      {failed && <p className={l.caption}>The run could not be loaded.</p>}
      {run !== null && (
        <>
          <p className={s.clock}>
            <span className={s.clockValue}>{formatPlayMs(run.finishMs ?? run.playMs)}</span>
            <span className={l.caption}>{run.finishMs !== null ? 'to the Champion' : run.running ? 'played so far' : 'played'}</span>
          </p>
          <p className={l.caption}>
            {run.counted
              ? 'Timed by the server: the clock runs only while you are in the world, and every battle is in your history.'
              : startedStory
                ? 'This account was past the first story beat when the clock arrived, so this run is not on the board.'
                : 'The run starts with the first story beat: talk to Prof. Wynn in Mirevale.'}
          </p>
          {run.splits.length > 0 && (
            <ol className={s.splits}>
              {run.splits.map((x) => (
                <li key={x.split} className={s.split}>
                  <span className={s.splitName}>{splitLabel(x.split)}</span>
                  <span className={s.splitTime}>{formatPlayMs(x.playMs)}</span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </section>
  );
}
