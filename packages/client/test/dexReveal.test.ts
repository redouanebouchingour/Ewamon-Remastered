/**
 * Reveal moments (screens/dex/reveal.ts): an entry is new until opened after its last sighting or recording.
 */
import { describe, expect, it } from 'vitest';
import { revealOf } from '../src/screens/dex/reveal';

const e = (seenAt: string, caughtAt: string | null, viewedAt: string | null) => ({ seenAt, caughtAt, viewedAt, counters: {}, firstSeenZone: null });

describe('revealOf', () => {
  it('a never-opened sighting is a SEEN reveal, a never-opened recording a RECORDED one', () => {
    expect(revealOf(e('2026-10-01T00:00:00Z', null, null))).toBe('seen');
    expect(revealOf(e('2026-10-01T00:00:00Z', '2026-10-02T00:00:00Z', null))).toBe('recorded');
  });
  it('opened after the sighting, then recorded: a RECORDED reveal', () => {
    expect(revealOf(e('2026-10-01T00:00:00Z', '2026-10-03T00:00:00Z', '2026-10-02T00:00:00Z'))).toBe('recorded');
  });
  it('opened after everything: nothing new; no record: nothing', () => {
    expect(revealOf(e('2026-10-01T00:00:00Z', '2026-10-02T00:00:00Z', '2026-10-02T00:00:01Z'))).toBeNull();
    expect(revealOf(undefined)).toBeNull();
  });
});
