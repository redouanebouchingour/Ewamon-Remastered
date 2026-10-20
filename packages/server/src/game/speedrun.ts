/**
 * Verified speedruns: the server keeps the time (persist `runRepo`'s play clock runs only while a zone or arena room
 * holds the player, so a client never reports it) and writes a split at every story beat, badge and the Champion, in
 * the transaction of the moment itself. A run counts from the first story beat: an account already past it when the
 * clock arrived holds no start split and stays off the board. Every battle of a run is in the history and replays.
 */
import { STORY } from '@ewa/content';

export const CHAMPION_SPLIT = 'champion';

export function beatSplit(beatId: string): string {
  return `beat:${beatId}`;
}

export function badgeSplit(badge: string): string {
  return `badge:${badge}`;
}

/** The split every counted run starts with: the first story beat. */
export const RUN_START_SPLIT = beatSplit(STORY[0]!.id);
