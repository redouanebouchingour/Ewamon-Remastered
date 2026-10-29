// Leafcoon's rig: a leaf cocoon hanging by a twine knot from a twig. The twig and knot are the body; the cocoon is the
// head, pivoting at the knot, so the floater's head turns swing it like a pendulum and its spin twirls it on its
// string. The two upper side leaves are the arms, the leaf tips at the bottom a tail, the glowing eyes one decal.
// Numbers are scad/leafcoon.scad's.
import { K, TAU, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { floaterClips } from './lib/floater.mjs';
import { capD, fold, near, side } from './lib/geo.mjs';

const CZ = 17;
const LEAF = [0.5, 0.72, 0.2];
const GREEN_DK = [0.32, 0.5, 0.12];
const TWINE = [0.88, 0.82, 0.55];
const BARK = [0.42, 0.24, 0.12];
const EYES = [[1, 0.85, 0.15], [1, 1, 0.75]];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'body', parent: 'root', at: [0, 0, CZ + 12] },
  { name: 'head', parent: 'body', at: [0, 0, CZ + 11.5] },
  { name: 'eyes', parent: 'head', at: [0, -8.3, CZ + 4.1] },
  { name: 'armL', parent: 'head', at: [8, -0.5, CZ + 4] },
  { name: 'armR', parent: 'head', at: [-8, -0.5, CZ + 4] },
  { name: 'tail1', parent: 'head', at: [0, -0.5, 7.5] },
];

function assign(c, rgb) {
  const S = side(c);
  if (EYES.some((e) => near(rgb, e, 0.04)) && c[1] < -7.5) return 'eyes';
  if (near(rgb, BARK, 0.04)) return 'body';
  if (near(rgb, TWINE, 0.04)) return c[2] > CZ + 10 ? 'body' : 'head';
  if (near(rgb, LEAF, 0.025) || near(rgb, GREEN_DK, 0.025)) {
    if (c[2] > CZ + 12) return 'body';                                   // the leaves on the twig
    if (c[2] < 8.2) return 'tail1';                                      // the leaf tips at the bottom
    if (near(rgb, LEAF, 0.025) && capD(fold(c), [8, -0.5, CZ + 4], [14, -1.5, CZ + 5.5], 2.2, 0.4) < 1.2) return `arm${S}`;
  }
  return 'head';
}

const clips = floaterClips({ tail: ['tail1'], bob: 0.6 });
delete clips.idle_cackle;

// fidget: squirms inside its wrappings, twisting one way and the other, the leaves flapping, the eyes squeezing
clips.idle_wriggle = {
  seconds: 2.2,
  pose: (t, u) => {
    const on = win(u, 0.1, 0.85, 0.08);
    const w = Math.sin(TAU * 5 * u) * on;
    return merge({
      body: { p: [0, 0, 0.3 * on] },
      head: { r: [3 * w, 6 * w, 14 * Math.sin(TAU * 2.5 * u) * on], s: [1 - 0.04 * on, 1 - 0.04 * on, 1 + 0.05 * Math.abs(w)] },
      eyes: { s: [1, 1, 1 - 0.4 * on] },
      ...both('arm', { r: [0, -20 * w, 0] }),
      tail1: { r: [0, 0, 18 * w] },
    });
  },
};

// fidget: peeks out: the eyes widen and the cocoon leans forward on its string, then it pulls back, shy
clips.idle_peek = {
  seconds: 2.4,
  pose: (t, u) => {
    const lean = K(u, [[0, 0], [0.25, 1], [0.6, 1], [0.7, -0.4], [0.85, 0]]);
    return {
      head: { r: [10 * lean, 0, 6 * osc(u, 1) * win(u, 0.25, 0.6, 0.08)] },
      eyes: { s: [1 + 0.12 * Math.max(0, lean), 1, 1 + 0.2 * Math.max(0, lean)] },
      ...both('arm', { r: [0, 10 * Math.min(0, lean), 0] }),
    };
  },
};

export default rigDef({ joints, assign, clips });
