// Slushpup: a chubby pale-grey baby seal lying on its belly, a big soft round loaf of a body, a round head low at
// the front with a sweet face, ice-crystal ears, little front flippers, a round hind paw with blue pads on each flank,
// a cluster of ice crystals and icicles at the tail, and a soft cloud of frosty breath puffed from its mouth.
//
// Checklist (front sheet, 40 units tall, feet on z 0):
// - body: one loaf, sheet x -18..28, z 0..37.5, highest just behind the head (x 5..12), sloping down to the rump;
//   pale grey fur, the underside a darker grey-blue (the art's lower third).
// - head: round, sheet x -22..-1, z 10..36, centre (-11, 24), fused into the body at the back.
// - face: two big round dark navy eyes (near (-7.5, 20.2) about 4.4 wide, far (-19, 20) partly turned away), each
//   with a square white shine at its upper left and a blue-grey glint at the lower right; small grey brow smudges
//   above the inner corners (-10.5 / -17.3, 24.6); a dark rounded-triangle nose (-16, 16.3) on a short pale muzzle,
//   a line down from it and a smile curving up to the near cheek (-8, 14).
// - ears: flat faceted ice crystals, pale ice blue with lighter facets: far one upright (-18.5, 30..40), near one
//   leaning back and out (-1.5, 30 -> 4.7, 38.4).
// - front flippers: the near one a white flipper down the chest (8, 15 -> 1, 5), the far one's tip under the chin
//   (-19..-10, z 0..4).
// - hind paws: a round paw on each flank, its sole turned out to the viewer (near: sheet 11..21, z 5.5..16.5) with
//   three blue toe beans and a big blue pad.
// - tail: a cluster of ice crystals fanning up and out and icicles hanging down (sheet 25..34, z 4..20).
// - breath: a soft cloud of merged puffs from the mouth (sheet -34.5..-17, z 3..19), white with blue-grey shading.
// - back art: the round rump, the crystal tail cluster, a hind paw's pads, the head in profile.
include <lib.scad>

fur = [0.84, 0.89, 0.92];
furLo = [0.71, 0.78, 0.83];
flip = [0.94, 0.97, 0.98];
belly = [0.90, 0.94, 0.96];
muzzleC = [0.88, 0.92, 0.94];
eyeC = [0.12, 0.14, 0.21];
glint = [0.47, 0.57, 0.63];
nose = [0.19, 0.22, 0.28];
brow = [0.46, 0.53, 0.59];
ice = [0.60, 0.74, 0.85];
iceHi = [0.80, 0.90, 0.96];
pad = [0.56, 0.73, 0.88];
puff = [0.93, 0.97, 0.99];
puffLo = [0.74, 0.82, 0.87];

// the body masses (the rig copies these)
BODY = [[20, 21, 18.5], [0, 10, 18.5]];
BELLY = [[13, 10, 11], [0, -12, 11]];
REAR = [[17, 12, 13], [0, 22, 13]];
HEADT = [[10.5, 9.5, 8.5], [0, -18, 27]];
HEADB = [[11.5, 9, 7.5], [0, -19.5, 19.5]];
NECK = [[12, 8, 10], [0, -9, 22]];
MUZ = [[5, 3.4, 3.8], [0, -27.6, 14.8]];

// a point on the front of an ellipsoid [r, c] at (x, z), sunk by `s`
function front(e, x, z, s = 0) = let(r = e[0], c = e[1],
  k = 1 - pow((x - c[0]) / r[0], 2) - pow((z - c[2]) / r[2], 2)) [x, c[1] - r[1] * sqrt(max(0, k)) + s, z];

module bodyMass(g = 0) {
  hull() for (e = [BODY, BELLY, REAR]) translate(e[1]) scale(e[0] + [g, g, g]) sphere(1, $fn = 40);
}

// Body: one soft loaf, the underside painted a darker grey-blue (rising towards the rump), a paler chest and belly
// under the chin.
color(fur) bodyMass();
color(furLo) intersection() {
  bodyMass(0.25);
  translate([0, 0, 9]) rotate([-14, 0, 0]) translate([-40, -60, -40]) cube([80, 120, 40]);
}
color(belly) intersection() {
  bodyMass(0.4);
  translate([0, -17, 9]) scale([10, 9, 10]) sphere(1, $fn = 28);
}

// Soft fur: flattened tufts lying back along the surface, ragging the outline of the back and the cheeks.
function unit(v) = v / norm(v);
function onEll(e, el, az) = let(u = [cos(el) * sin(az), -cos(el) * cos(az), sin(el)]) [e[1] + [e[0][0] * u[0], e[0][1] * u[1], e[0][2] * u[2]], unit([u[0] / e[0][0], u[1] / e[0][1], u[2] / e[0][2]])];
// the point of an ellipsoid whose surface normal is n
function atNormal(e, n) = let(r = e[0], q = [r[0] * r[0] * n[0], r[1] * r[1] * n[1], r[2] * r[2] * n[2]], d = sqrt(q * n)) [e[1] + q / d, n];
module tuft(e, el, az, sz, lie = [0, 1, -0.5], sink = 0.7, nrm = undef) {
  pn = nrm == undef ? onEll(e, el, az) : atNormal(e, nrm);
  n = pn[1];
  t = unit(lie - (lie * n) * n);
  b = cross(n, t);
  p = pn[0] - n * sink + t * sz * 0.5;
  color(fur) multmatrix([[t[0], b[0], n[0], p[0]], [t[1], b[1], n[1], p[1]], [t[2], b[2], n[2], p[2]], [0, 0, 0, 1]])
    scale([sz * 1.5, sz * 0.95, sz * 0.5]) sphere(1, $fn = 18);
}
// along the body's outline as the front camera sees it (normals square to the view); the back camera's outline is
// nearly the same ring
VIEWV = unit([0.5, -0.866, 0.17]);
RING1 = unit([0, 0, 1] - VIEWV[2] * VIEWV);
RING2 = cross(VIEWV, RING1);
BACK_TUFTS = [-70, -50, -30, -10, 10, 30, 50, 70];
for (a = BACK_TUFTS) tuft(BODY, 0, 0, 3, sink = 1.1, nrm = cos(a) * RING1 + sin(a) * RING2);
CHEEK_TUFTS = [[2, 82], [-16, 84], [18, 86]];
mirror_x() for (k = CHEEK_TUFTS) tuft(HEADB, k[0], k[1], 2, [0, 0.6, -1], 0.75);

// Head: a rounded seal head over full cheeks, blended into the body through a thick neck (no crease).
blob([HEADT, HEADB, NECK], fur);
ell(MUZ[0], MUZ[1], muzzleC);

// Nose: a rounded triangle, wide on top.
color(nose) hull() {
  translate([0, -30.9, 16.7]) scale([1.8, 1, 0.72]) sphere(1, $fn = 16);
  translate([0, -30.7, 15.6]) scale([0.6, 0.8, 0.5]) sphere(1, $fn = 12);
}
// Mouth: a line down from the nose, then a smile curving up to each cheek.
color(nose) {
  hull() { translate(front(MUZ, 0, 15.6, 0.2)) sphere(0.3, $fn = 8); translate(front(MUZ, 0, 13.4, 0.2)) sphere(0.3, $fn = 8); }
  mirror_x() for (s = [[[0, 13.4], [1.6, 12.4]], [[1.6, 12.4], [3.4, 12.6]], [[3.4, 12.6], [4.6, 13.8]]])
    hull() { translate(front(MUZ, s[0][0], s[0][1], 0.25)) sphere(0.3, $fn = 8); translate(front(MUZ, s[1][0], s[1][1], 0.25)) sphere(0.3, $fn = 8); }
}

// Eyes: big, round, dark navy and glossy; the shine sits at the upper left of both (the art's light), a blue-grey glint
// at the lower right.
EYE = front(HEADB, 5, 19.6, 0.75);
ES = 2.6;
EYAW = 28;
module shine(p, yaw) {
  translate(p) rotate([0, 0, yaw]) {
    color("white") translate([-0.8, -2.3, 0.95]) scale([1, 0.6, 1]) sphere(0.7, $fn = 10);
    color(glint) translate([0.85, -2.2, -1]) scale([1, 0.6, 0.8]) sphere(0.55, $fn = 10);
  }
}
eye(EYE, ES, iris = eyeC, pupil = eyeC, sclera = eyeC, yaw = EYAW, flat = 0.6, shine = false);
eye([-EYE[0], EYE[1], EYE[2]], ES, iris = eyeC, pupil = eyeC, sclera = eyeC, yaw = -EYAW, flat = 0.6, shine = false);
shine(EYE, EYAW);
shine([-EYE[0], EYE[1], EYE[2]], -EYAW);
// Brow smudges over the inner corners.
mirror_x() color(brow) translate(front(HEADT, 3.2, 24.6, 0.3)) rotate([0, 0, 14]) scale([1.3, 0.55, 0.8]) sphere(1, $fn = 12);

// Ice-crystal ears: broad flat faceted shards, a rounded top, leaning out and back; a lighter facet on the front.
module shard(len, w, t) {
  hull() {
    cube([w * 0.7, t * 0.6, 0.1], center = true);
    for (s = [-1, 1]) {
      translate([s * w / 2, 0, len * 0.45]) cube([0.1, t, 0.1], center = true);
      translate([s * w * 0.42, 0, len * 0.86]) cube([0.1, t * 0.75, 0.1], center = true);
    }
    translate([0, 0, len]) cube([w * 0.25, 0.3, 0.1], center = true);
  }
}
EAR = [8.5, -19.5, 30];
EAR_ROT = [-25, 28, 0];
EAR_LEN = 12;
mirror_x() translate(EAR) rotate(EAR_ROT) {
  color(ice) shard(EAR_LEN, 5.2, 2.0);
  color(iceHi) translate([-0.5, -0.6, 3.5]) shard(8.5, 2.4, 1.2);
}

// Front flippers: small soft flat paddles folded down the chest, lying against it, the rounded tips forward.
FL_ROOT = [12.5, -6, 14];
FL_MID = [12.6, -10.5, 9];
FL_TIP = [10.8, -15, 4.6];
FL_A = unit(FL_TIP - FL_ROOT);
FL_N0 = unit([0.75, -0.6, 0.2]);
FL_N = unit(FL_N0 - (FL_N0 * FL_A) * FL_A);
FL_W = cross(FL_N, FL_A);
module flat(p, r) {
  multmatrix([[FL_W[0], FL_N[0], FL_A[0], p[0]], [FL_W[1], FL_N[1], FL_A[1], p[1]], [FL_W[2], FL_N[2], FL_A[2], p[2]], [0, 0, 0, 1]])
    scale(r) sphere(1, $fn = 20);
}
module flipper() {
  hull() { flat(FL_ROOT, [2.2, 1.1, 2.4]); flat(FL_MID, [2.8, 1.1, 2.4]); flat(FL_TIP, [2.7, 1, 2]); }
}
mirror_x() color(flip) flipper();

// Hind paws: round, on the flanks, the soles turned out to the viewer with three toe beans and a big pad.
PAW = [17.6, 1.2, 10.5];
PAW_YAW = -38;
PAW_R = [3.4, 5.8, 6.5];
function sole(y, z, s = 0) = [PAW_R[0] * sqrt(max(0, 1 - pow(y / PAW_R[1], 2) - pow(z / PAW_R[2], 2))) - s, y, z];
mirror_x() translate(PAW) rotate([0, 0, PAW_YAW]) {
  color(fur) scale(PAW_R) sphere(1, $fn = 28);
  color(pad) {
    for (b = [[-2.6, 2.4], [0, 3.4], [2.6, 2.4]]) translate(sole(b[0], b[1], 0.3)) scale([0.55, 1.1, 1.2]) sphere(1, $fn = 12);
    translate(sole(0.2, -1.4, 0.5)) scale([0.75, 2.5, 1.9]) sphere(1, $fn = 16);
  }
}

// Tail: a stubby fur flipper with a cluster of ice crystals fanning up and out, icicles hanging down.
module crystal(p, d, len, r, c) {
  color(c) translate(p) rotate(_dir_rot(d)) {
    cylinder(h = len * 0.72, r = r, $fn = 6);
    translate([0, 0, len * 0.72]) cylinder(h = len * 0.28, r1 = r, r2 = 0.05, $fn = 6);
  }
}
TAIL = [12, 30.5, 11];
TIP = TAIL + [1.6, 2.4, 0];
CRYSTALS = [
  // [direction, length, radius]: the up-and-out fan, then the icicles hanging down
  [[0.15, 0.4, 1], 7.5, 0.8], [[0.7, 0.5, 0.9], 7, 0.75], [[1, 0.55, 0.4], 8, 0.8], [[0.9, 0.9, 0.05], 7, 0.65],
  [[-0.4, 0.8, 0.8], 6.5, 0.7], [[0.3, 0.45, -1], 9, 0.75], [[0.85, 0.5, -0.9], 7, 0.65], [[-0.2, 0.6, -1], 6, 0.6],
];
ell([4, 4.5, 3.6], TAIL, fur);
for (i = [0 : len(CRYSTALS) - 1]) let(k = CRYSTALS[i]) crystal(TIP, k[0], k[1], k[2], i % 2 == 0 ? ice : iceHi);

// Frosty breath: a soft cloud of a few big merged puffs blown from the mouth (sheet positions, at depth y), the
// lower puffs a shade bluer.
PUFFS = [
  // [sheet x, z, depth y, r, shade]: bumps round a core, the lower ones a shade bluer
  [-26.5, 16.4, -34, 3, 0], [-30.6, 15, -35, 2.8, 0], [-32.6, 10.6, -35.5, 2.8, 0], [-30, 6.8, -34.5, 2.8, 1],
  [-25.4, 6, -33.5, 2.7, 1], [-22, 9.8, -32.5, 2.2, 1], [-22.2, 14.6, -33, 2.3, 0], [-19, 12.6, -31.6, 1.7, 0],
];
CLOUD = [[-22.5, 12.5, -32.5, 2.6], [-27.5, 13.6, -34, 4.2], [-28.5, 9.2, -34.5, 4.2], [-31, 11.6, -35, 3.6], [-25, 8.6, -33.5, 3.4]];
translate([0, 0, 2.5]) {
  for (q = CLOUD) color(puff) translate(fromSheet(q[0], q[1], q[2])) sphere(q[3], $fn = 28);
  for (q = PUFFS) color(q[4] == 1 ? puffLo : puff) translate(fromSheet(q[0], q[1], q[2])) sphere(q[3], $fn = 20);
}
