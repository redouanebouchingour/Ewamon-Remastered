/**
 * §30.4.8 Story beats — the runtime the bible left to the server. Uses content's `nextStoryBeat`,
 * `beatDoneFlag`, `flagsAfterBeat`; beats are idempotent per player through the done flag, and
 * `ZoneState.harvestState` is never written here (harvest is per player, derived from done flags).
 */
import { badgeFlag, flagsAfterBeat, nextStoryBeat } from '@ewa/content';
import type { BadgeId, StoryBeat, ZoneId } from '@ewa/content';
import type { QuestProgressEntry } from '@ewa/protocol';
import type { Repos, Tx } from '@ewa/persist';
import { advanceQuests } from '../game/quests';

/** The flag set the beat runtime reads: story_flags ∪ `badge:<id>` for every held badge. */
export function flagSet(flags: readonly string[], badges: readonly BadgeId[]): Set<string> {
  const s = new Set(flags);
  for (const b of badges) s.add(badgeFlag(b));
  return s;
}

/** The beat an interact on `targetId` fires, or null (fall through to plain handling). */
export function beatFor(zoneId: ZoneId, flags: ReadonlySet<string>, targetId: string): StoryBeat | null {
  const beat = nextStoryBeat(zoneId, flags);
  if (beat === null || beat.speaker !== targetId) return null;
  return beat;
}

export interface BeatCompletion {
  readonly flags: readonly string[];
  readonly questProgress: readonly QuestProgressEntry[];
}

/**
 * Step 4 completion, inside the caller's transaction: `setFlags([...beat.set, beatDoneFlag(beat.id)])`,
 * quest objectives of kind `flag` advance, audit `story.beat`. Nothing else is persisted for a harvest beat.
 */
export async function completeBeatInTx(tx: Tx, repos: Pick<Repos, 'progress' | 'audit'>, playerId: string, beat: StoryBeat, now: Date): Promise<BeatCompletion> {
  const flags = flagsAfterBeat(beat);
  await repos.progress.setFlags(tx, playerId, flags, now);
  const questProgress = await advanceQuests(tx, repos, playerId, [{ kind: 'flags', flags }], now.getTime());
  await repos.audit.write(tx, { actorId: playerId, action: 'story.beat', subject: beat.id, detail: { beatId: beat.id } }, now);
  return { flags, questProgress };
}
