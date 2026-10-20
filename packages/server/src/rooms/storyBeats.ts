/**
 * §30.4.8 Story beats — the runtime the bible left to the server. Uses content's `nextStoryBeat`,
 * `beatDoneFlag`, `flagsAfterBeat`; beats are idempotent per player through the done flag, and
 * `ZoneState.harvestState` is never written here (harvest is per player, derived from done flags).
 */
import { STORY, badgeFlag, flagsAfterBeat, nextStoryBeat } from '@ewa/content';
import type { BadgeId, StoryBeat, ZoneId } from '@ewa/content';
import type { QuestProgressEntry } from '@ewa/protocol';
import type { Repos, Tx } from '@ewa/persist';
import { advanceQuests } from '../game/quests';
import type { QuestEvent } from '../game/quests';
import { beatSplit } from '../game/speedrun';

/** The flag set the beat runtime reads: story_flags ∪ `badge:<id>` for every held badge. */
export function flagSet(flags: readonly string[], badges: readonly BadgeId[]): Set<string> {
  const s = new Set(flags);
  for (const b of badges) s.add(badgeFlag(b));
  return s;
}

/**
 * Every id some `StoryBeat.battle.trainerId` names (the 7 story TrainerDefs, plus the league ids a beat fights).
 * §30.4.8 rule 6: a TrainerDef in this set is fired by its beat only, never through the plain trainer row.
 */
export const STORY_BATTLE_IDS: ReadonlySet<string> = new Set(STORY.flatMap((b) => (b.battle === null ? [] : [b.battle.trainerId])));

export function isStoryTrainer(trainerId: string): boolean {
  return STORY_BATTLE_IDS.has(trainerId);
}

/** The beat an interact on `targetId` fires, or null (fall through to plain handling). */
export function beatFor(zoneId: ZoneId, flags: ReadonlySet<string>, targetId: string): StoryBeat | null {
  const beat = nextStoryBeat(zoneId, flags);
  if (beat === null || beat.speaker !== targetId) return null;
  return beat;
}

/**
 * Rule 6, the trainer side: the zone's next eligible beat when its battle names this story trainer (the trainer
 * stands beside the speaker, so facing either one fires the same beat), else null — and then the interact is
 * handled like a plain NPC: nothing over the wire, no battle, no reward, no `trainer:<id>:beaten`.
 */
export function storyTrainerBeat(zoneId: ZoneId, flags: ReadonlySet<string>, trainerId: string): StoryBeat | null {
  if (!isStoryTrainer(trainerId)) return null;
  const beat = nextStoryBeat(zoneId, flags);
  return beat !== null && beat.battle !== null && beat.battle.trainerId === trainerId ? beat : null;
}

export interface BeatCompletion {
  readonly flags: readonly string[];
  readonly questProgress: readonly QuestProgressEntry[];
  /** Phase D1: absolute counts of the items `beat.grant` added (empty when the beat grants nothing) — an inventoryDelta's `items` */
  readonly items: Readonly<Record<string, number>>;
}

/**
 * Step 4 completion, inside the caller's transaction: `setFlags([...beat.set, beatDoneFlag(beat.id)])`,
 * quest objectives of kind `flag` (and `restoreZone` for a beat with `harvest.to === 'intact'`) advance, audit `story.beat`. Nothing else is persisted for a harvest beat.
 * Phase D1: `beat.grant` items are added in the same transaction (the done flag makes it once per player).
 */
export async function completeBeatInTx(tx: Tx, repos: Pick<Repos, 'progress' | 'audit' | 'inventory' | 'runs'>, playerId: string, beat: StoryBeat, now: Date): Promise<BeatCompletion> {
  const flags = flagsAfterBeat(beat);
  await repos.progress.setFlags(tx, playerId, flags, now);
  // verified speedruns: every beat is a split on the play clock
  await repos.runs.split(tx, playerId, beatSplit(beat.id), now);
  const items: Record<string, number> = {};
  for (const id of Object.keys(beat.grant ?? {}).sort()) items[id] = await repos.inventory.add(tx, playerId, id, beat.grant![id]!);
  // Phase B2: a beat that returns a zone to `intact` also advances `restoreZone` objectives
  const events: QuestEvent[] = [{ kind: 'flags', flags }];
  if (beat.harvest?.to === 'intact') events.push({ kind: 'restoreZone', zoneId: beat.harvest.zoneId });
  const questProgress = await advanceQuests(tx, repos, playerId, events, now.getTime());
  await repos.audit.write(tx, { actorId: playerId, action: 'story.beat', subject: beat.id, detail: { beatId: beat.id } }, now);
  return { flags, questProgress, items };
}
