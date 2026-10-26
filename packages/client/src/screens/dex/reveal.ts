/**
 * Reveal moments (2026-10-26): an entry is new until the player opens it after its last change, its sighting or its
 * recording (`viewedAt` older than `seenAt` / `caughtAt`, or never). A new entry gets a NEW tag on its tile and, on
 * opening, a reveal: SEEN when only the sighting is new, RECORDED when the recording is.
 */
import type { DexEntryRecord } from '../../state/session';

export type Reveal = 'seen' | 'recorded';

export function revealOf(e: DexEntryRecord | undefined): Reveal | null {
  if (e === undefined) return null;
  const viewed = e.viewedAt === null ? null : Date.parse(e.viewedAt);
  const seen = Date.parse(e.seenAt);
  const caught = e.caughtAt === null ? null : Date.parse(e.caughtAt);
  if (caught !== null && (viewed === null || viewed < caught)) return 'recorded';
  if (viewed === null || viewed < seen) return 'seen';
  return null;
}
