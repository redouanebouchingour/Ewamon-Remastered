// Ignispectre's rig: a skeletal wraith in a tattered robe. The robe, spine and ribs are the body, the skull and the
// back of the hood the head, its glowing sockets a decal, the ghost-fire crown a one-link wisp, the ember ribcage the
// pulsing core, the bony arms arm (upper) + hand (forearm and claws). The torn ends, hem flames and smoke lying on
// the ground stay on the root. Floater template. Numbers are scad/ignispectre.scad's.
import { K, merge, osc, rigDef, smooth } from './lib/anim.mjs';
import { floaterClips } from './lib/floater.mjs';
import { capD, closest, ellD, isAny, near } from './lib/geo.mjs';

const BONE = [[0.82, 0.74, 0.6], [0.6, 0.52, 0.4], [0.95, 0.9, 0.8]];
const SOCKET = [0.12, 0.1, 0.12];
const ROBE = [[0.18, 0.36, 0.6], [0.14, 0.27, 0.48], [0.3, 0.52, 0.78]];
const FIRE = [0.45, 0.78, 1];
const CYAN = [0.55, 0.88, 1];
const EMBER = [[1, 0.55, 0.12], [1, 0.85, 0.35]];
const SMOKE = [0.72, 0.7, 0.68];

const S = [0, -2.8, 34.2];
const ARM = { L: [[5.5, 0.2, 29], [11, -1, 24], [17, -3, 28]], R: [[-5.5, 0.2, 29], [-11, -1, 23], [-16.5, -3, 19.5]] };

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'body', parent: 'root', at: [0, 1, 18] },
  { name: 'core', parent: 'body', at: [0, -0.4, 24.6] },
  { name: 'head', parent: 'body', at: [0, -1, 29.5] },
  { name: 'eyes', parent: 'head', at: [0, -6.65, 34.4] },
  { name: 'wisp1', parent: 'head', at: [0, -1.6, 36] },
  { name: 'armL', parent: 'body', at: ARM.L[0] },
  { name: 'handL', parent: 'armL', at: ARM.L[1] },
  { name: 'armR', parent: 'body', at: ARM.R[0] },
  { name: 'handR', parent: 'armR', at: ARM.R[1] },
];

const armPart = (c, Sd) => {
  const [p, e, w] = ARM[Sd];
  return closest([[`arm${Sd}`, capD(c, p, e, 1, 0.85)], [`hand${Sd}`, Math.min(capD(c, e, w, 0.8, 0.7), ellD(c, [5.5, 5.5, 5.5], w) * 1.1)]]);
};

function assign(c, rgb) {
  const Sd = c[0] >= 0 ? 'L' : 'R';
  const ax = Math.abs(c[0]);
  if (near(rgb, CYAN, 0.03)) return c[2] > 36 ? 'wisp1' : 'eyes';
  if (near(rgb, FIRE, 0.03)) return c[2] < 7.5 ? 'root' : c[2] > 34.5 && ax < 6 ? 'wisp1' : 'body';
  if (isAny(rgb, EMBER, 0.03)) return ax < 5 && c[2] > 18 && c[2] < 31 ? 'core' : 'body';
  if (near(rgb, SMOKE, 0.03)) return 'root';
  if (near(rgb, SOCKET, 0.03)) return 'head';
  if (isAny(rgb, ROBE, 0.03)) {
    if (c[2] < 4 && ax > 7) return 'root';   // torn ends drifting along the ground
    // sleeve tatters hang from the upper arm
    const sleeve = Math.min(...[0, 1, 2].map((k) => { const p = [6.5 + k * 1.6, 0.2, 28.2 - k * 1.4]; return capD([ax, c[1], c[2]], p, [p[0] + 1.2, p[1] + 0.4, p[2] - 6 + k], 1.6, 0.6); }));
    if (sleeve < 1.05 && ax > 6) return `arm${Sd}`;
    return ellD(c, [4.6, 3, 4.6], [0, 2.6, 33]) < 1.1 && c[2] > 31 ? 'head' : 'body';
  }
  if (isAny(rgb, BONE, 0.03)) {
    const skull = Math.min(ellD(c, [4, 4, 3.8], S), ellD(c, [2.8, 2.4, 2], [S[0], S[1] - 1.6, S[2] - 3]), ellD(c, [2.6, 1.2, 1.4], [S[0], S[1] - 3.8, S[2] - 2.5]));
    const torso = Math.min(capD(c, [0, 1, 18], [0, 1.4, 27], 0.9, 1), ellD(c, [3.4, 2.2, 1.6], [0, 0.6, 18.4]), ellD(c, [5.2, 4, 6], [0, -0.2, 25]), capD(c, [-5, 0.2, 29], [5, 0.2, 29], 0.9));
    const arm = Math.min(capD(c, ...ARM[Sd].slice(0, 2), 1, 0.85), capD(c, ...ARM[Sd].slice(1), 0.8, 0.7), ellD(c, [5.5, 5.5, 5.5], ARM[Sd][2]));
    const best = closest([['head', skull], ['body', torso], ['arm', arm]]);
    return best === 'arm' ? armPart(c, Sd) : best;
  }
  return 'body';
}

// the claws flex: the forearms curl in a little on a beat
const flex = (k) => ({ handL: { r: [0, 0, -12 * k] }, handR: { r: [0, 0, 12 * k] } });

const clips = {
  ...floaterClips({
    wisp: ['wisp1'], bob: 1,
    add: {
      idle: (t, u) => flex(0.5 + 0.5 * osc(u, 2)),
      windup: (t, u) => flex(smooth(u / 0.8)),
      lunge: (t, u) => flex(K(u, [[0, 1], [0.35, -0.6], [0.7, 1]])),
      hurt: (t, u) => ({ wisp1: { s: [1, 1, 1 - 0.3 * Math.sin(Math.PI * u)] } }),
      faint: (t, u) => ({ wisp1: { s: Math.max(0.4, 1 - 0.6 * smooth(u / 0.8)) }, core: { s: Math.max(0.8, 1 - 0.2 * smooth(u / 0.8)) } }),
    },
  }),

  // fidget: the ghost fire flares high, the ribcage glows hot, the skull tips back and the claws spread
  idle_flare: {
    seconds: 2.2,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.25, 1], [0.6, 1], [0.85, 0]]);
      const fl = osc(u, 8) * on;
      return merge({
        body: { p: [0, 0, 0.6 + 0.5 * on] },
        head: { r: [-12 * on, 0, 4 * fl] },
        wisp1: { s: [1 + 0.15 * on, 1 + 0.15 * on, 1 + 0.5 * on + 0.08 * fl], r: [4 * fl, 0, 6 * fl] },
        core: { s: 1 + 0.12 * on },
        eyes: { s: [1 + 0.15 * on, 1, 1 + 0.25 * on] },
        armL: { r: [0, -20 * on, 10 * on] },
        armR: { r: [0, 20 * on, -10 * on] },
      }, flex(-on));
    },
  },
};

export default rigDef({ joints, assign, clips });
