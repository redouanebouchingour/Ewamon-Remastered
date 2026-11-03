// Bogmaw: Mudbub grown into a huge, squat, warty bog toad seen from the front three-quarter.
// Checklist (front sheet, 40 tall; the art's face is drawn almost frontal, the body trailing back to the right):
// - head: a massive wide dome (sheet x -26..3, z 22..39) merging into the back with no neck
// - face: two small heavy-lidded eyes in domes on top of the head (near one sheet -5.7, z 36.6; far one -17, z 38.5),
//   pale tan with dark lid lines; a huge grin across the whole face: a row of big flat tan teeth (z 28.5..33) under
//   a skin lip ridge, the orange lower jaw / throat sac bulging out under them (sheet -26..1, z 18..29) with dark
//   wrinkle lines and moss drips off the lip
// - a darker brown-orange chest between the front legs (sheet -13..0, z 11..20)
// - hide: mottled dark olive-brown with lighter tan warts ringed dark (low bumps), moss patches along the spine,
//   the head and the flanks
// - legs: thick bent front legs, elbows out, splayed blunt fingers; big folded hind legs at the sides, feet forward
// - tail: a thick crocodile tail curling round the +X hind foot along the ground (front: sheet 10..27, z 0..12;
//   back: sweeping out to the creature's left with moss stripes)
include <lib.scad>

hide = [0.39, 0.35, 0.29];
lip = [0.5, 0.45, 0.37];
hideDark = [0.24, 0.2, 0.18];
wart = [0.56, 0.5, 0.41];
moss = [0.42, 0.47, 0.27];
mossLight = [0.53, 0.58, 0.33];
throat = [0.73, 0.51, 0.36];
throatLine = [0.42, 0.29, 0.22];
belly = [0.5, 0.37, 0.29];
tooth = [0.76, 0.67, 0.52];
ink = [0.11, 0.1, 0.08];

// A low bump laid on an ellipsoid [radii, centre] at azimuth az / elevation el: s = radius, h = height share.
function onE(E, az, el) = let(r = E[0], c = E[1], u = [cos(el) * cos(az), cos(el) * sin(az), sin(el)])
  [c + [r[0] * u[0], r[1] * u[1], r[2] * u[2]], [u[0] / r[0], u[1] / r[1], u[2] / r[2]]];
module bumpOn(E, az, el, s, h = 0.45, c, sx = 1, fn = 10) {
  q = onE(E, az, el);
  color(c) translate(q[0]) rotate(_dir_rot(q[1])) scale([s * sx, s, s * h]) sphere(1, $fn = fn);
}
// A wart: a dark ring with a lighter tan cap.
module wartOn(E, az, el, s) {
  bumpOn(E, az, el, s * 1.25, 0.3, hideDark, fn = 8);
  bumpOn(E, az, el, s, 0.5, wart, fn = 8);
}

// ---- Head
CRAN = [[15.6, 11.5, 9.6], [0, -10, 29]];
ell(CRAN[0], CRAN[1], hide);
// A lighter lip ridge over the teeth.
intersection() {
  ell([15.3, 11.4, 1.3], [0, -10, 33.5], lip);
  translate([-20, -30, 30]) cube([40, 22, 6]);
}
// Eye domes on top, small heavy-lidded eyes looking forward and out.
mirror_x() {
  ell([3.3, 3.2, 2.8], [6.8, -13.5, 36.6], hide);
  eye([7.1, -15.9, 37.3], 1.6, iris = [0.62, 0.5, 0.32], pupil = ink, sclera = [0.8, 0.71, 0.55], yaw = 22, flat = 0.6,
      lid = 0.45, lid_tilt = 0, lid_c = hide, slit = 1.4);
}
// Dark gum line behind the teeth.
color(ink) translate([0, -10, 30.4]) scale([15.6, 11.6, 2.6]) sphere(1, $fn = 36);
// The grin: a row of big flat square teeth round the front of the face.
for (a = [-64 : 12.8 : 64]) {
  n = atan2(sin(a) / 15.5, cos(a) / 11.6);       // the ellipse normal's angle (from -Y towards +X)
  color(tooth) translate([sin(a) * 15.5, -10 - cos(a) * 11.6, 30.7 - abs(a) * 0.006]) rotate([0, 0, n]) rotate([-16, 0, 0])
    cube([2.9, 1.4, 4.7], center = true);
}
// Lower jaw / throat sac: a lip rim under the teeth swelling into a big orange jowl.
JAW = [[16.2, 12.3, 2.4], [0, -10.4, 27.4]];
THR = [[16.6, 12.9, 3.6], [0, -10.8, 24.4]];
SAC = [[11.5, 9.5, 4], [0, -11, 19.8]];
blob([JAW, THR, SAC], throat);
// Wrinkle lines across the throat.
for (z = [[22.4, 7], [20, 4.5]]) color(throatLine) intersection() {
  hull() for (e = [JAW, THR, SAC]) translate(e[1]) scale(e[0] + [0.15, 0.15, 0.15]) sphere(1, $fn = 28);
  translate([-z[1], -30, z[0]]) cube([2 * z[1], 18, 0.3]);
}
// Moss drips off the lower lip.
for (d = [[-150, 1.8, 3.2], [-118, 1.3, 2.2], [-62, 1.4, 2.6], [-30, 1.2, 1.9]])
  bumpOn([[16.8, 12.8, 3.6], [0, -10.6, 25.8]], d[0], -8, d[1], 0.35, moss, sx = 0.75, fn = 12);

// ---- Body: the back of the head running into a broad hunched back and rump.
BODY = [[17, 16, 12.5], [0, 6, 18]];
BACK = [[15.2, 13, 9.6], [0, 5, 26.5]];
RUMP = [[13, 9, 9], [0, 17, 13]];
blob([[[14.5, 11, 9], [0, -4, 29.5]], [[15, 12, 9], [0, 5, 27]], BODY, RUMP], hide);
// Chest between the front legs.
ell([10.5, 8, 6], [0, -1.5, 13.5], belly);

// Warts and moss over the head and back (az, el, size), mirrored. BACK is the upper back's surface, BODY the flanks'.
HEADW = [[30, 50, 1.2], [62, 36, 1.1], [118, 40, 1.3], [140, 22, 1.1], [12, 28, 1.0]];
BACKW = [[15, 40, 1.9], [45, 30, 1.7], [72, 45, 2.0], [100, 30, 1.8], [128, 38, 1.7], [60, 65, 1.6], [150, 25, 1.6],
         [105, 62, 1.5], [170, 45, 1.5], [30, 62, 1.4], [85, 15, 1.6]];
BODYW = [[20, 5, 1.6], [55, -2, 1.7], [95, 0, 1.6], [125, 10, 1.5], [160, -5, 1.4], [75, -20, 1.4]];
mirror_x() {
  for (w = HEADW) wartOn(CRAN, w[0], w[1], w[2]);
  for (w = BACKW) wartOn(BACK, w[0], w[1], w[2]);
  for (w = BODYW) wartOn(BODY, w[0], w[1], w[2]);
  for (w = [[60, 20, 1.6], [85, 45, 1.5], [40, 50, 1.4], [70, -5, 1.4]]) wartOn(RUMP, w[0], w[1], w[2]);
  // Moss patches on the flanks and the back.
  for (m = [[40, 15, 2.8, 1.6], [135, 25, 2.6, 1.3], [85, -12, 2.4, 1.2], [160, 5, 2.4, 1.5]])
    bumpOn(m[1] > 20 ? BACK : BODY, m[0], m[1], m[2], 0.25, moss, sx = m[3]);
  bumpOn(BACK, 115, 52, 2.4, 0.25, moss, sx = 1.4);
  // The front flanks behind the jaw: a few warts and moss down the side of the head.
  for (w = [[-25, 10, 1.4], [-8, 22, 1.3]]) wartOn(BODY, w[0], w[1], w[2]);
  wartOn(BACK, -15, 40, 1.4);
  bumpOn(CRAN, 15, 32, 2.6, 0.25, moss, sx = 1.8);
  bumpOn(BACK, 5, 45, 2.4, 0.25, moss, sx = 1.5);
  bumpOn(CRAN, 115, 45, 2.2, 0.25, moss, sx = 1.3);
}
// Mossy stripe down the spine with lighter spots.
for (m = [[95, 80, 3.6], [80, 62, 3.0], [100, 42, 2.8]]) bumpOn(BACK, m[0], m[1], m[2], 0.25, moss, sx = 0.7);
bumpOn(BODY, 92, 30, 2.6, 0.25, moss, sx = 0.8);
bumpOn(CRAN, 92, 62, 3.2, 0.25, moss, sx = 1.6);
for (m = [[85, 72, 1.2], [105, 52, 1.0]]) bumpOn(BACK, m[0], m[1], m[2], 0.45, mossLight);

// ---- Front legs: thick, bent, elbows out, splayed blunt fingers.
mirror_x() {
  chain([[12, -11, 15], [15.5, -14.5, 8], [13, -18, 3]], [5.2, 4.4, 3.3], hide);
  ell([4.2, 4.2, 1.8], [13, -19, 1.8], hide);
  for (a = [-55, -18, 18, 55]) limb([13, -19, 1.4], [13 + sin(a) * 4.6, -19 - cos(a) * 4.6, 0.85], 1.4, 0.85, hide);
  bumpOn([[3.8, 3.8, 3.8], [15.5, -14.5, 8]], 10, 20, 1.8, 0.35, moss);
  wartOn([[4.2, 4.2, 4.2], [13.8, -12.8, 11.5]], 20, 10, 1.1);
}

// ---- Hind legs: big folded haunches, shins tucked back, feet pointing forward.
mirror_x() {
  HAU = [[7.5, 10, 8.5], [13.5, 9, 10]];
  ell(HAU[0], HAU[1], hide);
  chain([[17.5, 3, 6.5], [17.5, 12, 2.6]], [3.2, 2.4], hide);
  limb([17.5, 12, 2.2], [17, 2, 1.4], 2.2, 1.6, hide);
  for (a = [-40, -12, 15, 42]) limb([17, 2, 1.2], [17 + sin(a) * 3.6, 2 - cos(a) * 3.6, 0.7], 0.9, 0.65, hide);
  bumpOn(HAU, 20, 25, 2.6, 0.3, moss, sx = 1.3);
  wartOn(HAU, -20, 40, 1.3);
  wartOn(HAU, 60, 10, 1.2);
}

// ---- Tail: thick at the root, curling out to +X and forward round the hind foot along the ground.
TAIL = [[0, 18, 10], [8, 25, 7.5], [16, 26, 5.5], [23, 20, 3.5], [25, 11, 2], [22.5, 3, 0.9]];
chain(TAIL, [5.6, 5, 4.2, 3.2, 2, 0.7], hide);
for (i = [1 : 4]) color(moss) translate(TAIL[i] + [0, 0, [0, 4.5, 3.7, 2.8, 1.7][i]]) scale([2.6, 2.6, 0.5] * [0, 1, 0.95, 0.85, 0.6][i]) sphere(1, $fn = 10);
for (t = [0.5, 1.5, 2.5, 3.5]) let(i = floor(t), f = t - i, q = TAIL[i] * (1 - f) + TAIL[i + 1] * f, r = [5.6, 5, 4.2, 3.2, 2][i] * (1 - f) + [5, 4.2, 3.2, 2, 0.7][i] * f)
  color(mossLight) translate(q + [0, 0, r * 0.92]) scale([r * 0.5, r * 0.5, r * 0.18]) sphere(1, $fn = 10);
