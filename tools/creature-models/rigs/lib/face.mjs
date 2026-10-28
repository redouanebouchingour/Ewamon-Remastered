// Expressions for lib.scad's eye(): a skin-coloured lid per eye that closes from the top (a blink, or shut for the
// closed-eye faces) and ink strokes drawn on the shut lid: happy ∩, dizzy x, squeezed > <. All extra geometry the scad
// never had, hidden at a rest scale of 1e-4 until a clip shows it (ANIMATING.md "Expressions").
//
//   const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], parent: 'head', skin: fur });
//   joints: [...myJoints, ...face.joints], extras: face.extras, and in a pose: ...face.pose('happy') / face.pose('open', blink)
//
// An eye is { side: 'L' | 'R', at, size, yaw = 0, flat = 0.45 }, the numbers of its eye(p, size, yaw =, flat =) call
// (the left one, x > 0; mirrorEye() makes the right). For an eye inside a transformed block (`translate() rotate()
// scale() { eye(…) }`) pass `frame: subFrame(t, r, s)` (geo.mjs) and the numbers as written inside the block.

import { HIDE } from './anim.mjs';
import { rot } from './geo.mjs';

const INK = [0.08, 0.06, 0.07];

export const mirrorEye = (e) => ({ ...e, side: e.side === 'R' ? 'L' : 'R', at: [-e.at[0], e.at[1], e.at[2]], yaw: -(e.yaw ?? 0) });

/** An eye in world terms: centre, size, yaw and the eye's front depth. */
function placed(e) {
  const f = e.frame;
  const k = f ? f.scale[0] : 1;
  const squash = e.squash ?? 1;
  return {
    side: e.side ?? (e.at[0] >= 0 ? 'L' : 'R'),
    at: f ? f.world(e.at) : e.at,
    size: e.size * k,
    yaw: (e.yaw ?? 0) + (f ? f.rot[2] : 0),
    // the pupil's front pokes out to (flat * 0.62 + 0.54) × size (lib.scad eye()), squashed for socket eyes
    front: ((e.flat ?? 0.45) * 0.62 + 0.6) * squash,
    tilt: f ? [f.rot[0], f.rot[1]] : [0, 0],
  };
}

export function eyeKit({ eyes, parent = 'head', skin, ink = INK, strokes = ['happy', 'dizzy', 'squeeze'], lid = [1.14, 1, 1.2] }) {
  const joints = [];
  const extras = [];
  for (const e0 of eyes) {
    const e = placed(e0);
    const s = e.size;
    const R = [lid[0] * s, e.front * s * lid[1], lid[2] * 1.15 * s];   // the lid ellipsoid's radii in the eye's frame
    const r0 = [e.tilt[0], e.tilt[1], e.yaw];
    const top = rot(r0, [0, 0, R[2]]);
    joints.push({ name: `lid${e.side}`, parent, at: [e.at[0] + top[0], e.at[1] + top[1], e.at[2] + top[2]], rot: r0, scale: HIDE });
    extras.push({ joint: `lid${e.side}`, color: skin, shape: 'ell', at: [0, 0, -R[2]], size: R.map((x) => 2 * x) });
    // strokes on the shut lid's front: (x, z) in the eye's frame, at the lid surface
    const surf = (x, z) => -R[1] * Math.sqrt(Math.max(0.05, 1 - (x / R[0]) ** 2 - (z / R[2]) ** 2));
    const th = Math.max(0.22 * s, 0.22);
    const segs = (pts) => pts.slice(1).map((b, i) => [pts[i], b]);
    const inner = e.side === 'L' ? -1 : 1;   // towards the nose (x = 0) in this eye's frame
    const shapes = {
      happy: segs([[-0.72, -0.18], [-0.4, 0.22], [0, 0.36], [0.4, 0.22], [0.72, -0.18]]),
      dizzy: [[[-0.5, -0.5], [0.5, 0.5]], [[-0.5, 0.5], [0.5, -0.5]]],
      squeeze: [[[-0.55 * inner, 0.42], [0.45 * inner, 0]], [[0.45 * inner, 0], [-0.55 * inner, -0.42]]],
    };
    for (const kind of strokes) {
      const name = `${kind}${e.side}`;
      joints.push({ name, parent, at: e.at, rot: r0, scale: HIDE });
      for (const [a, b] of shapes[kind]) {
        const ax = a[0] * s; const az = a[1] * s; const bx = b[0] * s; const bz = b[1] * s;
        const mx = (ax + bx) / 2; const mz = (az + bz) / 2;
        extras.push({
          joint: name, color: ink,
          at: [mx, surf(mx, mz) - th * 0.15, mz],
          size: [Math.hypot(bx - ax, bz - az) + th, th, th],
          rot: [0, (-Math.atan2(bz - az, bx - ax) * 180) / Math.PI, 0],
        });
      }
    }
  }
  const sides = [...new Set(eyes.map((e) => placed(e).side))];
  const kinds = strokes;
  /**
   * The eyes' state for a pose: 'open' (with `blink` 0..1 closing the lids from the top), 'shut' (lids closed, no
   * stroke) or one of the stroke faces ('happy', 'dizzy', 'squeeze'), which shut the lids and draw on them.
   */
  const pose = (kind = 'open', blink = 0) => {
    const out = {};
    const shut = kind !== 'open';
    for (const S of sides) {
      const b = shut ? 1 : Math.min(1, Math.max(0, blink));
      out[`lid${S}`] = { s: b < 0.02 ? HIDE : [1, 1, b] };
      for (const k of kinds) out[`${k}${S}`] = { s: kind === k ? 1 : HIDE };
    }
    return out;
  };
  return { joints, extras, pose };
}

/** A blink curve for a loop: 1 inside each [u0, u1] window (a quick close and open), 0 elsewhere. */
export function blinks(u, at = [[0.42, 0.47]]) {
  let b = 0;
  for (const [u0, u1] of at) {
    const m = (u0 + u1) / 2;
    const h = (u1 - u0) / 2;
    if (u > u0 && u < u1) b = Math.max(b, 1 - Math.abs(u - m) / h);
  }
  return Math.min(1, b * 1.6);
}
