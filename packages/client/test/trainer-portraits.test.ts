/**
 * The profile's character picker shows one portrait per content body: a new BODIES row needs its
 * `public/trainers/<id>.webp` (`node scripts/cdp.mjs scripts/trainer-portraits.mjs`, steps in that file).
 */
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { BODIES } from '@ewa/content';
import { describe, expect, it } from 'vitest';
import { bodyPortrait } from '../src/data/trainer';

const DIR = resolve(__dirname, '../public/trainers');

describe('trainer portraits', () => {
  it('every body has its portrait, and no portrait outlives its body', () => {
    for (const b of BODIES) expect(existsSync(resolve(DIR, `${b.id}.webp`)), b.id).toBe(true);
    expect(readdirSync(DIR).sort()).toEqual(BODIES.map((b) => `${b.id}.webp`).sort());
  });

  it('bodyPortrait points at public/trainers and refuses unknown ids', () => {
    expect(bodyPortrait('ranger_m')).toBe('/trainers/ranger_m.webp');
    expect(bodyPortrait('nobody')).toBeNull();
  });
});
