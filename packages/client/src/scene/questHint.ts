/**
 * The HUD quest hint (§20.6 `setQuestHint`). Phase B3: a quest tracked in the journal wins — its first undone
 * objective (or "Claim … in Quests" once every objective is done). Otherwise, as before: the story's next "Talk to …",
 * else the first started, unclaimed quest's first undone objective label, else the next gym badge.
 */
import { QUESTS } from '@ewa/content';
import type { BadgeId } from '@ewa/content';
import { questById, trackedHint } from '../data/quests';
import type { Progression } from '../state/session';
import { storyFlagSet, storyHint } from './dialogue';

export function questHintFor(p: Progression | null, tracked: string | null): string | null {
  if (p === null) return null;
  if (tracked !== null) {
    const q = questById(tracked);
    const t = q === undefined ? null : trackedHint(q, p);
    if (t !== null) return t;
  }
  const flags = storyFlagSet(p.flags, p.badges as readonly BadgeId[]);
  const story = storyHint(flags, []);
  if (story !== null && story.startsWith('Talk to')) return story;
  for (const q of QUESTS) {
    if (q.kind === 'achievement') continue; // Phase D5: milestones never drive the untracked hint
    const prog = p.quests[q.id];
    if (prog === undefined || p.questsClaimed.includes(q.id)) continue;
    const undone = q.objectives.find((o) => !(prog[o.id]?.done ?? false));
    if (undone !== undefined) return undone.label;
  }
  return storyHint(flags, p.badges as readonly BadgeId[]);
}
