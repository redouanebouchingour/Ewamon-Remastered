// Raidori's rig: a thunder lion on four legs in a long stride, a big ring of lightning-bolt mane round the head (its
// own joint, so it can crackle and ruffle), a fierce face with sabre fangs and an open mouth (the white chin on a jaw
// joint), lilac mask points as ears and a thin tail curling to a yellow star. Numbers are scad/raidori.scad's.
import { K, TAU, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, blob, ell, limb, spike } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { chainHit, closest, isAny, near, subFrame } from './lib/geo.mjs';
import { quadrupedClips } from './lib/quadruped.mjs';

export const BODY = [0.29, 0.29, 0.38];
const DARK = [0.19, 0.19, 0.25];
const MANE = [[0.98, 0.80, 0.18], [0.85, 0.66, 0.04], [0.60, 0.47, 0.08], [0.30, 0.24, 0.07]];
const LILAC = [0.63, 0.63, 0.83];
const WHITES = [[0.86, 0.86, 0.87], [0.95, 0.95, 0.96], [1, 1, 1]];
const STAR = [0.99, 0.87, 0.30];
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

// ---- the head block: translate(H) rotate([0, 0, HEAD_YAW]), the face inside scale(HS)
export const H = [-3.6, -17.5, 29.6];
export const HEAD_YAW = -2;
export const HS = 1.12;
export const hf = subFrame(H, [0, 0, HEAD_YAW]);         // the mane's frame
export const ff = subFrame(H, [0, 0, HEAD_YAW], HS);     // the face's frame
const inFace = (test) => (c) => test(ff.local(c));

const EYE = [2.35, -3.3, -1.5];
const eyeL = { side: 'L', at: EYE, size: 1.5, yaw: 22, flat: 0.5, frame: ff };
export const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: BODY });

// ---- the tail and the legs ([hip, knee, foot, front])
export const TAIL = [[0.6, 17.5, 22], [1.8, 20.5, 25.2], [3.8, 22.5, 27.2], [5.9, 23.6, 27.4], [7.4, 24.2, 25.8], [7.9, 24.2, 23],
  [7.8, 24, 20.2], [8.0, 24, 18.0]];
export const TAIL_R = [1.5, 1.25, 1.1, 1.05, 1.0, 0.95, 0.9, 0.85];
export const STAR_AT = [8.3, 24, 14.8];
export const tail = ['tail1', 'tail2', 'tail3', 'tail4'];
const LINK = [0, 0, 1, 1, 2, 2, 3];   // chain link -> tail joint
export const LEGS = {
  legFL: [[3.7, -8.5, 16.5], [4.0, -8.2, 8.5], [4.1, -5.6, 1.5], true],
  legFR: [[-3.7, -9.5, 16.5], [-3.9, -11.8, 8.8], [-4.0, -14, 1.5], true],
  legBL: [[3.8, 12, 17], [4.1, 16.4, 7.5], [4.1, 15.4, 1.5], false],
  legBR: [[-3.8, 12.5, 17], [-4.1, 19.4, 8], [-4.1, 21, 1.5], false],
};

export const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...Object.entries(LEGS).map(([name, [hip]]) => ({ name, parent: 'root', at: hip })),
  { name: 'body', parent: 'root', at: [0, 0, 16] },
  { name: 'head', parent: 'body', at: [-1.2, -13, 25] },
  { name: 'jaw', parent: 'head', at: ff.world([0, -2.4, -4.6]) },
  { name: 'mane1', parent: 'head', at: hf.world([0, 2, -0.8]) },
  { name: 'earL', parent: 'head', at: ff.world([3.0, -1.5, 2.4]) },
  { name: 'earR', parent: 'head', at: ff.world([-3.0, -1.5, 2.4]) },
  ...tail.map((name, i) => ({ name, parent: i === 0 ? 'body' : tail[i - 1], at: TAIL[i * 2] })),
  ...face.joints,
];

const legTest = ([hip, knee, foot, front]) => any(
  limb(hip, knee, front ? 3.7 : 4.2, 2.7), limb(knee, add3(foot, [0, 0, 0.6]), 2.7, 2.3),
  ell([2.6, 3.1, 1.4], add3(foot, [0, -0.9, -0.1])), ell([2.75, 2.75, 0.9], add3(foot, [0, 0, 2.4])));
export const legParts = Object.entries(LEGS).map(([name, l]) => [name, legTest(l)]);
const TORSO = [[[6.0, 6.2, 6.2], [0, -9, 18.8]], [[5.4, 7, 5.4], [0, 1, 18.6]], [[5.8, 6.2, 6.0], [0, 11, 19]]];
export const bodyTest = any(blob(TORSO), ell([4.6, 4.4, 4.8], [0, -11, 22.5]),
  ...[[0, 5, 23.6, [0, 2.4, 3.2]], [1.2, 8, 23.6, [0.5, 3, 3.8]], [-1.2, 8.5, 23.6, [-0.5, 3, 3.6]], [0, 11.5, 23.6, [0, 3.6, 4.2]],
    [0, 14.5, 22.6, [0, 3.6, 3.0]]].map(([x, y, z, d]) => spike([x, y, z], d, 1.6)));
export const headTest = any(ell([4, 4, 4.2], [-2, -15, 27]), inFace(any(ell([4.2, 4.0, 3.4], [0, 0.2, 1.0]),
  ell([1.6, 2.6, 2.2], [2.6, -1.0, 1.4]), ell([1.6, 2.6, 2.2], [-2.6, -1.0, 1.4]), ell([4.6, 3.5, 3.0], [0, -1.3, -1.9]),
  blob([[[3.1, 2.4, 2.2], [0, -3.6, -2.4]], [[2.4, 1.4, 1.6], [0, -5.0, -2.6]]]))));
const jawTest = inFace(ell([2.3, 2.5, 1.35], [0, -4.0, -6.0]));
const tailTest = (c) => { const t = chainHit(c, TAIL, TAIL_R); return [tail[LINK[t.i]], t.d]; };

function assign(c, rgb) {
  const f = ff.local(c);
  if (near(rgb, STAR, 0.03)) return 'tail4';
  if (isAny(rgb, MANE, 0.03)) {
    // the moustache is mane-yellow but sits on the face, in front of the mane ring
    if (f[1] < -1.6 && f[2] < -0.5 && Math.abs(f[0]) < 8.5) return 'head';
    return 'mane1';
  }
  if (near(rgb, LILAC, 0.03)) return c[2] > 24 ? (f[0] > 0 ? 'earL' : 'earR') : closest(legParts.map(([n, t]) => [n, t(c)]));
  if (isAny(rgb, WHITES, 0.03)) {
    if (c[2] > 17.5) return jawTest(c) < 1.25 ? 'jaw' : 'head';   // the chin, the fangs, the eye glints
    return closest(legParts.map(([n, t]) => [n, t(c)]));        // paws and the leg patches
  }
  if (near(rgb, BODY, 0.03) || near(rgb, DARK, 0.03) || near(rgb, [0.53, 0.53, 0.57], 0.03)) {
    const [tn, td] = tailTest(c);
    return closest([['head', headTest(c)], ['body', bodyTest(c)], ...legParts.map(([n, t]) => [n, t(c)]),
      [tn, c[1] > 16.5 ? td : td + 0.3]]);
  }
  return 'head';   // eyes, nose, mouth
}

// the mane crackles: a static shiver in its size now and then
const crackle = (u, beats, amp) => ({ mane1: { s: 1 + amp * Math.max(0, Math.sin(TAU * beats * u)) ** 8 } });

export const clips = {
  ...quadrupedClips({
    face, tail, mane: ['mane1'], hipH: 16, stride: 16,
    add: { idle: (t, u) => crackle(u, 2, 0.04), celebrate: (t, u) => crackle(u, 4, 0.07), hurt: (t, u) => crackle(u, 5, 0.08) },
  }),

  // fidget: plants its feet, opens its jaw wide and lets out a crackling roar, the mane bristling, the tail star up
  idle_roar: {
    seconds: 2.2,
    pose: (t, u) => {
      const up = K(u, [[0, 0], [0.18, 1], [0.7, 1], [0.86, 0]]);
      const tr = osc(u, 14) * win(u, 0.2, 0.7, 0.05);
      return merge({
        body: { r: [-4 * up, 0, 0] },
        head: { r: [-12 * up + 2 * tr, 0, 0] },
        jaw: { r: [22 * up, 0, 0] },
        mane1: { s: 1 + 0.08 * up + 0.03 * tr },
        legFL: { r: [-5 * up, 0, 0] }, legFR: { r: [-5 * up, 0, 0] }, legBL: { r: [4 * up, 0, 0] }, legBR: { r: [4 * up, 0, 0] },
        ...face.pose('open', 0.3 * up),
        earL: { r: [-15 * up, 0, 0] },
        earR: { r: [-15 * up, 0, 0] },
      }, Object.fromEntries(tail.map((n, i) => [n, { r: [8 * up * (i === 0 ? 1 : 0.3), 0, 4 * tr] }])));
    },
  },

  // fidget: paws the ground twice with the near front foot, like a bull about to charge
  idle_paw: {
    seconds: 2,
    pose: (t, u) => {
      const sc = Math.max(0, Math.sin(TAU * 2 * ((u - 0.15) / 0.6))) * win(u, 0.15, 0.75, 0.04);
      return merge({
        body: { r: [3 * win(u, 0.1, 0.8, 0.1), 0, 0] },
        head: { r: [8 * win(u, 0.1, 0.8, 0.1), 0, 0] },
        legFL: { r: [30 * sc - 10 * sc * sc, 0, 0], p: [0, 0, 1.2 * sc] },
        ...face.pose('open', blinks(u, [[0.82, 0.87]])),
      });
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
