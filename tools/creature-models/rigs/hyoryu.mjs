// Hyoryu's rig: an ice serpent dragon rearing up out of a figure-eight coil, the tail rising into a crescent ice
// blade, crystal-feather wings off the shoulders, small clawed forearms and a maned head. Numbers are
// scad/hyoryu.scad's; the head is its translate(pts[0] + [0, -1, 2.6]) scale(1.3) block (H). Hyoryu Majin shares
// the body and passes its own colours (hyoryu_majin.mjs).
import { both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { blobD, capD, chainHit, closest, fold, isAny, side, subFrame } from './lib/geo.mjs';
import { serpentClips } from './lib/serpent.mjs';

const PTS = [[-0.5, -2, 28], [0, -0.5, 24], [1, 0.5, 19], [1, 0.5, 14.5], [3.5, 1, 11], [8, 1.5, 13], [12.5, 1.5, 8.5],
  [10.5, 1, 3.5], [6, 0, 2.3], [1, -0.5, 3], [-3, -0.5, 5.5], [-6.5, 0, 4], [-10, 0.5, 2], [-14, 1, 2], [-16.5, 1, 4.5]];
const RS = [2.4, 2.6, 2.7, 2.7, 2.6, 2.5, 2.3, 2.2, 2.1, 2, 1.8, 1.6, 1.3, 1.0, 0.8];
const H = subFrame([-0.5, -3, 30.6], [0, 0, 0], 1.3);
const spine = ['spine1', 'spine2', 'neck'];
const tail = ['tail1', 'tail2'];

export const HYORYU = {
  body: [0.35, 0.7, 0.75],
  wing: [[0.62, 0.84, 1], [0.78, 0.92, 1], [0.4, 0.62, 0.78]],
  mane: [[0.9, 0.95, 1], [0.7, 0.82, 0.95]],
  horn: [0.2, 0.42, 0.55],
  shard: [0.6, 0.88, 0.95],
};

function linkJoint({ i }) {
  if (i === 0) return 'neck';
  if (i === 1) return 'spine2';
  if (i === 2) return 'spine1';
  if (i === 12) return 'tail1';
  if (i >= 13) return 'tail2';
  return 'root';
}

export function hyoryuRig(col) {
  const eyeL = { side: 'L', at: [1.3, -2.05, 0.75], size: 0.95, yaw: -20, flat: 0.4, frame: H };
  const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: col.body });

  const joints = [
    { name: 'root', at: [3, 0.5, 0] },
    { name: 'spine1', parent: 'root', at: PTS[3] },
    { name: 'spine2', parent: 'spine1', at: PTS[2] },
    { name: 'neck', parent: 'spine2', at: PTS[1] },
    { name: 'head', parent: 'neck', at: [-0.5, -1.8, 28.2] },
    { name: 'wingL', parent: 'spine2', at: [1.8, 2, 21] },
    { name: 'wingR', parent: 'spine2', at: [-1.8, 2, 21] },
    { name: 'armL', parent: 'spine2', at: [1.8, -1.5, 21] },
    { name: 'foreL', parent: 'armL', at: [3.6, -3.5, 18.5] },
    { name: 'armR', parent: 'spine2', at: [-1.8, -1.5, 21] },
    { name: 'foreR', parent: 'armR', at: [-3.6, -3.5, 18.5] },
    { name: 'tail1', parent: 'root', at: PTS[12] },
    { name: 'tail2', parent: 'tail1', at: PTS[13] },
    ...face.joints,
  ];

  function assign(c, rgb) {
    const S = side(c);
    const f = fold(c);
    const inWing = c[2] > 19.5 && Math.abs(c[0]) > 2.2 && c[1] > 1.8;
    // the Majin's crimson feathers match its coil shards, so wing colours count only up on the shoulders
    if ((isAny(rgb, col.wing) && c[2] > 19.5 && c[1] > 1) || (isAny(rgb, [col.shard]) && inWing)) return `wing${S}`;
    if (c[0] < -12.5) return 'tail2';                              // the crescent blade and its barb
    if (isAny(rgb, col.mane)) return c[2] > 25.5 ? 'head' : 'neck';
    if (isAny(rgb, [col.horn]) && c[2] > 25.5) return 'head';     // Hyoryu's dorsal stripe has nearly the horns' colour
    const h = H.local(c);
    const headD = Math.min(blobD(h, [[[2.4, 2.4, 2.2], [0, 0, 0]], [[1.3, 2, 1.1], [0, -3.4, -0.6]]]),
      capD(fold(h), [0.6, -4.8, -0.4], [5, -2.6, -3.6], 0.6));     // the whiskers
    const arm = capD(f, [1.8, -1.5, 21], [3.6, -3.5, 18.5], 0.9, 0.75);
    const fore = Math.min(capD(f, [3.6, -3.5, 18.5], [3.4, -5, 20.5], 0.75, 0.6), capD(f, [3.4, -5.3, 20.8], [3.4, -6.3, 21.6], 0.7));
    const hit = chainHit(c, PTS, RS);
    return closest([['head', headD], [`arm${S}`, arm], [`fore${S}`, fore], [linkJoint(hit), hit.d]]);
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
