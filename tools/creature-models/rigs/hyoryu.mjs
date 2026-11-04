// Hyoryu's rig: an ice serpent dragon rearing up out of a figure-eight coil, the tail rising into a crescent ice
// blade, crystal-feather wings off the shoulders, small clawed forearms and a maned head. Numbers are
// scad/hyoryu.scad's: the body is authored in the picture plane (W() turns [sheet x, depth, z] into scad), the head
// is its translate(HC) rotate([0, 0, -45]) rotate([33, 0, 0]) scale(1.2) block (H). Hyoryu Majin shares the body and
// passes its own colours (hyoryu_majin.mjs).
import { both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { blobD, capD, chainHit, closest, isAny, subFrame } from './lib/geo.mjs';
import { serpentClips } from './lib/serpent.mjs';

const C30 = Math.cos(Math.PI / 6);
const S30 = 0.5;
const W = (p) => [p[0] * C30 - p[1] * S30, p[0] * S30 + p[1] * C30, p[2]];
const sheetX = (c) => c[0] * C30 + c[1] * S30;

const SP = [[-3.0, 0.5, 28.0], [-2.4, 0.3, 25.0], [-3.0, 0, 21.5], [-3.4, -0.3, 18.0], [-2.5, -1, 13.0],
  [-0.7, -1.5, 8.5], [2.0, -1.5, 4.6], [6.0, -1, 2.7], [10.5, -0.5, 2.8], [14.6, 0, 4.4], [16.2, 0.3, 8.0],
  [14.8, 0.6, 11.2], [10.5, 1, 11.8], [6.0, 1.8, 10.5], [2.0, 2.8, 8.0], [-1.0, 2.0, 5.0], [-4.5, 1.2, 2.7],
  [-9.0, 0.6, 1.8], [-13.0, 0.3, 3.3], [-15.4, 0.2, 6.2]];
const SR = [2.1, 2.4, 3.2, 3.7, 3.7, 3.5, 3.1, 2.75, 2.65, 2.45, 2.2, 1.9, 1.7, 1.65, 1.6, 1.7, 1.75, 1.6, 1.3, 1.0];
const SPW = SP.map(W);
const AN = [[1.2, -1.2, 19.3], [3.6, -3.2, 15.2], [-2.4, -4.4, 16.4], [-3.9, -4.5, 16.7]].map(W);   // near arm (+X)
const AF = [[-5.2, 1.0, 18.5], [-8.8, -0.5, 15.2], [-10.8, -1.0, 19.6], [-11.6, -1.0, 21.3]].map(W); // far arm
const CX = W([-3.0, 0, 0])[0];
const HC = W([-6.0, -0.5, 30.4]);
const H = subFrame(HC, [33, 0, -45], 1.2);
const HEAD = [[[1.9, 1.8, 1.75], [0, 0.4, 0.15]], [[1.55, 1.4, 1.35], [0, -1.6, -0.1]], [[1.15, 1.3, 0.95], [0, -3.6, -0.3]],
  [[0.85, 0.6, 0.72], [0, -5.1, -0.25]]];
const spine = ['spine1', 'spine2', 'neck'];
const tail = ['tail1', 'tail2'];

export const HYORYU = {
  body: [0.34, 0.7, 0.77],
  wing: [[0.7, 0.88, 0.96], [0.85, 0.96, 1], [0.8, 0.84, 0.97], [0.86, 0.98, 1], [0.22, 0.55, 0.64]],
  mane: [[0.93, 0.98, 0.99], [0.68, 0.8, 0.93]],
  head: [[0.3, 0.52, 0.7], [0.16, 0.27, 0.44], [0.6, 0.85, 0.92], [0.62, 0.88, 0.93], [0.6, 0.95, 1], [0.95, 1, 1]],
};

function linkJoint({ i }) {
  if (i === 0) return 'neck';
  if (i <= 2) return 'spine2';
  if (i <= 4) return 'spine1';
  if (i === 16) return 'tail1';
  if (i >= 17) return 'tail2';
  return 'root';
}

export function hyoryuRig(col) {
  const eyeL = { side: 'L', at: [1.4, -1.9, 0.4], size: 0.72, yaw: 55, flat: 0.4, frame: H };
  const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: col.body });
  const wingRoot = (s) => [CX + s * 2.5, 2.5, 20.3];

  const joints = [
    { name: 'root', at: W([4, 0, 0]) },
    { name: 'spine1', parent: 'root', at: SPW[5] },
    { name: 'spine2', parent: 'spine1', at: SPW[3] },
    { name: 'neck', parent: 'spine2', at: SPW[1] },
    { name: 'head', parent: 'neck', at: W([-4.0, 0, 28.8]) },
    { name: 'wingL', parent: 'spine2', at: wingRoot(1) },
    { name: 'wingR', parent: 'spine2', at: wingRoot(-1) },
    { name: 'armL', parent: 'spine2', at: AN[0] },
    { name: 'foreL', parent: 'armL', at: AN[1] },
    { name: 'armR', parent: 'spine2', at: AF[0] },
    { name: 'foreR', parent: 'armR', at: AF[1] },
    { name: 'tail1', parent: 'root', at: SPW[16] },
    { name: 'tail2', parent: 'tail1', at: SPW[17] },
    ...face.joints,
  ];

  function assign(c, rgb) {
    const sx = sheetX(c);
    const z = c[2];
    const hit = chainHit(c, SPW, SR);
    const headD = blobD(H.local(c), HEAD);
    const S = c[0] >= CX ? 'L' : 'R';
    if (sx < -14.2 && z < 21.5 && z > 5 && !(isAny(rgb, col.wing) && z > 17)) return 'tail2';   // the crescent blade
    // the feathers and the wing arm (the vein colour also paints the belly scutes and the blade's edge)
    if (isAny(rgb, col.wing) && z > 17 && hit.d > 1.25 && headD > 1.3 && sx > -14) return `wing${S}`;
    if (isAny(rgb, col.mane)) return z > 28 ? 'head' : 'neck';
    // horns, the head fin, the eyes; the blade shares the fin's colour and the claws the horn's navy
    if (isAny(rgb, col.head) && z > 25) return 'head';
    const arms = [
      ['armL', capD(c, AN[0], AN[1], 1.35, 1.2)],
      ['foreL', Math.min(capD(c, AN[1], AN[2], 1.2, 0.95), capD(c, AN[2], AN[3], 0.95, 0.95) * 0.8)],
      ['armR', capD(c, AF[0], AF[1], 1.25, 1.1)],
      ['foreR', Math.min(capD(c, AF[1], AF[2], 1.1, 0.9), capD(c, AF[2], AF[3], 0.9, 0.9) * 0.8)],
    ];
    return closest([['head', headD], ...arms, [linkJoint(hit), hit.d]]);
  }

  // the crystal wings stir with the body (they reach up and out: ry < 0 tips the left one further out)
  const wings = (spread, beat = 0) => both('wing', { r: [-4 * spread, -10 * spread - beat, 0] });
  const base = serpentClips({
    face, spine, tail,
    add: {
      idle: (t, u) => wings(0, 3 * osc(u, 2)),
      walk: (t, u) => wings(0.2, 5 * osc(u, 2)),
      windup: (t, u) => wings(Math.min(1, u / 0.8)),
      lunge: (t, u) => wings(1 - u, -8 * win(u, 0.3, 0.6, 0.1)),
      hurt: (t, u) => wings(0.6 * win(u, 0, 1, 0.1), 6 * Math.sin(Math.PI * 10 * u) * (1 - u)),
      faint: (t, u) => wings(-0.6 * Math.min(1, u / 0.7)),
      celebrate: (t, u) => wings(0.8, 14 * osc(u, 3)),
      enter: (t, u) => wings(win(u, 0.4, 0.9, 0.12)),
    },
  });

  const clips = {
    ...base,

    // fidget: spreads the crystal wings wide, holds them up to the light, folds them back with a shiver
    idle_spread: {
      seconds: 2.6,
      pose: (t, u) => {
        const open = win(u, 0.12, 0.72, 0.14);
        const sh = Math.sin(Math.PI * 2 * 8 * u) * win(u, 0.72, 0.92, 0.03);
        return merge({
          spine2: { r: [-3 * open, 0, 0] },
          neck: { r: [-4 * open, 0, 0] },
          head: { r: [-6 * open, 0, 0] },
          ...face.pose(open > 0.6 ? 'happy' : 'open', blinks(u, [[0.94, 0.98]])),
        }, wings(1.6 * open, 6 * sh));
      },
    },
  };

  return rigDef({ joints, assign, extras: face.extras, clips });
}

export default hyoryuRig(HYORYU);
