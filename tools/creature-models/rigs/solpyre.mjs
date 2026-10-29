// Solpyre's rig: a phoenix standing on its talons, wings raised in a V (one joint each, at the shoulder roots of the
// scad's wing() blocks), a crest of three flames, and crimson tail feathers with flame streamers (tail1). The rig is
// built by `solpyreRig(colours)` so Solpyre Tenjin (the same body in amber, with a halo) reuses it.
// Numbers are scad/solpyre.scad's.
import { K, TAU, hash, merge, osc, rigDef, win } from './lib/anim.mjs';
import { birdClips } from './lib/bird.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { blobD, fold, isAny, side } from './lib/geo.mjs';

export const SOLPYRE = {
  body: [0.72, 0.2, 0.1],
  talon: [0.42, 0.28, 0.18],
  flames: [[0.93, 0.25, 0.05], [1, 0.58, 0.1], [1, 0.9, 0.45]],
};

const ROOT = [3.4, 1.5, 22];
const torso = [[[5.2, 4.6, 7], [0, 0.5, 17]], [[3.4, 3.4, 4], [0, -0.5, 24]]];

export function solpyreRig(C, { extra = null } = {}) {
  const eyeL = { side: 'L', at: [1.6, -3.7, 28.6], size: 1.25, yaw: 24, flat: 0.5 };
  const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: C.body });

  const joints = [
    { name: 'root', at: [0, 0, 0] },
    { name: 'legL', parent: 'root', at: [2.6, 0, 12] },
    { name: 'legR', parent: 'root', at: [-2.6, 0, 12] },
    { name: 'body', parent: 'root', at: [0, 0.5, 11] },
    { name: 'head', parent: 'body', at: [0, -0.8, 25.4] },
    { name: 'crest1', parent: 'head', at: [0, -0.2, 29.4] },
    { name: 'wingL', parent: 'body', at: ROOT },
    { name: 'wingR', parent: 'body', at: [-ROOT[0], ROOT[1], ROOT[2]] },
    { name: 'tail1', parent: 'body', at: [0, 3.5, 12] },
    ...face.joints,
  ];

  function assign(c, rgb) {
    const f = fold(c);
    const S = side(c);
    const hit = extra?.(c, rgb);
    if (hit) return hit;
    const flame = isAny(rgb, C.flames, 0.03);
    if (flame && c[2] > 29 && f[0] < 6) return 'crest1';
    if ((f[0] > 3.6 && c[2] > 21.5) || (f[0] > 5.4 && c[2] > 16)) return `wing${S}`;
    if (c[1] > 2.4 && c[2] < 13 && blobD(c, torso) > 1.04) return 'tail1';
    if (flame && c[1] > 2) return 'tail1';
    if (c[2] < 11.8 && f[0] > 1.6) return `leg${S}`;
    if (c[2] > 25.4 && f[0] < 4) return 'head';
    return 'body';
  }

  // the crest flickers on a wrapped beat so loops close
  const flick = (u, steps, amp = 0.08) => {
    const n = Math.floor(u * steps) % steps;
    return { crest1: { s: [1 + amp * (hash(n) - 0.5), 1, 1 + 2 * amp * (hash(n + 5) - 0.3)], r: [0, 5 * (hash(n + 2) - 0.5), 0] } };
  };
  const streamers = (u, amp, cycles) => ({ tail1: { r: [0, 0, amp * osc(u, cycles)] } });

  const base = birdClips({
    face, tail: ['tail1'], flapUp: 26,
    add: {
      idle: (t, u) => merge(flick(u, 24), streamers(u, 5, 2)),
      walk: (t, u) => merge(flick(u, 6), streamers(u, 8, 1)),
      celebrate: (t, u) => merge(flick(u, 6, 0.2), streamers(u, 10, 2)),
      hurt: (t, u) => ({ crest1: { s: [1, 1, 1 - 0.3 * K(u, [[0, 0], [0.2, 1], [1, 0.5]])] } }),
      faint: (t, u) => ({ crest1: { s: [1, 1, 1 - 0.55 * Math.min(1, u / 0.7)] } }),
    },
  });

  const clips = {
    ...base,

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
