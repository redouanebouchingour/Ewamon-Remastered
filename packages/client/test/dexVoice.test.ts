/**
 * The Dex's Listen button (audio/dexVoice.ts): every species has a cry in the shipped audio manifest (per type, two
 * clips each), so the button never comes up silent for want of a clip.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SPECIES } from '@ewa/content';
import { cryOf } from '../src/audio/dexVoice';

const manifest = JSON.parse(readFileSync(resolve(__dirname, '../public/audio/manifest.json'), 'utf8')) as { sfx: Record<string, { clips: unknown[] }> };

describe('cryOf', () => {
  it('names a shipped cry clip for every species', () => {
    for (const sp of SPECIES) {
      const { id, clip } = cryOf(sp);
      expect(manifest.sfx[id], `${sp.id}: ${id}`).toBeDefined();
      expect(manifest.sfx[id]!.clips.length).toBeGreaterThan(clip);
    }
  });
});
