// Necrogeist's rig: a Gengar-like wraith on a ghost tail. The chest is the body (its painted star the pulsing core;
// the star on the back stays with the body), the dome with its flame horns the head (glowing eye and grin decals),
// the clawed arms arm + hand (forearm, hand and claws), the waist, bulb and curling tail a hanging chain (the hip
// hindwings ride its first link), the three-bladed wings wingL / wingR (they beat through `add`: the floater template
// has none) and the halo its own joint floating over the head. The art's aura burst is not modelled, so no aura joint.
// Floater template. Numbers are scad/necrogeist.scad's; the Majin form reuses necroRig().
import { both, merge, osc, rigDef } from './lib/anim.mjs';
import { floaterClips } from './lib/floater.mjs';
import { capD, chainHit, closest, ellD, fold, isAny, near, subFrame } from './lib/geo.mjs';

/**
 * cfg: tail [pts, rs], arm (left chain pts, radius), claws (left claw tips), head / torso tests, the joints' pivots,
 * colours by role, wingFrame (subFrame of the left wing's plane) and wingD (how far a point in that frame is from the
 * wing: 1 = on it), aura (centre of the light burst or null), halo pivot, tailTop (the belly above it is the body's,
 * default 12.5), fidgets.
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
      // the belly ends at tailTop: the chain's wide top link would otherwise take its underside
      [tail[Math.min(tail.length - 1, t.i)], c[2] > (cfg.tailTop ?? 12.5) ? Infinity : t.d],
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

const BODY_HI = [0.34, 0.17, 0.49];
const WING = [[0.17, 0.09, 0.28], [0.38, 0.2, 0.54], [0.88, 0.33, 0.76], [0.68, 0.9, 1]];
const EYE = [1, 0.88, 0.35];
const GRIN = [0.98, 0.84, 0.42];
const STAR = [[0.95, 0.42, 0.85], [0.85, 0.25, 0.7], [1, 0.93, 1]];
const BACK_STAR = [0.96, 0.5, 0.88];
const HALO = [1, 0.94, 0.76];

const HEAD = [[5.2, 4, 4.1], [0, -0.5, 24.6]];
const HORN = [[2.4, -0.3, 27.4], [3.9, -0.1, 30.2], [5.3, 0.1, 32.5]];
const ARM = [[5.5, 0.5, 20], [9.3, 1, 18], [11.2, 0.8, 14.6], [11.5, 0.3, 13.2]];

const cfg = {
  TAIL: [[0, 1.2, 14.5], [0.4, 2.5, 9.6], [2.8, 3.2, 6.9], [5, 3.7, 5.9], [7.6, 4.5, 5.6], [10, 5.4, 6.1], [11.6, 6, 7.3], [12.8, 6.4, 8.9]],
  TAIL_R: [2.8, 3.6, 2.4, 1.6, 1.25, 0.95, 0.6, 0.15],
  tailTop: 13.5,
  ARM,
  ARM_R: [2, 1.6, 1.25, 1.55],
  claws: [-1.2, -0.4, 0.4, 1.2].map((dx) => [11.1 + dx * 1.3, -1.2, 9.7]),
  coreAt: [0, -3.1, 17.3],
  headAt: [0, 0, 21],
  eyesAt: [0, -4.2, 24.8],
  mouthAt: [0, -4.3, 22.2],
  haloAt: [0, 0, 33.6],
  wingAt: [2.5, 3, 22],
  aura: null,
  // the wings are all wing colours (caught by colour()): the shape test never needs them
  wingFrame: subFrame([2, 3, 21], [0, 0, -4], 0.94),
  wingD: () => Infinity,
  headD: (c) => {
    const f = fold(c);
    return Math.min(ellD(c, ...HEAD), chainHit(f, HORN, [1.9, 0.9, 0.1]).d,
      capD(f, [4.6, -0.5, 26.3], [6.1, -0.3, 26.8], 0.6, 0.06), capD(c, [0, -1.2, 27.6], [0, -1.5, 30], 1.3, 0.1));
  },
  torsoD: (c) => Math.min(ellD(c, [4.3, 3.8, 4.1], [0, 0.8, 18]), capD(fold(c), [4.6, 1.5, 21.2], [5.8, 2, 26.2], 0.9, 0.08)),
  colour: (c, rgb) => {
    if (near(rgb, EYE, 0.02)) return 'eyes';
    if (near(rgb, GRIN, 0.02)) return 'mouth';
    if (isAny(rgb, STAR, 0.02)) return 'core';
    if (near(rgb, BACK_STAR, 0.02)) return 'body';
    if (near(rgb, HALO, 0.02)) return 'halo';
    if (near(rgb, BODY_HI, 0.02)) return 'head';
    if (isAny(rgb, WING, 0.02)) return c[2] < 14.5 ? 'tail1' : 'wing';   // the hip hindwings ride the waist
    return null;   // the body colour: by shape
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
