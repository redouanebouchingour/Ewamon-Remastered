/**
 * `pnpm models` — SPEC §40.2 end to end: licences checked, sources listed and validated, per-set rules, the
 * §40.2.2 sequence, the §40.2.4 textures, GLBs + `models.manifest.json` written under `public/models/`, the
 * content-hash cache consulted first, `qa/qa-report.json` written.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import type { Document } from '@gltf-transform/core';
import { cloneDocument } from '@gltf-transform/functions';
import { restPoseBounds } from './bounds.js';
import type { Bounds } from './bounds.js';
import { PIPELINE_VERSION, hashKey, pipelineSourceText, readModel, readTexture, writeModel, writeTexture } from './cache.js';
import { LEGENDARY_LOD0_MAX } from './budget.js';
import { createIO, writeGlbExternalImages } from './glb.js';
import type { GlbWithImages } from './glb.js';
import { stableJson } from './json.js';
import { probeKtx2 } from './ktx2.js';
import { MANIFEST_FILE } from './manifest.js';
import type { ModelEntry, ModelsManifest } from './manifest.js';
import { DEFAULT_CACHE_DIR, DEFAULT_OUT_DIR, ICONS_DIR, LICENSES_DIR, QA_DIR, SRC_DIR } from './paths.js';
import { REST_TRACK_EPSILON, classifyLegendaryTextures, normalLike, prepareLegendary, prepareLook, pruneRestTracks } from './prepare.js';
import type { QaFlag, TextureRole } from './prepare.js';
import { KEPT_CLIPS, LEGENDARY_IDS, listSources } from './sets.js';
import type { LegendaryId, SourceFile } from './sets.js';
import { LOD1_SIMPLIFY, SIMPLIFY_ATTRIBUTES } from './simplify.js';
import type { SimplifyResult } from './simplify.js';
import { TEXTURE_PLAN, TEXTURE_TIERS, applyTextures, encodeTexture, planKey, sha256, textureUri } from './textures.js';
import type { EncodedTexture, TextureFormat } from './textures.js';
import { SEQUENCE_KEY, runSequence } from './transform.js';

/** §40.0.2 rule 6: source → destination (relative to `public/`). */
export const LICENCE_COPIES: readonly { readonly from: string; readonly to: string }[] = Object.freeze([
  { from: 'QUATERNIUS-CREDITS.txt', to: 'models/CREDITS.txt' },
  { from: 'TABLER-LICENSE.txt', to: 'icons/TABLER-LICENSE.txt' },
]);

export interface BuildOptions {
  readonly srcDir?: string;
  readonly outDir?: string;
  readonly iconsDir?: string;
  readonly licensesDir?: string;
  readonly cacheDir?: string;
  readonly qaDir?: string | null;
  /** Ignore cache hits (entries are still rewritten). */
  readonly force?: boolean;
  /** `auto` probes the KTX2 encoder (§40.2.4) and falls back to WebP when it fails. */
  readonly textures?: 'auto' | TextureFormat;
  /** Expected look ids (defaults to `@ewa/content` LOOKS). */
  readonly looks?: readonly string[];
  /** When false nothing is written under `public/` (tests). */
  readonly write?: boolean;
  readonly log?: (s: string) => void;
}

export interface ModelQa {
  readonly id: string;
  readonly set: 'legendary' | 'look';
  readonly sourceBytes: number;
  readonly glbBytes: number;
  readonly lod1Bytes: number | null;
  readonly textureBytes: number;
  readonly triangles: number;
  readonly lod1Triangles: number | null;
  readonly lod1Error: number | null;
  readonly droppedRestTracks: number;
  readonly textureTier: number | null;
  readonly textures: readonly { readonly role: TextureRole; readonly uri: string; readonly width: number; readonly height: number; readonly bytes: number; readonly mean: readonly [number, number, number] }[];
}

export interface QaReport {
  readonly version: 1;
  readonly pipelineVersion: string;
  readonly textures: TextureFormat;
  readonly warnings: readonly string[];
  readonly flags: readonly QaFlag[];
  readonly models: readonly ModelQa[];
}

export interface BuildResult {
  readonly manifest: ModelsManifest;
  /** Every output file, keyed by its path relative to `public/models/` (the manifest included). */
  readonly files: ReadonlyMap<string, Uint8Array>;
  readonly qa: QaReport;
  readonly inputs: number;
  readonly cacheHits: number;
}

/** Model facts kept in the cache next to the GLBs. */
interface ModelMeta {
  readonly triangles: number;
  readonly clips: readonly string[];
  readonly bounds: Bounds;
  readonly lod1Triangles: number | null;
  readonly lod1Error: number | null;
  readonly droppedRestTracks: number;
  readonly flags: readonly QaFlag[];
  /** Legendaries: the `TEXTURE_TIERS` entry the LOD0 budget fit chose. */
  readonly textureTier: number | null;
  /** Legendaries: the texture cache keys and uris the GLBs reference. */
  readonly textures: readonly { readonly role: TextureRole; readonly key: string; readonly uri: string }[];
}

interface Built {
  readonly src: SourceFile;
  readonly lod0: Uint8Array;
  readonly lod1: Uint8Array | null;
  readonly meta: ModelMeta;
  readonly textures: readonly (EncodedTexture & { readonly uri: string })[];
  readonly cacheHit: boolean;
  readonly sourceBytes: number;
}

function bytesOf(buf: Buffer): Uint8Array {
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

async function readDoc(file: string, bytes: Uint8Array): Promise<Document> {
  const io = await createIO();
  return file.toLowerCase().endsWith('.glb') ? io.readBinary(bytes) : io.read(file);
}

function modelKey(src: SourceFile, bytes: Uint8Array, format: TextureFormat | null): string {
  return hashKey(
    PIPELINE_VERSION, src.set, src.id, SEQUENCE_KEY,
    JSON.stringify({ lod1: LOD1_SIMPLIFY, attrs: SIMPLIFY_ATTRIBUTES, clips: KEPT_CLIPS, restEps: REST_TRACK_EPSILON, lod0Max: LEGENDARY_LOD0_MAX }),
    format === null ? 'no-textures' : `${format};${JSON.stringify(TEXTURE_TIERS)};${JSON.stringify(TEXTURE_PLAN)}`,
    pipelineSourceText(), bytes,
  );
}

/** One classified source texture encoded at `maxSize` — from the cache when present. */
async function encodeCached(img: Uint8Array, role: TextureRole, format: TextureFormat, maxSize: number, cacheDir: string, force: boolean): Promise<{ key: string; enc: EncodedTexture }> {
  const key = hashKey(PIPELINE_VERSION, role, format, planKey(role, format, maxSize), img);
  const hit = force ? null : readTexture(cacheDir, key);
  if (hit) return { key, enc: { role, format, bytes: hit.bytes, width: hit.meta.width, height: hit.meta.height, mean: hit.meta.mean } };
  const enc = await encodeTexture(img, role, format, maxSize);
  writeTexture(cacheDir, key, enc.bytes, { role, format, width: enc.width, height: enc.height, mean: enc.mean });
  return { key, enc };
}

function sourceImages(doc: Document, id: string): { role: TextureRole; img: Uint8Array }[] {
  return classifyLegendaryTextures(doc).map(({ texture, role }) => {
    const img = texture.getImage();
    if (!img) throw new Error(`[model-pipeline] ${id}: ${role} texture has no image data`);
    return { role, img };
  });
}

async function buildLegendary(src: SourceFile, bytes: Uint8Array, format: TextureFormat, cacheDir: string, force: boolean): Promise<Built> {
  const io = await createIO();
  const key = modelKey(src, bytes, format);
  const hit = force ? null : readModel<ModelMeta>(cacheDir, key);
  if (hit) {
    const cached = hit.meta.textures.map((t) => ({ t, c: readTexture(cacheDir, t.key) }));
    if (cached.every((x) => x.c !== null)) {
      const textures = cached.map(({ t, c }) => ({ role: t.role, format, bytes: c!.bytes, width: c!.meta.width, height: c!.meta.height, mean: c!.meta.mean, uri: t.uri }));
      return { src, lod0: hit.lod0, lod1: hit.lod1, meta: hit.meta, textures, cacheHit: true, sourceBytes: bytes.byteLength };
    }
  }

  const doc = await readDoc(src.file, bytes);
  const flags: QaFlag[] = [];
  const images = sourceImages(doc, src.id);
  const shape = prepareLegendary(doc, src.id);
  const dropped = pruneRestTracks(doc);
  const bounds = restPoseBounds(doc);

  const lod0 = cloneDocument(doc);
  await runSequence(lod0);
  // §40.2.4 + IMPLEMENTATION-NOTES M1: the first texture tier whose LOD0 (GLB + textures) fits the §40.2.6 line.
  let chosen: { tier: number; texs: { key: string; enc: EncodedTexture }[]; glb: GlbWithImages; total: number } | null = null;
  const tried: string[] = [];
  for (const tier of TEXTURE_TIERS) {
    const texs: { key: string; enc: EncodedTexture }[] = [];
    for (const { role, img } of images) texs.push(await encodeCached(img, role, format, tier.maxSize[role], cacheDir, force));
    applyTextures(lod0, src.id, new Map(texs.map((t) => [t.enc.role, t.enc] as const)));
    const glb = await writeGlbExternalImages(io, lod0);
    const total = glb.glb.byteLength + texs.reduce((s, t) => s + t.enc.bytes.byteLength, 0);
    tried.push(`tier ${tier.tier}: ${total} B`);
    if (total <= LEGENDARY_LOD0_MAX) { chosen = { tier: tier.tier, texs, glb, total }; break; }
  }
  if (!chosen) throw new Error(`[model-pipeline] legendary ${src.id}: no texture tier fits the LOD0 budget ${LEGENDARY_LOD0_MAX} B (${tried.join(', ')})`);
  if (chosen.tier > 0) flags.push({ id: src.id, flag: 'texture-tier', detail: `texture tier ${chosen.tier} (${tried.join(', ')}; LOD0 budget ${LEGENDARY_LOD0_MAX} B)` });
  for (const t of chosen.texs) {
    if (t.enc.role === 'normal' && !normalLike(t.enc.mean)) flags.push({ id: src.id, flag: 'normal-suspect', detail: `texture bound as normalTexture has mean (${t.enc.mean.join(', ')}), not tangent-space-like` });
  }
  const byRole = new Map(chosen.texs.map((t) => [t.enc.role, t.enc] as const));
  const withUri = chosen.texs.map((t) => ({ ...t.enc, uri: textureUri(src.id, t.enc) }));

  const lod1 = cloneDocument(doc);
  const simp: SimplifyResult[] = [];
  await runSequence(lod1, { simplify: LOD1_SIMPLIFY, simplifyOut: simp });
  applyTextures(lod1, src.id, byRole);
  const w1 = await writeGlbExternalImages(io, lod1);

  for (const w of [chosen.glb, w1]) {
    for (const [uri, data] of w.images) {
      const t = withUri.find((x) => x.uri === uri);
      if (!t || sha256(t.bytes) !== sha256(data)) throw new Error(`[model-pipeline] ${src.id}: GLB references ${uri}, which is not the encoded texture`);
    }
  }
  const lod1Triangles = simp.reduce((s, r) => s + r.dstTriangles, 0);
  const lod1Error = Math.round(Math.max(0, ...simp.map((r) => r.error)) * 1e6) / 1e6;
  if (lod1Triangles > LOD1_SIMPLIFY.ratio * shape.triangles * 1.1) {
    flags.push({ id: src.id, flag: 'lod1-ratio', detail: `LOD1 kept ${lod1Triangles} of ${shape.triangles} triangles (target ratio ${LOD1_SIMPLIFY.ratio}); the error bound ${LOD1_SIMPLIFY.error} stopped the simplifier` });
  }
  const meta: ModelMeta = {
    triangles: shape.triangles, clips: shape.clips, bounds, lod1Triangles, lod1Error, droppedRestTracks: dropped, flags, textureTier: chosen.tier,
    textures: chosen.texs.map((t, i) => ({ role: t.enc.role, key: t.key, uri: withUri[i]!.uri })),
  };
  writeModel(cacheDir, key, { lod0: chosen.glb.glb, lod1: w1.glb, meta });
  return { src, lod0: chosen.glb.glb, lod1: w1.glb, meta, textures: withUri, cacheHit: false, sourceBytes: bytes.byteLength };
}

async function buildLook(src: SourceFile, bytes: Uint8Array, cacheDir: string, force: boolean): Promise<Built> {
  const key = modelKey(src, bytes, null);
  const hit = force ? null : readModel<ModelMeta>(cacheDir, key);
  if (hit) return { src, lod0: hit.lod0, lod1: null, meta: hit.meta, textures: [], cacheHit: true, sourceBytes: bytes.byteLength };
  const io = await createIO();
  const doc = await readDoc(src.file, bytes);
  const flags: QaFlag[] = [];
  const shape = prepareLook(doc, src.id, flags);
  const dropped = pruneRestTracks(doc);
  const bounds = restPoseBounds(doc);
  await runSequence(doc);
  const glb = await io.writeBinary(doc);
  const meta: ModelMeta = { triangles: shape.triangles, clips: shape.clips, bounds, lod1Triangles: null, lod1Error: null, droppedRestTracks: dropped, flags, textureTier: null, textures: [] };
  writeModel(cacheDir, key, { lod0: glb, lod1: null, meta });
  return { src, lod0: glb, lod1: null, meta, textures: [], cacheHit: false, sourceBytes: bytes.byteLength };
}

/** Solves `totalBytes` so it includes the manifest's own size. */
export function finaliseManifest(m: Omit<ModelsManifest, 'totalBytes'>, otherBytes: number): { manifest: ModelsManifest; json: string } {
  let total = otherBytes;
  for (let i = 0; i < 8; i++) {
    const json = stableJson({ ...m, totalBytes: total });
    const next = otherBytes + Buffer.byteLength(json);
    if (next === total) return { manifest: { ...m, totalBytes: total }, json };
    total = next;
  }
  throw new Error('[model-pipeline] totalBytes did not reach a fixed point');
}

function sweep(dir: string, keep: ReadonlySet<string>, root: string, log: (s: string) => void): void {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const rel = relative(root, p).replace(/\\/g, '/');
    if (statSync(p).isDirectory()) {
      sweep(p, keep, root, log);
      if (readdirSync(p).length === 0) rmSync(p, { recursive: true });
    } else if (!keep.has(rel)) {
      rmSync(p);
      log(`  removed stale ${rel}`);
    }
  }
}

export async function runBuild(o: BuildOptions = {}): Promise<BuildResult> {
  const log = o.log ?? ((s: string) => console.log(s));
  const srcDir = o.srcDir ?? SRC_DIR;
  const outDir = o.outDir ?? DEFAULT_OUT_DIR;
  const iconsDir = o.iconsDir ?? ICONS_DIR;
  const licensesDir = o.licensesDir ?? LICENSES_DIR;
  const cacheDir = o.cacheDir ?? DEFAULT_CACHE_DIR;
  const qaDir = o.qaDir === undefined ? QA_DIR : o.qaDir;
  const write = o.write ?? true;
  const force = o.force ?? false;

  // §40.0.2 rule 6 — before any work.
  for (const l of LICENCE_COPIES) {
    const f = join(licensesDir, l.from);
    if (!existsSync(f)) throw new Error(`[model-pipeline] licence file missing: ${f} (SPEC §40.0.2 rule 6: licences travel with assets)`);
  }
  const sources = listSources(srcDir, o.looks);

  const warnings: string[] = [];
  let format: TextureFormat = o.textures === 'webp' ? 'webp' : 'ktx2';
  if ((o.textures ?? 'auto') === 'auto') {
    const probe = await probeKtx2(2048);
    if (!probe.ok) {
      format = 'webp';
      warnings.push(`probeKtx2(2048) failed (${probe.error}); legendary textures fall back to WebP q90 (§40.2.4 — a warning until M2, then a failure)`);
    }
  }
  if (format === 'webp') for (const w of warnings.length ? warnings : ['legendary textures written as WebP (forced)']) log(`  warning: ${w}`);

  const built: Built[] = [];
  for (const src of sources) {
    const t0 = Date.now();
    const bytes = bytesOf(readFileSync(src.file));
    const b = src.set === 'legendary' ? await buildLegendary(src, bytes, format, cacheDir, force) : await buildLook(src, bytes, cacheDir, force);
    built.push(b);
    log(`  ${b.cacheHit ? 'cached' : 'built '} ${src.set.padEnd(9)} ${src.id.padEnd(20)} ${String(b.lod0.byteLength).padStart(8)} B${b.lod1 ? ` + lod1 ${b.lod1.byteLength} B` : ''}${b.textures.length ? ` + ${b.textures.length} ${format} ${b.textures.reduce((s, t) => s + t.bytes.byteLength, 0)} B` : ''}  (${Date.now() - t0} ms)`);
  }

  const files = new Map<string, Uint8Array>();
  const credits = new Uint8Array(readFileSync(join(licensesDir, 'QUATERNIUS-CREDITS.txt')));
  files.set('CREDITS.txt', credits);
  const legendaries: Record<string, ModelEntry> = {};
  const looks: Record<string, ModelEntry> = {};
  const qaModels: ModelQa[] = [];
  const flags: QaFlag[] = [];
  for (const b of built) {
    const dir = b.src.set === 'legendary' ? 'legendaries' : 'looks';
    const url = `${dir}/${b.src.id}.glb`;
    files.set(url, b.lod0);
    let lod1: string | null = null;
    if (b.lod1) { lod1 = `${dir}/${b.src.id}.lod1.glb`; files.set(lod1, b.lod1); }
    let texBytes = 0;
    for (const t of b.textures) { files.set(`${dir}/${t.uri}`, t.bytes); texBytes += t.bytes.byteLength; }
    const entry: ModelEntry = {
      url, lod1,
      bytes: b.lod0.byteLength + texBytes,
      triangles: b.meta.triangles,
      clips: [...b.meta.clips].sort(),
      textures: b.textures.length ? format : 'none',
      bounds: { min: [...b.meta.bounds.min], max: [...b.meta.bounds.max] },
      hash: sha256(b.lod0),
    };
    (b.src.set === 'legendary' ? legendaries : looks)[b.src.id] = entry;
    flags.push(...b.meta.flags);
    qaModels.push({
      id: b.src.id, set: b.src.set, sourceBytes: b.sourceBytes, glbBytes: b.lod0.byteLength, lod1Bytes: b.lod1?.byteLength ?? null,
      textureBytes: texBytes, triangles: b.meta.triangles, lod1Triangles: b.meta.lod1Triangles, lod1Error: b.meta.lod1Error,
      droppedRestTracks: b.meta.droppedRestTracks,
      textureTier: b.meta.textureTier,
      textures: b.textures.map((t) => ({ role: t.role, uri: t.uri, width: t.width, height: t.height, bytes: t.bytes.byteLength, mean: t.mean })),
    });
  }
  for (const id of LEGENDARY_IDS) if (!legendaries[id]) throw new Error(`[model-pipeline] legendary ${id} was not built`);
  let other = 0;
  for (const v of files.values()) other += v.byteLength;
  const { manifest, json } = finaliseManifest({ version: 1, legendaries: legendaries as Record<LegendaryId, ModelEntry>, looks }, other);
  files.set(MANIFEST_FILE, new TextEncoder().encode(json));

  const qa: QaReport = { version: 1, pipelineVersion: PIPELINE_VERSION, textures: format, warnings, flags, models: qaModels };
  const cacheHits = built.filter((b) => b.cacheHit).length;

  if (write) {
    mkdirSync(outDir, { recursive: true });
    for (const [rel, data] of files) {
      const p = join(outDir, rel);
      mkdirSync(dirname(p), { recursive: true });
      if (!existsSync(p) || !Buffer.from(readFileSync(p)).equals(Buffer.from(data))) writeFileSync(p, data);
    }
    sweep(outDir, new Set(files.keys()), outDir, log);
    mkdirSync(iconsDir, { recursive: true });
    copyFileSync(join(licensesDir, 'TABLER-LICENSE.txt'), join(iconsDir, 'TABLER-LICENSE.txt'));
    if (qaDir) {
      mkdirSync(qaDir, { recursive: true });
      writeFileSync(join(qaDir, 'qa-report.json'), stableJson(qa));
    }
  }
  return { manifest, files, qa, inputs: sources.length, cacheHits };
}
