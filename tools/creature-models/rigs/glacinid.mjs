// Glacinid's rig: an ice serpent in a W-coil, the neck rearing up at the front and the tail climbing into a frost tree
// at the back. The coil stays on the ground (root); the neck is the spine, the rising tail its own chain. Numbers are
// scad/glacinid.scad's; the head is its translate([-9, -6.5, 22]) scale(1.8) translate([0, 8, -27]) block (H).
import { K, merge, osc, rigDef, win } from './lib/anim.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { blobD, chainHit, closest, subFrame } from './lib/geo.mjs';
import { serpentClips } from './lib/serpent.mjs';

const ICE = [0.72, 0.82, 0.95];
const H = subFrame([-9, 7.9, -26.6], [0, 0, 0], 1.8);

const PTS = [[-9, -6, 23], [-9.5, -6.5, 15], [-8, -4, 7.5], [-3, -1, 5], [2, 1.5, 7.5], [6.5, 3, 8.5], [11, 4, 6], [15.5, 5, 5.5],
  [19.5, 6, 9], [21.5, 6.5, 15], [20.5, 6.5, 21], [21.5, 7, 26], [24, 7.5, 29.5]];
const RS = [5, 5.8, 6.2, 5.8, 5.4, 5.2, 5, 4.8, 4.4, 3.8, 3.2, 2.4, 1.2];
const spine = ['spine1', 'spine2', 'neck'];
const tail = ['tail1', 'tail2', 'tail3', 'tail4'];

const eyeL = { side: 'L', at: [2.4, -13, 29.7], size: 1.5, yaw: -32, flat: 0.4, frame: H };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: ICE });

const joints = [
  { name: 'root', at: [-3, -1, 0] },
  { name: 'spine1', parent: 'root', at: PTS[2] },
  { name: 'spine2', parent: 'spine1', at: PTS[1] },
  { name: 'neck', parent: 'spine2', at: [-9.2, -6.2, 19] },
  { name: 'head', parent: 'neck', at: [-9, -6.5, 23.5] },
  ...tail.map((name, i) => ({ name, parent: i === 0 ? 'root' : tail[i - 1], at: PTS[8 + i] })),
  ...face.joints,
];

/** The joint a point of the coil chain belongs to, by its link and the place along it. */
function linkJoint({ i, t }) {
  if (i === 0) return t < 0.5 ? 'neck' : 'spine2';
  if (i === 1) return 'spine1';
  if (i >= 8) return tail[Math.min(3, i - 8)];
  return 'root';
}

function assign(c) {
  const h = H.local(c);
  // antlers, crown and frill sit above or beside the head's own wedge
  if (c[0] < -2 && h[2] > 31.5) return 'head';
  const headD = Math.min(
    blobD(h, [[[4.4, 4.4, 4], [0, -8.4, 29.4]], [[3.2, 3.2, 2.6], [0, -13, 28.2]], [[1.8, 1.6, 1.5], [0, -16.8, 27.6]], [[3, 3, 1.6], [0, -10, 26.4]]]),
    Math.abs(h[0]) > 3.5 && h[1] < -5 && h[1] > -11 && h[2] > 26 ? 1 : 9,
  );
  const hit = chainHit(c, PTS, RS);
  if (c[0] > 2) return linkJoint(hit);   // the far fronds of the tail tree lie closer to the head by normalised distance
  return closest([['head', headD * 1.02], [linkJoint(hit), hit.d]]);
}

const base = serpentClips({ face, spine, tail });

const clips = {
  ...base,

  // fidget: shakes frost off its antlers, a shiver running down the coil to the tail tree
  idle_shiver: {
    seconds: 2,
    pose: (t, u) => {
      const sh = Math.sin(Math.PI * 2 * 9 * u) * win(u, 0.2, 0.7, 0.05);
      const look = K(u, [[0, 0], [0.15, 1], [0.8, 1], [0.95, 0]]);
      return merge({
        neck: { r: [-3 * look, 0, 3 * sh] },
        head: { r: [-6 * look, 6 * sh, 0] },
        ...face.pose(Math.abs(sh) > 0.2 ? 'squeeze' : 'open', blinks(u, [[0.84, 0.88]])),
      }, Object.fromEntries(tail.map((n, i) => [n, { r: [0, 0, 3 * Math.sin(Math.PI * 2 * 9 * u - i) * win(u, 0.3, 0.8, 0.05)] }])),
      { spine2: { r: [osc(u, 2), 0, 0] } });
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
