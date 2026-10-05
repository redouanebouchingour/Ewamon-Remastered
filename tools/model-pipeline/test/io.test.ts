/** GLB packing, KTX2 container facts, the source-set validation and the manifest fixed point. */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { finaliseManifest } from '../src/build.js';
import { createIO, packGlb, readGlbJson, writeGlbExternalImages } from '../src/glb.js';
import { encodeKtx2, isKtx2, probeKtx2, readKtx2Header, SUPERCOMPRESSION_ZSTD } from '../src/ktx2.js';
import { LEGENDARY_IDS, bodyPaletteLooks, listKayKit, listSources } from '../src/sets.js';
import { LOOK_DEFS, PALETTE_VARIANTS } from '../src/characters.js';
import { encodeTexture, textureUri, TEXTURE_TIERS } from '../src/textures.js';
import { HAS_SOURCES, SRC_MODELS, skinnedFixture } from './helpers.js';

const tmp: string[] = [];
afterAll(() => { for (const d of tmp) rmSync(d, { recursive: true, force: true }); });

describe('GLB writer', () => {
  it('without textures, writeGlbExternalImages equals NodeIO.writeBinary byte for byte', async () => {
    const io = await createIO();
    const { doc } = skinnedFixture([[1, 0, 0]], ['Idle']);
    const ref = await io.writeBinary(doc);
    const mine = await writeGlbExternalImages(io, doc);
    expect(mine.images.size).toBe(0);
    expect(Buffer.from(mine.glb).equals(Buffer.from(ref))).toBe(true);
  });

  it('keeps images external under their uri and the buffer as the BIN chunk', async () => {
    const io = await createIO();
    const { doc } = skinnedFixture([[1, 0, 0]], ['Idle']);
    const img = new Uint8Array([0xab, 0x4b, 0x54, 0x58, 1, 2, 3]);
    doc.getRoot().listMaterials()[0]!.setBaseColorTexture(doc.createTexture('t').setImage(img).setMimeType('image/ktx2').setURI('x.basecolor.00000000.ktx2'));
    const out = await writeGlbExternalImages(io, doc);
    expect([...out.images.keys()]).toEqual(['x.basecolor.00000000.ktx2']);
    const j = readGlbJson(out.glb) as { images: { uri: string; bufferView?: number }[]; buffers: { uri?: string; byteLength: number }[] };
    expect(j.images).toEqual([{ uri: 'x.basecolor.00000000.ktx2', mimeType: 'image/ktx2' }].map((x) => expect.objectContaining(x)));
    expect(j.images[0]!.bufferView).toBeUndefined();
    expect(j.buffers[0]!.uri).toBeUndefined();
    expect(doc.getRoot().listBuffers()[0]!.getURI()).toBe('');
    // and it reads back through NodeIO from disk, resolving the image next to it
    const dir = mkdtempSync(join(tmpdir(), 'ewa-glb-'));
    tmp.push(dir);
    writeFileSync(join(dir, 'm.glb'), out.glb);
    writeFileSync(join(dir, 'x.basecolor.00000000.ktx2'), img);
    const back = await io.read(join(dir, 'm.glb'));
    expect(Buffer.from(back.getRoot().listTextures()[0]!.getImage()!).equals(Buffer.from(img))).toBe(true);
  });

  it('packGlb writes the 12-byte header, a space-padded JSON chunk and a zero-padded BIN chunk', () => {
    const glb = packGlb({ asset: { version: '2.0' } }, new Uint8Array([1, 2, 3]));
    const dv = new DataView(glb.buffer);
    expect(dv.getUint32(0, true)).toBe(0x46546c67);
    expect(dv.getUint32(8, true)).toBe(glb.byteLength);
    expect(glb.byteLength % 4).toBe(0);
    expect(readGlbJson(glb)).toEqual({ asset: { version: '2.0' } });
  });
});

describe('KTX2 (§40.2.4)', () => {
  it('encodes UASTC + zstd with a full Basis mip chain; sRGB transfer for colour, linear otherwise', async () => {
    const w = 128;
    const data = new Uint8Array(w * w * 4).map((_, i) => (i * 13) & 255);
    const colour = readKtx2Header(await encodeKtx2({ width: w, height: w, data }, { srgb: true, normalMap: false, rdo: 2, pack: 0, mipmaps: true }));
    expect(colour).toMatchObject({ pixelWidth: 128, pixelHeight: 128, levelCount: 8, supercompressionScheme: SUPERCOMPRESSION_ZSTD, colorModel: 166, transfer: 2 });
    const normal = readKtx2Header(await encodeKtx2({ width: w, height: w, data }, { srgb: false, normalMap: true, rdo: 2, pack: 0, mipmaps: true }));
    expect(normal).toMatchObject({ levelCount: 8, colorModel: 166, transfer: 1 });
  });

  it('probeKtx2 succeeds on this machine (the WebP fallback is not taken)', async () => {
    expect(await probeKtx2(256)).toEqual({ ok: true, error: null });
  });

  it('encodeTexture fits to the tier size and names the file by role + content hash', async () => {
    const w = 96;
    const raw = Buffer.alloc(w * w * 3, 128);
    const sharp = (await import('sharp')).default;
    const png = new Uint8Array(await sharp(raw, { raw: { width: w, height: w, channels: 3 } }).png().toBuffer());
    const t = await encodeTexture(png, 'normal', 'ktx2', 64);
    expect([t.width, t.height]).toEqual([64, 64]);
    expect(isKtx2(t.bytes)).toBe(true);
    expect(t.mean).toEqual([128, 128, 128]);
    expect(textureUri('lumyth', t)).toMatch(/^lumyth\.normal\.[0-9a-f]{8}\.ktx2$/);
    const small = await encodeTexture(png, 'baseColor', 'webp', 512);   // never upscaled
    expect([small.width, small.height]).toEqual([96, 96]);
    expect(textureUri('x', small)).toMatch(/^x\.basecolor\.[0-9a-f]{8}\.webp$/);
  });

  it('the tier ladder only ever lowers resolution, base colour last', () => {
    for (let i = 1; i < TEXTURE_TIERS.length; i++) {
      for (const role of ['baseColor', 'normal', 'orm', 'emissive'] as const) {
        expect(TEXTURE_TIERS[i]!.maxSize[role]).toBeLessThanOrEqual(TEXTURE_TIERS[i - 1]!.maxSize[role]);
      }
    }
    expect(TEXTURE_TIERS[0]!.maxSize).toEqual({ baseColor: 512, emissive: 512, normal: 512, orm: 512 });
  });
});

describe('source sets (§40.2.1, §40.0.2 rule 3)', () => {
  function fakeLegendaries(legendaries: readonly string[] = LEGENDARY_IDS): string {
    const d = mkdtempSync(join(tmpdir(), 'ewa-src-'));
    tmp.push(d);
    mkdirSync(join(d, 'legendaries'));
    for (const id of legendaries) writeFileSync(join(d, 'legendaries', `${id}.glb`), '');
    return d;
  }

  it('lists the four legendaries, sorted; a missing one fails with its id', () => {
    expect(listSources(fakeLegendaries()).map((x) => `${x.set}:${x.id}`)).toEqual(['legendary:lumyth', 'legendary:noxmyth', 'legendary:voidraxis', 'legendary:zenryu']);
    expect(() => listSources(fakeLegendaries(['lumyth']))).toThrow(/legendary noxmyth/);
  });

  it('refuses to ship silently: the look table must be exactly LOOKS and the BODIES palettes', () => {
    const d = fakeLegendaries();
    const looks = Object.keys(LOOK_DEFS);
    expect(() => listKayKit(d, looks)).toThrow(/kaykit-adventurers/);              // the set directory is missing
    mkdirSync(join(d, 'kaykit-adventurers'));
    expect(() => listKayKit(d, [...looks, 'robot_male'])).toThrow(/robot_male .*no entry in the KayKit look table/);
    expect(() => listKayKit(d, looks.filter((l) => l !== 'ninja_male'))).toThrow(/ninja_male .*not in @ewa\/content LOOKS/);
    expect(() => listKayKit(d, looks, [...Object.keys(PALETTE_VARIANTS), 'casual_male:ember'])).toThrow(/casual_male:ember .*no recolour/);
    expect(() => listKayKit(d, looks, ['casual2_male:dusk'])).toThrow(/not used by any @ewa\/content BODIES row/);
    expect(() => listKayKit(d, looks)).toThrow(/KayKit source .*Barbarian\.glb not found/);
  });

  it('the BODIES palettes are the five variants the look table recolours', () => {
    expect(bodyPaletteLooks()).toEqual(Object.keys(PALETTE_VARIANTS).sort());
    expect(bodyPaletteLooks()).toEqual(['casual2_female:dusk', 'casual2_male:dusk', 'cowboy_female:tide', 'cowboy_male:tide', 'knight_male:forge']);
  });

  it.skipIf(!HAS_SOURCES)('the real assets-src/models has the 4 legendaries and every KayKit file the set reads', () => {
    expect(listSources(SRC_MODELS)).toHaveLength(4);
    const k = listKayKit(SRC_MODELS);
    expect(Object.keys(k.characters).sort()).toEqual(['Barbarian', 'Knight', 'Mage', 'Ranger', 'Rogue', 'Rogue_Hooded']);
    expect(Object.keys(k.textures).sort()).toEqual(['barbarian', 'knight', 'mage', 'ranger', 'rogue']);
    expect(k.animations).toHaveLength(2);
    expect(Object.keys(k.accessories)).toHaveLength(5);
  });
});

describe('manifest totalBytes fixed point', () => {
  it('includes the manifest\'s own size', () => {
    const { manifest, json } = finaliseManifest({ version: 2, legendaries: {} as never, characters: {} as never, looks: {} }, 1000);
    expect(manifest.totalBytes).toBe(1000 + Buffer.byteLength(json));
    expect(JSON.parse(json).totalBytes).toBe(manifest.totalBytes);
  });
});
