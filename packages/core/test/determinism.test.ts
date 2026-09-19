/**
 * §2.20 determinism contract + the fuzz.
 *
 * 1,000 seeded random battles across all 130 species (see test/fuzz.ts for the construction), run against two
 * independently built ContentIndex instances; every per-turn digest must agree. resolveTurn is byte-identical on
 * repeated calls and never mutates its input; recorded action lists replay to the same digests from turn 0 and
 * from a mid-battle snapshot. The 1,000 per-battle digests are committed in test/fuzz-digests.json — a diff in
 * that file is the signal that battle semantics changed (§50.4.1 / §50.7).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { canonicalJson, digestBattleState, resolveTurn } from '../src/index';
import type { BattleFormat, BattleState } from '../src/index';
import { buildLegacyContent } from './fixtures/legacyContent';
import { FORMATS, buildBattle, fuzzBattles, replay } from './fuzz';
import type { FuzzResult } from './fuzz';

const SEEDS = 1000;
const MAX_TURNS = 200; // §2.20: a battle hitting it is a failure
const DIGESTS_PATH = fileURLToPath(new URL('./fuzz-digests.json', import.meta.url));

interface CommittedDigests {
  readonly seeds: number;
  readonly maxTurns: number;
  readonly note: string;
  readonly digests: readonly string[];
}

function deepFreeze<T>(v: T): T {
  if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const k of Object.keys(v as object)) deepFreeze((v as Record<string, unknown>)[k]);
  }
  return v;
}

const contentA = buildLegacyContent();
let runA: FuzzResult | null = null;
function fuzzA(): FuzzResult {
  if (runA === null) runA = fuzzBattles({ seeds: SEEDS, content: contentA, maxTurns: MAX_TURNS });
  return runA;
}

describe('§2.20 fuzz — 1,000 seeded battles', () => {
  it('every battle terminates within maxTurns, holds hp/stage/pp invariants and produces no NaN', () => {
    const r = fuzzA();
    expect(r.battles).toBe(SEEDS);
    expect(r.unfinished).toEqual([]);
    expect(r.turns).toBeGreaterThan(SEEDS); // more than one turn on average
    for (const rec of r.records) {
      expect(rec.maxHpViolation).toBeNull();
      expect(rec.turns).toBeLessThanOrEqual(MAX_TURNS);
      expect(rec.digest).toMatch(/^[0-9a-f]{8}$/);
      for (const d of rec.turnDigests) expect(d).toMatch(/^[0-9a-f]{8}$/);
    }
  });

  it('covers all five formats and every BattleOutcome kind', () => {
    const r = fuzzA();
    const formats = new Set<BattleFormat>(r.records.map((x) => x.format));
    expect([...formats].sort()).toEqual([...FORMATS].sort());
    const outcomes = new Set(r.records.map((x) => x.outcome));
    expect(outcomes.has('{"winner":0}')).toBe(true);
    expect(outcomes.has('{"winner":1}')).toBe(true);
    expect(outcomes.has('{"winner":"fled"}')).toBe(true);
    expect(outcomes.has('{"winner":"draw"}')).toBe(true);
    expect([...outcomes].some((o) => o.includes('"caught"'))).toBe(true);
    // every action kind reached resolveTurn at least once
    const kinds = new Set<string>();
    for (const rec of r.records) for (const [a0, a1] of rec.actions) for (const a of [a0, a1]) if (a !== null) kinds.add(a.kind);
    expect([...kinds].sort()).toEqual(['catch', 'flee', 'forfeit', 'item', 'move', 'switch']);
  });

  it('a second, independently built ContentIndex reproduces every per-turn digest of every battle', () => {
    const contentB = buildLegacyContent();
    expect(contentB).not.toBe(contentA);
    const a = fuzzA();
    const b = fuzzBattles({ seeds: SEEDS, content: contentB, maxTurns: MAX_TURNS });
    expect(b.turns).toBe(a.turns);
    for (let i = 0; i < SEEDS; i++) {
      const ra = a.records[i]!;
      const rb = b.records[i]!;
      expect(rb.turnDigests).toEqual(ra.turnDigests);
      expect(rb.digest).toBe(ra.digest);
      expect(canonicalJson(rb.actions)).toBe(canonicalJson(ra.actions));
    }
    expect(b.digests).toEqual(a.digests);
  });

  it('matches the committed test/fuzz-digests.json (1,000 entries) — a diff here is a semantics change', () => {
    const r = fuzzA();
    const fresh: CommittedDigests = {
      seeds: SEEDS,
      maxTurns: MAX_TURNS,
      note: 'fnv1a32 over the joined per-turn digestBattleState values of each seeded fuzz battle (test/fuzz.ts). Regenerate only for an intended semantics change and record it in the spec changelog.',
      digests: r.digests,
    };
    // Bootstrap only: the file is committed; a missing file is written once so the next run compares against it.
    if (!existsSync(DIGESTS_PATH)) writeFileSync(DIGESTS_PATH, JSON.stringify(fresh, null, 2) + '\n', 'utf8');
    const committed = JSON.parse(readFileSync(DIGESTS_PATH, 'utf8')) as CommittedDigests;
    expect(committed.seeds).toBe(SEEDS);
    expect(committed.maxTurns).toBe(MAX_TURNS);
    expect(committed.digests.length).toBe(SEEDS);
    expect(r.digests).toEqual(committed.digests);
  });
});

describe('§2.20 determinism — resolveTurn purity and replay', () => {
  it('resolveTurn called twice on the same input yields byte-identical TurnResult JSON and does not mutate the input', () => {
    let steps = 0;
    fuzzBattles({
      seeds: 120,
      content: contentA,
      maxTurns: MAX_TURNS,
      onStep: (state, actions, result) => {
        const before = canonicalJson(state);
        const frozen = deepFreeze(JSON.parse(before) as BattleState);
        const again = resolveTurn(frozen, actions, contentA); // a write to the frozen input would throw
        expect(canonicalJson(again)).toBe(canonicalJson(result));
        expect(canonicalJson(state)).toBe(before);
        expect(JSON.stringify(result.events)).not.toContain('undefined');
        steps++;
      },
    });
    expect(steps).toBeGreaterThan(200);
  });

  it('replaying the recorded actions from createBattle reproduces every digest; a snapshot at turn 7 reproduces the tail', () => {
    const r = fuzzA();
    const sample = r.records.slice(0, 50);
    for (const rec of sample) {
      expect(replay(rec, contentA)).toEqual(rec.turnDigests);
    }
    const long = r.records.filter((x) => x.actions.length >= 9).slice(0, 50);
    expect(long.length).toBeGreaterThan(10);
    for (const rec of long) {
      // rebuild the state after 7 resolveTurn calls, then continue from that snapshot (its rng is state.rng)
      let st = replayState(rec.seed, rec.actions.slice(0, 7));
      expect(digestBattleState(st)).toBe(rec.turnDigests[7]);
      const tail = replay(rec, contentA, 7, st);
      expect(tail).toEqual(rec.turnDigests.slice(8));
      st = JSON.parse(JSON.stringify(st)) as BattleState; // a serialised + revived snapshot resumes identically
      expect(replay(rec, contentA, 7, st)).toEqual(tail);
    }
  });

  it('digests are stable across engines: sfc32 + fnv1a32 only, no floating point reaches state except effectiveness/stage ratios', () => {
    const r = fuzzA();
    // Every number stored in every final state is an integer, or one of the closed effectiveness set — the
    // fuzz already rejected NaN/Infinity. Here: no fractional value anywhere in a BattleState.
    for (const rec of r.records.slice(0, 200)) {
      const st = replayState(rec.seed, rec.actions);
      expect(fractional(st)).toEqual([]);
    }
  });
});

/** The state after applying `actions` to the seeded battle from createBattle (replay() returns digests only). */
function replayState(seed: number, actions: FuzzResult['records'][number]['actions']): BattleState {
  let st = buildBattle(seed, contentA).state;
  for (const a of actions) st = resolveTurn(st, a, contentA).state;
  return st;
}

/** Paths of every non-integer number in a value. */
function fractional(v: unknown, path = '$'): string[] {
  if (typeof v === 'number') return Number.isInteger(v) ? [] : [`${path}=${v}`];
  if (Array.isArray(v)) return v.flatMap((x, i) => fractional(x, `${path}[${i}]`));
  if (v !== null && typeof v === 'object') {
    return Object.keys(v as object).flatMap((k) => fractional((v as Record<string, unknown>)[k], `${path}.${k}`));
  }
  return [];
}
