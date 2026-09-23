import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { HeightfieldJson } from '../src/index';
import {
  ENCOUNTER_TABLES,
  LEGENDARY_STATICS,
  RAID_HOTSPOTS,
  ZONES,
  ZONE_MARGIN,
  buildHeightfield,
  decodeHeightfield,
  encodeHeightfield,
  getHeightfield,
  isWalkable,
  isWater,
  nearestWalkable,
  playableBounds,
  sampleHeight,
  walkableRatio,
} from '../src/index';

describe('heightfield (§3.11)', () => {
  it('is deterministic: the same seed builds identical arrays and digest', () => {
    const z = ZONES.find((x) => x.id === 'mire_route')!;
    const a = buildHeightfield(z);
    const b = buildHeightfield(z);
    expect(a.digest).toBe(b.digest);
    expect(Buffer.from(a.heights.buffer).equals(Buffer.from(b.heights.buffer))).toBe(true);
    expect(Buffer.from(a.walkable).equals(Buffer.from(b.walkable))).toBe(true);
    expect(Buffer.from(a.water).equals(Buffer.from(b.water))).toBe(true);
    expect(getHeightfield('mire_route')).toBe(getHeightfield('mire_route'));
    const other = buildHeightfield({ ...z, layoutSeed: z.layoutSeed + 1 });
    expect(other.digest).not.toBe(a.digest);
  });

  it('every height is a multiple of 1/64 m and exact in Float32', () => {
    const h = getHeightfield('cinderhold');
    for (let i = 0; i < h.heights.length; i += 97) {
      const v = h.heights[i]!;
      expect(Math.round(v * 64) / 64).toBe(v);
      expect(Math.fround(v)).toBe(v);
    }
  });

  it('walkable ≥ 45 % of res² in all 21 zones, and the 16 m margin is never walkable', () => {
    for (const z of ZONES) {
      const h = getHeightfield(z.id);
      expect(walkableRatio(h), z.id).toBeGreaterThanOrEqual(0.45);
      const half = h.size / 2;
      expect(isWalkable(h, -half + 2, 0)).toBe(false);
      expect(isWalkable(h, 0, half - 2)).toBe(false);
      const b = playableBounds(h);
      expect(b).toEqual({ minX: -half + ZONE_MARGIN, maxX: half - ZONE_MARGIN, minZ: -half + ZONE_MARGIN, maxZ: half - ZONE_MARGIN });
    }
  });

  it('every authored zone coordinate (spawn/npcs/trainers/items/lore/warps) is walkable', () => {
    for (const z of ZONES) {
      const h = getHeightfield(z.id);
      const pts: [string, number, number][] = [['spawn', z.spawn.x, z.spawn.z]];
      for (const n of z.npcs) pts.push([n.id, n.x, n.z]);
      for (const t of z.trainers) pts.push([t.id, t.x, t.z]);
      for (const i of z.items) pts.push([i.id, i.x, i.z]);
      for (const l of z.lore) pts.push([l.id, l.x, l.z]);
      for (const w of z.warps) {
        pts.push([w.id, w.x, w.z]);
        pts.push([`${w.id}→`, w.toX, w.toZ]);
      }
      for (const [id, x, zz] of pts) expect(isWalkable(h, x, zz), `${z.id} ${id} (${x}, ${zz})`).toBe(true);
    }
  });

  it('statics and raid hotspots snap to a walkable sample within 8 m (rule 9)', () => {
    for (const s of LEGENDARY_STATICS) {
      const h = getHeightfield(s.zoneId);
      const p = nearestWalkable(h, s.x, s.z, 8);
      expect(p, `static ${s.species}`).not.toBeNull();
      expect(isWalkable(h, p![0], p![1])).toBe(true);
    }
    for (const r of RAID_HOTSPOTS) {
      const h = getHeightfield(r.zoneId);
      expect(nearestWalkable(h, r.x, r.z, 8), `raid ${r.id}`).not.toBeNull();
    }
    // voidraxis sits exactly on the story-zone interior boundary and snaps inward
    const rift = getHeightfield('the_rift');
    const v = nearestWalkable(rift, 0, 84, 8)!;
    expect(v[1]).toBeLessThan(84);
  });

  it('zones with water slots have water, and a boardwalk sample that is both walkable and water', () => {
    for (const t of ENCOUNTER_TABLES) {
      if (!t.slots.some((s) => s.medium === 'water')) continue;
      const h = getHeightfield(t.zoneId);
      let water = 0;
      let board = 0;
      for (let i = 0; i < h.water.length; i++) {
        if (h.water[i] === 1) water++;
        if (h.water[i] === 1 && h.walkable[i] === 1) board++;
      }
      expect(water, t.zoneId).toBeGreaterThan(0);
      expect(board, t.zoneId).toBeGreaterThan(0);
    }
  });

  it('sampleHeight is bilinear inside and NaN outside; isWalkable/isWater are false outside', () => {
    const h = getHeightfield('mirevale');
    expect(Number.isNaN(sampleHeight(h, 1000, 0))).toBe(true);
    expect(isWalkable(h, 1000, 0)).toBe(false);
    expect(isWater(h, 1000, 0)).toBe(false);
    const i = 160 * h.res + 160;
    expect(sampleHeight(h, 0, 0)).toBe(h.heights[i]!);
    const mid = sampleHeight(h, 0.25, 0);
    const lo = Math.min(h.heights[i]!, h.heights[i + 1]!);
    const hi = Math.max(h.heights[i]!, h.heights[i + 1]!);
    expect(mid).toBeGreaterThanOrEqual(lo);
    expect(mid).toBeLessThanOrEqual(hi);
  });

  it('nearestWalkable returns the nearest walkable centre and null when none within radius', () => {
    const h = getHeightfield('mirevale');
    const p = nearestWalkable(h, 0, 6, 8)!;
    expect(p).toEqual([0, 6]);
    expect(nearestWalkable(h, -79, -79, 0.4)).toBeNull();
  });

  it('encode/decode round-trips bit for bit', () => {
    const h = getHeightfield('saltmourn');
    const json = encodeHeightfield(h);
    const back = decodeHeightfield(json);
    expect(back.digest).toBe(h.digest);
    expect(Buffer.from(back.heights.buffer).equals(Buffer.from(h.heights.buffer))).toBe(true);
  });

  it('the committed dist/heightfields/<zone>.json files match the builder digests', () => {
    const dir = fileURLToPath(new URL('../dist/heightfields/', import.meta.url));
    for (const z of ZONES) {
      const file = `${dir}${z.id}.json`;
      expect(existsSync(file), file).toBe(true);
      const json = JSON.parse(readFileSync(file, 'utf8')) as HeightfieldJson;
      expect(json.digest, z.id).toBe(getHeightfield(z.id).digest);
      expect(decodeHeightfield(json).digest).toBe(json.digest);
    }
  });
});
