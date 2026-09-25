/**
 * SPEC §40.2.6 / §40.6 size targets, in bytes. "MB" in the SPEC is MiB — §40.6 itself writes 35 MB as
 * 36 700 160 B. Shared by the texture-tier fit (`build.ts`) and `test/budget.test.ts`.
 */
const MiB = 1024 * 1024;

/** One legendary LOD0: its GLB plus the external textures it references. */
export const LEGENDARY_LOD0_MAX = Math.floor(1.2 * MiB);
/** One legendary LOD1 GLB (textures shared by url, not counted). */
export const LEGENDARY_LOD1_MAX = Math.floor(0.45 * MiB);
/** Σ over the 4 legendaries of (LOD0 + textures + LOD1). */
export const LEGENDARIES_TOTAL_MAX = Math.floor(6.5 * MiB);
export const LOOK_MAX = Math.floor(0.25 * MiB);
export const LOOKS_TOTAL_MAX = 5 * MiB;
/** `public/models/` (§40.6). */
export const MODELS_DIR_MAX = 12 * MiB;
