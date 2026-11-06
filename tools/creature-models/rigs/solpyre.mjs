// Solpyre's rig: a phoenix standing on its talons, wings raised in a V (one joint each at the shoulder; the flame
// wisps floating under each wing ride on it), a crown of fire (crest1), crimson tail feathers (tail1) and the flame
// plume curling out from them (tail2). The rig is built by `solpyreRig(colours)` so Solpyre Tenjin (the same body in
// its ascended colours, with a halo) reuses it. Numbers are scad/solpyre.scad's.
import { K, TAU, hash, merge, osc, rigDef, win } from './lib/anim.mjs';
import { birdClips } from './lib/bird.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { blobD, ellD, fold, isAny, side, subFrame } from './lib/geo.mjs';

export const SOLPYRE = {
  head: [0.86, 0.36, 0.12],
  bodyRed: [0.75, 0.26, 0.15],
  orange: [0.9, 0.44, 0.13],
  tan: [0.8, 0.51, 0.3],
  claw: [0.53, 0.3, 0.18],
  // crown, wing / tail / wisp flames: orange (lit), orange (unlit), yellow, red tips
  flames: [[0.98, 0.48, 0.03], [0.97, 0.47, 0.04], [0.99, 0.79, 0.07], [0.79, 0.23, 0.02]],
  scales: [[0.82, 0.32, 0.15], [0.6, 0.13, 0.2], [0.93, 0.5, 0.16]],   // the breast feather lobes
};

const H = [0, -0.8, 22];                       // the head block: translate(H) rotate([0, 0, -15])
const HEAD = subFrame(H, [0, 0, -15]);
const torso = [[[4.5, 4.1, 5.0], [0, 0.4, 9.8]], [[4.3, 3.9, 4.0], [0, 0.0, 14.6]]];
const THIGH = [[2.3, 2.2, 2.6], [2.7, -0.3, 7.0]];

export function solpyreRig(C, { extra = null } = {}) {
  const eyeL = { side: 'L', at: [1.1, -1.95, 0.4], size: 0.72, yaw: 28, flat: 0.5, frame: HEAD };
  const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: C.head });

  const joints = [
    { name: 'root', at: [0, 0, 0] },
    { name: 'legL', parent: 'root', at: [2.7, -0.3, 7.2] },
    { name: 'legR', parent: 'root', at: [-2.7, -0.3, 7.2] },
    { name: 'body', parent: 'root', at: [0, 0.3, 6] },
    { name: 'head', parent: 'body', at: [0, -0.5, 19.4] },
    { name: 'crest1', parent: 'head', at: [0.2, 0.8, 25.2] },
    { name: 'wingL', parent: 'body', at: [2.4, 0.4, 16.8] },
    { name: 'wingR', parent: 'body', at: [-2.4, 0.4, 16.8] },
    { name: 'tail1', parent: 'body', at: [1.2, 2.2, 8] },
    { name: 'tail2', parent: 'tail1', at: [8.6, 3.8, 7.0] },
    ...face.joints,
  ];

  function assign(c, rgb) {
    const f = fold(c);
    const S = side(c);
    const hit = extra?.(c, rgb);
    if (hit) return hit;
    const flame = isAny(rgb, C.flames, 0.025);
    // the breast feather lobes are body
    if (isAny(rgb, C.scales, 0.015)) return 'body';
    // the crown of fire on the head top
    if (flame && c[2] > 23.6 && f[0] < 11) return 'crest1';
    // tail: crimson feathers off the rump and the flame plume behind (the plume's outer curl is tail2)
    if (c[1] > 2.0 && c[2] < 9 && blobD(c, torso) > 1.04 && (flame ? c[1] > 2.5 : true)) return c[0] > 8.3 ? 'tail2' : 'tail1';
    // flame wisps floating under the wings
    if (flame && f[0] > 6) return `wing${S}`;
    // wings: feathers out at the side, the arm band and coverts over the shoulder
    if (c[2] > 9.5 && f[0] > 4.3) return `wing${S}`;
    if (c[2] > 15 && f[0] > 2.3 && !isAny(rgb, [C.bodyRed, C.head], 0.02) && ellD(HEAD.local(c), [3, 3.2, 3.2]) > 1) return `wing${S}`;
    // legs: the tan shanks and toes, and the feathered thighs where they stand out of the torso
    if (c[2] < 9 && isAny(rgb, [C.tan, C.claw], 0.02)) return `leg${S}`;
    if (c[2] < 9.8 && f[0] > 0.8 && ellD(f, ...THIGH) < blobD(c, torso)) return `leg${S}`;
    // head: everything round the head block (beak, eyes, brows, throat) above the neck
    const l = HEAD.local(c);
    if (c[2] > 19.6 && l[2] > -2.6 && ellD(l, [3.0, 4.8, 3.1], [0, -1.3, 0]) < 1) return 'head';
    return 'body';
  }

  // the crest flickers on a wrapped beat so loops close
  const flick = (u, steps, amp = 0.08) => {
    const n = Math.floor(u * steps) % steps;
    return { crest1: { s: [1 + amp * (hash(n) - 0.5), 1, 1 + 2 * amp * (hash(n + 5) - 0.3)], r: [0, 5 * (hash(n + 2) - 0.5), 0] } };
  };
  const streamers = (u, amp, cycles) => ({ tail1: { r: [0, 0, amp * osc(u, cycles)] }, tail2: { r: [0, 0, 1.5 * amp * osc(u, cycles, 0.2)] } });

  const base = birdClips({
    face, tail: ['tail1', 'tail2'], flapUp: 26,
    add: {
      idle: (t, u) => merge(flick(u, 24), streamers(u, 5, 2)),
      walk: (t, u) => merge(flick(u, 6), streamers(u, 8, 1)),
      celebrate: (t, u) => merge(flick(u, 6, 0.2), streamers(u, 10, 2)),
      hurt: (t, u) => ({ crest1: { s: [1, 1, 1 - 0.3 * K(u, [[0, 0], [0.2, 1], [1, 0.5]])] } }),
      faint: (t, u) => ({ crest1: { s: [1, 1, 1 - 0.55 * Math.min(1, u / 0.7)] } }),
    },
  });

  // the wings already stand in a high V at rest: the template's big upward swings (hurt 70°, celebrate, enter) would
  // fold the two fans together over the crown, so every upward swing past 20° is softened to 40 % beyond that
  const soft = (r) => Math.sign(r) * (Math.min(Math.abs(r), 20) + 0.4 * Math.max(0, Math.abs(r) - 20));
  const tame = (clip) => ({
    ...clip,
    pose: (t, u) => {
      const p = clip.pose(t, u);
      for (const [n, up] of [['wingL', -1], ['wingR', 1]]) {
        const r = p[n]?.r;
        if (r && Math.sign(r[1]) === up) p[n] = { ...p[n], r: [r[0], soft(r[1]), r[2]] };
      }
      return p;
    },
  });

  const clips = {
    ...Object.fromEntries(Object.entries(base).map(([k, c]) => [k, tame(c)])),

    // fidget: spreads its wings to the sun, the crest blazing up tall, then folds them back with a shake
    idle_blaze: {
      seconds: 2.6,
      pose: (t, u) => {
        const on = K(u, [[0, 0], [0.2, 1], [0.66, 1], [0.82, 0]]);
        const sh = Math.sin(TAU * 8 * u) * win(u, 0.82, 0.98, 0.03);
        return merge({
          body: { r: [-6 * on, 0, 0] },
          head: { r: [-14 * on, 0, 0] },
          ...face.pose(on > 0.5 ? 'happy' : 'open'),
          wingL: { r: [0, 18 * on + 6 * sh, 0] },
          wingR: { r: [0, -18 * on - 6 * sh, 0] },
          crest1: { s: [1 + 0.1 * on, 1, 1 + 0.5 * on] },
          tail1: { r: [-10 * on, 0, 6 * sh] },
        }, flick(u, 26, 0.12));
      },
    },
  };
  return rigDef({ joints, assign, extras: face.extras, clips });
}

export default solpyreRig(SOLPYRE);
