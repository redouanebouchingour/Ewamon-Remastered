/**
 * Camp bases (migration 0020): one owner per camp and one camp per owner; edits, the guard snapshot, a takeover only
 * from the owner it names; the raid log told once, the raider's daily cooldown and the owner's held points.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AnyDb } from '../src/db';
import { campRepo } from '../src/repos/camps';
import { mkCreature, mkPlayer, openTestDb } from './helpers';

let db: AnyDb;
beforeAll(async () => {
  db = await openTestDb();
});
afterAll(async () => {
  await db.close();
});

const at = (h: number): Date => new Date(Date.UTC(2026, 9, 22, h));

describe('camps', () => {
  it('claims, edits, guards, transfers and abandons', async () => {
    await db.transaction(async (tx) => {
      const [a, b] = [await mkPlayer(tx, 'c_owner'), await mkPlayer(tx, 'c_raider')];
      const ca = await mkCreature(tx, a, { kind: 'party', index: 0 }, { level: 22 });
      const cb = await mkCreature(tx, b, { kind: 'party', index: 0 }, { level: 30 });
      expect(await campRepo.claim(tx, { zoneId: 'mire_route', ownerId: a, ownerName: 'c_owner', name: "c_owner's camp", guard: [ca] }, at(1))).toBe(true);
      // one owner per camp, one camp per owner
      expect(await campRepo.claim(tx, { zoneId: 'mire_route', ownerId: b, ownerName: 'c_raider', name: 'x', guard: [cb] }, at(1))).toBe(false);
      expect(await campRepo.claim(tx, { zoneId: 'ash_route', ownerId: a, ownerName: 'c_owner', name: 'x', guard: [ca] }, at(1))).toBe(false);
      expect((await campRepo.of(tx, 'mire_route'))?.guardTop).toBe(22);
      expect((await campRepo.byOwner(tx, a))?.zoneId).toBe('mire_route');

      const edited = await campRepo.edit(tx, a, { name: 'Ironhold', trophies: [{ id: 'medal:champion', kind: 'medal', label: "Champion's medal" }] }, at(2));
      expect(edited).toMatchObject({ name: 'Ironhold', trophies: [{ id: 'medal:champion' }] });
      expect(await campRepo.edit(tx, b, { name: 'nope' }, at(2))).toBeNull();
      expect(await campRepo.setGuard(tx, a, [], at(3))).toBe(false);
      expect(await campRepo.setGuard(tx, a, [{ ...ca, level: 40 }], at(3))).toBe(true);
      expect((await campRepo.of(tx, 'mire_route'))?.guardTop).toBe(40);

      // a takeover names the owner it takes from
      expect(await campRepo.transfer(tx, 'mire_route', b, { ownerId: b, ownerName: 'c_raider', name: 'y', guard: [cb] }, at(4))).toBe(false);
      expect(await campRepo.transfer(tx, 'mire_route', a, { ownerId: b, ownerName: 'c_raider', name: "c_raider's camp", guard: [cb] }, at(4))).toBe(true);
      const now = await campRepo.of(tx, 'mire_route');
      expect(now).toMatchObject({ ownerId: b, name: "c_raider's camp", trophies: [], guardTop: 30 });
      expect(await campRepo.byOwner(tx, a)).toBeNull();
      expect((await campRepo.all(tx)).map((c) => c.zoneId)).toEqual(['mire_route']);
      expect((await campRepo.abandon(tx, b))?.zoneId).toBe('mire_route');
      expect(await campRepo.of(tx, 'mire_route')).toBeNull();
      expect(await campRepo.abandon(tx, b)).toBeNull();
    });
  });

  it('keeps the camp log, told once; the raider cooldown and the held points', async () => {
    await db.transaction(async (tx) => {
      const [o, r] = [await mkPlayer(tx, 'l_owner'), await mkPlayer(tx, 'l_raider')];
      const base = { zoneId: 'tide_route', ownerId: o, raiderId: r, raiderName: 'l_raider', tookOver: false };
      await campRepo.recordRaid(tx, { ...base, won: false, cut: 0, held: true }, at(1));
      await campRepo.recordRaid(tx, { ...base, won: true, cut: 120, held: false }, at(2));
      expect(await campRepo.wonSince(tx, r, 'tide_route', at(1))).toBe(true);
      expect(await campRepo.wonSince(tx, r, 'tide_route', at(3))).toBe(false);
      expect(await campRepo.wonSince(tx, r, 'ash_route', at(0))).toBe(false);
      expect(await campRepo.heldSince(tx, o, at(0))).toBe(1);
      expect(await campRepo.heldSince(tx, o, at(2))).toBe(0);
      const told = await campRepo.report(tx, o);
      expect(told.map((x) => [x.won, x.cut])).toEqual([
        [false, 0],
        [true, 120],
      ]);
      expect(await campRepo.report(tx, o)).toEqual([]);
      expect((await campRepo.log(tx, o, 10)).map((x) => x.cut)).toEqual([120, 0]);
    });
  });
});
