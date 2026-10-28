// Kygra's rig: a lean bird-knight with two sword-blades growing from its forearms (the right one swept down in front,
// the left one raised behind the shoulder), a helm with a gold trident and a crown of four plumes (they move as
// ears). Numbers are scad/kygra.scad's; the head block is scaled 1.45 about [0, -1.5, 23].
import { K, TAU, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, inFrame, limb, mx, pick } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { subFrame } from './lib/geo.mjs';

const BLUE = [0.2, 0.36, 0.7];
const TALON = [0.93, 0.93, 0.9];

// the head block: translate([0, -1.5, 23]) scale(1.45) translate([0, 0, -23])
const HEAD = subFrame([0, -1.5, 23 - 1.45 * 23], [0, 0, 0], 1.45);
const hw = (p) => HEAD.world(p);

const eyeL = { side: 'L', at: [1.75, -5.35, 30.4], size: 0.9, yaw: -8, frame: HEAD };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: BLUE });

const unit = (v) => { const n = Math.hypot(...v); return v.map((x) => x / n); };
// a scad blade(p, u, v, l, w): tested as a capsule along the middle of the flat blade
const bladeT = (p, u0, v0, l, w) => {
  const u = unit(u0);
  const d = v0[0] * u[0] + v0[1] * u[1] + v0[2] * u[2];
  const v = unit(v0.map((x, i) => x - u[i] * d));
  const at = (t, s) => p.map((x, i) => x + u[i] * l * t + v[i] * w * s);
  return any(limb(at(0.02, 0.3), at(0.66, 0.45), w * 0.6), limb(at(0.66, 0.45), at(0.98, 0), w * 0.45));
};

export const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: [3, 1, 12] },
  { name: 'legR', parent: 'root', at: [-3, 1, 12] },
  { name: 'body', parent: 'root', at: [0, 1, 13] },
  { name: 'head', parent: 'body', at: [0, -0.8, 23.5] },
  // the plumes, two per side, pivot where they leave the crown
  { name: 'earL', parent: 'head', at: hw([1.6, 0.5, 32]) },
  { name: 'earR', parent: 'head', at: hw([-1.6, 0.5, 32]) },
  { name: 'armL', parent: 'body', at: [4.8, 0, 22] },
  { name: 'foreL', parent: 'armL', at: [8, 1, 20] },
  { name: 'armR', parent: 'body', at: [-4.8, 0, 22] },
  { name: 'foreR', parent: 'armR', at: [-7.6, -1.5, 17.5] },
  ...face.joints,
];

const plume = (i) => {
  const x0 = -2.4 + i * 1.6; const x1 = -4.6 + i * 3.1; const h = 41 - Math.abs(i - 1.5) * 1.4; const y1 = 3.5 - Math.abs(i - 1.5) * 0.6;
  return inFrame(HEAD, limb([x0, 0.5, 32], [x1, y1, h], 1.4, 1.1));
};

export const parts = [
  ['body', any(blob([[[5.2, 4.8, 5.6], [0, 1, 16]], [[5, 4.2, 3.8], [0, -0.5, 21.5]]]), blob([[[2.2, 1.4, 2.4], [0, -3.4, 19.6]], [[2.8, 1.8, 2], [0, -3.4, 22.4]]]),
    ell([5, 4.6, 0.9], [0, 1, 13.4]), mx(ell([2.3, 2.5, 2.1], [4.4, 0, 22])), mx(limb([3.5, -1.3, 24], [6.6, 0.4, 22.9], 1.1)),
    limb([0, 3.6, 23], [0, 5.6, 17], 4.5, 3.5), limb([0, 4.5, 14], [0, 8.5, 9.5], 3, 2.5))],
  ['head', inFrame(HEAD, any(blob([[[4.2, 3.8, 2.6], [0, 0.5, 31.5]], [[3.6, 3.4, 2], [0, -1.6, 28]], [[1, 1, 1], [0, -3.4, 24]]]),
    limb([0, -4.4, 31], [0, -4.9, 24], 4.2, 1.5)))],
  ['earR', any(plume(0), plume(1))],
  ['earL', any(plume(2), plume(3))],
  ['armR', limb([-4.8, 0, 22], [-7.6, -1.5, 17.5], 1.7, 1.6)],
  ['foreR', any(limb([-7.6, -1.5, 17.5], [-8.8, -4.4, 14.4], 2.1, 1.9), bladeT([-8.2, -3.2, 15.8], [-0.55, -0.45, -0.6], [-0.5, 0.3, 0.8], 25, 8.5))],
  ['armL', limb([4.8, 0, 22], [8, 1, 20], 1.7, 1.6)],
  ['foreL', any(limb([8, 1, 20], [10.8, 0.2, 22.6], 2.1, 1.9), bladeT([9.6, 0.6, 21.4], [0.85, 0.25, 0.4], [-0.4, 0.2, 1], 22, 8))],
  ...['L', 'R'].map((S) => {
    const k = S === 'L' ? 1 : -1;
    const m = (p) => [p[0] * k, p[1], p[2]];
    return [`leg${S}`, any(ell([2.4, 2.8, 3], m([3, 1, 12])), limb(m([3.4, 0.5, 10.5]), m([5, -2, 6.5]), 1.4, 1), limb(m([5, -2, 6.5]), m([4.8, 0.4, 2.6]), 1.25, 0.8),
      limb(m([4.8, 0.4, 2.6]), m([4.8, -0.4, 1.2]), 1.05), ell([1.6, 2.8, 1], m([4.8, -2, 0.9])))];
  }),
];

function assign(c, rgb) {
  if (Math.abs(rgb[0] - TALON[0]) < 0.03 && Math.abs(rgb[2] - TALON[2]) < 0.03 && c[2] < 3) return c[0] >= 0 ? 'legL' : 'legR';
  return pick(c, parts);
}

/** Layers several `add` maps ({ clip: (t, u) => pose }) into one. */
export const addAll = (...maps) => Object.fromEntries([...new Set(maps.flatMap((m) => Object.keys(m)))]
  .map((k) => [k, (t, u) => merge(...maps.map((m) => m[k]?.(t, u)))]));

export const clipsFor = (extra = {}) => {
  const base = bipedClips({
    face, hipH: 12, stride: 18, armSwing: 8, hopScale: 0.7, droop: 0.6,
    // the low right blade slashes up and across
    punch: { arm: [-55, 0, -20], fore: [-25, 0, 0] },
    cheer: { arm: [-20, -45, 0], fore: [0, 0, 0] },
    add: addAll({ idle: (t, u) => both('ear', { r: [0, -3 * osc(u, 2), 0] }) }, extra),
  });
  return {
    ...base,

    // fidget: it lifts the low blade and inspects its edge, turning it in the light, then flicks it clean
    idle_inspect: {
      seconds: 2.6,
      pose: (t, u) => {
        const up = K(u, [[0, 0], [0.2, 1], [0.7, 1], [0.85, 0]]);
        const turn = Math.sin(TAU * 2 * (u - 0.2)) * win(u, 0.2, 0.7, 0.08);
        const flick = win(u, 0.78, 0.92, 0.04);
        return {
          body: { r: [0, 0, -8 * up] },
          head: { r: [10 * up, 0, -18 * up] },
          ...face.pose('open', 0.3 * up + blinks(u, [[0.5, 0.56]])),
          armR: { r: [-50 * up - 15 * flick, 0, -10 * up] },
          foreR: { r: [-30 * up, 25 * turn, 0] },
          ...both('ear', { r: [-6 * up, 0, 0] }),
        };
      },
    },

    // fidget: a proud crest flare, the plumes fanning out and back while it stretches tall
    idle_crest: {
      seconds: 2,
      pose: (t, u) => {
        const on = K(u, [[0, 0], [0.25, 1], [0.6, 1], [0.9, 0]]);
        const sh = Math.sin(TAU * 6 * u) * win(u, 0.3, 0.6, 0.05);
        return {
          body: { r: [-5 * on, 0, 0], s: [1, 1, 1 + 0.03 * on] },
          head: { r: [-10 * on, 0, 0] },
          ...face.pose('open', 0.4 * on),
          ...both('ear', { r: [-6 * on, -16 * on + 3 * sh, 0] }),
          ...both('arm', { r: [0, -6 * on, 0] }),
        };
      },
    },
  };
};

export default rigDef({ joints, assign, extras: face.extras, clips: clipsFor() });
