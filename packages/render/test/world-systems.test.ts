/**
 * Phase D8 / D10 render: the collider's surf mode and water surface, the actor pool riding it with a ripple, and the
 * zone builder's per-player obstacles.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Matrix4, Vector3 } from 'three/webgpu';
import { uniform } from 'three/tsl';
import { decodeHeightfield, type HeightfieldJson } from '@ewa/content';
import { TerrainCollider, resolveMove } from '../src/terrain/collider.js';
import { waterBodies } from '../src/terrain/field.js';
import { createPrng } from '../src/zone/prng.js';
import { CharacterPool, RIPPLE } from '../src/stage/actors.js';

const fixture = (id: string) => decodeHeightfield(JSON.parse(readFileSync(fileURLToPath(new URL(`../../content/dist/heightfields/${id}.json`, import.meta.url)), 'utf8')) as HeightfieldJson);

/** A boardwalk sample with open water 2.5 m to its +z (a pier into the pond). */
function pier(c: TerrainCollider, h: ReturnType<typeof fixture>): { x: number; z: number } {
  for (let row = 0; row < h.res; row++) for (let col = 0; col < h.res; col++) {
    const i = row * h.res + col;
    if (h.walkable[i] !== 1 || h.water[i] !== 1) continue;
    const x = h.originX + col * h.step; const z = h.originZ + row * h.step;
    if (c.onWater(x, z + 2.5) && c.onWater(x, z + 3.5)) return { x, z };
  }
  throw new Error('no pier');
}

describe('Phase D8 surf mode (TerrainCollider)', () => {
  const h = fixture('mire_route');
  const c = new TerrainCollider(h);
  const p = pier(c, h);

  it('open water is passable only in surf mode; the surfer stands on the body level', () => {
    const wx = p.x; const wz = p.z + 3;
    expect(c.water(wx, wz)).toBe(true);
    expect(c.walkable(wx, wz)).toBe(false);
    expect(c.onWater(wx, wz)).toBe(true);
    expect(c.passable(wx, wz)).toBe(false);
    expect(c.passable(wx, wz, true)).toBe(true);
    const labels = new Int32Array(h.res * h.res);
    const bodies = waterBodies(h, labels);
    const col = Math.round((wx - h.originX) / h.step); const row = Math.round((wz - h.originZ) / h.step);
    const body = bodies[labels[row * h.res + col]!]!;
    expect(c.waterLevel(wx, wz)).toBeCloseTo(body.level, 6);
    expect(c.surfaceY(wx, wz)).toBeCloseTo(body.level, 6);
    expect(c.surfaceY(wx, wz)).toBeGreaterThan(c.sample(wx, wz));
    // on land / the boardwalk the surface is the terrain
    expect(c.onWater(p.x, p.z)).toBe(false);
    expect(c.surfaceY(p.x, p.z)).toBe(c.sample(p.x, p.z));
    expect(c.waterLevel(-70, 0)).toBeNaN();
    // bodies discovered with labels are the same bodies as without
    expect(bodies).toEqual(waterBodies(h));
  });

  it('resolveMove steps off the pier onto the water only with surf, at the level', () => {
    let z = p.z;
    while (c.walkable(p.x, z + 0.25)) z += 0.25;
    const dry = resolveMove(c, p.x, z, 0, 0.4);
    expect(c.passable(dry.x, dry.z)).toBe(true);
    const wet = resolveMove(c, p.x, z, 0, 0.4, true);
    expect(wet.blocked).toBe(false);
    expect(wet.z).toBeCloseTo(z + 0.4, 9);
    expect(c.onWater(wet.x, wet.z)).toBe(true);
    expect(wet.y).toBeCloseTo(c.surfaceY(wet.x, wet.z), 9);
    // and climbs back out onto the boardwalk
    const back = resolveMove(c, wet.x, wet.z, 0, -0.4, true);
    expect(back.blocked).toBe(false);
  });

  it('never returns a non-passable position in surf mode over 5 000 random displacements around the pond', () => {
    const r = createPrng(0x5f);
    let x = p.x; let z = p.z;
    for (let i = 0; i < 5000; i++) {
      const a = r.range(0, Math.PI * 2); const len = r.range(0, 0.12);
      const m = resolveMove(c, x, z, Math.cos(a) * len, Math.sin(a) * len, true);
      expect(c.passable(m.x, m.z, true)).toBe(true);
      expect(Math.hypot(m.x - x, m.z - z)).toBeLessThanOrEqual(len + 1e-9);
      x = m.x; z = m.z;
    }
  });
});

describe('Phase D8 actors on water', () => {
  it('an actor on open water rides the level with a ripple instead of the contact decal', () => {
    const h = fixture('mire_route');
    const c = new TerrainCollider(h);
    const p = pier(c, h);
    const pool = new CharacterPool({ harvestLevel: uniform(0) });
    pool.setGround((x, z) => c.surfaceY(x, z), (x, z) => c.onWater(x, z));
    pool.spawn('a', { look: 'casual_male', name: 'A', guildTag: '', isLocal: false });
    pool.setTransform('a', p.x, p.z + 3, 0, false, false);
    const feet = pool.feetOf('a', new Vector3())!;
    expect(feet.y).toBeCloseTo(c.surfaceY(p.x, p.z + 3), 6);
    expect(pool.onWater('a')).toBe(true);
    const ripples = pool.root.children.find((o) => o.name === 'ewa:surf-ripples') as unknown as { count: number; getMatrixAt(i: number, m: Matrix4): void };
    expect(ripples).toBeDefined();
    expect(ripples.count).toBe(1);
    const m = new Matrix4();
    ripples.getMatrixAt(0, m);
    const s = new Vector3().setFromMatrixScale(m);
    expect(s.x).toBeCloseTo(RIPPLE.sizeM, 6);
    // back on land: the ripple slot collapses
    pool.setTransform('a', p.x, p.z, 0, false, false);
    expect(pool.onWater('a')).toBe(false);
    ripples.getMatrixAt(0, m);
    expect(new Vector3().setFromMatrixScale(m).x).toBe(0);
    pool.dispose();
  });
});

describe('Phase D10 obstacles in the zone builder', () => {
  it('each obstacle is its own object; setCleared swaps a tree for its stump and hides a boulder', async () => {
    const { buildZone } = await import('../src/zone/builder.js');
    const { mockLibrary, realSpec } = await import('./zone-helpers.js');
    const lib = await mockLibrary();
    const base = realSpec('mire_route');
    const spec = { ...base, obstacles: [{ id: 't1', kind: 'tree' as const, x: -78, z: -54 }, { id: 'b1', kind: 'boulder' as const, x: -60, z: 40 }] };
    const z = buildZone(spec, { materials: lib, lighting: null, scene: null });
    const plain = buildZone(base, { materials: lib, lighting: null, scene: null });
    expect(plain.obstacles).toBeUndefined();
    expect(z.geometryDigest).not.toBe(plain.geometryDigest);
    const o = z.obstacles!;
    expect(o.ids).toEqual(['t1', 'b1']);
    const tree = z.group.getObjectByName('ewa:obstacle:t1')!;
    const stump = z.group.getObjectByName('ewa:obstacle:t1:stump')!;
    const rock = z.group.getObjectByName('ewa:obstacle:b1')!;
    expect(tree.visible && !stump.visible && rock.visible).toBe(true);
    expect(tree.position.x).toBe(-78);
    o.setCleared('t1', true);
    o.setCleared('b1', true);
    o.setCleared('nope', true);
    expect(!tree.visible && stump.visible && !rock.visible).toBe(true);
    expect(o.isCleared('t1') && o.isCleared('b1') && !o.isCleared('nope')).toBe(true);
    o.setCleared('t1', false);
    expect(tree.visible && !stump.visible).toBe(true);
    z.dispose();
    plain.dispose();
  }, 120_000);
});
