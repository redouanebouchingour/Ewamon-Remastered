// Flowbot's rig (rig.mjs): a robot with a monitor head, standing on its own feet. Coordinates and colours are
// scad/flowbot.scad's.
//
// Rotation cheat sheet (degrees, scad frame: Z up, the face looks along -Y, +X is Flowbot's own left):
//   rx > 0 tips a part's top forward; a hanging arm swings BACK (a forward raise is rx < 0)
//   ry > 0 tips the top towards +X; a hanging left arm (+X) lifts outwards with ry < 0 (the right arm mirrors: ry > 0)
//   rz > 0 turns the face towards +X (Flowbot's left, the camera side of a front-facing creature in game)
// `both()` writes a left/right pair: the right side mirrors (ry, rz and the x offset flip).
//
// Clips: the game plays `idle` / `walk` as loops, fires a random `idle_*` fidget now and then, and plays one clip per
// battle pose (`windup`, `lunge`, `hurt`, `recoil`, `faint`, `celebrate`, `enter`, `exit`), stretched to the pose's ms.

// ---- the scad's own geometry ----------------------------------------------------------------------------------

/** A point in the monitor head's frame (translate([0, -0.5, 32.5]) rotate([-14, 0, 0]) in the scad) -> world. */
function headPt([x, y, z]) {
  const a = (-14 * Math.PI) / 180;
  return [x, -0.5 + y * Math.cos(a) - z * Math.sin(a), 32.5 + y * Math.sin(a) + z * Math.cos(a)];
}

/** World -> the head's frame. */
function headLocal([x, y, z]) {
  const a = (14 * Math.PI) / 180;
  const yy = y + 0.5;
  const zz = z - 32.5;
  return [x, yy * Math.cos(a) - zz * Math.sin(a), yy * Math.sin(a) + zz * Math.cos(a)];
}

const near = (rgb, c, tol = 0.06) => Math.abs(rgb[0] - c[0]) < tol && Math.abs(rgb[1] - c[1]) < tol && Math.abs(rgb[2] - c[2]) < tol;
const BOLT = [1, 0.92, 0.1];
const INK = [0.1, 0.1, 0.15];
const BUBBLE = [0.72, 0.7, 1];
const EYE_Y = -3.45;   // the dot eyes' centre plane in the head frame

const joints = [
  // the root pivots at the feet; the legs hang off it (not the pelvis), so the body can sway with the feet planted
  { name: 'root', at: [0, 0, 5.4] },
  { name: 'pelvis', parent: 'root', at: [0, 0, 16] },
  { name: 'legL', parent: 'root', at: [3.3, 0, 14.6] },
  { name: 'legR', parent: 'root', at: [-3.3, 0, 14.6] },
  { name: 'torso', parent: 'pelvis', at: [0, 0, 18.2] },
  { name: 'head', parent: 'torso', at: [0, -0.5, 27.2] },
  { name: 'face', parent: 'head', at: headPt([0, -3.2, 0]), rot: [-14, 0, 0] },
  { name: 'eyes', parent: 'face', at: headPt([0, EYE_Y, 0.6]) },
  { name: 'mouth', parent: 'face', at: headPt([0, EYE_Y, -0.3]) },
  // expression eyes the scad never had (extras below), hidden until a clip shows them
  { name: 'eyesHappy', parent: 'face', at: headPt([0, EYE_Y, 0.6]), scale: 1e-4 },
  { name: 'eyesDizzy', parent: 'face', at: headPt([0, EYE_Y, 0.6]), scale: 1e-4 },
  { name: 'armL', parent: 'torso', at: [7, 0, 24.5] },
  { name: 'foreL', parent: 'armL', at: [8.7, -0.5, 17.6] },
  { name: 'handL', parent: 'foreL', at: [9.8, -1.3, 11.8] },
  { name: 'armR', parent: 'torso', at: [-7, 0, 24.5] },
  { name: 'foreR', parent: 'armR', at: [-8.7, -0.5, 17.6] },
  { name: 'handR', parent: 'foreR', at: [-9.8, -1.3, 11.8] },
  { name: 'zapL1', parent: 'torso', at: [8, 1, 27] },
  { name: 'zapL2', parent: 'torso', at: [10, 1, 19] },
  { name: 'zapL3', parent: 'pelvis', at: [11, 0.5, 13] },
  { name: 'zapR1', parent: 'torso', at: [-8, 1, 27] },
  { name: 'zapR2', parent: 'torso', at: [-10, 1, 19] },
  { name: 'zapR3', parent: 'pelvis', at: [-11, 0.5, 13] },
];

function assign(c, rgb) {
  const [x, , z] = c;
  const side = x >= 0 ? 'L' : 'R';
  if (near(rgb, BOLT)) return `zap${side}${z > 25 ? 1 : z > 16 ? 2 : 3}`;
  const h = headLocal(c);
  if (Math.abs(h[0]) < 7.6 && Math.abs(h[2]) < 5.4 && h[2] > -5.15 && h[1] > -3.8 && h[1] < 4.6) {
    if (near(rgb, INK)) return h[2] > -0.1 ? 'eyes' : 'mouth';
    if (near(rgb, BUBBLE)) return 'face';
    return 'head';
  }
  const ax = Math.abs(x);
  const shoulder = Math.hypot((ax - 7) / 2.4, c[1] / 2.4, (z - 24.5) / 2.2) <= 1.06;
  if ((ax >= 6 && z > 9 && z < 27.6) || shoulder) return `${z > 17.9 ? 'arm' : z > 11.9 ? 'fore' : 'hand'}${side}`;
  if (z < 14.3 && ax > 0.5) return `leg${side}`;
  return z < 18.2 ? 'pelvis' : 'torso';
}

// ---- expression strokes: ^ ^ (happy) and x x (dizzy), ink boxes on the screen in the face's frame ----------------

const strokes = (joint, segs) => segs.map(([a, b]) => {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  return {
    joint, color: INK,
    at: [(a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2],
    size: [Math.hypot(dx, dz) + 0.34, 0.34, 0.34],
    // the box's long side along a -> b in the screen plane (x, z): rotate about the screen normal (y)
    rot: [0, (-Math.atan2(dz, dx) * 180) / Math.PI, 0],
  };
});
const happy = [];
const dizzy = [];
for (const ex of [-1.5, 1.5]) {
  happy.push([[ex - 0.75, -0.3], [ex, 0.35]], [[ex, 0.35], [ex + 0.75, -0.3]]);
  dizzy.push([[ex - 0.55, -0.55], [ex + 0.55, 0.55]], [[ex - 0.55, 0.55], [ex + 0.55, -0.55]]);
}
const extras = [...strokes('eyesHappy', happy), ...strokes('eyesDizzy', dizzy)];

// ---- animation helpers ----------------------------------------------------------------------------------------

const TAU = Math.PI * 2;
const osc = (u, cycles, phase = 0) => Math.sin(TAU * (u * cycles + phase));
const smooth = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
const mixv = (a, b, t) => (Array.isArray(a) ? a.map((v, i) => v + (b[i] - v) * t) : a + (b - a) * t);
/** Eased keyframes [[u, value], …] (numbers or arrays), held before the first and after the last. */
function K(u, keys) {
  if (u <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (u <= keys[i][0]) return mixv(keys[i - 1][1], keys[i][1], smooth((u - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0])));
  }
  return keys[keys.length - 1][1];
}
const hash = (n) => { const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
/** A window 0..1..0 between u0 and u1 with `fade` ramps. */
const win = (u, u0, u1, fade = 0.04) => Math.min(smooth((u - u0) / fade), smooth((u1 - u) / fade));
const mirror = (q) => ({
  ...q,
  ...(q.r ? { r: [q.r[0], -q.r[1], -q.r[2]] } : {}),
  ...(q.p ? { p: [-q.p[0], q.p[1], q.p[2]] } : {}),
});
const both = (name, left, right = left) => ({ [`${name}L`]: left, [`${name}R`]: mirror(right) });
const HIDE = 1e-4;
/** Eye set scales: which of the three eye sets shows (and how open), [x, y, z] in the screen's frame. */
function eyes(kind, open = 1, wide = 1) {
  const on = (k) => (k === kind ? [wide, 1, Math.max(HIDE, open)] : HIDE);
  return { eyes: { s: on('normal') }, eyesHappy: { s: on('happy') }, eyesDizzy: { s: on('dizzy') } };
}
/**
 * The six lightning bolts: each flickers on and off on its own deterministic beat (`rate` per clip second, a
 * whole number per loop keeps a loop seamless), with a jittery twist. `size` scales the lit bolts, `duty` the share lit.
 */
function zaps(t, { rate = 14, duty = 0.72, size = 1, wild = 0 } = {}) {
  const out = {};
  ['zapL1', 'zapL2', 'zapL3', 'zapR1', 'zapR2', 'zapR3'].forEach((name, i) => {
    const f = Math.floor(t * rate + i * 0.37);
    const lit = hash(f * 7.13 + i * 31.7) < duty;
    const k = size * (0.8 + 0.45 * hash(f * 3.1 + i));
    const j = 8 + wild * 30;
    out[name] = { s: lit && size > 0.01 ? k : HIDE, r: [(hash(f + i * 5.3) - 0.5) * j, (hash(f * 1.7 + i) - 0.5) * j, 0] };
  });
  return out;
}
/** The idle's breathing: the torso rises and settles on one beat in every clip, the feet stay put. */
const breathe = (t, amp = 0.18) => (Math.sin((TAU * t) / 2) * 0.5 + 0.5) * amp;

// ---- clips ----------------------------------------------------------------------------------------------------

const clips = {
  // Standing: it breathes and sways over planted feet, the monitor looks left, then right, with a blink and a double
  // blink; the arms dangle on their own beats; the bolts crackle.
  idle: {
    seconds: 4,
    pose: (t, u) => {
      const look = K(u, [[0, 0], [0.12, 0], [0.22, 16], [0.47, 16], [0.57, -13], [0.84, -13], [0.94, 0], [1, 0]]);
      const tilt = K(u, [[0, 0], [0.12, 0], [0.22, 7], [0.47, 7], [0.57, -5], [0.84, -5], [0.94, 0], [1, 0]]);
      const blink = 1 - win(u, 0.36, 0.4, 0.018) * 0.92 - win(u, 0.86, 0.885, 0.012) * 0.92 - win(u, 0.905, 0.93, 0.012) * 0.92;
      return {
        root: { r: [0.8 * osc(u, 2, 0.25), 1.2 * osc(u, 1), 0] },
        pelvis: { p: [0, 0, 0.5 * breathe(t)] },
        torso: { p: [0, 0, breathe(t)], r: [1.5 * osc(u, 2, 0.3), 2 * osc(u, 1), 3 * osc(u, 1, 0.5) + look * 0.15] },
        head: { r: [3 * osc(u, 2, 0.6), tilt, look] },
        face: { s: 1 + 0.03 * osc(u, 4) },
        ...eyes('normal', blink),
        ...both('arm', { r: [4 * osc(u, 1, 0.2), -4 - 2 * osc(u, 2), 0] }, { r: [4 * osc(u, 1, 0.7), -4 - 2 * osc(u, 2, 0.5), 0] }),
        ...both('fore', { r: [-8 - 5 * osc(u, 1, 0.3), 0, 0] }, { r: [-8 - 5 * osc(u, 1, 0.8), 0, 0] }),
        ...both('hand', { r: [-6 * osc(u, 2, 0.1), 0, 0] }, { r: [-6 * osc(u, 2, 0.6), 0, 0] }),
        ...zaps(t, { rate: 12 }),
      };
    },
  },

  // Walking: a stompy robot stride. The legs swing from the hips, the body dips so the planted foot stays on the
  // ground and rocks over it, the arms counter-swing, the monitor bobs a beat behind.
  walk: {
    seconds: 0.9,
    pose: (t, u) => {
      const swing = osc(u, 1);                               // +1: the left leg forward
      const stride = 24;
      const dip = -9.2 * (1 - Math.cos((stride * Math.abs(swing) * Math.PI) / 180));   // hip 9.2 above the soles
      return {
        root: { p: [0, 0, dip + 0.25 * Math.abs(osc(u, 2))], r: [5, -3 * swing, 0] },
        legL: { r: [-stride * swing, 0, 0] },
        legR: { r: [stride * swing, 0, 0] },
        pelvis: { r: [0, 0, 5 * swing] },
        torso: { r: [3, 2 * swing, -7 * swing] },
        head: { r: [-4 + 3 * osc(u, 2, 0.15), 1.5 * swing, 4 * swing] },
        ...eyes('normal'),
        ...both('arm', { r: [26 * swing, -6, 0] }, { r: [-26 * swing, -6, 0] }),
        ...both('fore', { r: [-20 + 12 * swing, 0, 0] }, { r: [-20 - 12 * swing, 0, 0] }),
        ...both('hand', { r: [10, 0, 0] }),
        ...zaps(t, { rate: 20, duty: 0.8 }),
      };
    },
  },

  // Fidget: turns to the camera side and waves its left arm, happy ^ ^ eyes and a bigger smile.
  idle_wave: {
    seconds: 2.6,
    pose: (t, u) => {
      const up = K(u, [[0, 0], [0.16, 1], [0.8, 1], [0.96, 0]]);
      const wave = Math.sin(TAU * 4 * ((u - 0.16) / 0.64)) * win(u, 0.16, 0.8, 0.05);
      const glad = win(u, 0.1, 0.88, 0.03);
      return {
                torso: { r: [0, 5 * up, 8 * up] },
        head: { r: [-4 * up, -6 * up + 4 * wave * up, 18 * up] },
        face: { s: 1 + 0.06 * glad },
        mouth: { s: 1 + 0.3 * glad },
        ...(glad > 0.5 ? eyes('happy', Math.min(1, (glad - 0.5) * 4)) : eyes('normal', 1 - glad * 1.6)),
        armL: { r: [-12 * up, -150 * up, 0] },
        foreL: { r: [0, (-28 + 26 * wave) * up, 0] },
        handL: { r: [0, 14 * wave * up, 0] },
        armR: { r: [3, 4 + 4 * up, 0] },
        foreR: { r: [-10, 0, 0] },
        ...zaps(t, { rate: 12, size: 1 + 0.2 * glad }),
      };
    },
  },

  // Fidget: a mechanical left-right sweep with squinted, widened eyes, then a nod and a flash of ^ ^ ("found it").
  idle_scan: {
    seconds: 2.8,
    pose: (t, u) => {
      const sweep = K(u, [[0, 0], [0.1, -34], [0.42, 34], [0.72, -20], [0.82, 0]]);
      const tick = Math.round(sweep / 6) * 6 * 0.7 + sweep * 0.3;   // ratchets in steps like a servo
      const scanning = win(u, 0.04, 0.82, 0.05);
      const found = win(u, 0.84, 1, 0.04);
      return {
                torso: { r: [0, 0, tick * 0.2] },
        head: { r: [6 * scanning - 10 * win(u, 0.82, 0.92, 0.04), 0, tick] },
        ...(found > 0.4 ? eyes('happy') : eyes('normal', 1 - 0.45 * scanning, 1 + 0.3 * scanning)),
        face: { p: [tick * 0.012, 0, 0] },
        ...both('arm', { r: [10 * scanning, -18 * scanning, 0] }),
        ...both('fore', { r: [-55 * scanning, 0, -25 * scanning] }),
        ...zaps(t, { rate: 10, duty: 0.6 - 0.3 * scanning }),
      };
    },
  },

  // Fidget: a glitch. The monitor jitters, the face image slips, the eye sets flicker, the bolts go wild; a power
  // dip with a blank screen, a reboot with an overshoot, then it shakes it off.
  idle_glitch: {
    seconds: 1.8,
    pose: (t, u) => {
      const g = win(u, 0.08, 0.48, 0.01);
      const step = Math.floor(t * 20);
      const jit = (n) => (hash(step * 3.7 + n) - 0.5) * 2 * g;
      const dip = win(u, 0.5, 0.66, 0.03);
      const boot = win(u, 0.66, 0.78, 0.02);
      const shake = u > 0.78 ? Math.sin(TAU * 3 * ((u - 0.78) / 0.22)) * (1 - (u - 0.78) / 0.22) : 0;
      const flick = hash(step * 1.3);
      const kind = g > 0.5 ? (flick < 0.33 ? 'dizzy' : flick < 0.55 ? 'happy' : 'normal') : 'normal';
      const open = dip > 0.5 ? HIDE : 1 + 0.35 * boot;
      return {
        root: { r: [0, 0, 3 * jit(1)] },
        torso: { r: [2 * jit(2), 3 * jit(3), 0] },
        head: { r: [12 * jit(4) + 16 * dip - 6 * boot, 8 * jit(5) + 10 * shake, 12 * jit(6)] },
        face: { p: [1.1 * jit(7), 0, 0.5 * jit(8)] },
        ...eyes(kind, open),
        ...both('arm', { r: [6 * jit(9), -6 - 10 * g, 0] }, { r: [6 * jit(10), -6 - 10 * g, 0] }),
        ...both('fore', { r: [-10 - 20 * dip, 0, 0] }),
        ...zaps(t, { rate: 24, duty: dip > 0.5 ? 0 : 0.9, size: 1 + 0.6 * g, wild: g }),
      };
    },
  },

  // Battle: pulls back for a punch with its right arm (twisted away, leaning back, squinting, bolts charging).
  windup: {
    seconds: 0.25,
    pose: (t, u) => {
      const w = smooth(u / 0.8);
      return {
        root: { r: [-3 * w, 0, 0] },
        pelvis: { p: [0, 0, -0.5 * w] },
        torso: { r: [-6 * w, 0, -16 * w] },
        head: { r: [4 * w, 0, 10 * w] },
        ...eyes('normal', 1 - 0.55 * w, 1 + 0.15 * w),
        armR: { r: [45 * w, 12 * w, 0] },
        foreR: { r: [-75 * w, 0, 0] },
        armL: { r: [-20 * w, -12 * w, 0] },
        foreL: { r: [-35 * w, 0, 0] },
        ...zaps(t, { rate: 30, duty: 0.9, size: 1 + 0.5 * w, wild: w }),
      };
    },
  },

  // Battle: the punch. Twists into a straight right, leans in, bolts flare at the hit (u = 0.4), recovers.
  lunge: {
    seconds: 0.3,
    pose: (t, u) => {
      const back = K(u, [[0, 0.6], [0.12, 1], [0.22, 0]]);
      const hit = K(u, [[0.12, 0], [0.4, 1], [0.62, 1], [1, 0]]);
      return {
        root: { r: [7 * hit - 3 * back, 0, 0] },
        torso: { r: [12 * hit - 6 * back, 0, 20 * hit - 16 * back] },
        head: { r: [5 * hit, 0, -12 * hit + 10 * back] },
        ...eyes('normal', 0.5, 1.15),
        armR: { r: [45 * back - 98 * hit, 12 * back - 6 * hit, 0] },
        foreR: { r: [-75 * back - 4 * hit, 0, 0] },
        handR: { s: 1 + 0.25 * hit },
        armL: { r: [-20 * back + 25 * hit, -12, 0] },
        foreL: { r: [-35 * back - 30 * hit, 0, 0] },
        ...zaps(t, { rate: 30, duty: 0.95, size: 1 + 0.8 * hit, wild: hit }),
      };
    },
  },

  // Battle: hit. The monitor snaps back, arms fly out, x x eyes, a flat mouth, the bolts cut out, a decaying shake.
  hurt: {
    seconds: 0.26,
    pose: (t, u) => {
      const k = K(u, [[0, 0], [0.18, 1], [0.6, 0.75], [1, 0.45]]);
      const shake = Math.sin(TAU * 5 * u) * (1 - u);
      return {
        root: { r: [-6 * k, 0, 4 * shake] },
        torso: { r: [-12 * k, 4 * shake, 0] },
        head: { r: [-24 * k, 8 * shake, 6 * shake] },
        ...eyes(u > 0.06 ? 'dizzy' : 'normal'),
        mouth: { s: [1.1, 1, 0.25] },
        ...both('arm', { r: [12 * k, -48 * k, 0] }, { r: [6 * k, -42 * k, 0] }),
        ...both('fore', { r: [-30 * k, 0, 0] }),
        ...both('hand', { r: [0, -20 * k, 0] }),
        ...zaps(t, { duty: u < 0.5 ? 0 : 0.5, size: 1.2 }),
      };
    },
  },

  // Battle: a smaller flinch back (a miss, a self-hit), eyes squeezed.
  recoil: {
    seconds: 0.25,
    pose: (t, u) => {
      const k = K(u, [[0, 0], [0.4, 1], [1, 0]]);
      return {
        root: { r: [-3 * k, 0, 0] },
        torso: { r: [-8 * k, 0, 0] },
        head: { r: [-10 * k, 0, 4 * k] },
        ...eyes('normal', 1 - 0.8 * k),
        ...both('arm', { r: [16 * k, -10 * k, 0] }),
        ...both('fore', { r: [-20 * k, 0, 0] }),
        ...zaps(t, { duty: 0.4 }),
      };
    },
  },

  // Battle: knocked out. A jolt with x x eyes, then it powers down: the monitor droops, arms go limp, the knees give a
  // little, the bolts spit their last sparks and the screen goes blank.
  faint: {
    seconds: 0.9,
    pose: (t, u) => {
      const jolt = win(u, 0, 0.22, 0.05);
      const down = smooth((u - 0.18) / 0.5);
      const blank = smooth((u - 0.7) / 0.12);
      return {
        root: { p: [0, 0.5 * jolt, -0.8 * down], r: [5 * down, 0, 4 * down] },
        torso: { r: [-12 * jolt + 20 * down, -6 * down, 0] },
        head: { r: [-20 * jolt + 34 * down, 14 * down, -8 * down] },
        ...eyes('dizzy', 1 - blank),
        mouth: { s: [1, 1, Math.max(HIDE, 0.3 * (1 - blank))] },
        ...both('arm', { r: [-12 * down + 10 * jolt, 10 * down - 40 * jolt, 0] }, { r: [-8 * down + 10 * jolt, 12 * down - 36 * jolt, 0] }),
        ...both('fore', { r: [-4 * down, 0, 0] }),
        ...both('hand', { r: [10 * down, 0, 0] }),
        ...zaps(t, { rate: 16, duty: u < 0.6 ? 0.5 : 0, size: 1.3 * (1 - smooth((u - 0.4) / 0.3)) }),
      };
    },
  },

  // Battle / evolution: two hops with double fist pumps, ^ ^ eyes, a big smile, bolts flaring.
  celebrate: {
    seconds: 0.6,
    pose: (t, u) => {
      const hop = Math.abs(Math.sin(TAU * u));
      const up = win(u, 0, 1, 0.15);
      const pump = Math.sin(TAU * 2 * u);
      return {
        root: { p: [0, 0, 1.8 * hop] },
        torso: { r: [-4 * hop, 0, 0] },
        head: { r: [-8 * up, 10 * pump * up, 0] },
        ...eyes('happy'),
        mouth: { s: 1.35 },
        face: { s: 1 + 0.08 * hop },
        // a V over the monitor: the upper arms high and wide, the forearms pumping outwards (never across the face)
        ...both('arm', { r: [-8 * up, -128 * up + 10 * pump, 0] }, { r: [-8 * up, -128 * up - 10 * pump, 0] }),
        ...both('fore', { r: [-10 * up, (18 + 16 * pump) * up, 0] }, { r: [-10 * up, (18 - 16 * pump) * up, 0] }),
        ...both('hand', { r: [0, 10 * up, 0] }),
        ...both('leg', { r: [-14 * hop, -6 * hop, 0] }),
        ...zaps(t, { rate: 24, duty: 0.95, size: 1.5, wild: 0.5 }),
      };
    },
  },

  // Sent out: boots up. Starts slumped with a blank screen, snaps upright, the eyes pop open with an overshoot and
  // the bolts flash on.
  enter: {
    seconds: 0.45,
    pose: (t, u) => {
      const on = smooth((u - 0.25) / 0.3);
      const pop = K(u, [[0.3, HIDE], [0.5, 1.35], [0.7, 1]]);
      return {
        pelvis: { p: [0, 0, -1 * (1 - on)] },
        torso: { r: [14 * (1 - on), 0, 0] },
        head: { r: [32 * (1 - on) - 6 * win(u, 0.45, 0.85, 0.1), 0, 0] },
        ...eyes('normal', pop),
        mouth: { s: Math.max(HIDE, Math.min(1, pop)) },
        ...both('arm', { r: [-6 * (1 - on), -30 * win(u, 0.45, 0.95, 0.12), 0] }),
        ...both('fore', { r: [-30 * win(u, 0.45, 0.95, 0.12), 0, 0] }),
        ...zaps(t, { rate: 30, duty: on > 0.3 ? 0.95 : 0, size: 1 + 0.8 * win(u, 0.5, 0.8, 0.08) }),
      };
    },
  },

  // Recalled: a quick wave with ^ ^ eyes, then the screen blinks off.
  exit: {
    seconds: 0.35,
    pose: (t, u) => {
      const up = win(u, 0, 0.8, 0.2);
      const wave = Math.sin(TAU * 2 * u);
      return {
                head: { r: [0, 0, 14 * up] },
        ...eyes('happy', 1 - smooth((u - 0.7) / 0.2)),
        armL: { r: [0, -140 * up, 0] },
        foreL: { r: [0, (-20 + 20 * wave) * up, 0] },
        ...zaps(t, { duty: 0.6 * (1 - u) }),
      };
    },
  },
};

export default {
  frame: { height: 32.72, minZ: 5.406 },
  joints,
  assign,
  extras,
  clips,
};
