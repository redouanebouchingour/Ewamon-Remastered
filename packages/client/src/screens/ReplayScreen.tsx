/**
 * Battle replays `/play/replay/:token`: a shared battle (GET /replay/:token). Who fought whom, how it ended, when, and
 * Watch, which closes the panel and plays the battle in the world through `battle/replay.ts`. An unknown token, or a
 * replay this version of the game cannot reproduce, says so instead.
 */
import { useMemo } from 'react';
import { useLoaderData, useNavigate } from 'react-router';
import type { replayLoader } from '../app/loaders';
import { copyReplayLink } from '../battle/ReplayBar';
import { planReplay, replayLabels, startReplay } from '../battle/replay';
import { content, speciesName } from '../data/content';
import { getWorldSession } from '../net/WorldSession';
import { useUiStore } from '../state/ui';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Panel } from '../ui/Panel';
import { formatLabel } from './HistoryScreen';
import l from './layout.module.css';
import { relativeTime, useClosePanel } from './shared';

const RESULT_LABEL = { win: 'won', loss: 'lost', draw: 'drew', fled: 'got away', caught: 'caught it' } as const;

export function ReplayScreen() {
  const close = useClosePanel();
  const navigate = useNavigate();
  const { replay } = useLoaderData<typeof replayLoader>();
  const inBattle = useUiStore((st) => st.battle !== null);
  const plan = useMemo(() => (replay === null ? null : planReplay(replay, content())), [replay]);

  if (replay === null) {
    return (
      <Panel title="Replay" eyebrow="Shared battle" onClose={close}>
        <EmptyState icon="sword" title="No replay here" hint="The link is wrong or the replay is gone. Ask for the link again." />
      </Panel>
    );
  }
  if (plan === null) {
    return (
      <Panel title="Replay" eyebrow="Shared battle" onClose={close}>
        <EmptyState icon="warn" tone="unavailable" title="This replay cannot be played" hint="It was recorded with another version of the game, so the battle no longer plays out the same." />
      </Panel>
    );
  }

  const [a, b] = replayLabels(replay, plan, speciesName);
  const sharer = replay.seat === 0 ? a : b;
  const watch = (): void => {
    // the panel closes first: an open battle blocks navigation, and the replay is a battle
    void Promise.resolve(navigate('/play')).then(() => startReplay(replay, { content: content(), inject: getWorldSession().inject?.bind(getWorldSession()), speciesName }));
  };

  return (
    <Panel
      title={`${a} vs ${b}`}
      eyebrow="Shared battle"
      subtitle={`${formatLabel({ format: replay.format, arena: replay.start.arena ?? null })} · ${replay.turns} ${replay.turns === 1 ? 'turn' : 'turns'} · ${relativeTime(replay.happenedAt)}`}
      onClose={close}
    >
      <div className={l.stackLg}>
        <p className={l.bodyLg}>
          {sharer} {RESULT_LABEL[replay.result]}. The battle plays again exactly as it happened. Nothing in your game changes.
        </p>
        <div className={l.row}>
          <Button variant="primary" icon="play" disabled={inBattle} title={inBattle ? 'Finish your battle first.' : undefined} onClick={watch}>
            Watch
          </Button>
          <Button variant="ghost" icon="link" onClick={() => void copyReplayLink(replay.token)}>
            Copy link
          </Button>
        </div>
      </div>
    </Panel>
  );
}
