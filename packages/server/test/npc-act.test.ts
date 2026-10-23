/**
 * NPC talk's save-touching tools, `POST /npc/act`: money moves between the player and the NPC's wallet (capped
 * at NPC_MONEY_MAX, by the wallet and by the player's money); a gift creature joins the party once per cooldown; a
 * taken creature is the lowest-level unlocked party member, never the last one; an NPC from another zone is refused;
 * a battle opens in the zone room against the villager's team.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { zone } from '@ewa/content';
import { NPC_MONEY_MAX, villagerTrainerId } from '@ewa/protocol';
import { api, enter, ofType, register, startServer, waitFor } from './helpers';
import { VILLAGER_LEVEL_UNDER, VILLAGER_TEAM_MAX } from '../src/game/villagers';
import type { TestServer } from './helpers';

let s: TestServer;
beforeAll(async () => {
  s = await startServer();
}, 120_000);
afterAll(async () => {
  await s?.stop();
}, 60_000);

const money = async (id: string): Promise<number> => (await s.repos.db.transaction((tx) => s.repos.players.byId(tx, id)))!.money;
const party = (id: string) => s.repos.db.transaction((tx) => s.repos.creatures.party(tx, id));

describe('POST /npc/act', () => {
  it('moves money both ways within the caps', async () => {
    const acc = await register(s);
    const j = await enter(s, acc, 'mirevale');
    const npcId = zone('mirevale').npcs[0]!.id;
    const act = (action: string, amount?: number) => api(s, 'POST', '/npc/act', acc.access, { npcId, action, ...(amount !== undefined ? { amount } : {}) });
    const start = await money(acc.id);

    const taken = await act('takeMoney', 400);
    expect(taken.status).toBe(200);
    expect(taken.body).toMatchObject({ money: start - 400, amount: 400 });
    const walletAfterTake = taken.body.wallet as number;

    const given = await act('giveMoney');
    expect(given.body.amount).toBe(Math.min(NPC_MONEY_MAX, walletAfterTake));
    expect(given.body.wallet).toBe(walletAfterTake - given.body.amount);
    expect(await money(acc.id)).toBe(start - 400 + given.body.amount);

    // drain the wallet: then the NPC has nothing left to give
    while ((await act('giveMoney')).status === 200);
    expect((await act('giveMoney')).body.code).toBe('npcPurseEmpty');
    // taking is capped by what the player has
    const all = await money(acc.id);
    await s.repos.db.transaction((tx) => s.repos.players.addMoney(tx, acc.id, -all + 150));
    expect((await act('takeMoney', 1000)).body).toMatchObject({ money: 0, amount: 150 });
    expect((await act('takeMoney')).body.code).toBe('playerBroke');

    expect((await api(s, 'POST', '/npc/act', acc.access, { npcId: zone('mire_route').npcs[0]!.id, action: 'giveMoney' })).body.code).toBe('npcNotHere');
    await j.room.leave(true);
  }, 60_000);

  it('gives a creature once per cooldown and takes the weakest unlocked one, never the last', async () => {
    const acc = await register(s);
    const j = await enter(s, acc, 'mirevale');
    const npcId = zone('mirevale').npcs[0]!.id;
    const act = (action: string) => api(s, 'POST', '/npc/act', acc.access, { npcId, action });

    // a single starter: nothing to take
    expect((await act('takeCreature')).body.code).toBe('npcCannotTake');
    const gift = await act('giveCreature');
    expect(gift.status).toBe(200);
    expect(gift.body.creaturesAdded).toHaveLength(1);
    expect((await party(acc.id)).map((c) => c.id)).toContain(gift.body.creaturesAdded[0].id);
    expect((await act('giveCreature')).body.code).toBe('npcNoCreature');

    const before = await party(acc.id);
    const weakest = [...before].sort((a, b) => a.level - b.level)[0]!;
    const took = await act('takeCreature');
    expect(took.body.creaturesRemoved).toEqual([weakest.id]);
    expect(await party(acc.id)).toHaveLength(before.length - 1);
    await j.room.leave(true);
  }, 60_000);

  it('opens a battle against the villager: its team a little under the player, the same every time', async () => {
    const acc = await register(s);
    const j = await enter(s, acc, 'mirevale');
    const npcId = zone('mirevale').npcs[0]!.id;
    const top = Math.max(...(await party(acc.id)).map((c) => c.level));
    const res = await api(s, 'POST', '/npc/act', acc.access, { npcId, action: 'battle' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ amount: 0, creaturesAdded: [], creaturesRemoved: [] });
    await waitFor(() => ofType(j.msgs, 'battleStart').length > 0, 8000);
    const start = ofType(j.msgs, 'battleStart')[0]!;
    expect(start.format).toBe('trainer');
    const foe = start.state.sides[1];
    expect(foe.trainerId).toBe(villagerTrainerId(npcId));
    expect(foe.party.length).toBeGreaterThanOrEqual(1);
    expect(foe.party.length).toBeLessThanOrEqual(VILLAGER_TEAM_MAX);
    for (const b of foe.party) {
      expect(top - b.creature.level).toBeGreaterThanOrEqual(0);
      expect(top - b.creature.level).toBeLessThanOrEqual(VILLAGER_LEVEL_UNDER);
    }
    // already in a battle: the room starts nothing more
    expect((await api(s, 'POST', '/npc/act', acc.access, { npcId, action: 'battle' })).body.code).toBe('inBattle');
    await j.room.leave(true);
  }, 60_000);
});
