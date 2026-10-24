/**
 * NPC side quests (2026-10-24): the favour an NPC asked, inside the DialogueBox's slab. An offer shows Accept /
 * Decline; an accepted favour its progress, and Hand in once the server says it is ready. Broadcast look: a carbon
 * row with a paper FAVOUR chip, the creature's sprite (catch) or the type icon (show), the reward in the caption.
 */
import type { TypeName } from '@ewa/core';
import type { NpcQuestView } from '@ewa/protocol';
import { objectiveText, rewardText } from '../talk/npcQuest';
import { CreatureSprite } from '../ui/CreatureSprite';
import { TypeBadge } from '../ui/TypeBadge';
import s from './NpcQuestCard.module.css';

export interface NpcQuestCardProps {
  readonly quest: NpcQuestView;
  /** a reply is on its way: the buttons wait */
  readonly busy: boolean;
  readonly onAccept: () => void;
  readonly onDecline: () => void;
  readonly onHandIn: () => void;
}

export function NpcQuestCard({ quest, busy, onAccept, onDecline, onHandIn }: NpcQuestCardProps) {
  const o = quest.objective;
  const state = quest.status === 'offered' ? 'Asked' : quest.ready ? 'Done' : quest.target > 1 ? `${quest.progress} / ${quest.target}` : 'Open';
  return (
    <div className={s.card} data-testid="npc-quest" data-status={quest.status} data-ready={quest.ready ? 'true' : 'false'}>
      <span className={s.tag}>Favour</span>
      {o.kind === 'catch' ? <CreatureSprite speciesId={o.species} size="sm" className={s.sprite} /> : null}
      {o.kind === 'show' ? <TypeBadge type={o.type as TypeName} size="sm" compact /> : null}
      <span className={s.text}>
        <span className={s.goal}>{objectiveText(o)}</span>
        <span className={s.meta}>
          {state} · Reward {rewardText(quest.reward)}
        </span>
      </span>
      {quest.status === 'offered' ? (
        <span className={s.buttons}>
          <button type="button" className={s.primary} disabled={busy} onClick={onAccept}>
            Accept
          </button>
          <button type="button" className={s.secondary} disabled={busy} onClick={onDecline}>
            Decline
          </button>
        </span>
      ) : quest.ready ? (
        <span className={s.buttons}>
          <button type="button" className={s.primary} disabled={busy} onClick={onHandIn}>
            Hand in
          </button>
        </span>
      ) : null}
    </div>
  );
}
