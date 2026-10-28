// The Mire Route foosball table's rig (rig.mjs --npc): the cabinet is the root, one joint per rod (the chrome rod with
// its figures and its grip spins about the rod axis and slides along it), one for the ball and one per scoring bead.
// Coordinates and colours are scad/npc/foosball_table.scad's: 1 unit = 1 cm, origin = the table's centre on the
// ground, rods across Y at z = 87. Team A (red) holds from -Y and attacks +X; team B (blue) holds from +Y and attacks -X.
//
// The match is choreographed, not simulated: each clip is a list of ball waypoints (a kick by the rod that touches
// it, or a wall bounce). The kicking rod slides one of its men onto the ball and swings; every other rod drifts and
// twitches, twirls when the ball is far away, and lifts its men (feet up, the figures horizontal above the ball) when
// the ball would otherwise run through one of them. `state(clip, t)` exposes the simulation for checks.
//
// Rotation: a rod's r = [0, ry, 0]; ry > 0 swings the feet towards -X. A "feet-forward" angle a (the team's attack
// direction) is ry = -dir * a, dir = +1 for team A, -1 for team B. Figures reach 8.3 from the rod axis and the field
// is 9 below it, so full spins clear the field.

const ROD_Z = 87;
const BALL_R = 1.75;
const BALL_Z = 78 + 1.85;
const IX = 87;
const IY = 40;
const FIG_HALF_Y = 2.85;
const SLIDE_IN = 4;     // towards the far wall (the grip moves in to the bearing)
const SLIDE_OUT = 6;    // towards the owner
const CONTACT = 5.5;    // ball centre to rod axis (x) when a man strikes it

// x, team sign (-1 A: handles at -Y, attacks +X; +1 B: handles at +Y, attacks -X), men
const RODS = [
  { name: 'rod_a_goalie', x: -70, t: -1, men: [0] },
  { name: 'rod_a_defence', x: -50, t: -1, men: [-14, 14] },
  { name: 'rod_b_attack', x: -30, t: 1, men: [-24, 0, 24] },
  { name: 'rod_a_mid', x: -10, t: -1, men: [-30, -15, 0, 15, 30] },
  { name: 'rod_b_mid', x: 10, t: 1, men: [-30, -15, 0, 15, 30] },
  { name: 'rod_a_attack', x: 30, t: -1, men: [-24, 0, 24] },
  { name: 'rod_b_defence', x: 50, t: 1, men: [-14, 14] },
  { name: 'rod_b_goalie', x: 70, t: 1, men: [0] },
];
for (const r of RODS) r.dir = -r.t;
const [AG, AD, BA, AM, BM, AA, BD, BG] = RODS.map((_, i) => i);
const SCORE_Y = -15 + 5 * 1.6;   // the scoring bead's rest y on its wire
const SCORE_TO = 8.85;           // where it lands, beside the other group

const joints = [
  { name: 'cabinet', at: [0, 0, 0] },
  ...RODS.map((r) => ({ name: r.name, parent: 'cabinet', at: [r.x, 0, ROD_Z] })),
  { name: 'ball', parent: 'cabinet', at: [0, 0, BALL_Z] },
  { name: 'score_red', parent: 'cabinet', at: [-88.5, SCORE_Y, 94.2] },
  { name: 'score_blue', parent: 'cabinet', at: [88.5, SCORE_Y, 94.2] },
];

const isChrome = (c) => Math.abs(c[0] - 0.76) < 0.06 && Math.abs(c[1] - 0.78) < 0.06 && Math.abs(c[2] - 0.82) < 0.06;
function assign([x, y, z], rgb) {
  if (z > 78.3 && Math.hypot(x, y, z - BALL_Z) < BALL_R + 0.3) return 'ball';
  if (Math.abs(Math.abs(x) - 88.5) < 1.5 && Math.abs(y - SCORE_Y) < 0.75 && z > 92.6 && !isChrome(rgb)) return x < 0 ? 'score_red' : 'score_blue';
  const ay = Math.abs(y);
  if (z > 78.6) for (const r of RODS) {
    if (Math.abs(x - r.x) < 9.5 && (ay < 39.3 || ay > 45.6 || isChrome(rgb))) return r.name;
  }
  return 'cabinet';
}

// ---- helpers ----------------------------------------------------------------------------------------------------

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (x) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
/** Eased keyframes [[t, v], …] held outside. */
function K(t, keys) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) return lerp(keys[i - 1][1], keys[i][1], smooth((t - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0])));
  return keys[keys.length - 1][1];
}
const hash = (n) => { const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
const slideMin = (r) => (r.t > 0 ? -SLIDE_IN : -SLIDE_OUT);
const slideMax = (r) => (r.t > 0 ? SLIDE_OUT : SLIDE_IN);

// figure boxes in the rod's frame for a team A man facing +X: [x0, x1, y0, y1, z0, z1] (team B mirrors x)
const FIG = [
  [-1.2, 1.2, -1.95, 1.95, -2.2, 3.2],
  [-0.75, 0.75, -2.85, 2.85, -1.6, 2.9],
  [-1.2, 1.2, -1.75, 1.75, -4.3, -2.3],
  [-0.6, 0.6, -1.5, 1.5, -7, -4.2],
  [-0.65, 1.35, -1.55, 1.55, -8, -7.2],
  [-1.85, 1.85, -1.85, 1.85, 2.75, 6.6],
];
/** How deep the ball (centre b) sinks into rod r's figures at slide s and feet-forward angle a (> 0: overlap). */
export function overlap(r, s, a, b) {
  const ry = (-r.dir * a * Math.PI) / 180;
  let worst = -Infinity;
  for (const m of r.men) {
    const d = [b[0] - r.x, b[1] - (m + s), b[2] - ROD_Z];
    // into the rod's frame: inverse of rotate([0, ry, 0])
    let lx = d[0] * Math.cos(ry) - d[2] * Math.sin(ry);
    const lz = d[0] * Math.sin(ry) + d[2] * Math.cos(ry);
    if (r.dir < 0) lx = -lx;
    for (const [x0, x1, y0, y1, z0, z1] of FIG) {
      const dx = Math.max(x0 - lx, 0, lx - x1);
      const dy = Math.max(y0 - d[1], 0, d[1] - y1);
      const dz = Math.max(z0 - lz, 0, lz - z1);
      worst = Math.max(worst, BALL_R - Math.hypot(dx, dy, dz));
    }
  }
  return worst;
}

/** Moves each kick waypoint's y to the nearest spot one of the rod's men can reach (the slide range is short). */
function reachable(path) {
  return path.map((w) => {
    if (w[3] < 0) return w;
    const r = RODS[w[3]];
    let y = w[2];
    let d = Infinity;
    for (const m of r.men) {
      const c = m + clamp(w[2] - m, slideMin(r), slideMax(r));
      if (Math.abs(c - w[2]) < d) { d = Math.abs(c - w[2]); y = c; }
    }
    // the ball meets the foot mid-swing (about 20 deg forward): 5.5 from the rod on the side it is played from
    return [w[0], r.x + Math.sign(w[1] - r.x) * CONTACT, y, ...w.slice(3)];
  });
}

// ---- the match engine -------------------------------------------------------------------------------------------

/**
 * Builds a clip's simulation. `path`: [[t, x, y, rod | -1, kind?], …] ball waypoints (kind 'slam' = a big wind-up
 * shot). `opts.loop` wraps events around the loop; `opts.ball(t)` overrides the ball after the path (goal, reset);
 * `opts.extra(t, i)` adds a feet-forward angle per rod (celebration twirls).
 */
function match(seconds, rawPath, opts = {}) {
  const path = reachable(rawPath);
  const loop = !!opts.loop;
  const wrap = (dt) => (loop ? dt - seconds * Math.round(dt / seconds) : dt);
  const events = path.filter((w) => w[3] >= 0).map(([t, x, y, i, kind]) => {
    const r = RODS[i];
    // the man nearest the ball within the slide range takes it
    let best = null;
    for (const m of r.men) {
      const s = y - m;
      if (s >= slideMin(r) - 1e-6 && s <= slideMax(r) + 1e-6 && (best === null || Math.abs(s) < Math.abs(best))) best = s;
    }
    if (best === null) throw new Error(`rod ${r.name} cannot reach y ${y} at t ${t}`);
    return { t, i, s: best, kind: kind ?? 'kick' };
  });
  const ballPath = (t) => {
    const T = loop ? ((t % seconds) + seconds) % seconds : t;
    for (let k = 1; k < path.length; k++) {
      if (T <= path[k][0]) {
        const [t0, x0, y0] = path[k - 1];
        const [t1, x1, y1] = path[k];
        const f = (T - t0) / (t1 - t0);
        return [lerp(x0, x1, f), lerp(y0, y1, f), BALL_Z, 1];
      }
    }
    const last = path[path.length - 1];
    return [last[1], last[2], BALL_Z, 1];
  };
  const ball = (t) => opts.ball?.(t) ?? ballPath(t);

  // per rod: drift (whole cycles per loop), event slides and kick swings
  const nCyc = (k) => (loop ? Math.max(1, Math.round(k * seconds)) / seconds : k);
  const drift = RODS.map((r, i) => {
    const f1 = nCyc(0.55 + 0.3 * hash(i + 1));
    const f2 = nCyc(1.3 + 0.6 * hash(i + 7));
    const p1 = hash(i + 3);
    const p2 = hash(i + 11);
    const mid = (slideMin(r) + slideMax(r)) / 2;
    const amp = (slideMax(r) - slideMin(r)) / 2;
    return {
      s: (t) => mid + amp * (0.55 * Math.sin(TAU * (f1 * t + p1)) + 0.3 * Math.sin(TAU * (f2 * t + p2))),
      a: (t) => 7 * Math.sin(TAU * (nCyc(2.2 + hash(i + 5)) * t + p2)) + 4 * Math.sin(TAU * (nCyc(5.1) * t + p1)),
    };
  });
  const slideOf = (i, t) => {
    let s = drift[i].s(t);
    for (const e of events) {
      if (e.i !== i) continue;
      const dt = wrap(t - e.t);
      const w = smooth((dt + 0.3) / 0.16) * (1 - smooth((dt - 0.06) / 0.2));
      s = lerp(s, e.s, w);
    }
    return clamp(s, slideMin(RODS[i]), slideMax(RODS[i]));
  };
  const kickOf = (i, t) => {
    let a = 0;
    for (const e of events) {
      if (e.i !== i) continue;
      const dt = wrap(t - e.t);
      if (dt < -0.4 || dt > 0.6) continue;
      a += e.kind === 'slam'
        ? K(dt, [[-0.4, 0], [-0.22, -110], [-0.04, -110], [0.03, 60], [0.12, 150], [0.4, 360]])
        : e.kind === 'spin'
          ? K(dt, [[-0.14, 0], [-0.05, -45], [0.04, 70], [0.3, 360]])
          : K(dt, [[-0.14, 0], [-0.05, -45], [0.05, 80], [0.17, 55], [0.36, 0]]);
    }
    return a;
  };
  const twirls = opts.twirls ?? [];
  const twirlOf = (i, t) => {
    let a = 0;
    for (const [tw, j, turns = 1, len = 0.32] of twirls) {
      if (j !== i) continue;
      const dt = wrap(t - tw);
      if (dt > -0.05 && dt < len + 0.05) a += 360 * turns * smooth(dt / len);
    }
    return a;
  };
  const base = (i, t) => drift[i].a(t) + kickOf(i, t) + twirlOf(i, t) + (opts.extra?.(t, i) ?? 0);
  const near = (i, t) => events.some((e) => e.i === i && Math.abs(wrap(t - e.t)) < 0.1);

  // lifts: wherever the ball would run through a man of a rod that is not playing it, that rod lifts its feet
  const lifts = RODS.map(() => []);
  /** The strongest lift window at t: [weight, the lifted angle (men horizontal, chosen when the lift began)]. */
  const liftAt = (i, t) => {
    let best = [0, 0];
    for (const [t0, t1, L] of lifts[i]) {
      const a = wrap(t - t0);
      const b = wrap(t - t1);
      if (a > -0.2 && b < 0.2) {
        const w = smooth((a + 0.14) / 0.1) * (1 - smooth((b - 0.03) / 0.14));
        if (w > best[0]) best = [w, L];
      }
    }
    return best;
  };
  const angleOf = (i, t) => {
    const [w, L] = liftAt(i, t);
    const b = base(i, t);
    return w === 0 ? b : lerp(b, L + 360 * Math.round((b - L) / 360), w);
  };
  const liftAngle = (i, t) => { const b = base(i, t); return [90, -90].map((v) => v + 360 * Math.round((b - v) / 360)).sort((p, q) => Math.abs(p - b) - Math.abs(q - b))[0]; };
  const DT = 1 / 120;
  const N = Math.round(seconds / DT);
  for (let pass = 0; pass < 3; pass++) {
    let added = 0;
    for (let i = 0; i < RODS.length; i++) {
      let open = null;
      for (let k = 0; k <= N; k++) {
        const t = k * DT;
        const b = ball(t);
        const hit = b[3] > 0.5 && !near(i, t) && Math.abs(b[0] - RODS[i].x) < 11 && overlap(RODS[i], slideOf(i, t), angleOf(i, t), b) > -0.25;
        if (hit && open === null) open = t;
        if ((!hit || k === N) && open !== null) { lifts[i].push([open, t, liftAngle(i, open - 0.1)]); open = null; added++; }
      }
    }
    if (added === 0) break;
  }

  return {
    seconds,
    state: (t) => ({ ball: ball(t), rods: RODS.map((r, i) => ({ s: slideOf(i, t), a: angleOf(i, t) })) }),
    events,
    lifts,
  };
}

// ---- the clips --------------------------------------------------------------------------------------------------

// idle: a frantic loop, 3.6 s. B's midfield fires at A's goal, the keeper saves, B's attack shoots twice, A clears
// through midfield, A's attack shoots twice at B's keeper, B clears back to A's midfield.
const IDLE_PATH = [
  [0.0, -6.5, 6, AM],
  [0.18, 6.5, 20, BM],
  [0.5, -66.5, 3, AG],
  [0.68, -33.5, -14, BA],
  [0.8, -56, -38.2, -1],
  [0.94, -66.5, -6, AG],
  [1.12, -33.5, 18, BA],
  [1.24, -46.5, 23, AD],
  [1.52, 6.5, -8, BM],
  [1.66, -6.5, -20, AM, 'spin'],
  [1.94, 46.5, 10, BD],
  [2.08, 33.5, 0, AA],
  [2.24, 66.5, -5, BG],
  [2.4, 48, -38.2, -1],
  [2.54, 33.5, -26, AA, 'spin'],
  [2.72, 66.5, 5, BG],
  [2.88, 40, 38.2, -1],
  [3.6, -6.5, 6, AM],
];
const IDLE_TWIRLS = [[0.62, AA], [0.9, BM, 2, 0.4], [1.9, BA], [2.3, AD], [2.6, AM], [3.0, AG], [0.25, BD], [1.45, BG]];
const idleSim = match(3.6, IDLE_PATH, { loop: true, twirls: IDLE_TWIRLS });

/** A goal clip: `path` up to the shot, then the ball runs into the goal at x = side * 92, sinks, vanishes, and drops
 * back in at the centre at `back`, rolling to the idle's first waypoint by the end. */
function goalSim(seconds, path, side, tGoal, back, scorers) {
  const [tl, xl, yl] = path[path.length - 1];
  const start = reachable(IDLE_PATH)[0];
  const ballAfter = (t) => {
    if (t <= tl) return undefined;
    if (t < tGoal) { const f = (t - tl) / (tGoal - tl); return [lerp(xl, side * 87, f), lerp(yl, yl * 0.8, f), BALL_Z, 1]; }
    if (t < tGoal + 0.12) { const f = (t - tGoal) / 0.12; return [side * lerp(87, 92.5, f), yl * 0.8, BALL_Z - 6 * f * f, 1]; }
    if (t < back) return [side * 92.5, yl * 0.8, BALL_Z - 7, 1e-4];
    // dropped in from above the centre spot, a bounce, then a roll to the kick-off spot
    const d = t - back;
    if (d < 0.32) return [0, 0, BALL_Z + 14 * (1 - (d / 0.32) ** 2), d < 0.02 ? 1e-4 : 1];
    if (d < 0.5) return [0, 0, BALL_Z + 2.2 * Math.sin(Math.PI * (d - 0.32) / 0.18), 1];
    const f = smooth((t - back - 0.5) / (seconds - back - 0.5));
    return [lerp(0, start[1], f), lerp(0, start[2], f), BALL_Z, 1];
  };
  const extra = (t, i) => {
    if (t < tGoal + 0.05 || t > back + 0.3) return 0;
    // the scoring side twirls its rods, the conceding side slumps them back
    const u = (t - tGoal - 0.05) / (back + 0.3 - tGoal - 0.05);
    const env = Math.sin(Math.PI * clamp(u, 0, 1));
    return scorers.includes(RODS[i].t) ? 720 * smooth(u) : -35 * env;
  };
  return match(seconds, path, { ball: ballAfter, extra });
}

// idle_goal: team A (red) scores into B's goal (+X). A's attack slams it past B's keeper, who dives the wrong way.
const goalA = goalSim(3.2, [
  [0.0, -6.5, 6, AM],
  [0.3, 46.5, 11, BD],
  [0.44, 33.5, 2, AA, 'slam'],
], 1, 0.6, 1.75, [-1]);
// cheer: team B (blue) scores into A's goal (-X): B's midfield blocks, B's attack hammers it home.
const goalB = goalSim(3.0, [
  [0.0, -6.5, 6, AM],
  [0.18, 6.5, -12, BM],
  [0.36, -33.5, -2, BA, 'slam'],
], -1, 0.56, 1.6, [1]);

const sims = { idle: idleSim, idle_goal: goalA, cheer: goalB };

/** The simulated state of a clip at t (for checks): ball [x, y, z, scale], rods [{ s, a }]. */
export function state(clip, t) { return blendState(clip, t); }
export { RODS, IX, IY, BALL_R, BALL_Z, SLIDE_IN, SLIDE_OUT, FIG_HALF_Y, sims };

/** Goal clips start and end on the idle's first frame: blended over 0.25 s at each end. */
function blendState(clip, t) {
  const sim = sims[clip];
  const st = sim.state(t);
  if (clip === 'idle') return st;
  const i0 = idleSim.state(0);
  const w = Math.max(1 - smooth(t / 0.25), smooth((t - (sim.seconds - 0.3)) / 0.3));
  if (w <= 0) return st;
  const ang = (a, b) => { const d = ((((b - a) % 360) + 540) % 360) - 180; return a + d * w; };
  return {
    ball: st.ball.map((v, k) => (k === 3 ? v : lerp(v, i0.ball[k], w))),
    rods: st.rods.map((r, i) => ({ s: lerp(r.s, i0.rods[i].s, w), a: ang(r.a, i0.rods[i].a) })),
  };
}

function scorePose(clip, t) {
  const sim = sims[clip];
  if (clip === 'idle') return {};
  const joint = clip === 'idle_goal' ? 'score_red' : 'score_blue';
  const tGoal = clip === 'idle_goal' ? 0.6 : 0.56;
  const k = K(t, [[tGoal + 0.25, 0], [tGoal + 0.55, 1], [sim.seconds - 0.4, 1], [sim.seconds, 0]]);
  return { [joint]: { p: [0, (SCORE_TO - SCORE_Y) * k, 0] } };
}

function pose(clip) {
  return (t) => {
    const st = blendState(clip, t);
    const out = {};
    RODS.forEach((r, i) => { out[r.name] = { r: [0, -r.dir * st.rods[i].a, 0], p: [0, st.rods[i].s, 0] }; });
    const [x, y, z, s] = st.ball;
    out.ball = { p: [x, y, z - BALL_Z], s };
    out.score_red = { p: [0, 0, 0] };
    out.score_blue = { p: [0, 0, 0] };
    return { ...out, ...scorePose(clip, t) };
  };
}

const clips = Object.fromEntries(Object.entries(sims).map(([name, sim]) => [name, { seconds: sim.seconds, pose: pose(name) }]));

export default {
  frame: { height: 95.6, minZ: 0 },
  joints,
  assign,
  clips,
};
