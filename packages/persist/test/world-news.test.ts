/**
 * The rumour board's reads (worldNews.ts): badges and run splits in a window by public name, banned players left out;
 * camps that changed hands; active nemeses near a town from a rank, strongest first; market sales with their price.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AnyDb } from '../src/db';
import { campRepo } from '../src/repos/camps';
import { nemesisRepo } from '../src/repos/nemeses';
import { playerRepo } from '../src/repos/players';
import { progressRepo } from '../src/repos/progress';
import { runRepo } from '../src/repos/runs';
import { worldNewsRepo } from '../src/repos/worldNews';
import { mkPlayer, openTestDb } from './helpers';

let db: AnyDb;
beforeAll(async () => {
  db = await openTestDb();
});
afterAll(async () => {
  await db.close();
});

const at = (h: number): Date => new Date(Date.UTC(2026, 9, 21, h));
const FROM = at(0);
const TO = at(24);

describe('world news', () => {
  it('reads the badges and the Champion split of a window by name, without banned players', async () => {
    await db.transaction(async (tx) => {
      const a = await mkPlayer(tx, 'news_ada');
      const b = await mkPlayer(tx, 'news_bo');
      const banned = await mkPlayer(tx, 'news_ban');
      await progressRepo.awardBadge(tx, a, 'bloom', at(5));
      await progressRepo.awardBadge(tx, b, 'ember', at(3));
      await progressRepo.awardBadge(tx, b, 'bloom', at(-2)); // the day before
      await progressRepo.awardBadge(tx, banned, 'bloom', at(4));
      await playerRepo.ban(tx, banned, 'test', at(6));
      const got = await worldNewsRepo.badgesBetween(tx, FROM, TO, 10);
      expect(got.map((x) => [x.username, x.badgeId])).toEqual([
        ['news_bo', 'ember'],
        ['news_ada', 'bloom'],
      ]);
      await runRepo.split(tx, a, 'champion', at(7));
      await runRepo.split(tx, b, 'champion', at(30));
      expect((await worldNewsRepo.splitsBetween(tx, 'champion', FROM, TO, 10)).map((x) => x.username)).toEqual(['news_ada']);
    });
  });

  it('reads the camps that changed hands, the nemeses near a town and the sales', async () => {
    await db.transaction(async (tx) => {
      const owner = await mkPlayer(tx, 'news_own');
      const raider = await mkPlayer(tx, 'news_rai');
      await campRepo.recordRaid(tx, { zoneId: 'mire_route', ownerId: owner, raiderId: raider, raiderName: 'news_rai', won: true, cut: 10, tookOver: true, held: false }, at(9));
      await campRepo.recordRaid(tx, { zoneId: 'ash_route', ownerId: owner, raiderId: raider, raiderName: 'news_rai', won: true, cut: 10, tookOver: false, held: false }, at(10));
      expect(await worldNewsRepo.campTakeovers(tx, FROM, TO, 10)).toEqual([{ zoneId: 'mire_route', holder: 'news_rai', at: at(9) }]);

      const base = { speciesId: 'dustcub', level: 9, title: 'the Unbroken', scar: 'burn', move: 'Dig', ability: 'Sand Veil', variantKey: 'normal' as const, isShiny: false, isAlpha: false, memory: { how: 'ko' as const, zoneId: 'mire_route', foeSpecies: 'pyrekit', foeName: null, move: 'Tackle', orb: null } };
      const weak = (await nemesisRepo.rise(tx, { ...base, ownerId: owner, name: 'Weakling', bornZone: 'mire_route' }, 5, at(1))).nemesis;
      const strong = (await nemesisRepo.rise(tx, { ...base, ownerId: owner, name: 'Scarjaw', bornZone: 'mire_route' }, 5, at(2))).nemesis;
      const far = (await nemesisRepo.rise(tx, { ...base, ownerId: raider, name: 'Faraway', bornZone: 'tide_route' }, 5, at(3))).nemesis;
      await nemesisRepo.rankUp(tx, strong.id, { rank: 3, level: 14, memory: base.memory, zoneId: 'mire_route' }, at(4));
      await nemesisRepo.rankUp(tx, far.id, { rank: 4, level: 20, memory: base.memory, zoneId: 'tide_route' }, at(4));
      const near = await worldNewsRepo.risingNemeses(tx, ['mirevale', 'mire_route'], 2, 10);
      expect(near.map((n) => [n.name, n.rank, n.level, n.zoneId])).toEqual([['Scarjaw', 3, 14, 'mire_route']]);
      expect(weak.rank).toBe(1);
      expect(await worldNewsRepo.risingNemeses(tx, [], 1, 10)).toEqual([]);
    });
  });
});
