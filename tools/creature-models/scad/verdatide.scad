// Verdatide: Mossling grown into a great sea turtle carrying a meadow on its shell.
// Checklist (front sheet, 40 units tall, sheet x = 0.866 x + 0.5 y):
//   - Shell: a TALL dome (sheet x -17..21.5, z 14..36, grass to 40), mossy green pillow scutes with dark grooves,
//     a flared marginal row at the base, the front lip lifted into a hood over the head (z 23.5..26).
//     Meadow: grass blades along the whole top and the edges, flower dots (yellow, pink, blue) lying on the moss, a few
//     taller flowers on the crown, grey rocks (sheet (8, 35), (12, 32), (-13, 28)).
//   - Brown plastron rim under the shell (sheet x 2..17, z 12..16 on the right).
//   - Head under the hood: sheet centre (-4.7, 19.3), 10.5 wide, z 15..23.6; pale sage face, darker crown patches.
//     Eyes: two black almonds (near (-2.3, 20.1), far (-9.1, 20) at the head's edge) under heavy dark lids, a white
//     catchlight, a dark bag line below: calm, old. Two nostril dots at (-7.5, 19.6), (-6.3, 19.6). A wide mouth line
//     at z 16.8 with a V notch at the beak (-6.5, 16.1).
//   - Beard: long moss strands from the jaw (sheet x -10..0.5) down to z 3..6, olive, moss and dark green.
//   - Front flippers: huge broad paddles; near one from the shoulder (6, 14) to the tip (23.6, 1), far one to
//     (-23.4, 4); barnacle clusters (grey rings) on the near one (x 5.6..13.7, z 3..11) and the far one (x -19..-12.6).
//   - Back flippers: short paddles, the near one shows at (17.5..23.6, 9..17).
//   - Back art: the scute pattern seen whole, both back flippers. No tail drawn.
include <lib.scad>

skin = [0.37, 0.48, 0.28];
skinLight = [0.46, 0.57, 0.29];
skinDark = [0.21, 0.30, 0.22];
face = [0.5, 0.6, 0.4];
faceDark = [0.3, 0.4, 0.25];
crown = [0.38, 0.49, 0.31];
ink = [0.1, 0.13, 0.08];
groove = [0.13, 0.2, 0.15];
scuteA = [0.36, 0.48, 0.26];
scuteB = [0.42, 0.55, 0.28];
mossHi = [0.57, 0.7, 0.35, NOGLOW];
plastron = [0.45, 0.38, 0.26];
rock = [0.42, 0.44, 0.42];
rockHi = [0.63, 0.63, 0.58];
barnacle = [0.63, 0.63, 0.58];
barnacleHole = [0.3, 0.31, 0.29];
grassA = [0.46, 0.57, 0.29];
grassB = [0.57, 0.7, 0.35, NOGLOW];
yellow = [0.93, 0.82, 0.38, NOGLOW];
pink = [0.82, 0.5, 0.82, NOGLOW];
blue = [0.45, 0.62, 0.95, NOGLOW];
olive = [0.59, 0.53, 0.3];

// ---- The shell dome: a superellipsoid (squarer than an ellipsoid: broad flat top, steep sides, as drawn), centre C,
// radii R, exponent Q; points by azimuth (0 = +X, -90 = the front) and elevation.
C = [0, 4, 14];
R = [17.4, 20, 21];
Q = 0.86;
function sp(v, q) = v == 0 ? 0 : sign(v) * pow(abs(v), q);
function dome(az, el, k = 1) = C + [R[0] * k * sp(cos(el), Q) * sp(cos(az), Q), R[1] * k * sp(cos(el), Q) * sp(sin(az), Q),
                                    R[2] * k * sp(sin(el), Q)];
function domeN(az, el) = let(n = [sp(cos(el), 2 - Q) * sp(cos(az), 2 - Q) / R[0], sp(cos(el), 2 - Q) * sp(sin(az), 2 - Q) / R[1],
                                  sp(sin(el), 2 - Q) / R[2]]) n / norm(n);
// The head and neck turn HY degrees towards the creature's left (+X) about the neck pivot NP, as drawn: the face
// looks straight out of the sprite. Head-frame numbers are the head facing -Y.
NP = [0, -8, 17];
HY = 25;
module headFrame() { translate(NP) rotate([0, 0, HY]) translate(-NP) children(); }
// The hood: the front of the dome is cut away over the head and neck.
module notch() { color(skinDark) headFrame() translate([0, -15, 13.4]) scale([10, 10.4, 11.3]) sphere(1, $fn = 28); }

difference() {
  union() {
    // Dark dome: shows as the grooves between the scutes.
    color(groove) hull() for (az = [0 : 12 : 359], el = [0 : 10 : 90]) translate(dome(az, el)) cube(0.2, center = true);
    // Scutes: plates of the dome's own surface, raised 6 % and cut apart by radial wedges so the dark grooves show
    // between them: the marginal row, two rings of costals and the crown.
    for (i = [0 : 19]) plate4(-90 + i * 18, 18, 0, 15, i % 2 == 0 ? scuteB : scuteA, 1.06, 1.085);
    for (i = [0 : 7]) plate4(-112.5 + i * 45, 45, 15, 40, i % 2 == 0 ? scuteA : scuteB);
    for (i = [0 : 5]) plate4(-90 + i * 60, 60, 40, 64, i % 2 == 0 ? scuteB : scuteA);
    color(scuteA) intersection() {
      hull() for (az = [0 : 12 : 359], el = [0 : 10 : 90]) translate(dome(az, el, 1.06)) cube(0.2, center = true);
      hull() { translate(C) cube(0.2, center = true); for (az = [0 : 30 : 359]) translate(dome(az, 66, 1.3)) cube(0.2, center = true); }
    }
  }
  notch();
}
// One scute: the dome raised to k, inside the wedge from the centre through az0..az0+daz, el0..el1 (less a groove).
module plate4(az0, daz, el0, el1, c, k = 1.06, kb = undef) {
  g = 1.6;
  color(c) intersection() {
    hull() for (az = [az0 - 8 : 8 : az0 + daz + 8], el = [max(0, el0 - 10) : 7.5 : min(90, el1 + 10)])
      translate(dome(az, el, kb == undef ? k : kb + (k - kb) * min(1, el / el1))) cube(0.2, center = true);
    hull() {
      translate(C - [0, 0, 1]) cube(0.2, center = true);
      for (az = [az0 + g, az0 + daz / 2, az0 + daz - g], el = [el0 == 0 ? -4 : el0 + g, el1 - g])
        translate(dome(az, el, 1.4)) cube(0.2, center = true);
    }
  }
}
// Moss highlights on the scutes.
for (s = [[20, 72, 3], [200, 70, 3], [-60, 52, 2.6], [110, 50, 2.8], [-20, 30, 2.4], [160, 30, 2.6], [250, 28, 2.4],
          [60, 26, 2.6], [-30, 8, 1.6], [140, 8, 1.6], [0, 50, 2.4], [180, 52, 2.6], [80, 76, 2.4], [-120, 74, 2.4],
          [30, 8, 1.6], [90, 6, 1.6], [200, 8, 1.6], [-5, 28, 2], [100, 28, 2], [220, 50, 2.2], [40, 50, 2.2]])
  if (!inHood(s[0], s[1]))
    color(mossHi) translate(dome(s[0], s[1], 1.07)) rotate(_dir_rot(domeN(s[0], s[1]))) scale([s[2], s[2] * 0.75, 0.5]) sphere(1, $fn = 8);

// Moss flecks over the plates, light and dark.
for (i = [0 : 39]) let(az = i * 137.5, el = 8 + (i * 29) % 78) if (!inHood(az % 360 - (az % 360 > 180 ? 360 : 0), el))
  color(i % 3 == 0 ? skinDark : mossHi) translate(dome(az, el, 1.068)) rotate(_dir_rot(domeN(az, el)))
    scale([1.1, 0.8, 0.3]) sphere(1, $fn = 5);

// Plastron and the body under the shell.
color(plastron) translate([0, 4, 13]) scale([15.6, 17.6, 2.6]) sphere(1, $fn = 32);
color(skinDark) translate([0, 4, 9.6]) scale([12, 14, 4]) sphere(1, $fn = 24);
// Neck in the hood (dark, the cavity behind the head).
headFrame() color(skinDark) translate([0, -9, 17.5]) scale([6.6, 6, 6.4]) sphere(1, $fn = 20);

// ---- Meadow: grass blades, flower dots, taller flowers and rocks.
module tuft(az, el, n = 5, l = 3.2, seed = 0) {
  p = dome(az, el, 1.06);
  nn = domeN(az, el);
  for (i = [0 : n - 1]) let(a = seed * 37 + i * 360 / n, j = [cos(a) * 0.8, sin(a) * 0.8, 0], d = nn * 0.6 + [0, 0, 1] + j * 0.6,
                            ll = l * (0.7 + 0.15 * ((i * 3 + seed) % 4)))
    color(i % 2 == 0 ? grassA : grassB) translate(p + j * 0.9) rotate(_dir_rot(d)) cylinder(h = ll, r1 = 0.42, r2 = 0, $fn = 4);
}
for (s = [[0, 88, 6, 3.6], [-90, 76, 5, 3.4], [90, 76, 5, 3.4], [-40, 70, 5, 3.6], [40, 72, 5, 3.8], [140, 70, 5, 3.6],
          [220, 72, 5, 3.6], [-140, 66, 5, 3.4], [-10, 56, 4, 3], [170, 56, 4, 3.2], [60, 54, 4, 3], [-70, 52, 4, 3],
          [250, 50, 4, 3], [110, 50, 4, 3.2], [20, 42, 4, 2.8], [200, 42, 4, 2.8], [-110, 46, 4, 3], [80, 40, 4, 3],
          [-30, 24, 4, 2.6], [10, 20, 4, 2.6], [50, 18, 4, 2.6], [150, 20, 4, 2.6], [190, 16, 4, 2.6], [230, 20, 4, 2.6],
          [-140, 24, 4, 2.6], [-160, 12, 4, 2.4], [-40, 10, 3, 2.2], [100, 22, 4, 2.6], [-115, 30, 4, 2.6], [0, 4, 3, 2],
          [-170, 40, 4, 3], [-150, 58, 5, 3.4], [-160, 76, 5, 3.6], [-120, 84, 5, 3.6], [-60, 84, 5, 3.8], [100, 84, 5, 3.8],
          [180, 84, 5, 3.6], [-20, 80, 4, 3.4], [30, 30, 4, 2.6], [70, 8, 3, 2.2], [120, 10, 3, 2.2], [160, 6, 3, 2.2],
          [-150, 4, 3, 2.2], [-175, 22, 4, 2.6], [10, 64, 4, 3], [120, 64, 4, 3]])
  if (!inHood(s[0], s[1])) tuft(s[0], s[1], s[2], s[3], s[0] + s[1]);
// Flower dots in little clusters on the moss.
fl = [yellow, pink, blue];
function inHood(az, el) = abs(az + 65) < 40 && el < 50;
for (i = [0 : 21]) let(az = -70 + i * 23 + floor(i / 16) * 11, el = 22 + (i * 17) % 56) if (!inHood(az, el))
  for (k = [0 : 3]) let(a = i * 50 + k * 90, q = dome(az + 3 * cos(a), el + 3 * sin(a), 1.075))
    color(fl[i % 3]) translate(q) rotate(_dir_rot(domeN(az, el))) scale([0.55, 0.55, 0.3]) sphere(1, $fn = 5);
// Taller flowers on the crown: yellow at the front-left, blue at the back-right.
module flower(az, el, c, h = 3.4) {
  p = dome(az, el, 1.06);
  color(grassA) translate(p) cylinder(h = h, r1 = 0.22, r2 = 0.18, $fn = 4);
  for (a = [0 : 72 : 359]) color(c) translate(p + [0.6 * cos(a), 0.6 * sin(a), h]) scale([0.55, 0.55, 0.32]) sphere(1, $fn = 6);
}
flower(-100, 66, yellow); flower(-120, 60, yellow, 2.6); flower(-80, 70, yellow, 2.8);
flower(60, 74, blue); flower(80, 70, blue, 2.6);
// Rocks.
for (s = [[30, 58, 2.6], [10, 40, 1.8], [-150, 46, 1.9], [160, 66, 2.2], [210, 40, 1.8]])
  let(p = dome(s[0], s[1], 1.07), r = s[2]) {
    color(rock) translate(p) scale([r * 1.2, r, r * 0.8]) sphere(1, $fn = 10);
    color(rockHi) translate(p + [-0.3 * r, -0.3 * r, 0.45 * r]) scale([r * 0.7, r * 0.6, r * 0.45]) sphere(1, $fn = 8);
  }

// ---- Head: a big, old turtle face peering out from under the hood (head frame, facing -Y).
headFrame() translate(HM[0]) scale(1.1) translate(-HM[0]) head();
HM = [[0, -15, 19.4], [5.3, 5, 4.3]];     // cranium
HS = [[0, -18.6, 18.4], [3.3, 2.6, 3.4]]; // snout
HJ = [[0, -15.4, 16], [4.6, 4, 1.6]];     // jaw
// A point on an ellipsoid [centre, radii] in direction d, and its normal there.
function onEll(e, d) = e[0] + d / sqrt(pow(d[0] / e[1][0], 2) + pow(d[1] / e[1][1], 2) + pow(d[2] / e[1][2], 2));
function nEll(e, d) = let(n = [d[0] / pow(e[1][0], 2), d[1] / pow(e[1][1], 2), d[2] / pow(e[1][2], 2)]) n / norm(n);
module headHull(g = 0) {
  hull() for (e = [HM, HS, HJ]) translate(e[0]) scale(e[1] + [g, g, g]) sphere(1, $fn = 24);
}
module head() {
  color(face) headHull();
  // Darker scale patches on the crown, laid on the surface.
  for (d = [[0, -1.5, 4], [2.4, -0.4, 3.6], [-2.4, -0.4, 3.6], [1.3, -3, 3.2], [-1.3, -3, 3.2], [3.6, 1, 2.6], [-3.6, 1, 2.6]])
    color(crown) translate(onEll(HM, d)) rotate(_dir_rot(nEll(HM, d))) scale([1.1, 0.9, 0.25]) sphere(1, $fn = 8);
  // Nostrils.
  mirror_x() color(ink) translate([0.75, -20.9, 19.6]) scale([0.32, 0.3, 0.42]) sphere(1, $fn = 6);
  // Mouth: a wide line round the front of the face at z 16.9, dipping to a V at the beak.
  color(ink) intersection() {
    headHull(0.2);
    translate([-10, -30, 0]) cube([20, 15, 30]);
    union() {
      translate([0, -15, 17.05]) cylinder(h = 0.45, r = 12, $fn = 24);
      mirror_x() hull() {
        translate([1.3, -30, 17.05]) cube([0.01, 20, 0.45]);
        translate([0, -30, 16.35]) cube([0.01, 20, 0.45]);
      }
    }
  }
  mirror_x() {
    // Calm old eyes: black almonds with a catchlight under a heavy dark lid and a soft lower lid.
    eye([3.17, -18.6, 20.6], 1.5, iris = ink, pupil = ink, sclera = [0.06, 0.07, 0.05], yaw = 38, flat = 0.5, lid = 0.3,
        lid_tilt = 6, lid_c = faceDark, squint = 0.16, shine = true);
    // Heavy brow over the eye.
    color(faceDark) hull() {
      translate([3.2, -18, 21.9]) scale([1, 0.8, 0.5]) sphere(1, $fn = 8);
      translate([1.34, -19.27, 21.66]) scale([1, 0.8, 0.5]) sphere(1, $fn = 8);
    }
  }
  // Beard: two rows of long moss strands from under the jaw, hanging nearly to the ground, longest in the middle.
  beardC = [olive, skinLight, faceDark, olive, skin, grassA];
  for (i = [0 : 17]) let(ph = -80 + i * 160 / 17, f = abs(ph) / 80, x = 4.4 * sin(ph), y0 = -15.4 - 4.4 * cos(ph),
                         l = 10.2 - f * f * 4.4 + ((i * 5) % 3) * 0.8, w = ((i * 7) % 5 - 2) * 0.25)
    chain([[x, y0, 15.5], [x * 1.08 + w, y0 - 0.7, 15.4 - l * 0.45], [x * 1.12 - w, y0 - 0.3, 15.4 - l]],
          [0.75, 0.55, 0.22], beardC[i % 6], $fn = 6);
  for (i = [0 : 10]) let(ph = -70 + i * 14, x = 3.6 * sin(ph), y0 = -15.4 - 3.2 * cos(ph), l = 7.6 - abs(ph) / 70 * 2.6)
    chain([[x, y0, 15.3], [x * 1.05, y0 - 0.5, 15.3 - l * 0.5], [x * 1.08, y0, 15.3 - l]], [0.8, 0.6, 0.3],
          [faceDark, olive, skin][i % 3], $fn = 6);
}

// ---- Flippers. Front: a thick upper arm from under the shell down to the elbow on the ground, then a broad flat
// paddle swept out and back to a pointed tip. Back: short paddles.
// A flipper: an upper arm from under the shell to the root of a broad leaf-shaped paddle. The leaf is built along +X
// (root at 0, tip at `len`) and laid along root -> tip, rolled `roll` degrees so its trailing edge rises.
module leaf(len, w, c = skin) {
  color(c) hull() {
    scale([w * 0.7, w * 0.75, 1.3]) sphere(1, $fn = 12);
    translate([len * 0.34, 0, 0]) scale([w, w, 1]) sphere(1, $fn = 14);
    translate([len * 0.68, 0.1 * w, 0]) scale([w * 0.75, w * 0.7, 0.75]) sphere(1, $fn = 12);
    translate([len, 0.25 * w, 0]) scale([1, 1, 0.4]) sphere(1, $fn = 8);
  }
}
function azOf(d) = atan2(d[1], d[0]);
function pitchOf(d) = atan2(-d[2], norm([d[0], d[1]]));
module laid(root, tip, roll) {
  d = tip - root;
  translate(root) rotate([0, 0, azOf(d)]) rotate([0, pitchOf(d), 0]) rotate([roll, 0, 0]) children();
}
module barnacles(pts) {
  for (b = pts) {
    color(barnacle) translate([b[0], b[1], b[2] - 1.2]) cylinder(h = 2.1, r1 = b[3], r2 = b[3] * 0.7, $fn = 9);
    color(barnacleHole) translate([b[0], b[1], b[2] + 0.9]) scale([b[3] * 0.32, b[3] * 0.32, 0.2]) sphere(1, $fn = 7);
  }
}
FS = [9, -4, 13];      // shoulder (under the shell)
FR = [11, -7, 11];     // leaf root
FT = [27.5, -1, 0.6];  // tip
FROLL = 40;
BS = [11, 10, 10];
BR = [12.5, 13, 9];
BT = [16, 23, 4.5];
BROLL = 40;
mirror_x() {
  limb(FS, FR, 2.8, 2.9, skin, $fn = 12);
  laid(FR, FT, FROLL) {
    leaf(norm(FT - FR), 6);
    // Lighter moss patches and the barnacle crust on the leaf's top.
    for (m = [[14.6, 0.4, 2], [17.4, 1.2, 1.4], [12.6, -2.8, 1.3]])
      color(skinLight) translate([m[0], m[1], 0.75]) scale([m[2], m[2] * 0.8, 0.35]) sphere(1, $fn = 8);
    barnacles([[4.6, 0.2, 1.2, 1.15], [6.8, -1.6, 1.1, 1.1], [6, 2, 1.1, 1.0], [8.6, 0.6, 1.0, 1.05], [10.4, -1.8, 0.95, 0.9],
               [9.8, 2.6, 0.9, 0.85], [4, -2.6, 1.1, 0.9], [11.8, 0.8, 0.85, 0.8], [3, 2.4, 1.2, 0.85]]);
  }
  limb(BS, BR, 2.2, 2.2, skin, $fn = 10);
  laid(BR, BT, BROLL) {
    leaf(norm(BT - BR), 4.2);
    barnacles([[2.6, 0.4, 0.9, 0.7]]);
  }
}
// A stub of a tail under the back of the shell.
spike([0, 20, 9], [0, 4, -3], 1.6, 0.2, skin);
