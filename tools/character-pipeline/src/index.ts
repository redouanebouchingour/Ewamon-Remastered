/** @ewa/character-pipeline — procedural pixel-art characters (paper doll → atlas + manifest). */
export { CELL_H, CELL_W, type Facing, type Tpl } from './grid.js';
export { BASE_DY, FOOT_ROW, composeFrame, Palette, type PartDef, type PartUse, type RampSpec } from './compose.js';
export { FACINGS, FPS, CYCLE_M, STATES, frameOrder, posesFor, type Pose, type State } from './poses.js';
export { LOOK_SPECS, allLooks, variantId, SKINS, type LookSpec } from './looks.js';
export { renderLook, type Frame, type LookDef } from './sheet.js';
export {
  ATLAS_W, CHARACTERS_BUDGET_BYTES, MANIFEST_FILE, PIPELINE_VERSION, QA_DIR, REAL_OUT_DIR, STAND_M, STAND_PX,
  buildManifest, buildRasters, dirBytes, runBuild, serialize, sourceKey, type CharactersManifest, type ManifestLook,
} from './bake.js';
export { renderContactSheet } from './qa.js';
export { makeRamp, pinnedRamp, type Ramp, type RampKind } from './color.js';
