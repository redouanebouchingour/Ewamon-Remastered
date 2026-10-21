/**
 * A living ecosystem: a seasonal migrant may only move into a zone whose sprite atlases already hold it. The client binds
 * a zone's static atlas set on arrival (`zoneAtlases`, planned per zone from roster-coverage.md by the sprite pipeline),
 * and a wild foe is drawn from the side atlas it lives in; a migrant outside that set would upload a fresh atlas
 * mid-battle. Checked against the shipped `public/creatures/creatures.manifest.json` for every route content can draw,
 * and the rule itself on a small inline manifest.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MIGRATION_ROUTES } from '@ewa/content';
import type { CreatureManifest } from '../src/scene/spriteCatalog';

const MANIFEST = fileURLToPath(new URL('../public/creatures/creatures.manifest.json', import.meta.url));

/** Whether a zone can show `speciesId` from the atlases it binds on arrival (both sides: a caught migrant shows its back). */
function zoneShows(m: CreatureManifest, zoneId: string, speciesId: string): boolean {
  const sp = m.sprites[speciesId];
  const bound = m.zones[zoneId] ?? [];
  return sp !== undefined && bound.includes(sp.front.atlas) && bound.includes(sp.back.atlas);
}

describe('ecosystem: migrants stay inside the target zone sprite atlases', () => {
  it('the rule: a species shows where its atlas is bound, not elsewhere', () => {
    const rect = (atlas: string) => ({ atlas, px: [0, 0, 1, 1] as const, uv: [0, 0, 1, 1] as const, footV: 0, aspect: 1 });
    const m = {
      version: 2,
      atlases: [],
      zones: { a: ['x'], b: ['y'] },
      sprites: { one: { front: rect('x'), back: rect('x'), sizeScale: 1, home: 'x' } },
    } as unknown as CreatureManifest;
    expect(zoneShows(m, 'a', 'one')).toBe(true);
    expect(zoneShows(m, 'b', 'one')).toBe(false);
    expect(zoneShows(m, 'a', 'nobody')).toBe(false);
  });

  it('every migration route content can draw is safe on the shipped manifest', () => {
    const m = JSON.parse(readFileSync(MANIFEST, 'utf8')) as CreatureManifest;
    for (const r of MIGRATION_ROUTES) expect(zoneShows(m, r.to, r.species), `${r.species} into ${r.to}`).toBe(true);
  });
});
