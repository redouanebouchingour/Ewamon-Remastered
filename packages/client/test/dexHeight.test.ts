/** The dex entry's height chip: the viewed form's height (the species' when it names none), an alpha's 1.12 ×. */
import { describe, expect, it } from 'vitest';
import { SPECIES } from '@ewa/content';
import { formsOf } from '@ewa/core';
import { creatureHeightM, formatHeight } from '../src/screens/dex/DexEntry';

const sp = (id: string) => SPECIES.find((s) => s.id === id)!;

describe('dex height', () => {
  it('formats two decimals under a metre, one above', () => {
    expect(formatHeight(0.25)).toBe('0.25 m');
    expect(formatHeight(0.5)).toBe('0.5 m');
    expect(formatHeight(1.2)).toBe('1.2 m');
    expect(formatHeight(2)).toBe('2.0 m');
  });

  it("shows the species', the taller form's and an alpha's height", () => {
    const hyoryu = sp('hyoryu');
    const majin = formsOf(hyoryu).find((f) => f.id === 'majin')!;
    expect(creatureHeightM(hyoryu, null, false)).toBe(hyoryu.heightM);
    expect(creatureHeightM(hyoryu, majin, false)).toBe(majin.heightM);
    expect(creatureHeightM(hyoryu, null, true)).toBeCloseTo(hyoryu.heightM * 1.12, 9);
    // a relic form with no height of its own keeps the species'
    const ravatar = sp('ravatar');
    const water = formsOf(ravatar).find((f) => f.id === 'water')!;
    expect(creatureHeightM(ravatar, water, false)).toBe(ravatar.heightM);
  });
});
