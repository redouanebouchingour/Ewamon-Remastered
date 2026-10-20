/**
 * Spectator mode `/play/watch/:matchId`: a live arena match (GET /arena/live/:matchId). Who plays whom, the mode, the
 * League Finals mark, how far it is (a turn behind the players), and Watch, which closes the panel and follows the
 * match in the world through `battle/live.ts`. A match that is gone, or that this version of the game cannot follow,
 * says so instead.
 */
import { useMemo } from 'react';
import { useLoaderData, useNavigate } from 'react-router';
import { ARENA_KIND_LABELS } from '@ewa/protocol';
import type { watchLoader } from '../app/loaders';
import { liveSource, watchLive } from '../battle/live';
import { planReplay } from '../battle/replay';
import { content, speciesName } from '../data/content';
import { getWorldSession } from '../net/WorldSession';
import { useUiStore } from '../state/ui';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Panel } from '../ui/Panel';
import l from './layout.module.css';
import { useClosePanel } from './shared';

export function WatchScreen() {
  const close = useClosePanel();
  const navigate = useNavigate();
  const { feed } = useLoaderData<typeof watchLoader>();
  const inBattle = useUiStore((st) => st.battle !== null);
  const playable = useMemo(() => feed !== null && planReplay(liveSource(feed), content(), true) !== null, [feed]);

  if (feed === null) {
    return (
      <Panel title="Watch" eyebrow="Live match" onClose={close}>
        <EmptyState icon="sword" title="This match is not on" hint="It has ended, or the link is wrong. Live matches are listed in PvP." />
      </Panel>
    );
  }
  if (!playable) {
    return (
      <Panel title="Watch" eyebrow="Live match" onClose={close}>
        <EmptyState icon="warn" tone="unavailable" title="This match cannot be followed" hint="It is played with another version of the game. Reload the page to update." />
      </Panel>
    );
  }
  const [a, b] = feed.players;
  const watch = (): void => {
    // the panel closes first: an open battle blocks navigation, and the match plays as a battle
    void Promise.resolve(navigate('/play')).then(() => watchLive(feed, { content: content(), inject: getWorldSession().inject?.bind(getWorldSession()), speciesName }));
  };
  return (
    <Panel
      title={`${a.name} vs ${b.name}`}
      eyebrow={feed.finals ? 'League Finals' : 'Live match'}
      subtitle={`${ARENA_KIND_LABELS[feed.kind]} · ${a.rating} vs ${b.rating} · ${feed.outcome === null ? `turn ${feed.turn}` : 'over'}`}
      onClose={close}
    >
      <div className={l.stackLg}>
        <p className={l.bodyLg}>
          {feed.outcome === null
            ? 'Follow the battle as it happens, one turn behind the players. Nothing in your game changes.'
            : 'This match has just ended. Watch it from the start.'}
        </p>
        <div className={l.row}>
          <Button variant="primary" icon="play" disabled={inBattle} title={inBattle ? 'Finish your battle first.' : undefined} onClick={watch}>
            Watch
          </Button>
        </div>
      </div>
    </Panel>
  );
}
