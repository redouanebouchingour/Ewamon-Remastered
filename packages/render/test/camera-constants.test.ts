/**
 * §50.4.6 `camera-constants.test.ts`: `camera/rig.ts` exports exactly the §10.7.1 table, the position formula
 * reproduces height 20.49 m / offset 16.01 m at stop 1, and a grep of `camera/*.ts` finds no other numeric literal
 * outside the constants regions (the §10.7.1 table, the §10.7.4 arena constants + CameraWork, the §10.7.3 DOF table).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PerspectiveCamera } from 'three/webgpu';
import { ALL_EFFECTS } from '../src/descriptors.js';
import * as rig from '../src/camera/rig.js';
import * as battle from '../src/camera/battle.js';
import * as dof from '../src/camera/dof.js';
import { POST_PARAMS } from '../src/post/pipeline.js';

const CAMERA_DIR = fileURLToPath(new URL('../src/camera/', import.meta.url));

describe('§10.7.1 DioramaCamera constants', () => {
  it('exports exactly the table', () => {
    expect(rig.FOV_V).toBe(28);
    expect(rig.PITCH).toBe(-52);
    expect(rig.YAW_BASE).toBe(-35);
    expect(rig.HEADING_STEP).toBe(90);
    expect([...rig.DISTANCE]).toEqual([20, 26, 34]);
    expect(rig.DEFAULT_ZOOM_STOP).toBe(1);
    expect(rig.SPRING_TAU).toBe(0.12);
    expect(rig.DEAD_ZONE).toBe(0.8);
    expect(rig.HEADING_TURN_MS).toBe(320);
    expect(rig.ZOOM_MS).toBe(260);
  });

  it('heading k → yaw −35° + 90°·k', () => {
    for (let k = 0; k < 4; k++) expect(rig.headingYaw(k)).toBeCloseTo((-35 + 90 * k) * Math.PI / 180, 12);
  });

  it('the position formula gives height 20.49 m and horizontal offset 16.01 m at stop 1', () => {
    const o = rig.dioramaOffset(26);
    expect(o.height).toBeCloseTo(20.49, 2);
    expect(o.horizontal).toBeCloseTo(16.01, 2);
    const cam = new PerspectiveCamera(50, 16 / 9, 0.5, 220);
    const r = new rig.DioramaRig(cam, { effects: () => ALL_EFFECTS });
    r.setFocus(3, 1, -4);
    r.update(16);
    expect(cam.fov).toBe(28);
    expect(cam.position.y - 1).toBeCloseTo(20.49, 2);
    expect(Math.hypot(cam.position.x - 3, cam.position.z + 4)).toBeCloseTo(16.01, 2);
    // heading 0 looks along (sin 35°, −, −cos 35°)·… : the camera sits at yaw −35° from the target
    expect(Math.atan2(cam.position.x - 3, cam.position.z + 4)).toBeCloseTo(-35 * Math.PI / 180, 6);
  });

  it('§10.7.4 arena constants and the Pillar 7 bound (12 m + 5.5 m / 2 < 40)', () => {
    expect(battle.BATTLE_DISTANCE).toBe(12);
    expect(battle.BATTLE_PITCH).toBe(-28);
    expect(battle.BATTLE_YAW_OFFSET).toBe(12);
    expect(battle.BATTLER_SEPARATION).toBe(5.5);
    expect(battle.PUSH_IN_MS).toBe(600);
    expect(battle.BATTLE_DISTANCE + battle.BATTLER_SEPARATION / 2).toBeLessThan(battle.PILLAR7_RADIUS);
    expect(battle.CAMERA_WORK.impact).toEqual({ push: { distance: 1.2, ms: 90 }, orbit: null, shake: { amp: 0.25, ms: 180 }, slowmo: null, hold: 200 });
    expect(battle.CAMERA_WORK.ko.slowmo).toEqual({ scale: 0.35, ms: 400 });
    expect(Object.keys(battle.CAMERA_WORK).sort()).toEqual([...battle.CUE_KINDS].sort());
  });

  it('§10.7.3 TiltShiftDOF numbers agree with the post graph; the Pillar 1 CoC arithmetic (IMPLEMENTATION-NOTES P9)', () => {
    expect(dof.TILT_DEG).toBe(POST_PARAMS.dof.tiltDeg);
    expect(dof.FOCAL_LENGTH_M).toBe(POST_PARAMS.dof.focalLength);
    expect(dof.BOKEH_PX).toBe(POST_PARAMS.dof.bokehPx);
    const d = dof.groundOffPlaneM(dof.PILLAR1_OFFSET_M, 52);
    expect(d).toBeCloseTo(2.90, 2);                         // 12 · cos 76° = 12 · 0.2419
    // SPEC §10.7.3 states smoothstep(0, 6, 2.90) = 0.518 → 3.1 px; the formula gives 0.475 → 2.85 px at pr 1.
    expect(dof.circleOfConfusionPx(d)).toBeCloseTo(2.85, 2);
    // the ≥ 3 px requirement holds from pixel ratio 1.06 up (e.g. 1440p at pr 1.5 → 4.3 px)
    expect(dof.circleOfConfusionPx(d, 1.06)).toBeGreaterThanOrEqual(dof.PILLAR1_MIN_COC_PX);
    expect(dof.circleOfConfusionPx(d, 1.5)).toBeCloseTo(4.28, 1);
    expect(dof.circleOfConfusionPx(4)).toBeCloseTo(4.44, 1);   // 4 m above the plane (SPEC: 4.1)
    expect(dof.circleOfConfusionPx(0)).toBe(0);
    expect(dof.circleOfConfusionPx(9)).toBe(6);
  });
});

/** Strips comments, string literals and the `#region constants` blocks, then lists numeric literals. */
function literalsOutsideConstants(src: string): number[] {
  let s = src.replace(/\/\/ #region constants[\s\S]*?\/\/ #endregion/g, '');
  s = s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  s = s.replace(/`(?:\\.|[^`\\])*`/g, '``').replace(/'(?:\\.|[^'\\])*'/g, "''").replace(/"(?:\\.|[^"\\])*"/g, '""');
  const out: number[] = [];
  for (const m of s.matchAll(/(?<![\w.$])(\d+(?:\.\d+)?(?:e[-+]?\d+)?)(?![\w$])/gi)) out.push(Number(m[1]));
  return out;
}

describe('§50.4.6: no numeric literal in camera/*.ts outside the constants tables', () => {
  // structural literals only: 0/1/2 (identity, halves, doubling), 3 (the smoothstep polynomial), 180 (degrees → radians), 1000 (ms → s)
  const ALLOWED = new Set([0, 1, 2, 3, 180, 1000]);
  for (const f of readdirSync(CAMERA_DIR).filter((n) => n.endsWith('.ts'))) {
    it(`camera/${f}`, () => {
      const lits = literalsOutsideConstants(readFileSync(join(CAMERA_DIR, f), 'utf8'));
      expect(lits.filter((n) => !ALLOWED.has(n))).toEqual([]);
    });
  }
});
