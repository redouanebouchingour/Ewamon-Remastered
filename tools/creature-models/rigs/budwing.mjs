// Budwing's rig: a caterpillar-dragon hatchling on the insect template. The body runs along +Y: three front segments
// (body), four rear ones (abdomen) and the flower-bud tail; the head sits on an upright neck (both one joint), small
// leaf wings behind it and three pairs of stubby legs. Numbers are scad/budwing.scad's.
import { K, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { blobD, capD, chainHit, closest, ellD, fold, isAny, near, petalD, rot, side, unrot } from './lib/geo.mjs';
import { insectClips } from './lib/insect.mjs';

const GREEN = [0.36, 0.6, 0.27];
const GREENS = [GREEN, [0.5, 0.72, 0.35]];
const WING_TIP = [0.85, 0.3, 0.2];
const CLAW = [0.85, 0.25, 0.18];
const BUD = [[0.98, 0.5, 0.12], [1, 0.75, 0.25]];
const ANTLER = [0.5, 0.36, 0.25];

const SEGS = [[0, 6.8, 6.5], [4.5, 6.6, 6.2], [9, 6.2, 5.8], [13.5, 5.6, 5.2], [17.5, 4.8, 4.6], [21, 3.8, 3.8], [24, 2.8, 3.2]];
const LEG_Y = [0, 8, 15];

const eyeL = { side: 'L', at: [4.3, -10.5, 23.4], size: 2.3, yaw: 22 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: GREEN });

const joints = [
  { name: 'root', at: [0, 8, 0] },
  { name: 'body', parent: 'root', at: [0, 4, 3] },
  { name: 'abdomen', parent: 'body', at: [0, 11.2, 5] },
  { name: 'tail1', parent: 'abdomen', at: [0, 25.5, 4.2] },
  { name: 'head', parent: 'body', at: [0, -1, 9] },
  { name: 'wingL', parent: 'body', at: [4, 4, 16] },
  { name: 'wingR', parent: 'body', at: [-4, 4, 16] },
  ...LEG_Y.flatMap((y, i) => [{ name: `leg${i + 1}L`, parent: 'root', at: [4.6, y, 4] }, { name: `leg${i + 1}R`, parent: 'root', at: [-4.6, y, 4] }]),
  ...face.joints,
];

/** The leaf wing (written for the left, +X): four leaves fanning from [4, 4, 16], the whole fan turned 30 about Z. */
function wingD(f) {
  const q = unrot([0, 0, 30], [f[0] - 4, f[1] - 4, f[2] - 16]);
  return Math.min(...[0, 1, 2, 3].map((k) => {
    const a = 15 + k * 17;
    return Math.min(petalD(q, [1.3, 0.5, 5.5], rot([0, a, 0], [0, 0, 5]), [0, a, 0]), petalD(q, [0.8, 0.45, 1.4], rot([0, a, 0], [0, 0, 10]), [0, a, 0]));
  }));
}

function assign(c, rgb) {
  const S = side(c);
  const f = fold(c);
  const legAt = (y) => `leg${LEG_Y.reduce((b, v, i) => (Math.abs(v - y) < Math.abs(LEG_Y[b] - y) ? i : b), 0) + 1}${S}`;
  if (near(rgb, CLAW) || near(rgb, WING_TIP)) return near(rgb, WING_TIP) && c[2] > 12 ? `wing${S}` : legAt(c[1] + 1.6);
  if (isAny(rgb, BUD) || (c[1] > 25 && c[2] > 5.5)) return 'tail1';
  if (near(rgb, ANTLER) && c[2] > 26) return 'head';
  const wing = isAny(rgb, GREENS) ? wingD(f) : 9;
  const legs = Math.min(...LEG_Y.map((y) => capD(f, [4.6, y, 4], [5.4, y - 0.6, 1.1], 1.9, 1.5)));
  const head = Math.min(blobD(c, [[[9, 7.6, 6.8], [0, -3.5, 22]], [[6.8, 4.6, 4.2], [0, -9, 20.4]]]),
    chainHit(c, [[0, -1, 8], [0, -3, 13], [0, -3.2, 17]], [5.2, 4.6, 4.4]).d * 1.02, ellD(c, [3.6, 3, 1.6], [0, -1, 27.6]),
    ellD(c, [2.6, 2.6, 2.2], [0, 1.4, Math.min(20, Math.max(12, c[2]))]), ellD(f, [2.6, 2.6, 2.6], [8.5, -3, 22]));
  const seg = SEGS.map(([y, r, z]) => ellD(c, [r * 1.05, 3.2, r], [0, y, z]));
  const front = Math.min(...seg.slice(0, 3), ellD(c, [5.2, 9, 2.5], [0, 6, 2.6]));
  const rear = Math.min(...seg.slice(3), capD(c, [0, 25.5, 4.2], [0, 27.5, 7], 1.4, 0.9));
  return closest([[`wing${S}`, wing], [legAt(c[1]), legs], ['head', head], ['body', front], ['abdomen', rear]]);
}

// the stubby legs hang straight down, so they step forward and back (rx) rather than swinging round (the template's rz)
const step = (u, amp) => Object.assign({}, ...LEG_Y.map((_, i) => both(`leg${i + 1}`,
  { r: [-amp * osc(u, 1, i % 2 === 0 ? 0 : 0.5), 0, 0] }, { r: [-amp * osc(u, 1, i % 2 === 0 ? 0.5 : 0), 0, 0] })));

const base = insectClips({
  face, tail: ['tail1'], stride: 0, lift: 10, buzz: 26,
  add: {
    walk: (t, u) => merge(step(u, 18), { head: { r: [0, 0, 3 * osc(u, 1)] } }),
    idle: (t, u) => ({ tail1: { r: [0, 6 * osc(u, 1, 0.3), 4 * osc(u, 1)] } }),
  },
});

const clips = {
  ...base,

  // fidget: turns to look back at its flower bud, which bobs open-and-shut, then a pleased wriggle
  idle_bud: {
    seconds: 2.6,
    pose: (t, u) => {
      const look = K(u, [[0, 0], [0.18, 1], [0.62, 1], [0.78, 0]]);
      const bob = osc(u, 4) * win(u, 0.2, 0.6, 0.05);
      const wr = osc(u, 6) * win(u, 0.7, 0.95, 0.04);
      return merge({
        head: { r: [-4 * look, 0, 50 * look] },
        body: { r: [0, 0, 6 * look + 3 * wr] },
        abdomen: { r: [0, 0, -10 * look - 4 * wr] },
        tail1: { r: [12 * bob, 0, -20 * look] },
        ...face.pose(look > 0.5 && bob > 0.3 ? 'happy' : 'open', blinks(u, [[0.9, 0.94]])),
      });
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
