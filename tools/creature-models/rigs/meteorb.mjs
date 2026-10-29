// Meteorb's rig: a floating cratered meteor ball with two glowing eyes (one decal) and a ring of pebbles orbiting it
// (`ring`, turning about the ball's vertical axis in whole turns so every loop closes). Numbers are scad/meteorb.scad's.
import { K, TAU, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { floaterClips } from './lib/floater.mjs';
import { near } from './lib/geo.mjs';

const C = [0, 0, 20];
const R = 15;
const EYE = [[0.45, 1, 0.8], [1, 1, 1]];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'body', parent: 'root', at: [0, 0, 6] },
  { name: 'eyes', parent: 'body', at: [0, -R - 0.4, 20.5] },
  { name: 'ring', parent: 'body', at: C },
];

function assign(c, rgb) {
  const d = Math.hypot(c[0] - C[0], c[1] - C[1], c[2] - C[2]);
  if (c[1] < -R + 1.5 && Math.abs(c[0]) > 1.5 && Math.abs(c[0]) < 7 && Math.abs(c[2] - 20.5) < 4.5 && EYE.some((e) => near(rgb, e, 0.05))) return 'eyes';
  if (d > R + 1.8) return 'ring';
  return 'body';
}

// the ring's orbit: `turns` whole turns over the clip, tilted a little
const orbit = (u, turns = 1, tilt = [0, 0], s = 1) => ({ ring: { r: [tilt[0], tilt[1], 360 * turns * u], s } });
const add = {
  idle: (t, u) => orbit(u, 1, [3 * osc(u, 1), 3 * osc(u, 1, 0.25)]),
  walk: (t, u) => orbit(u, 1, [-8, 0]),
  windup: (t, u) => { const w = smooth(u / 0.8); return orbit(u, 0.5, [0, 0], 1 - 0.12 * w); },
  lunge: (t, u) => { const hit = K(u, [[0.12, 0], [0.4, 1], [0.62, 1], [1, 0]]); return orbit(u, 1, [-12 * hit, 0], 0.88 + 0.3 * hit); },
  hurt: (t, u) => { const k = K(u, [[0, 0], [0.18, 1], [0.6, 0.75], [1, 0.45]]); return orbit(u, 0.25, [14 * k * Math.sin(TAU * 4 * u), 10 * k], 1 + 0.1 * k); },
  recoil: (t, u) => orbit(u, 0.25, [6 * K(u, [[0, 0], [0.4, 1], [1, 0]]), 0]),
  faint: (t, u) => { const d = smooth((u - 0.15) / 0.6); return orbit(u, 0.3 * (1 - d), [20 * d, -12 * d], 1 - 0.1 * d); },
  celebrate: (t, u) => orbit(u, 2, [0, 0], 1 + 0.15 * win(u, 0, 1, 0.2)),
  enter: (t, u) => orbit(u, 1, [0, 0], 0.4 + 0.6 * smooth(u / 0.8)),
  exit: (t, u) => orbit(u, 1, [0, 0], 1 - 0.5 * smooth((u - 0.4) / 0.6)),
};

const clips = floaterClips({ bob: 1.2, add });
delete clips.idle_spin;
delete clips.idle_cackle;

// fidget: rolls right over forwards like a tumbling rock, the eyes going round with it, and settles with a wobble
clips.idle_tumble = {
  seconds: 2.2,
  pose: (t, u) => {
    const roll = K(u, [[0.1, 0], [0.62, 360]]);
    const wob = Math.sin(TAU * 3 * u) * win(u, 0.62, 0.95, 0.04) * (1 - u);
    return merge({
      body: { p: [0, 0, 1.2 + 1.2 * Math.sin(Math.PI * Math.min(1, Math.max(0, (u - 0.1) / 0.52)))], r: [roll + 12 * wob, 0, 0] },
      eyes: { s: [1, 1, 1 - 0.2 * win(u, 0.1, 0.62, 0.1)] },
    }, orbit(u, 1, [0, 0]));
  },
};

// fidget: heats up: the pebbles speed round and swing wide, the eyes narrow and glare, a shudder
clips.idle_flare = {
  seconds: 2,
  pose: (t, u) => {
    const on = win(u, 0.1, 0.85, 0.1);
    return merge({
      body: { p: [0, 0, 1.2 + 0.4 * osc(u, 1)], r: [0, 2 * Math.sin(TAU * 12 * u) * on, 0], s: 1 + 0.03 * on },
      eyes: { s: [1 + 0.1 * on, 1, 1 - 0.25 * on] },
    }, orbit(u, 3, [6 * on * osc(u, 2), 0], 1 + 0.18 * on));
  },
};

export default rigDef({ joints, assign, clips });
