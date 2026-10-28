// Mr Motor (scad/npc/fb_mr_motor.scad): team B midfield, his right hand on grip R, his free left hand resting on the
// rim like on a handlebar. Calm, low and leaned in like on his bike; the slowest loop at the table. Fidgets: the rod
// becomes a throttle (idle_vroom) and a little mime of eating eggs with cottage cheese (idle_eggs).
import { human, K, osc, smooth } from './_human.mjs';

const H = 181;
const HEAD = 1.06;
const GIRTH = 1.05;
const s = H / 178;
const b = (p) => [p[0] * s * GIRTH, p[1] * s * GIRTH, p[2] * s];

export default await human({
  id: 'fb_mr_motor', H, head: HEAD, girth: GIRTH, top: 192.91,
  grips: { R: true },
  // the helmet is its own (hollow) shell: it rides on the head
  classify: (G) => ([...G.colors].some((c) => c.startsWith('0.82,0.1') || c.startsWith('0.97,0.97,0.95') || c.startsWith('0.75,0.75,0.78')) && G.centroid[2] > 150 ? 'head' : undefined), freeHand: 'rim', energy: 0.7, hunch: 1.15, tempo: 3.2, phase: 0.81, jawRest: 0,
  // cool: brows level, not angry, and a slow lean side to side as if taking corners
  playing: (t, u, base) => ({ ...base, brows: { raise: 0, angry: 0.1 }, pelvis: [base.pelvis[0], 3 * osc(u, 1, 0.81), base.pelvis[2]] }),
  clips: (h) => ({
    // VROOM: crouches into a bike lean, left hand grabs an invisible handlebar, the right wrist twists the rod like a
    // throttle (three revs), leans into a corner, jaw buzzing "brrrrr"
    idle_vroom: h.fidget(3.2, (t, u) => {
      const ride = K(u, [[0.08, 0], [0.2, 1], [0.84, 1], [0.95, 0]]);
      const rev = Math.max(0, osc(u, 3, 0.75)) ** 2 * ride;
      const corner = K(u, [[0.3, 0], [0.5, 1], [0.66, -0.6], [0.84, 0]]);
      const buzz = ride * (0.5 + 0.5 * Math.sin(t * 2 * Math.PI * 14));
      return {
        pelvisP: [0, 0, -13 * ride],
        pelvis: [24 * ride, 16 * corner, 0],
        spine: [8 * ride, 4 * corner, 0],
        chest: [6 * ride - 3 * rev, 6 * corner, 0],
        neck: [-24 * ride, -10 * corner, 0],
        head: [-2 * ride + 2 * rev, -6 * corner, 0],
        jaw: 2 + 4 * buzz * ride,
        brows: { raise: -0.2, angry: 0.6 * ride },
        handR: { at: [-10, -24, 87], twist: -15 - 80 * rev, pole: [-1, 0.2, 0.8] },
        handL: { at: [30 * s, -28, 94], twist: 10 - 20 * rev, pole: [1, 0.2, 0.8] },
      };
    }, { inn: 0.08, out: 0.1 }),
    // eggs with cottage cheese: a plate held up in the left hand, three forkfuls with the right, chewing, a nod
    idle_eggs: h.fidget(3.2, (t, u) => {
      const on = K(u, [[0.1, 0], [0.24, 1], [0.88, 1], [0.95, 0]]);
      // three forkfuls: scoop (low, at the plate) -> up to the mouth
      const f = Math.min(3, Math.max(0, (u - 0.3) / 0.2));
      const bite = on * Math.sin(Math.PI * (f % 1)) ** 2;
      const chew = on * Math.abs(Math.sin(u * 14 * Math.PI)) * (1 - bite);
      return {
        pelvisP: [0, 0, -1],
        pelvis: [4, 0, 0],
        spine: [2, 0, 0],
        chest: [2 + 3 * bite, 0, 4],
        neck: [-2, 0, 0],
        head: [10 - 8 * bite + 4 * K(u, [[0.8, 0], [0.86, 1], [0.92, 0]]), 0, 6],
        jaw: 2 + 10 * bite + 5 * chew,
        brows: { raise: 0.3 * bite, angry: -0.1 },
        handL: { at: b([10, -26, 112]), twist: -70, pole: [1, 0.3, -0.6] },
        handR: { at: [-6 + 1 * bite, -28 - 2 * bite, 117 + 28 * bite], twist: 40 * bite, pole: [-1, 0.2, -0.7] },
      };
    }, { inn: 0.1, out: 0.1 }),
  }),
});
