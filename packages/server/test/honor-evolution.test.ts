/**
 * dustcub's honor split on the server: `POST /creature/:id/evolve` resolves the branch from the persisted honor ledger
 * (core honor.ts), whichever branch the client named — the ledger can still move after the battle event that queued
 * the prompt — and refuses below the split level.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { CreatureInstance } from '@ewa/core';
import { newCreature } from '../src/game/creatures';
import { api, content, register, startServer } from './helpers';
import type { Account, TestServer } from './helpers';

let s: TestServer;
beforeAll(async () => {
  s = await startServer();
}, 120_000);
afterAll(async () => {
  await s?.stop();
}, 60_000);

async function giveCub(acc: Account, level: number, honor: number): Promise<string> {
  return s.repos.db.transaction(async (tx) => {
    const n = (await s.repos.creatures.party(tx, acc.id)).length;
    const rec = await s.repos.creatures.insert(tx, newCreature(content, 'dustcub', level, { ownerId: acc.id }), { kind: 'party', index: n });
    await s.repos.creatures.update(tx, { ...(rec as unknown as CreatureInstance), honor });
    return rec.id;
  });
}

describe('the honor split evolves by the persisted ledger', () => {
  it('honor ≥ 0 → lawlander and below → badlander, whichever branch was asked; below 30 is notReady', async () => {
    const acc = await register(s);
    const lawful = await giveCub(acc, 30, 3);
    const a = await api(s, 'POST', `/creature/${lawful}/evolve`, acc.access, { into: 'badlander' });
    expect(a.status).toBe(200);
    expect(a.body.speciesId).toBe('lawlander');
    expect(a.body.honor).toBe(3);

    const outlaw = await giveCub(acc, 31, -2);
    const b = await api(s, 'POST', `/creature/${outlaw}/evolve`, acc.access, { into: 'lawlander' });
    expect(b.status).toBe(200);
    expect(b.body.speciesId).toBe('badlander');

    const young = await giveCub(acc, 29, 5);
    expect((await api(s, 'POST', `/creature/${young}/evolve`, acc.access, { into: 'lawlander' })).body.code).toBe('notReady');
    // the dex records the branch it became
    const dex = await s.repos.db.transaction((tx) => s.repos.progress.dex(tx, acc.id));
    expect(dex.caught).toEqual(expect.arrayContaining(['lawlander', 'badlander']));
  });
});
