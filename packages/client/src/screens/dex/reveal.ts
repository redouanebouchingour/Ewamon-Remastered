/**
 * Reveal moments (2026-10-26): an entry is new until the player opens it after its last change, its sighting or its
 * recording (`viewedAt` older than `seenAt` / `caughtAt`, or never). A new entry gets a NEW tag on its tile and, on
 * opening, a reveal: SEEN when only the sighting is new, RECORDED when the recording is.
 */
import { create } from 'zustand';
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

/**
 * The reveal playing now, kept outside the screen: marking the entry viewed updates the session, which may remount the
 * Dex panel, and the reveal must survive that. A reveal older than `REVEAL_MS` is over.
 */
export const REVEAL_MS = 2600;
export const useRevealStore = create<{ readonly id: string | null; readonly kind: Reveal | null; readonly at: number }>()(() => ({ id: null, kind: null, at: 0 }));

export function startReveal(id: string, kind: Reveal): void {
  useRevealStore.setState({ id, kind, at: Date.now() });
}

/** The reveal to play for this entry now, or null. */
export function useRevealFor(id: string | null): Reveal | null {
  const rid = useRevealStore((st) => st.id);
  const kind = useRevealStore((st) => st.kind);
  const at = useRevealStore((st) => st.at);
  return id !== null && rid === id && Date.now() - at < REVEAL_MS ? kind : null;
}
