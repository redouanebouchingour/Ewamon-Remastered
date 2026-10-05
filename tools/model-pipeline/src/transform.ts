/**
 * SPEC §40.2.2 — the gltf-transform 4.5 sequence, in the SPEC's order:
 *
 *   dedup → flatten → join → prune → resample(1e-4) → weld → [simplify, LOD1 only] → reorder → quantize(14/10/12/8/8/12)
 *   → sparse → meshopt('medium') → textures (§40.2.4, applied by the caller)
 *
 * One departure (IMPLEMENTATION-NOTES M3): gltf-transform's `meshopt()` is "a thin wrapper around reorder, quantize
 * and EXTMeshoptCompression" — it runs `reorder()` + `quantize()` again with its own defaults before adding the
 * extension. After the SPEC's explicit `quantize`, the second pass re-quantizes 14-bit positions (an `Int16`
 * component is wider than 14 bits, so gltf-transform does not skip it) and clones every skin's inverse-bind
 * matrices once more. `meshoptCompression()` below is exactly the tail of `meshopt({ level: 'medium' })` — the
 * `EXT_meshopt_compression` extension, required, with the `QUANTIZE` encoder method that `'medium'` selects —
 * so the SPEC's `reorder` and `quantize` are the only ones that run.
 */
import type { Document, Transform } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { dedup, flatten, join, prune, quantize, reorder, resample, sparse, weld } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { simplifySkinned } from './simplify.js';
import type { SimplifyParams, SimplifyResult } from './simplify.js';

/** §40.2.2 quantization bits (`KHR_mesh_quantization`). */
export const QUANTIZE_BITS = Object.freeze({
  quantizePosition: 14,
  quantizeNormal: 10,
  quantizeTexcoord: 12,
  quantizeColor: 8,
  quantizeWeight: 8,
  quantizeGeneric: 12,
});
/** §40.2.2 / §40.2.3 `resample({ tolerance })`. */
export const RESAMPLE_TOLERANCE = 1e-4;
/** §40.2.2 `meshopt({ level })`. */
export const MESHOPT_LEVEL = 'medium' as const;

/** The parameters that change bytes, for the cache key. */
export const SEQUENCE_KEY = JSON.stringify({
  seq: ['dedup', 'flatten', 'join', 'prune', 'resample', 'weld', 'simplify?', 'reorder', 'quantize', 'sparse', 'meshopt'],
  quantize: QUANTIZE_BITS,
  resample: RESAMPLE_TOLERANCE,
  join: { keepNamed: false },
  reorder: { target: 'size' },
  meshopt: MESHOPT_LEVEL,
});

/** `meshopt({ encoder, level: 'medium' })` without its internal re-run of reorder + quantize (see file header). */
export function meshoptCompression(): Transform {
  const fn: Transform = (doc: Document) => {
    if (doc.getRoot().listAccessors().length === 0) return;
    doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  };
  Object.defineProperty(fn, 'name', { value: 'meshopt' });
  return fn;
}

export interface SequenceOptions {
  /** LOD1 only: skinned simplification between `weld` and `reorder` (§40.2.3). */
  readonly simplify?: SimplifyParams;
  /** Receives one row per simplified primitive. */
  readonly simplifyOut?: SimplifyResult[];
  /**
   * Characters: keep vertex attributes no material texture references. `prune()` drops them by default
   * (`keepAttributes: false`), and a KayKit shape ships its UVs without an image (the atlas is the runtime's), so its
   * TEXCOORD_0 would go. The legendaries keep the plain `prune()` (their bytes are unchanged).
   */
  readonly keepAttributes?: boolean;
}

/** Runs the §40.2.2 geometry + animation sequence on `doc` in place (textures are the caller's last step). */
export async function runSequence(doc: Document, opts: SequenceOptions = {}): Promise<void> {
  await MeshoptEncoder.ready;
  const steps: Transform[] = [
    dedup(),
    flatten(),
    join({ keepNamed: false }),
    opts.keepAttributes === true ? prune({ keepAttributes: true }) : prune(),
    resample({ tolerance: RESAMPLE_TOLERANCE }),
    weld(),
  ];
  if (opts.simplify) steps.push(simplifySkinned(opts.simplify, opts.simplifyOut));
  steps.push(
    reorder({ encoder: MeshoptEncoder, target: 'size' }),
    quantize({ ...QUANTIZE_BITS }),
    sparse(),
    meshoptCompression(),
  );
  await doc.transform(...steps);
  // quantize() adds KHR_mesh_quantization itself when any attribute was quantized; assert it for the manifest tests.
  if (!doc.getRoot().listExtensionsUsed().some((e) => e.extensionName === KHRMeshQuantization.EXTENSION_NAME)) {
    throw new Error('[model-pipeline] quantize() left no KHR_mesh_quantization — nothing was quantized');
  }
}
