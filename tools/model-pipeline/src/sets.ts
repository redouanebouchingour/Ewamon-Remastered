/**
 * The two input sets (SPEC §40.2.1, amended 2026-10-05): the 4 legendaries and the KayKit "Adventurers 2.0" set
 * (`assets-src/models/kaykit-adventurers`, CC0, Kay Lousberg). The look table (`characters.ts`) is validated against
 * `@ewa/content`: its base looks must be exactly `LOOKS` and its palette variants exactly the `look:palette` pairs
 * `BODIES` asks for, so a missing or extra look fails the build with its id (§40.0.2 rule 3).
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { BODIES, LOOKS } from '@ewa/content';
import { ACCESSORIES, BASE_TEXTURES, KAYKIT_CHARACTERS, LOOK_DEFS, PALETTE_VARIANTS } from './characters.js';
import type { KayKitCharacter } from './characters.js';

export const LEGENDARY_IDS = ['lumyth', 'noxmyth', 'voidraxis', 'zenryu'] as const;
export type LegendaryId = (typeof LEGENDARY_IDS)[number];

/** §40.2.3: the legendaries' single source clip (`Animation`) is renamed `idle`. */
export const LEGENDARY_CLIP = 'idle';

/** `assets-src/models/kaykit-adventurers` (the free 2.0 zip, unpacked as downloaded). */
export const KAYKIT_DIR = 'kaykit-adventurers';
export const KAYKIT_ANIMATION_FILES = ['Rig_Medium_General.glb', 'Rig_Medium_MovementBasic.glb'] as const;

export interface SourceFile {
  readonly set: 'legendary';
  readonly id: string;
  readonly file: string;
}

/** Every file the KayKit set reads, by role (absolute paths). */
export interface KayKitSources {
  readonly characters: Readonly<Record<KayKitCharacter, string>>;
  readonly textures: Readonly<Record<string, string>>;
  readonly animations: readonly string[];
  /** Accessory id → its `.gltf` and `.bin` (the PNG it references is the class texture, not read). */
  readonly accessories: Readonly<Record<string, { readonly gltf: string; readonly bin: string }>>;
}

/** The four legendary inputs, sorted by id. Throws with the offending id when one is missing. */
export function listSources(srcDir: string): SourceFile[] {
  const legDir = join(srcDir, 'legendaries');
  if (!existsSync(legDir)) throw new Error(`[model-pipeline] input directory missing: ${legDir} (assets-src/models is git-ignored; see assets-src/README.md)`);
  return LEGENDARY_IDS.map((id) => {
    const file = join(legDir, `${id}.glb`);
    if (!existsSync(file)) throw new Error(`[model-pipeline] legendary ${id}: ${file} not found`);
    return { set: 'legendary' as const, id, file };
  });
}

/** The `look:palette` ids `BODIES` needs (bodies with a palette). */
export function bodyPaletteLooks(): string[] {
  return [...new Set(BODIES.filter((b) => b.palette !== null).map((b) => `${b.look}:${b.palette}`))].sort();
}

/** Validates the look table against `@ewa/content` (looks, body palettes) and lists the KayKit files it needs. */
export function listKayKit(srcDir: string, looks: readonly string[] = LOOKS, paletteLooks: readonly string[] = bodyPaletteLooks()): KayKitSources {
  const root = join(srcDir, KAYKIT_DIR);
  if (!existsSync(root)) throw new Error(`[model-pipeline] input directory missing: ${root} (assets-src/models is git-ignored; see assets-src/README.md)`);
  const want = new Set(looks);
  const have = Object.keys(LOOK_DEFS);
  const extra = have.filter((id) => !want.has(id)).sort();
  const missing = [...want].filter((id) => !LOOK_DEFS[id]).sort();
  if (extra.length) throw new Error(`[model-pipeline] look(s) ${extra.join(', ')} in the KayKit look table are not in @ewa/content LOOKS`);
  if (missing.length) throw new Error(`[model-pipeline] look(s) ${missing.join(', ')} from @ewa/content LOOKS have no entry in the KayKit look table`);
  const pv = Object.keys(PALETTE_VARIANTS).sort();
  const pvMissing = paletteLooks.filter((id) => !PALETTE_VARIANTS[id]);
  const pvExtra = pv.filter((id) => !paletteLooks.includes(id));
  if (pvMissing.length) throw new Error(`[model-pipeline] palette variant(s) ${pvMissing.join(', ')} used by @ewa/content BODIES have no recolour`);
  if (pvExtra.length) throw new Error(`[model-pipeline] palette variant(s) ${pvExtra.join(', ')} are not used by any @ewa/content BODIES row`);

  const need = (p: string): string => { if (!existsSync(p)) throw new Error(`[model-pipeline] KayKit source ${p} not found`); return p; };
  const characters = Object.fromEntries((Object.keys(KAYKIT_CHARACTERS) as KayKitCharacter[]).map((c) => [c, need(join(root, 'Characters', 'gltf', `${c}.glb`))])) as Record<KayKitCharacter, string>;
  const textures = Object.fromEntries(BASE_TEXTURES.map((t) => [t, need(join(root, 'Characters', 'gltf', `${t}_texture.png`))]));
  const animations = KAYKIT_ANIMATION_FILES.map((f) => need(join(root, 'Animations', 'gltf', 'Rig_Medium', f)));
  const accessories = Object.fromEntries(Object.keys(ACCESSORIES).sort().map((id) => [id, { gltf: need(join(root, 'Assets', 'gltf', `${id}.gltf`)), bin: need(join(root, 'Assets', 'gltf', `${id}.bin`)) }]));
  return { characters, textures, animations, accessories };
}
