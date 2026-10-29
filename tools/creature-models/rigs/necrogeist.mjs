// Necrogeist's rig: a flame-crowned wraith on a wispy tail. The torso is the body (its painted chest star the pulsing
// core), the dome with its flame horns the head (glowing eyes and grin decals), the clawed arms arm + hand (forearm
// and claws), the wispy lower body a hanging chain, the butterfly wings wingL / wingR (they beat through `add`: the
// floater template has none), the halo its own joint floating over the head, and the burst of light behind it an
// aura that slowly turns. Floater template. Numbers are scad/necrogeist.scad's; the Majin form reuses necroRig().
import { both, merge, osc, rigDef } from './lib/anim.mjs';
import { floaterClips } from './lib/floater.mjs';
import { capD, chainHit, closest, ellD, fold, isAny, near, subFrame } from './lib/geo.mjs';

/**
 * cfg: tail [pts, rs], arm (left chain pts, radius), claws (left claw tips), head / torso tests, the joints' pivots,
 * colours by role, wingFrame (subFrame of the left wing's plane) and wingD (how far a point in that frame is from the
 * wing: 1 = on it), aura (centre of the light burst or null), halo pivot, fidgets.
 */
export function necroRig(cfg) {
  const { TAIL, TAIL_R, ARM, ARM_R } = cfg;
  const tail = TAIL.slice(0, -1).map((_, i) => `tail${i + 1}`);
  const joints = [
    { name: 'root', at: [0, 0, 0] },
    { name: 'body', parent: 'root', at: TAIL[0] },
    { name: 'core', parent: 'body', at: cfg.coreAt },
    { name: 'head', parent: 'body', at: cfg.headAt },
    { name: 'eyes', parent: 'head', at: cfg.eyesAt },
    { name: 'mouth', parent: 'head', at: cfg.mouthAt },
    { name: 'halo', parent: 'head', at: cfg.haloAt },
    { name: 'armL', parent: 'body', at: ARM[0] },
    { name: 'handL', parent: 'armL', at: ARM[1] },
    { name: 'armR', parent: 'body', at: [-ARM[0][0], ARM[0][1], ARM[0][2]] },
    { name: 'handR', parent: 'armR', at: [-ARM[1][0], ARM[1][1], ARM[1][2]] },
    { name: 'wingL', parent: 'body', at: cfg.wingAt },
    { name: 'wingR', parent: 'body', at: [-cfg.wingAt[0], cfg.wingAt[1], cfg.wingAt[2]] },
    ...(cfg.aura ? [{ name: 'aura', parent: 'body', at: cfg.aura }] : []),
    ...tail.map((name, i) => ({ name, parent: i === 0 ? 'body' : tail[i - 1], at: TAIL[i] })),
  ];

  const armPart = (c, S) => {
    const f = fold(c);
    const h = chainHit(f, ARM, ARM_R);
    const claw = Math.min(...cfg.claws.map((tip) => capD(f, ARM[ARM.length - 1], tip, 1.2, 0.4)));
    return { d: Math.min(h.d, claw), joint: h.i === 0 && claw > 1.2 ? `arm${S}` : `hand${S}` };
  };

  function assign(c, rgb) {
    const S = c[0] >= 0 ? 'L' : 'R';
    const role = cfg.colour(c, rgb);
    if (role) return role === 'wing' || role === 'arm' ? `${role}${S}` : role;
    const wing = cfg.wingD(cfg.wingFrame.local(fold(c)));
    const a = armPart(c, S);
    const t = chainHit(c, TAIL, TAIL_R);
    return closest([
      ['head', cfg.headD(c)],
      ['body', cfg.torsoD(c)],
      [a.joint, a.d],
      // the belly ends at z 12.5: the chain's wide top link would otherwise take its underside
      [tail[Math.min(tail.length - 1, t.i)], c[2] > 12.5 ? Infinity : t.d],
      [`wing${S}`, wing],
    ]);
  }

  // the wings beat like a butterfly's (rz, slow), the halo floats a beat behind, the aura turns one ray-pair per loop
  const wings = (u, amp, cycles, open = 0) => both('wing', { r: [0, 0, -open - amp * osc(u, cycles)] });
  const halo = (u, amp = 0.5, cycles = 2) => ({ halo: { p: [0, 0, amp * osc(u, cycles, 0.25)], r: [2 * osc(u, cycles), 0, 0] } });
  const fx = { idle: [8, 2, 0], walk: [12, 4, 8], idle_spin: [14, 6, 6], idle_cackle: [8, 4, 0], windup: [4, 1, -10], lunge: [10, 2, 14], hurt: [16, 3, 10], recoil: [6, 1, -8], faint: [2, 1, -16], celebrate: [20, 6, 10], enter: [14, 2, 12], exit: [10, 4, 6] };
  const add = Object.fromEntries(Object.entries(fx).map(([n, [a, k, o]]) => [n, (t, u) => merge(wings(u, a, k, o), halo(u, n === 'hurt' ? 1.2 : 0.5, n === 'idle' ? 2 : 1))]));
  if (cfg.aura) {
    const idle = add.idle;
    add.idle = (t, u) => merge(idle(t, u), { aura: { r: [0, -cfg.auraStep * u, 0] } });
  }
  add.faint = (t, u) => merge(wings(u, 2, 1, -16 * Math.min(1, u / 0.7)), { halo: { p: [0, 0, -1.6 * Math.min(1, u / 0.7)], r: [14 * Math.min(1, u / 0.7), 0, 0] } });

  const clips = { ...floaterClips({ tail, bob: 1, add }), ...cfg.fidgets({ wings, halo }) };
  return rigDef({ joints, assign, clips });
}

// ---- Necrogeist ----

const BODY = [0.22, 0.13, 0.36];
const BODY_HI = [0.34, 0.2, 0.5];
const WING = [[0.18, 0.1, 0.3], [0.4, 0.2, 0.55], [0.45, 0.85, 1]];
const V_PINK = [1, 0.45, 0.85];
const GLOW = [1, 0.9, 0.45];
const STAR = [[1, 0.6, 0.95], [1, 0.92, 1]];
const AURA = [1, 0.7, 0.95];
const HALO = [1, 0.85, 0.95];

const HORNS = [[-5.5, 6, -25], [-2.5, 8.5, -8], [0, 9.5, 0], [2.5, 8.5, 8], [5.5, 6, 25]];
// a lobe of the wing, in the wing's frame (translate([5, 4, 30]) rotate([0, 0, 12])): an ellipsoid along +X tipped by ang
const lobeD = (q, len, wid, ang) => {
  const a = (ang * Math.PI) / 180;
  const x = q[0] * Math.cos(a) + q[2] * Math.sin(a);
  const z = -q[0] * Math.sin(a) + q[2] * Math.cos(a);
  return ellD([x, q[1], z], [len / 2 + 1.2, 0.9, wid + 1.2], [len / 2 + 1.5, 0, 0]);
};

const cfg = {
  TAIL: [[0, 0, 15], [0.5, 0.5, 10], [2, 1, 6], [4, 1.5, 3], [6, 1, 1.2], [7.5, 0.5, 1.4], [8, 0, 3]],
  TAIL_R: [7, 5.4, 3.6, 2.3, 1.4, 0.8, 0.5],
  ARM: [[6, -1, 26], [10, -2, 22], [12, -3.5, 17], [12.5, -4.5, 13.5]],
  ARM_R: [2.6, 2.2, 2.2, 2],
  claws: [-35, -10, 15, 40].map((a) => [12.5 + Math.sin((a * Math.PI) / 180) * 2.6, -6.6, 9.6]),
  coreAt: [0, -6.8, 22],
  headAt: [0, 0, 29],
  eyesAt: [0, -6.6, 36.4],
  mouthAt: [0, -7, 31.5],
  haloAt: [0, 1, 50],
  wingAt: [5, 4, 30],
  aura: [0, 6.5, 27],
  auraStep: 40,
  wingFrame: subFrame([5, 4, 30], [0, 0, 12]),
  wingD: (q) => Math.min(lobeD(q, 19, 5, 42), lobeD(q, 13, 3.6, -22)),
  headD: (c) => Math.min(ellD(c, [8, 7, 7.5], [0, 0, 35]), ellD(c, [4, 3, 3], [-2.5, -1, 40.5]),
    ...HORNS.map((h) => capD(c, [h[0], 0.5, 39], [h[0] + h[2] * 0.15, 0.5, 39 + h[1]], 2.2, 0.2))),
  torsoD: (c) => ellD(c, [8, 7, 9], [0, 0, 21]),
  colour: (c, rgb) => {
    if (near(rgb, GLOW, 0.03)) return c[2] > 34 ? 'eyes' : 'mouth';
    if (isAny(rgb, STAR, 0.03)) return 'core';
    if (near(rgb, AURA, 0.03)) return 'aura';
    if (near(rgb, HALO, 0.03)) return 'halo';
    if (near(rgb, BODY_HI, 0.03)) return 'head';
    if (near(rgb, V_PINK, 0.03)) return Math.abs(c[0]) < 7 && c[2] < 21 && c[1] < 0 ? 'body' : 'wing';
    if (isAny(rgb, WING, 0.03)) return 'wing';
    if (!near(rgb, BODY, 0.03)) return 'body';
    return null;
  },
  fidgets: ({ wings, halo }) => ({
    // fidget: spreads its wings wide and holds them, the chest star flaring, the halo lifting
    idle_display: {
      seconds: 2.6,
      pose: (t, u) => {
        const on = Math.sin(Math.PI * Math.min(1, Math.max(0, (u - 0.1) / 0.8)));
        return merge({
          body: { p: [0, 0, 0.6 + 0.6 * on], r: [-5 * on, 0, 0] },
          head: { r: [-8 * on, 0, 0] },
          core: { s: 1 + 0.15 * on },
          eyes: { s: [1 + 0.1 * on, 1, 1 + 0.15 * on] },
          armL: { r: [0, -25 * on, 15 * on] },
          armR: { r: [0, 25 * on, -15 * on] },
        }, wings(u, 4 * on, 3, 18 * on), halo(u, 0.5 + 1.2 * on, 1));
      },
    },
  }),
};

export default necroRig(cfg);
