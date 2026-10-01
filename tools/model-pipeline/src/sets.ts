/**
 * The input set (SPEC §40.2.1) and its per-set rules (§40.2.3): ids, file discovery, the clip name.
 *
 * Only the 4 legendaries are built. The 19 Quaternius character looks were dropped when the player/NPC
 * characters became pixel-art sprites (`tools/character-pipeline` → `public/characters/`; IMPLEMENTATION-NOTES
 * M11); a `quaternius/` folder left in `assets-src/models` is ignored.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export const LEGENDARY_IDS = ['lumyth', 'noxmyth', 'voidraxis', 'zenryu'] as const;
export type LegendaryId = (typeof LEGENDARY_IDS)[number];

/** §40.2.3: the legendaries' single source clip (`Animation`) is renamed `idle`. */
export const LEGENDARY_CLIP = 'idle';

export interface SourceFile {
  readonly set: 'legendary';
  readonly id: LegendaryId;
  readonly file: string;
}

/** Every input, sorted by id. Throws with the offending id when a source is missing (§40.0.2 rule 3). */
export function listSources(srcDir: string): SourceFile[] {
  const legDir = join(srcDir, 'legendaries');
  if (!existsSync(legDir)) throw new Error(`[model-pipeline] input directory missing: ${legDir} (assets-src/models is git-ignored; see assets-src/README.md)`);
  return LEGENDARY_IDS.map((id) => {
    const file = join(legDir, `${id}.glb`);
    if (!existsSync(file)) throw new Error(`[model-pipeline] legendary ${id}: ${file} not found`);
    return { set: 'legendary' as const, id, file };
  });
}
