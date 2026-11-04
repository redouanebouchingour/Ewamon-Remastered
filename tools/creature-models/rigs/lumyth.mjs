// Lumyth's rig: a cosmic spirit girl whose long hair falls down the front as one wavy column and coils into a galaxy
// disc on the ground. The torso, cape and the lower side locks are the body; the hair ball, face, halo and upper side
// locks the head (its top curl a wisp chain); the bent arms arm + hand (forearm and open palm); the hair column and
// its disc a hanging tail chain; the leaf wings wingL / wingR (a butterfly beat through `add`, the floater template
// has none); the back drape is the body, the long wavy locks flowing out of it veilL / veilR and the pale smoke
// strands at their ends frondL / frondR, all swaying through `add`.
// Numbers are scad/lumyth.scad's.
import { K, TAU, both, merge, osc, rigDef } from './lib/anim.mjs';
import { floaterClips } from './lib/floater.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { blobD, capD, chainHit, closest, ellD, isAny, near } from './lib/geo.mjs';

const C30 = Math.cos(Math.PI / 6);
const S = (sx, z, y = 0) => [(sx + 2 - 0.5 * y) / C30, y, z];   // scad's S(): the sheet point at depth y

const SKIN = [0.66, 0.61, 0.9];
const HAIR = [0.37, 0.27, 0.63];
const RIM = [0.74, 0.7, 0.94];
const PAINT = [[0.82, 0.6, 0.94], [0.6, 0.82, 0.97], [0.96, 0.93, 0.99], [0.2, 0.12, 0.44]];   // pink, cyan, core, dark
const CAPE = [[0.29, 0.2, 0.54], [0.14, 0.08, 0.33]];
const WING = [[0.72, 0.64, 0.95], [0.87, 0.83, 0.98], [0.97, 0.84, 0.97]];
const STAR = [1, 0.98, 0.94];
const GOLD = [[0.98, 0.82, 0.42], [0.78, 0.58, 0.28]];
const TENDRIL = [0.6, 0.56, 0.86];
const FACEC = [[0.18, 0.09, 0.4], [0.64, 0.38, 0.9], [0.99, 0.84, 1], [1, 1, 1]];   // ink, iris, glint, shine

const HEAD = [[5.6, 5.0, 5.9], [0, -0.4, 31.5]];
const FACE = [[4.4, 4.2, 4.3], [0, -2.2, 29.8]];
const CURL = [S(0.5, 34.8), S(3, 35), S(5, 35.6), S(5.6, 36.7), S(4.6, 37.6), S(4.8, 38.4), S(6, 38.6)];
const CURL_R = [1.6, 1.3, 1.0, 0.8, 0.6, 0.45, 0.22];
const LOCK = [[3.9, -0.6, 32.6], [5.4, -0.9, 30.6], [5.0, -1.2, 28.6], [3.6, -1.2, 26.8], [2.6, -1.0, 24.8], [2.5, -1.2, 22.4], [2.4, -1.0, 19.8]];
const LOCK_R = [1.5, 1.25, 1.05, 1.0, 1.0, 1.0, 0.85];
const TORSO = [[[1.0, 0.9, 1.2], [0, -0.6, 25.0]], [[2.2, 1.7, 1.8], [0, -0.3, 22.7]], [[1.7, 1.4, 1.4], [0, 0, 20.6]]];
const SH = [2.1, -0.4, 23.5]; const EL = [4.4, -1.1, 21.5]; const HA = [6.3, -2.2, 24.5];
const COL = [S(-2.2, 21.5, 0.6), S(-2.4, 19.5, 0.5), S(-3.0, 16.8, 0.4), S(-2.9, 13.8, 0.3), S(-1.2, 11.4, 0.2), S(2.2, 9.9, 0.1),
  S(5.6, 8.7, 0), S(7.4, 7.0, 0), S(6.6, 5.2, 0), S(4.4, 4.9, 0), S(2.4, 5.8, 0), S(1.0, 6.7, 0)];
const COL_R = [2.4, 3.0, 3.3, 3.3, 3.0, 2.5, 2.1, 1.7, 1.4, 1.2, 1.0, 0.8];
const COL_SY = 0.8;
const DISC_C = [Math.cos(Math.PI / 6) * 2, Math.sin(Math.PI / 6) * 2, 3.6];   // pp(0) of [OX, 0, 3.6]
const LOCKC = [[0.34, 0.24, 0.6], [0.42, 0.3, 0.7]];
const VEIL = [5, 3, 21];   // where the three locks leave the drape
const FR0 = [10.5, 2.6, 15];
const WY = 4.3;

// the tail joints sit on the column's points (base first); the last one carries the coil and the disc
const TAIL_AT = [0, 2, 4, 6, 8];
const tail = TAIL_AT.map((_, i) => `tail${i + 1}`);
const WISP_AT = [0, 2, 4];
const wisp = WISP_AT.map((_, i) => `wisp${i + 1}`);

const eyeL = { side: 'L', at: [2.55, -5.2, 29.6], size: 1.3, yaw: 12 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: SKIN });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'body', parent: 'root', at: [0, 0, 20.5] },
  { name: 'head', parent: 'body', at: [0, -0.6, 25.6] },
  { name: 'armL', parent: 'body', at: SH },
  { name: 'handL', parent: 'armL', at: EL },
  { name: 'armR', parent: 'body', at: [-SH[0], SH[1], SH[2]] },
  { name: 'handR', parent: 'armR', at: [-EL[0], EL[1], EL[2]] },
  { name: 'wingL', parent: 'body', at: [2.2, WY, 23.6] },
  { name: 'wingR', parent: 'body', at: [-2.2, WY, 23.6] },
  { name: 'veilL', parent: 'body', at: VEIL },
  { name: 'veilR', parent: 'body', at: [-VEIL[0], VEIL[1], VEIL[2]] },
  { name: 'frondL', parent: 'veilL', at: FR0 },
  { name: 'frondR', parent: 'veilR', at: [-FR0[0], FR0[1], FR0[2]] },
  ...tail.map((name, i) => ({ name, parent: i === 0 ? 'body' : tail[i - 1], at: COL[TAIL_AT[i]] })),
  ...wisp.map((name, i) => ({ name, parent: i === 0 ? 'head' : wisp[i - 1], at: CURL[WISP_AT[i]] })),
  ...face.joints,
];

const linkTo = (names, at, i) => { let k = 0; for (let j = 0; j < at.length; j++) if (i >= at[j]) k = j; return names[k]; };
const onWing = (c) => Math.abs(c[1] - WY) < 1.2 && Math.abs(c[0]) > 2.4 && c[2] > 21.5;

function assign(c, rgb) {
  const L = c[0] >= 0 ? 'L' : 'R';
  const ax = Math.abs(c[0]);
  const f = [ax, c[1], c[2]];
  if (isAny(rgb, GOLD, 0.03)) return 'head';
  if (isAny(rgb, FACEC, 0.03)) return 'head';                       // eyes, lash, smile
  if (isAny(rgb, WING, 0.03) || (near(rgb, STAR, 0.03) && onWing(c))) return `wing${L}`;
  if (onWing(c) && isAny(rgb, PAINT, 0.03)) return `wing${L}`;      // the root's cyan / pink bands
  if (near(rgb, TENDRIL, 0.03)) return `frond${L}`;
  if (isAny(rgb, LOCKC, 0.03)) return `veil${L}`;
  if (near(rgb, RIM, 0.03) || near(rgb, SKIN, 0.03) && c[2] > 26.5 && ellD(c, FACE[0], FACE[1]) < 1.15) return 'head';
  if (isAny(rgb, CAPE, 0.03)) return 'body';
  if (near(rgb, STAR, 0.03)) { if (c[2] > 26) return 'head'; if (ax > 4 || c[1] > 3) return 'body'; }

  const head = Math.min(ellD(c, HEAD[0], HEAD[1]), ellD(c, FACE[0], FACE[1]));
  const lock = chainHit(f, LOCK, LOCK_R);
  const lockJ = lock.i <= 2 ? 'head' : 'body';
  const body = blobD(c, TORSO);
  const arm = capD(f, SH, EL, 0.8, 0.65);
  const hand = Math.min(capD(f, EL, HA, 0.65, 0.55), ellD(f, [1.2, 1.0, 1.0], [HA[0] + 0.1, HA[1], HA[2] + 0.5]));
  const col = chainHit([c[0], c[1] / COL_SY, c[2]], COL, COL_R);
  const colJ = linkTo(tail, TAIL_AT, col.i);
  const disc = ellD(c, [3.6, 3.6, 3.6], DISC_C) * 1.2;
  const cw = chainHit(c, CURL, CURL_R);
  const curlJ = linkTo(wisp, WISP_AT, cw.i);
  // the cape's painted swirl sits on the cape's back, behind the hair column
  const capeD = c[2] < 25.5 && c[2] > 13.5 && c[1] > 3 ? 1.3 : Infinity;
  return closest([
    ['head', head], [lockJ, lock.d], ['body', body], ['body', capeD], [`arm${L}`, arm], [`hand${L}`, hand],
    [colJ, col.d], [tail[tail.length - 1], disc], [curlJ, cw.d],
  ]);
}

// the wings beat like a butterfly's (rz), slow at rest, fast when it moves or cheers; the tendrils sway
const wings = (u, amp, cycles, open = 0) => both('wing', { r: [0, 0, -open - amp * osc(u, cycles)] });
const fronds = (u, amp, cycles) => ({
  veilL: { r: [amp * 0.4 * osc(u, cycles, 0.0), -amp * 0.5 * osc(u, cycles, 0.2), 0] },
  veilR: { r: [amp * 0.4 * osc(u, cycles, 0.3), amp * 0.5 * osc(u, cycles, 0.5), 0] },
  frondL: { r: [amp * osc(u, cycles, 0.25), -amp * 0.6 * osc(u, cycles, 0.45), 0] },
  frondR: { r: [amp * osc(u, cycles, 0.55), amp * 0.6 * osc(u, cycles, 0.75), 0] },
});
const fx = { idle: [6, 2, 0], walk: [10, 4, 6], idle_spin: [12, 6, 4], idle_cackle: [8, 4, 0], windup: [4, 1, -8], lunge: [8, 2, 10], hurt: [14, 3, 10], recoil: [4, 1, -6], faint: [2, 1, -14], celebrate: [18, 6, 10], enter: [12, 2, 10], exit: [10, 4, 6] };
const add = Object.fromEntries(Object.entries(fx).map(([n, [a, c, o]]) => [n, (t, u) => merge(wings(u, a, c, o), fronds(u, 6 + a * 0.3, Math.max(1, c / 2)))]));

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
      }, wings(u, 14, 6, 6 * on), fronds(u, 10 * on, 3));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
