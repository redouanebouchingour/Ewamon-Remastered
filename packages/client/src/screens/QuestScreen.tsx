/**
 * Phase B3 `/play/quests` — the story quest journal. Quests come from content (`QUESTS`), progress from the session's
 * `progression.quests` / `questsClaimed` (GET /me, then the room's `progressionDelta`). Grouped by act; each open
 * quest lists its objectives with their progress, its rewards, a Track toggle (the HUD quest hint follows the tracked
 * quest's first undone objective) and — once every objective is done — Claim → `POST /quests/claim` through the
 * route action (`questAction.claim`, the battle pass's `claimMission` pattern). Locked quests show what they wait
 * for; claimed quests collapse into a list at the end.
 */
import { QUESTS } from '@ewa/content';
import type { Act, QuestDef } from '@ewa/content';
import { formatMoney } from '../app/TopBar';
import { ACT_LABEL, objectivesOf, questById, questOrigin, questStatus, rewardSummary } from '../data/quests';
import type { QuestStatus } from '../data/quests';
import { useQuestTracking } from '../state/questTracking';
import { useSessionStore } from '../state/session';
import type { Progression } from '../state/session';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Icon } from '../ui/Icon';
import { Panel } from '../ui/Panel';
import { Pill } from '../ui/Pill';
import { cx } from '../ui/cx';
import l from './layout.module.css';
import s from './QuestScreen.module.css';
import { useClosePanel, useIntent } from './shared';

const ACTS: readonly Act[] = [1, 2, 3];
type Progress = Pick<Progression, 'quests' | 'questsClaimed'>;

function QuestCard({ q, status, p, tracked, fetcher }: { readonly q: QuestDef; readonly status: QuestStatus; readonly p: Progress | null; readonly tracked: boolean; readonly fetcher: ReturnType<typeof useIntent> }) {
  const toggle = useQuestTracking((st) => st.toggle);
  if (status === 'locked') {
    const waits = q.requires.map((r) => questById(r)?.title ?? r);
    return (
      <li className={cx(s.card, s.locked)} aria-label={`${q.title}, locked`}>
        <div className={s.head}>
          <span className={s.title}>{q.title}</span>
          <Icon name="lock" size="sm" label="Locked" />
        </div>
        <p className={l.caption}>{waits.length > 0 ? `Finish ${waits.map((t) => `“${t}”`).join(' and ')} first.` : 'Not offered yet.'}</p>
      </li>
    );
  }
  const objectives = objectivesOf(q, p);
  const done = objectives.filter((o) => o.done).length;
  return (
    <li className={cx(s.card, status === 'ready' && s.ready, tracked && s.tracked)} aria-label={`${q.title}, ${status === 'ready' ? 'ready to claim' : 'in progress'}`}>
      <div className={s.head}>
        <div className={l.stack}>
          <span className={s.title}>{q.title}</span>
          <span className={l.caption}>{questOrigin(q)}</span>
        </div>
        {status === 'ready' ? <Pill tone="accent">Complete</Pill> : <span className={l.mono}>{done} / {objectives.length}</span>}
      </div>
      <p className={s.summary}>{q.summary}</p>
      <ul className={s.objectives} aria-label="Objectives">
        {objectives.map((o) => (
          <li key={o.id} className={cx(s.objective, o.done && s.done)}>
            <span className={s.mark} aria-hidden>
              {o.done && <Icon name="check" size="sm" />}
            </span>
            <span>{o.label}</span>
            {o.target > 1 && (
              <span className={l.mono}>
                {o.count} / {o.target}
              </span>
            )}
          </li>
        ))}
      </ul>
      <div className={s.foot}>
        <span className={l.caption}>Reward: {rewardSummary(q, formatMoney)}</span>
        <div className={s.actions}>
          <Button size="sm" variant="ghost" icon="star" pressed={tracked} onClick={() => toggle(q.id)} ariaLabel={`${tracked ? 'Untrack' : 'Track'} ${q.title}`}>
            {tracked ? 'Tracking' : 'Track'}
          </Button>
          {status === 'ready' && (
            <Button size="sm" variant="primary" busy={fetcher.busy((x) => x.intent === 'claim' && x['questId'] === q.id)} onClick={() => fetcher.submit({ intent: 'claim', questId: q.id })}>
              Claim
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

export function QuestScreen() {
  const close = useClosePanel();
  const fetcher = useIntent('/play/quests');
  const quests = useSessionStore((st) => st.progression?.quests ?? null);
  const claimedIds = useSessionStore((st) => st.progression?.questsClaimed ?? null);
  const tracked = useQuestTracking((st) => st.tracked);
  const p: Progress | null = quests === null || claimedIds === null ? null : { quests, questsClaimed: claimedIds };

  const rows = QUESTS.map((q) => ({ q, status: questStatus(q, p) }));
  const open = rows.filter((r) => r.status !== 'claimed');
  const claimed = rows.filter((r) => r.status === 'claimed');
  const ready = rows.filter((r) => r.status === 'ready').length;

  return (
    <Panel title="Quests" eyebrow={ready > 0 ? `${ready} ready to claim` : 'Journal'} onClose={close}>
      <div className={s.acts}>
        {open.length === 0 && <EmptyState icon="quest" title="Every quest is complete" hint="The journal has nothing left to ask of you." />}
        {ACTS.map((act) => {
          const list = open.filter((r) => r.q.act === act);
          if (list.length === 0) return null;
          return (
            <section key={act} className={s.act} aria-label={ACT_LABEL[act]}>
              <h3 className={l.sectionTitle}>{ACT_LABEL[act]}</h3>
              <ul className={s.list}>
                {list.map(({ q, status }) => (
                  <QuestCard key={q.id} q={q} status={status} p={p} tracked={tracked === q.id} fetcher={fetcher} />
                ))}
              </ul>
            </section>
          );
        })}
        {claimed.length > 0 && (
          <section className={s.act} aria-label="Claimed">
            <h3 className={l.sectionTitle}>Claimed</h3>
            <ul className={s.claimedList}>
              {claimed.map(({ q }) => (
                <li key={q.id} className={s.claimedRow}>
                  <span className={s.mark} aria-hidden>
                    <Icon name="check" size="sm" />
                  </span>
                  <span className={s.claimedTitle}>{q.title}</span>
                  <span className={l.caption}>{ACT_LABEL[q.act]}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Panel>
  );
}
