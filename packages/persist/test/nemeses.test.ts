/**
 * Nemeses (migration 0017): a trainer's active nemeses newest first; past the cap the oldest fades; a rank up keeps it
 * active with its new memory; an ended one leaves the list and cannot end twice.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AnyDb } from '../src/db';
import { nemesisRepo } from '../src/repos/nemeses';
import type { NewNemesis } from '../src/repos/nemeses';
import { mkPlayer, openTestDb } from './helpers';

let db: AnyDb;
beforeAll(async () => {
  db = await openTestDb();
});
afterAll(async () => {
  await db.close();
});

const at = (m: number): Date => new Date(Date.UTC(2026, 9, 21, 12, m));
const nem = (ownerId: string, name: string, over: Partial<NewNemesis> = {}): NewNemesis => ({
  ownerId,
  speciesId: 'dustcub',
  level: 9,
  name,
  title: 'the Unbroken',
  scar: 'burn',
  move: 'Dig',
  ability: 'Sand Veil',
  variantKey: 'normal',
  isShiny: false,
  isAlpha: false,
  bornZone: 'mire_route',
  memory: { how: 'ko', zoneId: 'mire_route', foeSpecies: 'pyrekit', foeName: null, move: 'Tackle', orb: null },
  ...over,
});

describe('nemeses', () => {
  it('rise newest first, at most `max` active: the oldest fades', async () => {
    await db.transaction(async (tx) => {
      const p = await mkPlayer(tx, 'nemesis_a');
      const a = await nemesisRepo.rise(tx, nem(p, 'Scarjaw'), 3, at(1));
      expect(a.nemesis).toMatchObject({ name: 'Scarjaw', rank: 1, status: 'active', lastZone: 'mire_route', memory: { how: 'ko', move: 'Tackle' } });
      expect(a.faded).toEqual([]);
      await nemesisRepo.rise(tx, nem(p, 'Ashfang'), 3, at(2));
      await nemesisRepo.rise(tx, nem(p, 'Rimeclaw'), 3, at(3));
      const d = await nemesisRepo.rise(tx, nem(p, 'Voltmaw'), 3, at(4));
      expect(d.faded.map((x) => x.name)).toEqual(['Scarjaw']);
      expect((await nemesisRepo.active(tx, p)).map((x) => x.name)).toEqual(['Voltmaw', 'Rimeclaw', 'Ashfang']);
      expect((await nemesisRepo.of(tx, a.nemesis.id))?.status).toBe('faded');
    });
  });

  it('a rank up keeps it active with the newest fight; an end is once', async () => {
    await db.transaction(async (tx) => {
      const p = await mkPlayer(tx, 'nemesis_b');
      const { nemesis } = await nemesisRepo.rise(tx, nem(p, 'Gritjaw'), 3, at(1));
      const up = await nemesisRepo.rankUp(tx, nemesis.id, { rank: 2, level: 11, zoneId: 'ash_route', memory: { how: 'breakout', zoneId: 'ash_route', foeSpecies: 'pyrekit', foeName: 'Pip', move: null, orb: 'orb' } }, at(5));
      expect(up).toMatchObject({ rank: 2, level: 11, lastZone: 'ash_route', bornZone: 'mire_route', memory: { how: 'breakout', orb: 'orb' } });
      await nemesisRepo.seen(tx, nemesis.id, 'tide_route', at(6));
      expect((await nemesisRepo.of(tx, nemesis.id))?.lastZone).toBe('tide_route');
      expect(await nemesisRepo.end(tx, nemesis.id, 'beaten', 'tide_route', at(7))).toBe(true);
      expect(await nemesisRepo.end(tx, nemesis.id, 'caught', 'tide_route', at(8))).toBe(false);
      expect(await nemesisRepo.rankUp(tx, nemesis.id, { rank: 3, level: 12, zoneId: 'x', memory: up!.memory }, at(9))).toBeNull();
      expect(await nemesisRepo.active(tx, p)).toEqual([]);
    });
  });
});
