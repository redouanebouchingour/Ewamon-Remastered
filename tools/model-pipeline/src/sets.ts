/**
 * The two input sets (SPEC §40.2.1) and their per-set rules (§40.2.3): ids, file discovery, the clip lists.
 * The Quaternius set is validated against `@ewa/content` `LOOKS` (the look vocabulary every NPC/trainer/body
 * draws from), so a missing or extra character fails the build with its id (§40.0.2 rule 3).
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { LOOKS } from '@ewa/content';

export const LEGENDARY_IDS = ['lumyth', 'noxmyth', 'voidraxis', 'zenryu'] as const;
export type LegendaryId = (typeof LEGENDARY_IDS)[number];

/** §40.2.3: the legendaries' single source clip (`Animation`) is renamed `idle`. */
export const LEGENDARY_CLIP = 'idle';

/**
 * §40.2.3: the 7 Quaternius clips kept (source name → shipped lower-case name); the other 10 are detached and
 * pruned. `idle/walk/run` for the overworld (§10.7.7), `victory/defeat` for battle staging, `sitdown/standup`
 * for the healer bench.
 */
export const KEPT_CLIPS: Readonly<Record<string, string>> = Object.freeze({
  Idle: 'idle',
  Walk: 'walk',
  Run: 'run',
  Victory: 'victory',
  Defeat: 'defeat',
  SitDown: 'sitdown',
  StandUp: 'standup',
});
export const KEPT_CLIP_NAMES: readonly string[] = Object.freeze(Object.values(KEPT_CLIPS).sort());

/** §40.2.5: look ids are the snake_case of the file stem (`BlueSoldier_Male` → `blue_soldier_male`). */
export function lookIdFromStem(stem: string): string {
  return stem
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

export interface SourceFile {
  readonly set: 'legendary' | 'look';
  readonly id: string;
  readonly file: string;
}

/** Every input, legendaries then looks, each sorted by id. Throws with the offending id on any mismatch. */
export function listSources(srcDir: string, looks: readonly string[] = LOOKS): SourceFile[] {
  const out: SourceFile[] = [];
  const legDir = join(srcDir, 'legendaries');
  const lookDir = join(srcDir, 'quaternius');
  for (const d of [legDir, lookDir]) {
    if (!existsSync(d)) throw new Error(`[model-pipeline] input directory missing: ${d} (assets-src/models is git-ignored; see assets-src/README.md)`);
  }
  for (const id of LEGENDARY_IDS) {
    const file = join(legDir, `${id}.glb`);
    if (!existsSync(file)) throw new Error(`[model-pipeline] legendary ${id}: ${file} not found`);
    out.push({ set: 'legendary', id, file });
  }
  const found = new Map<string, string>();
  for (const name of readdirSync(lookDir).sort()) {
    const m = /^(.+)\.(gltf|glb)$/i.exec(name);
    if (!m) continue;
    const id = lookIdFromStem(m[1]!);
    if (found.has(id)) throw new Error(`[model-pipeline] look ${id}: two source files (${found.get(id)}, ${name})`);
    found.set(id, join(lookDir, name));
  }
  const want = new Set(looks);
  const extra = [...found.keys()].filter((id) => !want.has(id)).sort();
  const missing = [...want].filter((id) => !found.has(id)).sort();
  if (extra.length) throw new Error(`[model-pipeline] look(s) ${extra.join(', ')} in assets-src/models/quaternius are not in @ewa/content LOOKS`);
  if (missing.length) throw new Error(`[model-pipeline] look(s) ${missing.join(', ')} from @ewa/content LOOKS have no source in assets-src/models/quaternius`);
  for (const id of [...found.keys()].sort()) out.push({ set: 'look', id, file: found.get(id)! });
  return out;
}
