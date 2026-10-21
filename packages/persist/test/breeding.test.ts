/**
 * Breeding (migration 0016): creatures left at the Daycare sit in the `daycare` slot kind in the order they were left;
 * the egg timer is one row per trainer; carried eggs count steps (capped at their total) and only a carried egg that
 * walked them all can be taken to hatch; a hatchling's history starts with `hatched` instead of `met`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AnyDb } from '../src/db';
import { breedingRepo } from '../src/repos/breeding';
import type { NewEgg } from '../src/repos/breeding';
import { creatureRepo } from '../src/repos/creatures';
import { creatureFixture, mkCreature, mkPlayer, openTestDb } from './helpers';

let db: AnyDb;
beforeAll(async () => {
  db = await openTestDb();
});
afterAll(async () => {
  await db.close();
});

const at = (m: number): Date => new Date(Date.UTC(2026, 9, 20, 12, m));
const egg = (ownerId: string, over: Partial<NewEgg> = {}): NewEgg => ({
  ownerId,
  place: 'party',
  speciesId: 'dustcub',
  stepsTotal: 100,
  honor: 4,
  variantKey: 'normal',
  ability: 'Sand Veil',
  moves: ['tackle'],
  isShiny: false,
  bandborn: true,
  parents: [
    { speciesId: 'badlander', nickname: null },
    { speciesId: 'lawlander', nickname: 'Rex' },
  ],
  zoneId: 'mirevale',
  ...over,
});

describe('breeding', () => {
  it('keeps the pair in order, the egg timer, and steps for carried eggs only', async () => {
    await db.transaction(async (tx) => {
      const p = await mkPlayer(tx, 'breeder_a');
      await mkCreature(tx, p, { kind: 'party', index: 0 });
      const a = await mkCreature(tx, p, { kind: 'party', index: 1 });
      const b = await mkCreature(tx, p, { kind: 'box', index: 'nextBox' });
      await creatureRepo.moveToSlot(tx, b.id, 'daycare', 'nextBox');
      await creatureRepo.moveToSlot(tx, a.id, 'daycare', 'nextBox');
      expect((await breedingRepo.pair(tx, p)).map((c) => c.id)).toEqual([b.id, a.id]);
      expect((await creatureRepo.party(tx, p)).length).toBe(1);

      expect(await breedingRepo.eggAt(tx, p)).toBeNull();
      await breedingRepo.setEggAt(tx, p, at(10));
      expect(await breedingRepo.eggAt(tx, p)).toEqual(at(10));
      await breedingRepo.setEggAt(tx, p, null);
      expect(await breedingRepo.eggAt(tx, p)).toBeNull();

      const e1 = await breedingRepo.insertEgg(tx, egg(p), at(1));
      const e2 = await breedingRepo.insertEgg(tx, egg(p, { place: 'box' }), at(2));
      expect(e1).toMatchObject({ stepsWalked: 0, bandborn: true, honor: 4, parents: [{ speciesId: 'badlander' }, { nickname: 'Rex' }] });
      expect((await breedingRepo.addSteps(tx, p, 60.7)).map((e) => [e.id, e.stepsWalked])).toEqual([[e1.id, 60]]);
      expect(await breedingRepo.takeHatched(tx, p, e1.id)).toBeNull();
      expect((await breedingRepo.addSteps(tx, p, 500))[0]!.stepsWalked).toBe(100);
      expect((await breedingRepo.eggs(tx, p)).map((e) => [e.id, e.stepsWalked])).toEqual([
        [e1.id, 100],
        [e2.id, 0],
      ]);
      // a box egg waits; carried, it counts
      expect(await breedingRepo.takeHatched(tx, p, e2.id)).toBeNull();
      await breedingRepo.moveEgg(tx, p, e2.id, 'party');
      expect((await breedingRepo.addSteps(tx, p, 5)).find((e) => e.id === e2.id)?.stepsWalked).toBe(5);
      const taken = await breedingRepo.takeHatched(tx, p, e1.id);
      expect(taken?.id).toBe(e1.id);
      expect((await breedingRepo.eggs(tx, p)).map((e) => e.id)).toEqual([e2.id]);
    });
  });

  it('refuses another trainer\'s egg; a hatchling starts its history hatched', async () => {
    await db.transaction(async (tx) => {
      const p = await mkPlayer(tx, 'breeder_b');
      const q = await mkPlayer(tx, 'breeder_c');
      const e = await breedingRepo.insertEgg(tx, egg(p), at(3));
      await expect(breedingRepo.moveEgg(tx, q, e.id, 'box')).rejects.toMatchObject({ code: 'NotFound' });
      const c = await creatureRepo.insert(tx, { ...creatureFixture(p, { speciesId: 'dustcub', level: 1 }), bandborn: true }, { kind: 'party', index: 0 }, {
        kind: 'hatched',
        speciesId: 'dustcub',
        zoneId: 'mirevale',
        parents: ['Badlander', 'Rex'],
        trainer: 'breeder_b',
      });
      expect((await creatureRepo.byId(tx, c.id))?.bandborn).toBe(true);
      const h = await creatureRepo.history(tx, c.id);
      expect(h?.events.map((x) => x.detail)).toEqual([{ kind: 'hatched', speciesId: 'dustcub', zoneId: 'mirevale', parents: ['Badlander', 'Rex'], trainer: 'breeder_b' }]);
    });
  });
});
