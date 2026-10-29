// Bloomduck's rig: a plump scowling duck, a hibiscus worn on its head (the crest), stink squiggles floating above it,
// teal wings (the left one lying over the flank, its tip sticking out behind; the right one drooping behind the belly)
// and a fan of leafy tail feathers. The wings are flat slabs half painted onto the body, so they are flapL / flapR here
// with small beats of their own instead of the bird template's big flaps. Numbers are scad/bloomduck.scad's.
import { K, TAU, both, merge, osc, rigDef, shake, smooth, win } from './lib/anim.mjs';
import { birdClips } from './lib/bird.mjs';
import { ppFrame } from './lib/biped.mjs';
import { blinks, eyeKit } from './lib/face.mjs';
import { ellD, isAny, near, subFrame } from './lib/geo.mjs';

const GREENS = [[0.47, 0.65, 0.18], [0.76, 0.83, 0.20], [0.37, 0.58, 0.20], [0.23, 0.43, 0.16]];
const GREEN_LT = [0.76, 0.83, 0.20];
const TEAL = [0.05, 0.28, 0.22];
const ORANGE = [0.94, 0.41, 0.20];
const PINK = [0.98, 0.39, 0.54];
const RED = [0.57, 0.06, 0.18];
const BEIGE = [0.93, 0.87, 0.62];
const STINK = [0.80, 0.70, 0.36];

const BC = [-5.6, 0.5, 11.2];
const BR = [9.6, 10.8, 7.4];
const HC = [-5.9, -4, 21.3];
const HR = [6.0, 6.0, 5.9];
const FC = [-3.7, 0, 27.8];
const LEGS = [['L', BC[0] + 7.4], ['R', BC[0] - 6.8]];
const TAIL = ppFrame(4);

// the eye pair: translate(hc) rotate([0, 0, 25]) translate(-hc) translate([hc.x, hc.y, 0]), each eye at 5.4 out at
// +-32 deg, a sclera 1.75 x 0.8 x 1.3
const EYES = subFrame([HC[0], HC[1], 0], [0, 0, 25]);
const eyes = [1, -1].map((s) => {
  const a = (32 * s * Math.PI) / 180;
  return { side: s > 0 ? 'L' : 'R', at: [5.4 * Math.sin(a), -5.4 * Math.cos(a), 22], size: 1.6, yaw: 32 * s, flat: 0.45, frame: EYES };
});
const face = eyeKit({ eyes, parent: 'head', skin: GREENS[0], lid: [1.2, 0.8, 0.85] });

const joints = [
  { name: 'root', at: [BC[0], -1, 0] },
  ...LEGS.map(([S, x]) => ({ name: `leg${S}`, parent: 'root', at: [x, -2, 5.5] })),
  { name: 'body', parent: 'root', at: [BC[0], -1, 4] },
  { name: 'head', parent: 'body', at: [-5.8, -2, 16] },
  { name: 'crest1', parent: 'head', at: ppFrame(-2.2).world(FC) },
  { name: 'stink', parent: 'head', at: ppFrame(-1).world([-2, 0, 32]) },
  { name: 'flapL', parent: 'body', at: ppFrame(0).world([-1, 0, 13]), rot: [0, 0, 30] },
  { name: 'flapR', parent: 'body', at: ppFrame(-0.5).world([-9.5, 0, 14]), rot: [0, 0, 30] },
  { name: 'tail1', parent: 'body', at: TAIL.world([4, 0, 9.2]) },
  ...face.joints,
];

function assign(c, rgb) {
  const bodyD = Math.min(ellD(c, BR, BC), ellD(c, [7.6, 8.4, 1.6], [BC[0], 0.5, 4.6]));
  if (near(rgb, STINK)) return 'stink';
  if (near(rgb, PINK) || near(rgb, BEIGE)) return 'crest1';
  if (near(rgb, RED) && c[2] > 21) return 'crest1';
  if (near(rgb, GREEN_LT) && c[2] > 25) return 'crest1';
  if (near(rgb, TEAL) && c[2] > 24) return 'crest1';
  if (near(rgb, ORANGE) && c[2] < 7) return c[0] > BC[0] ? 'legL' : 'legR';
  // the wings' slabs where they stand off the body; the patch over the flank stays on the body
  if (near(rgb, TEAL)) return bodyD > 1.15 ? (ppFrame(0).local(c)[0] < -6 ? 'flapR' : 'flapL') : 'body';
  if (isAny(rgb, GREENS)) {
    // the leaf feathers fan from the rump in the pp(4) plane
    const q = TAIL.local(c);
    const r = Math.hypot(q[0] - 4, q[2] - 9.2);
    if (c[2] < 19 && Math.abs(q[1]) < 1.7 && q[0] > 4.5 && r > 2 && bodyD > 1.04 && ellD(c, [3.6, 3.4, 3.2], [1.2, 6.5, 9.5]) > 1.05) return 'tail1';
    const headD = Math.min(ellD(c, HR, HC), ellD(c, [5.5, 5.5, 4.7], [-5.8, -2, 16.4]), ellD(c, [4.2, 3.6, 2.6], [-4.6, -3.2, 26.3]));
    return headD < bodyD ? 'head' : 'body';
  }
  return c[2] > 15 ? 'head' : 'body';      // bill, eyes; the breast
}

// the wings: `up` lifts both (the right mirrors), `beat` sways them back and forth
const flap = (up, upR = up, beat = 0) => both('flap', { r: [beat, -up, 0] }, { r: [beat, -upR, 0] });
const stink = (t, u, k = 1, cycles = 2) => ({ stink: { p: [0, 0, 0.5 * k * osc(u, cycles)], r: [3 * k * osc(u, cycles, 0.3), 0, 6 * k * osc(u, cycles / 2, 0.1)], s: 1 + 0.06 * k * osc(u, cycles * 2) } });

const base = birdClips({
  face, crest: ['crest1'], tail: ['tail1'],
  add: {
    idle: (t, u) => merge(flap(2 * osc(u, 2)), stink(t, u)),
    walk: (t, u) => merge(flap(5 + 3 * osc(u, 2)), stink(t, u, 1.5, 1)),
    idle_peck: (t, u) => merge(flap(4 * win(u, 0.08, 0.85, 0.08)), stink(t, u)),
    windup: (t, u) => { const w = smooth(u / 0.8); return merge(flap(14 * w, 14 * w, 8 * w), stink(t, u, 1, 1)); },
    lunge: (t, u) => { const hit = K(u, [[0.12, 0], [0.4, 1], [0.62, 1], [1, 0]]); return merge(flap(14 + 8 * hit, 14 + 8 * hit, 8 - 14 * hit), stink(t, u, 2, 1)); },
    hurt: (t, u) => { const k = K(u, [[0, 0], [0.18, 1], [0.6, 0.75], [1, 0.45]]); return merge(flap(22 * k + 3 * shake(u, 5)), { stink: { p: [0, 0, 1.5 * k], s: 1 + 0.25 * k } }); },
    recoil: (t, u) => { const k = K(u, [[0, 0], [0.4, 1], [1, 0]]); return merge(flap(-6 * k), stink(t, u, 1, 1)); },
    faint: (t, u) => { const d = smooth((u - 0.2) / 0.55); return merge(flap(-10 * d), { stink: { p: [0, 0, -1.5 * d], s: 1 - 0.5 * d } }); },
    celebrate: (t, u) => merge(flap(12 + 14 * (Math.sin(TAU * 4 * u) * 0.5 + 0.5)), stink(t, u, 2, 2)),
    enter: (t, u) => { const over = win(u, 0.4, 0.9, 0.12); return merge(flap(18 * over), { stink: { s: 0.3 + 0.7 * smooth((u - 0.3) / 0.5) } }); },
    exit: (t, u) => { const k = win(u, 0, 0.85, 0.2); return merge(flap((20 + 10 * Math.sin(TAU * 2 * u)) * k, 0), stink(t, u)); },
  },
});
const { idle_flap: _flap, idle_preen: _preen, ...clips0 } = base;

const clips = {
  ...clips0,

  // fidget: a grumpy huff: it puffs up its chest, turns its bill away with the eyes shut, and the stink puffs up
  idle_huff: {
    seconds: 2.4,
    pose: (t, u) => {
      const k = K(u, [[0, 0], [0.18, 1], [0.6, 1], [0.8, 0]]);
      const puff = win(u, 0.55, 0.75, 0.05);
      return merge({
        body: { r: [-6 * k, 0, -6 * k], s: [1 + 0.05 * k, 1 + 0.05 * k, 1 + 0.03 * k] },
        head: { r: [-8 * k, 4 * k, -24 * k] },
        ...face.pose(k > 0.5 ? 'shut' : 'open', blinks(u, [[0.9, 0.95]])),
        stink: { p: [0, 0, 2 * puff], s: 1 + 0.3 * puff },
      }, flap(6 * k + 10 * puff), Object.fromEntries([['crest1', { r: [-6 * puff, 0, 4 * puff] }], ['tail1', { r: [0, 0, 12 * puff] }]]));
    },
  },

  // fidget: fans the smell away with its left wing, nose wrinkled (> <), the squiggles blown sideways
  idle_fan: {
    seconds: 2.2,
    pose: (t, u) => {
      const on = win(u, 0.1, 0.85, 0.1);
      const fan = Math.sin(TAU * 4 * u) * on;
      return merge({
        body: { r: [0, 0, 8 * on] },
        head: { r: [-6 * on, 0, 14 * on] },
        ...face.pose(on > 0.4 ? 'squeeze' : 'open'),
        flapL: { r: [10 * fan, -18 * on - 10 * fan, 0] },
        stink: { p: [-1.5 * on - 0.8 * fan, 0, 0.4 * on], r: [0, 0, 12 * fan] },
      });
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
