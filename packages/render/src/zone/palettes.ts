/**
 * SPEC §10.5.3 — `PALETTES: Record<string, Palette>`. The slice palettes `grove_mirevale` and `grove_mire` carry the
 * SPEC's grade verbatim (warm greens, night lift [0, 0.004, 0.02]); the other 19 (one per ZoneDef.palette id) are
 * authored here in the same shape. Pure data.
 */
import type { LightingPalette } from '../lighting/daycycle.js';
import { FOG_START_M } from '../lighting/fog.js';
import type { GradePalette } from '../post/grade.js';
import type { SurfaceId } from '../materials/surfaces.js';
import type { Palette } from './types.js';

type Rgb = readonly [number, number, number];

interface Row {
  readonly sky: readonly [zenith: string, horizon: string, bounce: string];
  readonly fog: readonly [night: string, noon: string];
  readonly lift: Rgb; readonly gamma: Rgb; readonly gain: Rgb; readonly nightLift: Rgb;
  readonly layers: readonly [SurfaceId, SurfaceId, SurfaceId];
  readonly plaza: SurfaceId;
  readonly tints: readonly string[];
  readonly fogDensity?: number;
}

const GROVE_GRADE_ROW = { lift: [0.01, 0.012, 0.0], gamma: [1.0, 0.98, 0.96], gain: [1.02, 1.03, 0.98], nightLift: [0.0, 0.004, 0.02] } as const;
const GROVE_TINTS = ['#ffffff', '#eef4dc', '#dfeac4', '#f6efcf', '#d2e2b0', '#e9f2c9'] as const;

const ROWS: Readonly<Record<string, Row>> = {
  grove_mirevale: { sky: ['#8fb3de', '#dfe6d6', '#5d6b3f'], fog: ['#1a2030', '#b9c7a8'], ...GROVE_GRADE_ROW, layers: ['grove_moss', 'path_gravel', 'dirt'], plaza: 'cobble', tints: GROVE_TINTS },
  grove_mire: { sky: ['#8aaed6', '#d9e2cf', '#56653a'], fog: ['#182030', '#b2c2a2'], ...GROVE_GRADE_ROW, layers: ['grove_moss', 'path_gravel', 'dirt'], plaza: 'cobble', tints: ['#ffffff', '#e6efcf', '#d4e2b2', '#eef0c8', '#c8d8a2'], fogDensity: 0.02 },

  cinder_cinderhold: { sky: ['#9aa4b8', '#e2cdb4', '#5a4a3e'], fog: ['#20141a', '#c9b3a0'], lift: [0.015, 0.006, 0.0], gamma: [0.98, 1.0, 1.03], gain: [1.05, 1.0, 0.94], nightLift: [0.02, 0.004, 0.0], layers: ['cinder_ash_soil', 'cinder_basalt', 'cinder_scoria'], plaza: 'cobble', tints: ['#ffffff', '#efe2d2', '#e0cdb8', '#f2d8c0'] },
  cinder_ash: { sky: ['#8e96a8', '#d8c2aa', '#524238'], fog: ['#1e1218', '#bda796'], lift: [0.015, 0.006, 0.0], gamma: [0.98, 1.0, 1.03], gain: [1.05, 1.0, 0.94], nightLift: [0.02, 0.004, 0.0], layers: ['cinder_ash_soil', 'cinder_basalt', 'cinder_scoria'], plaza: 'cobble', tints: ['#ffffff', '#e8dccb', '#d8c4ad'], fogDensity: 0.022 },

  salt_saltmourn: { sky: ['#86b2dc', '#e4ecee', '#6a7478'], fog: ['#141c28', '#c4d2d8'], lift: [0.0, 0.006, 0.012], gamma: [1.0, 1.0, 0.98], gain: [0.99, 1.01, 1.04], nightLift: [0.0, 0.006, 0.024], layers: ['salt_sand', 'barnacle_stone', 'wet_rock'], plaza: 'cobble', tints: ['#ffffff', '#eef2f0', '#e2e8e0', '#f4f0e0'] },
  salt_tide: { sky: ['#80acd8', '#dee8ec', '#647074'], fog: ['#121a26', '#bccad2'], lift: [0.0, 0.006, 0.012], gamma: [1.0, 1.0, 0.98], gain: [0.99, 1.01, 1.04], nightLift: [0.0, 0.006, 0.024], layers: ['salt_sand', 'barnacle_stone', 'wet_rock'], plaza: 'cobble', tints: ['#ffffff', '#e8eee8', '#dde4da'] },

  storm_stormrook: { sky: ['#6e84a2', '#c4ccd4', '#4a5058'], fog: ['#10141e', '#9eaab6'], lift: [0.004, 0.006, 0.014], gamma: [1.0, 1.0, 0.97], gain: [0.97, 1.0, 1.05], nightLift: [0.0, 0.004, 0.03], layers: ['storm_slate', 'wet_flagstone', 'grove_moss'], plaza: 'wet_flagstone', tints: ['#ffffff', '#e4ebe6', '#d6e0d8'], fogDensity: 0.022 },
  storm_galvan: { sky: ['#687e9c', '#bcc6cf', '#474d55'], fog: ['#0e121c', '#96a2ae'], lift: [0.004, 0.006, 0.014], gamma: [1.0, 1.0, 0.97], gain: [0.97, 1.0, 1.05], nightLift: [0.0, 0.004, 0.03], layers: ['storm_slate', 'wet_flagstone', 'grove_moss'], plaza: 'wet_flagstone', tints: ['#ffffff', '#e0e8e2', '#d0dad2'], fogDensity: 0.024 },

  marrow_marrowdig: { sky: ['#8fb0d4', '#ead8bc', '#7a5a40'], fog: ['#1c1410', '#d6bea0'], lift: [0.014, 0.008, 0.0], gamma: [0.98, 1.0, 1.04], gain: [1.05, 1.01, 0.93], nightLift: [0.012, 0.006, 0.01], layers: ['canyon_dust', 'marrow_sandstone', 'bone_chalk'], plaza: 'cobble', tints: ['#ffffff', '#f2e6d4', '#e8d6bc'] },
  marrow_deepcut: { sky: ['#8aaccf', '#e2cfb2', '#735438'], fog: ['#1a120e', '#ccb496'], lift: [0.014, 0.008, 0.0], gamma: [0.98, 1.0, 1.04], gain: [1.05, 1.01, 0.93], nightLift: [0.012, 0.006, 0.01], layers: ['canyon_dust', 'marrow_sandstone', 'bone_chalk'], plaza: 'cobble', tints: ['#ffffff', '#efe0cc', '#e2cdb0'] },

  vesper_vesperveil: { sky: ['#5e6690', '#b7b2c4', '#3c4034'], fog: ['#0e0e18', '#9a98a8'], lift: [0.008, 0.004, 0.016], gamma: [1.0, 1.02, 0.97], gain: [0.98, 0.99, 1.04], nightLift: [0.006, 0.0, 0.03], layers: ['grave_moss', 'lichen_stone', 'dirt'], plaza: 'cobble', tints: ['#ffffff', '#e2e6dc', '#d4dace', '#e8e0ea'], fogDensity: 0.024 },
  vesper_hollow: { sky: ['#58608a', '#aeaabe', '#383c30'], fog: ['#0c0c16', '#908ea0'], lift: [0.008, 0.004, 0.016], gamma: [1.0, 1.02, 0.97], gain: [0.98, 0.99, 1.04], nightLift: [0.006, 0.0, 0.03], layers: ['grave_moss', 'lichen_stone', 'dirt'], plaza: 'cobble', tints: ['#ffffff', '#dde2d6', '#ccd4c6'], fogDensity: 0.026 },
  vesper_observatory: { sky: ['#4c5480', '#a4a0b8', '#34382c'], fog: ['#0a0a14', '#88869a'], lift: [0.008, 0.004, 0.018], gamma: [1.0, 1.02, 0.96], gain: [0.97, 0.98, 1.05], nightLift: [0.006, 0.0, 0.034], layers: ['grave_moss', 'lichen_stone', 'dirt'], plaza: 'lichen_stone', tints: ['#ffffff', '#d8dcd2'], fogDensity: 0.026 },

  forge_forgewall: { sky: ['#8aa0bc', '#d4d0c8', '#55524c'], fog: ['#14141a', '#b4b0a8'], lift: [0.008, 0.008, 0.008], gamma: [1.0, 1.0, 1.0], gain: [1.02, 1.0, 0.98], nightLift: [0.004, 0.004, 0.02], layers: ['cinder_ash_soil', 'castle_granite', 'dirt'], plaza: 'cobble', tints: ['#ffffff', '#ece8e0', '#dedad0'] },
  forge_siege: { sky: ['#8498b4', '#ccc8c0', '#504d48'], fog: ['#121218', '#aaa6a0'], lift: [0.008, 0.008, 0.008], gamma: [1.0, 1.0, 1.0], gain: [1.02, 1.0, 0.98], nightLift: [0.004, 0.004, 0.02], layers: ['cinder_ash_soil', 'castle_granite', 'dirt'], plaza: 'cobble', tints: ['#ffffff', '#e6e2da', '#d8d4ca'] },

  sky_skyrend: { sky: ['#78a8e4', '#eef2f6', '#8894a0'], fog: ['#141a28', '#d8e0ea'], lift: [0.004, 0.006, 0.012], gamma: [1.0, 1.0, 0.98], gain: [1.0, 1.01, 1.04], nightLift: [0.0, 0.004, 0.028], layers: ['snow', 'cloud_stone', 'dirt'], plaza: 'sky_marble', tints: ['#ffffff', '#eef2f4', '#e0e8ea'] },
  sky_ascent: { sky: ['#72a2e0', '#e8eef4', '#848f9c'], fog: ['#121828', '#d2dae6'], lift: [0.004, 0.006, 0.012], gamma: [1.0, 1.0, 0.98], gain: [1.0, 1.01, 1.04], nightLift: [0.0, 0.004, 0.028], layers: ['snow', 'cloud_stone', 'dirt'], plaza: 'sky_marble', tints: ['#ffffff', '#e8eef0'] },

  capital_solenne: { sky: ['#86b4e4', '#f2eadc', '#6e7048'], fog: ['#161a28', '#d8d4c4'], lift: [0.012, 0.01, 0.004], gamma: [0.99, 1.0, 1.01], gain: [1.04, 1.02, 0.97], nightLift: [0.004, 0.004, 0.024], layers: ['grove_moss', 'plaza_pale_stone', 'dirt'], plaza: 'plaza_pale_stone', tints: ['#ffffff', '#f2f0d8', '#e6ecc8', '#f8f0d0'] },

  shrine_eclipse: { sky: ['#3c4a78', '#a8b4c8', '#2e3240'], fog: ['#080a14', '#8a94a8'], lift: [0.002, 0.008, 0.016], gamma: [1.0, 0.99, 0.97], gain: [0.96, 1.0, 1.06], nightLift: [0.0, 0.008, 0.036], layers: ['eclipse_stone', 'void_floor', 'eclipse_stone'], plaza: 'eclipse_stone', tints: ['#ffffff', '#dfe6ea'] },
  shrine_spire: { sky: ['#4a5c8e', '#c0c8d8', '#383c4a'], fog: ['#0a0c18', '#a0a8ba'], lift: [0.002, 0.008, 0.016], gamma: [1.0, 0.99, 0.97], gain: [0.96, 1.0, 1.06], nightLift: [0.0, 0.008, 0.036], layers: ['eclipse_stone', 'void_floor', 'eclipse_stone'], plaza: 'eclipse_stone', tints: ['#ffffff', '#e4eaee'] },

  rift_rift: { sky: ['#2c2440', '#8a80a0', '#241e2c'], fog: ['#08060e', '#6e6680'], lift: [0.012, 0.0, 0.02], gamma: [1.0, 1.02, 0.97], gain: [0.98, 0.95, 1.06], nightLift: [0.01, 0.0, 0.04], layers: ['unmade_stone', 'void_floor', 'unmade_stone'], plaza: 'void_floor', tints: ['#ffffff', '#e0dce8'], fogDensity: 0.03 },
};

/**
 * The rows keep the SPEC's §10.3.7 density (0.018) as the reference; at the 26 m default camera distance that
 * fogs the player's feet by 37 % and flattens the diorama (part-1 note M19). The zone palettes scale it (0.27, and
 * the fog starts 15 m from the camera, §10.3.7 as amended 2026-09-30) so the haze reads on the skirt hills and the
 * far treeline, not on the plaza: ≤ 6 % at the slice's focus (grove 5.2 %, mire 5.8 %).
 */
export const FOG_SCALE = 0.27;

function toPalette(r: Row): Palette {
  return Object.freeze({
    skyZenith: r.sky[0], skyHorizon: r.sky[1], groundBounce: r.sky[2],
    fogColor: r.fog,
    grade: { lift: r.lift, gamma: r.gamma, gain: r.gain },
    terrainLayers: r.layers,
    scatterTints: r.tints,
    plaza: r.plaza,
    nightLift: r.nightLift,
    fogDensity: (r.fogDensity ?? 0.018) * FOG_SCALE,
  });
}

/** SPEC §10.5.3. Keys = every ZoneDef.palette id (21). */
export const PALETTES: Readonly<Record<string, Palette>> = Object.freeze(
  Object.fromEntries(Object.keys(ROWS).sort().map((k) => [k, toPalette(ROWS[k]!)])),
);

/** Default palette per biome when a ZoneSpec names an unknown palette id. */
const BIOME_DEFAULT: Readonly<Record<string, string>> = {
  grove: 'grove_mirevale', cinder: 'cinder_cinderhold', salt: 'salt_saltmourn', storm: 'storm_stormrook', marrow: 'marrow_marrowdig',
  vesper: 'vesper_vesperveil', forge: 'forge_forgewall', sky: 'sky_skyrend', capital: 'capital_solenne', shrine: 'shrine_eclipse', rift: 'rift_rift',
};

export function paletteFor(id: string, biome: string): Palette {
  return PALETTES[id] ?? PALETTES[BIOME_DEFAULT[biome] ?? 'grove_mirevale']!;
}

/** The lighting rig's view of a palette (§10.3.5 / §10.3.7). */
export function lightingPaletteOf(p: Palette): LightingPalette {
  return { skyZenith: p.skyZenith, skyHorizon: p.skyHorizon, groundBounce: p.groundBounce, fogColor: p.fogColor, fogDensity: p.fogDensity, fogStart: FOG_START_M, fogBase: 0, fogFalloff: 0.35 };
}

/** The post grade's view of a palette (§10.8.2). */
export function gradeOf(p: Palette): GradePalette {
  return { lift: p.grade.lift, gamma: p.grade.gamma, gain: p.grade.gain, nightLift: p.nightLift };
}
