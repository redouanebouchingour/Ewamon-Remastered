// Archonosis's rig: a floating archmage, bone mask and tall crown, crimson robe over a body that trails off into
// violet wisps, a vortex orb held over its right hand. Numbers are scad/archonosis.scad's (the old model; re-rig when
// the sprite-matched one lands).
import { K, merge, osc, rigDef } from './lib/anim.mjs';
import { floaterClips } from './lib/floater.mjs';
import { ellD, isAny, near, side } from './lib/geo.mjs';

const HEAD = [[0.93, 0.88, 0.72], [0.75, 0.68, 0.55], [0.85, 0.2, 0.75], [0.4, 0.06, 0.38], [0.38, 0.22, 0.55], [0.6, 0.6, 0.8]];
const GEM = [0.85, 0.2, 0.75];
const BODY = [[0.62, 0.12, 0.38], [0.42, 0.08, 0.28], [0.2, 0.28, 0.55], [0.38, 0.45, 0.75]];
const WISP = [0.42, 0.28, 0.72];
const WISP_HI = [0.55, 0.55, 0.92];
const SLEEVE = [0.36, 0.25, 0.6];
const HAND = [0.5, 0.42, 0.7];
const ORB = [[0.4, 0.75, 1], [0.8, 0.95, 1]];
const ORB_AT = [-11, -5, 27];

const tail = ['tail1', 'tail2', 'tail3'];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'body', parent: 'root', at: [0, 0, 16] },
  { name: 'head', parent: 'body', at: [0, -0.5, 33] },
  { name: 'armL', parent: 'body', at: [7, 0, 31] },
  { name: 'handL', parent: 'armL', at: [10.5, -4, 22.6] },
  { name: 'armR', parent: 'body', at: [-7, 0, 31] },
  { name: 'core', parent: 'armR', at: ORB_AT },   // the right hand is inside the orb
  { name: 'tail1', parent: 'body', at: [0, 0, 15] },
  { name: 'tail2', parent: 'tail1', at: [-1.5, -0.5, 9.5] },
  { name: 'tail3', parent: 'tail2', at: [-4, -1, 4.5] },
];

function assign(c, rgb) {
  const S = side(c);
  if (isAny(rgb, ORB)) return 'core';
  if (near(rgb, WISP_HI) && ellD(c, [6.2, 6.2, 6.2], ORB_AT) < 1) return 'core';
  if (near(rgb, GEM) && c[2] < 31) return 'body';
  if (isAny(rgb, HEAD)) return 'head';
  if (isAny(rgb, BODY)) return 'body';
  if (near(rgb, SLEEVE)) return `arm${S}`;
  if (near(rgb, HAND)) return S === 'L' ? 'handL' : 'core';
  if (isAny(rgb, [WISP, WISP_HI])) return c[2] > 9.5 ? 'tail1' : c[2] > 4.5 ? 'tail2' : 'tail3';
  return 'body';
}

const base = floaterClips({ tail, bob: 0.8 });

const clips = {
  ...base,
  // fidget: lifts the vortex orb and makes it spin up and flare, the left hand sweeping a spell
  idle_conjure: {
    seconds: 2.8,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.2, 1], [0.72, 1], [0.9, 0]]);
      const spin = K(u, [[0.15, 0], [0.8, 720]]);
      return merge({
        body: { p: [0, 0, 0.6 * on], r: [-4 * on, 0, -6 * on] },
        head: { r: [6 * on, 0, -14 * on] },
        armR: { r: [-25 * on, 15 * on, 0] },
        core: { r: [0, 0, spin], s: 1 + 0.15 * on + 0.05 * osc(u, 8) * on },
        armL: { r: [-20 * on, -30 * on, 20 * osc(u, 2) * on] },
      }, Object.fromEntries(tail.map((n, i) => [n, { r: [0, 0, 8 * osc(u, 2, -0.15 * i) * (1 + on)] }])));
    },
  },
};
// the orb keeps turning slowly in the idle loop
const idle0 = clips.idle.pose;
clips.idle = { ...clips.idle, pose: (t, u) => merge(idle0(t, u), { core: { r: [0, 0, 360 * u] } }) };
const walk0 = clips.walk.pose;
clips.walk = { ...clips.walk, pose: (t, u) => merge(walk0(t, u), { core: { r: [0, 0, 360 * u] } }) };

export default rigDef({ joints, assign, clips });
