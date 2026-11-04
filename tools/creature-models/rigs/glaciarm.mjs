// Glaciarm's rig: a steel-blue knight with two huge closed ice fists, the far (right, -X) one raised beside the helm and
// the near (left, +X) one held forward across the waist. Each arm is shoulder -> elbow (the gauntlet of ice) -> wrist
// (the fist); the floating shards drift on their own joint (frost); the visor's glowing eyes blink and flare on theirs.
// Numbers are scad/glaciarm.scad's.
import { K, TAU, both, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, bipedClips, blob, box, ell, limb, mx, pick } from './lib/biped.mjs';
import { near } from './lib/geo.mjs';

const CYAN = [0.45, 0.8, 0.95];
const WHITE = [0.88, 0.99, 0.99];
const ICE = [[0.71, 0.9, 0.97], [0.88, 0.99, 0.99], [0.59, 0.82, 0.92], [0.45, 0.73, 0.89], [0.73, 0.88, 0.92]];
const isIce = (rgb) => ICE.some((c) => near(rgb, c, 0.03));

// helm: centre HC, turned 20 deg; the eyes float on its front at local (+-1.3, z -0.75)
const HC = [0, -1.0, 35.0];
const EYES = [1.42, -4.9, 34.25];

// arms (the scad's SR / ER / FR and SL / EL / FL); the fist frame: +Z along elbow -> fist, -Y the fingers' side
const ARM = {
  R: { S: [-10.6, 0.5, 26.0], E: [-12.6, -1.0, 17.5], F: [-15.8, -5.5, 24.6] },
  L: { S: [10.6, 0.5, 26.0], E: [18.7, -0.6, 20.7], F: [13.9, -7.0, 21.5] },
};
const KF = 1.25;
const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const nrm = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
for (const A of Object.values(ARM)) {
  const z = nrm(sub(A.F, A.E));
  const f = [0.5, -0.87, 0];
  const y = nrm(f.map((v, i) => -(v - dot(f, z) * z[i])));
  A.ax = [cross(y, z), y, z];
  A.L = Math.hypot(...sub(A.F, A.E)) / KF;
  // the wrist: where the cuff meets the fist (local z -3)
  A.W = A.F.map((v, i) => v - 3 * KF * z[i]);
}
const fistLocal = (A, c) => { const d = sub(c, A.F); return A.ax.map((e) => dot(d, e) / KF); };

// floating shards (sheet x, z, length, -, lean), placed at depth 0
const SHARDS = [[-18.0, 33.8, 5.0], [-19.8, 30.0, 1.6], [16.8, 31.0, 6.0], [18.3, 26.5, 2.2],
  [-15.5, 11.5, 4.2], [-11.6, 13.5, 2.0], [13.8, 11.2, 4.6], [16.3, 13.3, 2.0]].map(([sx, z, l]) => ({ p: [sx / 0.866, 0, z], l }));

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: [4.8, 0.3, 14.0] },
  { name: 'legR', parent: 'root', at: [-4.8, 0.3, 14.0] },
  { name: 'body', parent: 'root', at: [0, 0, 15.5] },
  { name: 'frost', parent: 'body', at: [0, 0, 20] },
  { name: 'head', parent: 'body', at: [0, -0.6, 29.8] },
  { name: 'eyes', parent: 'head', at: EYES, rot: [0, 0, 20] },
  { name: 'armL', parent: 'body', at: ARM.L.S },
  { name: 'foreL', parent: 'armL', at: ARM.L.E },
  { name: 'handL', parent: 'foreL', at: ARM.L.W },
  { name: 'armR', parent: 'body', at: ARM.R.S },
  { name: 'foreR', parent: 'armR', at: ARM.R.E },
  { name: 'handR', parent: 'foreR', at: ARM.R.W },
];

const parts = [
  ['leg*', any(ell([3.0, 3.0, 3.0], [4.8, 0.3, 14.0]), limb([4.8, 0.3, 14.0], [8.2, -0.6, 9.6], 3.3, 3.0), limb([8.2, -0.6, 9.6], [8.9, -0.4, 3.4], 3.0, 2.7),
    ell([2.5, 1.4, 3.0], [8.7, -2.4, 6.0]), ell([3.0, 2.3, 2.8], [8.5, -2.9, 10.0]), ell([3.4, 3.0, 4.0], [10.5, -2.8, 13.0]),
    blob([[[3.4, 3.6, 1.8], [9.0, -0.4, 1.8]], [[2.8, 3.0, 1.4], [9.2, -3.9, 1.4]]]), ell([2.6, 1.7, 1.2], [9.2, -5.2, 1.6]))],
  ['body', any(blob([[[7.0, 5.0, 5.0], [0, 0.2, 25.6]], [[5.4, 4.4, 3.4], [0, 0.2, 19.8]]]), ell([6.6, 2.6, 5.0], [0, 3.0, 25.0]),
    ell([6.2, 2.6, 4.4], [0, -3.2, 25.8]), ell([6.5, 5.3, 1.0], [0, 0.1, 17.6]), ell([6.0, 4.6, 2.8], [0, 0.3, 15.4]),
    box([6.4, 2.4, 7.8], [0, -5.0, 15.0]), mx(ell([3.6, 1.6, 3.4], [5.2, -3.6, 13.4])),
    mx(ell([5.4, 5.2, 3.8], [10.6, 0.4, 28.0])), mx(ell([4.5, 4.5, 6.5], [11.2, 0.8, 34.5])), ell([4.8, 4.6, 1.8], [0, -0.4, 29.2]))],
  ['arm*', limb([10.6, 0.5, 26.0], [15.0, 0, 22.0], 2.8, 2.6)],
];
const armTest = (S) => limb(ARM[S].S, ARM[S].E, 2.8, 2.6);
const elbowTest = (S) => ell([2.9, 2.9, 2.9], ARM[S].E);

function assign(c, rgb) {
  // the eyes: cyan slits and their white cores on the visor
  if ((near(rgb, CYAN) || near(rgb, WHITE, 0.02)) && c[2] > 33 && c[2] < 35.6 && Math.abs(c[0]) < 3.6 && c[1] < -2.5) return 'eyes';
  // the helm
  if (c[2] > 29.3 && Math.hypot(c[0] - HC[0], c[1] - HC[1]) < 3.7 && c[2] < 41) return 'head';
  if (isIce(rgb)) {
    for (const s of SHARDS) if (Math.hypot(c[0] - s.p[0], c[1] - s.p[1], c[2] - s.p[2]) < 0.7 * s.l + 0.6) return 'frost';
    for (const S of ['L', 'R']) {
      const A = ARM[S];
      const [x, y, z] = fistLocal(A, c);
      const r = Math.hypot(x, y - 0.6);
      if (z > -3 && z < 4.8 && r < 5.5) return `hand${S}`;
      if (z <= -3 && z > -A.L - 0.6 && r < 7.4) return `fore${S}`;
      if (z > -3 && z < 0.6 && r >= 5.5 && r < 7.4) return `fore${S}`;
    }
  }
  return pick(c, [...parts.filter(([n]) => n !== 'arm*'),
    ['armL', armTest('L')], ['armR', armTest('R')], ['foreL', elbowTest('L')], ['foreR', elbowTest('R')]]);
}

const drift = (u, k = 1) => ({ frost: { p: [0, 0, 0.5 * k * osc(u, 2)], r: [0, 0, 3 * k * osc(u, 1)] } });
const flare = (k) => ({ eyes: { s: [1 + 0.25 * k, 1, 1 + 0.3 * k] } });
const blink = (u, w) => ({ eyes: { s: [1, 1, 1 - 0.9 * w] } });
const blinkAt = (u, t0) => win(u, t0, t0 + 0.04, 0.015);

const base = bipedClips({
  hipH: 14, stride: 14, armSwing: 5, hopScale: 0, hopH: 2, lift: 40,
  punch: { arm: [-35, 0, 10], fore: [-25, 0, 0] },
  cheer: { arm: [0, -40, 0], fore: [0, 12, 0] },
  add: {
    idle: (t, u) => merge(drift(u), blink(u, Math.max(blinkAt(u, 0.35), blinkAt(u, 0.86)))),
    walk: (t, u) => drift(u, 0.6),
    idle_look: (t, u) => merge(drift(u), blink(u, blinkAt(u, 0.5))),
    windup: (t, u) => merge({ frost: { s: 1 + 0.12 * smooth(u) } }, flare(smooth(u / 0.6))),
    lunge: (t, u) => flare(K(u, [[0, 1], [0.4, 1.3], [1, 0]])),
    hurt: (t, u) => blink(u, 0.7 * K(u, [[0, 0], [0.2, 1], [1, 0]])),
    faint: (t, u) => ({ frost: { s: 1 - 0.9 * smooth((u - 0.1) / 0.6) + 1e-3 }, ...blink(u, 0.92 * smooth((u - 0.3) / 0.5)) }),
    celebrate: (t, u) => merge(drift(u, 1.6), flare(0.4)),
    enter: (t, u) => merge({ frost: { s: 0.2 + 0.8 * smooth((u - 0.2) / 0.5) } }, flare(win(u, 0.5, 0.95, 0.1))),
    exit: (t, u) => drift(u),
  },
});

const clips = {
  ...base,

  // fidget: brings the two ice fists together in front and knocks them, the eyes flaring
  idle_knock: {
    seconds: 2.2,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.2, 1], [0.7, 1], [0.86, 0]]);
      const knock = Math.max(0, Math.sin(TAU * 2 * ((u - 0.25) / 0.4))) * win(u, 0.25, 0.65, 0.02);
      return merge({
        body: { r: [3 * on, 0, 0] },
        head: { r: [6 * on, 0, 0] },
        armR: { r: [-20 * on, 0, -18 * on - 5 * knock] },
        foreR: { r: [10 * on, 0, -14 * on] },
        armL: { r: [-6 * on, 0, 10 * on + 4 * knock] },
      }, drift(u), flare(0.6 * knock));
    },
  },

  // fidget: clenches both fists, the shards swell and spin, the eyes glow
  idle_whirl: {
    seconds: 2.4,
    pose: (t, u) => {
      const on = win(u, 0.1, 0.85, 0.12);
      return merge({
        ...both('hand', { s: 1 + 0.08 * on }),
        ...both('fore', { r: [-6 * on, 0, 0] }),
        head: { r: [-4 * on, 0, 0] },
        frost: { r: [0, 0, 24 * Math.sin(Math.PI * smooth((u - 0.1) / 0.75))], s: 1 + 0.15 * on },
      }, flare(0.5 * on));
    },
  },
};

export default rigDef({ joints, assign, clips });
