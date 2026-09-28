/**
 * §50.4.7 store.test: applying progressionDelta / inventoryDelta updates exactly the named slices; a battleEvents
 * message updates no progression slice; the two delta reducers (plus hydrateFromMe) are the only writers of
 * progression/inventory — every change is recorded with its call stack and attributed.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ServerMessage } from '@ewa/protocol';
import { routeServerMessage } from '../src/net/messageRouter';
import { useNotificationsStore } from '../src/state/notifications';
import { toInventoryDelta, toProgressionDelta, useSessionStore } from '../src/state/session';
import { useUiStore } from '../src/state/ui';
import { creature, meFixture } from './fixtures';

const noHandover = { handover: async () => undefined, selfId: 'me' };

const progressionDelta = (over: Partial<Extract<ServerMessage, { type: 'progressionDelta' }>> = {}): Extract<ServerMessage, { type: 'progressionDelta' }> => ({
  type: 'progressionDelta',
  badges: null,
  trainerExp: null,
  trainerLevel: null,
  rating: null,
  dexSeen: null,
  dexCaught: null,
  flags: null,
  questProgress: null,
  ...over,
});

beforeEach(() => {
  useSessionStore.getState().clearSession();
  useNotificationsStore.getState().clear();
  useUiStore.getState().reset();
  useSessionStore.getState().hydrateFromMe(meFixture({ flags: ['met_elder'], badges: [] }));
});

describe('hydrateFromMe', () => {
  it('writes every session slice from GET /me', () => {
    const s = useSessionStore.getState();
    expect(s.profile?.username).toBe('qa_tester');
    expect(s.inventory?.money).toBe(3000);
    expect(s.inventory?.items).toEqual({ potion: 5, spark_orb: 10 });
    expect(s.inventory?.party).toHaveLength(1);
    expect(s.progression?.trainerExp).toBe(250);
    expect(s.progression?.flags).toEqual(['met_elder']);
    expect(s.zoneId).toBe('mirevale');
    expect(s.hydratedAt).toBeGreaterThan(0);
  });
});

describe('applyProgressionDelta', () => {
  it('updates exactly the named fields and leaves inventory untouched', () => {
    const before = useSessionStore.getState();
    before.applyProgressionDelta(progressionDelta({ badges: ['bloom'], trainerExp: 460, trainerLevel: 1, flags: ['beat_gym'] }));
    const after = useSessionStore.getState();
    expect(after.progression?.badges).toEqual(['bloom']);
    expect(after.progression?.trainerExp).toBe(460);
    expect(after.progression?.flags).toEqual(['met_elder', 'beat_gym']);
    expect(after.progression?.rating).toBe(before.progression?.rating);
    expect(after.progression?.dexSeen).toBe(before.progression?.dexSeen);
    expect(after.inventory).toBe(before.inventory);
    expect(after.profile).toBe(before.profile);
  });

  it('unions dex lists (caught implies seen) and upserts quest objectives', () => {
    const s = useSessionStore.getState();
    s.applyProgressionDelta(progressionDelta({ dexSeen: ['glimfin'], dexCaught: ['bramblecub'] }));
    s.applyProgressionDelta(progressionDelta({ dexSeen: ['glimfin'], questProgress: [{ questId: 'q1', objectiveId: 'o1', count: 2, done: false }] }));
    s.applyProgressionDelta(progressionDelta({ questProgress: [{ questId: 'q1', objectiveId: 'o1', count: 3, done: true }] }));
    const p = useSessionStore.getState().progression!;
    expect(p.dexSeen).toEqual(['glimfin', 'bramblecub']);
    expect(p.dexCaught).toEqual(['bramblecub']);
    expect(p.quests['q1']?.['o1']).toEqual({ count: 3, done: true });
  });
});

describe('applyInventoryDelta', () => {
  it('merges absolute item counts, drops zeros, sets money, touches no progression', () => {
    const before = useSessionStore.getState();
    before.applyInventoryDelta({ type: 'inventoryDelta', items: { potion: 0, crest_orb: 2 }, money: 2500, creaturesAdded: [], creaturesRemoved: [], creaturesUpdated: [] });
    const after = useSessionStore.getState();
    expect(after.inventory?.items).toEqual({ spark_orb: 10, crest_orb: 2 });
    expect(after.inventory?.money).toBe(2500);
    expect(after.progression).toBe(before.progression);
  });

  it('adds creatures to the party while it has room, then to the box; removes and updates by id', () => {
    const s = useSessionStore.getState();
    const lead = s.inventory!.party[0]!;
    const five = ['glimfin', 'cindercap', 'glimfin', 'cindercap', 'glimfin'].map((sp) => creature(sp));
    const overflow = creature('cindercap');
    s.applyInventoryDelta({ type: 'inventoryDelta', items: {}, money: null, creaturesAdded: [...five, overflow], creaturesRemoved: [], creaturesUpdated: [] });
    let inv = useSessionStore.getState().inventory!;
    expect(inv.party).toHaveLength(6);
    expect(inv.box.map((c) => c.id)).toEqual([overflow.id]);
    expect(inv.money).toBe(3000);
    s.applyInventoryDelta({ type: 'inventoryDelta', items: {}, money: null, creaturesAdded: [], creaturesRemoved: [five[0]!.id], creaturesUpdated: [{ ...lead, level: 6 }] });
    inv = useSessionStore.getState().inventory!;
    expect(inv.party).toHaveLength(5);
    expect(inv.party[0]!.level).toBe(6);
  });

  it('takes full party/box order from a REST response literal (reorder, withdraw)', () => {
    const extra = creature('glimfin');
    const s = useSessionStore.getState();
    s.applyInventoryDelta(toInventoryDelta({ party: [extra, s.inventory!.party[0]!], box: [] }));
    expect(useSessionStore.getState().inventory!.party.map((c) => c.id)[0]).toBe(extra.id);
  });

  it('a full REST inventory map removes items that vanished', () => {
    useSessionStore.getState().applyInventoryDelta(toInventoryDelta({ inventory: { spark_orb: 9 }, money: 2800 }));
    expect(useSessionStore.getState().inventory!.items).toEqual({ spark_orb: 9 });
  });

  it('REST dex extras flow through applyProgressionDelta', () => {
    useSessionStore.getState().applyProgressionDelta(toProgressionDelta({ dexSeen: ['glimfin'], dexCaught: [], dexVariants: { glimfin: ['dusk'] }, dexAlpha: [] }));
    expect(useSessionStore.getState().progression!.dexVariants).toEqual({ glimfin: ['dusk'] });
  });
});

describe('message routing never writes progression from battle events', () => {
  it('battleEvents / battleEnd / chat / storyBeat leave the session untouched', () => {
    const before = useSessionStore.getState();
    const msgs: ServerMessage[] = [
      {
        type: 'battleEvents',
        battleId: '33333333-3333-4333-8333-333333333333',
        turn: 1,
        events: [
          { t: 'expGain', who: { side: 0, slot: 0 }, amount: 120 } as never,
          { t: 'levelUp', who: { side: 0, slot: 0 }, level: 6 } as never,
          { t: 'catchResult', caught: true } as never,
        ],
        stateDigest: 'deadbeef',
        rng: [1, 2, 3, 4],
      },
      { type: 'battleEnd', battleId: '33333333-3333-4333-8333-333333333333', outcome: { winner: 0 } as never, rewards: { money: 500, items: { potion: 1 }, trainerExp: 10, ratingDelta: null, badge: 'bloom' } },
      { type: 'chat', id: 'x', name: 'someone', text: 'hi' },
      { type: 'storyBeat', beatId: 'b1', phase: 'complete' },
    ];
    for (const m of msgs) routeServerMessage(m, noHandover);
    const after = useSessionStore.getState();
    expect(after.progression).toBe(before.progression);
    expect(after.inventory).toBe(before.inventory);
  });

  it('progressionDelta / inventoryDelta messages reach the writers', () => {
    routeServerMessage(progressionDelta({ badges: ['bloom'] }), noHandover);
    routeServerMessage({ type: 'inventoryDelta', items: { potion: 6 }, money: 3100, creaturesAdded: [], creaturesRemoved: [], creaturesUpdated: [] }, noHandover);
    const s = useSessionStore.getState();
    expect(s.progression?.badges).toEqual(['bloom']);
    expect(s.inventory?.items['potion']).toBe(6);
    expect(s.inventory?.money).toBe(3100);
  });
});

describe('only the session writers touch progression and inventory', () => {
  const writes: { slice: 'progression' | 'inventory'; stack: string }[] = [];
  let unsubs: (() => void)[] = [];
  beforeEach(() => {
    writes.length = 0;
    unsubs = [
      useSessionStore.subscribe((s) => s.progression, () => writes.push({ slice: 'progression', stack: new Error().stack ?? '' })),
      useSessionStore.subscribe((s) => s.inventory, () => writes.push({ slice: 'inventory', stack: new Error().stack ?? '' })),
    ];
  });
  afterEach(() => unsubs.forEach((u) => u()));

  it('attributes every recorded write to hydrateFromMe / applyProgressionDelta / applyInventoryDelta / clearSession', () => {
    // a representative session: every server message type through the router + the REST literal paths
    const all: ServerMessage[] = [
      progressionDelta({ trainerExp: 300, dexSeen: ['glimfin'] }),
      { type: 'inventoryDelta', items: { potion: 4 }, money: 2900, creaturesAdded: [creature('glimfin')], creaturesRemoved: [], creaturesUpdated: [] },
      { type: 'toast', level: 'info', text: 'hello' },
      { type: 'error', code: 'notAllowed', detail: null },
      { type: 'dm', id: 1, fromId: 'x', fromName: 'friend', text: 'yo', sentAt: 1 },
      { type: 'challengeReceived', fromId: 'x', fromName: 'rival', expiresInMs: 10000 },
      { type: 'challengeResult', targetId: 'x', result: 'declined' },
      { type: 'chat', id: 'x', name: 'n', text: 't' },
    ];
    for (const m of all) routeServerMessage(m, noHandover);
    useSessionStore.getState().applyInventoryDelta(toInventoryDelta({ inventory: { potion: 3 }, money: 2750 }));
    useSessionStore.getState().hydrateFromMe(meFixture());
    useSessionStore.getState().setTokens('t', 1);
    useSessionStore.getState().setZone('mire_route');
    expect(writes.length).toBeGreaterThanOrEqual(4);
    for (const w of writes) {
      expect(w.stack).toMatch(/hydrateFromMe|applyProgressionDelta|applyInventoryDelta|clearSession/);
    }
  });
});
