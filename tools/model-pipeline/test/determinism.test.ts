/**
 * SPEC §40.2.2 / §40.0.2 rules 1–2 / §50.4.8 `determinism.test.ts`: two `writeBinary` runs are byte-identical;
 * the KTX2 encoder is deterministic; a rerun over unchanged inputs does no mesh/texture work (`cacheHits ===
 * inputs`) and reproduces the committed `public/models/` bytes.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runBuild } from '../src/build.js';
import { createIO, writeGlbExternalImages } from '../src/glb.js';
import { encodeKtx2 } from '../src/ktx2.js';
import { prepareLegendary, prepareLook, pruneRestTracks } from '../src/prepare.js';
import { applyTextures } from '../src/textures.js';
import type { EncodedTexture } from '../src/textures.js';
import { runSequence } from '../src/transform.js';
import { LOD1_SIMPLIFY } from '../src/simplify.js';
import { HAS_SOURCES, OUT_MODELS, SRC_MODELS, skinnedFixture } from './helpers.js';

const SEVENTEEN = ['Death', 'Defeat', 'Idle', 'Jump', 'PickUp', 'Punch', 'RecieveHit', 'Roll', 'Run', 'Run_Carry', 'Shoot_OneHanded', 'SitDown', 'StandUp', 'SwordSlash', 'Victory', 'Walk', 'Walk_Carry'];

async function lookGlb(): Promise<Uint8Array> {
  const io = await createIO();
  const { doc } = skinnedFixture([[0.2, 0.3, 0.4], [0.8, 0.1, 0.1]], SEVENTEEN);
  prepareLook(doc, 'fixture', []);
  pruneRestTracks(doc);
  await runSequence(doc);
  return io.writeBinary(doc);
}

describe('determinism', () => {
  it('two runs of the look path (prepare → sequence → writeBinary) are byte-identical', async () => {
    const a = await lookGlb();
    const b = await lookGlb();
    expect(a.byteLength).toBeGreaterThan(0);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });

  it('the KTX2 encoder produces identical bytes for identical input', async () => {
    const w = 64;
    const data = new Uint8Array(w * w * 4);
    for (let i = 0; i < w * w; i++) { data[i * 4] = (i * 7) & 255; data[i * 4 + 1] = (i >> 6) * 4; data[i * 4 + 2] = 128; data[i * 4 + 3] = 255; }
    const o = { srgb: true, normalMap: false, rdo: 2, pack: 0, mipmaps: true };
    const a = await encodeKtx2({ width: w, height: w, data }, o);
    const b = await encodeKtx2({ width: w, height: w, data }, o);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });

  it.skipIf(!HAS_SOURCES)('two runs of the legendary LOD0 + LOD1 path on a real source are byte-identical', async () => {
    const io = await createIO();
    const bytes = new Uint8Array(readFileSync(join(SRC_MODELS, 'legendaries', 'voidraxis.glb')));
    const fake = (role: EncodedTexture['role']): EncodedTexture => ({ role, format: 'ktx2', bytes: new Uint8Array([1, 2, 3, role.length]), width: 4, height: 4, mean: [0, 0, 0] });
    const byRole = new Map((['baseColor', 'normal', 'orm'] as const).map((r) => [r, fake(r)] as const));
    const once = async (simplify: boolean): Promise<Uint8Array> => {
      const doc = await io.readBinary(bytes);
      prepareLegendary(doc, 'voidraxis');
      pruneRestTracks(doc);
      await runSequence(doc, simplify ? { simplify: LOD1_SIMPLIFY } : {});
      applyTextures(doc, 'voidraxis', byRole);
      return (await writeGlbExternalImages(io, doc)).glb;
    };
    for (const simplify of [false, true]) {
      const a = await once(simplify);
      const b = await once(simplify);
      expect(Buffer.from(a).equals(Buffer.from(b)), `simplify=${simplify}`).toBe(true);
    }
  });

  it.skipIf(!HAS_SOURCES)('a rerun is all cache hits and reproduces the committed public/models bytes', async () => {
    const first = await runBuild({ write: false, qaDir: null, log: () => undefined });
    const second = await runBuild({ write: false, qaDir: null, log: () => undefined });
    expect(second.inputs).toBe(23);
    expect(second.cacheHits).toBe(second.inputs);
    expect([...second.files.keys()].sort()).toEqual([...first.files.keys()].sort());
    for (const [rel, data] of second.files) {
      expect(Buffer.from(data).equals(Buffer.from(first.files.get(rel)!)), rel).toBe(true);
      expect(Buffer.from(data).equals(readFileSync(join(OUT_MODELS, rel))), `${rel} differs from the committed file — run pnpm models`).toBe(true);
    }
  }, 900_000);
});
