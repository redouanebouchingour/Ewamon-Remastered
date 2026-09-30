/**
 * IMPLEMENTATION-NOTES Part 5, T2 (+ audit M2-battle-5 / -6): the battle camera frames both battlers — the near one's
 * feet, the taller top plus the HP-bar allowance — inside the screen band above the DOM battle panel, in the pushed-in
 * pose and in every frame of a cue; the HUD keeps battle bars above the panel.
 */
import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three/webgpu';
import { ALL_EFFECTS } from '../src/descriptors.js';
import { DioramaRig, headingYaw } from '../src/camera/rig.js';
import {
  BATTLE_DISTANCE, BATTLE_DISTANCE_MAX, BATTLER_SEPARATION, FRAME_BOTTOM_GAP, PANEL_DEFAULT_FRACTION, battleFraming, forwardOfYaw,
} from '../src/camera/battle.js';
import { CanvasHudLayer, HUD, type HudSurface } from '../src/hud/layer.js';

const FRAME = 1000 / 60;
const run = (r: DioramaRig, ms: number): void => { for (let t = 0; t < ms - 1e-9; t += FRAME) r.update(Math.min(FRAME, ms - t)); };

/** Screen y (share of the height from the top) of the near feet / the two tops for the rig's current camera. */
function battlerRows(cam: PerspectiveCamera, centre: Vector3, yaw: number, nearH: number, farH: number): { nearFeet: number; farFeet: number; topMin: number } {
  const f = forwardOfYaw(yaw, new Vector3());
  const half = BATTLER_SEPARATION / 2;
  const y = (x: number, yy: number, z: number): number => (1 - new Vector3(x, yy, z).project(cam).y) / 2;
  const nx = centre.x - f.x * half; const nz = centre.z - f.z * half; const fx = centre.x + f.x * half; const fz = centre.z + f.z * half;
  return { nearFeet: y(nx, centre.y, nz), farFeet: y(fx, centre.y, fz), topMin: Math.min(y(nx, centre.y + nearH, nz), y(fx, centre.y + farH, fz)) };
}

function battleRig(top: number, bottom: number) {
  const cam = new PerspectiveCamera(28, 1440 / 900, 0.5, 220);
  const r = new DioramaRig(cam, { effects: () => ALL_EFFECTS });
  r.setShotInsets(top, bottom);
  r.setFocus(10, 0, -4);
  r.pushIn({ x: 10, z: -4 }, 0);
  r.update(FRAME);
  return { r, cam, centre: new Vector3(10, 0, -4) };
}

describe('T2 battle framing above the DOM panel', () => {
  it('battleFraming: smallest distance ≥ 12 m that fits the band, content tilted up into it', () => {
    const open = battleFraming(28, 0, 0, 1.6, 1.6, { distance: 0, tilt: 0, fits: false });
    expect(open.fits).toBe(true);
    expect(open.distance).toBe(BATTLE_DISTANCE);
    const panel = battleFraming(28, 0.12, PANEL_DEFAULT_FRACTION, 1.6, 1.6, { distance: 0, tilt: 0, fits: false });
    expect(panel.fits).toBe(true);
    expect(panel.distance).toBeGreaterThanOrEqual(BATTLE_DISTANCE);
    expect(panel.distance).toBeLessThanOrEqual(BATTLE_DISTANCE_MAX);
    expect(panel.tilt).toBeGreaterThan(0);                  // the view looks down more: content moves up
    const tall = battleFraming(28, 0.12, PANEL_DEFAULT_FRACTION, 1.6, 3.2, { distance: 0, tilt: 0, fits: false });
    expect(tall.distance).toBeGreaterThanOrEqual(panel.distance);   // a taller foe needs as much room or more
  });

  for (const [w, h] of [[1440, 900], [1280, 720]] as const) {
    it(`pushed-in pose at ${w}×${h}: near feet above the panel, both tops below the bar allowance`, () => {
      const panelPx = 0.28 * h + 24;                             // the client's panel: 28 vh + its 24 px margin
      const top = (HUD.margin + HUD.barLift + HUD.barH) / h;
      const cam = new PerspectiveCamera(28, w / h, 0.5, 220);
      const r = new DioramaRig(cam, { effects: () => ALL_EFFECTS });
      r.setShotInsets(top, panelPx / h);
      r.setBattleSubjects(1.2, 2.1);
      r.pushIn({ x: 0, z: 0 }, 0);
      r.update(FRAME);
      const rows = battlerRows(cam, new Vector3(0, 0, 0), headingYaw(0), 1.2, 2.1);
      expect(rows.nearFeet).toBeLessThanOrEqual(1 - panelPx / h - FRAME_BOTTOM_GAP + 1e-3);
      expect(rows.topMin).toBeGreaterThanOrEqual(top - 1e-3);
      expect(rows.farFeet).toBeLessThan(rows.nearFeet);           // the far battler stands higher on screen
    });
  }

  it('M2-battle-5: every frame of an impact / attacker / ko cue keeps both battlers inside the band (the push is scaled back)', () => {
    const top = 0.1; const bottom = PANEL_DEFAULT_FRACTION;
    const { r, cam, centre } = battleRig(top, bottom);
    const f = forwardOfYaw(headingYaw(0), new Vector3());
    r.setCueTarget('defender', centre.clone().addScaledVector(f, BATTLER_SEPARATION / 2));
    r.setCueTarget('attacker', centre.clone().addScaledVector(f, -BATTLER_SEPARATION / 2));
    r.setCueTarget('ko', centre.clone().addScaledVector(f, BATTLER_SEPARATION / 2));
    let scaled = false;
    for (const kind of ['impact', 'attacker', 'ko'] as const) {
      r.cue(kind, 0);
      for (let t = 0; t < 2200 && (r.cueActive || t === 0); t += FRAME) {
        r.update(FRAME);
        const rows = battlerRows(cam, centre, headingYaw(0), 1.6, 1.6);
        expect(rows.nearFeet).toBeLessThanOrEqual(1 - bottom - FRAME_BOTTOM_GAP + 2e-3);
        expect(rows.topMin).toBeGreaterThanOrEqual(top - 2e-3);
        if (r.cueFit < 1) scaled = true;
      }
    }
    expect(scaled).toBe(true);                                   // the rows' pushes do not fit above a panel whole
  });

  it('a panel resize during the battle eases the framing (no jump) and the diorama pose has no tilt', () => {
    const { r } = battleRig(0.05, 0.2);
    const d0 = r.battleFramingNow.distance;
    r.setShotInsets(0.05, 0.4);
    const d1 = r.battleFramingNow.distance;
    expect(d1).toBeGreaterThan(d0);
    r.update(FRAME);
    expect(r.orbit.distance).toBeGreaterThan(d0 - 1e-6);
    expect(r.orbit.distance).toBeLessThan(d1);
    run(r, 400);
    expect(r.orbit.distance).toBeCloseTo(d1, 6);
    r.release(0);
    r.update(FRAME);
    expect(r.tiltNow).toBe(0);
  });
});

describe('T2 / M2-battle-6: HUD battle bars stay above the panel', () => {
  it('a bar anchored under the panel is lifted above it', () => {
    const surface = (w: number, h: number): HudSurface => {
      const ctx = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : () => undefined), set: () => true }) as never;
      return { canvas: { width: w, height: h }, ctx };
    };
    const hud = new CanvasHudLayer({
      surface,
      anchors: { nameplate: () => false, battler: (ref, out, o) => { out[o] = 400; out[o + 1] = ref.side === 0 ? 880 : 300; return true; } },
    });
    hud.resize(1440, 900, 1);
    hud.setBottomInset(276);
    hud.set({ battle: { bars: [
      { who: { side: 0, slot: 0 }, name: 'Bramblecub', level: 5, hp: 30, maxHp: 31, status: null, stages: '', showNumbers: true },
      { who: { side: 1, slot: 0 }, name: 'Mossling', level: 2, hp: 9, maxHp: 12, status: null, stages: '', showNumbers: false },
    ], turnLabel: '', shakes: 0 } });
    hud.tick(16);
    hud.drawIfDirty();
    const pos = (hud as unknown as { barPos: Float32Array }).barPos;
    expect(pos[1]! + HUD.barH).toBeLessThanOrEqual(900 - 276);    // the near bar's bottom edge above the panel top
    expect(pos[3]! + HUD.barH).toBeLessThanOrEqual(900 - 276);
  });
});
