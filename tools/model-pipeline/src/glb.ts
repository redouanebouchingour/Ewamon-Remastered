/**
 * I/O: the one `NodeIO` (ALL_EXTENSIONS + meshopt encoder/decoder), and a GLB writer that can leave images
 * EXTERNAL.
 *
 * `NodeIO.writeBinary` embeds every image into the BIN chunk (`createImageData` pushes a bufferView in GLB mode).
 * SPEC §40.2.6 wants the legendary LOD1 to "reuse the KTX2 by url via KHR_texture_basisu + external uri next to
 * it, so textures are not written twice". So the legendary GLBs are written through `writeJSON({ format: GLTF })`
 * — which gives each texture its `uri` (the `Texture.getURI()` we set) and the geometry buffer as one resource —
 * and packed into a GLB here exactly as `writeBinary` packs it (12-byte header, JSON chunk padded with spaces,
 * BIN chunk padded with zeros), with buffer 0's `uri` removed so it is the BIN chunk. Looks (no textures) use
 * `writeBinary` itself.
 */
import { Format, Logger, NodeIO } from '@gltf-transform/core';
import type { Document, JSONDocument } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

let ioPromise: Promise<NodeIO> | null = null;

/** The pipeline's `NodeIO`: every extension, meshopt encoder (write) and decoder (read) registered; warnings only. */
export function createIO(): Promise<NodeIO> {
  ioPromise ??= (async () => {
    await MeshoptEncoder.ready;
    await MeshoptDecoder.ready;
    return new NodeIO()
      .setLogger(new Logger(Logger.Verbosity.WARN))
      .registerExtensions(ALL_EXTENSIONS)
      .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  })();
  return ioPromise;
}

const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

function pad4(data: Uint8Array, fill: number): Uint8Array {
  const n = Math.ceil(data.byteLength / 4) * 4;
  if (n === data.byteLength) return data;
  const out = new Uint8Array(n).fill(fill);
  out.set(data, 0);
  return out;
}

/** Packs a glTF JSON + optional BIN buffer into GLB bytes (the layout `NodeIO.writeBinary` produces). */
export function packGlb(json: unknown, bin: Uint8Array | null): Uint8Array {
  const jsonBytes = pad4(new TextEncoder().encode(JSON.stringify(json)), 0x20);
  const binBytes = bin && bin.byteLength ? pad4(bin, 0) : null;
  const total = 12 + 8 + jsonBytes.byteLength + (binBytes ? 8 + binBytes.byteLength : 0);
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, GLB_MAGIC, true);
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  dv.setUint32(12, jsonBytes.byteLength, true);
  dv.setUint32(16, CHUNK_JSON, true);
  out.set(jsonBytes, 20);
  if (binBytes) {
    const o = 20 + jsonBytes.byteLength;
    dv.setUint32(o, binBytes.byteLength, true);
    dv.setUint32(o + 4, CHUNK_BIN, true);
    out.set(binBytes, o + 8);
  }
  return out;
}

/** Parses the JSON chunk of a GLB (tests and the manifest inspect the written file, not the document). */
export function readGlbJson(glb: Uint8Array): Record<string, unknown> {
  const dv = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
  if (dv.getUint32(0, true) !== GLB_MAGIC) throw new Error('not a GLB (magic)');
  const len = dv.getUint32(12, true);
  if (dv.getUint32(16, true) !== CHUNK_JSON) throw new Error('GLB without a JSON chunk');
  return JSON.parse(new TextDecoder().decode(glb.subarray(20, 20 + len))) as Record<string, unknown>;
}

export interface GlbWithImages {
  readonly glb: Uint8Array;
  /** External image uri → bytes (written next to the GLB by the caller). */
  readonly images: ReadonlyMap<string, Uint8Array>;
}

/**
 * Writes `doc` as a GLB whose images stay external under their `Texture.getURI()`. Every texture must carry a
 * uri. With no textures this equals `io.writeBinary(doc)` byte for byte (asserted in `test/io.test.ts`).
 */
export async function writeGlbExternalImages(io: NodeIO, doc: Document): Promise<GlbWithImages> {
  const root = doc.getRoot();
  if (root.listBuffers().length > 1) throw new Error('GLB must have 0–1 buffers');
  for (const t of root.listTextures()) if (!t.getURI()) throw new Error(`texture "${t.getName()}" has no uri; external images need one`);
  const bufferUri = '__ewa_glb_bin__.bin';
  for (const b of root.listBuffers()) b.setURI(bufferUri);
  const { json, resources }: JSONDocument = await io.writeJSON(doc, { format: Format.GLTF, basename: '__ewa_glb_bin__' });
  for (const b of root.listBuffers()) b.setURI('');
  let bin: Uint8Array | null = null;
  for (const bd of json.buffers ?? []) {
    if (bd.uri === bufferUri) {
      if (json.buffers!.indexOf(bd) !== 0) throw new Error('geometry buffer is not buffer 0');
      bin = resources[bufferUri] ?? null;
      delete bd.uri;
    }
  }
  const images = new Map<string, Uint8Array>();
  for (const im of json.images ?? []) {
    if (!im.uri) throw new Error('image without uri after writeJSON');
    const data = resources[im.uri];
    if (!data) throw new Error(`image ${im.uri}: no resource data`);
    images.set(im.uri, data);
  }
  return { glb: packGlb(json, bin), images };
}
