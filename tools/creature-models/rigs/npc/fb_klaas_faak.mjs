// Klaas Faak (scad/npc/fb_klaas_faak.scad): team A midfield, his right hand on grip R, his free left fist pumping.
// He waited ALL DAY to play and now he finally can: the playing loop is faster and bouncier than anyone's (little hops
// on the balls of his feet), and his fidgets are giddy jumping and a two-fisted "FINALLY!".
import { human, K, osc, smooth } from './_human.mjs';

const H = 178;
const HEAD = 1.1;
const GIRTH = 1.02;
const s = H / 178;
const b = (p) => [p[0] * s * GIRTH, p[1] * s * GIRTH, p[2] * s];
/** 0..1 hop curve: up quickly, down, a beat on the ground; `n` hops per loop (whole n = seamless). */
const hop = (u, n, phase = 0) => { const f = ((u * n + phase) % 1 + 1) % 1; return f < 0.45 ? Math.sin(Math.PI * f / 0.45) : 0; };

export default await human({
  id: 'fb_klaas_faak', H, head: HEAD, girth: GIRTH, top: 192.11,
  grips: { R: true }, freeHand: 'pump', energy: 1.45, hunch: 0.85, tempo: 2.0, phase: 0.62, jawRest: 6,
  // giddy: springs on the balls of his feet, two little hops per loop, head bobbing, brows up instead of angry
  playing: (t, u, base) => {
    const p = hop(u, 2, 0.62);
    return {
      ...base,
      root: [0, 0, 2.2 * p],
      pelvisP: [base.pelvisP[0], base.pelvisP[1], base.pelvisP[2] - 1.2 * (1 - p)],
      head: [base.head[0] - 4 * p, base.head[1], base.head[2]],
      jaw: base.jaw + 4 * p,
      brows: { raise: 0.5, angry: -0.2 },
    };
  },
  clips: (h) => ({
    // giddy on-the-spot jumping, the right hand hovering at the rod, the left fist shaking, grinning ear to ear
    idle_bounce: h.fidget(2.0, (t, u) => {
      const p = hop(u, 4, 0.05);
      return {
        root: [0, 0, 9 * p],
        pelvisP: [0, 0, -4 * (1 - p)],
        pelvis: [6, 0, 4 * osc(u, 2)],
        spine: [2, 0, 0],
        chest: [-4 * p, 0, 6 * osc(u, 2)],
        neck: [-6, 0, 0],
        head: [-8 * p + 2, 6 * osc(u, 2), 8 * osc(u, 2, 0.25)],
        jaw: 14 + 8 * p,
        brows: { raise: 0.8, angry: -0.4 },
        handR: { at: [-11, -24, 93 + 4 * p], twist: 0, pole: [-1, 0.55, 0.15] },
        handL: { at: b([22, -12, 138 + 22 * p]), twist: 20 * osc(u, 4), pole: [1, 0.3, -0.7] },
      };
    }, { inn: 0.1, out: 0.12 }),
    // "FINALLY!": crouches, springs up with both fists in the air, head back, shakes them, back to the rod
    idle_finally: h.fidget(2.4, (t, u) => {
      const up = K(u, [[0.1, 0], [0.26, 1], [0.82, 1], [0.94, 0]]);
      const jump = K(u, [[0.14, 0], [0.24, 7], [0.34, 0], [1, 0]]);
      const shake = up * osc(u, 7);
      return {
        root: [0, 0, jump],
        pelvisP: [0, 0, K(u, [[0.08, -1], [0.16, -8], [0.26, 0], [0.36, -3], [0.5, -1]])],
        pelvis: [K(u, [[0.1, 8], [0.16, 14], [0.3, -4]]), 0, 0],
        spine: [-6 * up, 0, 0],
        chest: [-12 * up + 2 * shake, 0, 0],
        neck: [-8 * up, 0, 0],
        head: [-22 * up + 3 * shake, 0, 0],
        jaw: 4 + 26 * up,
        brows: { raise: 1, angry: -0.5 },
        handL: { at: b([20 + 17 * up, -8, 120 + 60 * up + 3 * shake]), twist: 0, pole: [1, 0.2, -0.7] },
        handR: { at: b([-20 - 17 * up, -8, 120 + 60 * up - 3 * shake]), twist: 0, pole: [-1, 0.2, -0.7] },
      };
    }, { inn: 0.1, out: 0.14 }),
  }),
});
