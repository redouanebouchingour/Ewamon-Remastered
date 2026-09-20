/** §4.5 — the wire digest IS core's digest; a one-field preview difference is a mismatch. */
import { describe, expect, it } from 'vitest';
import * as core from '@ewa/core';
import {
  BattleEventsMsg,
  canonicalJson,
  digestBattleState,
  digestMatches,
  digestOf,
  fnv1a32,
  tradeOfferHash,
} from '../src/index';
import type { ServerMessage, TradeOffer } from '../src/index';
import { U1, U2, U3, battleState } from './fixtures';

describe('§4.5 digest', () => {
  it('protocol re-exports core’s functions (same references, not copies)', () => {
    expect(digestBattleState).toBe(core.digestBattleState);
    expect(canonicalJson).toBe(core.canonicalJson);
    expect(fnv1a32).toBe(core.fnv1a32);
  });

  it('is stable: 8 lowercase hex chars, identical across calls and key order', () => {
    const a = battleState();
    const d1 = digestBattleState(a);
    const d2 = digestBattleState(JSON.parse(JSON.stringify(a)) as core.BattleState);
    expect(d1).toMatch(/^[0-9a-f]{8}$/);
    expect(d1).toBe(d2);
    expect(d1).toBe(core.fnv1a32(core.canonicalJson(a)).toString(16).padStart(8, '0'));
    expect(digestOf(a)).toBe(d1);
  });

  it('a constructed battleEvents message carries digestBattleState(serverState); the client’s preview compares equal', () => {
    const server = battleState({ turn: 4 });
    const msg: ServerMessage = {
      type: 'battleEvents',
      battleId: server.id,
      turn: server.turn,
      events: [{ t: 'turnStart', turn: 4 }, { t: 'turnEnd', turn: 4 }],
      stateDigest: digestBattleState(server),
      rng: server.rng,
    };
    expect(BattleEventsMsg.safeParse(msg).success).toBe(true);
    const preview = battleState({ turn: 4 }); // independently built, same values
    expect(digestMatches(preview, msg.stateDigest)).toBe(true);
    expect(digestBattleState(preview)).toBe(msg.stateDigest);
  });

  it('a preview state with one differing field produces a mismatch', () => {
    const server = battleState();
    const digest = digestBattleState(server);
    const hpOff = battleState();
    const b = hpOff.sides[1].party[0]!;
    const preview: core.BattleState = {
      ...hpOff,
      sides: [hpOff.sides[0], { ...hpOff.sides[1], party: [{ ...b, creature: { ...b.creature, hp: b.creature.hp - 1 } }] }],
    };
    expect(digestMatches(preview, digest)).toBe(false);
    expect(digestMatches(battleState({ rng: [1, 2, 3, 5] }), digest)).toBe(false);
    expect(digestMatches(battleState({ turn: 4 }), digest)).toBe(false);
  });

  it('tradeOfferHash: 8 hex chars, order-independent, ignores `confirmed`, changes with any offer field', () => {
    const a: TradeOffer = { playerId: U1, creatureIds: [U2], money: 0, confirmed: false };
    const b: TradeOffer = { playerId: U2, creatureIds: [], money: 500, confirmed: false };
    const h = tradeOfferHash([a, b]);
    expect(h).toMatch(/^[0-9a-f]{8}$/);
    expect(tradeOfferHash([b, a])).toBe(h);
    expect(tradeOfferHash([{ ...a, confirmed: true }, { ...b, confirmed: true }])).toBe(h);
    expect(tradeOfferHash([a, { ...b, money: 501 }])).not.toBe(h);
    expect(tradeOfferHash([{ ...a, creatureIds: [U2, U3] }, b])).not.toBe(h);
    expect(tradeOfferHash([{ ...a, creatureIds: [] }, { ...b, creatureIds: [U2] }])).not.toBe(h);
  });
});
