// Lumyth's rig: a galaxy spirit hovering on a wavy tail that ends in a spiral galaxy orb on the ground. The robe,
// cape and torso are the body, the face, hair and star halo the head (its hair curl a wisp chain), the raised arms
// arm + hand (forearm and palm), the wavy tail and its orb a hanging chain. The fairy wings are wingL / wingR: the
// floater template has none, so they flap through `add` (a butterfly beat, rz). Numbers are scad/lumyth.scad's.
import { K, TAU, both, merge, osc, rigDef } from './lib/anim.mjs';
import { floaterClips } from './lib/floater.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { blobD, capD, chainHit, closest, ellD, isAny, near } from './lib/geo.mjs';

const SKIN = [[0.72, 0.64, 0.95], [0.82, 0.76, 1]];
const HAIR = [[0.4, 0.25, 0.7], [0.26, 0.16, 0.5]];
const STREAK = [[0.85, 0.6, 0.95], [0.6, 0.75, 1]];
const CAPE = [[0.32, 0.2, 0.6], [0.5, 0.3, 0.75]];
const WING = [[0.84, 0.78, 1], [0.95, 0.8, 1]];
const MOON = [0.98, 0.92, 1];
const GOLD = [[1, 0.8, 0.25], [0.85, 0.6, 0.15]];
const STAR = [1, 1, 0.92];

// the tail hangs from the robe down to the orb (base first, as the floater template wants)
const TAIL = [[1, 0, 17], [2, 0.5, 14], [-1, 0.5, 12], [-2.5, 0, 9], [1, 0, 6.5], [1, 0, 3.6]];
const TAIL_R = [3.4, 2.8, 2.4, 2.4, 2.6, 3.6];
const CURL = [[2.6, 1, 36], [5, 1.4, 38.5], [6.6, 1, 37.6], [6, 0.6, 36]];
const CURL_R = [1.6, 1.2, 0.9, 0.4];
const tail = TAIL.slice(0, -1).map((_, i) => `tail${i + 1}`);
const wisp = CURL.slice(0, -1).map((_, i) => `wisp${i + 1}`);

const eyeL = { side: 'L', at: [2, -4.4, 31.6], size: 1.35, yaw: -14 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: SKIN[0] });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'body', parent: 'root', at: [0, 0, 17] },
  { name: 'head', parent: 'body', at: [0, 0.6, 27.4] },
  { name: 'armL', parent: 'body', at: [2.6, 0, 26.5] },
  { name: 'handL', parent: 'armL', at: [4.6, -1.5, 25] },
  { name: 'armR', parent: 'body', at: [-2.6, 0, 26.5] },
  { name: 'handR', parent: 'armR', at: [-4.6, -1.5, 25] },
  { name: 'wingL', parent: 'body', at: [3, 4, 27] },
  { name: 'wingR', parent: 'body', at: [-3, 4, 27] },
  ...tail.map((name, i) => ({ name, parent: i === 0 ? 'body' : tail[i - 1], at: TAIL[i] })),
  ...wisp.map((name, i) => ({ name, parent: i === 0 ? 'head' : wisp[i - 1], at: CURL[i] })),
  ...face.joints,
];

const tailAt = (c) => tail[Math.min(tail.length - 1, c[2] < 7.5 ? tail.length - 1 : chainHit(c, TAIL, TAIL_R).i)];
const onWing = (c) => Math.abs(c[0]) > 3.2 && c[1] > 3.4 && c[2] > 18;

function assign(c, rgb) {
  const S = c[0] >= 0 ? 'L' : 'R';
  const ax = Math.abs(c[0]);
  if (isAny(rgb, WING, 0.03)) return `wing${S}`;
  if (isAny(rgb, GOLD, 0.04)) return 'head';
  if (near(rgb, STAR, 0.03)) return onWing(c) ? `wing${S}` : c[2] > 27.5 && ax < 4.5 ? 'head' : 'body';
  if (near(rgb, MOON, 0.03)) return c[2] < 8 ? tail[tail.length - 1] : onWing(c) ? `wing${S}` : 'body';
  if (isAny(rgb, CAPE, 0.03)) return 'body';
  if (c[2] < 7.5 && ax < 5.5) return tail[tail.length - 1];   // the galaxy orb and its swirls
  const head = Math.min(ellD(c, [5.4, 4.8, 5], [0, 0, 31.5]), blobD(c, [[[5.8, 4.8, 5.4], [0, 1.6, 32.4]]]), ellD(c, [5, 3.4, 2.2], [0.6, -1.4, 35.8]),
    ellD(c, [3.4, 1.8, 2], [2, -3.6, 35]), capD([ax, c[1], c[2]], [4.4, 0.6, 31], [5.4, 0.6, 27.5], 1.6, 1.4), capD([ax, c[1], c[2]], [4.6, -0.6, 30], [5.8, -0.6, 26.5], 0.6));
  const body = Math.min(blobD(c, [[[3.6, 3, 2], [0, 0, 24]], [[5, 4, 3], [0, 0.4, 19]], [[3, 2.6, 2], [0.6, 0.2, 16]]]),
    blobD(c, [[[2.8, 2.2, 2.6], [0, 0, 25.5]], [[2.2, 1.8, 1.5], [0, 0, 23]]]), ellD(c, [4.4, 4, 3.5], [0, 2.5, 27.5]) * 1.05,
    capD([ax, c[1], c[2]], [5.4, 0.6, 27.5], [5.8, 0.4, 21], 1.4, 0.5) * 1.05, c[1] < -2.8 && c[2] < 24 && c[2] > 16.5 ? 1 : Infinity);
  const arm = capD([ax, c[1], c[2]], [2.6, 0, 26.5], [4.6, -1.5, 25], 0.9, 0.8);
  const hand = Math.min(capD([ax, c[1], c[2]], [4.6, -1.5, 25], [5.6, -2.5, 27.4], 0.8, 0.7), ellD([ax, c[1], c[2]], [0.9, 0.5, 1.1], [5.8, -2.8, 28.2]));
  const t = chainHit(c, TAIL, TAIL_R);
  const w = chainHit(c, CURL, CURL_R);
  if (isAny(rgb, SKIN, 0.03) || isAny(rgb, HAIR, 0.03) || isAny(rgb, STREAK, 0.03)) {
    return closest([['head', head], ['body', body], [`arm${S}`, arm], [`hand${S}`, hand], [tailAt(c), t.d], [wisp[Math.min(wisp.length - 1, w.i)], w.d]]);
  }
  return closest([['head', head], ['body', body]]);   // eyes, the smile
}

// the wings beat like a butterfly's (rz), slow at rest, fast when it moves or cheers
const wings = (u, amp, cycles, open = 0) => both('wing', { r: [0, 0, -open - amp * osc(u, cycles)] });
const fx = { idle: [6, 2, 0], walk: [10, 4, 6], idle_spin: [12, 6, 4], idle_cackle: [8, 4, 0], windup: [4, 1, -8], lunge: [8, 2, 10], hurt: [14, 3, 10], recoil: [4, 1, -6], faint: [2, 1, -14], celebrate: [18, 6, 10], enter: [12, 2, 10], exit: [10, 4, 6] };
const add = Object.fromEntries(Object.entries(fx).map(([n, [a, c, o]]) => [n, (t, u) => wings(u, a, c, o)]));

const clips = {
  ...floaterClips({ face, tail, wisp, bob: 0.6, add }),

  // fidget: twirls a little galaxy between its raised palms, the wings fanning, eyes shut in delight
  idle_stargaze: {
    seconds: 2.6,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.18, 1], [0.75, 1], [0.92, 0]]);
      const sw = osc(u, 3) * on;
      return merge({
        body: { p: [0, 0, 0.4 + 0.4 * on], r: [-4 * on, 0, 6 * sw] },
        head: { r: [-12 * on, 0, 8 * sw] },
        ...face.pose(on > 0.5 ? 'happy' : 'open'),
        armL: { r: [0, -20 * on, 0] },
        armR: { r: [0, 20 * on, 0] },
        handL: { r: [0, -10 * on + 12 * sw, 0] },
        handR: { r: [0, 10 * on + 12 * sw, 0] },
        ...Object.fromEntries(tail.map((n, i) => [n, { r: [0, 0, 6 * Math.sin(TAU * (3 * u - 0.1 * i)) * on] }])),
      }, wings(u, 14, 6, 6 * on));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
