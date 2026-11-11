// Venobulb's rig: a hulking brute on four splayed legs (the quadruped template) with no head: its whole front is a
// gaping maw whose upper jaw (trap) and lower jaw (jaw) hinge deep in the body and slam shut on the bite. A cluster of
// small flytraps on each shoulder (sprL / sprR) sways and snaps; the thorned tail lying round the near side sweeps
// along the ground. Numbers are scad/venobulb.scad's.
import { K, TAU, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, blob, ell, inFrame, limb, pick } from './lib/biped.mjs';
import { capD, ellD, near, subFrame } from './lib/geo.mjs';
import { legs, quadrupedClips } from './lib/quadruped.mjs';

const DEGR = Math.PI / 180;
const SLIME = [0.66, 0.84, 0.28];
const TONGUE = [0.24, 0.46, 0.3];
const FANG = [0.92, 0.86, 0.67];
const SPROUT = [[0.31, 0.53, 0.17], [0.5, 0.74, 0.23], [0.32, 0.16, 0.27]];   // leaf, trap, trap inside

// the maw
const H = [0, -7, 14.8];
const UA = 58;
const LA = 40;
const YAW = 4;
const RU = [9.4, 5.8, 8.6];
const RL = [8.8, 5.6, 5.2];
const F = 0.85;
const UP = subFrame(H, [-UA, 0, YAW]);
const LO = subFrame(H, [LA, 0, YAW]);
const HF = subFrame(H, [0, 0, YAW]);
// the body
const E1 = [[11.2, 9.5, 13], [0, 2.5, 15]];
const E2 = [[10.2, 9, 9.5], [0, 10.5, 12.5]];
const E3 = [[8.5, 8, 4.5], [0, 4, 10.5]];
const SH = [[4.4, 4.6, 5], [9, -2, 11.5]];
const TH = [[4.6, 6, 5.4], [8.4, 10, 8.6]];
const SP = [9, -3.5, 23.6];
const TAIL = [[0, 17, 10], [6, 20, 7.8], [12.4, 17.4, 5], [16.6, 11, 3], [18, 3.6, 2.2], [16.6, -3.4, 1.8], [14, -8, 1.3], [11.2, -10.6, 0.8]];
const TAIL_R = [3.8, 3.3, 2.9, 2.5, 2.2, 1.8, 1.3, 0.5];
const tail = ['tail1', 'tail2', 'tail3', 'tail4'];

const joints = [
  { name: 'root', at: [0, 1, 0] },
  { name: 'legFL', parent: 'root', at: SH[1] },
  { name: 'legFR', parent: 'root', at: [-SH[1][0], SH[1][1], SH[1][2]] },
  { name: 'legBL', parent: 'root', at: TH[1] },
  { name: 'legBR', parent: 'root', at: [-TH[1][0], TH[1][1], TH[1][2]] },
  { name: 'body', parent: 'root', at: [0, 2, 9] },
  { name: 'trap', parent: 'body', at: H },
  { name: 'jaw', parent: 'body', at: H },
  { name: 'sprL', parent: 'body', at: [SP[0], SP[1], SP[2] - 1.5] },
  { name: 'sprR', parent: 'body', at: [-SP[0], SP[1], SP[2] - 1.5] },
  // the tail's links spread along it: every two scad segments one link
  ...tail.map((name, i) => ({ name, parent: i ? tail[i - 1] : 'body', at: TAIL[2 * i] })),
];

// the jaws: the bowl (an ellipsoid F * ry in front of the hinge), only on its own side of the rim (fangs hang over it)
const upperD = (c) => { const l = UP.local(c); return l[2] < -5.5 ? 9 : ellD([l[0], l[1] + F * RU[1], l[2]], RU); };
const lowerD = (c) => { const l = LO.local(c); return l[2] > 4 ? 9 : ellD([l[0], l[1] + F * RL[1], l[2]], RL); };
const tongueD = inFrame(HF, any(ell([3.2, 2.2, 2], [0, -2.4, -0.2]), ell([3.3, 2.6, 1.8], [0, -6.4, -2.4])));
const throatD = inFrame(HF, ell([7.4, 2.4, 6.6], [0, 0.6, 0.6]));

// venom strings, the scad's rimU / rimL
const rx = (a, v) => [v[0], v[1] * Math.cos(a * DEGR) - v[2] * Math.sin(a * DEGR), v[1] * Math.sin(a * DEGR) + v[2] * Math.cos(a * DEGR)];
const rz = (a, v) => [v[0] * Math.cos(a * DEGR) - v[1] * Math.sin(a * DEGR), v[0] * Math.sin(a * DEGR) + v[1] * Math.cos(a * DEGR), v[2]];
const add = (a, b) => a.map((v, i) => v + b[i]);
const rim = (r, a, t) => add(H, rz(YAW, rx(a, [0.95 * r[0] * Math.cos(t * DEGR), -F * r[1] + 0.95 * r[1] * Math.sin(t * DEGR), 0])));
const dripU = [[-150, 7], [-115, 5.5], [-80, 8], [-50, 6], [-20, 4.5]].map(([t, d]) => { const p = add(rim(RU, -UA, t), [0, 0, -1.2]); return [p, add(p, [0, -0.2, -d])]; });
const dripL = [[-140, 4], [-95, 5.5], [-55, 3.5]].map(([t, d]) => { const p = add(rim(RL, LA, t), [0, -0.4, 0.2]); return [p, add(p, [0, -0.4, -d])]; });
const dripD = (list) => (c) => Math.min(...list.map(([a, b]) => capD(c, a, b, 0.6, 0.6)));

// a foot: the pad and its four toes as one flat ellipsoid reaching forward along the toes
const foot = (p, yaw, w = 1) => ell([5 * w, 5, 1.8], add(p, rz(yaw, [0, -1.6, 0])));
const sprout = (() => {
  // the mound, the three traps (heads and stalks) and the leaf rosette, folded to the +X side
  const trap = (o, yaw, pitch, s) => {
    const f = subFrame(add(SP, o), [pitch, 0, yaw], s);
    return any(inFrame(f, ell([3, 3.4, 3], [0, -1.6, 0])), inFrame(f, limb([0, 1.8, 0], [0, 4.8, 0], 1.2, 1)));
  };
  const leaves = [0, 1, 2, 3, 4, 5, 6].map((l) => {
    const a = (l * 360) / 7 + 10;
    const base = add(SP, [1.6 * Math.cos(a * DEGR), 1.6 * Math.sin(a * DEGR), 0.4]);
    const d = [Math.sin(48 * DEGR) * Math.sin(a * DEGR), -Math.sin(48 * DEGR) * Math.cos(a * DEGR), Math.cos(48 * DEGR)];
    return limb(base, add(base, d.map((v) => v * 7.6)), 1.6, 0.6);
  });
  return any(ell([4.4, 4.4, 2.6], add(SP, [0, 0, -0.6])), trap([-0.4, -0.8, 6.2], 15, -62, 1.3), trap([4.2, 0.6, 2.6], 100, -12, 1.2),
    trap([-0.8, 4.2, 3.6], 200, -30, 1.1), limb(add(SP, [-1.2, -3.4, 0.4]), add(SP, [-1.5, -1.9, -3.7]), 1.4, 0.5), ...leaves);
})();

const legB = any(ell(TH[0], TH[1]), limb([10, 10, 6.6], [10.8, 9, 2], 3, 2.4), foot([11.2, 7.6, 1.3], -8));
const parts = [
  ['body', any(blob([E1, E2, E3]), ell([2.6, 3, 2.6], [9.2, 9.5, 17.4]), ell([2.6, 3, 2.6], [-9.2, 9.5, 17.4]),
    ell([2, 2.2, 1.9], [10, 6.6, 18.6]), ell([2, 2.2, 1.9], [-10, 6.6, 18.6]), ell([1.9, 2, 1.8], [9.8, 12.4, 16.2]),
    ell([1.9, 2, 1.8], [-9.8, 12.4, 16.2]), throatD)],
  ['trap', upperD],
  ['jaw', any(lowerD, tongueD)],
  // near (+X) front leg tucked under the maw; far (-X) one splayed forward and out
  ['legFL', any(ell(SH[0], SH[1]), limb([10, -3, 10.5], [10.2, -8, 6.2], 3.4, 2.8), limb([10.2, -8, 6.2], [8.2, -11.2, 2], 2.8, 2.3), foot([7.6, -12.6, 1.3], 20))],
  ['legFR', any(ell(SH[0], [-SH[1][0], SH[1][1], SH[1][2]]), limb([-10, -3, 12], [-15.6, -5.4, 9], 3.8, 3.1), limb([-15.6, -5.4, 9], [-16, -8.6, 2], 3.1, 2.5),
    foot([-16, -9.8, 1.3], -45, 1.15))],
  ['legB*', legB],
  ['spr*', sprout],
  ...TAIL.slice(1).map((p, i) => [tail[Math.floor(i / 2)], limb(TAIL[i], p, TAIL_R[i] * 1.5, TAIL_R[i + 1] * 1.5)]),
];

function assign(c, rgb) {
  if (near(rgb, SLIME)) return dripD(dripU)(c) < dripD(dripL)(c) ? 'trap' : 'jaw';
  if (near(rgb, TONGUE)) return 'jaw';
  const S = c[0] >= 0 ? 'L' : 'R';
  // the shoulder flytraps: their own leaf / trap colours, and the fangs up there
  if (SPROUT.some((k) => near(rgb, k)) || (near(rgb, FANG) && c[2] > 21 && Math.abs(c[0]) > 3)) return `spr${S}`;
  // the maw's fangs, gum and lining: whichever jaw is nearer
  if (near(rgb, FANG)) return upperD(c) < lowerD(c) ? 'trap' : 'jaw';
  return pick(c, parts);
}

// the maw: open wider (> 0), shut (1 brings the lips together)
const maw = (open, shut = 0) => ({ trap: { r: [-8 * open + 52 * shut, 0, 0] }, jaw: { r: [6 * open - 36 * shut, 0, 0] } });
// the shoulder traps sway, and snap with `snap`
const sprouts = (u, cycles = 1, amp = 1, snap = [0, 0]) => ({
  sprL: { r: [3 * amp * osc(u, cycles), 0, 5 * amp * osc(u, cycles, 0.25)], s: [1, 1, 1 - 0.25 * snap[0]] },
  sprR: { r: [3 * amp * osc(u, cycles, 0.5), 0, -5 * amp * osc(u, cycles, 0.75)], s: [1, 1, 1 - 0.25 * snap[1]] },
});

const base = quadrupedClips({
  tail, hipH: 10, stride: 12,
  add: {
    idle: (t, u) => ({ ...maw(0.4 + 0.4 * osc(u, 2)), ...sprouts(u, 2) }),
    walk: (t, u) => ({ ...maw(0.2 * osc(u, 2)), ...sprouts(u, 2, 1.5) }),
    idle_sniff: (t, u) => sprouts(u, 2),
    idle_shake: (t, u) => sprouts(u, 4, 2),
    idle_wag: (t, u) => sprouts(u, 2),
    windup: (t, u) => ({ ...maw(1.6 * smooth(u)), ...sprouts(u, 1, 1.5) }),
    lunge: (t, u) => ({ ...maw(K(u, [[0, 1.6], [0.25, 1.8], [0.38, 0], [1, 0]]), K(u, [[0.25, 0], [0.4, 1], [0.7, 1], [1, 0]])), ...sprouts(u, 1, 2) }),
    hurt: (t, u) => ({ ...maw(0, 0.4 * K(u, [[0, 0], [0.2, 1], [1, 0.3]])), ...sprouts(u, 2, 3) }),
    faint: (t, u) => ({ ...maw(-0.5 * smooth((u - 0.2) / 0.6)), sprL: { r: [25 * smooth(u), 0, 0] }, sprR: { r: [25 * smooth(u), 0, 0] } }),
    celebrate: (t, u) => ({ ...maw(0.8, 0.6 * Math.abs(Math.sin(TAU * 2 * u))), ...sprouts(u, 2, 3, [Math.abs(Math.sin(TAU * 2 * u)), Math.abs(Math.cos(TAU * 2 * u))]) }),
    enter: (t, u) => ({ ...maw(1.2 * win(u, 0.4, 0.9, 0.1), 1 - smooth((u - 0.2) / 0.3)), ...sprouts(u, 1, 2) }),
    exit: (t, u) => maw(0, smooth(u / 0.7)),
  },
});

const clips = {
  ...base,

  // fidget: the maw gapes in a huge yawn, the tongue lolls, then a wet gulp with a shudder through the body
  idle_gulp: {
    seconds: 2.6,
    pose: (t, u) => {
      const yawn = K(u, [[0, 0], [0.35, 1], [0.55, 1], [0.62, 0]]);
      const gulp = win(u, 0.6, 0.75, 0.03);
      const sh = Math.sin(TAU * 10 * u) * win(u, 0.62, 0.85, 0.04);
      return merge({
        body: { r: [-4 * yawn + 3 * gulp, 0, 1.2 * sh], s: [1 + 0.03 * gulp, 1, 1 - 0.02 * gulp] },
        ...maw(2 * yawn, gulp),
        tail1: { r: [6 * yawn, 0, 3 * sh] },
      }, sprouts(u, 2, 1 + yawn));
    },
  },

  // fidget: the shoulder traps snap at flies one side after the other, the maw grins along
  idle_sprouts: {
    seconds: 2,
    pose: (t, u) => {
      const sn = (u0) => win(u, u0, u0 + 0.08, 0.03);
      const l = sn(0.15) + sn(0.5);
      const r = sn(0.32) + sn(0.68);
      return merge({
        body: { r: [0, 0, 3 * (l - r)] },
        sprL: { r: [-12 * l, 0, 10 * l], s: [1, 1, 1 - 0.3 * l] },
        sprR: { r: [-12 * r, 0, -10 * r], s: [1, 1, 1 - 0.3 * r] },
        ...maw(0.6),
      }, legs({ r: [0, 0, 0] }));
    },
  },
};

export default rigDef({ joints, assign, clips });
