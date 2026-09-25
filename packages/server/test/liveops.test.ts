/**
 * §30.9 live-ops: mission data + the daily pick, the seasonal/weekday/swarm schedule → LiveOpsMods, hotspot windows,
 * the login streak (register = day 1, same-day logins free, a skipped day resets), mission progress through the
 * one quest code path, per-mission claims, the rollover job, and the room applying the mods.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { matchMaker } from '@colyseus/core';
import { DAILY_SWARMS, RAID_HOTSPOTS, SEASONAL_EVENTS } from '@ewa/content';
import type { RaidHotspot } from '@ewa/content';
import { TRAINER_EXP } from '@ewa/core';
import { advanceQuests } from '../src/game/quests';
import { liveStreak, streakFromFlags } from '../src/liveops/login';
import { DAILY_MISSIONS, LOGIN_STREAK, WEEKLY_GOALS, dailyMissionsFor, streakReward } from '../src/liveops/missions';
import { rolloverTick } from '../src/liveops/rollover';
import { DAY_MS, dayKey, hotspotClosesAt, hotspotOpen, liveOpsModsFor, weekKey } from '../src/liveops/schedule';
import { silentLogger } from '../src/log';
import type { ZoneRoom } from '../src/rooms/ZoneRoom';
import { START_MONEY, api, content, enter, placePlayer, register, startServer, waitFor } from './helpers';
import type { TestServer } from './helpers';

describe('mission data (§30.9.1)', () => {
  it('3 distinct daily picks per day, deterministic; 3 weekly goals; 7 streak rows (day 7 repeats); every reward item exists', () => {
    for (let d = 0; d < 60; d++) {
      const key = dayKey(Date.UTC(2026, 8, 1) + d * DAY_MS);
      const picks = dailyMissionsFor(key);
      expect(picks).toHaveLength(3);
      expect(new Set(picks.map((m) => m.id)).size).toBe(3);
      expect(dailyMissionsFor(key)).toEqual(picks);
    }
    expect(WEEKLY_GOALS).toHaveLength(3);
    expect(LOGIN_STREAK.map((r) => r.day)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(streakReward(9)).toBe(LOGIN_STREAK[6]);
    for (const m of [...DAILY_MISSIONS, ...WEEKLY_GOALS, ...LOGIN_STREAK.map((r) => ({ reward: { items: r.items } }))]) {
      for (const item of Object.keys(m.reward.items)) {
        let known = true;
        try {
          content.item(item);
        } catch (_e) {
          try {
            content.orb(item);
          } catch (_e2) {
            known = false;
          }
        }
        expect(known, item).toBe(true);
      }
    }
  });
});

describe('schedule (§30.9.2)', () => {
  it('weekday variant pool, the swarm of the day for its zone only, seasonal bonuses + featured species', () => {
    // 2026-09-21 is a Monday → dawn; DAILY_SWARMS[1] is ash_route
    const monday = Date.UTC(2026, 8, 21, 12);
    expect(liveOpsModsFor('mire_route', monday).variantPool).toEqual(['dawn']);
    expect(liveOpsModsFor('ash_route', monday)).toMatchObject({ swarmSpecies: DAILY_SWARMS[1]!.species, swarmWeightBoost: DAILY_SWARMS[1]!.weightBoost });
    expect(liveOpsModsFor('mire_route', monday)).toMatchObject({ swarmSpecies: [], swarmWeightBoost: 1, alphaBonus: 0, variantBonus: 0 });
    // a Friday has no weekday variant → the 4 non-normal keys
    expect(liveOpsModsFor('mire_route', Date.UTC(2026, 8, 25, 12)).variantPool).toEqual(['dawn', 'dusk', 'verdant', 'ember']);
    const bloom = SEASONAL_EVENTS.find((e) => e.id === 'verdant_bloom')!;
    const during = Date.parse(bloom.startsAt) + DAY_MS;
    const mods = liveOpsModsFor('mire_route', during);
    expect(mods.alphaBonus).toBeCloseTo(bloom.alphaBonus, 10);
    expect(mods.variantBonus).toBeCloseTo(bloom.variantBonus, 10);
    expect(mods.featuredSpecies).toEqual(bloom.featuredSpecies);
    expect(liveOpsModsFor('ash_route', during).alphaBonus).toBe(0); // not a featured zone
    expect(liveOpsModsFor('mire_route', Date.parse(bloom.endsAt)).alphaBonus).toBe(0); // endsAt is exclusive
  });

  it('hotspot windows open at utcHour:00 for `minutes`, wrap midnight, and report their close time', () => {
    const mire = RAID_HOTSPOTS.find((h) => h.id === 'raid_mire_thornback')!; // 17:00 + 30
    const day = Date.UTC(2026, 8, 24);
    expect(hotspotOpen(mire, day + 16 * 3_600_000 + 59 * 60_000)).toBe(false);
    expect(hotspotOpen(mire, day + 17 * 3_600_000)).toBe(true);
    expect(hotspotOpen(mire, day + 17 * 3_600_000 + 29 * 60_000)).toBe(true);
    expect(hotspotOpen(mire, day + 17 * 3_600_000 + 30 * 60_000)).toBe(false);
    expect(hotspotClosesAt(mire, day + 17 * 3_600_000 + 5 * 60_000)).toBe(day + 17 * 3_600_000 + 30 * 60_000);
    const late: RaidHotspot = { ...mire, window: { utcHour: 23, minutes: 90 } };
    expect(hotspotOpen(late, day + 23 * 3_600_000 + 10 * 60_000)).toBe(true);
    expect(hotspotOpen(late, day + DAY_MS + 20 * 60_000)).toBe(true); // 00:20 next day
    expect(hotspotOpen(late, day + DAY_MS + 31 * 60_000)).toBe(false);
    expect(hotspotClosesAt(late, day + DAY_MS + 20 * 60_000)).toBe(day + DAY_MS + 30 * 60_000);
  });
});

let s: TestServer;
beforeAll(async () => {
  s = await startServer();
}, 120_000);
afterAll(async () => {
  await s?.stop();
}, 60_000);

describe('login streak (§30.9.1)', () => {
  it('register = day 1; a same-day login grants nothing; the next day continues the streak; a skipped day resets it', async () => {
    const acc = await register(s);
    let me = (await api(s, 'GET', '/me', acc.access)).body;
    expect(me.liveOps.loginStreak).toBe(1);
    expect(me.money).toBe(START_MONEY);
    expect(me.trainerExp).toBe(TRAINER_EXP.dailyLogin);
    const login = async (): Promise<void> => {
      const r = await api(s, 'POST', '/auth/login', null, { username: acc.username, password: 'correct horse battery' });
      expect(r.status).toBe(200);
      acc.access = r.body.access;
    };
    await login();
    me = (await api(s, 'GET', '/me', acc.access)).body;
    expect(me.money).toBe(START_MONEY);
    s.time.advance(DAY_MS);
    try {
      await login();
      me = (await api(s, 'GET', '/me', acc.access)).body;
      expect(me.liveOps.loginStreak).toBe(2);
      expect(me.money).toBe(START_MONEY + LOGIN_STREAK[1]!.money);
      expect(me.inventory.potion).toBe(5 + (LOGIN_STREAK[1]!.items['potion'] ?? 0));
      expect(me.trainerExp).toBe(2 * TRAINER_EXP.dailyLogin);
      expect(streakFromFlags(me.flags)).toBe(2);
      // a skipped day resets to 1
      s.time.advance(2 * DAY_MS);
      expect(liveStreak(me.flags, s.time.clock())).toBe(0);
      await login();
      me = (await api(s, 'GET', '/me', acc.access)).body;
      expect(me.liveOps.loginStreak).toBe(1);
    } finally {
      s.time.advance(-3 * DAY_MS);
    }
  }, 60_000);
});

describe('missions (§30.9.1)', () => {
  it('advance through the quest code path, list in /me, claim per mission once', async () => {
    // a day whose picks include a `catches` mission
    let day = Date.UTC(2026, 8, 1, 12);
    while (!dailyMissionsFor(dayKey(day)).some((m) => m.metric === 'catches')) day += DAY_MS;
    const mission = dailyMissionsFor(dayKey(day)).find((m) => m.metric === 'catches')!;
    const acc = await register(s);
    const questId = `daily:${dayKey(day)}`;
    const weekly = `weekly:${weekKey(day)}`;
    const touched = await s.repos.db.transaction((tx) =>
      advanceQuests(tx, s.repos, acc.id, Array.from({ length: mission.target }, () => ({ kind: 'catch' as const, species: 'glimp' })), day),
    );
    expect(touched).toContainEqual({ questId, objectiveId: mission.id, count: mission.target, done: true });
    expect(touched).toContainEqual({ questId: weekly, objectiveId: 'weekly-frontier-haul', count: mission.target, done: false });
    // the claim is per mission: money + items once
    const before = (await api(s, 'GET', '/me', acc.access)).body;
    const c = await api(s, 'POST', '/quests/claim', acc.access, { questId, objectiveId: mission.id });
    expect(c.status).toBe(200);
    expect(c.body.money).toBe(before.money + mission.reward.money);
    for (const [item, qty] of Object.entries(mission.reward.items)) expect(c.body.inventory[item]).toBe((before.inventory[item] ?? 0) + qty);
    expect((await api(s, 'POST', '/quests/claim', acc.access, { questId, objectiveId: mission.id })).body.code).toBe('AlreadyClaimed');
    expect((await api(s, 'POST', '/quests/claim', acc.access, { questId: weekly, objectiveId: 'weekly-frontier-haul' })).body.code).toBe('questIncomplete');
    expect((await api(s, 'POST', '/quests/claim', acc.access, { questId, objectiveId: 'not-a-mission' })).status).toBe(404);
    expect((await api(s, 'POST', '/quests/claim', acc.access, { questId })).status).toBe(404);
    // /me lists today's daily and this week's weekly quest with their missions
    const me = (await api(s, 'GET', '/me', acc.access)).body;
    const today = me.quests.find((q: { id: string }) => q.id === `daily:${dayKey(s.time.clock())}`);
    expect(today.missions).toHaveLength(3);
    expect(today.progress).toHaveLength(3);
    expect(me.quests.some((q: { id: string }) => q.id === `weekly:${weekKey(s.time.clock())}`)).toBe(true);
    expect(me.liveOps.dailyMissions).toHaveLength(3);
  }, 60_000);
});

describe('rollover + room mods', () => {
  it('a day change publishes ewa:liveops and prunes synthetic rows older than 14 days; the room applies liveOpsModsFor', async () => {
    const acc = await register(s);
    const old = dayKey(s.time.clock() - 20 * DAY_MS);
    await s.repos.db.transaction((tx) => s.repos.progress.advance(tx, acc.id, `daily:${old}`, 'x', 1, true));
    const published: unknown[] = [];
    const deps = { repos: s.repos, clock: s.time.clock, log: silentLogger(), bus: { publish: (_t: string, d: unknown) => void published.push(d) } };
    expect(await rolloverTick(deps, { dayKey: dayKey(s.time.clock()), weekKey: weekKey(s.time.clock()) })).toBe(false);
    expect(await rolloverTick(deps, { dayKey: 'yesterday', weekKey: weekKey(s.time.clock()) })).toBe(true);
    expect(published).toEqual([{ dayKey: dayKey(s.time.clock()), weekKey: weekKey(s.time.clock()) }]);
    const rows = await s.repos.db.transaction((tx) => s.repos.progress.quest(tx, acc.id, `daily:${old}`));
    expect(rows).toEqual([]);
    await placePlayer(s, acc.id, 'mire_route', 0, 0);
    const j = await enter(s, acc, 'mire_route');
    const room = matchMaker.getLocalRoomById(j.room.roomId) as unknown as ZoneRoom;
    expect(room.spawns).not.toBeNull();
    expect(room.spawns!.liveOps).toEqual(liveOpsModsFor('mire_route', s.time.clock()));
    // a published rollover makes the room re-derive (clobber the mods first to observe it)
    room.spawns!.setLiveOps({ alphaBonus: 9, variantBonus: 9, swarmSpecies: [], swarmWeightBoost: 1, variantPool: ['dusk'] });
    s.booted.runtime.bus.publish('ewa:liveops', { dayKey: 'x', weekKey: 'y' });
    await waitFor(() => room.spawns!.liveOps.alphaBonus !== 9, 3000);
    expect(room.spawns!.liveOps).toEqual(liveOpsModsFor('mire_route', s.time.clock()));
    await j.room.leave(true);
  }, 60_000);
});
