/**
 * CreatureInstance round-trip and row CHECKs. Phase E5 moved the slot model to slots.test.ts and transferCreature /
 * release to transfer.test.ts (§50.4.4 file names).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AnyDb } from '../src/db';
import { creatureRepo } from '../src/repos/creatures';
import type { CreatureInstance } from '../src/types';
import { creatureFixture, expectDbError, mkCreature, mkPlayer, openTestDb } from './helpers';

let db: AnyDb;
beforeAll(async () => {
  db = await openTestDb();
});
afterAll(async () => {
  await db.close();
});

describe('CreatureInstance round-trip (§2.8)', () => {
  it('persists and reads back every field, including the status array and moves jsonb', async () => {
    await db.transaction(async (tx) => {
      const owner = await mkPlayer(tx);
      const full = creatureFixture(owner, {
        speciesId: 'glimfin',
        nickname: 'Sparky',
        level: 37,
        exp: 50653,
        hp: 91,
        moves: [
          { id: 'spark', pp: 20, ppMax: 20 },
          { id: 'tail_whip', pp: 0, ppMax: 30 },
          { id: 'charge', pp: 15, ppMax: 20 },
          { id: 'discharge', pp: 5, ppMax: 5 },
        ],
        status: ['paralyze', 'confuse'],
        ability: 'static',
        heldItem: 'leftovers',
        variantKey: 'dusk',
        isAlpha: true,
        caughtAt: { zoneId: 'galvan_route', at: Date.UTC(2026, 8, 17, 8, 30, 0, 0) },
        ribbons: ['league_bloom', 'first_catch'],
        favorite: true,
        locked: true,
      });
      const inserted = await creatureRepo.insert(tx, full, { kind: 'party', index: 0 });
      expect(inserted.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(inserted).toEqual({ ...full, id: inserted.id });

      const read = await creatureRepo.byId(tx, inserted.id);
      expect(read).toEqual({ ...full, id: inserted.id });
      expect(read!.status).toEqual(['paralyze', 'confuse']);
      expect(read!.moves).toHaveLength(4);
      expect(read!.caughtAt).toEqual({ zoneId: 'galvan_route', at: Date.UTC(2026, 8, 17, 8, 30, 0, 0) });

      const rec = await creatureRepo.recordById(tx, inserted.id);
      expect(rec).toMatchObject({ slotKind: 'party', slotIndex: 0, version: 0 });
    });
  });

  it('null nickname / heldItem / caughtAt survive; update() rewrites the row and bumps version', async () => {
    await db.transaction(async (tx) => {
      const owner = await mkPlayer(tx);
      const c = await mkCreature(tx, owner, { kind: 'box', index: 'nextBox' });
      expect(c.nickname).toBeNull();
      expect(c.heldItem).toBeNull();
      expect(c.caughtAt).toBeNull();
      const next: CreatureInstance = { ...c, hp: 0, status: ['burn'], moves: [{ id: 'tackle', pp: 34, ppMax: 35 }], nickname: 'Bram', level: 6, exp: 216 };
      await creatureRepo.update(tx, next);
      expect(await creatureRepo.byId(tx, c.id)).toEqual(next);
      expect((await creatureRepo.recordById(tx, c.id))!.version).toBe(1);
    });
  });

  it('the CHECKs reject level outside 1..100 and negative hp', async () => {
    await db.transaction(async (tx) => {
      const owner = await mkPlayer(tx);
      await expectDbError(/creature_level_ck/, () => mkCreature(tx, owner, { kind: 'box', index: 0 }, { level: 101 }));
    });
    await db.transaction(async (tx) => {
      const owner = await mkPlayer(tx);
      await expectDbError(/creature_hp_ck/, () => mkCreature(tx, owner, { kind: 'box', index: 0 }, { hp: -1 }));
    });
  });
});
