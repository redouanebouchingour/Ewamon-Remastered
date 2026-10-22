/**
 * §4.3 / 50.4.3 payloads.test.ts — every one of the 22 CLIENT_MESSAGES schemas accepts its
 * documented example and rejects ≥ 3 malformed payloads (wrong type, out of range, oversize
 * string / non-uuid / missing field). Unknown keys are STRIPPED (zod v4 `z.object` default), and
 * an unknown message type is a typed 'unknownType' rejection.
 */
import { describe, expect, it } from 'vitest';
import {
  CLIENT_MESSAGES,
  CLIENT_MESSAGE_COUNT,
  CLIENT_MESSAGE_LIMITS,
  CLIENT_MESSAGE_TYPES,
  CLIENT_MSG,
  isClientMessageType,
  parseClientMessage,
  RANKED_WINDOW,
  rankedWindow,
} from '../src/index';
import type { ClientMessageType } from '../src/index';

const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';
const long = (n: number): string => 'x'.repeat(n);

interface Case {
  readonly valid: Record<string, unknown>;
  readonly invalid: readonly Record<string, unknown>[];
}

const CASES: Record<ClientMessageType, Case> = {
  input: {
    valid: { seq: 1, x: 0.5, z: 6, angle: 0.1, running: false, dtMs: 50 },
    invalid: [
      { seq: 1, x: 0.5, z: 6, angle: 0.1, running: false, dtMs: 0 }, // dtMs boundary - 1
      { seq: 1, x: 0.5, z: 6, angle: 0.1, running: false, dtMs: 101 }, // dtMs boundary + 1
      { seq: 0x1_0000_0000, x: 0, z: 0, angle: 0, running: false, dtMs: 50 }, // seq > uint32
      { seq: -1, x: 0, z: 0, angle: 0, running: false, dtMs: 50 },
      { seq: 1.5, x: 0, z: 0, angle: 0, running: false, dtMs: 50 }, // non-integer seq
      { seq: 1, x: Number.NaN, z: 0, angle: 0, running: false, dtMs: 50 }, // non-finite x
      { seq: 1, x: Number.POSITIVE_INFINITY, z: 0, angle: 0, running: false, dtMs: 50 },
      { seq: 1, x: '0', z: 0, angle: 0, running: false, dtMs: 50 }, // wrong type
      { seq: 1, x: 0, z: 0, angle: 0, running: 'yes', dtMs: 50 },
      { seq: 1, x: 0, z: 0, angle: 0, running: false }, // missing dtMs
      { seq: 1, x: 0, z: 0, angle: 0, running: false, dtMs: 50, bike: 'yes' }, // Phase D11: bike is a boolean
    ],
  },
  emote: {
    valid: { emote: 3 },
    invalid: [{ emote: 0 }, { emote: 8 }, { emote: '3' }, { emote: 2.5 }, {}],
  },
  chat: {
    valid: { text: 'hello there' },
    invalid: [{ text: '' }, { text: long(121) }, { text: 42 }, {}],
  },
  interact: {
    valid: { targetId: 'wynn', kind: 'npc' },
    invalid: [
      { targetId: '', kind: 'npc' },
      { targetId: long(65), kind: 'npc' },
      { targetId: 'wynn', kind: 'boss' }, // not in the enum
      { targetId: 7, kind: 'npc' },
      { kind: 'npc' },
    ],
  },
  engageSpawn: {
    valid: { spawnId: 'spawn-12' },
    invalid: [{ spawnId: '' }, { spawnId: long(65) }, { spawnId: null }, {}],
  },
  battleAction: {
    valid: { battleId: U1, turn: 1, action: { kind: 'move', move: 'tackle' } },
    invalid: [
      { battleId: 'not-a-uuid', turn: 1, action: { kind: 'move', move: 'tackle' } },
      { battleId: U1, turn: 0, action: { kind: 'move', move: 'tackle' } },
      { battleId: U1, turn: 1, action: { kind: 'switch', to: 6 } }, // switch.to boundary + 1
      { battleId: U1, turn: 1, action: { kind: 'switch', to: -1 } },
      { battleId: U1, turn: 1, action: { kind: 'move', move: long(41) } },
      { battleId: U1, turn: 1, action: { kind: 'item', item: 'potion', target: 6 } },
      { battleId: U1, turn: 1, action: { kind: 'catch' } }, // missing orb
      { battleId: U1, turn: 1, action: { kind: 'dance' } }, // unknown discriminant
      { battleId: U1, turn: 1, action: 'move' },
    ],
  },
  battleResync: {
    valid: { battleId: U1 },
    invalid: [{ battleId: 'nope' }, { battleId: 1 }, {}, { battleId: `${U1}0` }],
  },
  challenge: {
    valid: { targetId: U2 },
    invalid: [{ targetId: 'bob' }, { targetId: 12 }, {}],
  },
  challengeReply: {
    valid: { fromId: U2, accept: true },
    invalid: [{ fromId: 'bob', accept: true }, { fromId: U2, accept: 'yes' }, { fromId: U2 }, { accept: true }],
  },
  tradeRequest: {
    valid: { targetId: U2 },
    invalid: [{ targetId: '' }, { targetId: U2.slice(1) }, { targetId: {} }],
  },
  tradeReply: {
    valid: { tradeId: U1, accept: false },
    invalid: [{ tradeId: 'x', accept: false }, { tradeId: U1, accept: 0 }, { tradeId: U1 }],
  },
  tradeOffer: {
    valid: { tradeId: U1, creatureIds: [U2], money: 500 },
    invalid: [
      { tradeId: U1, creatureIds: new Array(7).fill(U2), money: 0 }, // length 7
      { tradeId: U1, creatureIds: ['c1'], money: 0 }, // non-uuid creature
      { tradeId: U1, creatureIds: [], money: -1 },
      { tradeId: U1, creatureIds: [], money: 1.5 },
      { tradeId: U1, creatureIds: U2, money: 0 }, // wrong type
    ],
  },
  tradeConfirm: {
    valid: { tradeId: U1, offerHash: 'deadbeef' },
    invalid: [
      { tradeId: U1, offerHash: 'deadbee' }, // length 7
      { tradeId: U1, offerHash: 'deadbeef0' }, // length 9
      { tradeId: 'nope', offerHash: 'deadbeef' },
      { tradeId: U1, offerHash: 0xdeadbeef },
    ],
  },
  tradeCancel: {
    valid: { tradeId: U1 },
    invalid: [{ tradeId: '' }, { tradeId: 5 }, {}],
  },
  raidJoin: {
    valid: { raidId: U1 },
    invalid: [{ raidId: 'raid' }, { raidId: null }, {}],
  },
  raidReady: {
    valid: { raidId: U1 },
    invalid: [{ raidId: 'raid' }, { raidId: true }, {}],
  },
  raidAction: {
    valid: { raidId: U1, round: 2, action: { kind: 'item', item: 'potion', target: 0 } },
    invalid: [
      { raidId: U1, round: 0, action: { kind: 'flee' } },
      { raidId: U1, round: 1, action: { kind: 'move', move: '' } },
      { raidId: 'x', round: 1, action: { kind: 'forfeit' } },
      { raidId: U1, round: 1 },
    ],
  },
  raidCatch: {
    valid: { raidId: U1, orb: 'spark_orb' },
    invalid: [{ raidId: U1, orb: '' }, { raidId: U1, orb: long(41) }, { raidId: 'x', orb: 'spark_orb' }, { raidId: U1 }],
  },
  raidLeave: {
    valid: { raidId: U1 },
    invalid: [{ raidId: '' }, { raidId: [] }, {}],
  },
  handoverAck: {
    valid: { roomId: 'room-abc', seat: 'sess-xyz' },
    invalid: [{ roomId: '', seat: 'sess' }, { roomId: 'room', seat: '' }, { roomId: 1, seat: 'sess' }, { roomId: 'room' }],
  },
  fastTravel: {
    valid: { zoneId: 'cinderhold' },
    invalid: [{ zoneId: 'atlantis' }, { zoneId: '' }, { zoneId: 3 }, {}],
  },
  // Phase D9: the cast heading (the server samples water along it from the player's accepted pose)
  fish: {
    valid: { angle: 1.25 },
    invalid: [{}, { angle: '1' }, { angle: Number.NaN }, { angle: Number.POSITIVE_INFINITY }],
  },
  // Phase D13: join / leave the ranked queue
  rankedQueue: {
    valid: { action: 'join' },
    invalid: [{}, { action: 'cancel' }, { action: 1 }, { action: null }],
  },
  // Phase D14: the battle tower — start with exactly three picks, next, quit
  tower: {
    valid: { action: 'start', picks: [U1, U2, 'c3'] },
    invalid: [{}, { action: 'start' }, { action: 'start', picks: [U1, U2] }, { action: 'start', picks: [U1, U2, U1, U2] }, { action: 'start', picks: [U1, U2, ''] }, { action: 'retire' }],
  },
};

describe('§4.3 CLIENT_MESSAGES', () => {
  it('has exactly 24 keys, in the spine order', () => {
    expect(Object.keys(CLIENT_MESSAGES)).toHaveLength(24);
    expect(CLIENT_MESSAGE_COUNT).toBe(24);
    expect(CLIENT_MESSAGE_TYPES).toEqual([
      'input', 'emote', 'chat', 'interact', 'engageSpawn',
      'battleAction', 'battleResync', 'challenge', 'challengeReply',
      'tradeRequest', 'tradeReply', 'tradeOffer', 'tradeConfirm', 'tradeCancel',
      'raidJoin', 'raidReady', 'raidAction', 'raidCatch', 'raidLeave',
      'handoverAck', 'fastTravel', 'fish', 'rankedQueue', 'tower',
    ]);
    expect(Object.keys(CASES).sort()).toEqual([...CLIENT_MESSAGE_TYPES].sort());
    expect(Object.keys(CLIENT_MESSAGE_LIMITS).sort()).toEqual([...CLIENT_MESSAGE_TYPES].sort());
    for (const t of CLIENT_MESSAGE_TYPES) expect(CLIENT_MSG[t]).toBe(t);
  });

  for (const type of CLIENT_MESSAGE_TYPES) {
    const c = CASES[type];
    describe(type, () => {
      it('accepts the documented valid example', () => {
        const r = CLIENT_MESSAGES[type].safeParse(c.valid);
        expect(r.success, JSON.stringify(r.success ? null : r.error.issues)).toBe(true);
        const p = parseClientMessage(type, c.valid);
        expect(p.ok).toBe(true);
        if (p.ok) {
          expect(p.message.type).toBe(type);
          expect(p.message.payload).toEqual(c.valid);
        }
      });

      it(`rejects ${c.invalid.length} malformed payloads (≥ 3) with a typed invalidPayload`, () => {
        expect(c.invalid.length).toBeGreaterThanOrEqual(3);
        for (const bad of c.invalid) {
          expect(CLIENT_MESSAGES[type].safeParse(bad).success, JSON.stringify(bad)).toBe(false);
          const p = parseClientMessage(type, bad);
          expect(p.ok).toBe(false);
          if (!p.ok) {
            expect(p.reason).toBe('invalidPayload');
            if (p.reason === 'invalidPayload') {
              expect(p.type).toBe(type);
              expect(p.issues.length).toBeGreaterThan(0);
            }
          }
        }
      });

      it('rejects non-object payloads', () => {
        for (const bad of [null, undefined, 'string', 42, [], true]) {
          expect(CLIENT_MESSAGES[type].safeParse(bad).success).toBe(false);
        }
      });

      it('STRIPS unknown keys (zod v4 z.object default)', () => {
        const r = CLIENT_MESSAGES[type].safeParse({ ...c.valid, __proto__x: 1, extra: 'ignored' });
        expect(r.success).toBe(true);
        if (r.success) expect(r.data).toEqual(c.valid);
      });
    });
  }

  it('unknown message type → typed unknownType (no handler, never invalidPayload)', () => {
    for (const t of ['progressionDelta', 'inventoryDelta', 'battleEnd', 'INPUT', '', 'constructor', 'toString', '__proto__']) {
      expect(isClientMessageType(t)).toBe(false);
      const p = parseClientMessage(t, {});
      expect(p).toEqual({ ok: false, reason: 'unknownType', type: t });
    }
    expect(parseClientMessage(undefined, {})).toEqual({ ok: false, reason: 'unknownType', type: 'undefined' });
    expect(parseClientMessage(7, {})).toEqual({ ok: false, reason: 'unknownType', type: '7' });
  });

  it('a progressionDelta-shaped object sent as a client message matches no schema', () => {
    const forged = {
      type: 'progressionDelta', badges: ['bloom'], trainerExp: 99999, trainerLevel: 100, rating: 9999,
      dexSeen: null, dexCaught: null, flags: ['badge:ascend'], questProgress: null,
    };
    expect(parseClientMessage(forged.type, forged).ok).toBe(false);
    for (const type of CLIENT_MESSAGE_TYPES) {
      expect(CLIENT_MESSAGES[type].safeParse(forged).success, type).toBe(false);
    }
  });

  it('rate-limit table matches §4.3', () => {
    expect(CLIENT_MESSAGE_LIMITS.input).toEqual({ max: 30, windowMs: 1000 });
    expect(CLIENT_MESSAGE_LIMITS.emote).toEqual({ max: 1, windowMs: 1500 });
    expect(CLIENT_MESSAGE_LIMITS.chat).toEqual({ max: 4, windowMs: 4000 });
    expect(CLIENT_MESSAGE_LIMITS.interact).toEqual({ max: 4, windowMs: 1000 });
    expect(CLIENT_MESSAGE_LIMITS.engageSpawn).toEqual({ max: 2, windowMs: 1000 });
    expect(CLIENT_MESSAGE_LIMITS.battleAction).toEqual({ max: 4, windowMs: 1000 });
    expect(CLIENT_MESSAGE_LIMITS.battleResync).toEqual({ max: 4, windowMs: 1000 });
    expect(CLIENT_MESSAGE_LIMITS.challenge).toEqual({ max: 3, windowMs: 5000 });
    expect(CLIENT_MESSAGE_LIMITS.tradeRequest).toEqual({ max: 3, windowMs: 5000 });
    for (const k of ['raidJoin', 'raidReady', 'raidAction', 'raidCatch', 'raidLeave'] as const) {
      expect(CLIENT_MESSAGE_LIMITS[k]).toEqual({ max: 4, windowMs: 1000 });
    }
    expect(CLIENT_MESSAGE_LIMITS.fish).toEqual({ max: 1, windowMs: 1500 });
    expect(CLIENT_MESSAGE_LIMITS.rankedQueue).toEqual({ max: 4, windowMs: 5000 });
    expect(CLIENT_MESSAGE_LIMITS.tower).toEqual({ max: 4, windowMs: 1000 });
  });

  it('Phase D13: the ranked window starts at ±100, widens 50 every 10 s and stops at 400', () => {
    expect(rankedWindow(0)).toBe(RANKED_WINDOW.base);
    expect(rankedWindow(9_999)).toBe(100);
    expect(rankedWindow(10_000)).toBe(150);
    expect(rankedWindow(30_000)).toBe(250);
    expect(rankedWindow(10 * 60_000)).toBe(RANKED_WINDOW.max);
    expect(rankedWindow(-5)).toBe(100);
  });

  it('Phase D10/D11: interact names obstacles; input carries an optional bike flag', () => {
    expect(CLIENT_MESSAGES.interact.safeParse({ targetId: 'mire_route.thicket', kind: 'obstacle' }).success).toBe(true);
    const ride = CLIENT_MESSAGES.input.safeParse({ seq: 2, x: 1, z: 1, angle: 0, running: false, dtMs: 50, bike: true });
    expect(ride.success && ride.data.bike).toBe(true);
  });
});
