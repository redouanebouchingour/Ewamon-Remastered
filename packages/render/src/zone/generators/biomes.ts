/** Aggregates the ten non-grove biome sets (one file each, SPEC §10.0.2 layout). */
import type { GeneratorSet } from '../../contracts.js';
import type { BiomeSet } from './set.js';
import { CAPITAL_SET } from './capital.js';
import { CINDER_SET } from './cinder.js';
import { FORGE_SET } from './forge.js';
import { MARROW_SET } from './marrow.js';
import { RIFT_SET } from './rift.js';
import { SALT_SET } from './salt.js';
import { SHRINE_SET } from './shrine.js';
import { SKY_SET } from './sky.js';
import { STORM_SET } from './storm.js';
import { VESPER_SET } from './vesper.js';

export const OTHER_SETS: Readonly<Record<Exclude<GeneratorSet, 'grove'>, BiomeSet>> = {
  cinder: CINDER_SET,
  salt: SALT_SET,
  storm: STORM_SET,
  marrow: MARROW_SET,
  vesper: VESPER_SET,
  forge: FORGE_SET,
  sky: SKY_SET,
  capital: CAPITAL_SET,
  shrine: SHRINE_SET,
  rift: RIFT_SET,
};
