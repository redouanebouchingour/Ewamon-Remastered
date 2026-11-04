// Hollowolf: a lean navy-black wolf standing on two digitigrade legs, hollowmane's pre-evolution.
// Checklist (front sheet, x = sheet x, z up; 40 tall):
//   head    z 23..31, x -9.3..0, turned to the viewer's left (scad: yaw -30, towards -X); long deep muzzle, black nose
//           at (-9.2, 25); a black blindfold band over the brow (z 26.5..29.5 at the front, rising to the back)
//   eyes    a glowing cyan almond in the band at (-4, 27.2), outer corner up, a sly narrow look; the far eye hidden
//   mouth   a smug grin: a dark line from under the nose rising back up the cheek, a white row of teeth in it
//   ears    two long dark pointed ears swept back and up out of the mane, lilac-grey inside, tips at (5, 38.8), (3, 38.6)
//   mane    white crown + lilac back: wild locks fanning up (z 40) and out both sides (x -12..11), a cascade down the
//           back to z 14 (the back art is mostly mane, lilac with white streaks)
//   collar  a tall purple scarf round the neck z 18..24 with a ragged hem, a red gem at (-3.5, 18.6); under it a
//           blue-navy chest ruff to z 12.5
//   arms    navy; the near (+X) hand on the hip (claws at (4, 14.5)); the far (-X) raised, palm open, four claws fanned
//           up at (-15.5..-11, 22..25.5); a fur tuft at each elbow
//   orbs    red (-16.9, 19.9), a purple vortex (-13.5, 16.5), a glowing blue (-10.2, 13) by the raised hand
//   legs    black-navy digitigrade, wide stance: near paw x 5..10, far paw x -10..-5, pale claws
//   tail    a big bushy dark brush from the hip along the ground (z 4..12) to x 18, curling up into a white flame tip
//           with blue at its root (x 11..17, z 14..23)
include <lib.scad>

fur = [0.18, 0.18, 0.32];        // arms, chest
legC = [0.09, 0.09, 0.18];       // hips, legs (the black navy)
headC = [0.26, 0.27, 0.41];
muzzleC = [0.37, 0.38, 0.51];
mask = [0.06, 0.06, 0.13];
nose = [0.05, 0.05, 0.1];
teeth = [0.92, 0.93, 0.96];
earIn = [0.6, 0.6, 0.73];
white = [0.94, 0.95, 0.99];
pale = [0.8, 0.82, 0.91];
lilac = [0.62, 0.63, 0.77];
collar = [0.27, 0.26, 0.47];
collarDk = [0.2, 0.19, 0.37];
ruff = [0.2, 0.23, 0.4];
ruffHi = [0.22, 0.29, 0.52];
gem = [0.55, 0.1, 0.22, NOGLOW];
claw = [0.66, 0.67, 0.8];
tailC = [0.12, 0.13, 0.22];
tailDk = [0.08, 0.08, 0.16];
tailBlue = [0.24, 0.5, 0.81, NOGLOW];
orbRed = [0.42, 0.06, 0.16, NOGLOW];
orbRedHi = [0.62, 0.14, 0.28, NOGLOW];
orbVoid = [0.42, 0.3, 0.72, NOGLOW];
orbCore = [0.05, 0.03, 0.12];
orbBlue = [0.2, 0.52, 0.95, GLOW];
orbBlueHi = [0.62, 0.86, 1, GLOW];
eyeIris = [0.35, 0.88, 1, GLOW];
eyeRim = [0.1, 0.45, 0.95, GLOW];

module e(r, p, c, fn = 16) { color(c) translate(p) scale(r) sphere(1, $fn = fn); }
// A soft lock of fur: two flattened lobes p0 -> p1 -> p2, w wide, half as thick, blunt-tipped. Its flat face turns
// to the front and back (the depth axis), so a lock fanning out sideways shows its breadth, not a spike's edge.
function nrm(v) = v / norm(v);
module orient(d) {
  z = nrm(d);
  y = nrm(cross(z, abs(z[1]) > 0.85 ? [1, 0, 0] : [0, 1, 0]));
  x = cross(y, z);
  multmatrix([[x[0], y[0], z[0], 0], [x[1], y[1], z[1], 0], [x[2], y[2], z[2], 0], [0, 0, 0, 1]]) children();
}
module lseg(a, b, wa, wb, c) {
  d = b - a;
  color(c) hull() {
    translate(a) orient(d) scale([wa * 0.5, wa, wa * 0.6]) sphere(1, $fn = 10);
    translate(b) orient(d) scale([wb * 0.5, wb, wb * 0.6]) sphere(1, $fn = 8);
  }
}
module lock(p0, p1, p2, w, c) { lseg(p0, p1, w, w * 0.75, c); lseg(p1, p2, w * 0.75, 0.45, c); }
// A short single lobe (ruff hems, tail fluff): from p along d, w wide.
module lobe(p, d, w, c) { lseg(p, p + d, w, 0.4, c); }
// A long flat lock (mane, tail flame): a tapered plate p0 -> p1 -> p2, w wide and 0.38 w thick, its flat face turned to
// the normal n (sideways for the mane, so the locks stack like a swept-back wedge).
module nframe(d, n) {
  z = nrm(d);
  x = nrm(n - (n * z) * z);
  y = cross(z, x);
  multmatrix([[x[0], y[0], z[0], 0], [x[1], y[1], z[1], 0], [x[2], y[2], z[2], 0], [0, 0, 0, 1]]) children();
}
module pseg(a, b, wa, wb, n, c) {
  d = b - a;
  color(c) hull() {
    translate(a) nframe(d, n) scale([wa * 0.38, wa, wa * 0.55]) sphere(1, $fn = 16);
    translate(b) nframe(d, n) scale([wb * 0.38, wb, wb * 0.55]) sphere(1, $fn = 10);
  }
}
module plock(p0, p1, p2, w, n, c) { pseg(p0, p1, w, w * 0.8, n, c); pseg(p1, p2, w * 0.8, 0.5, n, c); }
// The swept mane's locks from [root, azimuth (from +Y towards +X), elevation, length, width, colour, arch].
function sweepD(az, el) = [sin(az) * cos(el), cos(az) * cos(el), sin(el)];
function sweepPts(r, az, el, L, arch) = [r, r + sweepD(az, el) * L * 0.5 + [0, 0, arch], r + sweepD(az, el) * L];

// ---- Torso: a short chest over a narrow waist, black-navy hips.
e([4.6, 4.0, 3.0], [0, 1, 11.6], legC, 24);
e([4.4, 3.8, 3.4], [0, 0, 14], fur, 24);
e([5.3, 4.3, 3.6], [0, -1.5, 17.8], fur, 24);
limb([0, -1.5, 19], [-0.8, -3.5, 24], 2.8, 2.4, fur);

// ---- Legs: digitigrade, wide stance (the far leg steps out). hip, knee, hock, paw, toe direction.
LEGS = [
  [[3.4, 1, 11], [7.4, -2.2, 6.8], [8.2, 1.2, 3.4], [8.8, -1.4, 1.0], [0.3, -1]],
  [[-3.4, 1, 11], [-7.6, -1.6, 7.4], [-8.4, 1.4, 3.4], [-8.9, -1.2, 1.0], [-0.3, -1]],
];
for (l = LEGS) {
  limb(l[0], l[1], 2.7, 2.3, legC);
  limb(l[1], l[2], 2.2, 1.6, legC);
  limb(l[2], l[3], 1.6, 1.4, legC);
  t = l[4];
  color(legC) translate(l[3] + [0, 0, 0.3]) rotate([0, 0, atan2(t[0], -t[1])]) scale([2.1, 3.2, 1.3]) sphere(1, $fn = 18);
  for (k = [-1, 0, 1]) {
    s = [-t[1], t[0], 0] * 1.2 * k;
    spike(l[3] + t * 2.8 + s + [0, 0, 0], t * 1.6 + [0, 0, -0.7] + s * 0.25, 0.5, 0.05, claw);
  }
}

// ---- Collar: a tall purple scarf round the neck with a fold down its front, a ragged hem over the chest, the red
// gem; a blue-navy ruff below. The hem lobes swing a little sideways, alternately, so the edge reads torn, not scalloped.
module scarf(g = 0) {
  hull() {
    translate([-0.8, -3.4, 25]) scale([3.2, 3.2, 0.9] + [g, g, g]) sphere(1, $fn = 24);
    translate([0, -2.2, 19.6]) scale([5.1, 4.5, 1.4] + [g, g, g]) sphere(1, $fn = 24);
  }
}
color(collar) scarf();
color(collarDk) intersection() {
  scarf(0.15);
  translate([0, -2.2, 0]) rotate([0, 0, 25]) translate([0, -4, 22]) cube([0.35, 4, 7], center = true);
}
module hem(ring, l, w, swing, ca, cb) {
  for (i = [0 : len(ring) - 1]) let(a = ring[i][0], t = (i % 2 == 0 ? 1 : -1) * swing)
    color(i % 2 == 0 ? ca : cb) lseg(ring[i][1], ring[i][1] + [sin(a) + t * cos(a), -cos(a) + t * sin(a), -l[i]], w, 0.18, i % 2 == 0 ? ca : cb);
}
HEM = [for (a = [-130 : 26 : 130]) [a, [4.7 * sin(a), -2.2 - 4.1 * cos(a), 19.6]]];
HEM_L = [3.2, 4.2, 3.0, 4.6, 3.4, 4.4, 3.1, 4.5, 3.3, 4.0, 3.0];
hem(HEM, HEM_L, 2.4, 0.8, collar, collarDk);
CHEST = [for (a = [-110 : 22 : 110]) [a, [4.6 * sin(a), -1.5 - 3.8 * cos(a), 16.0]]];
CHEST_L = [2.8, 3.6, 3.0, 3.8, 3.2, 3.9, 3.1, 3.7, 2.9, 3.5, 2.8];
hem(CHEST, CHEST_L, 2.3, 0.7, ruff, ruffHi);
e([1.0, 0.7, 1.0], [0, -7.0, 18.9], gem, 14);

// ---- Arms. Near (+X): hand on the hip. Far (-X): raised, palm open, claws fanned.
SN = [4.6, -1.5, 21]; EN = [8.4, 0.5, 17.5]; WN = [6.0, -1.8, 14.8];
e([2.2, 2.2, 2.2], SN, fur);
limb(SN, EN, 2.0, 1.6, fur);
limb(EN, WN, 1.6, 1.3, fur);
e([1.5, 1.3, 1.6], [5.4, -2.3, 14.2], fur);
for (k = [-1, 0, 1]) spike([5.0 + 0.7 * k, -3.2, 13.6], [-0.3 + 0.2 * k, -0.5, -1.4], 0.32, 0.05, claw);
lobe(EN + [0.6, 0.6, -0.4], [1.2, 1.0, -2.2], 1.4, fur);

SF = [-4.2, -1.6, 20.6]; EF = [-8.6, -2.5, 15.8]; WF = [-12.2, -3.5, 20.8];
PALM = [-12.8, -3.6, 22];
e([1.9, 1.9, 1.9], SF, fur);
limb(SF, EF, 1.8, 1.6, fur);
limb(EF, WF, 1.6, 1.25, fur);
e([1.6, 1.1, 1.8], PALM, fur);
FINGERS = [[[-14, -3.6, 22], [-15.8, -3.8, 22.8]], [[-13.8, -3.6, 23], [-15.1, -3.8, 24.8]],
           [[-13, -3.6, 23.5], [-13.3, -3.8, 25.6]], [[-11.8, -3.6, 22.5], [-10.9, -3.8, 24.4]]];
for (f = FINGERS) {
  m = f[0] + (f[1] - f[0]) * 0.5;
  limb(f[0], m, 0.55, 0.45, fur);
  spike(m, (f[1] - m) * 1.25, 0.4, 0.05, claw);
}
lobe(EF + [-0.4, 0.4, -0.6], [-0.6, 1.2, -2.4], 1.4, fur);

// ---- Orbs by the raised hand: red, a purple vortex, a glowing blue one.
e([1.4, 1.4, 1.4], [-16.6, -5, 19.9], orbRed);
e([0.75, 0.55, 0.75], [-16.6, -6.2, 20.1], orbRedHi, 12);
color(orbVoid) translate([-12.7, -5, 16.5]) rotate([0, 0, 30]) scale([1.7, 0.5, 1.7]) sphere(1, $fn = 20);
color(orbVoid) translate([-12.7, -5, 16.5]) rotate([0, 0, 30]) rotate([0, 35, 0]) scale([2.3, 0.25, 0.5]) sphere(1, $fn = 12);
e([0.75, 0.75, 0.75], [-12.7, -5.2, 16.5], orbCore, 12);
e([1.3, 1.3, 1.3], [-8.9, -5, 13], orbBlue);
e([0.6, 0.5, 0.6], [-9.0, -6.1, 13.2], orbBlueHi, 10);

// ---- Head, in its own frame: centre HC, turned HEAD_YAW (muzzle towards -X, the viewer's left).
HC = [-1.3, -4.5, 27.3];
HEAD_YAW = -30;
module headAt() { translate(HC) rotate([0, 0, HEAD_YAW]) children(); }
module skull(g = 0) {
  translate([0, 1.0, 0.6]) scale([3.2, 3.6, 3.3] + [g, g, g]) sphere(1, $fn = 24);
  hull() {
    translate([0, -2.5, 0.6]) scale([2.6, 2.6, 2.2] + [g, g, g]) sphere(1, $fn = 20);
    translate([0, -4.8, 0.4]) scale([1.8, 1.6, 1.6] + [g, g, g]) sphere(1, $fn = 16);
  }
}
module snout(g = 0) {
  hull() {
    translate([0, -3, -1.5]) scale([2.2, 2.4, 1.8] + [g, g, g]) sphere(1, $fn = 20);
    translate([0, -5.8, -1.9]) scale([1.3, 1.3, 1.2] + [g, g, g]) sphere(1, $fn = 16);
  }
  hull() {
    translate([0, -2, -3.0]) scale([1.9, 2.2, 1.1] + [g, g, g]) sphere(1, $fn = 16);
    translate([0, -5.2, -2.9]) scale([0.9, 1.0, 0.6] + [g, g, g]) sphere(1, $fn = 12);
  }
}
// A stroke along the head's side through (y, z) points: a hull of rods across the head, cut to a shell later.
module stroke(pts, r) { for (i = [0 : len(pts) - 2]) hull() for (q = [pts[i], pts[i + 1]]) translate([0, q[0], q[1]]) rotate([0, 90, 0]) cylinder(h = 8, r = r, center = true, $fn = 8); }
MOUTH = [[-6.0, -2.75], [-3.2, -2.35], [-0.8, -1.0]];
TEETH = [[-4.9, -2.75], [-2.8, -2.32]];
EAR = [[1.8, 1.8, 2.6], [1.1, 6.6, 6.6]];   // base (head frame) and direction, the right one mirrored
EYE = [2.45, -2.3, -0.1];
headAt() {
  color(headC) skull();
  color(muzzleC) snout();
  e([0.75, 0.6, 0.55], [0, -6.6, -1.75], nose, 12);
  // the blindfold: a band of the skull, rising towards the back
  color(mask) intersection() {
    skull(0.22);
    translate([0, -1, 1.5]) rotate([14, 0, 0]) cube([20, 30, 2.8], center = true);
  }
  // the smug grin: white teeth under a dark line rising up the cheek
  color(teeth) intersection() { snout(0.2); stroke(TEETH, 0.24); }
  color(nose) intersection() { snout(0.14); stroke(MOUTH, 0.24); }
  // eyes: glowing cyan almonds, outer corner up, hooded by the band
  for (s = [1, -1])
    eye([EYE[0] * s, EYE[1], EYE[2]], 1.0, iris = eyeIris, sclera = eyeRim, pupil = eyeIris, yaw = 40 * s,
        lid = 0.36, lid_tilt = 32, lid_c = mask, squint = 0.28, shine = true);
  // long ears swept back and up
  for (s = [1, -1]) {
    b = [EAR[0][0] * s, EAR[0][1], EAR[0][2]];
    d = [EAR[1][0] * s, EAR[1][1], EAR[1][2]];
    color(headC) hull() {
      translate(b) rotate(_dir_rot(d)) scale([1.3, 2.4, 1.5]) sphere(1, $fn = 14);
      translate(b + d) sphere(0.2, $fn = 6);
    }
    color(earIn) hull() {
      translate(b + d * 0.12 + [0.3 * s, -1.2, 0]) rotate(_dir_rot(d)) scale([0.6, 1.5, 0.9]) sphere(1, $fn = 10);
      translate(b + d * 0.8 + [0.1 * s, -0.25, 0]) sphere(0.12, $fn = 6);
    }
  }
}

// ---- Mane: long flat locks streaming up and back from the crown to the upper right, white on top, lilac below and
// longest at the back, so head and mane make a wedge leaning back. A small crown and a lilac back fill the gaps.
color(white) hull() {
  translate([-1, -0.5, 32.5]) scale([4.2, 4.2, 3.6]) sphere(1, $fn = 20);
  translate([-3.6, -4, 31.6]) scale([3, 3, 2.4]) sphere(1, $fn = 16);
  translate([0.3, 3, 30]) scale([5, 4.5, 4.5]) sphere(1, $fn = 20);
}
color(lilac) hull() {
  translate([0.5, 5, 25]) scale([5, 4, 4.5]) sphere(1, $fn = 20);
  translate([0.5, 6, 18.5]) scale([3.6, 3, 3.2]) sphere(1, $fn = 16);
}
MANE_ROOTS = [[-1, -2, 33.5], [-0.5, 0, 32], [0, 2.5, 29.5], [-3, -4.5, 31.5]];
// Azimuth about 60 runs along the picture plane to the right: the locks stream to the art's upper right.
MANE = [
  [0, 20, 85, 7, 4.4, 0, 0], [0, 45, 48, 8.5, 4.6, 0, 0.5], [0, 60, 34, 9.5, 4.8, 0, 0.6], [0, 60, 6, 11, 4.8, 0, 0.8],
  [0, -20, 60, 9, 4.2, 1, 0.4],
  [1, 50, 22, 9, 4.8, 1, 0.6], [1, 60, -9, 11, 5.0, 0, 0.8], [1, 70, -17, 12.5, 5.0, 1, 0.8], [1, -40, 25, 10, 4.4, 1, 0.5],
  [1, 30, 5, 12, 4.8, 0, 0.6],
  [2, 65, -29, 11.5, 4.8, 2, 0.6], [2, 55, -55, 12.5, 4.6, 2, 0.4], [2, 30, -45, 14, 4.6, 1, 0.4], [2, 0, -60, 17, 4.6, 2, 0.4],
  [2, -30, -40, 13, 4.4, 2, 0.4], [2, 80, -40, 11, 4.4, 2, 0.4],
  [3, -80, 37, 9.8, 3.8, 0, 0.3], [3, -90, 3, 7.8, 3.6, 1, 0.3], [3, -45, 68, 8.8, 4.0, 0, 0.3],
];
MANE_C = [white, pale, lilac];
MANE_L = 1.12;   // lengths and widths as listed, scaled: long narrow locks
MANE_W = 0.82;
for (m = MANE) let(q = sweepPts(MANE_ROOTS[m[0]], m[1], m[2], m[3] * MANE_L, m[6]))
  plock(q[0], q[1], q[2], m[4] * MANE_W, [cos(m[1]), -sin(m[1]), 0], MANE_C[m[5]]);

// ---- Tail: a big dark brush along the ground, curling up behind the body into a soft white flame plume with blue
// at its root (flat flame locks facing the front view).
TAIL = [[2.6, 3.5, 10.5], [6.5, 7.5, 6.8], [10.5, 9.5, 7.2], [13, 10, 11], [13.2, 9.8, 15.5]];
TAIL_R = [2.4, 3.0, 3.4, 3.1, 2.7];
chain(TAIL, TAIL_R, tailC);
FLUFF = [
  [[5.5, 7, 4.6], [0.6, 0.8, -2.4]], [[8.5, 8.6, 4.2], [0.5, 0.8, -2.4]], [[11.5, 10, 4.8], [1.2, 0.6, -2.2]],
  [[15.2, 10.2, 8.5], [1.6, 0.4, -0.8]], [[15.4, 10.2, 12], [1.6, 0.3, 0.2]],
  [[8, 11, 8], [0, 2.4, -0.6]], [[12, 12.6, 9.5], [0.5, 2.4, 0]],
];
for (i = [0 : len(FLUFF) - 1]) lobe(FLUFF[i][0], FLUFF[i][1], 2.6, i % 2 == 0 ? tailDk : tailC);
FLAME_N = [0.5, -0.866, 0];
FLAME = [
  [[13, 9.8, 14.5], [12.8, 9.8, 17.5], [12, 9.8, 19.5], 4.4, 3], [[14.4, 9.8, 14.5], [15.2, 9.8, 17], [15.6, 9.8, 18.6], 3.0, 3],
  [[13, 8.3, 14.5], [12.8, 7.9, 17.5], [12.2, 7.7, 19.2], 3.4, 3],
  [[13, 9.8, 16], [13.4, 9.8, 20.5], [11.6, 9.8, 25], 5.0, 0], [[14.4, 9.8, 15.5], [15.8, 9.8, 19], [15.4, 9.8, 22.5], 3.4, 1],
  [[11.8, 9.8, 16], [10.6, 9.8, 19.5], [9.6, 9.8, 21.5], 3.2, 1], [[13, 11.4, 16.5], [13.2, 11.8, 20.5], [12.2, 11.8, 23.5], 3.6, 0],
  [[13, 8.2, 16.5], [13, 7.9, 20], [11.8, 7.8, 23], 3.6, 0],
];
FLAME_C = [white, pale, lilac, tailBlue];
for (m = FLAME) plock(m[0], m[1], m[2], m[3], FLAME_N, FLAME_C[m[4]]);
