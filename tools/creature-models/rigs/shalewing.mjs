// Shalewing's rig: a baby pterosaur hatching from its egg. The egg is the body (pivot low, so it rocks), the head
// rides a neck out of it with the shell cap on top and an open beak (the dark lower jaw is its own joint), the bat
// wings hinge at the shoulders, the feet poke out under the egg. Numbers are scad/shalewing.scad's.
import { K, TAU, merge, osc, rigDef, win } from './lib/anim.mjs';
import { birdClips } from './lib/bird.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { capD, closest, ellD, fold, isAny, near, side } from './lib/geo.mjs';

const SLATE = [0.3, 0.33, 0.4];
const SHELL = [0.68, 0.56, 0.4];
const SPOT = [0.47, 0.37, 0.27];
const CLAW = [0.8, 0.68, 0.5];
const BEAK_DK = [0.7, 0.35, 0.08];

const eyeL = { side: 'L', at: [4.8, -6, 27.8], size: 2.3, yaw: -30 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: SLATE });

const SH = [5, 0, 19];
const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: [5, -4, 1.2] },
  { name: 'legR', parent: 'root', at: [-5, -4, 1.2] },
  { name: 'body', parent: 'root', at: [0, 0, 1] },
  { name: 'head', parent: 'body', at: [0, 0, 19] },
  { name: 'jaw', parent: 'head', at: [0, -5.5, 24] },
  { name: 'wingL', parent: 'body', at: SH },
  { name: 'wingR', parent: 'body', at: [-SH[0], SH[1], SH[2]] },
  ...face.joints,
];

// the wing: anything out at the side above the feet that lies outside the egg and the head
const inWing = (f) => f[0] > 5.6 && f[2] > 8 && ellD(f, [10.3, 9.3, 11.3], [0, 0, 11]) > 1 && ellD(f, [8.5, 7.9, 7.7], [0, -1, 27.5]) > 1;

function assign(c, rgb) {
  const f = fold(c);
  const S = side(c);
  if (c[2] < 2.8 && (near(rgb, CLAW) || near(rgb, SLATE)) && ellD(c, [10, 9, 11], [0, 0, 11]) > 0.95) return `leg${S}`;
  if (inWing(f) && !(c[2] > 28)) return `wing${S}`;
  if (near(rgb, BEAK_DK)) return 'jaw';
  if (isAny(rgb, [SHELL, SPOT], 0.03)) return c[2] > 26 ? 'head' : 'body';
  return closest([
    ['body', ellD(c, [7, 6, 8], [0, 0, 14])],
    ['head', Math.min(capD(c, [0, 0, 18], [0, -1, 23], 4.4, 4.6) * 1.05, ellD(c, [8, 7.4, 7.2], [0, -1, 27.5]), ellD(c, [5, 2, 3], [0, -5.4, 21.5]),
      capD(c, [0, -6.2, 26.8], [0, -15.5, 23.4], 3) )],
  ]);
}

const jaw = (a) => ({ jaw: { r: [a, 0, 0] } });
const base = birdClips({
  face, flapUp: 40,
  add: {
    idle: (t, u) => jaw(4 * (osc(u, 2) * 0.5 + 0.5)),
    lunge: (t, u) => jaw(22 * K(u, [[0, 0.3], [0.3, 1], [0.42, 0], [1, 0]])),
    hurt: (t, u) => jaw(16 * K(u, [[0, 0], [0.2, 1], [1, 0.4]])),
    celebrate: (t, u) => jaw(14),
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
