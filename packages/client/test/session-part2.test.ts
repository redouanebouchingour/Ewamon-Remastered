/**
 * Part 2 session rules (server part 2 hand-off): `streak:*` login bookkeeping in `me.flags` is not story; the daily /
 * weekly `missions[]` of GET /me's synthetic quests are kept for the Battle Pass screen and a claim marks one claimed
 * through the one progression writer; a traded creature lands in the box (the server's `completeTrade` placement),
 * a caught one in the party while it has room; a fully fainted party cannot battle.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { MeResponse } from '@ewa/protocol';
import { routeServerMessage } from '../src/net/messageRouter';
import { partyCanBattle, toProgressionDelta, useSessionStore } from '../src/state/session';
import { creature, meFixture } from './fixtures';

const noHandover = { handover: async () => undefined };

const withMissions = (): MeResponse =>
  meFixture({
    flags: ['met_wynn', 'streak:3', 'streak:last:2026-09-25'],
    quests: [
      {
        id: 'daily:2026-09-25',
        progress: [
          { questId: 'daily:2026-09-25', objectiveId: 'daily-catch-one', count: 1, done: true },
          { questId: 'daily:2026-09-25', objectiveId: 'daily-wild-wins', count: 1, done: false },
        ],
        claimed: false,
        missions: [
          { id: 'daily-catch-one', title: 'Catch 1 creature', metric: 'catches', target: 1, reward: { money: 100, items: { spark_orb: 1 } }, claimed: false },
          { id: 'daily-wild-wins', title: 'Win 3 wild battles', metric: 'wildWins', target: 3, reward: { money: 150, items: {} }, claimed: false },
        ],
      } as unknown as MeResponse['quests'][number],
    ],
  });

beforeEach(() => {
  useSessionStore.getState().clearSession();
  useSessionStore.getState().hydrateFromMe(withMissions());
});

describe('session (part 2)', () => {
  it('ignores streak:* flags from GET /me and from progressionDelta', () => {
    expect(useSessionStore.getState().progression?.flags).toEqual(['met_wynn']);
    useSessionStore.getState().applyProgressionDelta({ ...toProgressionDelta({}), flags: ['streak:4', 'saw_thinning'] });
    expect(useSessionStore.getState().progression?.flags).toEqual(['met_wynn', 'saw_thinning']);
  });

  it('keeps the daily missions and marks a claimed one through applyProgressionDelta', () => {
    const m = useSessionStore.getState().progression!.missions;
    expect(m.map((x) => x.id)).toEqual(['daily-catch-one', 'daily-wild-wins']);
    expect(m[0]).toMatchObject({ questId: 'daily:2026-09-25', target: 1, reward: { money: 100, items: { spark_orb: 1 } }, claimed: false });
    useSessionStore.getState().applyProgressionDelta(toProgressionDelta({ questProgress: [], missionClaimed: { questId: 'daily:2026-09-25', missionId: 'daily-catch-one' } }));
    const after = useSessionStore.getState().progression!.missions;
    expect(after[0]!.claimed).toBe(true);
    expect(after[1]!.claimed).toBe(false);
    expect(useSessionStore.getState().progression!.quests['daily:2026-09-25']!['daily-catch-one']).toEqual({ count: 1, done: true });
  });

  it('puts a traded creature in the box and a caught one in the party (the server placements)', () => {
    const traded = creature('mossling', { level: 3 });
    const caught = creature('glimmow', { level: 4 });
    const offer = { creatureIds: [], money: 0, confirmed: true };
    routeServerMessage({ type: 'tradeUpdate', tradeId: 't1', phase: 'complete', offers: [offer, offer], offerHash: 'h' } as never, noHandover);
    routeServerMessage({ type: 'inventoryDelta', items: {}, money: 3000, creaturesAdded: [traded], creaturesRemoved: [], creaturesUpdated: [] }, noHandover);
    let inv = useSessionStore.getState().inventory!;
    expect(inv.party.map((c) => c.speciesId)).toEqual(['bramblecub']);
    expect(inv.box.map((c) => c.id)).toEqual([traded.id]);
    routeServerMessage({ type: 'inventoryDelta', items: {}, money: null, creaturesAdded: [caught], creaturesRemoved: [], creaturesUpdated: [] }, noHandover);
    inv = useSessionStore.getState().inventory!;
    expect(inv.party.map((c) => c.id)).toEqual([inv.party[0]!.id, caught.id]);
    expect(inv.box).toHaveLength(1);
  });

  it('partyCanBattle: false only when every party member has fainted', () => {
    expect(partyCanBattle(null)).toBe(true);
    const inv = useSessionStore.getState().inventory!;
    expect(partyCanBattle(inv)).toBe(true);
    expect(partyCanBattle({ ...inv, party: [creature('bramblecub', { hp: 0 })], box: [creature('mossling')] })).toBe(false);
    expect(partyCanBattle({ ...inv, party: [creature('bramblecub', { hp: 0 }), creature('mossling', { hp: 1 })] })).toBe(true);
  });
});
