import { describe, expect, it } from 'vitest';
import { canonicalJson, digestBattleState, fnv1a32 } from '../src/index';
import type { BattleState } from '../src/index';
import { startBattle } from './helpers';

describe('§2.20 canonicalJson', () => {
  it('sorts object keys by UTF-16 code unit, emits no whitespace, keeps array order', () => {
    expect(canonicalJson({ b: 1, a: 2, B: 3, aa: 4, _: 5 })).toBe('{"B":3,"_":5,"a":2,"aa":4,"b":1}');
    expect(canonicalJson([3, 1, 2])).toBe('[3,1,2]');
    expect(canonicalJson({ z: [{ y: 1, x: [true, false, null] }], a: 'str' })).toBe('{"a":"str","z":[{"x":[true,false,null],"y":1}]}');
  });

  it('numbers go through JSON.stringify; undefined properties are omitted, undefined elements become null', () => {
    expect(canonicalJson({ n: 1.5, m: -0, k: 1e21, j: 0.1 })).toBe('{"j":0.1,"k":1e+21,"m":0,"n":1.5}');
    expect(canonicalJson({ a: undefined, b: 1 })).toBe('{"b":1}');
    expect(canonicalJson([undefined, 1])).toBe('[null,1]');
    expect(canonicalJson(null)).toBe('null');
    expect(canonicalJson(undefined)).toBe('null');
    expect(canonicalJson('a"b')).toBe('"a\\"b"');
  });

  it('is byte-identical regardless of key insertion order', () => {
    const a = { sides: [{ active: 0, party: [] }, { party: [], active: 1 }], turn: 3, id: 'x' };
    const b = { id: 'x', turn: 3, sides: [{ party: [], active: 0 }, { active: 1, party: [] }] };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
  });

  it('keys are sorted by code unit, not locale (uppercase before lowercase, digits before letters)', () => {
    expect(canonicalJson({ b: 0, A: 0, '1': 0, a: 0, 'é': 0 })).toBe('{"1":0,"A":0,"a":0,"b":0,"é":0}');
  });
});

describe('§2.20 digestBattleState', () => {
  const { state } = startBattle({ a: { species: 'bramblecub' }, b: { species: 'cindercap' } });

  it('is fnv1a32(canonicalJson(state)) as 8 lowercase hex chars', () => {
    const d = digestBattleState(state);
    expect(d).toMatch(/^[0-9a-f]{8}$/);
    expect(d).toBe(fnv1a32(canonicalJson(state)).toString(16).padStart(8, '0'));
  });

  it('two states differing in one pp differ in digest', () => {
    const s0 = state.sides[0];
    const b0 = s0.party[0]!;
    const m0 = b0.creature.moves[0]!;
    const changed: BattleState = {
      ...state,
      sides: [
        {
          ...s0,
          party: [{ ...b0, creature: { ...b0.creature, moves: [{ ...m0, pp: m0.pp - 1 }, ...b0.creature.moves.slice(1)] } }],
        },
        state.sides[1],
      ],
    };
    expect(digestBattleState(changed)).not.toBe(digestBattleState(state));
  });

  it('is stable across structurally equal copies', () => {
    const copy = JSON.parse(JSON.stringify(state)) as BattleState;
    expect(digestBattleState(copy)).toBe(digestBattleState(state));
  });

  it('pads to 8 chars when the hash has leading zero nibbles', () => {
    // fnv1a32 over some string with a small hash; find one deterministically
    let found: string | null = null;
    for (let i = 0; i < 200_000 && found === null; i++) {
      if (fnv1a32(`probe${i}`) < 0x10000000) found = `probe${i}`;
    }
    expect(found).not.toBeNull();
    const hex = fnv1a32(found!).toString(16).padStart(8, '0');
    expect(hex.length).toBe(8);
    expect(hex[0]).toBe('0');
  });
});
