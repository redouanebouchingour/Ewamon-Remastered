/**
 * §50.4.2 `statics.test.ts` — `LEGENDARY_STATICS` (spine §3.2): each `when` gate resolves (a `badge:` id, or a flag a
 * beat / quest / league row sets); each static (and each raid hotspot) snaps with `nearestWalkable(h, x, z, 8)` — the
 * server's and the client's placement — to a walkable sample inside `playableBounds`, and the two authored on the
 * boundary (`voidraxis` at (0, 84), `raid_ascent_pyrothal` at (0, 104)) snap strictly inward; `galaxion` waits on
 * `flag:ledger_read`; the 9 rows are the 9 non-mythical legendaries, once each.
 */
import { describe, expect, it } from 'vitest';
import {
  BADGE_ORDER,
  LEAGUE,
  LEGENDARY_IDS,
  LEGENDARY_STATICS,
  QUESTS,
  RAID_HOTSPOTS,
  SPECIES,
  STORY,
  getHeightfield,
  isKnownFlag,
  isWalkable,
  nearestWalkable,
  playableBounds,
  zone,
} from '../src/index';
import type { BadgeId, ZoneId } from '../src/index';

/** Every flag something in content sets: beats, quest rewards, league rows, statics. */
function settableFlags(): Set<string> {
  const set = new Set<string>();
  for (const b of STORY) for (const f of b.set) set.add(f);
  for (const q of QUESTS) if (q.rewards.flag) set.add(q.rewards.flag);
  for (const l of LEAGUE) for (const f of l.setsFlags) set.add(f);
  for (const s of LEGENDARY_STATICS) set.add(s.flag);
  return set;
}

function snap(zoneId: ZoneId, x: number, z: number): { p: readonly [number, number]; inside: boolean; strict: boolean } {
  const h = getHeightfield(zoneId);
  const p = nearestWalkable(h, x, z, 8);
  if (p === null) throw new Error(`${zoneId} (${x}, ${z}): nothing walkable within 8 m`);
  const b = playableBounds(h);
  const inside = p[0] >= b.minX && p[0] <= b.maxX && p[1] >= b.minZ && p[1] <= b.maxZ;
  const strict = p[0] > b.minX && p[0] < b.maxX && p[1] > b.minZ && p[1] < b.maxZ;
  expect(isWalkable(h, p[0], p[1]), `${zoneId} snapped point walkable`).toBe(true);
  return { p, inside, strict };
}

describe('LEGENDARY_STATICS (§3.2)', () => {
  it('exactly the 9 non-mythical legendaries, once each, all legendary species', () => {
    expect(LEGENDARY_STATICS.map((s) => s.species).sort()).toEqual([...LEGENDARY_IDS].sort());
    expect(new Set(LEGENDARY_STATICS.map((s) => s.species)).size).toBe(10);
    const byId = new Map(SPECIES.map((s) => [s.id, s]));
    for (const s of LEGENDARY_STATICS) {
      expect(byId.get(s.species)?.legendary, s.species).toBe(true);
      expect(s.level, s.species).toBeGreaterThanOrEqual(1);
      expect(s.level, s.species).toBeLessThanOrEqual(100);
    }
    expect(new Set(LEGENDARY_STATICS.map((s) => s.flag)).size).toBe(10);
  });

  it('every `when` gate resolves: a badge id, or a flag set by a beat / quest / league row', () => {
    const set = settableFlags();
    for (const s of LEGENDARY_STATICS) {
      if (s.when.startsWith('badge:')) {
        expect(BADGE_ORDER.includes(s.when.slice(6) as BadgeId), `${s.species}: ${s.when}`).toBe(true);
      } else {
        expect(s.when.startsWith('flag:'), `${s.species}: ${s.when}`).toBe(true);
        const f = s.when.slice(5);
        expect(set.has(f), `${s.species}: '${f}' is never set`).toBe(true);
        expect(isKnownFlag(f), f).toBe(true);
        // a static's gate is never its own capture flag (it would never appear)
        expect(f).not.toBe(s.flag);
      }
    }
  });

  it("galaxion.when === 'flag:ledger_read' (story bible §7.2)", () => {
    expect(LEGENDARY_STATICS.find((s) => s.species === 'galaxion')!.when).toBe('flag:ledger_read');
  });

  it('every static snaps to a walkable sample inside the playable interior; voidraxis (0, 84) snaps strictly inward', () => {
    for (const s of LEGENDARY_STATICS) {
      const r = snap(s.zoneId, s.x, s.z);
      expect(r.inside, `${s.species} → (${r.p[0]}, ${r.p[1]})`).toBe(true);
      expect(Math.hypot(r.p[0] - s.x, r.p[1] - s.z), s.species).toBeLessThanOrEqual(8);
    }
    const v = LEGENDARY_STATICS.find((s) => s.species === 'voidraxis')!;
    expect([v.zoneId, v.x, v.z]).toEqual(['the_rift', 0, 84]);
    expect(zone('the_rift').kind).toBe('story');
    const r = snap(v.zoneId, v.x, v.z);
    expect(r.strict, `voidraxis → (${r.p[0]}, ${r.p[1]})`).toBe(true);
    expect(r.p[1]).toBeLessThan(84);
  });

  it('raid hotspots snap the same way; raid_ascent_pyrothal (0, 104) on the route boundary snaps strictly inward', () => {
    for (const h of RAID_HOTSPOTS) {
      const r = snap(h.zoneId, h.x, h.z);
      expect(r.inside, `${h.id} → (${r.p[0]}, ${r.p[1]})`).toBe(true);
    }
    const p = RAID_HOTSPOTS.find((h) => h.id === 'raid_ascent_pyrothal')!;
    expect([p.zoneId, p.x, p.z]).toEqual(['ascent_route', 0, 104]);
    const r = snap(p.zoneId, p.x, p.z);
    expect(r.strict, `raid_ascent_pyrothal → (${r.p[0]}, ${r.p[1]})`).toBe(true);
    expect(r.p[1]).toBeLessThan(104);
  });
});
