/**
 * Spectator mode: watching a live arena match (GET /arena/live/:matchId). The feed is the fight so far as a replay a
 * turn behind the players; it plays through the replay path (`battle/replay.ts`), and every `LIVE_POLL_MS` the feed is
 * read again and the replay grows (`extendReplay`) until the feed carries the outcome. Leaving the replay (Exit, the
 * result card) stops the polling.
 */
import type { ContentIndex } from '@ewa/core';
import type { LiveFeedView, ServerMessage } from '@ewa/protocol';
import { apiFetch } from '../net/api';
import { toast } from '../state/notifications';
import { extendReplay, startReplay, useReplayStore } from './replay';
import type { ReplaySource } from './replay';

export const LIVE_POLL_MS = 2500;
export const LIVE_TOKEN_PREFIX = 'live:';

/** The feed as a replay to play (its token names the match, so the battle id is `replay:live:<matchId>`). */
export function liveSource(feed: LiveFeedView): ReplaySource {
  return {
    token: `${LIVE_TOKEN_PREFIX}${feed.matchId}`,
    format: feed.replay.format,
    seat: feed.replay.seat,
    labels: feed.replay.labels,
    seed: feed.replay.seed,
    start: feed.replay.start,
    actions: feed.replay.actions,
    finalDigest: feed.replay.digest,
  };
}

let poll: ReturnType<typeof setInterval> | null = null;

function stopPolling(): void {
  if (poll !== null) clearInterval(poll);
  poll = null;
}

/** Starts watching `feed`'s match; false (with a toast) when it cannot be played here. */
export function watchLive(
  feed: LiveFeedView,
  deps: {
    readonly content: ContentIndex;
    readonly inject: ((m: ServerMessage) => void) | undefined;
    readonly speciesName: (id: string) => string;
    /** tests pass their own reader, timer and delivery queue */
    readonly read?: (matchId: string) => Promise<LiveFeedView>;
    readonly every?: (fn: () => void, ms: number) => ReturnType<typeof setInterval>;
    readonly defer?: (fn: () => void) => void;
  },
): boolean {
  stopPolling();
  const source = liveSource(feed);
  const ok = startReplay(source, {
    content: deps.content,
    inject: deps.inject,
    speciesName: deps.speciesName,
    ...(deps.defer !== undefined ? { defer: deps.defer } : {}),
    live: { matchId: feed.matchId, kind: feed.kind, finals: feed.finals, outcome: feed.outcome },
  });
  if (!ok || feed.outcome !== null) return ok;
  const battleId = `replay:${source.token}`;
  const read = deps.read ?? ((matchId: string) => apiFetch('arenaLiveFeed', { params: { matchId } }));
  let busy = false;
  let shared = feed.replay.actions.length;
  const tick = (): void => {
    if (useReplayStore.getState().replay?.battleId !== battleId) {
      stopPolling();
      return;
    }
    if (busy) return;
    busy = true;
    read(feed.matchId)
      .then((next) => {
        if (useReplayStore.getState().replay?.battleId !== battleId) return;
        if (next.replay.actions.length === shared && next.outcome === null) return;
        shared = next.replay.actions.length;
        if (!extendReplay(liveSource(next), deps.content, next.outcome) || next.outcome !== null) stopPolling();
      })
      .catch(() => {
        // the match is gone (it ended long ago, or its room died): what was shown stays, the polling stops
        toast('info', 'The live feed has ended.');
        stopPolling();
      })
      .finally(() => {
        busy = false;
      });
  };
  poll = (deps.every ?? setInterval)(tick, LIVE_POLL_MS);
  return true;
}
