// Toxshade Majin's rig: Toxshade's body and clips (the scad keeps its numbers) with the corruption on top. The
// magenta crystals ride the back (the tail hook its tip), the burning core and red cracks follow the hide they lie on,
// and the core flares on its own fidget.
import { K, TAU, both, merge, rigDef, win } from './lib/anim.mjs';
import { pick } from './lib/biped.mjs';
import { isAny, near } from './lib/geo.mjs';
import { clipsFor, face, joints, jawK, makeAssign, parts } from './toxshade.mjs';

const TOX = [[0.48, 0.26, 0.72], [0.64, 0.42, 0.88]];
const CRYSTALS = [[0.72, 0.12, 0.42], [0.95, 0.3, 0.6]];
const RED = [1, 0.12, 0.08];
const RED_HI = [1, 0.6, 0.35];

const rules = (c, rgb) => {
  if (isAny(rgb, CRYSTALS)) return c[0] > 9 && c[1] > 8 && c[2] > 16 ? 'tail4' : 'body';
  if (near(rgb, RED)) {
    if (c[2] > 21 && c[1] < -12) return 'head';                                 // the rune ring round the eye
    if (c[1] < -16 && c[2] > 12) return 'jaw';                                  // drool
    if (c[2] < 5) return pick(c, parts.filter(([n]) => n === 'hand*'));         // claw drips
    return 'body';                                                               // core and cracks
  }
  if (near(rgb, RED_HI)) return 'body';
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
      }, both('ear', { r: [-10 * win(u, 0.5, 0.95, 0.05), 0, 0] }));
    },
  },
};

export default rigDef({ joints, assign: makeAssign(TOX, rules), extras: face.extras, clips });
