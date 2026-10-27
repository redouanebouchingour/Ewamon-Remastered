/**
 * §10.4 creature sprites (node, no GPU): uniform tables (variant palettes, type colours), geometry/anchoring, poses
 * and animation rules, the atlas texture contract (supplied mip chain, Nearest magnification, colour spaces), the
 * refcounted atlas cache and dispose, and the billboard pool (one material per atlas, per-object userData only).
 */
import { describe, expect, it, vi } from 'vitest';
import { LinearMipmapLinearFilter, NearestFilter, NoColorSpace, PerspectiveCamera, RedFormat, SRGBColorSpace, Texture } from 'three/webgpu';
import {
  ATLAS_LEVELS, AtlasCache, MAX_SINGLES, atlasSetBytes, chainBytes, cropForLevel, loadAtlasTextures, loadSingleTextures, singleKey,
  textureFromLevels, type AtlasDecoder, type AtlasSet,
} from '../src/sprites/atlas.js';
import { BillboardPool } from '../src/sprites/billboard.js';
import {
  ANIM, BILLBOARD, FALLBACK_HEIGHT_M, POSES, VARIANT_KEYS, VARIANT_UNIFORMS, billboardDims, bobOffset, bobPhase, cardBodyV, decayHurt, paletteFor, poseDurationMs, samplePose,
  type PoseSample,
} from '../src/sprites/tables.js';
import { TYPE_COLORS, TYPE_NAMES, hexToLinearInto, validateTypeColorTable } from '../src/sprites/typeColors.js';
import type { SpriteDescriptor } from '../src/contracts.js';

describe('§10.4.6 uniform tables', () => {
  it('variant palettes: the spine §3.7 triples, hue in radians', () => {
    expect(VARIANT_KEYS).toEqual(['normal', 'dawn', 'dusk', 'verdant', 'ember']);
    const rows: [string, number, number, number, number][] = [
      ['normal', 0, 0, 1.0, 1.0], ['dawn', 18, 0.31416, 1.08, 1.04], ['dusk', 204, 3.56047, 1.1, 0.95],
      ['verdant', 110, 1.91986, 1.12, 1.05], ['ember', -18, -0.31416, 1.15, 1.02],
    ];
    for (const [k, deg, rad, sat, lit] of rows) {
      const v = VARIANT_UNIFORMS[k as keyof typeof VARIANT_UNIFORMS];
      expect(v.hueDeg).toBe(deg);
      expect(v.hueShift).toBeCloseTo(rad, 5);
      expect(v.satMul).toBe(sat);
      expect(v.lightMul).toBe(lit);
    }
  });

  it('isAlpha: alphaGlow 1, quad and decal ×1.12', () => {
    const p = paletteFor('dusk', true, { hueShift: 0, satMul: 0, lightMul: 0, alphaGlow: 0, scale: 0 });
    expect(p).toMatchObject({ satMul: 1.1, lightMul: 0.95, alphaGlow: 1, scale: 1.12 });
    expect(paletteFor('normal', false, p)).toMatchObject({ hueShift: 0, alphaGlow: 0, scale: 1 });
    // Phase D4: a shiny adds BILLBOARD.shinyGlow (2) to the same value; the quad scale stays the alpha rule
    expect(paletteFor('dusk', false, p, true)).toMatchObject({ alphaGlow: 2, scale: 1 });
    expect(paletteFor('dusk', true, p, true)).toMatchObject({ alphaGlow: 3, scale: 1.12 });
    expect(BILLBOARD.shinyGlow).toBe(2);
    // 2026-10-26: a shiny with a palette wears it in place of the variant's; a non-shiny ignores it
    const pal = { hue: 90, saturation: 1.5, lightness: 0.8 };
    expect(paletteFor('dusk', true, p, true, pal)).toMatchObject({ satMul: 1.5, lightMul: 0.8, alphaGlow: 3, scale: 1.12 });
    expect(p.hueShift).toBeCloseTo(Math.PI / 2, 9);
    expect(paletteFor('dusk', false, p, false, pal)).toMatchObject({ satMul: 1.1, lightMul: 0.95, alphaGlow: 0 });
  });

  it('type colours: the legacy TYPE_COLORS verbatim, all 19 types', () => {
    expect(TYPE_NAMES).toHaveLength(19);
    expect(Object.keys(TYPE_COLORS).sort()).toEqual([...TYPE_NAMES].sort());
    expect(TYPE_COLORS).toMatchObject({ Normal: '#a8a290', Fire: '#ee6f4a', Water: '#4aa3d6', Grass: '#6fae5a', Electric: '#f4cf3f', Ice: '#8fd6e8', Fighting: '#c0492f', Poison: '#9a5bb0', Ground: '#c9a24a', Flying: '#8aa6e0', Psychic: '#e06fa0', Bug: '#9aa83a', Rock: '#b09a6f', Ghost: '#6a5b9a', Dragon: '#6a52d0', Steel: '#9aa6b0', Fairy: '#f0a6d0', Dark: '#5b4b66', Cosmic: '#7be0d0' });
    const c = hexToLinearInto('#ffffff', { r: 0, g: 0, b: 0 });
    expect(c).toEqual({ r: 1, g: 1, b: 1 });
    expect(() => validateTypeColorTable({ ...TYPE_COLORS, Fire: 'red' })).toThrow(RangeError);
    const { Cosmic: _omit, ...missing } = TYPE_COLORS;
    expect(() => validateTypeColorTable(missing as typeof TYPE_COLORS)).toThrow(/Cosmic/);
  });
});

describe('§10.4.3 geometry and anchoring', () => {
  it('H = creature height / body share (× 1.12 alpha), width = H × aspect, feet at the local origin', () => {
    // no measured bodyV: the normalised 0.86, so a 1.376 m creature gets the old 1.6 m card
    const d = billboardDims({ footV: 0.08, aspect: 1 }, 1.376, false, { heightM: 0, widthM: 0, yMin: 0, yMax: 0, decalM: 0 });
    expect(d.heightM).toBeCloseTo(1.6, 12);
    expect(d.widthM).toBeCloseTo(1.6, 12);
    expect(d.yMin).toBeCloseTo(-0.128, 12);
    expect(d.yMax).toBeCloseTo(1.472, 12);
    expect(d.decalM).toBeCloseTo(1.1, 12);
    // a wide creature filling half its card's height: a 2 m one gets a 4 m card (× 1.12 alpha)
    const a = billboardDims({ footV: 0.08, aspect: 0.5, bodyV: 0.5 }, 2, true, d);
    expect(a.heightM).toBeCloseTo(4 * 1.12, 9);
    expect(a.widthM).toBeCloseTo(a.heightM * 0.5, 9);
    expect(a.decalM).toBeCloseTo(BILLBOARD.decalOfWidth * a.widthM, 9);
    // the creature stands exactly its height whatever its body share
    for (const bodyV of [0.3, 0.6, 0.86, 1]) expect(billboardDims({ footV: 0.08, aspect: 1, bodyV }, 0.45, false, d).heightM * bodyV).toBeCloseTo(0.45, 12);
    // no usable height: FALLBACK_HEIGHT_M
    expect(billboardDims({ footV: 0.08, aspect: 1 }, Number.NaN, false, d).heightM).toBeCloseTo(FALLBACK_HEIGHT_M / BILLBOARD.bodyV, 12);
    expect(BILLBOARD.texelsPerMetre).toBe(1024 / 1.6);
  });

  it('a back sprite drawn lower and wider than its front takes the front body share (never bigger from behind)', () => {
    expect(cardBodyV({ bodyV: 0.7 }, { bodyV: 0.43 }, 'front')).toBe(0.7);
    expect(cardBodyV({ bodyV: 0.7 }, { bodyV: 0.43 }, 'back')).toBe(0.7);       // astaroth: its back stands 1.97 of 3.2 m
    expect(cardBodyV({ bodyV: 0.6 }, { bodyV: 0.8 }, 'back')).toBe(0.8);        // a taller back keeps its own: still heightM tall
    expect(cardBodyV({}, {}, 'back')).toBe(BILLBOARD.bodyV);
    // backFullHeight (astaroth): the back keeps its own share, so it stands its full height and draws wider
    expect(cardBodyV({ bodyV: 0.7 }, { bodyV: 0.43 }, 'back', true)).toBe(0.43);
    expect(cardBodyV({ bodyV: 0.7 }, { bodyV: 0.43 }, 'front', true)).toBe(0.7);
  });
});

describe('§10.4.6 animation rules', () => {
  const s: PoseSample = { forward: 0, lift: 0, scaleY: 1, dissolve: 0 };
  it('idle bob: 0.5 Hz, ±1.5 % of H, a phase per id', () => {
    const H = 1.6;
    let max = 0;
    for (let t = 0; t < 2; t += 0.01) max = Math.max(max, Math.abs(bobOffset(H, t, 0)));
    expect(max).toBeCloseTo(ANIM.bobAmp * H, 4);
    expect(bobOffset(H, 1, 0)).toBeCloseTo(0, 9);       // period 2 s
    expect(bobPhase('a')).not.toBe(bobPhase('b'));
    expect(bobPhase('a')).toBe(bobPhase('a'));
  });

  it('hurt flash: hurt *= exp(−dt / 70 ms); visible ≈ 220 ms', () => {
    expect(decayHurt(1, 70)).toBeCloseTo(Math.exp(-1), 9);
    let h = 1;
    for (let t = 0; t < 220; t += 1000 / 60) h = decayHurt(h, 1000 / 60);
    expect(h).toBeLessThan(0.05);
    for (let t = 0; t < 1000; t += 1000 / 60) h = decayHurt(h, 1000 / 60);
    expect(h).toBe(0);
  });

  it('poses: lunge +0.9 m at 40 %, windup 0.94 → 1.04, hurt −0.38 m squashed to 0.86 + flash, recoil −0.25 m, enter/exit/faint dissolve, celebrate hops', () => {
    expect(samplePose('lunge', 0.4, s).forward).toBeCloseTo(0.9, 9);
    expect(samplePose('lunge', 1, s).forward).toBe(0);
    expect(poseDurationMs('lunge', 0)).toBe(300);
    expect(samplePose('windup', 0.45, s).scaleY).toBeCloseTo(0.94, 9);
    expect(samplePose('windup', 0.85, s).scaleY).toBeCloseTo(1.04, 9);
    expect(samplePose('hurt', 90 / 260, s).forward).toBeCloseTo(-0.38, 9);
    expect(samplePose('hurt', 50 / 260, s).scaleY).toBeCloseTo(0.86, 9);
    expect(samplePose('hurt', 150 / 260, s).scaleY).toBeCloseTo(1.05, 9);
    expect(samplePose('hurt', 1, s).scaleY).toBe(1);
    expect(POSES.hurt.flash).toBe(true);
    expect(POSES.recoil.flash).toBe(false);
    expect(samplePose('recoil', 0.4, s).forward).toBeCloseTo(-0.25, 9);
    expect(samplePose('enter', 0, s).dissolve).toBe(1);
    expect(samplePose('enter', 1, s).dissolve).toBe(0);
    expect(poseDurationMs('enter', 0)).toBe(450);
    expect(poseDurationMs('exit', 0)).toBe(350);
    samplePose('faint', 1, s);
    expect(s.dissolve).toBe(1);
    expect(s.lift).toBeCloseTo(-0.4, 9);
    expect(samplePose('celebrate', 0.25, s).lift).toBeCloseTo(0.15, 9);
    expect(samplePose('celebrate', 0.75, s).lift).toBeCloseTo(0.15, 9);
    expect(Number.isNaN(samplePose('lunge', 0.5, s).dissolve)).toBe(true);   // lunge does not drive dissolve
    expect(poseDurationMs('faint', 900)).toBe(900);
  });
});

// ---- atlas textures + cache -----------------------------------------------------------------------------------------

function fakeSet(id: string): AtlasSet {
  const m = (k: string) => ({ url: `/c/${id}.${k}.webp`, mips: [1, 2, 3].map((i) => `/c/${id}.${k}.m${i}.webp`) });
  return { id, albedo: m('albedo'), normal: m('normal'), emissive: m('emissive'), size: 2048, normalScale: 0.5 };
}

function fakeDecoder(): AtlasDecoder & { calls: { url: string; crop: readonly number[] | null }[]; closed: number } {
  const d = {
    calls: [] as { url: string; crop: readonly number[] | null }[],
    closed: 0,
    decode: async (url: string, crop: readonly [number, number, number, number] | null) => {
      d.calls.push({ url, crop });
      const lv = /\.m(\d)\./.exec(url); const level = lv ? Number(lv[1]) : 0;
      const base = url.includes('.normal.') ? 1024 : 2048;
      const w = crop ? crop[2] : base >> level; const h = crop ? crop[3] : base >> level;
      return { width: w, height: h, close: () => { d.closed++; } };
    },
  };
  return d;
}

describe('§10.4.1 / §10.4.3 atlas textures', () => {
  it('uploads the supplied chain [l0, l1, l2, l3] (level 0 included), NearestFilter mag, trilinear min, no generated mips', async () => {
    const dec = fakeDecoder();
    const t = await loadAtlasTextures(fakeSet('a-001'), dec);
    expect(dec.calls).toHaveLength(3 * ATLAS_LEVELS);
    for (const [name, tex] of [['albedo', t.albedo], ['normal', t.normal], ['emissive', t.emissive]] as const) {
      expect(tex.mipmaps).toHaveLength(4);
      expect((tex.mipmaps![0] as unknown as { width: number }).width).toBe(name === 'normal' ? 1024 : 2048);
      expect((tex.mipmaps![3] as unknown as { width: number }).width).toBe(name === 'normal' ? 128 : 256);
      expect(tex.image).toBe(tex.mipmaps![0]);
      expect(tex.magFilter).toBe(NearestFilter);
      expect(tex.minFilter).toBe(LinearMipmapLinearFilter);
      expect(tex.anisotropy).toBe(1);
      expect(tex.generateMipmaps).toBe(false);
      expect(tex.flipY).toBe(false);
    }
    expect(t.albedo.colorSpace).toBe(SRGBColorSpace);
    expect(t.normal.colorSpace).toBe(NoColorSpace);
    expect(t.emissive.colorSpace).toBe(NoColorSpace);
    expect(t.emissive.format).toBe(RedFormat);
    expect(t.bytes).toBe(atlasSetBytes(2048, 0.5));
    expect(atlasSetBytes(2048, 0.5)).toBe(chainBytes(2048, 4) + chainBytes(1024, 4) + chainBytes(2048, 1));
    expect(chainBytes(2048, 4)).toBe(4 * (2048 ** 2 + 1024 ** 2 + 512 ** 2 + 256 ** 2));
  });

  it('a party single decodes only the cell (and matching mip cells; half-res normal) into a 1024² set', async () => {
    const dec = fakeDecoder();
    const px = [1024, 0, 1024, 1024] as const;
    const t = await loadSingleTextures(fakeSet('a-042'), { px }, dec);
    const albedo0 = dec.calls.find((c) => c.url === '/c/a-042.albedo.webp')!;
    expect(albedo0.crop).toEqual([1024, 0, 1024, 1024]);
    expect(dec.calls.find((c) => c.url === '/c/a-042.albedo.m3.webp')!.crop).toEqual([128, 0, 128, 128]);
    expect(dec.calls.find((c) => c.url === '/c/a-042.normal.webp')!.crop).toEqual([512, 0, 512, 512]);
    expect(t.size).toBe(1024);
    expect(cropForLevel(px, 2, 0.5)).toEqual([128, 0, 128, 128]);
    expect(singleKey('a-042', px)).toBe('single:a-042:1024,0,1024,1024');
    expect(MAX_SINGLES).toBe(6);
  });

  it('textureFromLevels rejects an empty chain', () => {
    expect(() => textureFromLevels([], 'albedo')).toThrow(RangeError);
  });
});

describe('atlas cache: refcount and dispose', () => {
  const setup = () => {
    const disposed: string[] = [];
    let loads = 0;
    const cache = new AtlasCache<{ id: string }>((e) => disposed.push(e.id), () => 100);
    const load = (id: string) => () => { loads++; return Promise.resolve({ id }); };
    return { cache, disposed, load, loads: () => loads };
  };

  it('binds load once; each bind needs its release; disposal waits for the last billboard', async () => {
    const { cache, disposed, load, loads } = setup();
    await cache.bind('a', load('a'));
    await cache.bind('a', load('a'));
    expect(loads()).toBe(1);
    expect(cache.refs('a')).toBe(2);
    cache.use('a');
    cache.release('a');
    cache.release('a');
    expect(disposed).toEqual([]);          // a billboard still samples it
    expect(cache.get('a')).not.toBeNull();
    cache.unuse('a');
    expect(disposed).toEqual(['a']);
    expect(cache.has('a')).toBe(false);
    cache.release('a'); cache.unuse('a');  // idempotent
    expect(disposed).toEqual(['a']);
  });

  it('a release while loading disposes the result on arrival; dispose() frees everything once', async () => {
    const { cache, disposed } = setup();
    let resolve!: (v: { id: string }) => void;
    const p = cache.bind('b', () => new Promise((res) => { resolve = res; }));
    cache.release('b');
    resolve({ id: 'b' });
    expect(await p).toBeNull();
    expect(disposed).toEqual(['b']);
    await cache.bind('c', () => Promise.resolve({ id: 'c' }));
    await cache.bind('d', () => Promise.resolve({ id: 'd' }));
    expect(cache.loaded()).toBe(2);
    expect(cache.bytes()).toBe(200);
    cache.dispose();
    cache.dispose();
    expect(disposed.sort()).toEqual(['b', 'c', 'd']);
    expect(await cache.bind('e', () => Promise.resolve({ id: 'e' }))).toBeNull();
  });
});

// ---- the pool + CreatureBillboard ------------------------------------------------------------------------------------

function desc(id: string, atlas = 'a-001', over: Partial<SpriteDescriptor> = {}): SpriteDescriptor {
  const f = (x: number) => ({ atlas, rect: [x, 0.5, x + 0.5, 1] as const, px: [x * 2048, 0, 1024, 1024] as const, footV: 0.08, aspect: 1 });
  return { id, front: f(0.5), back: f(0), heightM: 1.376, types: ['Grass'], variant: 'normal', isAlpha: false, ...over };
}

describe('§10.4.2 BillboardPool / CreatureBillboard', () => {
  it('one material per atlas; per-creature values are userData scalars; dispose returns the quad and frees the atlas', async () => {
    const pool = new BillboardPool({ decoder: fakeDecoder() });
    await pool.bindAtlas(fakeSet('a-001'));
    const a = pool.acquire(desc('x'));
    const b = pool.acquire(desc('y', 'a-001', { variant: 'dusk', isAlpha: true, types: ['Fire'] }));
    const qa = a.object.children[0] as unknown as { material: { uuid: string }; userData: Record<string, unknown> };
    const qb = b.object.children[0] as unknown as { material: { uuid: string }; userData: Record<string, unknown> };
    expect(qa.material.uuid).toBe(qb.material.uuid);
    expect(a.bound).toBe(true);
    expect(qa.userData.rect).toMatchObject({ x: 0.5, y: 0.5, z: 1, w: 1 });
    expect(qb.userData.hueShift).toBeCloseTo(VARIANT_UNIFORMS.dusk.hueShift, 9);
    expect(qb.userData.alphaGlow).toBe(1);
    // Phase D4: a shiny descriptor writes +2; setVariant without the flag keeps it, with false clears it
    const sh = pool.acquire(desc('z', 'a-001', { isShiny: true }));
    const qs = sh.object.children[0] as unknown as { userData: Record<string, unknown> };
    expect(qs.userData.alphaGlow).toBe(2);
    sh.setVariant('dawn', true);
    expect(qs.userData.alphaGlow).toBe(3);
    sh.setVariant('dawn', false, false);
    expect(qs.userData.alphaGlow).toBe(0);
    sh.dispose();
    // 2026-10-26: the descriptor's shiny palette replaces the variant's three values and survives setVariant
    const sp = pool.acquire(desc('w', 'a-001', { variant: 'dusk', isShiny: true, shinyPalette: { hue: -60, saturation: 1.4, lightness: 1.2 } }));
    const qp = sp.object.children[0] as unknown as { userData: Record<string, number> };
    expect(qp.userData.hueShift).toBeCloseTo(-Math.PI / 3, 9);
    expect(qp.userData).toMatchObject({ satMul: 1.4, lightMul: 1.2, alphaGlow: 2 });
    sp.setVariant('ember', false);
    expect(qp.userData).toMatchObject({ satMul: 1.4, lightMul: 1.2 });
    sp.setVariant('ember', false, false);
    expect(qp.userData.satMul).toBe(1.15);
    sp.dispose();
    expect((qb.userData.size as { y: number }).y).toBeCloseTo(1.6 * 1.12, 9);
    b.setFacing('back');
    expect(qb.userData.rect).toMatchObject({ x: 0, y: 0.5, z: 0.5, w: 1 });
    a.setSharp(true);
    expect(qa.userData.sharp).toBe(1);
    a.setVariant('ember', false);
    expect(qa.userData.satMul).toBe(1.15);
    expect(pool.stats()).toMatchObject({ live: 2, atlases: 1 });
    pool.releaseAtlas('a-001');
    expect(pool.stats().atlases).toBe(1);   // still sampled by two billboards
    const disposeSpy = vi.spyOn(Texture.prototype, 'dispose');
    a.dispose(); a.dispose();
    b.dispose();
    expect(pool.stats()).toMatchObject({ live: 0, atlases: 0 });
    expect(disposeSpy).toHaveBeenCalledTimes(3);   // albedo + normal + emissive of the released atlas
    disposeSpy.mockRestore();
    pool.dispose();
  });

  it('a billboard acquired before its atlas is bound stays hidden, then is re-pointed when the bind lands', async () => {
    const pool = new BillboardPool({ decoder: fakeDecoder() });
    const a = pool.acquire(desc('early', 'a-009'));
    expect(a.bound).toBe(false);
    expect(a.object.children[0]!.visible).toBe(false);
    await pool.bindAtlas(fakeSet('a-009'));
    expect(a.bound).toBe(true);
    expect(a.object.children[0]!.visible).toBe(true);
    pool.dispose();
  });

  it('poses, hurt and faint are scalar writes driven by update(dt); faint 1 hides the card and its decal', async () => {
    const pool = new BillboardPool({ decoder: fakeDecoder() });
    await pool.bindAtlas(fakeSet('a-001'));
    const b = pool.acquire(desc('p'));
    const ud = b.userDataRecord;
    b.setPosition(1, 2, 3);
    b.setPoseAxis(0, -1);
    b.setPose('lunge', 300);
    for (let t = 0; t < 120; t += 10) pool.update(10);
    expect(b.object.position.z).toBeCloseTo(3 - 0.9, 6);
    for (let t = 0; t < 200; t += 10) pool.update(10);
    expect(b.object.position.z).toBeCloseTo(3, 6);
    b.setPose('hurt', 0);
    expect(ud.hurt).toBe(1);
    for (let t = 0; t < 400; t += 10) pool.update(10);
    expect(ud.hurt).toBeLessThan(0.01);
    b.setPose('faint', 900);
    for (let t = 0; t < 1000; t += 10) pool.update(10);
    expect(ud.dissolve).toBe(1);
    expect(ud.lift).toBeCloseTo(-0.4, 6);
    expect(b.object.children[0]!.visible).toBe(false);
    expect(b.object.children[1]!.visible).toBe(false);
    b.setPose('enter', 450);
    for (let t = 0; t < 500; t += 10) pool.update(10);
    expect(ud.dissolve).toBe(0);
    expect(b.object.children[0]!.visible).toBe(true);
    pool.dispose();
  });

  it('cameraYaw faces the quad TOWARD the camera; the lean is half the camera pitch-down', () => {
    const cam = new PerspectiveCamera(28, 1, 0.5, 220);
    cam.position.set(10, 8, 10);
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld();
    const pool = new BillboardPool({ decoder: fakeDecoder(), camera: cam });
    pool.update(16);
    const yaw = pool.uniforms.cameraYaw.value;
    expect(Math.sin(yaw)).toBeCloseTo(Math.SQRT1_2, 6);   // +Z rotated by yaw points to (+x, +z): the camera side
    expect(Math.cos(yaw)).toBeCloseTo(Math.SQRT1_2, 6);
    const pitchDown = Math.atan2(8, Math.hypot(10, 10));
    expect(pool.uniforms.cameraLean.value).toBeCloseTo(BILLBOARD.leanFraction * pitchDown, 6);
    pool.dispose();
  });

  it('type colours: the rim reads types[0]; a colourblind table re-colours live billboards', async () => {
    const pool = new BillboardPool({ decoder: fakeDecoder() });
    await pool.bindAtlas(fakeSet('a-001'));
    const b = pool.acquire(desc('t', 'a-001', { types: ['Water', 'Fire'] }));
    const c = b.userDataRecord.typeColor;
    const want = hexToLinearInto(TYPE_COLORS.Water, { r: 0, g: 0, b: 0 });
    expect(c.r).toBeCloseTo(want.r, 6);
    pool.setTypeColors({ ...TYPE_COLORS, Water: '#ffffff' });
    expect(c.r).toBe(1);
    pool.dispose();
  });
});
