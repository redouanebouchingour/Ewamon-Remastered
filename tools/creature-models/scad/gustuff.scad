// Gustuff, rebuilt from the measurement sheet (front height 40, the near front hoof on z = 0).
//
// Checklist (front sheet x, z):
// - Body plan: a fluffy cloud lamb trotting towards the viewer's left, side-on. One big woolly cloud body, sheet
//   x -15..19, z 9..32: soft merged puffs, pale lavender on top and in the chest ruff, deeper periwinkle under and
//   behind. Long along Y (chest y -17, rump y 22), so the 30 degree view halves it.
// - Head: big round woolly head over the chest, looking at the viewer: a pale face x -17.5..-3.5, z 17.5..28, a
//   wool topknot up to z 37.5 (x -15..-4), a fringe over the brow at z 27, woolly cheeks. Turned towards the camera.
// - Eyes: two open oval indigo eyes with a white glint top-left: near (-6.4, 25.1) about 2.8 x 3, far (-14, 24.7)
//   narrower. No white sclera.
// - Nose / mouth: a dark grey nose (-11, 21.3), a line down to a happy lopsided smile, z 19.5, rising on the near side
//   to (-7.3, 21.4).
// - Horns: brown ram horns coiled at the sides of the head: the near one a big coil seen nearly face-on, x -7.2..1.7,
//   z 26.8..34.2, the far one x -17.7..-14.3, z 26.8..33.
// - Ear-wings: small pale blue feather fans rising behind the horns: near x -1.5..7.2, z 27..40 (up and out to the
//   right), far x -21..-13, z 28..38.
// - Back wings: pale blue feathered wings along the back, swept back and up: near root (6, 22), tips (21, 26..31).
// - Legs, galloping: near front under the chest, hoof on the ground (-4.6, 0..4); far front reaching forward,
//   raised (-16.3, 5.4..8.7); near hind kicked back (17.5, 4..7); far hind under the belly (3.5, 6.4..8). Woolly
//   lavender legs, dark brown cloven hooves.
// - Back art: the same cloud body side-on, both wings swept back over the rump, the head at the right with the near
//   horn coil, a small cloud tail puff at the rump.
// - Glow: nothing glows.
include <lib.scad>

woolHi  = [0.87, 0.85, 0.98, NOGLOW];
woolMid = [0.75, 0.73, 0.93, NOGLOW];
woolDeep = [0.58, 0.60, 0.86];
woolLow = [0.66, 0.67, 0.90, NOGLOW];
faceC   = [0.92, 0.90, 0.99, NOGLOW];
legC    = [0.74, 0.73, 0.93, NOGLOW];
hoof    = [0.27, 0.19, 0.16];
hoofHi  = [0.36, 0.27, 0.23];
horn    = [0.55, 0.42, 0.34];
hornDk  = [0.35, 0.24, 0.17];
hornHi  = [0.74, 0.60, 0.52];
wingHi  = [0.80, 0.86, 0.98, NOGLOW];
wingMid = [0.67, 0.73, 0.92, NOGLOW];
wingDk  = [0.51, 0.54, 0.80];
eyeC    = [0.27, 0.27, 0.53];
eyeDk   = [0.13, 0.12, 0.30];
noseC   = [0.22, 0.22, 0.25];
mouthC  = [0.25, 0.15, 0.12];

// A wool puff: three flattened ellipsoids hulled into one soft lobe, stretched along the heading `a` (degrees in XY).
module puff(p, r, a, c) {
  d = [cos(a), sin(a), 0] * r * 0.45;
  color(c) hull() {
    translate(p) scale([r, r, r * 0.8]) sphere(1, $fn = 18);
    translate(p + d) scale([r * 0.75, r * 0.75, r * 0.62]) sphere(1, $fn = 14);
    translate(p - d) scale([r * 0.75, r * 0.75, r * 0.62]) sphere(1, $fn = 14);
  }
}

// ---- Body: a smooth core (two ellipsoids hulled, CF / CR) quilted with wool puffs: balls sunk into the core so
// each shows only a low soft cap OUT units proud of it. Neighbouring caps overlap, so the wool reads as merged puffs
// with a scalloped outline instead of a pile of balls.
CF = [[0, -9, 16.3], [10.5, 10.5, 8.3]];
CR = [[0, 11, 18], [10.5, 11, 9.6]];
OUT = 3;
blob([[CF[1], CF[0]], [CR[1], CR[0]]], woolDeep);   // shows only in the grooves between the puffs
SHADE = [woolHi, woolMid, woolLow];
// the ball for a puff of radius r on an end cap E, heading th (degrees from +X in XY), elevation ph
function capPt(E, th, ph, r) = let(u = [cos(ph) * cos(th), cos(ph) * sin(th), sin(ph)], k = r - OUT)
  E[0] + [(E[1][0] - k) * u[0], (E[1][1] - k) * u[1], (E[1][2] - k) * u[2]];
// the ball for a puff of radius r on the middle of the body at y, angle a round the long axis (0 = top, 90 = +X side)
function midPt(y, a, r) = let(t = (y - CF[0][1]) / (CR[0][1] - CF[0][1]), rx = 10.5 - (r - OUT),
  rz = CF[1][2] + (CR[1][2] - CF[1][2]) * t - (r - OUT), zc = CF[0][2] + (CR[0][2] - CF[0][2]) * t)
  [rx * sin(a), y, zc + rz * cos(a)];
function shadeOf(up) = up > 0.6 ? 0 : (up < -0.3 ? 2 : 1);
module woolBall(p, r, c) { color(c) translate(p) sphere(r, $fn = 16); }
// the middle: [y, angle, r] (mirrored to the far side)
MID = [[-6, 0, 5.2], [2, 0, 5.6], [9.5, 0, 5.4],
       [-3, 32, 5], [4.5, 30, 5.4], [11, 28, 5.2],
       [-6.5, 62, 5.2], [1, 60, 5], [7.5, 64, 5.4],
       [-3, 93, 5], [4, 95, 5.4], [10.5, 90, 5],
       [-6.5, 123, 4.8], [1, 125, 5.2], [8, 120, 5],
       [-2.5, 152, 4.6], [5.5, 150, 4.8]];
mirror_x() for (m = MID) woolBall(midPt(m[0], m[1], m[2]), m[2], SHADE[shadeOf(cos(m[1]))]);
// the end caps: [heading, elevation, r]; the chest ruff in front is pale
CHEST = [[-90, 0, 5.4], [-90, -38, 4.8], [-58, 22, 5], [-58, -22, 5], [-35, 50, 4.8], [-90, 32, 5], [-118, -5, 5.2]];
RUMP = [[90, 0, 5.4], [90, 36, 5.6], [90, -36, 4.8], [58, 22, 5.2], [58, -24, 5], [62, 58, 5.8], [90, 68, 4.6], [35, 45, 5.4]];
mirror_x() {
  for (e = CHEST) woolBall(capPt(CF, e[0], e[1], e[2]), e[2], e[1] < -30 ? woolMid : woolHi);
  for (e = RUMP) woolBall(capPt(CR, e[0], e[1], e[2]), e[2], SHADE[shadeOf(sin(e[1]))]);
}
// the tail: a small cloud puff high on the rump
puff([0, 22, 21.5], 3.4, 0, woolHi);

// ---- Legs, galloping: [hip, fetlock, hoof tilt]; thick woolly legs, a cloven hoof under each
module hoofAt(p, tilt = 0) {
  translate(p) rotate([tilt, 0, 0]) {
    mirror_x() ell([1.2, 1.9, 1.35], [0.75, -0.3, 0], hoof);
    ell([2.15, 2.1, 0.75], [0, 0, 0.75], hoofHi);
  }
}
LEGS = [
  [[4.5, -10, 11], [4.5, -15.5, 2.4], 0],     // near front, hoof on the ground
  [[-4.5, -11, 12], [-4.5, -23.5, 7.2], 60],  // far front, reaching forward
  [[6, 17, 11], [6.5, 22, 2.4], -12],         // near hind, back under the rump
  [[-4.5, 11, 11], [-4.5, 13.2, 3.1], 0]];    // far hind, under the belly
for (L = LEGS) {
  limb(L[0], L[1], 3.1, 2.25, legC);
  hoofAt(L[1] + [0, 0, -1.6] + (L[2] == 0 ? [0, 0, 0] : [0, L[2] > 0 ? -0.8 : 0.6, 0.3]), L[2]);
}

// ---- Head, in its own frame: centre HP, turned HY towards the camera
HP = [-1.2, -17, 22.7];
HY = 15;
EYE = [4, -4.5, 2.1];
module ramHorn() {
  // a chunky coil in the XZ plane from its root (angle 170), over the top, down and curling in to a small centre
  n = 18;
  function pt(i) = let(a = 170 - i * 400 / n, r = 3.6 - 2.6 * i / n) [r * cos(a), -0.18 * i, r * sin(a)];
  for (i = [0 : n - 1]) color(i % 3 == 2 ? hornDk : (i == 3 ? hornHi : horn)) hull() {
    translate(pt(i)) sphere(2.4 - 1.35 * i / n, $fn = 10);
    translate(pt(i + 1)) sphere(2.4 - 1.35 * (i + 1) / n, $fn = 10);
  }
}
// a feather: a hull of three flattened ellipsoids from the origin along +X in the XZ plane
module feather(len_, w, t, c) {
  color(c) hull() {
    scale([w * 0.7, t, w * 0.7]) sphere(1, $fn = 10);
    translate([len_ * 0.5, 0, 0]) scale([w, t, w]) sphere(1, $fn = 12);
    translate([len_, 0, 0]) scale([w * 0.45, t * 0.6, w * 0.45]) sphere(1, $fn = 8);
  }
}
// the ear-wing: four broad feathers fanning up and out from the root
module earWing() {
  for (k = [0 : 3]) rotate([0, -(92 - k * 15), 0]) translate([0, k % 2 == 0 ? 0 : 0.35, 0])
    feather(12 - k * 1.2, 2.4, 0.8, k % 2 == 1 ? wingMid : wingHi);
}
translate(HP) rotate([0, 0, HY]) {
  // the face: a broad round head with a soft, flat muzzle, woolly cheeks
  blob([[[7, 5.8, 6], [0, 0, 0.6]], [[4.6, 3, 3.3], [0, -3.7, -2]]], faceC);
  mirror_x() puff([5.9, -0.3, -2], 3.5, 90, woolHi);
  // the wool topknot and the fringe over the brow
  puff([0, 0.5, 9.3], 5.2, 0, woolHi);
  mirror_x() puff([4.4, 0.5, 6.5], 4.1, 90, woolHi);
  puff([0, -3.4, 6.3], 3.8, 0, woolHi);
  puff([0, 3.5, 5.5], 4.8, 0, woolMid);
  // eyes: open indigo ovals with a glint
  mirror_x() eye(EYE, 1.55, iris = eyeC, sclera = eyeC, pupil = eyeDk, yaw = 25, shine = true);
  // the nose, a soft dark triangle, and the smile
  color(noseC) hull() {
    translate([0, -6.6, -1.05]) scale([1.45, 0.7, 0.62]) sphere(1, $fn = 12);
    translate([0, -6.7, -1.95]) scale([0.45, 0.45, 0.45]) sphere(1, $fn = 10);
  }
  chain([[0, -6.7, -1.95], [0, -6.6, -3.3]], [0.2, 0.2], mouthC);
  chain([[-2.1, -6.45, -2.75], [-1.1, -6.5, -3.45], [0, -6.6, -3.55], [1.4, -6.5, -3.3], [2.5, -6.35, -2.6], [3.1, -6.1, -1.8]],
        [0.2, 0.22, 0.22, 0.22, 0.2, 0.18], mouthC);
  // the horns: coils facing out and forward
  mirror_x() translate([6.8, 2.5, 7.2]) rotate([0, 0, 38]) ramHorn();
  // the ear-wings behind the horns
  mirror_x() translate([8, 4.5, 6]) rotate([0, 0, 20]) earWing();
}

// ---- Back wings: broad feather fans swept back and up from the shoulders
module wing() {
  ANG = [40, 30, 20, 10, 0];
  LEN = [13.5, 17, 19.5, 18.5, 15.5];
  // pale coverts over the root
  for (i = [0 : 4]) rotate([0, -ANG[i], 0]) translate([0, -0.7, 0]) feather(LEN[i] * 0.5, 2.7, 0.8, wingHi);
  for (i = [0 : 4]) rotate([0, -ANG[i], 0]) translate([0, i % 2 == 0 ? 0 : 0.4, 0])
    feather(LEN[i], 2.5, 0.7, i == 4 ? wingDk : (i % 2 == 0 ? wingMid : wingHi));
}
mirror_x() translate([8.5, -6, 25]) rotate([0, 0, 68]) rotate([30, 0, 0]) wing();
