// Seated people for Team Ewamon HQ (scad/npc/ewa_*.scad at ewa_desk.scad): `human()` from _human.mjs with its playing
// loop swapped for a seated typing loop. The model's origin stays the feet (z = 0, facing -Y, +X the person's own
// left): the rig moves the hips back by about a thigh length and down onto the chair seat, the leg IK bends the knees
// forward over vertical shins (the ankles stay on the origin), the torso leans in and both hands sit on the keyboard.
//
//   import { seated, K, osc, smooth } from './_seated.mjs';
//   export default await seated({ id: 'ewa_x', H: 178, head: 1.08, girth: 1.04, talkSide: -1, phase: 0.2,
//                                 clips: (h, S) => ({ idle_x: h.fidget(6.4, (t, u, base) => ({ ...base, ...spec })) }) });
//
// Clips: `idle` (typing, small head motion, breathing), `talk` (turns to the neighbour on side `talkSide`, +1 = the
// person's own left, and gestures with that hand; starts and ends on the idle pose), `cheer` (both fists up in the
// chair) and the character's own `idle_*` fidgets. A fidget's body gets the idle spec as `base`: spread it and change
// what moves (a key left out blends towards zero, which would stand the person up).
//
// The desk contract, in the person's own frame (cm; ewa_desk.scad places the same things in the desk frame): the seat
// top at z = SEAT_Z with its centre SEAT_Y behind the feet, the desk's near edge at y = DESK_EDGE, the top at DESK_Z,
// the keyboard centred at KEYBOARD, the mouse at MOUSE (right hand, -X side).
import { human, K, osc, win, smooth, flick, hash, mixv } from './_human.mjs';

export { K, osc, win, smooth, flick, hash, mixv };

export const SEAT_Z = 46;
export const SEAT_Y = 36;
export const DESK_Z = 72;
export const DESK_EDGE = 9;
export const KEYBOARD = [0, -6, 74];
export const MOUSE = [-27, -6, 73.5];
/** Fist centre above a surface point (the fist's radius plus a little). */
export const FIST_UP = 3.0;

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mv = (A, v) => A.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);

/**
 * A seated person. Options: everything human() takes (id, H, head, girth, top, joints, extras, classify), plus
 *   tempo       the typing loop in seconds (3.2)
 *   phase       0..1 offset of the loop (so neighbours do not type in step)
 *   lean        forward lean in degrees over pelvis + spine + chest (11)
 *   talkSide    +1: the neighbour sits on the person's own left (+X), -1 on the right
 *   typing(t, u, spec, S)   => spec: adjusts the idle loop
 *   clips(h, S) => { name: clip }: the character's own clips (S: the seated helpers below)
 */
export async function seated(o) {
  const tempo = o.tempo ?? 3.2;
  const ph = o.phase ?? 0;
  const lean = o.lean ?? 11;
  const side = o.talkSide ?? 1;
  let S;

  /** The seated base: hips on the seat, shins vertical over the feet. */
  function sit(P) {
    const s = P.s;
    const hip = P.thighL;
    const knee = P.shinL;
    const ankle = P.footL;
    const thigh = Math.hypot(...sub(knee, hip));
    const shin = Math.hypot(...sub(ankle, knee));
    const hipZ = SEAT_Z + 7.4 * s;          // the thigh's radius at the hip, resting on the seat
    const kneeZ = ankle[2] + shin;
    const hipY = Math.sqrt(Math.max(0, thigh ** 2 - (hipZ - kneeZ) ** 2)) - 0.4;
    return [0, hipY, hipZ - hip[2]];
  }

  /** The idle: typing, breathing, a little head motion towards the screen. */
  function typing(t) {
    const u = (((t / tempo) % 1) + 1) % 1;
    const breathe = osc(u, 2, ph);
    const spec = {
      pelvisP: S.pelvisP,
      pelvis: [lean * 0.35, 0, 0],
      spine: [lean * 0.35 + 0.6 * breathe, 0, 0],
      chest: [lean * 0.3 - 0.8 * breathe, 0, 1.5 * osc(u, 1, ph + 0.2)],
      neck: [-lean * 0.75, 0, 0],
      head: [6 + 2.5 * osc(u, 2, ph + 0.3) + 3 * flick(u, 1, ph + 0.55, 0.3), 3 * osc(u, 1, ph + 0.1), 5 * osc(u, 1, ph + 0.4)],
      jaw: 1,
      brows: { raise: 0.1 * osc(u, 1, ph), angry: 0.1 },
    };
    for (const [k, m] of [['L', 1], ['R', -1]]) {
      // the fist over its half of the keys: quick taps, a drift along the rows
      const kp = ph + (k === 'R' ? 0.5 : 0);
      const tap = flick(u, 9, kp, 0.25) + 0.6 * flick(u, 5, kp + 0.37, 0.2);
      spec[`hand${k}`] = {
        at: add(KEYBOARD, [m * (10.5 + 2.2 * osc(u, 2, kp)), 1.4 * osc(u, 3, kp + 0.2), FIST_UP + 0.4 + 1.3 * tap]),
        twist: -18,
        pole: [m * 0.7, 0.8, -0.9],
      };
    }
    return o.typing ? o.typing(t, u, spec, S) : spec;
  }

  const rig = await human({
    ...o,
    tempo,
    phase: ph,
    playing: (t) => typing(t),
    clips: (h) => {
      S = helpers(h);
      return {
        talk: talk(h),
        cheer: cheer(h),
        ...(o.clips?.(h, S) ?? {}),
      };
    },
  });
  return rig;

  function helpers(h) {
    const P = h.P;
    const pelvisP = sit(P);
    return {
      P, pelvisP, side, tempo,
      /** A head-local point (head units, skull centre at 0) in the person's frame, under `spec`. */
      headPoint(spec, q) {
        h.solve(spec);
        const W = h.solve.world.head;
        return add(W.p, mv(W.R, sub(P.hl(q), P.head)));
      },
      /** A point on the desk top (person frame x, y) where a fist rests. */
      onDesk: (x, y, up = FIST_UP) => [x, y, DESK_Z + up],
      KEYBOARD, MOUSE, DESK_Z, DESK_EDGE, SEAT_Z, SEAT_Y, FIST_UP,
    };
  }

  /** Turns to the neighbour on `side`, chats with that hand up, the other on the keys. */
  function talk(h) {
    return h.fidget(3.2, (t, u, base) => {
      const k = side > 0 ? 'L' : 'R';
      const m = side;
      return {
        ...base,
        pelvis: [base.pelvis[0], 0, 4 * m],
        spine: [base.spine[0] - 2, 0, 6 * m],
        chest: [base.chest[0] - 3, 0, 8 * m + 2 * osc(u, 2)],
        neck: [base.neck[0] + 2, 0, 12 * m],
        head: [-2 + 3 * osc(u, 5), 5 * osc(u, 2.5) * m, 22 * m],
        jaw: 3 + 10 * Math.abs(Math.sin(u * 8 * Math.PI)),
        brows: { raise: 0.45 + 0.2 * osc(u, 3), angry: -0.3 },
        [`hand${k}`]: {
          at: [m * (24 + 4 * osc(u, 2.5)), -2 + 3 * osc(u, 5), 98 + 6 * osc(u, 2.5, 0.2)],
          twist: -40 + 30 * osc(u, 5),
          pole: [m, 0.6, -0.7],
        },
      };
    }, { inn: 0.18, out: 0.2 });
  }

  /** Both fists up in the chair, leaning back. */
  function cheer(h) {
    return h.fidget(3.2, (t, u, base) => {
      const up = K(u, [[0.1, 0], [0.3, 1], [0.8, 1], [1, 0.6]]);
      const pump = Math.sin(Math.max(0, u - 0.3) / 0.5 * 2 * Math.PI * 2) ** 2 * (u < 0.8 ? 1 : 0);
      return {
        ...base,
        pelvis: [base.pelvis[0] - 4 * up, 0, 0],
        spine: [base.spine[0] - 6 * up, 0, 0],
        chest: [base.chest[0] - 6 * up + 2 * pump, 0, 0],
        head: [-14 * up - 4 * pump, 0, 4 * osc(u, 3)],
        jaw: 4 + 22 * up,
        brows: { raise: 0.5, angry: -0.3 },
        handL: { at: [24 + 8 * up, 6, 104 + 46 * up - 8 * pump], twist: 0, pole: [1, 0.3, -0.7] },
        handR: { at: [-24 - 8 * up, 6, 104 + 46 * up - 8 * pump], twist: 0, pole: [-1, 0.3, -0.7] },
      };
    }, { inn: 0.12, out: 0.16 });
  }
}
