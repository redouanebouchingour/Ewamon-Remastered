// Toxshade Majin's rig: Toxshade's body and clips (the scad keeps its numbers) with the corruption on top. The
// crimson crystals and the burning core ride the body (the barbs the tail tip), the red cracks follow the hide they
// lie on, the rune ring the head, and the core flares on its own fidget.
import { K, TAU, both, merge, rigDef } from './lib/anim.mjs';
import { pick } from './lib/biped.mjs';
import { isAny, near } from './lib/geo.mjs';
import { HF, clipsFor, face, joints, jawK, makeAssign, parts } from './toxshade.mjs';

const BLOOD = [0.7, 0.03, 0.08];
const SHARDS = [[0.3, 0.14, 0.41], [0.48, 0.29, 0.6]];
const CRYSTALS = [[0.63, 0.09, 0.28], [0.42, 0.04, 0.35]];
const CLAW = [0.47, 0.13, 0.17];
const RED = [0.78, 0.04, 0.08];
const CORE = [[0.95, 0.16, 0.08], [1, 0.5, 0.3]];

const rules = (c, rgb) => {
  if (isAny(rgb, CRYSTALS)) return Math.hypot(c[0] - 5.8, c[1] - 25.4, c[2] - 17.4) < 3.5 ? 'tail4' : 'body';   // the tail barbs, the back spikes
  if (isAny(rgb, CORE)) return 'body';
  if (near(rgb, RED)) {
    const l = HF.local(c);
    if (Math.hypot(l[0], l[1], l[2]) < 6.5) return 'head';                       // the rune ring round the far eye
    return pick(c, parts);                                                       // cracks
  }
  if (isAny(rgb, [...SHARDS, CLAW])) return pick(c, parts);
  return null;
};

const clips = {
  ...clipsFor(),

  // fidget: the core in its chest burns up, it hunches over it shuddering, then throws its head back in a silent howl
  idle_burn: {
    seconds: 2.6,
    pose: (t, u) => {
      const hunch = K(u, [[0, 0], [0.15, 1], [0.5, 1], [0.6, 0]]);
      const howl = K(u, [[0.5, 0], [0.62, 1], [0.85, 1], [0.97, 0]]);
      const tr = Math.sin(TAU * 14 * u) * hunch;
      return merge({
        root: { r: [2 * hunch, 0, 0] },
        body: { r: [8 * hunch - 6 * howl, 0, 0.8 * tr] },
        head: { r: [12 * hunch - 26 * howl, 0, 0] },
        ...jawK(22 * howl),
        ...face.pose(hunch > 0.5 ? 'squeeze' : 'open', 0),
        ...both('arm', { r: [-12 * hunch, 14 * hunch + 1.5 * tr, 0] }),
        ...both('fore', { r: [-20 * hunch, 0, 0] }),
      });
    },
  },
};

export default rigDef({ joints, assign: makeAssign([BLOOD], rules), extras: face.extras, clips });
