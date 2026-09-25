/**
 * §30.6.5 / §30.11 filter.test.ts — the chat filter over the legacy blocklist: whole-word boundaries, leet
 * normalisation, separators between letters, soft-censor lengths in the original string, the DM hard reject.
 */
import { describe, expect, it } from 'vitest';
import { BLOCKED_WORDS, LEET_MAP } from '../src/chat/blocklist';
import { censor, containsBlocked, normalizeLeet, sanitizeChat } from '../src/chat/filter';

describe('blocklist data', () => {
  it('is the legacy list: lowercase, unique, letters only; the leet map is the legacy one', () => {
    expect(BLOCKED_WORDS.length).toBe(19);
    expect(new Set(BLOCKED_WORDS).size).toBe(BLOCKED_WORDS.length);
    for (const w of BLOCKED_WORDS) expect(w).toMatch(/^[a-z]+$/);
    expect(LEET_MAP).toEqual({ '3': 'e', '4': 'a', '0': 'o', '1': 'i', '@': 'a', $: 's', '!': 'i', '+': 't' });
  });
});

describe('normalizeLeet', () => {
  it('lowercases, maps leet characters, then ph → f', () => {
    expect(normalizeLeet('SH!T')).toBe('shit');
    expect(normalizeLeet('$l4Y3r')).toBe('slayer');
    expect(normalizeLeet('PHone')).toBe('fone');
  });
});

describe('containsBlocked (the two §30.6.5 cases and more)', () => {
  it("containsBlocked('f.u.c.k') === true and containsBlocked('scunthorpe') === false", () => {
    expect(containsBlocked('f.u.c.k')).toBe(true);
    expect(containsBlocked('scunthorpe')).toBe(false);
  });
  it('catches leet, separators, underscores and case; spares substrings of innocent words', () => {
    expect(containsBlocked('you $h!t')).toBe(true);
    expect(containsBlocked('B1TCH')).toBe(true);
    expect(containsBlocked('f_u_c_k this')).toBe(true);
    expect(containsBlocked('s - l - u - t')).toBe(true);
    expect(containsBlocked('shitake mushrooms')).toBe(false);
    expect(containsBlocked('classic assessment')).toBe(false);
    expect(containsBlocked('hello there')).toBe(false);
    expect(containsBlocked('')).toBe(false);
  });
});

describe('censor (soft, original string)', () => {
  it('replaces each match with * × its length in the original text and leaves the rest untouched', () => {
    expect(censor('hello world')).toBe('hello world');
    expect(censor('oh shit, run')).toBe('oh ****, run');
    expect(censor('oh $H!T run')).toBe('oh **** run');
    expect(censor('f.u.c.k off')).toBe('******* off');
    const s = 'what a b1tch and a b a s t a r d';
    const c = censor(s);
    expect(c.length).toBe(s.length);
    expect(c).toBe('what a ***** and a *************');
    expect(censor('scunthorpe united')).toBe('scunthorpe united');
  });
  it('maps ph → f spans back to both original characters', () => {
    // no blocked word contains f after ph-normalisation except fag/faggot/fuck
    expect(censor('phag')).toBe('****');
  });
});

describe('sanitizeChat', () => {
  it('strips controls and zero-width, collapses whitespace, caps at 120 (300 for DMs)', () => {
    expect(sanitizeChat(`a\u0007b\u200bc   d`)).toBe('abc d');
    expect(sanitizeChat('x'.repeat(121))).toBeNull();
    expect(sanitizeChat('x'.repeat(300), 300)).toBe('x'.repeat(300));
  });
});
