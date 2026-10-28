// Mr Kaas Croissant (scad/npc/fb_kaas_croissant.scad): team B defence + goalie, both hands on the rods (grip L the
// goalie, grip R the defence). Really short, so he stands on a beer crate: the whole person is authored C cm up in
// the scad, so after the shared rig is built every pivot is lifted by C here (a per-character override; the base
// assumes feet on z = 0). Badly hungover: a slow, swaying, sluggish playing loop with one sudden panicked save per
// bar. Fidgets: idle_queasy (sways, hand to stomach, then to mouth, head droops) and idle_finger_guns (slides his
// shades down his nose and fires finger guns at the player side, click-click).
import { human, K, osc, flick, smooth, win } from './_human.mjs';

const H = 146;
const HEAD = 1.1;
const GIRTH = 1.08;
const C = 24;            // the crate top (scad CRATE)
const SKIN = [0.99, 0.82, 0.7];

const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function segDist(p, a, b) {
  const ab = sub(b, a);
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / (dot(ab, ab) || 1)));
  const q = add(a, ab.map((v) => v * t));
  return Math.hypot(...sub(p, q));
}
/** The fist's centre (finger joints' pivot) in the unlifted frame. */
const fistAt = (m) => { const s = H / 178; return [m * (18.5 + 4 + 0.33) * s * GIRTH, 0, (133 - 54 - 4.5) * s]; };

/** K over hand specs ({ at, twist, pole }), field by field. */
function KH(u, keys) {
  const f = (k) => K(u, keys.map(([x, v]) => [x, v[k]]));
  return { at: f('at'), twist: f('twist'), pole: f('pole') };
}

const def = await human({
  id: 'fb_kaas_croissant', H, head: HEAD, girth: GIRTH,
  grips: { L: true, R: true }, energy: 0.55, hunch: 0.75, tempo: 3.6, phase: 0.35, jawRest: 3,
  joints: [
    { name: 'shades', parent: 'head', at: [0, -15, 0] },   // placeholder pivot, set below (lifted like the rest)
    { name: 'fingerL', parent: 'handL', at: fistAt(1), scale: 1e-4 },
    { name: 'fingerR', parent: 'handR', at: fistAt(-1), scale: 1e-4 },
  ],
  extras: [1, -1].flatMap((m) => [
    // index finger pointing forward along the fist (rest: down the arm, so a twisted, raised fist points it ahead)
    { joint: m > 0 ? 'fingerL' : 'fingerR', color: SKIN, at: [m * -0.3, -2.2, -5.2].map((v) => v * H / 178), size: [1.8, 1.8, 6].map((v) => v * H / 178), rot: [0, m * 4, 0] },
    // the thumb cocked up (the hammer)
    { joint: m > 0 ? 'fingerL' : 'fingerR', color: SKIN, at: [m * -3.4, -2.6, 0.6].map((v) => v * H / 178), size: [1.7, 1.7, 3.8].map((v) => v * H / 178), rot: [0, 0, 0] },
  ]),
  // the shells were measured in the lifted scad: classify every one against lifted bones (the crate is the root)
  classify: (G, P) => {
    const c = sub(G.centroid, [0, 0, C]);
    if (c[2] < -0.2) return 'root';
    if ([...G.colors].every((x) => x.split(',').every((v) => +v < 0.12))) return 'shades';
    const bones = [
      ['pelvis', P.pelvis, P.b([0, 0, 96])], ['spine', P.spine, P.b([0, 0, 108])], ['chest', P.chest, P.b([0, 0, 134])],
      ['neck', P.neck, P.b([0, 0.5, 142])], ['head', P.hc, P.hl([0, 0, 6])], ['jaw', P.hl([0, -6, -11]), P.hl([0, -6, -11])],
      ['browL', P.browL, P.browL], ['browR', P.browR, P.browR],
    ];
    for (const k of ['L', 'R']) {
      bones.push([`thigh${k}`, P[`thigh${k}`], P[`shin${k}`]], [`shin${k}`, P[`shin${k}`], P[`foot${k}`]], [`foot${k}`, P[`foot${k}`], P[`toe${k}`]],
        [`uarm${k}`, P[`uarm${k}`], P[`farm${k}`]], [`farm${k}`, P[`farm${k}`], P[`hand${k}`]], [`hand${k}`, P[`fist${k}`], P[`fist${k}`]]);
    }
    let best = Infinity;
    let name;
    for (const [n, a, b] of bones) { const d = segDist(c, a, b); if (d < best) { best = d; name = n; } }
    // slivers the elbow cut leaves of the long sleeve belong to the upper arm
    if (G.tris < 20 && name.startsWith('farm')) return `uarm${name.slice(4)}`;
    return name;
  },
  // hungover playing: a slow side-to-side sway and a drooping head, one sudden panicked save per bar
  playing: (t, u, base) => {
    const sway = osc(u, 1, 0.1);
    const panic = K(u, [[0.6, 0], [0.64, 1], [0.74, 1], [0.86, 0]]);
    const save = flick(u, 1, 0.38, 0.08);
    const g = (k, m) => ({ ...base[`hand${k}`], at: add(base[`hand${k}`].at, [0, -3.5 * save * (k === 'L' ? 1 : 0.6), 0]), twist: base[`hand${k}`].twist + m * 140 * save });
    return {
      ...base,
      pelvisP: [2.2 * sway, 0, base.pelvisP[2] - 1.5 * panic],
      pelvis: [base.pelvis[0], 2.5 * sway, base.pelvis[2] + 2 * sway],
      spine: [base.spine[0], 3 * sway, base.spine[2]],
      chest: [base.chest[0] + 4 * panic, -3 * sway, base.chest[2] + 4 * panic * osc(u, 4)],
      neck: [base.neck[0] + 6 * (1 - panic), 0, 0],
      head: [base.head[0] + 6 * (1 - panic) - 10 * panic, -6 * sway, base.head[2] * 0.6 + 8 * osc(u, 1, 0.3) * (1 - panic)],
      jaw: base.jaw + 12 * panic,
      brows: { raise: -0.2 + 1.1 * panic, angry: 0.1 - 0.7 * panic },
      handL: g('L', 1),
      handR: g('R', 1),
    };
  },
  clips: (h) => {
    const P = h.P;
    return {
      // queasy: lets go of the defence rod, a big slow sway, hand to his stomach, then up to his mouth, head hanging
      idle_queasy: h.fidget(3.6, (t, u) => {
        const sway = osc(u, 1.5) * win(u, 0.05, 0.95, 0.15);
        const mouth = K(u, [[0.42, 0], [0.56, 1], [0.78, 1], [0.9, 0]]);
        const droop = K(u, [[0.08, 0], [0.3, 1], [0.86, 1], [0.97, 0]]);
        const gulp = flick(u, 1, 0.38, 0.12);
        return {
          pelvisP: [4 * sway, 0, -3],
          pelvis: [6 + 6 * droop, 4 * sway, 4 * sway],
          spine: [6 + 6 * droop, 5 * sway, 0],
          chest: [6 + 8 * droop - 6 * gulp, -5 * sway, -4 * sway],
          neck: [8 * droop, 0, 0],
          head: [18 * droop - 10 * gulp, -10 * sway, 8 * sway],
          jaw: 1 + 8 * gulp,
          brows: { raise: 0.3 + 0.4 * droop, angry: -0.8 * droop },
          handL: { at: [10, -24 + 2 * sway, 87 + 1], twist: 0, pole: [1, 0.55, 0.15] },
          handR: KH(u, [
            [0.08, { at: [-10, -24, 87], twist: 0, pole: [-1, 0.55, 0.15] }],
            [0.24, { at: P.b([-4, -16, 103]), twist: -70, pole: [-1, 0.6, -0.3] }],
            [0.42, { at: P.b([-3, -17, 101]), twist: -60, pole: [-1, 0.6, -0.3] }],
            [0.56, { at: P.hl([-1, -19, -8]), twist: -80, pole: [-1, 0.2, -0.8] }],
            [0.78, { at: P.hl([-1, -19, -9]), twist: -80, pole: [-1, 0.2, -0.8] }],
            [0.95, { at: [-10, -24, 87], twist: 0, pole: [-1, 0.55, 0.15] }],
          ]),
        };
      }, { inn: 0.1, out: 0.1 }),
      // the ladies' man: turns to the player side (+X, towards the camera), slides his shades down his nose, eyebrows
      // up, and fires two finger guns, click-click
      idle_finger_guns: h.fidget(2.8, (t, u) => {
        const turn = K(u, [[0.06, 0], [0.22, 1], [0.84, 1], [0.97, 0]]);
        const guns = K(u, [[0.18, 0], [0.3, 1], [0.82, 1], [0.92, 0]]);
        const click = flick(u, 2, 0.6, 0.1) * win(u, 0.32, 0.8, 0.04);
        const shades = K(u, [[0.12, 0], [0.24, 1], [0.86, 1], [0.95, 0]]);
        const gun = (m) => ({ at: P.b([m * 18 + 16, -38, 124 + 5 * click]), twist: -90, pole: [m, 0.2, -0.8] });
        return {
          pelvisP: [0, 0, -1.5],
          pelvis: [3, 0, 10 * turn],
          spine: [2, 0, 8 * turn],
          chest: [2 - 3 * click, 0, 12 * turn],
          neck: [-6, 0, 8 * turn],
          head: [-8 * turn + 6 * shades, 8 * turn, 12 * turn],
          jaw: 2 + 6 * guns,
          brows: { raise: 1.1 * shades + 0.3 * click, angry: -0.2 },
          handL: gun(1),
          handR: gun(-1),
          joints: {
            fingerL: { s: Math.max(1e-4, smooth((guns - 0.4) * 3)) },
            fingerR: { s: Math.max(1e-4, smooth((guns - 0.4) * 3)) },
            shades: { r: [-6 * shades, 0, 0], p: [0, -0.4 * shades, -2.4 * shades] },
          },
        };
      }, { inn: 0.1, out: 0.1 }),
    };
  },
});

// lift every pivot onto the crate (the arrays are shared with the solver, so it sees the lifted skeleton); P.b, the
// body-frame target helper the built-in talk / cheer use, lifts its results too
const P = def.human.P;
const shades = def.joints.find((j) => j.name === 'shades');
shades.at.splice(0, 3, ...P.hl([0, -15, 2.5]));
const lifted = new Set([...def.joints.map((j) => j.at), ...Object.values(P).filter((v) => Array.isArray(v) && v.length === 3)]);
for (const a of lifted) a[2] += C;
const b0 = P.b;
P.b = (p) => add(b0(p), [0, 0, C]);

export default def;
