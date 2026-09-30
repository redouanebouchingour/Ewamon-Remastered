/**
 * Pixel-art characters (node, no GPU): facing quantisation with hysteresis, distance-driven gait frames, emotes,
 * the manifest frame tables (variant / base / hash fallbacks), and the `CharacterPool` over a synthetic manifest:
 * one instanced card on one billboard material, frame rects written per update, the leaned nameplate anchor, one instanced decal
 * draw, the DOF-sharp local player, disposal, and the real `public/characters` manifest when present.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { NearestFilter, PerspectiveCamera, Vector3 } from 'three/webgpu';
import { uniform } from 'three/tsl';
import {
  CHAR_ANIM, FACING_D, FACING_L, FACING_R, FACING_U, STATE_CHEER, STATE_IDLE, STATE_RUN, STATE_WALK, STATE_WAVE, createCharAnim, emoteState,
  facingFor, facingOf, frameIndex, stepCharAnim,
} from '../src/sprites/characterAnim.js';
import { CharacterFrames, parseCharactersManifest, type CharactersManifest, type CharRect } from '../src/sprites/characterAtlas.js';
import { ACTOR_POOL_SIZE, CharacterPool } from '../src/stage/actors.js';
import type { AtlasDecoder } from '../src/sprites/atlas.js';

const DEG = Math.PI / 180;

// ---- a synthetic manifest: two looks + a variant, every frame's rect encodes (look, facing, state, index) --------

const FACINGS = ['D', 'U', 'L', 'R'] as const;
const COUNTS: Record<string, number> = { idle: 2, walk: 4, run: 4, wave: 2, cheer: 2 };
function rect(look: number, f: number, s: number, i: number): CharRect { return [look / 10, f / 10, s / 10, i / 10]; }
function manifest(): CharactersManifest {
  const looks: Record<string, CharactersManifest['looks'][string]> = {};
  ['casual_male', 'knight_male', 'knight_male:forge'].forEach((id, li) => {
    const frames: Record<string, Record<string, CharRect[]>> = {};
    FACINGS.forEach((f, fi) => {
      frames[f] = {};
      Object.entries(COUNTS).forEach(([s, n], si) => {
        if ((s === 'wave' || s === 'cheer') && f !== 'D') return;
        frames[f]![s] = Array.from({ length: n }, (_, i) => rect(li, fi, si, i));
      });
    });
    looks[id] = { atlas: 'chars-0', heightPx: 44, frames };
  });
  return {
    version: 1, cell: { w: 32, h: 52 }, footV: 1 / 52, pixelsPerMetre: 40 / 1.7, cellM: { w: 32 / (40 / 1.7), h: 52 / (40 / 1.7) },
    fps: { idle: 1.6, walk: 7, run: 11, wave: 5, cheer: 4 }, cycleM: { walk: 1.3, run: 2.4 },
    atlases: [{ id: 'chars-0', width: 2048, height: 884, albedo: 'atlas/a.webp', normal: 'atlas/n.webp', hash: 'abcdef0123456789' }],
    looks, totalBytes: 1,
  };
}

const decoder = (): AtlasDecoder & { urls: string[]; closed: number } => {
  const d = {
    urls: [] as string[], closed: 0,
    async decode(url: string) { d.urls.push(url); return { width: 2048, height: 884, close: () => { d.closed++; } }; },
  };
  return d;
};

function camera(): PerspectiveCamera {
  const cam = new PerspectiveCamera(28, 16 / 9, 0.5, 220);
  cam.position.set(0, 20.49, 16.01); cam.lookAt(0, 0, 0); cam.updateMatrixWorld();
  return cam;
}

async function readyPool(): Promise<{ pool: CharacterPool; dec: ReturnType<typeof decoder>; cam: PerspectiveCamera }> {
  const dec = decoder();
  const cam = camera();
  const pool = new CharacterPool({
    harvestLevel: uniform(0), camera: cam, viewport: () => ({ w: 1280, h: 720 }), charactersUrl: '/characters/', decoder: dec,
    fetchJson: async () => manifest(),
  });
  expect(await pool.ready).toBe(true);
  return { pool, dec, cam };
}

// ---- facing -----------------------------------------------------------------------------------------------------

describe('facing: heading relative to the camera, quantised to 4', () => {
  it('sectors: toward the camera D, away U, screen-left L, screen-right R; diagonals read as side views', () => {
    expect(facingOf(0)).toBe(FACING_D);
    expect(facingOf(Math.PI)).toBe(FACING_U);
    expect(facingOf(-Math.PI / 2)).toBe(FACING_L);
    expect(facingOf(Math.PI / 2)).toBe(FACING_R);
    expect(facingOf(45 * DEG)).toBe(FACING_R);          // a screen diagonal → side view
    expect(facingOf(-135 * DEG)).toBe(FACING_L);
    expect(facingOf(35 * DEG)).toBe(FACING_D);
    expect(facingOf(150 * DEG)).toBe(FACING_U);
  });

  it('hysteresis: a facing holds 8° past its sector edge, so a diagonal walk does not flicker', () => {
    const yaw = 0.7;
    expect(facingFor(yaw + 36 * DEG, yaw, FACING_R)).toBe(FACING_R);   // 36° is in D's sector but R holds to 32°
    expect(facingFor(yaw + 30 * DEG, yaw, FACING_R)).toBe(FACING_D);
    expect(facingFor(yaw + 44 * DEG, yaw, FACING_D)).toBe(FACING_D);   // D holds to 48°
    expect(facingFor(yaw + 49 * DEG, yaw, FACING_D)).toBe(FACING_R);
    expect(facingFor(yaw + Math.PI + 4 * Math.PI, yaw, FACING_L)).toBe(FACING_U);   // wraps
  });
});

// ---- animation ----------------------------------------------------------------------------------------------------

describe('gait and emotes', () => {
  it('idle breathes at 1.6 fps; walk advances with distance (speed / 1.3 m × 4), clamped; run likewise', () => {
    const a = createCharAnim();
    for (let i = 0; i < 60; i++) stepCharAnim(a, 1000 / 60, 0, 0, 0, false, false, 0, 0);
    expect(a.state).toBe(STATE_IDLE);
    expect(a.t).toBeCloseTo(1.6, 1);
    const w = createCharAnim();
    let x = 0;
    for (let i = 0; i < 120; i++) { x += 2.6 / 60; stepCharAnim(w, 1000 / 60, x, 0, Math.PI / 2, true, false, 0, 0); }
    expect(w.state).toBe(STATE_WALK);
    expect(w.facing).toBe(FACING_R);
    expect(w.speed).toBeCloseTo(2.6, 1);
    // ≈ 2 s at 2.6 m/s: (2.6 / 1.3) × 4 = 8 fps → ≈ 16 frames (minus the speed smoothing's first frames)
    expect(w.t).toBeGreaterThan(14); expect(w.t).toBeLessThan(16.5);
    const r = createCharAnim();
    for (let i = 0; i < 30; i++) stepCharAnim(r, 1000 / 60, 0, 0, 0, true, true, 0, 0);   // running in place: nominal rate
    expect(r.state).toBe(STATE_RUN);
    expect(r.t).toBeCloseTo(CHAR_ANIM.runFps * 0.5, 1);
  });

  it('walk ↔ run keeps the stride phase; stopping restarts idle; a teleport never reads as speed', () => {
    const a = createCharAnim();
    for (let i = 0; i < 20; i++) stepCharAnim(a, 16, 0, 0, 0, true, false, 0, 0);
    const t = a.t;
    stepCharAnim(a, 0, 0, 0, 0, true, true, 0, 0);
    expect(a.state).toBe(STATE_RUN);
    expect(a.t).toBe(t);
    stepCharAnim(a, 16, 0, 0, 0, false, false, 0, 0);
    expect(a.state).toBe(STATE_IDLE);
    expect(a.t).toBeLessThan(0.1);
    const b = createCharAnim();
    stepCharAnim(b, 16, 0, 0, 0, true, false, 0, 0);
    stepCharAnim(b, 16, 50, 0, 0, true, false, 0, 0);
    expect(b.speed).toBe(0);
  });

  it('emotes: wave / cool → wave, happy / heart → cheer, facing the camera, only while standing', () => {
    expect([1, 2, 3, 4, 5, 6].map(emoteState)).toEqual([STATE_WAVE, STATE_CHEER, STATE_IDLE, STATE_IDLE, STATE_CHEER, STATE_WAVE]);
    const a = createCharAnim();
    stepCharAnim(a, 16, 0, 0, Math.PI, false, false, 1, 0);
    expect(a.state).toBe(STATE_WAVE);
    expect(a.facing).toBe(FACING_D);
    stepCharAnim(a, 16, 0, 0, Math.PI, true, false, 1, 0);
    expect(a.state).toBe(STATE_WALK);
    expect(a.facing).toBe(FACING_U);
    a.t = 5.5;
    expect(frameIndex(a, 4)).toBe(1);
    expect(frameIndex(a, 1)).toBe(0);
  });
});

// ---- manifest ------------------------------------------------------------------------------------------------------

describe('manifest frame tables', () => {
  it('parses version 1 only; resolves exact ids, variants to their base, unknown ids to a stable base look', () => {
    expect(parseCharactersManifest({ version: 2 })).toBeNull();
    expect(parseCharactersManifest(null)).toBeNull();
    const f = new CharacterFrames(parseCharactersManifest(manifest())!);
    expect(f.resolve('knight_male:forge').id).toBe('knight_male:forge');
    expect(f.resolve('casual_male:dusk').id).toBe('casual_male');
    expect(f.baseIds).toEqual(['casual_male', 'knight_male']);
    const pick = f.resolve('ranger_m').id;
    expect(f.baseIds).toContain(pick);
    expect(f.resolve('ranger_m').id).toBe(pick);
    const k = f.resolve('knight_male');
    expect(k.heightM).toBeCloseTo(44 / (40 / 1.7), 6);
    // D wave has 2 frames; U has no wave → falls back to U idle
    expect(k.count[0 * 5 + 3]).toBe(2);
    expect(k.count[1 * 5 + 3]).toBe(2);
    expect(k.rects[k.first[1 * 5 + 3]! * 4 + 1]).toBeCloseTo(0.1, 6);   // facing U (1/10)
    expect(k.rects[k.first[1 * 5 + 3]! * 4 + 2]).toBeCloseTo(0, 6);     // state idle (0/10)
  });
});

// ---- the pool ------------------------------------------------------------------------------------------------------

describe('CharacterPool (pixel-art billboards)', () => {
  it('loads the manifest + the two atlas maps once, cache-busted by the atlas hash', async () => {
    const { pool, dec } = await readyPool();
    expect(dec.urls).toEqual(['/characters/atlas/a.webp?v=abcdef01', '/characters/atlas/n.webp?v=abcdef01']);
    expect(pool.atlasReady).toBe(true);
    const alb = (pool.material.userData as { ewaAlbedo: { magFilter: number; anisotropy: number } }).ewaAlbedo;
    expect(alb.magFilter).toBe(NearestFilter);                         // Pillar 6 / the sprites.nearest audit
    expect(alb.anisotropy).toBe(1);
    expect((pool.material.userData as { ewaClass: string }).ewaClass).toBe('billboard');
    pool.dispose();
  });

  it('every actor is one instance of ONE card on ONE material; the frame is the instance rect', async () => {
    const { pool } = await readyPool();
    pool.spawn('me', { look: 'knight_male:forge', name: 'Rowan', guildTag: '', isLocal: true });
    pool.spawn('npc', { look: 'casual_male', name: 'Isla', guildTag: '', isLocal: false });
    pool.spawn('ghost', { look: 'spectator_7_2', name: '', guildTag: '', isLocal: false });
    expect(pool.cardMesh.material).toBe(pool.material);
    expect((pool.cardMesh.geometry as { instanceCount: number }).instanceCount).toBe(3);
    expect(pool.cardMesh.castShadow).toBe(true);
    expect(pool.isShown('me')).toBe(true);
    expect(pool.sharpOf('me')).toBe(1);                                // the local player is DOF-sharp
    expect(pool.sharpOf('npc')).toBe(0);
    expect(pool.lookOf('ghost')).toMatch(/^(casual_male|knight_male)$/);
    // walking screen-right relative to the camera → the R walk frames of look 2 (the variant)
    const yaw = Math.atan2(0, 16.01);                                  // toward the camera from the origin
    pool.update(16);                                                   // writes the pool's own yaw uniform
    expect(pool.uniforms.cameraYaw.value).toBeCloseTo(yaw, 5);
    pool.setTransform('me', 0, 0, yaw + Math.PI / 2, true, false);
    pool.update(16);
    const r = pool.rectOf('me')!;
    expect([r[0], r[1], r[2]]).toEqual([expect.closeTo(0.2, 6), expect.closeTo(0.3, 6), expect.closeTo(0.1, 6)]);   // look 2, R, walk
    expect(pool.frameOf('me')).toEqual({ facing: 'R', state: 'walk', frame: 0 });
    for (let i = 0; i < 12; i++) pool.update(1000 / 60);
    expect(pool.frameOf('me')!.frame).toBe(1);                         // 7 fps nominal (walking in place) → frame 1 after ~0.2 s
    pool.despawn('ghost');
    expect((pool.cardMesh.geometry as { instanceCount: number }).instanceCount).toBe(2);
    pool.despawn('me'); pool.despawn('npc');
    expect((pool.cardMesh.geometry as { instanceCount: number }).instanceCount).toBe(0);   // no live actor: no draw
    pool.dispose();
  });

  it('feet on the collider, the decal on its normal; all decals are one instanced draw', async () => {
    const { pool } = await readyPool();
    pool.setGround((x, z) => 0.1 * x + 0.05 * z);
    pool.spawn('a', { look: 'casual_male', name: '', guildTag: '', isLocal: false });
    pool.spawn('b', { look: 'casual_male', name: '', guildTag: '', isLocal: false });
    pool.setTransform('a', 2, 4, 0, false, false);
    expect(pool.feetOf('a', new Vector3())!.toArray()).toEqual([2, expect.closeTo(0.4, 9), 4]);
    const iFeet = pool.cardMesh.geometry.getAttribute('iFeet');
    expect([iFeet.getX(0), iFeet.getY(0), iFeet.getZ(0)]).toEqual([2, expect.closeTo(0.4, 6), 4]);
    const decals = pool.decalMesh;
    expect(decals.count).toBe(2);
    expect(decals.parent).toBe(pool.root);
    const m = new (await import('three/webgpu')).Matrix4();
    decals.getMatrixAt(0, m);
    const pos = new Vector3().setFromMatrixPosition(m);
    expect(pos.toArray()).toEqual([2, expect.closeTo(0.4, 6), 4]);   // float32 instance matrix
    // the decal plane's normal (its local +Z) follows the slope (−0.1, 1, −0.05) normalised
    const n = new Vector3(0, 0, 1).transformDirection(m);
    expect(n.x).toBeLessThan(-0.05); expect(n.y).toBeGreaterThan(0.99);
    pool.despawn('b');
    expect(decals.count).toBe(1);
    pool.despawn('a');
    expect(decals.count).toBe(0);
    pool.dispose();
  });

  it('nameplates anchor on the LEANED head top: higher on screen than an upright anchor at the same height', async () => {
    const { pool, cam } = await readyPool();
    pool.spawn('a', { look: 'casual_male', name: 'A', guildTag: '', isLocal: false });
    pool.setTransform('a', 0, 0, 0, false, false);
    pool.update(16);
    expect(pool.uniforms.cameraLean.value).toBeCloseTo(26 * DEG, 2);
    const out = new Float32Array(2);
    expect(pool.projectHead('a', out, 0)).toBe(true);
    const h = 44 / (40 / 1.7) + 0.16;
    const up = new Vector3(0, h, 0).project(cam);
    const upY = (-up.y * 0.5 + 0.5) * 720;
    expect(out[1]).toBeLessThan(upY - 20);
    const xy = new Float32Array(4);
    expect(pool.screenPositions(xy)).toBe(1);
    expect(xy[1]).toBeCloseTo(out[1]!, 3);
    pool.dispose();
  });

  it('48 preallocated rigs, dev throws when exhausted; actors stay hidden without an atlas', () => {
    const pool = new CharacterPool({ harvestLevel: uniform(0), camera: camera() });
    expect(pool.capacity).toBe(ACTOR_POOL_SIZE);
    for (let i = 0; i < ACTOR_POOL_SIZE; i++) pool.spawn(`a${i}`, { look: 'x', name: '', guildTag: '', isLocal: false });
    expect(() => pool.spawn('overflow', { look: 'x', name: '', guildTag: '', isLocal: false })).toThrow(RangeError);
    expect(pool.isShown('a0')).toBe(false);
    expect(pool.frameOf('a0')).toBeNull();
    pool.dispose();
  });

  it('dispose frees the material, the textures, both geometries and the decals once; the bitmaps are closed', async () => {
    const { pool, dec } = await readyPool();
    const geo = vi.spyOn(pool.cardMesh.geometry, 'dispose');
    const mat = vi.spyOn(pool.material, 'dispose');
    const tex = vi.spyOn((pool.material.userData as { ewaAlbedo: { dispose(): void } }).ewaAlbedo, 'dispose');
    const decals = vi.spyOn(pool.decalMesh, 'dispose');
    pool.dispose(); pool.dispose();
    expect(mat).toHaveBeenCalledTimes(1);
    expect(tex).toHaveBeenCalledTimes(1);
    expect(decals).toHaveBeenCalledTimes(1);
    expect(geo).toHaveBeenCalledTimes(1);
    expect(dec.closed).toBe(2);
    expect(pool.root.parent).toBeNull();
  });

  it('a failed manifest warns once and keeps actors hidden', async () => {
    const warn = vi.fn();
    const pool = new CharacterPool({ harvestLevel: uniform(0), charactersUrl: '/c/', decoder: decoder(), fetchJson: async () => { throw new Error('404'); }, warn });
    expect(await pool.ready).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    pool.spawn('a', { look: 'casual_male', name: '', guildTag: '', isLocal: false });
    expect(pool.isShown('a')).toBe(false);
    pool.dispose();
  });
});

// ---- the real output -------------------------------------------------------------------------------------------------

const REAL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/public/characters/characters.manifest.json');

describe.skipIf(!existsSync(REAL))('public/characters (real manifest)', () => {
  it('parses; every look has the full facing × state table; a character stands ~1.7 m in a ~2.2 m cell', () => {
    const m = parseCharactersManifest(JSON.parse(readFileSync(REAL, 'utf8')))!;
    expect(m).not.toBeNull();
    const f = new CharacterFrames(m);
    expect(f.looks.size).toBeGreaterThanOrEqual(19);
    for (const l of f.looks.values()) {
      for (let k = 0; k < 20; k++) expect(l.count[k]).toBeGreaterThanOrEqual(2);
      expect(l.heightM).toBeGreaterThan(1.6); expect(l.heightM).toBeLessThan(2.2);
    }
    expect(m.cellM.h).toBeCloseTo(52 / (40 / 1.7), 3);
  });
});
