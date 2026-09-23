import { describe, expect, it } from 'vitest';
import type { ZoneId } from '../src/index';
import {
  BADGE_ORDER,
  FLAG_IDS,
  LEAGUE,
  QUESTS,
  STORY,
  ZONES,
  ZONE_ORDER,
  beatDoneFlag,
  harvestStateFor,
  isKnownFlag,
  nextStoryBeat,
} from '../src/index';

describe('story (§3.5)', () => {
  it('exactly one starter; every act has a beat; 33 beats in bible order', () => {
    expect(STORY.filter((b) => b.starter).map((b) => b.id)).toEqual(['first_witness']);
    for (const act of [1, 2, 3]) expect(STORY.some((b) => b.act === act)).toBe(true);
    expect(STORY.length).toBe(33);
    expect(STORY.filter((b) => b.act === 1).length).toBe(9);
    expect(STORY.filter((b) => b.act === 2).length).toBe(14);
    expect(STORY.filter((b) => b.act === 3).length).toBe(10);
    expect(STORY.filter((b) => b.battle !== null).length).toBe(7);
  });

  it('every need flag is badge sugar or set by a beat / quest / league row; every flag is in the §11 registry', () => {
    const set = new Set<string>();
    for (const b of STORY) for (const f of b.set) set.add(f);
    for (const q of QUESTS) if (q.rewards.flag) set.add(q.rewards.flag);
    for (const l of LEAGUE) for (const f of l.setsFlags) set.add(f);
    for (const b of STORY) {
      for (const f of b.need) {
        expect(f.startsWith('badge:') || set.has(f), `${b.id} needs ${f}`).toBe(true);
        expect(isKnownFlag(f), f).toBe(true);
      }
      for (const f of b.set) expect(FLAG_IDS.has(f), f).toBe(true);
    }
  });

  it('beatDoneFlag never collides with an authored flag', () => {
    for (const b of STORY) expect(FLAG_IDS.has(beatDoneFlag(b.id))).toBe(false);
    expect(beatDoneFlag('first_witness')).toBe('beat:first_witness:done');
  });

  it('nextStoryBeat: beat 1 for an empty flag set; null once a zone is exhausted', () => {
    expect(nextStoryBeat('mirevale', new Set())?.id).toBe('first_witness');
    expect(nextStoryBeat('mire_route', new Set())).toBeNull();
    expect(nextStoryBeat('mire_route', new Set(['met_wynn']))?.id).toBe('mire_rival');
    const all = new Set(STORY.flatMap((b) => [...b.set, beatDoneFlag(b.id)]));
    for (const z of ZONE_ORDER) expect(nextStoryBeat(z, all)).toBeNull();
  });

  it('harvestStateFor: default, harvested after grove_gone, intact after restore_the_grove; solenne dips and returns', () => {
    expect(harvestStateFor('mire_route', new Set())).toBe('intact');
    expect(harvestStateFor('mire_route', new Set([beatDoneFlag('grove_gone')]))).toBe('harvested');
    expect(harvestStateFor('mire_route', new Set([beatDoneFlag('grove_gone'), beatDoneFlag('restore_the_grove')]))).toBe('intact');
    expect(harvestStateFor('ash_route', new Set())).toBe('intact');
    expect(harvestStateFor('ash_route', new Set([beatDoneFlag('first_harvest')]))).toBe('harvested');
    expect(harvestStateFor('solenne', new Set([beatDoneFlag('spire_withdrawal')]))).toBe('thinning');
    expect(harvestStateFor('solenne', new Set([beatDoneFlag('spire_withdrawal'), beatDoneFlag('name_restored')]))).toBe('intact');
    expect(harvestStateFor('umbral_observatory', new Set())).toBe('harvested');
    expect(harvestStateFor('tide_route', new Set())).toBe('thinning');
  });

  it('at most one beat is eligible per zone at any reachable flag set, and every beat completes (forward simulation)', () => {
    const flags = new Set<string>();
    const done = new Set<string>();
    const badges = [...BADGE_ORDER];
    const questFlags = QUESTS.map((q) => q.rewards.flag).filter((f): f is string => f !== null);
    let progressed = true;
    let steps = 0;
    while (progressed && steps < 200) {
      progressed = false;
      steps++;
      for (const z of ZONES) {
        const eligible = STORY.filter((b) => b.zoneId === z.id && !done.has(b.id) && b.need.every((f) => flags.has(f)));
        expect(eligible.length, `${z.id} @ step ${steps}: ${eligible.map((b) => b.id).join(',')}`).toBeLessThanOrEqual(1);
        const next = nextStoryBeat(z.id, flags);
        expect(next?.id ?? null).toBe(eligible[0]?.id ?? null);
        if (next !== null) {
          done.add(next.id);
          for (const f of next.set) flags.add(f);
          flags.add(beatDoneFlag(next.id));
          progressed = true;
        }
      }
      if (!progressed) {
        // the player earns the next badge, then the champion flag, then quest flags, in play order
        const badge = badges.shift();
        if (badge !== undefined) { flags.add(`badge:${badge}`); progressed = true; continue; }
        if (!flags.has('champion:zeon:beaten')) { flags.add('champion:zeon:beaten'); progressed = true; continue; }
        const q = questFlags.shift();
        if (q !== undefined) { flags.add(q); progressed = true; }
      }
    }
    expect(done.size).toBe(STORY.length);
  });

  it('speakers are npcs of the beat zone or league trainers sitting in that zone', () => {
    const zoneById = new Map(ZONES.map((z) => [z.id, z]));
    for (const b of STORY) {
      const npc = zoneById.get(b.zoneId as ZoneId)!.npcs.find((n) => n.id === b.speaker);
      const lt = LEAGUE.find((l) => l.id === b.speaker);
      expect(npc !== undefined || lt?.zoneId === b.zoneId, `${b.id}: ${b.speaker}`).toBe(true);
    }
  });
});
