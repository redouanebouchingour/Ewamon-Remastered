// Glowtent's rig: a lavender jellyfish bell (the body; the floater's head is the bell too) over twelve wavy tentacles
// of two links each (ten<i>a / ten<i>b, swaying in a wave round the rim), the glowing spot as the pulsing core, lib.scad
// eyes with blinks, and the bubbles drifting on their own. Numbers are scad/glowtent.scad's.
import { K, TAU, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { floaterClips } from './lib/floater.mjs';
import { chainHit, isAny, near } from './lib/geo.mjs';

const DEG = Math.PI / 180;
const BZ = 21;
const BR = [13, 12, 11.5];
const BELL = [0.68, 0.58, 0.9];
const PINKS = [[0.98, 0.5, 0.78], [1, 0.82, 0.93]];
const TENTS = [[0.92, 0.5, 0.78], [0.66, 0.5, 0.86]];
const BUBBLE = [0.8, 0.62, 0.95];

const N = 12;
const TENT = Array.from({ length: N }, (_, i) => {
  const a = (i * 360) / N + 8;
  const r0 = 7 + (i % 2) * 1.2;
  const ph = i * 47;
  return Array.from({ length: 7 }, (_, k) => {
    const t = k / 6;
    const z = BZ - 1 - t * (BZ - 1.4 - (i % 3) * 1.6);
    const w = 1.6 * Math.sin((ph + k * 70) * DEG) * t;
    return [r0 * Math.cos(a * DEG) * (1 - 0.25 * t) - w * Math.sin(a * DEG), r0 * Math.sin(a * DEG) * (1 - 0.25 * t) + w * Math.cos(a * DEG), z];
  });
});
const TENT_R = [1.2, 1.1, 1, 0.9, 0.8, 0.7, 0.55];
const ten = (i, l) => `ten${i + 1}${l}`;

const onBell = (az, el, k = 1) => [BR[0] * k * Math.cos(el * DEG) * Math.cos(az * DEG), BR[1] * k * Math.cos(el * DEG) * Math.sin(az * DEG), BZ + BR[2] * k * Math.sin(el * DEG)];
const eyeL = { side: 'L', at: onBell(-68, 10, 0.97), size: 1.9, yaw: 22, flat: 0.5 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], parent: 'body', skin: BELL });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'body', parent: 'root', at: [0, 0, BZ] },
  { name: 'core', parent: 'body', at: onBell(-90, 62) },
  { name: 'bubbles', parent: 'root', at: [0, -2, 15] },
  ...TENT.flatMap((pts, i) => [
    { name: ten(i, 'a'), parent: 'body', at: pts[0] },
    { name: ten(i, 'b'), parent: ten(i, 'a'), at: pts[3] },
  ]),
  ...face.joints,
];

function assign(c, rgb) {
  if (near(rgb, BUBBLE, 0.03) && Math.abs(c[0]) > 10) return 'bubbles';
  if (isAny(rgb, [...TENTS, ...PINKS], 0.05) && c[2] < 19.5) {
    let best = { d: Infinity };
    TENT.forEach((pts, i) => { const h = chainHit(c, pts, TENT_R); if (h.d < best.d) best = { ...h, n: i }; });
    return ten(best.n, best.i < 3 ? 'a' : 'b');
  }
  if (isAny(rgb, PINKS, 0.05) && c[2] > 26) return 'core';
  return 'body';
}

// the tentacles: a wave running round the rim (each one a step behind its neighbour) and down each strand; `back`
// streams them all backwards (rx > 0 swings a hanging strand's tip back)
const tentacles = (u, amp = 5, cycles = 1, back = 0, curl = 0) => Object.fromEntries(TENT.flatMap((pts, i) => {
  const a = ((i * 360) / N + 8) * DEG;
  const s = osc(u, cycles, i / N);
  const s2 = osc(u, cycles, i / N - 0.15);
  // swing outwards/inwards (a radial tilt) and round (a tangential sway), in the rim's frame
  const out = (v) => [-Math.sin(a) * v, Math.cos(a) * v, 0];
  const r1 = out(amp * s).map((v, k) => v + (k === 0 ? back : 0) + (k === 0 ? 0 : 0));
  const r2 = out(amp * 1.4 * s2).map((v, k) => v + (k === 0 ? back * 0.6 : 0));
  // curl lifts the strands outwards (a jellyfish flare): rotate about the rim tangent
  const flare = [Math.sin(a) * curl, -Math.cos(a) * curl, 0];
  return [[ten(i, 'a'), { r: r1.map((v, k) => v - flare[k]) }], [ten(i, 'b'), { r: r2.map((v, k) => v - flare[k] * 0.8) }]];
}));
const bubbles = (u, amp = 0.8) => ({ bubbles: { p: [0, 0, amp * osc(u, 1)], r: [0, 0, 6 * osc(u, 1, 0.25)] } });

const add = {
  idle: (t, u) => merge(tentacles(u, 5, 1), bubbles(u)),
  walk: (t, u) => merge(tentacles(u, 6, 2, 14), bubbles(u, 0.4)),
  windup: (t, u) => merge(tentacles(u, 2, 1, 0, 14 * smooth(u / 0.8)), bubbles(u, 0.2)),
  lunge: (t, u) => { const hit = K(u, [[0.12, 0], [0.4, 1], [0.62, 1], [1, 0]]); return merge(tentacles(u, 4, 1, -20 * hit, 14 * (1 - hit))); },
  hurt: (t, u) => { const k = K(u, [[0, 0], [0.18, 1], [0.6, 0.75], [1, 0.45]]); return merge(tentacles(u, 10, 3, 0, 10 * k)); },
  recoil: (t, u) => merge(tentacles(u, 4, 1, 0, -8 * K(u, [[0, 0], [0.4, 1], [1, 0]]))),
  faint: (t, u) => { const d = smooth((u - 0.15) / 0.6); return merge(tentacles(u, 3 * (1 - d), 1, 0, -14 * d)); },
  celebrate: (t, u) => merge(tentacles(u, 8, 2, 0, 12 * win(u, 0, 1, 0.15))),
  enter: (t, u) => merge(tentacles(u, 6, 1, 0, 16 * win(u, 0.4, 0.95, 0.12))),
  exit: (t, u) => merge(tentacles(u, 6, 2)),
};

const clips = floaterClips({ face, bob: 1.2, add });
delete clips.idle_cackle;
delete clips.idle_spin;

// fidget: a jet pulse: the bell squeezes, the tentacles flare and snap shut, it bounces up and drifts down
clips.idle_pulse = {
  seconds: 2,
  pose: (t, u) => {
    const sq = K(u, [[0, 0], [0.15, 1], [0.3, -0.4], [0.45, 0]]);
    const up = K(u, [[0.15, 0], [0.4, 1], [1, 0]]);
    return merge({
      body: { p: [0, 0, 0.6 + 2 * up], s: [1 - 0.08 * sq, 1 - 0.08 * sq, 1 + 0.1 * sq] },
      core: { s: 1 + 0.15 * Math.max(0, sq) },
      ...face.pose(sq > 0.5 ? 'squeeze' : 'open'),
    }, tentacles(u, 3, 1, 0, 22 * sq), bubbles(u, 1.2));
  },
};

// fidget: the glow spot brightens and swells in slow heartbeats, the eyes closing contentedly
clips.idle_glow = {
  seconds: 2.4,
  pose: (t, u) => {
    const beat = Math.max(0, Math.sin(TAU * 3 * u)) ** 2 * win(u, 0.05, 0.9, 0.1);
    return merge({
      body: { p: [0, 0, 0.6 + 0.6 * osc(u, 1)] },
      core: { s: 1 + 0.18 * beat },
      ...face.pose(win(u, 0.2, 0.8, 0.08) > 0.5 ? 'happy' : 'open'),
    }, tentacles(u, 4, 1, 0, 4 * beat), bubbles(u));
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
