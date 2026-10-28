// Lumistar's rig: a puffy star head with a tilted halo ring, a navy cloak, mitten hands held out, and a wisp tail
// instead of legs (it rests on the tail, so the biped template runs without legs and the tail is a chain off the root).
// Three gold sparkles float around the head. Numbers are scad/lumistar.scad's.
import { K, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, ell, limb, pair, pick } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { subFrame, unrot } from './lib/geo.mjs';

const HEAD = subFrame([0, 0, 33]);
const eyeL = { side: 'L', at: [2.9, -4.9, -0.2], size: 2.3, yaw: -10, flat: 0.4, frame: HEAD };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: [1, 0.95, 0.66] });
const SPARKS = [[-13, -2, 36], [13, -1, 38], [-11, -1, 41]];

// puffy_star(R, core, th, tip) about c: the nearest arm, a capsule in the XZ plane with its thickness squashed along Y
const starT = (c0, R, core, th, tip) => (c) => {
  const q = [c[0] - c0[0], ((c[1] - c0[1]) * core) / th, c[2] - c0[2]];
  return Math.min(...[0, 1, 2, 3, 4].map((i) => {
    const a = ((90 + i * 72) * Math.PI) / 180;
    return limb([0, 0, 0], [R * Math.cos(a), 0, R * Math.sin(a)], core, tip)(q);
  }));
};
// halo: rotate([12, 0, 0]) scale([14, 7, 1]) of a unit ring, about [0, 0, 33]
const haloT = (c) => {
  const q = unrot([12, 0, 0], [c[0], c[1], c[2] - 33]);
  return Math.hypot((Math.hypot(q[0] / 14, q[1] / 7) - 1) / 0.05, q[2] / 0.5);
};

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'body', parent: 'root', at: [0, 0, 12] },
  { name: 'head', parent: 'body', at: [0, 0, 26] },
  { name: 'halo', parent: 'head', at: [0, 0, 33], rot: [12, 0, 0] },
  ...pair('arm*', 'body', [4.5, 0, 23]),
  ...pair('hand*', 'arm*', [10.2, -1, 21.1]),
  { name: 'tail1', parent: 'root', at: [3, -0.5, 5] },
  { name: 'tail2', parent: 'tail1', at: [6, 0, 2] },
  ...SPARKS.map((p, i) => ({ name: `spark${i + 1}`, parent: 'root', at: p })),
  ...face.joints,
];

const parts = [
  ['body', any(limb([0, 0, 14], [1, 0, 9], 4.4, 3.4), limb([1, 0, 9], [3, -0.5, 5], 3.4, 2.4), limb([0, -1.6, 13], [3, -1.8, 5.4], 3.2, 1.6),
    ell([12, 10, 6], [0, 0, 13]), ell([8, 7, 8], [0, 0, 19]), ell([5.5, 5, 3], [0, 0, 24.5]), ell([6.6, 6, 2.4], [0, 0.5, 25.5]))],
  ['tail1', any(limb([3, -0.5, 5], [6, 0, 2], 2.4, 1.4), limb([3, -1.8, 5.4], [6, -1, 2.6], 1.6, 0.8))],
  ['tail2', limb([6, 0, 2], [10, 1, 1.2], 1.4, 0.4)],
  ['head', any(starT([0, 0, 33], 10.5, 9, 4.4, 3.4), starT([0, -3.8, 32.4], 6.4, 6.8, 1.2, 2.6))],
  ['halo', haloT],
  ['arm*', limb([4.5, 0, 23], [10, -1, 21], 2.4, 2.1)],
  ['hand*', any(ell([2.2, 2.2, 0.8], [10.4, -1, 21.1]), ell([2, 1.6, 2.2], [12.4, -1.2, 22]), ell([0.8, 0.8, 1.2], [11.8, -1.6, 24]))],
  ...SPARKS.map((p, i) => [`spark${i + 1}`, ell([1.2, 1.2, 1.5], p)]),
];

// the halo rocks and the sparkles twinkle in every clip
const glow = (u, k = 1, cycles = 1) => ({
  halo: { r: [3 * k * osc(u, cycles), 0, 4 * k * osc(u, cycles, 0.25)] },
  ...Object.fromEntries(SPARKS.map((_, i) => [`spark${i + 1}`, { s: 1 + 0.35 * osc(u, 2 * cycles, i / 3), r: [0, 90 * u * cycles, 0], p: [0, 0, 0.5 * osc(u, cycles, i / 3)] }])),
});

const base = bipedClips({
  face, tail: ['tail1', 'tail2'], hopH: 0, hopScale: 0, droop: 0.5,
  // the arms stick out sideways: the "punch" swings the right mitten round to the front
  punch: { arm: [0, 0, 70] },
  cheer: { arm: [0, -45, 0] },
  add: {
    idle: (t, u) => glow(u),
    // it glides on the tail: a soft bob instead of steps
    walk: (t, u) => ({ ...glow(u, 1, 2), body: { p: [0, 0, 0.3 * osc(u, 2)], r: [6, 0, 0] } }),
    idle_look: (t, u) => glow(u, 1.5),
    hurt: (t, u) => glow(u, 3, 2),
    celebrate: (t, u) => ({ ...glow(u, 2, 2), halo: { r: [0, 0, 360 * u] } }),
    exit: (t, u) => glow(u, 1),
  },
});

const clips = {
  ...base,

  // fidget: a full spin of the star head with happy eyes, the halo trailing
  idle_twirl: {
    seconds: 2.4,
    pose: (t, u) => {
      const spin = 360 * K(u, [[0, 0], [0.2, 0], [0.7, 1], [1, 1]]);
      const on = win(u, 0.15, 0.8, 0.08);
      return {
        body: { r: [0, 0, 6 * on] },
        head: { r: [0, spin, 0] },
        halo: { r: [0, 0, -spin * 0.5] },
        ...face.pose(on > 0.5 ? 'happy' : 'open'),
        ...both('arm', { r: [0, -20 * on, 0] }),
        ...glow(u, 1.5, 2),
      };
    },
  },

  // fidget: it reaches up and catches one of its sparkles, which hops to the hand and back
  idle_catch: {
    seconds: 2.6,
    pose: (t, u) => {
      const reach = K(u, [[0, 0], [0.2, 1], [0.7, 1], [0.9, 0]]);
      const hop = Math.sin(Math.PI * Math.min(1, Math.max(0, (u - 0.2) / 0.5)));
      return merge(glow(u, 0.6), {
        head: { r: [-8 * reach, 0, 14 * reach] },
        ...face.pose('open', blinks(u, [[0.45, 0.5]])),
        armL: { r: [-10 * reach, -40 * reach, 0] },
        handL: { r: [0, 0, 20 * reach] },
        spark2: { p: [-1.5 * hop, -2 * hop, -9 * hop], s: 1 + 0.5 * hop },
      });
    },
  },
};

export default rigDef({ joints, assign: (c) => pick(c, parts), extras: face.extras, clips });
