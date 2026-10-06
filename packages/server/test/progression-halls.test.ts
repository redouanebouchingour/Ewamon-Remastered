/**
 * Smoke test for the progression walker's hall navigation (walker.ts `reachLeader` / `enterHall` / `leaveHall` /
 * `hop`), minutes instead of the legs' hours: every gym hall and Solenne's league hall walked with real inputs and
 * won, from a SET-UP account (five level-100 creatures, the previous badges and each leader's story gate granted
 * through the repos — setup only; the legs earn all of that). Pins the planner on all eight gym designs: hedge maze,
 * furnaces, sluices, ordered breakers, boulder maze, Vesperveil's sealed cells joined only by warp tiles (decoys
 * skipped; the `return` tile taken on the way out), anvils and the bridge — and the league hall: Kirei's charge in
 * the foyer, then the four chambers in order behind the `elite:*` gates.
 *
 * Runs in the progression project (`pnpm test:progression progression-halls`), not the default `pnpm test`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BADGE_ORDER, LEAGUE, STORY, beatDoneFlag, getHeightfield, interiorAt, interiorWarps, leagueStoryGate, nearestWalkable } from '@ewa/content';
import type { ZoneId } from '@ewa/content';
import { newCreature } from '../src/game/creatures';
import { content, placePlayer, register } from './helpers';
import type { TestServer } from './helpers';
import { playBeat, walkServer, winLeague } from './progression';
import { Walker } from './walker';

let s: TestServer;
beforeAll(async () => {
  s = await walkServer();
}, 120_000);
afterAll(async () => {
  await s?.stop();
}, 60_000);

const TEAM = ['zenryu', 'pyrothal', 'abyssrake', 'rexaloft', 'blizzraak'] as const;

/** Setup only: a fresh account with five level-100 creatures behind its starter, `badges` and `flags`, standing at (x, z) in `zoneId`. */
async function account(zoneId: ZoneId, x: number, z: number, badges: readonly string[], flags: readonly string[]): Promise<Walker> {
  const acc = await register(s, 'cindercap');
  await s.repos.db.transaction(async (tx) => {
    for (let i = 0; i < TEAM.length; i++) await s.repos.creatures.insert(tx, newCreature(content, TEAM[i]!, 100, { ownerId: acc.id }), { kind: 'party', index: i + 1 });
    for (const b of badges) await s.repos.progress.awardBadge(tx, acc.id, b as (typeof BADGE_ORDER)[number], new Date());
    if (flags.length > 0) await s.repos.progress.setFlags(tx, acc.id, flags, new Date());
  });
  const p = nearestWalkable(getHeightfield(zoneId), x, z, 4)!;
  await placePlayer(s, acc.id, zoneId, p[0], p[1]);
  const w = new Walker(s, acc.id, acc.access, acc.refresh, acc.username);
  await w.enter();
  return w;
}

/** Every beat this league trainer speaks, done (and its flags held): facing them starts the fight. */
function spokenFlags(leagueId: string): string[] {
  const gate = leagueStoryGate(leagueId);
  return [...(gate === null ? [] : [gate]), ...STORY.filter((b) => b.speaker === leagueId).flatMap((b) => [...b.set, beatDoneFlag(b.id)])];
}

describe('the walker clears every hall with real inputs', () => {
  const gyms = LEAGUE.filter((l) => l.stage === 'gym').sort((a, b) => a.order - b.order);
  for (const lt of gyms) {
    it(`${lt.zoneId}: through the door, the hall's trainers and puzzle, ${lt.name}, and out again`, async () => {
      const door = interiorWarps(lt.zoneId).find((x) => x.id === `${lt.zoneId}.gym.in`)!;
      const w = await account(lt.zoneId, door.x, door.z, BADGE_ORDER.slice(0, lt.order - 1), spokenFlags(lt.id));
      try {
        await winLeague(w, lt.id);
        const p = w.pocket();
        expect(p?.def.id).toBe(`${lt.zoneId}.gym`);
        await w.leaveHall(p!);
        expect(interiorAt(lt.zoneId, w.me().x, w.me().z)).toBeNull();
      } finally {
        await w.leave();
        console.log(w.log.join('\n'));
      }
    }, 600_000);
  }

  it("solenne: Kirei's charge in the foyer, then Veil → Aurelia → Kirei → Zeon chamber by chamber, the name restored", async () => {
    const door = interiorWarps('solenne').find((x) => x.id === 'solenne.league.in')!;
    // every beat before Kirei's charge played (the zone's next beat must be hers)
    const before = STORY.slice(0, STORY.findIndex((b) => b.id === 'wardens_charge'));
    const w = await account('solenne', door.x, door.z, BADGE_ORDER, before.flatMap((b) => [...b.set, beatDoneFlag(b.id)]));
    try {
      await playBeat(w, 'wardens_charge');
      expect(w.pocket()?.def.id).toBe('solenne.league');
      for (const id of ['veil', 'aurelia', 'kirei', 'zeon']) await winLeague(w, id);
      await playBeat(w, 'name_restored');
      const me = await w.me2();
      for (const f of ['elite:veil:beaten', 'elite:aurelia:beaten', 'elite:kirei:beaten', 'champion:zeon:beaten']) expect(me.flags).toContain(f);
      await w.leaveHall(w.pocket()!);
    } finally {
      await w.leave();
      console.log(w.log.join('\n'));
    }
  }, 900_000);
});
