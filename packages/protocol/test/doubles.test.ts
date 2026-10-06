/**
 * Phase D6 — doubles on the wire, every field optional so singles payloads are unchanged: `BattleActionMsg.pos`,
 * the move action's `target` (a field position), `Side.actives` and `BattleState.slots` in battleStart / battleResync.
 */
import { describe, expect, it } from 'vitest';
import { BattleActionMsg, BattleActionSchema, BattleStateSchema, FieldRefSchema, SideSchema, ServerMessageSchema, digestBattleState } from '../src/index';
import { U3, battleState } from './fixtures';

describe('Phase D6 doubles payloads', () => {
  it('battleAction: optional pos (0/1) and an optional move target position', () => {
    const base = { battleId: U3, turn: 1, action: { kind: 'move', move: 'Tackle' } };
    expect(BattleActionMsg.safeParse(base).success).toBe(true);
    const full = { ...base, pos: 1, action: { kind: 'move', move: 'Tackle', target: { side: 1, pos: 0 } } };
    const r = BattleActionMsg.safeParse(full);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.pos).toBe(1);
      expect(r.data.action).toEqual({ kind: 'move', move: 'Tackle', target: { side: 1, pos: 0 } });
    }
    expect(BattleActionMsg.safeParse({ ...base, pos: 2 }).success).toBe(false);
    expect(BattleActionSchema.safeParse({ kind: 'move', move: 'Tackle', target: { side: 1, pos: 2 } }).success).toBe(false);
    expect(BattleActionSchema.safeParse({ kind: 'move', move: 'Tackle', target: { side: 2, pos: 0 } }).success).toBe(false);
    expect(FieldRefSchema.safeParse({ side: 0, pos: 1 }).success).toBe(true);
    // a singles parse output carries no new keys
    const s = BattleActionMsg.parse(base);
    expect('pos' in s).toBe(false);
    expect('target' in s.action).toBe(false);
  });

  it('Side.actives and BattleState.slots are optional; a doubles state passes battleStart', () => {
    const st = battleState();
    expect(BattleStateSchema.safeParse(st).success).toBe(true);
    const side0 = { ...st.sides[0], party: [st.sides[0].party[0]!, st.sides[0].party[0]!], actives: [0, 1] };
    expect(SideSchema.safeParse(side0).success).toBe(true);
    expect(SideSchema.safeParse({ ...side0, actives: [0] }).success).toBe(false);
    expect(SideSchema.safeParse({ ...side0, actives: [0, 6] }).success).toBe(false);
    const doubles = { ...st, slots: 2, sides: [side0, { ...side0 }] };
    expect(BattleStateSchema.safeParse(doubles).success).toBe(true);
    expect(BattleStateSchema.safeParse({ ...doubles, slots: 3 }).success).toBe(false);
    const msg = { type: 'battleStart', battleId: U3, format: 'trainer', seat: 0, state: doubles, events: [{ t: 'switchIn', who: { side: 0, slot: 1 }, pos: 1 }], stateDigest: digestBattleState(doubles as never) };
    expect(ServerMessageSchema.safeParse(msg).success).toBe(true);
    const parsedSingles = BattleStateSchema.parse(st);
    expect('slots' in parsedSingles).toBe(false);
    expect('actives' in parsedSingles.sides[0]).toBe(false);
  });
});
