/**
 * §50.4.4 `escape-like.test.ts` — `escapeLike` escapes `\`, `%` and `_` for LIKE / ILIKE (Postgres' default escape is
 * `\`), and a username search for `%` (or `_`) finds only the literal character. Persist stores usernames opaquely (the
 * protocol's `/^[a-z0-9_]{3,20}$/` is the REST layer's), so a `%` name can be written here to prove the escaping.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AnyDb } from '../src/db';
import { playerRepo } from '../src/repos/players';
import { escapeLike } from '../src/util';
import { mkPlayer, openTestDb } from './helpers';

/** one backslash */
const BS = String.fromCharCode(92);

let db: AnyDb;
beforeAll(async () => {
  db = await openTestDb();
});
afterAll(async () => {
  await db.close();
});

describe('escapeLike', () => {
  it('escapes backslash, percent and underscore, nothing else', () => {
    expect(escapeLike('%')).toBe(`${BS}%`);
    expect(escapeLike('_')).toBe(`${BS}_`);
    expect(escapeLike(BS)).toBe(BS + BS);
    expect(escapeLike(`a%b_c${BS}d`)).toBe(`a${BS}%b${BS}_c${BS}${BS}d`);
    expect(escapeLike('plain-name.09')).toBe('plain-name.09');
    expect(escapeLike('')).toBe('');
  });

  it('a search for % / _ / backslash finds only the usernames holding that literal character', async () => {
    const ids = await db.transaction(async (tx) => ({
      pct: await mkPlayer(tx, 'lit%pct'),
      under: await mkPlayer(tx, 'lit_under'),
      slash: await mkPlayer(tx, `lit${BS}slash`),
      plain: await mkPlayer(tx, 'litxplain'),
    }));
    await db.transaction(async (tx) => {
      const pct = await playerRepo.search(tx, '%', 1, 50);
      expect(pct.rows.map((r) => r.id)).toEqual([ids.pct]);
      const under = await playerRepo.search(tx, 'lit_', 1, 50);
      expect(under.rows.map((r) => r.id)).toEqual([ids.under]);
      const slash = await playerRepo.search(tx, BS, 1, 50);
      expect(slash.rows.map((r) => r.id)).toEqual([ids.slash]);
      // unescaped, 'lit%' / 'lit_' would match all four
      expect((await playerRepo.search(tx, 'lit', 1, 50)).total).toBe(4);
    });
  });
});
