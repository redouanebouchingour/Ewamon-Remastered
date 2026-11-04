// Mantleaf's rig: a leaf mantis on four stilt legs (leg1 front, leg2 back), raptorial arms posed as drawn (claw = the
// coxa and femur, pinch = the bladed tibia; the near +X arm folded in front, the far one spread), an upright thorax,
// a big head turned to the viewer under a lotus crown, a flat abdomen and a fan of leaf wings out to +X (wingL).
// Numbers are scad/mantleaf.scad's.
import { K, TAU, merge, rigDef, win } from './lib/anim.mjs';
import { any, blob, ell, limb, pair, pick } from './lib/biped.mjs';
import { capD, chainHit, ellD, fold, near, plateD, rot, subFrame } from './lib/geo.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { insectClips } from './lib/insect.mjs';

const SKIN = [0.55, 0.67, 0.15];
const SKIN_DK = [0.44, 0.56, 0.12];
const LEAF = [0.33, 0.46, 0.1];
const LEAF_MARKS = [[0.62, 0.73, 0.2], [0.2, 0.32, 0.1]];
const CROWN = [[0.88, 0.39, 0.44], [0.76, 0.3, 0.36], [0.47, 0.6, 0.13]];

// lib.scad VIEW and the scad's P(): a point landing on the front sheet at (sx, sz), picture-plane depth d
const DEG = Math.PI / 180;
const P = (sx, sz, d) => [sx * Math.cos(30 * DEG) - d * Math.sin(30 * DEG), sx * Math.sin(30 * DEG) + d * Math.cos(30 * DEG), sz - 0.17 * (d + 10)];
// ppz(d): the picture-plane frame at depth d (outlines traced from the front sheet)
const ppz = (d) => subFrame(rot([0, 0, 30], [0, d, -0.17 * (d + 10)]), [0, 0, 30], 1);

const headF = subFrame([0, -11.5, 25.5], [0, 0, 28], 1);
const ANT = [[0.7, 0.3, 4.3], [1.8, 0.6, 7.5], [3.5, 0.8, 10], [5, 0.5, 11]];
const ANT_R = [0.38, 0.32, 0.26, 0.2];

const FS = P(-6, 18.5, -6); const FE = P(-10, 14.8, -4.5); const FK = P(-13.2, 22.4, -4.5);
const NS = P(-2, 18.5, -9.5); const NE = P(5.2, 10.2, -11.5); const NK = P(1, 20.6, -12);
const FAR_BLADE = [[-13.8, 23.4], [-12.4, 22.6], [-12.6, 20], [-13.8, 17.2], [-14.3, 15.6], [-14.0, 14.6], [-15.1, 13.8],
  [-15.3, 12.0], [-16.0, 11.2], [-16.4, 9.0], [-17.6, 6.6], [-18.5, 9.5], [-18.5, 13.5], [-17.2, 18], [-15.3, 21.5]];
const NEAR_BLADE = [[0.1, 21.2], [1.6, 20.4], [1.2, 15], [0.9, 9], [0.4, 3.4], [-0.3, 2.6], [-1.3, 6.5], [-1.9, 11.5],
  [-1.7, 16.5], [-1.1, 20]];
const farF = ppz(-4.5);
const nearF = ppz(-12.3);

const eyeL = { side: 'L', at: [2.9, -1.85, -1.1], size: 2.1, yaw: 18, frame: headF };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: SKIN });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg1*', 'root', [2, -3, 9.5]),
  ...pair('leg2*', 'root', [2.5, 2, 9]),
  { name: 'body', parent: 'root', at: [0, -4, 9] },
  { name: 'abdomen', parent: 'body', at: [2, 0.5, 9.5] },
  { name: 'wingL', parent: 'body', at: [1.6, -5.4, 18] },
  { name: 'head', parent: 'body', at: [0, -10.3, 21.5] },
  ...['L', 'R'].flatMap((S) => [0, 1, 2].map((i) => ({
    name: `ant${S}${i + 1}`, parent: i === 0 ? 'head' : `ant${S}${i}`,
    at: headF.world([(S === 'L' ? 1 : -1) * ANT[i][0], ANT[i][1], ANT[i][2]]),
  }))),
  { name: 'clawL', parent: 'body', at: NS },
  { name: 'pinchL', parent: 'clawL', at: NK },
  { name: 'clawR', parent: 'body', at: FS },
  { name: 'pinchR', parent: 'clawR', at: FK },
  ...face.joints,
];

// the head in its own frame (two hulled halves, the corner spikes, the eyes)
const headD = (c) => {
  const l = headF.local(c);
  const f = [Math.abs(l[0]), l[1], l[2]];
  return Math.min(ellD(f, [2.2, 2.3, 1.8], [3.2, 0, 3.0]), ellD(f, [1.7, 2.3, 1.7], [3.5, -0.2, 0.2]),
    ellD(f, [1.4, 2.4, 1.8], [0, -0.3, 0.6]), ellD(f, [0.8, 1.2, 0.8], [0, -0.6, -4.2]),
    capD(f, [3.1, 0, 3.8], [3.9, 0, 5.7], 1.4, 0.2), ellD(f, [2.6, 1.4, 2.6], [2.9, -1.85, -1.1]));
};

const parts = [
  ['leg1*', any(limb([2, -3, 9.5], [9, -5, 11.5], 1.6, 1.35), limb([9, -5, 11.5], [14.1, -3.5, 0.6], 1.35, 0.55), ell([0.7, 1.4, 0.42], [14.4, -4.3, 0.42]))],
  ['leg2*', any(limb([2.5, 2, 9], [10, 3, 10.5], 1.5, 1.25), limb([10, 3, 10.5], [11, 6, 0.6], 1.25, 0.55), ell([0.7, 1.4, 0.42], [11.2, 5.2, 0.42]))],
  ['abdomen', blob([[[4, 4.5, 3.4], [2, 1, 9.5]], [[5, 4.6, 3.2], [6.5, 5, 8]], [[2.6, 2.4, 2.2], [9, 6.5, 9.8]]])],
  ['body', any(limb([0, -5, 7.5], [0, -7, 13.5], 2.6, 2.5), limb([0, -7, 13.5], [0, -9, 19.5], 2.5, 2.0),
    limb([0, -9, 19.5], [0, -10.6, 21.8], 1.7, 1.4), ell([2.4, 3.2, 2.6], [1.6, -5.4, 17.5]))],
  ['head', headD],
  ['clawL', (c) => Math.min(capD(c, NS, NE, 1.1, 1.2), capD(c, NE, NK, 1.3, 1.0))],
  ['clawR', (c) => Math.min(capD(c, FS, FE, 1.25, 1.35), capD(c, FE, FK, 1.5, 1.15))],
  ['pinchL', (c) => plateD(nearF.local(c), NEAR_BLADE, 1.2)],
  ['pinchR', (c) => plateD(farF.local(c), FAR_BLADE, 1.2)],
];

function assign(c, rgb) {
  if (CROWN.some((p) => near(rgb, p, 0.03))) return 'head';                // the lotus crown and its green sepals
  if (near(rgb, LEAF, 0.03) && c[2] > 24) return 'head';                    // the crown's dark centre
  if (LEAF_MARKS.some((p) => near(rgb, p, 0.03))) return 'wingL';
  if (near(rgb, LEAF, 0.03)) {
    // the leaf wings fan out from the wing base; the abdomen is the low, broad part under them
    const ab = blob([[[4, 4.5, 3.4], [2, 1, 9.5]], [[5, 4.6, 3.2], [6.5, 5, 8]], [[2.6, 2.4, 2.2], [9, 6.5, 9.8]]])(c);
    return ab < 1.08 ? 'abdomen' : 'wingL';
  }
  if (near(rgb, SKIN_DK, 0.03)) {
    const l = headF.local(c);
    if (l[2] > 4.2 && l[2] < 12) {
      const S = l[0] >= 0 ? 'L' : 'R';
      return `ant${S}${Math.min(3, chainHit(fold(l), ANT, ANT_R).i + 1)}`;
    }
  }
  return pick(c, parts);
}

const base = insectClips({ face, ant: 3, legs: 2, stride: 12, lift: 10, buzz: 14 });

const clips = {
  ...base,
  // fidget: the praying sway, rocking side to side with the scythes folded, then a quick snatch at the air
  idle_sway: {
    seconds: 2.6,
    pose: (t, u) => {
      const rock = Math.sin(TAU * 2 * u) * win(u, 0, 0.65, 0.1);
      const snatch = K(u, [[0.66, 0], [0.74, 1], [0.86, 0]]);
      return merge(base.idle.pose(t, u), {
        body: { r: [0, 6 * rock, 0] },
        head: { r: [0, -8 * rock, 0] },
        clawL: { r: [-30 * snatch, 0, -10 * snatch] }, clawR: { r: [-30 * snatch, 0, 10 * snatch] },
        pinchL: { r: [50 * snatch, 0, 0] }, pinchR: { r: [50 * snatch, 0, 0] },
      });
    },
  },
};

export default rigDef({ joints, assign, clips, extras: face.extras });
