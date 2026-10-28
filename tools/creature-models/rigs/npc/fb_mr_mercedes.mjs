// Mr Mercedes (scad/npc/fb_mr_mercedes.scad): team A keeper, both hands on the rods: grip L the goalie (from his side
// the goalie rod is on his left), grip R the defence. Scoring with the keeper is his whole personality: the playing
// loop winds the goalie rod up once per bar and slaps it through. Fidgets: idle_keepershot (a huge full-body wind-up
// and spin of the goalie rod, then a hopeful look up the table) and idle_post (off the post: hands on his head).
import { human, K, osc, flick, smooth, win, hash } from './_human.mjs';

const H = 179;
const HEAD = 1.1;
const GIRTH = 1.04;

/** K over hand specs ({ at, twist, pole }), field by field. */
export function KH(u, keys) {
  const f = (k) => K(u, keys.map(([x, v]) => [x, v[k]]));
  return { at: f('at'), twist: f('twist'), pole: f('pole') };
}

/** The goalie wind-up inside the playing loop: 0 rest, pulls back from u 0.5, slaps through at u ~0.78. */
function windup(u) {
  const back = K(u, [[0.48, 0], [0.74, 1], [0.79, -0.25], [0.92, 0]]);
  const spin = u < 0.74 ? -70 * smooth((u - 0.48) / 0.26) : u < 0.8 ? -70 + 430 * smooth((u - 0.74) / 0.06) : 0;
  return { back, spin: u < 0.48 ? 0 : spin };
}

export default await human({
  id: 'fb_mr_mercedes', H, head: HEAD, girth: GIRTH,
  // the long sleeve's elbow cut leaves two tiny slivers of the upper arm per side: keep them on the upper arm
  classify: (G) => (G.tris < 20 && Math.abs(G.centroid[2] - 104) < 4 ? (G.centroid[0] > 0 ? 'uarmL' : 'uarmR') : undefined),
  grips: { L: true, R: true }, energy: 1.05, hunch: 1.12, tempo: 2.8, phase: 0.62, jawRest: 1,
  playing: (t, u, base, h) => {
    const w = windup(u);
    const g = base.handL;
    // the slap: twist from 0 through 360 (the same orientation, so the loop closes), body coiled to his left
    const slapHit = flick(u, 1, 0.24, 0.1);
    return {
      ...base,
      pelvis: [base.pelvis[0], 0, base.pelvis[2] + 5 * w.back],
      chest: [base.chest[0] - 4 * w.back + 4 * slapHit, base.chest[1], base.chest[2] + 10 * w.back],
      head: [base.head[0], base.head[1], base.head[2] * (1 - 0.6 * Math.max(0, w.back)) - 6 * w.back],
      brows: { raise: -0.3 - 0.1 * w.back, angry: 0.35 + 0.4 * Math.max(0, w.back) },
      jaw: base.jaw + 6 * slapHit,
      handL: { ...g, at: [g.at[0], g.at[1] + 4 * w.back, g.at[2]], twist: g.twist * 0.4 * (1 - win(u, 0.44, 0.97, 0.04)) + w.spin },
    };
  },
  clips: (h) => {
    const P = h.P;
    return {
      // the big one: lets go of the defence rod, coils his whole body back, spins the goalie rod through a full turn,
      // leans after it, then rises on his toes looking up the table, hoping
      idle_keepershot: h.fidget(3.4, (t, u) => {
        const coil = K(u, [[0.06, 0], [0.34, 1], [0.4, -0.6], [0.55, -0.3], [0.7, 0]]);
        const spin = u < 0.34 ? -120 * smooth((u - 0.06) / 0.28) : u < 0.42 ? -120 + 480 * smooth((u - 0.34) / 0.08) : 0;
        const look = K(u, [[0.42, 0], [0.56, 1], [0.86, 1], [0.97, 0]]);
        const hope = win(u, 0.5, 0.9, 0.06);
        return {
          pelvisP: [0, 0, -4 + 4 * hope],
          pelvis: [6 + 6 * coil, 0, 12 * coil - 6 * look],
          spine: [6, 0, 10 * coil - 6 * look],
          chest: [8 - 10 * coil * (coil > 0 ? 1 : -1.3) - 8 * look, 0, 16 * coil - 8 * look],
          neck: [-8 - 8 * look, 0, -10 * look],
          head: [6 - 16 * look, 3 * look, -10 * coil - 22 * look],
          jaw: K(u, [[0.3, 2], [0.38, 18], [0.48, 6], [0.6, 10], [0.9, 12], [1, 2]]),
          brows: { raise: 0.1 + 0.8 * look, angry: K(u, [[0.1, 0.4], [0.34, 1.1], [0.45, 0.3], [0.55, -0.5], [0.9, -0.5], [1, 0.3]]) },
          handL: { at: [10, -24 + 6 * coil, 87 + 2 * coil], twist: spin, pole: [1, 0.55, 0.15] },
          // the right hand flies up for balance during the shot, then clasps hopefully at the chest
          handR: KH(u, [
            [0.08, { at: [-10, -24, 87], twist: 0, pole: [-1, 0.55, 0.15] }],
            [0.34, { at: P.b([-30, -6, 112]), twist: -30, pole: [-1, 0.4, -0.5] }],
            [0.42, { at: P.b([-34, -20, 128]), twist: 0, pole: [-1, 0.3, -0.6] }],
            [0.58, { at: P.b([-6, -22, 118]), twist: 40, pole: [-1, 0.8, -0.3] }],
            [0.86, { at: P.b([-5, -22, 120]), twist: 40, pole: [-1, 0.8, -0.3] }],
            [0.98, { at: [-10, -24, 87], twist: 0, pole: [-1, 0.55, 0.15] }],
          ]),
        };
      }, { inn: 0.06, out: 0.1 }),
      // off the post: a jolt on the clank, both hands to his head, mouth open, a slow disbelieving head shake
      idle_post: h.fidget(2.8, (t, u) => {
        const jolt = K(u, [[0.04, 0], [0.09, 1], [0.18, 0]]);
        const onHead = K(u, [[0.12, 0], [0.26, 1], [0.78, 1], [0.92, 0]]);
        const shake = osc(u, 3) * win(u, 0.3, 0.76, 0.06);
        const top = (m) => P.hl([m * 12.5, -0.5, 10.5]);
        return {
          pelvisP: [0, 0, -1 - 2 * jolt],
          pelvis: [6 - 4 * onHead, 0, 0],
          spine: [4 - 6 * onHead, 0, 0],
          chest: [6 - 14 * onHead - 6 * jolt, 0, 3 * shake],
          neck: [-6, 0, 0],
          head: [4 - 14 * onHead + 8 * jolt, 0, 18 * shake],
          jaw: 2 + 20 * onHead,
          brows: { raise: 0.2 + 0.9 * onHead, angry: -0.7 * onHead },
          handL: { at: top(1), twist: -40, pole: [1, 0.2, 0.4] },
          handR: { at: top(-1), twist: -40, pole: [-1, 0.2, 0.4] },
        };
      }, { inn: 0.14, out: 0.12 }),
    };
  },
});
