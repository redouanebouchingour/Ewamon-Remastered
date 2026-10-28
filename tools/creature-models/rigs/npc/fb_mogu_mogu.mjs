// Mr Mogu Mogu (scad/npc/fb_mogu_mogu.scad): team A attack, his left hand on grip L, his free right fist holding a
// Mogu Mogu bottle (part of the right hand's shell). Brags how much he eats and drinks. The body, playing loop, talk
// and cheer come from _human.mjs; this file adds the bottle hand and his two fidgets.
import { human, K, osc, smooth } from './_human.mjs';

const H = 176;
const HEAD = 1.06;
const GIRTH = 1.08;
const s = H / 178;
const mix = (a, c, w) => a.map((v, i) => v + (c[i] - v) * w);
const b = (p) => [p[0] * s * GIRTH, p[1] * s * GIRTH, p[2] * s];

/** The bottle hand while playing: held up by the rim, bottle upright, bobbing with the game, a sip-tilt now and then. */
const bottleHand = (t, u) => ({
  at: [-24 * s, -30 + 1.2 * osc(u, 2, 0.2), 100 + 2 * osc(u, 2, 0.45)],
  twist: -8 + 8 * osc(u, 1, 0.1),
  pole: [-1, 0.5, -0.6],
});

export default await human({
  id: 'fb_mogu_mogu', H, head: HEAD, girth: GIRTH, top: 186.11,
  grips: { L: true },
  // stray hair bits belong to the head
  classify: (G) => ([...G.colors].every((c) => c === '0.50,0.35,0.19' || c === '0.50,0.35,0.20') ? 'head' : undefined), freeHand: bottleHand, energy: 0.9, hunch: 0.95, tempo: 2.7, phase: 0.37, jawRest: 0.5,
  clips: (h) => ({
    // a big slurp: lets the bottle hand come up, head back, cheeks and jaw working on the jelly, a satisfied "ahh"
    idle_slurp: h.fidget(2.7, (t, u) => {
      const up = K(u, [[0.1, 0], [0.3, 1], [0.66, 1], [0.82, 0]]);
      const back = K(u, [[0.06, 0], [0.24, 1], [0.74, 1], [0.9, 0]]);
      const chew = back * Math.abs(Math.sin(u * 10 * Math.PI));
      const ahh = K(u, [[0.68, 0], [0.78, 1], [0.92, 0]]);
      return {
        pelvisP: [0, 1.5 * back, -1.5],
        pelvis: [4, 0, -2],
        spine: [2 - 4 * back, 0, -2],
        chest: [4 - 8 * back, 0, -6],
        neck: [-6 - 8 * back, 0, -4],
        head: [6 - 30 * back + 2 * chew, 0, -6 + 2 * osc(u, 4) * (1 - back)],
        jaw: 2 + 6 * chew + 22 * ahh,
        brows: { raise: 0.5 * back + 0.6 * ahh, angry: -0.4 },
        handL: h.gripHand('L', 0, 0.37),
        // the cap at his lips, the bottle bottoms-up (searched with the slurp's full-weight body pose)
        handR: { at: mix([-24, -30, 104], [-13.2 + 0.6 * chew, -10.3, 167.8 - 1.2 * chew], up).map((v, i) => v + (i === 1 ? -20 : i === 0 ? -8 : 0) * Math.sin(Math.PI * up)), twist: -30 * up, pole: [-1, 0.2, -0.8] },
      };
    }, { inn: 0.08, out: 0.1 }),
    // the brag: chest out, pats his belly with the rod hand, raises the bottle like a trophy ("a whole litre, abi")
    idle_brag: h.fidget(2.8, (t, u) => {
      const proud = K(u, [[0.1, 0], [0.26, 1], [0.84, 1], [0.96, 0]]);
      const pat = Math.max(0, Math.sin(u * 4 * 2 * Math.PI)) ** 2 * K(u, [[0.25, 0], [0.32, 1], [0.8, 1], [0.86, 0]]);
      return {
        pelvisP: [0, -2 * proud, -0.5],
        pelvis: [-2 * proud, 0, 6],
        spine: [-5 * proud, 0, 4],
        chest: [-9 * proud, 0, 6],
        neck: [-4, 0, 2],
        head: [-10 * proud + 3 * osc(u, 3), 0, 18 * proud],
        jaw: 3 + 12 * Math.abs(Math.sin(u * 6 * Math.PI)) * proud,
        brows: { raise: 0.8 * proud, angry: -0.2 },
        handL: { at: b([6, -22 + 4.5 * pat, 104 + 2 * pat]), twist: -40, pole: [1, 0.4, -0.3] },
        handR: { at: b([-30, -18, 132 + 34 * proud + 4 * osc(u, 3)]), twist: -30, pole: [-1, 0.3, -0.7] },
      };
    }, { inn: 0.1, out: 0.12 }),
  }),
});
