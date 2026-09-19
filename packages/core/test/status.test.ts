import { describe, expect, it } from 'vitest';
import { addStatus, hasStatus, majorStatus, removeStatus } from '../src/index';
import type { MajorStatus, StatusId } from '../src/index';
import { clearMajorStatus, MAJOR_STATUSES } from '../src/status';

const MAJOR: readonly MajorStatus[] = ['burn', 'poison', 'paralyze', 'sleep', 'freeze'];

describe('§2.8 status helpers', () => {
  it('addStatus refuses a second major status and returns the input unchanged', () => {
    for (const a of MAJOR) {
      const s = addStatus([], a);
      expect(s).toEqual([a]);
      for (const b of MAJOR) {
        const t = addStatus(s, b);
        expect(t).toBe(s); // same reference when blocked or already present
        expect(majorStatus(t)).toBe(a);
      }
    }
  });

  it('confuse coexists with any major status', () => {
    for (const a of MAJOR) {
      const s = addStatus(addStatus([], a), 'confuse');
      expect(s).toEqual([a, 'confuse']);
      expect(hasStatus(s, 'confuse')).toBe(true);
      expect(majorStatus(s)).toBe(a);
      const t = addStatus(addStatus([], 'confuse'), a);
      expect(t).toEqual(['confuse', a]);
    }
  });

  it('addStatus never mutates its input', () => {
    const input: StatusId[] = ['confuse'];
    const out = addStatus(input, 'burn');
    expect(input).toEqual(['confuse']);
    expect(out).toEqual(['confuse', 'burn']);
  });

  it('removeStatus is idempotent and pure', () => {
    const s: readonly StatusId[] = ['burn', 'confuse'];
    const a = removeStatus(s, 'burn');
    expect(a).toEqual(['confuse']);
    expect(removeStatus(a, 'burn')).toBe(a);
    expect(s).toEqual(['burn', 'confuse']);
    expect(removeStatus([], 'sleep')).toEqual([]);
  });

  it('majorStatus over all 64 subsets of the 6 ids never returns two and honours exclusivity when built via addStatus', () => {
    const ids: readonly StatusId[] = [...MAJOR, 'confuse'];
    for (let mask = 0; mask < 64; mask++) {
      const raw: StatusId[] = [];
      for (let i = 0; i < 6; i++) if (mask & (1 << i)) raw.push(ids[i]!);
      const m = majorStatus(raw);
      if (m === null) expect(raw.every((x) => x === 'confuse')).toBe(true);
      else expect(MAJOR).toContain(m);
      // built through addStatus, at most one major survives
      let built: readonly StatusId[] = [];
      for (const x of raw) built = addStatus(built, x);
      expect(built.filter((x) => x !== 'confuse').length).toBeLessThanOrEqual(1);
      expect(built.filter((x) => x === 'confuse').length).toBeLessThanOrEqual(1);
    }
  });

  it('hasStatus and clearMajorStatus', () => {
    expect(hasStatus(['burn'], 'burn')).toBe(true);
    expect(hasStatus(['burn'], 'poison')).toBe(false);
    expect(clearMajorStatus(['burn', 'confuse'])).toEqual(['confuse']);
    const only: readonly StatusId[] = ['confuse'];
    expect(clearMajorStatus(only)).toBe(only);
    expect(MAJOR_STATUSES).toEqual(MAJOR);
  });
});
