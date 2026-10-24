/**
 * NPC side quests (2026-10-24): the journal's Favours tab. The favours villagers asked (`GET /npc/quests`): open ones
 * as cards (the objective, its progress, who to go back to and where, the reward; Drop on an accepted one, which
 * `POST /npc/quests/answer abandon`s it), then the last ones handed in. Signed out or with NPC talk off on the server,
 * an empty state says so.
 */
import { useEffect, useState } from 'react';
import type { TypeName } from '@ewa/core';
import type { NpcQuestView } from '@ewa/protocol';
import { zoneName } from '../data/content';
import { answerNpcQuest } from '../state/npcQuests';
import { apiFetch } from '../net/api';
import { objectiveText, rewardText } from '../talk/npcQuest';
import { Button } from '../ui/Button';
import { CreatureSprite } from '../ui/CreatureSprite';
import { EmptyState } from '../ui/EmptyState';
import { Icon } from '../ui/Icon';
import { Pill } from '../ui/Pill';
import { ProgressBar } from '../ui/ProgressBar';
import { TypeBadge } from '../ui/TypeBadge';
import { cx } from '../ui/cx';
import l from './layout.module.css';
import s from './QuestScreen.module.css';

type Load = { readonly state: 'loading' } | { readonly state: 'off' } | { readonly state: 'ok'; readonly open: readonly NpcQuestView[]; readonly done: readonly NpcQuestView[] };

function who(q: NpcQuestView): string {
  return `${q.npcName.split(',')[0]!.trim()}, ${zoneName(q.zoneId)}`;
}

export function FavourList() {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [busy, setBusy] = useState<string | null>(null);
  const refresh = (): void => {
    void apiFetch('npcQuests', {}).then(
      (r) => setLoad({ state: 'ok', open: r.open, done: r.done }),
      () => setLoad({ state: 'off' }),
    );
  };
  useEffect(refresh, []);

  if (load.state === 'loading') return <p className={l.caption}>Loading favours…</p>;
  if (load.state === 'off') return <EmptyState icon="quest" title="Favours are unavailable" hint="Villagers ask for help only where NPC talk is on." />;
  if (load.open.length === 0 && load.done.length === 0)
    return <EmptyState icon="quest" title="No favours yet" hint="Chat with villagers (C in a dialogue): now and then one asks for help." />;
  const drop = (q: NpcQuestView): void => {
    setBusy(q.id);
    void answerNpcQuest(q.id, 'abandon')
      .then(refresh, refresh)
      .finally(() => setBusy(null));
  };
  return (
    <div className={s.acts}>
      {load.open.length > 0 && (
        <section className={s.act} aria-label="Open favours">
          <h3 className={l.sectionTitle}>Open favours</h3>
          <ul className={s.list}>
            {load.open.map((q) => {
              const o = q.objective;
              const ready = q.ready;
              return (
                <li key={q.id} className={cx(s.card, ready && s.ready)} aria-label={`${objectiveText(o)}, ${ready ? 'ready to hand in' : q.status === 'offered' ? 'asked' : 'in progress'}`} data-testid="favour">
                  <div className={s.head}>
                    <div className={l.stack}>
                      <span className={s.title}>{objectiveText(o)}</span>
                      <span className={l.caption}>For {who(q)}</span>
                    </div>
                    {o.kind === 'catch' ? <CreatureSprite speciesId={o.species} size="sm" /> : o.kind === 'show' ? <TypeBadge type={o.type as TypeName} size="sm" /> : null}
                  </div>
                  {q.target > 1 && <ProgressBar size="sm" value={q.progress / q.target} label="Favour progress" valueText={`${q.progress} of ${q.target}`} />}
                  <div className={s.foot}>
                    <span className={l.caption}>Reward: {rewardText(q.reward)}</span>
                    <div className={s.actions}>
                      {ready ? <Pill tone="accent">Hand in</Pill> : q.status === 'offered' ? <Pill>Asked</Pill> : null}
                      {q.status === 'active' && (
                        <Button size="sm" variant="ghost" busy={busy === q.id} onClick={() => drop(q)} ariaLabel={`Drop ${objectiveText(o)}`}>
                          Drop
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {load.done.length > 0 && (
        <section className={s.act} aria-label="Handed in">
          <h3 className={l.sectionTitle}>Handed in</h3>
          <ul className={s.claimedList}>
            {load.done.map((q) => (
              <li key={q.id} className={s.claimedRow}>
                <span className={s.mark} aria-hidden>
                  <Icon name="check" size="sm" />
                </span>
                <span className={s.claimedTitle}>{objectiveText(q.objective)}</span>
                <span className={l.caption}>{who(q)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
