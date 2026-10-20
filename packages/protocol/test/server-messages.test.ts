/**
 * §4.4 — the ServerMessage union: one example of every variant parses (incl. chat, dm, storyBeat
 * and a handover whose seat is a SeatReservation object); malformed ones are rejected with a typed
 * reason.
 */
import { describe, expect, it } from 'vitest';
import {
  HandoverMsg,
  SERVER_MESSAGES,
  SERVER_MESSAGE_TYPES,
  SERVER_MSG,
  SeatReservationSchema,
  ServerMessageSchema,
  digestBattleState,
  parseServerMessage,
  tradeOfferHash,
} from '../src/index';
import type { SeatReservation, ServerMessage, ServerMessageType } from '../src/index';
import { ISO, U1, U2, U3, battleState, creature } from './fixtures';

const state = battleState();
const digest = digestBattleState(state);
const seat: SeatReservation = { name: 'zone', sessionId: 'sess-9', roomId: 'room-9', publicAddress: 'ws://a:2567', processId: 'p1' };
void ISO;

const EXAMPLES: { [K in ServerMessageType]: Extract<ServerMessage, { type: K }> } = {
  battleStart: { type: 'battleStart', battleId: U3, format: 'wild', seat: 0, state, events: [{ t: 'turnStart', turn: 1 }], stateDigest: digest },
  battleEvents: {
    type: 'battleEvents', battleId: U3, turn: 3,
    events: [{ t: 'moveUsed', who: { side: 0, slot: 0 }, move: 'tackle', target: { side: 1, slot: 0 }, ppLeft: 34 }, { t: 'turnEnd', turn: 3 }],
    stateDigest: digest, rng: [9, 8, 7, 6],
  },
  battleResync: { type: 'battleResync', battleId: U3, state, stateDigest: digest },
  battleEnd: {
    type: 'battleEnd', battleId: U3, outcome: { winner: 'caught', slot: 0 },
    rewards: { money: 0, items: {}, trainerExp: 10, ratingDelta: null, badge: null },
  },
  inventoryDelta: { type: 'inventoryDelta', items: { potion: 3, spark_orb: 9 }, money: 2950, creaturesAdded: [creature()], creaturesRemoved: [], creaturesUpdated: [] },
  progressionDelta: {
    type: 'progressionDelta', badges: ['bloom'], trainerExp: 120, trainerLevel: 3, rating: null, dexSeen: ['glimfin'], dexCaught: ['glimfin'],
    flags: ['met_wynn'], questProgress: [{ questId: 'first_catch', objectiveId: 'catch_one', count: 1, done: true }],
  },
  handover: { type: 'handover', roomId: 'room-9', seat, zoneId: 'mire_route', x: 3.5, z: -97.5 },
  challengeReceived: { type: 'challengeReceived', fromId: U2, fromName: 'misty', expiresInMs: 45000 },
  challengeResult: { type: 'challengeResult', targetId: U2, result: 'declined' },
  tradeUpdate: {
    type: 'tradeUpdate', tradeId: U3, phase: 'open',
    offers: [{ playerId: U1, creatureIds: [U2], money: 0, confirmed: false }, { playerId: U2, creatureIds: [], money: 500, confirmed: false }],
    offerHash: tradeOfferHash([{ playerId: U1, creatureIds: [U2], money: 0, confirmed: false }, { playerId: U2, creatureIds: [], money: 500, confirmed: false }]),
  },
  raidEvents: { type: 'raidEvents', raidId: U3, round: 2, events: [{ t: 'damage', target: { side: 1, slot: 0 }, amount: 40 }], stateDigest: digest },
  chat: { type: 'chat', id: U2, name: 'misty', text: 'hi!' },
  dm: { type: 'dm', id: 17, fromId: U2, fromName: 'misty', text: 'trade later?', sentAt: 1_758_369_600_000 },
  storyBeat: { type: 'storyBeat', beatId: 'first_witness', phase: 'start' },
  toast: { type: 'toast', level: 'warn', text: 'The way is barred. Badge required: Bloom' },
  trainerSpotted: { type: 'trainerSpotted', trainerId: 'mire_trainer_1' },
  error: { type: 'error', code: 'rateLimited', detail: null },
  rankedStatus: { type: 'rankedStatus', state: 'matched', rating: 1012, waitedMs: 0, window: 0, opponent: { name: 'misty', rating: 1040 }, reason: null },
  towerState: { type: 'towerState', phase: 'won', streak: 7, runWins: 7, best: 9, set: 1, fight: 7, picks: ['a', 'b', 'c'], reward: { money: 2500, items: { rarecandy: 1 } } },
  arenaStatus: {
    type: 'arenaStatus', state: 'matched', kind: 'ranked', waitedMs: 12_000, window: 150,
    opponent: { name: 'rival', rating: 1210 }, seat: { name: 'arena', sessionId: 'abc', roomId: 'room1' }, reason: null, detail: null,
  },
  arenaInvite: { type: 'arenaInvite', inviteId: 'inv1', fromId: U3, fromName: 'friend', rules: 'level50', expiresAt: 1_700_000_045_000 },
  arenaInviteResult: { type: 'arenaInviteResult', inviteId: 'inv1', toName: 'friend', result: 'declined' },
  arenaState: {
    type: 'arenaState', matchId: 'm1', kind: 'training', level: 50, phase: 'fighting',
    players: [{ playerId: U3, name: 'me', rating: 1000 }], foeName: 'Sparring Partner', cup: null, reason: null,
  },
};

describe('§4.4 ServerMessage', () => {
  it('lists the 23 variants of the §4.4 block (Phase D13 rankedStatus, Phase D14 towerState, the 4 arena messages, trainerSpotted), and SERVER_MSG names them', () => {
    expect(SERVER_MESSAGE_TYPES).toHaveLength(23); // + arenaStatus, arenaInvite, arenaInviteResult, arenaState, trainerSpotted
    expect(Object.keys(SERVER_MESSAGES).sort()).toEqual([...SERVER_MESSAGE_TYPES].sort());
    expect(Object.keys(EXAMPLES).sort()).toEqual([...SERVER_MESSAGE_TYPES].sort());
    for (const t of SERVER_MESSAGE_TYPES) expect(SERVER_MSG[t]).toBe(t);
  });

  for (const type of SERVER_MESSAGE_TYPES) {
    it(`parses the ${type} example through the union and the per-type schema`, () => {
      const ex = EXAMPLES[type];
      const r = ServerMessageSchema.safeParse(ex);
      expect(r.success, JSON.stringify(r.success ? null : r.error.issues)).toBe(true);
      expect(SERVER_MESSAGES[type].safeParse(ex).success).toBe(true);
      const p = parseServerMessage(ex);
      expect(p.ok).toBe(true);
      if (p.ok) expect(p.message.type).toBe(type);
    });
  }

  it('handover: seat is a SeatReservation object (unknown keys preserved for consumeSeatReservation)', () => {
    const withExtra = { ...EXAMPLES.handover, seat: { ...seat, devMode: true } };
    const r = HandoverMsg.safeParse(withExtra);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.seat).toEqual({ ...seat, devMode: true });
    expect(SeatReservationSchema.safeParse({ name: 'zone', sessionId: 's', roomId: 'r' }).success).toBe(true);
    // the old string-typed seat is refused
    expect(HandoverMsg.safeParse({ ...EXAMPLES.handover, seat: 'sess-9' }).success).toBe(false);
    expect(HandoverMsg.safeParse({ ...EXAMPLES.handover, seat: { sessionId: 's', roomId: 'r' } }).success).toBe(false); // no name
    expect(HandoverMsg.safeParse({ ...EXAMPLES.handover, zoneId: 'pallet_town' }).success).toBe(false); // not a ZoneId
    expect(HandoverMsg.safeParse({ ...EXAMPLES.handover, x: Number.NaN }).success).toBe(false);
  });

  it('rejects malformed variants with a typed reason', () => {
    const bad = parseServerMessage({ type: 'toast', level: 'fatal', text: 'x' });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.reason).toBe('invalidPayload');
    const unknown = parseServerMessage({ type: 'dialogue', lines: [] });
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.reason).toBe('unknownType');
    expect(parseServerMessage(null).ok).toBe(false);
    expect(parseServerMessage('battleStart').ok).toBe(false);
    expect(ServerMessageSchema.safeParse({ ...EXAMPLES.battleEvents, stateDigest: 'DEADBEEF' }).success).toBe(false); // uppercase hex
    expect(ServerMessageSchema.safeParse({ ...EXAMPLES.battleEvents, rng: [1, 2, 3] }).success).toBe(false);
    expect(ServerMessageSchema.safeParse({ ...EXAMPLES.error, code: 'oops' }).success).toBe(false);
    expect(ServerMessageSchema.safeParse({ ...EXAMPLES.chat, text: 'x'.repeat(121) }).success).toBe(false);
    expect(ServerMessageSchema.safeParse({ ...EXAMPLES.dm, text: 'x'.repeat(301) }).success).toBe(false);
    expect(ServerMessageSchema.safeParse({ ...EXAMPLES.storyBeat, phase: 'middle' }).success).toBe(false);
    expect(ServerMessageSchema.safeParse({ ...EXAMPLES.inventoryDelta, items: { potion: -1 } }).success).toBe(false);
    expect(ServerMessageSchema.safeParse({ ...EXAMPLES.progressionDelta, badges: ['gold'] }).success).toBe(false);
    expect(ServerMessageSchema.safeParse({ ...EXAMPLES.tradeUpdate, offers: [EXAMPLES.tradeUpdate.offers[0]] }).success).toBe(false);
  });

  it('additive optional fields: inventoryDelta.placement and challengeResult.reason (old shapes still parse)', () => {
    const c = creature();
    const placed = { ...EXAMPLES.inventoryDelta, creaturesAdded: [c], placement: { [c.id]: 'box' } };
    const r = parseServerMessage(placed);
    expect(r.ok).toBe(true);
    if (r.ok && r.message.type === 'inventoryDelta') expect(r.message.placement).toEqual({ [c.id]: 'box' });
    expect(ServerMessageSchema.safeParse({ ...placed, placement: { [c.id]: 'trade_escrow' } }).success).toBe(false);
    expect(ServerMessageSchema.safeParse(EXAMPLES.inventoryDelta).success).toBe(true); // no placement = the client's catch rule
    const failed = { type: 'challengeResult', targetId: U2, result: 'unavailable', reason: { code: 'noUsableParty', playerId: U1 } } as const;
    const f = parseServerMessage(failed);
    expect(f.ok).toBe(true);
    if (f.ok && f.message.type === 'challengeResult') expect(f.message.reason).toEqual({ code: 'noUsableParty', playerId: U1 });
    expect(ServerMessageSchema.safeParse({ ...failed, reason: { code: 'sleepy', playerId: U1 } }).success).toBe(false);
    expect(ServerMessageSchema.safeParse({ ...failed, reason: { code: 'inBattle' } }).success).toBe(false);
    expect(ServerMessageSchema.safeParse(EXAMPLES.challengeResult).success).toBe(true);
  });
});
