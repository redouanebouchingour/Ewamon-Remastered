// King Klinker (scad/npc/fb_king_klinker.scad): team B attack, his left hand on grip L, his free right fist pounding
// the rim. Calls everyone "abi"; when it gets hard he roars WRAAAAAAAAAH. The body, playing loop, talk and cheer come
// from _human.mjs; this file adds his pointing finger and his two fidgets.
import { human, K, osc, flick, smooth, hash } from './_human.mjs';

const H = 172;
const HEAD = 1.08;
const GIRTH = 1.06;
const SKIN = [0.99, 0.8, 0.68];

export default await human({
  id: 'fb_king_klinker', H, head: HEAD, girth: GIRTH, top: 189.81,
  grips: { L: true }, freeHand: 'pound', energy: 1.15, hunch: 1, tempo: 2.4, phase: 0.1, jawRest: 1,
  // a pointing index finger on the right fist, hidden until he points at someone (idle_abi)
  joints: [{ name: 'fingerR', parent: 'handR', at: fist(), scale: 1e-4 }],
  extras: [{ joint: 'fingerR', color: SKIN, at: [0.3, -2.2, -5.6].map((v) => v * H / 178), size: [1.9, 1.9, 6.2].map((v) => v * H / 178), rot: [0, -4, 0] }],
  clips: (h) => ({
    // WRAAAAAAAAAH: lets go of the rod, arms up in a wide V, head thrown back, mouth wide open, shaking with rage
    idle_wraaah: h.fidget(2.2, (t, u) => {
      const rage = K(u, [[0.12, 0], [0.28, 1], [0.78, 1], [0.9, 0.3]]);
      const shake = (n) => (hash(Math.floor(t * 24) + n) - 0.5) * 2 * rage;
      const up = K(u, [[0.08, 0], [0.26, 1], [0.84, 1], [1, 0.6]]);
      return {
        pelvisP: [0, 0, -5 + 1.5 * shake(1)],
        pelvis: [-2, 0, 0],
        spine: [-6 * up, 0, 0],
        chest: [-14 * up + 2 * shake(2), 0, 2 * shake(3)],
        neck: [-10 * up, 0, 0],
        head: [-26 * up + 3 * shake(4), 0, 4 * shake(5)],
        jaw: K(u, [[0.1, 2], [0.28, 30], [0.8, 32], [0.92, 6]]) + 2 * shake(6),
        brows: { raise: 0.2, angry: K(u, [[0.1, 0.3], [0.25, 1.1], [0.85, 1.1], [1, 0.4]]) },
        handL: { at: h.P.b([28 + 12 * up, -10 + 8 * up, 120 + 62 * up]).map((v, i) => v + (i === 2 ? 2 * shake(7) : 0)), twist: 0, pole: [1, 0.3, -0.8] },
        handR: { at: h.P.b([-28 - 12 * up, -10 + 8 * up, 120 + 62 * up]).map((v, i) => v + (i === 2 ? 2 * shake(8) : 0)), twist: 0, pole: [-1, 0.3, -0.8] },
      };
    }, { inn: 0.1, out: 0.16 }),
    // "ABI!": keeps his left hand on the rod, points across the table at the opponent and trash-talks, jabbing twice
    idle_abi: h.fidget(2.4, (t, u) => {
      const jab = flick(u, 3, 0.75, 0.2);
      const point = K(u, [[0.1, 0], [0.22, 1], [0.86, 1], [0.96, 0]]);
      return {
        pelvisP: [0, 0, -2],
        pelvis: [8, 0, 4],
        spine: [5, 0, 4],
        chest: [6 + 3 * jab, 0, 14],
        neck: [-14, 0, -6],
        head: [-4 + 5 * jab, 0, -10 + 4 * osc(u, 3)],
        jaw: 3 + 12 * Math.abs(Math.sin(u * 6 * Math.PI)) * point,
        brows: { raise: 0.7, angry: 0.2 },
        handL: h.gripHand('L', 0, 0.1),
        handR: { at: h.P.b([-14, -58 - 6 * jab, 124 + 2 * jab]), twist: 90, pole: [-1, 0.2, -0.4] },
        joints: { fingerR: { s: Math.max(1e-4, smooth((point - 0.5) * 3)) } },
      };
    }, { inn: 0.12, out: 0.12 }),
  }),
});

/** The right fist's centre (the finger joint's pivot), from the shared landmarks. */
function fist() {
  const s = H / 178;
  return [-(18.5 + 4 + 0.33) * s * GIRTH, 0, (133 - 54 - 4.5) * s];
}
