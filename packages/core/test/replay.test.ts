/**
 * §2.21 replayBattle: a battle from its createBattle input and the recorded choices reproduces every per-step digest
 * of the original run (the fuzz records), the final digest, and the same events; a choice after the end throws.
 */
import { describe, expect, it } from 'vitest';
import { canonicalJson, replayBattle } from '../src/index';
import { buildLegacyContent } from './fixtures/legacyContent';
import { fuzzBattles, fuzzOpts } from './fuzz';

const content = buildLegacyContent();
const SEEDS = 60;

describe('§2.21 replayBattle', () => {
  const run = fuzzBattles({ seeds: SEEDS, content, maxTurns: 200 });

  it('reproduces every step digest of the fuzz records from the createBattle input and the choices', () => {
    for (const rec of run.records) {
      const { opts } = fuzzOpts(rec.seed, content);
      const r = replayBattle(opts, rec.actions, content);
      expect([r.start.digest, ...r.steps.map((s) => s.digest)]).toEqual(rec.turnDigests);
      expect(r.finalDigest).toBe(rec.turnDigests[rec.turnDigests.length - 1]);
      expect(r.steps.length).toBe(rec.actions.length);
      expect(r.steps.at(-1)?.state.ended ?? r.start.state.ended).not.toBeNull();
    }
  });

  it('is pure: two runs give the same states and events', () => {
    const rec = run.records[7]!;
    const { opts } = fuzzOpts(rec.seed, content);
    const a = replayBattle(opts, rec.actions, content);
    const b = replayBattle(opts, rec.actions, content);
    expect(canonicalJson(a)).toBe(canonicalJson(b));
  });

  it('throws on a choice after the battle ended', () => {
    const rec = run.records[3]!;
    const { opts } = fuzzOpts(rec.seed, content);
    expect(() => replayBattle(opts, [...rec.actions, [null, null]], content)).toThrow();
  });
});
