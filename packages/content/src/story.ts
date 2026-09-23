/**
 * §3.5 story runtime — pure; the client and the server call the same three functions.
 */
import type { HarvestState, StoryBeat, ZoneDef, ZoneId } from './types';
import { STORY } from './data/story';
import { ZONES } from './data/zones';

const ZONE_BY_ID: ReadonlyMap<ZoneId, ZoneDef> = new Map(ZONES.map((z) => [z.id, z]));

export const BEAT_DONE_PREFIX = 'beat:';
export const BEAT_DONE_SUFFIX = ':done';

/** The done marker the server writes to story_flags when a beat completes. Content never authors a flag with this prefix. */
export function beatDoneFlag(beatId: string): string {
  return `${BEAT_DONE_PREFIX}${beatId}${BEAT_DONE_SUFFIX}`;
}

/** True when every `need` of the beat is in `flags` (`badge:<id>` sugar reads the materialised badge flag). */
export function beatEligible(beat: StoryBeat, flags: ReadonlySet<string>): boolean {
  for (const f of beat.need) if (!flags.has(f)) return false;
  return true;
}

/**
 * The first beat in STORY order with this zoneId whose every `need` is satisfied by `flags` and whose done flag
 * is absent; null when none.
 */
export function nextStoryBeat(zoneId: ZoneId, flags: ReadonlySet<string>): StoryBeat | null {
  for (const beat of STORY) {
    if (beat.zoneId !== zoneId) continue;
    if (flags.has(beatDoneFlag(beat.id))) continue;
    if (beatEligible(beat, flags)) return beat;
  }
  return null;
}

/**
 * The player's effective HarvestState for a zone: the LAST beat in STORY order whose `harvest.zoneId === zoneId`
 * and whose done flag is in `flags` wins; otherwise the zone's content default.
 */
export function harvestStateFor(zoneId: ZoneId, flags: ReadonlySet<string>): HarvestState {
  const zone = ZONE_BY_ID.get(zoneId);
  if (zone === undefined) throw new RangeError(`unknown zone '${zoneId}'`);
  let state: HarvestState = zone.harvestState;
  for (const beat of STORY) {
    if (beat.harvest !== null && beat.harvest.zoneId === zoneId && flags.has(beatDoneFlag(beat.id))) {
      state = beat.harvest.to;
    }
  }
  return state;
}

/** All flags a completed beat contributes: its `set` flags plus its done marker. */
export function flagsAfterBeat(beat: StoryBeat): readonly string[] {
  return [...beat.set, beatDoneFlag(beat.id)];
}
