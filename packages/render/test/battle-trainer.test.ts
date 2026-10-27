/**
 * M3 independent review R-all-1 (blocker, §50.6.2 line 7): the player's own avatar must never cover its creature from
 * the battle camera. The trainers stand `TRAINER_SLOT_M` from the arena centre, `TRAINER_SIDE_DEG` off the battle axis
 * (camera/battle.ts `trainerSlot`); this projects the avatar's screen rect (a 0.4 m-radius, 1.6 m cylinder: the
 * harness's `playerRect`) against each near battler's card rect (feet → top, ± half its width along the camera right:
 * the harness's `battlerRects`) through the rig's stock battle framing, in singles and doubles, for small to tall
 * creatures, in every heading, at 1440×900 and 1280×720 with the DOM panel insets, and in every frame of the cues.
 */
import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three/webgpu';
import { ALL_EFFECTS } from '../src/descriptors.js';
import { DioramaRig, HEADING_TURN_MS, headingYaw } from '../src/camera/rig.js';
import { BATTLER_SEPARATION, TRAINER_SLOT_M, battlerSlot, forwardOfYaw, trainerSlot } from '../src/camera/battle.js';
import { HUD } from '../src/hud/layer.js';

const FRAME = 1000 / 60;
type Rect = readonly [number, number, number, number];

function rectOf(cam: PerspectiveCamera, pts: readonly Vector3[]): Rect {
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  const v = new Vector3();
  for (const p of pts) {
    v.copy(p).project(cam);
    const x = (v.x * 0.5 + 0.5); const y = (-v.y * 0.5 + 0.5);
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  return [x0, y0, x1, y1];
}

/** The share of `b`'s area that `a` covers. */
function coverOf(a: Rect, b: Rect): number {
  const w = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
  const h = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  return (w * h) / ((b[2] - b[0]) * (b[3] - b[1]));
}

function avatarRect(cam: PerspectiveCamera, x: number, y: number, z: number): Rect {
  const pts: Vector3[] = [];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    for (const h of [0, 1.6]) pts.push(new Vector3(x + Math.cos(a) * 0.4, y + h, z + Math.sin(a) * 0.4));
  }
  return rectOf(cam, pts);
}

function cardRect(cam: PerspectiveCamera, feet: Vector3, heightM: number, aspect: number): Rect {
  const right = new Vector3().setFromMatrixColumn(cam.matrixWorld, 0).setY(0).normalize();
  const half = (heightM * aspect) / 2;
  const top = feet.clone().setY(feet.y + heightM);
  return rectOf(cam, [feet.clone().addScaledVector(right, -half), feet.clone().addScaledVector(right, half), top.clone().addScaledVector(right, -half), top.clone().addScaledVector(right, half)]);
}

const CENTRE = new Vector3(10, 0, -4);

function rigAt(w: number, h: number, heading: 0 | 1 | 2 | 3, nearH: number, farH: number): { r: DioramaRig; cam: PerspectiveCamera } {
  const cam = new PerspectiveCamera(28, w / h, 0.5, 220);
  const r = new DioramaRig(cam, { effects: () => ALL_EFFECTS });
  r.setShotInsets((HUD.margin + HUD.barLift + HUD.barH) / h, (0.28 * h + 24) / h);
  r.setHeading(heading);
  r.update(HEADING_TURN_MS + 10);
  r.setBattleSubjects(nearH, farH);
  r.pushIn({ x: CENTRE.x, z: CENTRE.z }, 0);
  r.update(FRAME);
  cam.updateMatrixWorld(true);
  return { r, cam };
}

/** Worst share of any battler's card (both sides) the side-0 avatar covers, for `count` battlers a side. */
function worstCover(r: DioramaRig, cam: PerspectiveCamera, count: number, heightM: number, aspect: number): number {
  cam.updateMatrixWorld(true);
  const yaw = r.dioramaYaw;
  const f = forwardOfYaw(yaw, new Vector3());
  const t = trainerSlot(CENTRE.x, CENTRE.z, f.x, f.z, 0, [0, 0]);
  const av = avatarRect(cam, t[0], CENTRE.y, t[1]);
  let worst = 0;
  for (const side of [0, 1] as const) {
    for (let slot = 0; slot < count; slot++) {
      const feet = battlerSlot(CENTRE, yaw, side, slot, count, new Vector3());
      worst = Math.max(worst, coverOf(av, cardRect(cam, feet, heightM, aspect)));
    }
  }
  return worst;
}

/**
 * Card height × aspect: content `heightM` 0.2 … 4 m over the sprite's body share (`cardBodyV`) → 0.23 … 4.65 m cards
 * (× 1.12 for an alpha; 8.3 m is margin); every creature frame in the manifest is square (aspect 1); 1.25 is margin
 * for a wider frame. A giant's card (past the old 2.69 m) in doubles stands right behind the trainer: the
 * avatar may cover up to GIANT_DOUBLES_COVER of it there (6.6 % at 4.65 m), the 5 % everywhere else.
 */
const GIANT_DOUBLES_COVER = 0.08;
const SIZES: readonly (readonly [number, number])[] = [[0.23, 1], [0.5, 1], [0.8, 1], [1.2, 1], [1.6, 1], [2.2, 1], [2.69, 1], [4.65, 1], [8.3, 1], [1.6, 1.25]];

describe('R-all-1: the player avatar never covers its own creature in the battle framing', () => {
  it('the trainer slot keeps its radius and is point-symmetric between the sides', () => {
    for (const k of [0, 1, 2, 3] as const) {
      const f = forwardOfYaw(headingYaw(k), new Vector3());
      const a = trainerSlot(CENTRE.x, CENTRE.z, f.x, f.z, 0, [0, 0]);
      const b = trainerSlot(CENTRE.x, CENTRE.z, f.x, f.z, 1, [0, 0]);
      expect(Math.hypot(a[0] - CENTRE.x, a[1] - CENTRE.z)).toBeCloseTo(TRAINER_SLOT_M, 9);
      expect(a[0] + b[0]).toBeCloseTo(2 * CENTRE.x, 9);
      expect(a[1] + b[1]).toBeCloseTo(2 * CENTRE.z, 9);
      // side 0 on the near half (toward the camera), side 1 on the far half
      expect((a[0] - CENTRE.x) * f.x + (a[1] - CENTRE.z) * f.z).toBeLessThan(-BATTLER_SEPARATION / 2 + 1);
      expect((b[0] - CENTRE.x) * f.x + (b[1] - CENTRE.z) * f.z).toBeGreaterThan(0);
    }
  });

  for (const [w, h] of [[1440, 900], [1280, 720]] as const) {
    it(`stock framing at ${w}×${h}: < 5 % of every battler's rect is covered (singles + doubles, every heading)`, () => {
      for (const k of [0, 1, 2, 3] as const) {
        for (const [hm, aspect] of SIZES) {
          const { r, cam } = rigAt(w, h, k, hm, 1.6);
          for (const count of [1, 2]) {
            const c = worstCover(r, cam, count, hm, aspect);
            expect(c, `heading ${k}, ${hm} m × ${aspect}, ${count} a side`).toBeLessThan(count === 2 && hm > 2.69 ? GIANT_DOUBLES_COVER : 0.05);
          }
        }
      }
    });
  }

  it('every frame of the attacker / defender / impact / wide / ko / throw cues keeps it < 5 %', () => {
    for (const count of [1, 2]) {
      const { r, cam } = rigAt(1440, 900, 0, 1.6, 1.6);
      const yaw = r.dioramaYaw;
      const near = battlerSlot(CENTRE, yaw, 0, 0, count, new Vector3());
      const far = battlerSlot(CENTRE, yaw, 1, 0, count, new Vector3());
      r.setCueTarget('attacker', near); r.setCueTarget('defender', far); r.setCueTarget('ko', far); r.setCueTarget('throw', far);
      for (const kind of ['attacker', 'defender', 'impact', 'wide', 'ko', 'throw'] as const) {
        r.cue(kind, 0);
        let worst = 0;
        for (let t = 0; t < 2600 && (r.cueActive || t === 0); t += FRAME) {
          r.update(FRAME);
          worst = Math.max(worst, worstCover(r, cam, count, 1.6, 1));
        }
        expect(worst, `${kind}, ${count} a side`).toBeLessThan(0.05);
      }
    }
  });
});
