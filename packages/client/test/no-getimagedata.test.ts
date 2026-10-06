/**
 * §50.4.7 `no-getimagedata.test.ts` (legacy-render-audit Q28): creature variants are four per-object shader values,
 * never re-baked pixels. A static scan of `packages/client/src` and `packages/render/src` (code only — comments may
 * name the APIs) finds no `getImageData` at all, and no `putImageData` / `createImageData` / 2D-canvas pixel buffer
 * outside the allow-list below; no sprite / atlas module touches a 2D context or indexes RGBA bytes. Then, at runtime,
 * the billboard pool writes exactly the 4 variant values (`hueShift`, `satMul`, `lightMul`, `alphaGlow`) as per-object
 * scalars on one shared material per atlas — a variant never creates a material or a texture.
 *
 * Exempt by location: the capture harness scripts (`packages/client/scripts/harness/*`, Node-side PNG decoding) and the
 * Playwright specs, which read pixels back on purpose; neither is under `src/`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BillboardPool, VARIANT_KEYS, VARIANT_UNIFORMS } from '@ewa/render';
import type { SpriteDescriptor } from '@ewa/render';

const ROOTS = {
  client: fileURLToPath(new URL('../src', import.meta.url)),
  render: fileURLToPath(new URL('../../render/src', import.meta.url)),
};

/**
 * The only writers of 2D pixel buffers, each with its reason. Neither reads pixels back and neither touches a sprite.
 * - client world/minimapDraw.ts (Phase C3): `createImageData` + `putImageData` once per zone to paint the minimap base
 *   from the heightfield (walkable / water / height shading); the 4 Hz tick only blits it.
 */
const PIXEL_WRITERS = new Set(['client/world/minimapDraw.ts']);
/** 2D contexts that draw text / shapes only: the HUD layer and the minimap canvas. */
const CONTEXT_2D = new Set(['render/hud/layer.ts', 'client/world/Minimap.tsx', 'client/world/minimapDraw.ts']);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

/** Source with comments removed (a doc comment may say "never getImageData"). */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const files = Object.entries(ROOTS).flatMap(([pkg, root]) =>
  walk(root).map((p) => ({ path: `${pkg}/${relative(root, p).replace(/\\/g, '/')}`, text: code(readFileSync(p, 'utf8')) })),
);

const isSpriteModule = (path: string, text: string): boolean =>
  path.startsWith('render/sprites/') || /\bAtlas(Set|Decoder|Textures)\b|\bSpriteDescriptor\b|\bCreatureBillboard\b/.test(text);

describe('no CPU pixel work on sprites (Q28)', () => {
  it('scans both source trees', () => {
    expect(files.filter((f) => f.path.startsWith('client/')).length).toBeGreaterThan(100);
    expect(files.filter((f) => f.path.startsWith('render/')).length).toBeGreaterThan(50);
    expect(files.some((f) => f.path === 'render/sprites/billboard.ts')).toBe(true);
  });

  it('no getImageData anywhere in client/src or render/src', () => {
    expect(files.filter((f) => /\bgetImageData\b/.test(f.text)).map((f) => f.path)).toEqual([]);
  });

  it('putImageData / createImageData / new ImageData only in the allow-listed minimap base writer', () => {
    const hits = files.filter((f) => /\b(putImageData|createImageData)\b|new\s+ImageData\b/.test(f.text)).map((f) => f.path);
    expect(hits.filter((p) => !PIXEL_WRITERS.has(p))).toEqual([]);
    // the allow-listed writer paints from the heightfield, never from a sprite
    for (const p of PIXEL_WRITERS) {
      const f = files.find((x) => x.path === p)!;
      expect(isSpriteModule(f.path, f.text), p).toBe(false);
      expect(/sprites?\//.test(f.text), `${p} imports a sprite module`).toBe(false);
    }
  });

  it("getContext('2d') only in the HUD layer and the minimap", () => {
    const hits = files.filter((f) => /getContext\(\s*['"]2d['"]/.test(f.text)).map((f) => f.path);
    expect(hits.filter((p) => !CONTEXT_2D.has(p))).toEqual([]);
  });

  it('no sprite / atlas module draws to a 2D context, builds an ImageData, or indexes RGBA bytes in a per-pixel loop', () => {
    const offenders: string[] = [];
    for (const f of files) {
      if (!isSpriteModule(f.path, f.text)) continue;
      if (/getContext\(|ImageData\b|drawImage\(/.test(f.text)) offenders.push(`${f.path}: 2D canvas / ImageData`);
      // a READ of an RGBA-stride element (`px[(y * w + x) * 4 + 1]`, `data[i + 3]` not followed by `=`): pixels coming
      // back out of an image. Writes from constants are allowed (the 4×4 neutral placeholder texture in atlas.ts and the
      // quad's tangent attribute in billboard.ts fill typed arrays; neither reads a sprite).
      const read = /\w+\[[^\]\n]*\*\s*4\s*(\+\s*[0-3])?\s*\](?!\s*=[^=])|\w+\[\s*\w+\s*\+\s*3\s*\](?!\s*=[^=])/;
      if (read.test(f.text)) offenders.push(`${f.path}: reads an RGBA-stride element`);
    }
    expect(offenders).toEqual([]);
  });
});

// ---- the 4 variant values are per-object scalars on one material ------------------------------------------------

type PoolOptions = NonNullable<ConstructorParameters<typeof BillboardPool>[0]>;

function fakeDecoder(): NonNullable<PoolOptions['decoder']> {
  return {
    decode: async (url: string, crop: readonly [number, number, number, number] | null) => {
      const lv = /\.m(\d)\./.exec(url);
      const level = lv ? Number(lv[1]) : 0;
      const base = url.includes('.normal.') ? 1024 : 2048;
      return { width: crop ? crop[2] : base >> level, height: crop ? crop[3] : base >> level, close: () => undefined };
    },
  } as unknown as NonNullable<PoolOptions['decoder']>;
}

function atlasSet(id: string): Parameters<BillboardPool['bindAtlas']>[0] {
  const m = (k: string) => ({ url: `/c/${id}.${k}.webp`, mips: [1, 2, 3].map((i) => `/c/${id}.${k}.m${i}.webp`) });
  return { id, albedo: m('albedo'), normal: m('normal'), emissive: m('emissive'), size: 2048, normalScale: 0.5 } as Parameters<BillboardPool['bindAtlas']>[0];
}

function desc(id: string, over: Partial<SpriteDescriptor> = {}): SpriteDescriptor {
  const f = (x: number) => ({ atlas: 'a-001', rect: [x, 0.5, x + 0.5, 1] as const, px: [x * 2048, 0, 1024, 1024] as const, footV: 0.08, aspect: 1 });
  return { id, front: f(0.5), back: f(0), sizeScale: 1, types: ['Grass'], variant: 'normal', isAlpha: false, ...over } as SpriteDescriptor;
}

describe('billboard variant values (Q28)', () => {
  it('every variant is the same material; the 4 palette values live on the quad as per-object scalars', async () => {
    const pool = new BillboardPool({ decoder: fakeDecoder() });
    await pool.bindAtlas(atlasSet('a-001'));
    const materials = new Set<string>();
    const textures = new Set<unknown>();
    for (const variant of VARIANT_KEYS) {
      for (const isAlpha of [false, true]) {
        const bb = pool.acquire(desc(`${variant}-${isAlpha}`, { variant, isAlpha }));
        const quad = bb.object.children[0] as unknown as { material: { uuid: string; map?: unknown }; userData: Record<string, unknown> };
        materials.add(quad.material.uuid);
        textures.add(quad.material.map);
        const ud = quad.userData;
        for (const k of ['hueShift', 'satMul', 'lightMul', 'alphaGlow'] as const) expect(typeof ud[k], `${variant} ${k}`).toBe('number');
        expect(ud['hueShift']).toBeCloseTo(VARIANT_UNIFORMS[variant].hueShift, 9);
        expect(ud['satMul']).toBeCloseTo(VARIANT_UNIFORMS[variant].satMul, 9);
        expect(ud['lightMul']).toBeCloseTo(VARIANT_UNIFORMS[variant].lightMul, 9);
        expect(ud['alphaGlow']).toBe(isAlpha ? 1 : 0);
        // a variant switch rewrites the scalars in place
        bb.setVariant('ember', isAlpha);
        expect(ud['hueShift']).toBeCloseTo(VARIANT_UNIFORMS.ember.hueShift, 9);
        bb.dispose();
      }
    }
    expect(materials.size).toBe(1);
    expect(textures.size).toBe(1);
    pool.dispose();
  });

  it('the billboard material reads the 4 values as per-object userData nodes (never a baked texture per variant)', () => {
    const src = files.find((f) => f.path === 'render/sprites/billboard.ts')!.text;
    for (const k of ['hueShift', 'satMul', 'lightMul', 'alphaGlow']) expect(src, k).toContain(`f('${k}')`);
  });
});
