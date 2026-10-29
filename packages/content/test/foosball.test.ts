/**
 * The Mire Route foosball club (data/foosball.ts): a layer beside the ZoneDef, placed in the table's frame. Each
 * person's grip (their scad frame: (±10, −24) cm, the left hand at +x) must land on the rod they play.
 */
import { describe, expect, it } from 'vitest';
import { FOOSBALL_CLUB, foosballClubIn, foosballPlayer, foosballTrainers, getHeightfield, isWalkable, zone } from '../src/index';

/** Rod x (table frame, cm) and the side its grip sticks out on (the model contract). */
const RODS: Readonly<Record<string, readonly number[]>> = {
  'mire_route.foosball_mercedes': [-70, -50],
  'mire_route.foosball_klaas': [-10],
  'mire_route.foosball_mogu': [30],
  'mire_route.foosball_klinker': [-30],
  'mire_route.foosball_motor': [10],
  'mire_route.foosball_kaas': [50, 70],
};

/** A point in a model's own scad frame (cm; front −Y) -> world, as three places the GLB (front +Z, rotation.y = yaw). */
function toWorld(m: { x: number; z: number; yaw: number }, sx: number, sy: number): [number, number] {
  const gx = sx / 100; const gz = -sy / 100;
  return [m.x + gx * Math.cos(m.yaw) + gz * Math.sin(m.yaw), m.z - gx * Math.sin(m.yaw) + gz * Math.cos(m.yaw)];
}

describe('foosball club', () => {
  it('six trainers in the Mire Route only, never in the ZoneDef (the layout RNG stays untouched)', () => {
    expect(foosballTrainers('mire_route')).toHaveLength(6);
    expect(foosballTrainers('mirevale')).toEqual([]);
    expect(foosballClubIn('ash_route')).toBeNull();
    const ids = new Set(zone('mire_route').trainers.map((t) => t.id));
    for (const t of foosballTrainers('mire_route')) {
      expect(ids.has(t.id)).toBe(false);
      expect(foosballPlayer(t.id)?.trainer).toBe(t);
      expect(t.lines.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("every grip a person holds lands on its rod's grip", () => {
    const t = FOOSBALL_CLUB.table;
    for (const p of FOOSBALL_CLUB.players) {
      const rods = RODS[p.trainer.id]!;
      const grips = [toWorld(p, 10, -24), toWorld(p, -10, -24)];
      for (const rx of rods) {
        // the table's grips: team A on its −Y side, team B on +Y, centred 58 cm out
        const side = p.x < t.x ? -58 : 58;
        const want = toWorld(t, rx, side);
        const near = Math.min(...grips.map(([x, z]) => Math.hypot(x - want[0], z - want[1])));
        expect(near, `${p.trainer.id} rod ${rx}`).toBeLessThan(0.02);
      }
    }
  });

  it('everyone faces the table and stands on walkable ground', () => {
    const h = getHeightfield('mire_route');
    const t = FOOSBALL_CLUB.table;
    for (const p of [t, ...FOOSBALL_CLUB.players]) expect(isWalkable(h, p.x, p.z), p.model).toBe(true);
    for (const p of FOOSBALL_CLUB.players) {
      const [fx, fz] = [Math.sin(p.yaw), Math.cos(p.yaw)];
      expect(fx * (t.x - p.x) + fz * (t.z - p.z)).toBeGreaterThan(0.7);
    }
  });

  it('every banter line is said by a club member, never empty', () => {
    const ids = new Set(FOOSBALL_CLUB.players.map((p) => p.trainer.id));
    expect(FOOSBALL_CLUB.banter.length).toBeGreaterThan(0);
    for (const l of FOOSBALL_CLUB.banter) {
      expect(ids.has(l.by), l.by).toBe(true);
      expect(l.text.trim()).not.toBe('');
    }
  });
});
