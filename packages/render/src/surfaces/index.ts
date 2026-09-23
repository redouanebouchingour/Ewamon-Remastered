/**
 * `@ewa/render/surfaces` — the surface table and the bake recipes. Pure TypeScript (no three, no DOM, no node
 * builtins): the browser imports SURFACES for MaterialLibrary; tools/material-bake imports RECIPES.
 */
import type { SurfaceId } from './ids';
import type { SurfaceRecipe } from './recipe';
import { SURFACE_IDS } from './ids';
import { FILE as CAPITAL_FILE, CAPITAL_RECIPES } from './recipes/capital';
import { CINDER_RECIPES, FILE as CINDER_FILE } from './recipes/cinder';
import { FILE as FORGE_FILE, FORGE_RECIPES } from './recipes/forge';
import { FILE as GROVE_FILE, GROVE_RECIPES } from './recipes/grove';
import { FILE as MARROW_FILE, MARROW_RECIPES } from './recipes/marrow';
import { FILE as SALT_FILE, SALT_RECIPES } from './recipes/salt';
import { RIFT_RECIPES, SHRINE_RECIPES, FILE as SHRINE_FILE } from './recipes/shrine';
import { FILE as SKY_FILE, SKY_RECIPES } from './recipes/sky';
import { FILE as STORM_FILE, STORM_RECIPES } from './recipes/storm';
import { FILE as VESPER_FILE, VESPER_RECIPES } from './recipes/vesper';

export * from './ids';
export * from './recipe';
export type { MaterialClass, SurfaceDef } from './types';
export { SURFACES, WIND_AMPLITUDES } from './surfaces';

/** Recipe groups: file (relative to this directory, hashed by the bake cache) → recipes. */
const GROUPS: readonly { readonly file: string; readonly recipes: readonly SurfaceRecipe[] }[] = [
  { file: GROVE_FILE, recipes: GROVE_RECIPES },
  { file: CINDER_FILE, recipes: CINDER_RECIPES },
  { file: SALT_FILE, recipes: SALT_RECIPES },
  { file: STORM_FILE, recipes: STORM_RECIPES },
  { file: MARROW_FILE, recipes: MARROW_RECIPES },
  { file: VESPER_FILE, recipes: VESPER_RECIPES },
  { file: FORGE_FILE, recipes: FORGE_RECIPES },
  { file: SKY_FILE, recipes: SKY_RECIPES },
  { file: CAPITAL_FILE, recipes: CAPITAL_RECIPES },
  { file: SHRINE_FILE, recipes: SHRINE_RECIPES },
  { file: SHRINE_FILE, recipes: RIFT_RECIPES },
];

/** Files every recipe depends on; their text is part of every surface's cache hash. */
export const SHARED_RECIPE_FILES: readonly string[] = ['recipe.ts', 'types.ts', 'recipes/lib.ts', 'recipes/families.ts'];

function build(): { recipes: Readonly<Record<string, SurfaceRecipe>>; files: Readonly<Record<string, string>> } {
  const recipes: Record<string, SurfaceRecipe> = {};
  const files: Record<string, string> = {};
  for (const g of GROUPS) {
    for (const r of g.recipes) {
      if (recipes[r.id]) throw new Error(`RECIPES: duplicate recipe ${r.id}`);
      recipes[r.id] = r;
      files[r.id] = g.file;
    }
  }
  return { recipes: Object.freeze(recipes), files: Object.freeze(files) };
}

const BUILT = build();

/** One per SurfaceId (the bake fails if a SURFACES id has no recipe or vice versa). */
export const RECIPES: Readonly<Record<string, SurfaceRecipe>> = BUILT.recipes;
/** SurfaceId → recipe source file (relative to packages/render/src/surfaces/). */
export const RECIPE_FILES: Readonly<Record<string, string>> = BUILT.files;

/** Ids present in SURFACES but missing a recipe, and recipes with no SURFACES entry. */
export function recipeCoverage(): { readonly missing: readonly SurfaceId[]; readonly extra: readonly string[] } {
  const ids = new Set<string>(SURFACE_IDS);
  return {
    missing: SURFACE_IDS.filter((id) => !RECIPES[id]),
    extra: Object.keys(RECIPES).filter((id) => !ids.has(id)).sort(),
  };
}
