/**
 * SPEC §40.2.4 texture plan, applied as the last step of the §40.2.2 sequence.
 *
 * gltf-transform 4.5's `textureCompress` supports `jpeg | png | webp | avif` only
 * (`TEXTURE_COMPRESS_SUPPORTED_FORMATS` in `functions/dist/index.d.ts`) — there is no `targetFormat: 'ktx2'`. So the
 * plan is a transform of its own (IMPLEMENTATION-NOTES M2): each texture is decoded with sharp, fitted to the plan's
 * size, encoded by `ktx2.ts`, and put back with `image/ktx2` + `KHR_texture_basisu` (required) and an external
 * `uri` (`<id>.<role>.<hash8>.ktx2`) shared by LOD0 and LOD1. The WebP fallback (§40.2.4, when `probeKtx2(2048)`
 * fails) encodes `webp q90` with sharp — what `textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 90 })`
 * does — under `EXT_texture_webp`.
 */
import { createHash } from 'node:crypto';
import type { Document } from '@gltf-transform/core';
import { EXTTextureWebP, KHRTextureBasisu } from '@gltf-transform/extensions';
import sharp from 'sharp';
import { encodeKtx2, settingsKey } from './ktx2.js';
import type { Ktx2Options } from './ktx2.js';
import { classifyLegendaryTextures } from './prepare.js';
import type { TextureRole } from './prepare.js';

export type TextureFormat = 'ktx2' | 'webp';

/**
 * §40.2.4 `TEXTURE_PLAN`: UASTC + RDO λ 2.0 + zstd + Basis mips; `baseColor | emissive` sRGB (+ perceptual),
 * `normal | orm` linear, the normal-map preset on `normal`. Pack level 0 — the same choice and measurement as
 * `tools/material-bake` D2 (pack 2 was 21 % larger *and* 4× slower on these maps: lumyth 1024² 2.31 MB vs 1.91 MB).
 */
export const TEXTURE_PLAN: Readonly<Record<TextureRole, Ktx2Options>> = Object.freeze({
  baseColor: { srgb: true, normalMap: false, rdo: 2, pack: 0, mipmaps: true },
  emissive: { srgb: true, normalMap: false, rdo: 2, pack: 0, mipmaps: true },
  normal: { srgb: false, normalMap: true, rdo: 2, pack: 0, mipmaps: true },
  orm: { srgb: false, normalMap: false, rdo: 2, pack: 0, mipmaps: true },
});

export interface TextureTier {
  readonly tier: number;
  /** Longest edge per role after fitting (never upscaled). */
  readonly maxSize: Readonly<Record<TextureRole, number>>;
}

/**
 * The resolution ladder of IMPLEMENTATION-NOTES M1. §40.2.6 budgets "3 textures at 1024²–2048² … ≈ 0.4–0.6 MB"
 * inside the 1.2 MB LOD0 line; measured, three 1024² UASTC maps of these sources are 1.9–2.3 MB on their own
 * (λ 4 and λ 8 with widened RDO thresholds: still 2.0–2.2 MB), while 512² maps are 0.58–0.75 MB. So each
 * legendary gets the FIRST tier whose LOD0 (GLB + textures) fits `LEGENDARY_LOD0_MAX`; the tier is recorded in
 * `qa-report.json`. The ladder gives up roughness/metal resolution first (low-frequency on these creatures, and the
 * map with the least visible loss), then normal detail, and base colour last. Deterministic: the choice depends only
 * on the input bytes.
 */
export const TEXTURE_TIERS: readonly TextureTier[] = Object.freeze([
  { tier: 0, maxSize: { baseColor: 512, emissive: 512, normal: 512, orm: 512 } },
  { tier: 1, maxSize: { baseColor: 512, emissive: 512, normal: 512, orm: 256 } },
  { tier: 2, maxSize: { baseColor: 512, emissive: 512, normal: 512, orm: 128 } },
  { tier: 3, maxSize: { baseColor: 512, emissive: 256, normal: 256, orm: 128 } },
  { tier: 4, maxSize: { baseColor: 256, emissive: 256, normal: 256, orm: 128 } },
]);

/** §40.2.4 fallback. */
export const WEBP_FALLBACK_QUALITY = 90;

export function planKey(role: TextureRole, format: TextureFormat, maxSize: number): string {
  return format === 'ktx2' ? `${settingsKey(TEXTURE_PLAN[role])};max=${maxSize}` : `webp;q${WEBP_FALLBACK_QUALITY};max=${maxSize}`;
}

export interface EncodedTexture {
  readonly role: TextureRole;
  readonly format: TextureFormat;
  readonly bytes: Uint8Array;
  readonly width: number;
  readonly height: number;
  /** Mean RGB (0–255) of the source image, for the normal-map cross-check in qa-report.json. */
  readonly mean: readonly [number, number, number];
}

function fit(w: number, h: number, max: number): [number, number] {
  const s = Math.min(1, max / Math.max(w, h));
  return [Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s))];
}

export async function encodeTexture(src: Uint8Array, role: TextureRole, format: TextureFormat, maxSize: number): Promise<EncodedTexture> {
  const plan = TEXTURE_PLAN[role];
  const meta = await sharp(src).metadata();
  if (!meta.width || !meta.height) throw new Error(`[model-pipeline] ${role} texture: undecodable image`);
  const stats = await sharp(src).stats();
  const mean = [stats.channels[0]?.mean ?? 0, stats.channels[1]?.mean ?? 0, stats.channels[2]?.mean ?? 0].map((v) => Math.round(v * 100) / 100) as [number, number, number];
  const [w, h] = fit(meta.width, meta.height, maxSize);
  const img = sharp(src).resize(w, h, { kernel: 'lanczos3', fit: 'fill' });
  if (format === 'webp') {
    const bytes = new Uint8Array(await img.webp({ quality: WEBP_FALLBACK_QUALITY, effort: 6 }).toBuffer());
    return { role, format, bytes, width: w, height: h, mean };
  }
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bytes = await encodeKtx2({ width: info.width, height: info.height, data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) }, plan);
  return { role, format, bytes, width: info.width, height: info.height, mean };
}

export const sha256 = (b: Uint8Array | string): string => createHash('sha256').update(b).digest('hex');

export function textureUri(id: string, t: EncodedTexture): string {
  return `${id}.${t.role === 'baseColor' ? 'basecolor' : t.role}.${sha256(t.bytes).slice(0, 8)}.${t.format}`;
}

/**
 * Swaps each classified texture's image for its encoded bytes and external uri; registers the matching extension
 * (required) and removes the source's `EXT_texture_webp` when no WebP image is left.
 */
export function applyTextures(doc: Document, id: string, byRole: ReadonlyMap<TextureRole, EncodedTexture>): void {
  const root = doc.getRoot();
  let ktx2 = false;
  let webp = false;
  for (const { texture: t, role } of classifyLegendaryTextures(doc)) {
    const e = byRole.get(role);
    if (!e) throw new Error(`[model-pipeline] ${id}: ${role} texture "${t.getName()}" has no encoded image`);
    t.setImage(e.bytes).setMimeType(e.format === 'ktx2' ? 'image/ktx2' : 'image/webp').setURI(textureUri(id, e));
    if (e.format === 'ktx2') ktx2 = true; else webp = true;
  }
  const used = root.listExtensionsUsed();
  if (ktx2) doc.createExtension(KHRTextureBasisu).setRequired(true);
  if (webp) doc.createExtension(EXTTextureWebP).setRequired(true);
  else used.find((e) => e.extensionName === EXTTextureWebP.EXTENSION_NAME)?.dispose();
}
