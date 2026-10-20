/**
 * Battle replays: in place of the battle menu while a shared battle plays (`battle/replay.ts`): the menu's "Last turn"
 * ticker over a slab with the two sides' names, how far the replay is, Pause / Resume, Copy link and Exit.
 * Spectator mode (`battle/live.ts`): the tag reads Live (red) until the match is over, League Finals are marked, the
 * progress counts turns, and Copy link copies the watch address.
 */
import { toast } from '../state/notifications';
import { useUiStore } from '../state/ui';
import { Button } from '../ui/Button';
import { cx } from '../ui/cx';
import { Ticker } from './BattleMenu';
import { setReplayPaused, stopReplay, useReplayStore } from './replay';
import s from './ReplayBar.module.css';

/** The public address of a replay (it opens in the world once signed in). */
export function replayUrl(token: string): string {
  return `${window.location.origin}/play/replay/${token}`;
}

/** The address that opens a live match to watch. */
export function watchUrl(matchId: string): string {
  return `${window.location.origin}/play/watch/${matchId}`;
}

async function copyLink(url: string, what: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(url);
    toast('info', `${what} link copied.`);
  } catch (_e) {
    toast('warn', `Copy failed. The link is ${url}`);
  }
}

export async function copyReplayLink(token: string): Promise<void> {
  await copyLink(replayUrl(token), 'Replay');
}

const NO_LOG: never[] = [];

export function ReplayBar() {
  const r = useReplayStore((st) => st.replay);
  const log = useUiStore((st) => st.battle?.log ?? NO_LOG);
  if (r === null) return null;
  const mine = r.labels[r.seat];
  const theirs = r.labels[r.seat === 0 ? 1 : 0];
  return (
    <div className={s.deck} data-testid="replaybar">
      <Ticker log={log} hints={[]} />
      <div className={s.bar} role="group" aria-label="Replay">
        {r.live === null ? (
          <p className={s.tag}>Replay</p>
        ) : (
          <p className={cx(s.tag, !r.live.over && s.tagLive)}>{r.live.over ? 'Final' : 'Live'}</p>
        )}
        {r.live?.finals === true && <p className={s.finals}>League Finals</p>}
        <p className={s.names}>
          <span className={s.name}>{mine}</span>
          <span className={s.vs}>vs</span>
          <span className={s.name}>{theirs}</span>
        </p>
        <p className={s.progress} aria-live="polite">
          {r.live === null ? `Step ${r.shown} of ${r.total}` : `Turn ${r.shown}${r.live.over ? ` of ${r.total}` : ''}`}
        </p>
        <div className={s.actions}>
          <Button
            size="sm"
            icon={r.paused ? 'play' : 'pause'}
            onClick={() => setReplayPaused(!r.paused)}
          >
            {r.paused ? 'Resume' : 'Pause'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon="link"
            onClick={() => void (r.live === null ? copyReplayLink(r.token) : copyLink(watchUrl(r.live.matchId), 'Watch'))}
          >
            Copy link
          </Button>
          <Button size="sm" variant="ghost" icon="close" onClick={stopReplay}>
            Exit
          </Button>
        </div>
      </div>
    </div>
  );
}
