// Shalewing's rig: a baby pterosaur hatching from its egg. The egg and the chest are the body (pivot low, so it
// rocks), the head rides on the chest with the shell cap on top, turned 30 deg towards the creature's right (the
// scad's headFrame, authored with S()), with a broad beak and the open lower bill (the jaw, hinged at the gape). The
// bat wings hinge at the shoulders, the feet poke out under the egg. Numbers are scad/shalewing.scad's.
import { K, TAU, merge, osc, rigDef, win } from './lib/anim.mjs';
import { birdClips } from './lib/bird.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { capD, chainHit, closest, ellD, fold, isAny, near, side, slabD, subFrame } from './lib/geo.mjs';

const SLATE = [0.4, 0.41, 0.47];
const SHELL = [0.7, 0.58, 0.41];
const SPOT = [0.5, 0.4, 0.3];
const MEMBRANE = [0.65, 0.53, 0.38];
const CLAW = [0.79, 0.65, 0.47];
const JAW = [0.81, 0.49, 0.17];

const HEAD_YAW = -30;
const headF = subFrame([0, -1, 0], [0, 0, HEAD_YAW], 1);
const S = (sx, z, x = 0) => [x, (sx + 0.5 - 0.5 * x) / 0.866, z];
const GAPE = [4.6, -3.4, 23];
const eyeL = { side: 'L', at: [5.59, -2.62, 27.2], size: 2.6, yaw: 60, flat: 0.55, frame: headF };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: SLATE });
// the eye kit places its joints in world terms; the head joint carries the head's yaw, so take it out again
const faceJoints = face.joints.map((j) => ({ ...j, rot: [j.rot[0], j.rot[1], j.rot[2] - HEAD_YAW] }));

// the near wing (x > 0), as in the scad; W() reads a sheet point at depth y
const W = (sx, z, y) => [(sx - 0.5 * y) / 0.866, y, z];
const WY = -1;
const SH = W(3.5, 18.5, 0);
const WR = W(11.8, 25.6, WY);
const FING = [WR, W(14.4, 23.4, WY), W(16.6, 20.4, WY), W(18.1, 16.6, WY), W(18.5, 12.6, WY), W(18.2, 9.4, WY)];
const FING_R = [1.15, 1, 0.9, 0.8, 0.65, 0.35];
const MEMB = [[4.9, 17.4], [4.9, 16.1], [6.7, 14.5], [7.6, 15.9], [8.4, 16.1], [10, 14.7], [10.2, 13.6], [11.1, 13.8],
  [11.8, 15.2], [13.3, 15.8], [16.5, 13.4], [17.6, 11.2], [18, 12.5], [17.9, 16], [16.8, 19.6], [14.6, 22.8],
  [12, 24.6], [10.6, 24], [8.2, 21.4], [5.6, 19.4]].map((p) => [(p[0] - 0.5 * WY) / 0.866, p[1]]);
const CHEST = [[[9.3, 9.1, 6.6], [0, 0, 11]], [[6.8, 5.6, 5], [0, 0, 18]], [[4.8, 4.4, 3], [0, -0.8, 23]]];
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: [4.6, -0.8, 5] },
  { name: 'legR', parent: 'root', at: [-4.6, -0.8, 5] },
  { name: 'body', parent: 'root', at: [0, 0, 1] },
  { name: 'head', parent: 'body', at: [0, -1, 22], rot: [0, 0, HEAD_YAW] },
  { name: 'jaw', parent: 'head', at: headF.world([0, GAPE[1], GAPE[2] - 0.2]) },
  { name: 'wingL', parent: 'body', at: SH },
  { name: 'wingR', parent: 'body', at: [-SH[0], SH[1], SH[2]] },
  ...faceJoints,
];

// a hull of ellipsoids [r, p], approximated by ellipsoids interpolated along each pair
const hullD = (c, parts) => {
  let d = Infinity;
  for (let i = 0; i < parts.length - 1; i++) for (let t = 0; t <= 1; t += 0.25) {
    d = Math.min(d, ellD(c, lerp(parts[i][0], parts[i + 1][0], t), lerp(parts[i][1], parts[i + 1][1], t)));
  }
  return d;
};
const headD = (h) => hullD(h, [[[7, 6.8, 6.6], S(0, 28)], [[3.8, 3.6, 3.8], S(-5.6, 30)]]);
const legD = (f) => Math.min(capD(f, [4.6, -0.8, 5], [7.4, -2.4, 2.6], 1.8, 1.6), ellD(f, [2.3, 2.7, 1.5], [7.6, -2.8, 2]));
const wingD = (f) => Math.min(capD(f, SH, WR, 1.5, 1.15), chainHit(f, FING, FING_R).d, slabD([f[0], f[1] - WY, f[2]], MEMB, 1.5, 0.5));

function assign(c, rgb) {
  const f = fold(c);
  const S2 = side(c);
  if (near(rgb, JAW)) return 'jaw';
  if (isAny(rgb, [SHELL, SPOT], 0.03)) return c[2] > 24 ? 'head' : 'body';
  if (near(rgb, MEMBRANE, 0.03)) return `wing${S2}`;
  if (near(rgb, CLAW, 0.03)) return c[2] < 4 ? `leg${S2}` : `wing${S2}`;
  if (!near(rgb, SLATE)) return 'head';   // beak, eyes, nostrils, teeth, mouth
  return closest([
    ['head', c[2] > 19 ? headD(headF.local(c)) : Infinity],
    ['body', hullD(c, CHEST)],
    [`leg${S2}`, legD(f)],
    [`wing${S2}`, wingD(f)],
  ]);
}

const jaw = (a) => ({ jaw: { r: [a, 0, 0] } });
const base = birdClips({
  face, flapUp: 40,
  add: {
    idle: (t, u) => jaw(4 * (osc(u, 2) * 0.5 + 0.5)),
    lunge: (t, u) => jaw(22 * K(u, [[0, 0.3], [0.3, 1], [0.42, 0], [1, 0]])),
    hurt: (t, u) => jaw(16 * K(u, [[0, 0], [0.2, 1], [1, 0.4]])),
    celebrate: () => jaw(14),
    faint: (t, u) => jaw(10 * Math.min(1, u / 0.6)),
  },
});

const clips = {
  ...base,

  // fidget: wobbles in its egg, which tips one way and the other, then cheeps with the beak wide
  idle_wobble: {
    seconds: 2.4,
    pose: (t, u) => {
      const rock = Math.sin(TAU * 2 * u) * win(u, 0.05, 0.6, 0.1);
      const cheep = win(u, 0.66, 0.86, 0.04);
      return merge({
        body: { r: [0, 9 * rock, 0] },
        head: { r: [-6 * cheep, -6 * rock, 0] },
        ...face.pose(cheep > 0.4 ? 'happy' : 'open'),
        ...jaw(26 * cheep),
        wingL: { r: [0, -16 * Math.max(0, -rock) - 20 * cheep, 0] },
        wingR: { r: [0, 16 * Math.max(0, rock) + 20 * cheep, 0] },
      });
    },
  },
};
delete clips.idle_preen;
delete clips.idle_peck;   // the egg keeps its head too high to reach the ground

export default rigDef({ joints, assign, extras: face.extras, clips });
