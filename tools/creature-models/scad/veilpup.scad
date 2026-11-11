// Veilpup: a chubby navy wolf pup standing on two short legs, Hollowolf's pre-evolution (same colours, same swept-lock
// mane). Sprite-match remodel (2026-11-06).
// Checklist (front sheet, x = sheet x, z up; 40 tall):
//   head    big pup head x -12.5..3, z 17.5..30, nearly frontal (scad yaw -10); grey-lavender, short muzzle, black nose
//           at (-9, 20.2); jagged cheek fur on both sides
//   band    a black blindfold band across the face, z 21.5..25.5 at the snout end rising to z 24..28 at the back
//   eyes    a glowing cyan almond in the band at (-4, 23), outer corner up, a dark slit, a sly look; the far eye under
//           the band at (-10, 23) (only its socket arc drawn)
//   mouth   a sly grin: a dark line from (-8.2, 18.4) rising to (-4.5, 20), one white fang at (-5.5, 19)
//   ears    near ear dark, tall and pointed out of the mane, base (-2.5..2.8, 25), tip (2, 33.5); the far one splayed
//           into the mane on the left
//   mane    huge white mane with lilac streaks: locks swept up and back from the band, fanning up (z 40), left
//           (x -15, z 26..37), right (x 10, z 24..36) and down the back to z 15 (the back art is all mane, lilac below)
//   ruff    a purple fur collar z 13..19.5, ragged hem, a red gem at (-5.2, 15.7)
//   body    navy pot belly x -7..6, z 6..17; near-black thighs and short legs, wide stance; near foot x 2.6..7,
//           far foot x -11..-7 toes out, pale claws
//   arms    far (-X) reaching out left, paw at (-14, 13), claws curled; red and blue flame wisps over it
//           (-16..-12, 15.5..19); near (+X) bent, paw in front of the chest at (1, 14), claws down, a cyan spark by it
//   tail    a big dark brush from the rump along the ground to x 17 (z 4.5..14), curling up into a white flame tip
//           (x 9.5..16.5, z 10..18.5) whose points lean back towards the body
include <lib.scad>

fur = [0.2, 0.21, 0.37];          // belly, chest, arms
legC = [0.09, 0.09, 0.19];        // thighs, legs, tail (the black navy)
headC = [0.33, 0.33, 0.48];
muzzleC = [0.43, 0.42, 0.56];
mask = [0.06, 0.06, 0.13];
nose = [0.05, 0.05, 0.1];
teeth = [0.93, 0.94, 0.97];
earIn = [0.45, 0.44, 0.6];
white = [0.94, 0.95, 0.98];
pale = [0.82, 0.82, 0.91];
lilac = [0.66, 0.65, 0.8];
ruff = [0.3, 0.26, 0.5];
ruffDk = [0.2, 0.18, 0.38];
gem = [0.64, 0.12, 0.2, NOGLOW];
gemHi = [0.85, 0.3, 0.36, NOGLOW];
claw = [0.66, 0.67, 0.8];
tailC = [0.12, 0.13, 0.22];
wispRed = [0.78, 0.15, 0.27, NOGLOW];
wispBlue = [0.25, 0.7, 1, GLOW];
eyeIris = [0.35, 0.88, 1, GLOW];
eyeRim = [0.1, 0.45, 0.95, GLOW];
eyePupil = [0.03, 0.05, 0.16];

module e(r, p, c, fn = 16) { color(c) translate(p) scale(r) sphere(1, $fn = fn); }

// ---- Hollowolf's lock helpers. A soft lobe (ruff hems, tail fluff) and a long flat lock (mane, tail flame).
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
module lobe(p, d, w, c) { lseg(p, p + d, w, 0.4, c); }
module nframe(d, n) {
  z = nrm(d);
  x = nrm(n - (n * z) * z);
  y = cross(z, x);
  multmatrix([[x[0], y[0], z[0], 0], [x[1], y[1], z[1], 0], [x[2], y[2], z[2], 0], [0, 0, 0, 1]]) children();
}
module pseg(a, b, wa, wb, n, c) {
  d = b - a;
  color(c) hull() {
    translate(a) nframe(d, n) scale([wa * 0.36, wa, wa * 0.55]) sphere(1, $fn = 10);
    translate(b) nframe(d, n) scale([wb * 0.36, wb, wb * 0.55]) sphere(1, $fn = 8);
  }
}
module plock(p0, p1, p2, w, n, c) { pseg(p0, p1, w, w * 0.8, n, c); pseg(p1, p2, w * 0.8, 0.5, n, c); }
function sweepD(az, el) = [sin(az) * cos(el), cos(az) * cos(el), sin(el)];
function sweepPts(r, az, el, L, arch) = [r, r + sweepD(az, el) * L * 0.5 + [0, 0, arch], r + sweepD(az, el) * L];

// ---- Torso: a navy pot belly and chest over near-black hips.
e([5.6, 4.8, 3.6], [0, 0.8, 8.6], legC, 24);
e([6.2, 5.2, 5.4], [-0.4, -0.2, 12], fur, 24);
e([5.4, 4.6, 4.2], [-0.6, -0.4, 16.2], fur, 20);

// ---- Legs: fat thighs, short shins, wide paws; the far leg steps out to the left. hip/thigh, ankle, paw, toe dir.
LEGS = [
  [[4.4, 0.4, 7.2], [6.0, -0.6, 2.2], [6.4, -2.0, 1.3], [0.15, -1]],
  [[-5.0, 0.6, 7.2], [-7.8, 0.2, 2.4], [-8.6, -1.2, 1.3], [-0.55, -0.85]],
];
for (l = LEGS) {
  e([3.6, 4.0, 4.2], l[0], legC, 20);
  limb(l[0] + [0, -0.4, -1.5], l[1], 2.6, 2.1, legC);
  t = l[3];
  color(legC) translate(l[2]) rotate([0, 0, atan2(t[0], -t[1])]) scale([2.6, 3.4, 1.5]) sphere(1, $fn = 18);
  for (k = [-1, 0, 1]) {
    s = [-t[1], t[0], 0] * 1.15 * k;
    spike(l[2] + t * 2.7 + s + [0, 0, -0.1], t * 1.4 + [0, 0, -0.6] + s * 0.2, 0.42, 0.05, claw);
  }
}

// ---- Ruff: a purple fur collar round the neck with a ragged hem over the chest, the red gem on its front.
module collar(g = 0) {
  hull() {
    translate([-1.4, -1.6, 19.4]) scale([4.6, 4.4, 1.2] + [g, g, g]) sphere(1, $fn = 20);
    translate([-0.9, -1.0, 16.4]) scale([6.0, 5.4, 1.4] + [g, g, g]) sphere(1, $fn = 24);
  }
}
color(ruff) collar();
module hem(ring, l, w, swing, ca, cb) {
  for (i = [0 : len(ring) - 1]) let(a = ring[i][0], t = (i % 2 == 0 ? 1 : -1) * swing)
    lseg(ring[i][1], ring[i][1] + [sin(a) + t * cos(a), -cos(a) + t * sin(a), -l[i]], w, 0.18, i % 2 == 0 ? ca : cb);
}
HEM = [for (a = [-150 : 25 : 150]) [a, [-0.9 + 5.6 * sin(a), -1.0 - 5.1 * cos(a), 16.2]]];
HEM_L = [2.4, 3.0, 2.6, 3.4, 2.8, 3.8, 4.2, 3.6, 2.9, 3.3, 2.6, 3.1, 2.4];
hem(HEM, HEM_L, 2.6, 0.7, ruff, ruffDk);
UPPER = [for (a = [-120 : 30 : 120]) [a, [-1.3 + 4.4 * sin(a), -1.5 - 4.2 * cos(a), 19.6]]];
hem(UPPER, [1.8, 2.2, 1.9, 2.3, 2.0, 2.3, 1.9, 2.2, 1.8], 2.2, 0.6, ruffDk, ruff);
GEM = [-2.4, -7.0, 15.9];
e([1.15, 0.8, 1.15], GEM, gem, 16);
e([0.45, 0.3, 0.4], GEM + [-0.35, -0.65, 0.35], gemHi, 10);

// ---- Arms. Far (-X): reaching out left, paw open, claws curled up round the wisps. Near (+X): bent, paw in front of
// the chest, claws down.
SF = [-5.6, -0.6, 16.8]; EF = [-9.0, -2.4, 12.8]; WF = [-12.2, -3.8, 12.2];
PF = [-13.4, -4.2, 12.4];
e([2.2, 2.2, 2.2], SF, fur);
limb(SF, EF, 2.1, 1.8, fur);
limb(EF, WF, 1.8, 1.4, fur);
e([1.8, 1.5, 1.4], PF, fur);
FING_F = [[[-14.4, -5.4, 12.4], [-15.7, -5.6, 11.4]], [[-14.9, -4.4, 12.6], [-16.2, -4.4, 11.8]],
          [[-14.8, -3.2, 12.6], [-16.0, -3.0, 12.2]], [[-13.0, -5.4, 13.2], [-13.6, -6.4, 14.4]]];
for (f = FING_F) {
  limb(f[0] - (f[1] - f[0]) * 0.3, f[0], 0.6, 0.5, fur);
  spike(f[0], (f[1] - f[0]) * 1.2, 0.42, 0.05, claw);
}
lobe(EF + [-0.2, 0.6, -0.8], [0.4, 1.0, -2.0], 1.5, fur);

SN = [5.4, -0.6, 16.8]; EN = [7.2, -1.2, 13.4]; WN = [4.6, -5.2, 14.0];
PN = [3.8, -6.0, 14.3];
e([2.2, 2.2, 2.2], SN, fur);
limb(SN, EN, 2.1, 1.8, fur);
limb(EN, WN, 1.8, 1.4, fur);
e([1.7, 1.5, 1.6], PN, fur);
for (k = [-1, 0, 1]) spike(PN + [-0.6 + 0.9 * k, -1.2, -0.6], [-0.5 + 0.1 * k, -0.6, -1.4], 0.4, 0.05, claw);
lobe(EN + [0.6, 0.6, -0.6], [1.0, 0.9, -2.0], 1.5, fur);

// ---- Wisps: a red and two blue flame licks over the far paw; a cyan spark by the near one.
module wisp(p, h, w, lean, c) {
  color(c) hull() {
    translate(p) scale([w, w * 0.6, w]) sphere(1, $fn = 10);
    translate(p + [lean, 0, h]) sphere(0.12, $fn = 6);
  }
}
wisp([-15.8, -6.4, 15.4], 3.2, 0.7, 0.7, wispRed);
wisp([-16.6, -5.6, 14.4], 2.2, 0.5, -0.5, wispRed);
wisp([-13.8, -6.6, 15.8], 2.8, 0.6, -0.4, wispBlue);
wisp([-12.7, -6.2, 14.8], 2.0, 0.45, 0.4, wispBlue);
module bolt(pts, r, c) { color(c) for (i = [0 : len(pts) - 2]) hull() { translate(pts[i]) sphere(r, $fn = 6); translate(pts[i + 1]) sphere(r, $fn = 6); } }
bolt([[2.8, -8.2, 17.4], [2.0, -8.0, 16.0], [2.9, -8.1, 15.4], [2.2, -7.9, 14.0]], 0.25, wispBlue);
bolt([[1.4, -7.9, 16.6], [1.0, -7.8, 15.4]], 0.2, wispBlue);

// ---- Head, in its own frame: centre HC, turned HEAD_YAW (the muzzle a little to the viewer's left).
HC = [-3.6, -3.4, 24.0];
HEAD_YAW = -10;
HEAD_S = 1.18;
module headAt() { translate(HC) rotate([0, 0, HEAD_YAW]) scale(HEAD_S) children(); }
module skull(g = 0) {
  translate([0, 0.5, 0.6]) scale([5.6, 5.0, 5.0] + [g, g, g]) sphere(1, $fn = 26);
  translate([0, -1.2, -2.6]) scale([4.8, 4.0, 3.0] + [g, g, g]) sphere(1, $fn = 24);
}
module snout(g = 0) {
  hull() {
    translate([0, -3.4, -2.6]) scale([2.8, 2.6, 2.0] + [g, g, g]) sphere(1, $fn = 18);
    translate([0, -5.9, -3.0]) scale([1.8, 1.5, 1.4] + [g, g, g]) sphere(1, $fn = 16);
  }
  hull() {
    translate([0, -2.6, -4.4]) scale([2.6, 2.6, 1.3] + [g, g, g]) sphere(1, $fn = 16);
    translate([0, -5.0, -4.5]) scale([1.4, 1.2, 0.8] + [g, g, g]) sphere(1, $fn = 12);
  }
}
module stroke(pts, r) { for (i = [0 : len(pts) - 2]) hull() for (q = [pts[i], pts[i + 1]]) translate([0, q[0], q[1]]) rotate([0, 90, 0]) cylinder(h = 12, r = r, center = true, $fn = 8); }
MOUTH = [[-6.2, -4.1], [-4.8, -4.35], [-3.2, -3.9], [-1.6, -2.8]];
TEETH = [[-4.7, -4.8], [-4.0, -4.6]];
EYE = [3.0, -3.75, -0.9];
EAR = [[3.2, 0.2, 3.4], [2.8, 0.8, 7.0]];   // base and direction (the +X one; the -X one mirrored)
EAR_FAR = [-5.6, -2.8, 3.6];               // the far ear's direction: splayed out sideways, its tip out of the mane
CHEEK = [[[4.6, -0.4, -1.6], [2.0, 0.8, -0.6]], [[4.4, -1.2, -3.4], [1.8, 0.6, -1.6]], [[3.8, -0.4, -4.8], [1.0, 0.8, -2.0]]];
headAt() {
  color(headC) skull();
  color(muzzleC) snout();
  e([0.75, 0.55, 0.55], [0, -7.25, -2.7], nose, 14);
  // jagged cheek fur on both sides
  for (s = [1, -1]) for (c = CHEEK) lobe([c[0][0] * s, c[0][1], c[0][2]], [c[1][0] * s, c[1][1], c[1][2]], 2.0, headC);
  // the blindfold: a thick band of the skull, low at the snout end, rising towards the back
  color(mask) intersection() {
    skull(0.35);
    translate([0, -1, -0.6]) rotate([15, 0, 0]) cube([20, 30, 3.3], center = true);
  }
  // the mane starts right at the band's top edge: a pale cap over the skull above it
  color(pale) intersection() {
    skull(0.4);
    translate([0, -1, -0.6]) rotate([15, 0, 0]) translate([-20, -30, 1.6]) cube([40, 60, 20]);
  }
  // the sly grin: a dark line rising up the cheek, one white fang under it
  color(teeth) intersection() { snout(0.2); stroke(TEETH, 0.42); }
  color(nose) intersection() { union() { snout(0.12); skull(0.12); } stroke(MOUTH, 0.38); }
  // eyes: glowing cyan almonds in the band, outer corner up, a dark slit
  for (s = [1, -1])
    eye([EYE[0] * s, EYE[1], EYE[2]], 1.25, iris = eyeIris, sclera = eyeRim, pupil = eyePupil, yaw = 32 * s,
        lid = 0.3, lid_tilt = 28, lid_c = mask, squint = 0.24, slit = 0.35, shine = true);
  // tall pointed ears splayed out of the mane
  for (s = [1, -1]) {
    b = [EAR[0][0] * s, EAR[0][1], EAR[0][2]];
    d = s > 0 ? EAR[1] : EAR_FAR;
    color(headC) hull() {
      translate(b) rotate(_dir_rot(d)) scale([2.8, 1.4, 2.2]) sphere(1, $fn = 14);
      translate(b + d * 0.5) rotate(_dir_rot(d)) scale([1.7, 0.9, 1.3]) sphere(1, $fn = 10);
      translate(b + d) sphere(0.2, $fn = 6);
    }
    color(earIn) hull() {
      translate(b + d * 0.15 + [0, -1.0, 0]) rotate(_dir_rot(d)) scale([1.5, 0.5, 1.2]) sphere(1, $fn = 10);
      translate(b + d * 0.75 + [0, -0.3, 0]) sphere(0.15, $fn = 6);
    }
  }
}

// ---- Mane: long flat tapered locks, white with lilac below and at the back, rooted on the cap round the skull and
// swept back and up to the upper right, so head and mane make a wedge leaning back; a few flick up and out to the
// left as drawn. A lock: root on the skull at (azimuth, elevation) (azimuth from +Y towards +X, as sweepD), running L
// along sweepD(daz, del), arched up by `arch` in the middle, three tapering flat segments whose faces lie on the
// mane (normal away from the skull's centre SK), so the locks overlap like shingles and only their tips break the
// silhouette.
SK = [-3.6, -2.8, 24.7];
SKR = [6.4, 5.8, 5.8];
function lockRoot(az, el) = SK + [SKR[0] * sin(az) * cos(el), SKR[1] * cos(az) * cos(el), SKR[2] * sin(el)];
// four points along a swept curve: leaving the skull along sweepD(az1, el1), turning to sweepD(az2, el2), bowed away
// from the skull by `arch`
function lockPts(m) = let(p0 = lockRoot(m[0], m[1]), D1 = sweepD(m[2], m[3]), D2 = sweepD(m[4], m[5]), L = m[6],
                          U = nrm(p0 - SK), a = m[9], p1 = p0 + D1 * L * 0.35 + U * a, p2 = p1 + nrm(D1 + D2) * L * 0.35)
  [p0, p1, p2, p2 + D2 * L * 0.3];
module fseg(a, b, wa, wb, o, c, fa = 14, fb = 12) {
  d = b - a;
  color(c) hull() {
    translate(a) nframe(d, a - o) scale([wa * 0.42, wa, wa * 0.5]) sphere(1, $fn = fa);
    translate(b) nframe(d, b - o) scale([wb * 0.42, wb, wb * 0.5]) sphere(1, $fn = fb);
  }
}
module hlock(q, w, c, o) {
  fseg(q[0], q[1], w, w * 0.95, o, c, 16, 14);
  fseg(q[1], q[2], w * 0.95, w * 0.7, o, c, 14, 12);
  fseg(q[2], q[3], w * 0.7, 0.3, o, c, 12, 6);
}
// [root az, root el, leaving az, el, ending az, el, length, width, colour (0 white, 1 pale, 2 lilac), arch]. They all
// comb the same way, up and back, then out to the right, so they lie side by side like swept-back hair; the ones from
// the forehead rise on the far side of the near ear, which stands in front of them.
MANE = [
  // from the forehead band up over the crown, turning back to the upper right
  [180, 14, -5, 52, 40, 20, 15, 4.4, 0, 1.4], [-160, 14, -15, 55, 35, 30, 15, 4.4, 1, 1.4],
  [-140, 16, -35, 55, 20, 45, 14, 4.4, 0, 1.2], [-120, 18, -70, 50, 0, 60, 13, 4.2, 2, 1.0],
  [170, 30, 5, 60, 50, 10, 15, 4.6, 0, 1.2], [-170, 32, -10, 62, 40, 30, 14, 4.6, 2, 1.2],
  // crown and the near side behind the ear
  [-60, 55, 0, 70, 45, 30, 14, 5.2, 0, 1.0], [0, 72, 30, 50, 55, 5, 14, 5.2, 1, 1.0], [-20, 40, 20, 35, 55, -10, 14, 5.2, 0, 0.8],
  [40, 35, 50, 20, 60, -15, 12.5, 5.0, 0, 0.8], [30, 12, 45, -10, 55, -35, 12.5, 4.8, 2, 0.6],
  // two short flicks up and out to the left
  [-115, 22, -100, 40, -110, 60, 9.5, 4.2, 0, 0.6], [-100, 6, -116, 10, -120, 25, 8.5, 3.8, 2, 0.5],
  // the back, combed down and out to the right, lilac
  [0, 25, 20, -10, 35, -50, 13, 5.4, 2, 0.6], [-35, 25, 0, -20, 15, -60, 13, 5.4, 2, 0.5], [-70, 28, -40, -10, -20, -50, 11.5, 4.8, 2, 0.5],
  [-90, 38, -60, 30, -30, 0, 11, 4.6, 1, 0.6], [-40, 50, 0, 40, 30, 0, 13, 5.4, 1, 0.8],
];
MANE_C = [white, pale, lilac];
for (m = MANE) hlock(lockPts(m), m[7], MANE_C[m[8]], SK);

// ---- Tail: a fluffy dark brush from the rump along the ground out to the right, curving up into a soft white tip of
// a few long tapered locks that lean back towards the body.
TAIL = [[2.6, 4.2, 8.4], [7.0, 7.2, 6.4], [11.4, 8.6, 7.4], [12.4, 8.4, 11.0]];
TAIL_R = [2.4, 3.3, 3.6, 3.0];
chain(TAIL, TAIL_R, legC);
// soft dark fur along the brush: short flat locks trailing back from it
TO = [8.5, 8, 9.5];
FUR = [
  [[5.2, 6.2, 5.0], [7.6, 6.8, 3.4], [10.0, 8.2, 3.6], 4.0, 0], [[8.8, 8.2, 4.8], [11.6, 9.4, 3.6], [14.0, 9.4, 5.0], 4.0, 1],
  [[12.4, 9.2, 6.4], [14.8, 9.4, 7.2], [16.4, 9.0, 9.4], 4.0, 0], [[13.0, 9.0, 9.0], [15.4, 8.8, 10.6], [16.4, 8.6, 12.8], 3.6, 1],
  [[7.0, 9.6, 8.2], [9.6, 11.4, 8.0], [11.8, 12.4, 9.0], 3.8, 0], [[10.4, 10.6, 9.4], [12.4, 12.0, 10.4], [13.8, 12.0, 12.4], 3.6, 1],
];
for (f = FUR) { fseg(f[0], f[1], f[3], f[3] * 0.8, TO, f[4] ? tailC : legC); fseg(f[1], f[2], f[3] * 0.8, 0.3, TO, f[4] ? tailC : legC); }
e([2.0, 1.9, 1.7], [12.4, 8.4, 11.8], white, 18);
// the white tip: a few long tapered locks from the brush's end, up and curling back towards the body
TIPO = [13, 8.4, 9];
TIP = [
  [[[12.2, 8.4, 11.2], [12.6, 8.4, 13.8], [11.8, 8.3, 16.0], [9.8, 8.2, 17.4]], 4.6, 0],
  [[[13.2, 8.6, 11.0], [14.2, 8.7, 13.4], [14.2, 8.8, 15.6], [13.0, 8.8, 17.4]], 4.0, 1],
  [[[11.4, 8.2, 11.6], [10.4, 8.0, 13.4], [8.8, 7.8, 14.6], [7.0, 7.6, 15.2]], 3.6, 0],
  [[[12.4, 10.0, 11.4], [12.8, 10.8, 14.0], [12.0, 11.2, 16.0], [10.6, 11.4, 17.0]], 4.0, 2],
];
TIP_C = [white, pale, lilac];
for (t = TIP) hlock(t[0], t[1], TIP_C[t[2]], TIPO);
