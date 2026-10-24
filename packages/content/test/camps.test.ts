/**
 * Camp bases (SPEC §3.19): where the camps stand (the sculpts' tent + campfire on every route), the trophy slots round
 * the fire on open, walkable ground, the raid cut, the refusals and the camp log's words.
 */
import { describe, expect, it } from 'vitest';
import {
  CAMP_INACTIVE_DAYS,
  CAMP_LEVEL_SPAN,
  CAMP_NAME_MAX,
  CAMP_RAID_CAP,
  CAMP_REFUSAL_TEXT,
  CAMP_SLOT_RADIUS,
  CAMP_TROPHY_SLOTS,
  TROPHY_KIND_LABEL,
  allZones,
  campGuardOwner,
  campGuardTrainerId,
  campInactive,
  campLogLine,
  campOf,
  campRaidCut,
  campWelcome,
  campZones,
  claimRefusal,
  defaultCampName,
  digSpotsFor,
  getHeightfield,
  isWalkable,
  isWater,
  nearCamp,
  raidRefusal,
  raidWonText,
  trophyId,
  trophyKindOf,
  zonePlan,
} from '../src/index';

const EM = /\u2014/;

describe('where the camps stand', () => {
  it('every route has exactly one camp, and only routes', () => {
    const routes = allZones().filter((z) => z.kind === 'route').map((z) => z.id);
    expect(campZones().sort()).toEqual([...routes].sort());
    for (const z of allZones()) if (z.kind !== 'route') expect(campOf(z.id)).toBeNull();
  });

  it('the trophy slots and the banner sit round the fire on open, dry, walkable ground, clear of the tent and the dig spot', () => {
    for (const id of campZones()) {
      const c = campOf(id)!;
      const h = getHeightfield(id);
      const plan = zonePlan(id);
      expect(c.slots).toHaveLength(CAMP_TROPHY_SLOTS);
      const dig = digSpotsFor(id)[0]!;
      for (const s of [...c.slots, c.banner]) {
        expect(Math.hypot(s.x - c.fire.x, s.z - c.fire.z)).toBeCloseTo(CAMP_SLOT_RADIUS, 1);
        expect(isWalkable(h, s.x, s.z), `${id} slot ${s.x},${s.z}`).toBe(true);
        expect(isWater(h, s.x, s.z)).toBe(false);
        expect(Math.hypot(s.x - c.tent.x, s.z - c.tent.z), `${id} slot clear of the tent`).toBeGreaterThan(2.4);
        expect(Math.hypot(s.x - dig.x, s.z - dig.z), `${id} slot clear of the dig spot`).toBeGreaterThan(1.5);
        for (const p of plan.props) if (p.kind !== 'campfire' && p.kind !== 'tent') expect(Math.hypot(s.x - p.x, s.z - p.z), `${id} slot clear of ${p.kind}`).toBeGreaterThan(1.2);
        // facing the fire
        expect(Math.abs(Math.atan2(c.fire.x - s.x, c.fire.z - s.z) - s.yaw)).toBeLessThan(0.01);
      }
      expect(nearCamp(c, c.fire.x + 4, c.fire.z)).toBe(true);
      expect(nearCamp(c, c.fire.x + 6, c.fire.z)).toBe(false);
    }
  });

  it('lives outside ZoneDef: the camp layer adds no npc, prop or warp to a zone', () => {
    for (const z of allZones()) expect(JSON.stringify(z)).not.toMatch(/trophy|camp_slot/);
  });
});

describe('raids and the log', () => {
  it('a raid takes 2 % of the purse, capped, nothing from an empty one', () => {
    expect(campRaidCut(0)).toBe(0);
    expect(campRaidCut(-5)).toBe(0);
    expect(campRaidCut(49)).toBe(0);
    expect(campRaidCut(6_000)).toBe(120);
    expect(campRaidCut(10_000_000)).toBe(CAMP_RAID_CAP);
  });

  it('an owner away long enough loses the camp to a raider', () => {
    const day = 86_400_000;
    expect(campInactive(null, 10 * day)).toBe(false);
    expect(campInactive(0, (CAMP_INACTIVE_DAYS - 1) * day)).toBe(false);
    expect(campInactive(0, CAMP_INACTIVE_DAYS * day)).toBe(true);
  });

  const claim = { enabled: true, campHere: true, near: true, heldBy: null, me: 'a', holdsOne: false, inRun: false, canFight: true };
  it('a claim: free camp, one per trainer, not on a run, at the fire', () => {
    expect(claimRefusal(claim)).toBeNull();
    expect(claimRefusal({ ...claim, enabled: false })).toBe('campsOff');
    expect(claimRefusal({ ...claim, campHere: false })).toBe('noCampHere');
    expect(claimRefusal({ ...claim, heldBy: 'b' })).toBe('campTaken');
    expect(claimRefusal({ ...claim, heldBy: 'a' })).toBe('ownCamp');
    expect(claimRefusal({ ...claim, holdsOne: true })).toBe('haveCamp');
    expect(claimRefusal({ ...claim, inRun: true })).toBe('inRun');
    expect(claimRefusal({ ...claim, canFight: false })).toBe('noParty');
    expect(claimRefusal({ ...claim, near: false })).toBe('campFar');
  });

  const raid = { enabled: true, campHere: true, near: true, heldBy: 'b', me: 'a', inRun: false, canFight: true, ownerOnline: false, ownerInRun: false, wonToday: false, guardTop: 30, leadLevel: 30 };
  it('a raid: someone else holds it, they are away, once a day, a guard worth fighting', () => {
    expect(raidRefusal(raid)).toBeNull();
    expect(raidRefusal({ ...raid, heldBy: null })).toBe('campFree');
    expect(raidRefusal({ ...raid, heldBy: 'a' })).toBe('ownCamp');
    expect(raidRefusal({ ...raid, ownerOnline: true })).toBe('ownerHome');
    expect(raidRefusal({ ...raid, ownerInRun: true })).toBe('ownerInRun');
    expect(raidRefusal({ ...raid, wonToday: true })).toBe('raidedToday');
    expect(raidRefusal({ ...raid, inRun: true })).toBe('inRun');
    expect(raidRefusal({ ...raid, near: false })).toBe('campFar');
    expect(raidRefusal({ ...raid, guardTop: 30 - CAMP_LEVEL_SPAN })).toBeNull();
    expect(raidRefusal({ ...raid, guardTop: 29 - CAMP_LEVEL_SPAN })).toBe('guardTooWeak');
    // a stronger guard is the raider's risk
    expect(raidRefusal({ ...raid, guardTop: 70 })).toBeNull();
  });

  it('the camp log says who came and what they took', () => {
    expect(campLogLine({ raider: 'bh_outlaw', won: true, cut: 120, tookOver: false })).toBe('bh_outlaw raided your camp and took 120.');
    expect(campLogLine({ raider: 'kestrel', won: false, cut: 0, tookOver: false })).toBe('Your guard held against kestrel.');
    expect(campLogLine({ raider: 'kestrel', won: true, cut: 0, tookOver: false })).toMatch(/nothing to take/);
    expect(campLogLine({ raider: 'kestrel', won: true, cut: 1000, tookOver: true })).toBe('kestrel beat your guard and took your camp, and 1,000 with it.');
    const many = Array.from({ length: 5 }, (_, i) => ({ raider: `r${i}`, won: i % 2 === 0, cut: 10, tookOver: false }));
    const lines = campWelcome(many);
    expect(lines).toHaveLength(4);
    expect(lines[3]).toMatch(/2 more raids/);
    expect(campWelcome([])).toEqual([]);
    expect(raidWonText('kestrel', 120, false)).toMatch(/took 120 from kestrel/);
  });

  it('trophy ids, names and words', () => {
    expect(trophyKindOf(trophyId('legend', 'solaris'))).toBe('legend');
    expect(trophyKindOf('medal:champion')).toBe('medal');
    expect(trophyKindOf('bogus:x')).toBeNull();
    expect(trophyKindOf('nocolon')).toBeNull();
    expect(campGuardOwner(campGuardTrainerId('bh_outlaw'))).toBe('bh_outlaw');
    expect(campGuardOwner('ghost:bh_outlaw')).toBeNull();
    expect(defaultCampName('bh_outlaw')).toBe("bh_outlaw's camp");
    expect(defaultCampName('a_very_long_name_here').length).toBeLessThanOrEqual(CAMP_NAME_MAX);
    for (const t of [...Object.values(CAMP_REFUSAL_TEXT), ...Object.values(TROPHY_KIND_LABEL)]) expect(t).not.toMatch(EM);
  });
});
