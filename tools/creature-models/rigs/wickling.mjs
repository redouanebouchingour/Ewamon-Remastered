// Wickling's rig: a candle ghost of wax (the body, its wavy hem on the ground), one big eye as a decal, stubby arms, the
// ghost flame on the wick as a two-link wisp (the lower tongues, then the tips and the sparks) and the ice shards and
// wax drops circling the hem (`orbit`, whole turns per loop). Numbers are scad/wickling.scad's.
import { K, TAU, both, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { floaterClips } from './lib/floater.mjs';
import { capD, fold, isAny, side } from './lib/geo.mjs';

const WAX = [[0.88, 0.94, 0.95], [0.72, 0.8, 0.84]];
const FLAME = [[0.45, 0.3, 0.85], [0.3, 0.55, 0.95], [0.4, 0.9, 0.95], [0.8, 1, 1]];
const ORBIT = [[0.5, 0.75, 0.95], [0.92, 0.84, 0.7]];
const EYE_C = [-5.8, -9.4, 15];
const F = [0, 0, 27.5];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'body', parent: 'root', at: [0, 0, 4] },
  { name: 'eyes', parent: 'body', at: [EYE_C[0], EYE_C[1] - 1, EYE_C[2]] },
  { name: 'armL', parent: 'body', at: [10, 0, 13] },
  { name: 'armR', parent: 'body', at: [-10, 0, 13] },
  { name: 'wisp1', parent: 'body', at: F },
  { name: 'wisp2', parent: 'wisp1', at: [F[0] + 1, F[1] + 0.5, F[2] + 8] },
  { name: 'orbit', parent: 'body', at: [0, 0, 8] },
];

function assign(c, rgb) {
  const r = Math.hypot(c[0], c[1]);
  if (isAny(rgb, ORBIT, 0.03) && r > 13) return 'orbit';
  if (isAny(rgb, FLAME, 0.04) && c[2] > 27) return c[2] > F[2] + 8.5 ? 'wisp2' : 'wisp1';
  if (Math.hypot(c[0] - EYE_C[0], c[1] - EYE_C[1], c[2] - EYE_C[2]) < 5.4 && c[1] < -7.5 && !isAny(rgb, WAX, 0.03)) return 'eyes';
  if (isAny(rgb, WAX, 0.03) && capD(fold(c), [10, 0, 13], [14, -0.5, 10.5], 2.4, 1.9) < 1.15 && Math.abs(c[0]) > 10.6) return `arm${side(c)}`;
  return 'body';
}

// the orbiting shards: `turns` whole turns over the clip
const orbit = (u, turns = 1, s = 1) => ({ orbit: { r: [0, 0, 360 * turns * u], s } });
const add = {
  idle: (t, u) => orbit(u, 1),
  walk: (t, u) => orbit(u, 1),
  windup: (t, u) => orbit(u, 0.25, 1 - 0.1 * smooth(u / 0.8)),
  lunge: (t, u) => orbit(u, 0.5, 0.9 + 0.2 * K(u, [[0.12, 0], [0.4, 1], [1, 0]])),
  hurt: (t, u) => orbit(u, 0.25, 1 + 0.1 * K(u, [[0, 0], [0.18, 1], [1, 0.4]])),
  recoil: (t, u) => orbit(u, 0.25),
  faint: (t, u) => orbit(u, 0.25 * (1 - smooth((u - 0.15) / 0.6)), 1 - 0.15 * smooth((u - 0.15) / 0.6)),
  celebrate: (t, u) => orbit(u, 2, 1 + 0.12 * win(u, 0, 1, 0.2)),
  enter: (t, u) => orbit(u, 1, 0.4 + 0.6 * smooth(u / 0.8)),
  exit: (t, u) => orbit(u, 1, 1 - 0.4 * smooth((u - 0.4) / 0.6)),
};

const clips = floaterClips({ wisp: ['wisp1', 'wisp2'], bob: 0.8, add });
delete clips.idle_cackle;
delete clips.idle_spin;

// fidget: the flame flares up tall and flickers wildly, the eye goes wide, then it gutters down and puffs back
clips.idle_flare = {
  seconds: 2,
  pose: (t, u) => {
    const up = K(u, [[0, 0], [0.2, 1], [0.55, 1], [0.7, -0.3], [0.85, 0]]);
    const fl = Math.floor(u * 20) % 20;
    const jit = Math.sin(fl * 2.3) * win(u, 0.15, 0.6, 0.05);
    return merge({
      body: { p: [0, 0, 0.4 + 0.4 * osc(u, 1)] },
      eyes: { s: [1 + 0.1 * Math.max(0, up), 1, 1 + 0.15 * Math.max(0, up)] },
      wisp1: { r: [4 * jit, 0, 6 * jit], s: [1, 1, 1 + 0.25 * up] },
      wisp2: { r: [8 * jit, 0, -10 * jit], s: 1 + 0.25 * up },
      ...both('arm', { r: [0, -20 * Math.max(0, up), 0] }),
    }, orbit(u, 1, 1 + 0.08 * Math.max(0, up)));
  },
};

// fidget: a slow melt-and-drip shiver: the wax body sags, wobbles like jelly and firms up again
clips.idle_wobble = {
  seconds: 2.2,
  pose: (t, u) => {
    const sag = K(u, [[0, 0], [0.25, 1], [0.55, 1], [0.7, 0]]);
    const wob = Math.sin(TAU * 4 * u) * win(u, 0.55, 0.98, 0.05) * (1 - u);
    return merge({
      body: { s: [1 + 0.05 * sag + 0.04 * wob, 1 + 0.05 * sag + 0.04 * wob, 1 - 0.07 * sag - 0.05 * wob] },
      eyes: { s: [1, 1, 1 - 0.25 * sag] },
      wisp1: { r: [-8 * sag, 0, 6 * wob] },
      ...both('arm', { r: [0, 18 * sag, 0] }),
    }, orbit(u, 1));
  },
};

export default rigDef({ joints, assign, clips });
