// @vitest-environment jsdom
/**
 * Animated dex thumbnails (2026-10-27): every sprite whose front plays a flipbook in the shipped manifest has
 * `public/dex-anim/<id>.webp`, a looping animated WebP with one page per flipbook page; `CreatureSprite animated` draws
 * it in place of the still (never for a silhouette, never for a still species), and falls back to the still when it
 * fails to load.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { animatedFronts } from '../src/data/thumbs';
import { CreatureSprite } from '../src/ui/CreatureSprite';

const PUBLIC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const manifest = JSON.parse(readFileSync(path.join(PUBLIC, 'creatures', 'creatures.manifest.json'), 'utf8')) as {
  sprites: Record<string, { anim?: { front?: { frames: readonly unknown[] } } }>;
};

/** Pages of an animated WebP: the ANMF chunks of its RIFF body. */
function webpPages(bytes: Buffer): number {
  let n = 0;
  for (let i = 12; i + 8 <= bytes.length; ) {
    const tag = bytes.toString('ascii', i, i + 4);
    const size = bytes.readUInt32LE(i + 4);
    if (tag === 'ANMF') n++;
    i += 8 + size + (size % 2);
  }
  return n;
}

describe('animated dex thumbnails', () => {
  it('every animated front has its dex thumb, one page per flipbook page, and no still species has one', () => {
    const ids = [...animatedFronts(manifest.sprites)].sort();
    expect(ids).toEqual(['astaroth', 'bankaiser', 'galaxion', 'glacinid', 'lumyth', 'noxmyth', 'raikitsune', 'sunjaw', 'voidraxis', 'voltaura', 'zenryu']);
    for (const id of ids) {
      const file = path.join(PUBLIC, 'dex-anim', `${id}.webp`);
      expect(existsSync(file), file).toBe(true);
      expect(webpPages(readFileSync(file)), id).toBe(manifest.sprites[id]!.anim!.front!.frames.length);
    }
    for (const id of ['hyoryu', 'elemutt', 'katamute', 'zenryu_majin', 'bramblecub']) expect(existsSync(path.join(PUBLIC, 'dex-anim', `${id}.webp`)), id).toBe(false);
  });

  describe('CreatureSprite animated', () => {
    beforeAll(() => {
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => manifest })));
    });
    afterAll(() => {
      vi.unstubAllGlobals();
    });

    it('draws the animated thumb for an animated species, the still otherwise, and falls back to the still on an error', async () => {
      const { container, rerender } = render(<CreatureSprite speciesId="zenryu" size="xxl" animated />);
      await waitFor(() => expect(container.querySelector('img')?.getAttribute('src')).toBe('/dex-anim/zenryu.webp'));
      // without the prop (the party strip, the HUD) the still
      rerender(<CreatureSprite speciesId="zenryu" size="xxl" />);
      expect(container.querySelector('img')!.getAttribute('src')).toBe('/creatures/thumbs/zenryu_front.webp');
      // a still species stays still; a silhouette never moves
      rerender(<CreatureSprite speciesId="hyoryu" size="xxl" animated />);
      expect(container.querySelector('img')!.getAttribute('src')).toBe('/creatures/thumbs/hyoryu_front.webp');
      rerender(<CreatureSprite speciesId="zenryu" size="xxl" animated silhouette />);
      expect(container.querySelector('img')!.getAttribute('src')).toBe('/creatures/thumbs/zenryu_front.webp');
      // a form without a flipbook (zenryu's Majin form) shows its own still
      rerender(<CreatureSprite speciesId="zenryu" form="majin" size="xxl" animated />);
      expect(container.querySelector('img')!.getAttribute('src')).toBe('/creatures/thumbs/zenryu_majin_front.webp');
      // the animated file fails: the still
      rerender(<CreatureSprite speciesId="galaxion" size="xxl" animated />);
      const img = container.querySelector('img')!;
      expect(img.getAttribute('src')).toBe('/dex-anim/galaxion.webp');
      fireEvent.error(img);
      expect(container.querySelector('img')!.getAttribute('src')).toBe('/creatures/thumbs/galaxion_front.webp');
    });
  });
});
