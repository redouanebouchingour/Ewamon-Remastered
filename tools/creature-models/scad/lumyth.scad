// Lumyth: a cosmic spirit girl in deep violet. A soft round lavender face framed by a hood of starry hair, big glowing
// violet eyes with a lash flick, a small smile, a sparkle on the brow; a gold ring of stars over the head; a small
// slender torso with the arms bent and open palms raised; a dark starry drape of hair behind the shoulders with long
// wavy locks flowing out and down on both sides; leaf-shaped fairy wings (three lobes, pale iridescent root, crescent moon, sparkles); the long hair falls
// down the front as one wavy column with pink and cyan streaks, sweeps right and coils into a spiral galaxy disc on
// the ground; pale smoke strands curl outward and down from the locks.
//
// Checklist (front sheet x, z; the art's body axis is at sheet x -2, so scad x 0 = sheet -2, OX below):
//   head / hair ball   x -8..2.4, z 25.5..37      deep violet hair, pale rim round the face, swirl on the back
//   face disc          x -6.9..0.9, z 26.3..33.5  lavender; eyes at (-1.5, 29.6) near and (-6.1, 29.6) far, ~2.1 wide
//   mouth              (-4, 27.4) small smile;  brow sparkle (-4.3, 31.3)
//   top curl           (0.5, 34.8) -> (5.6, 36.7) -> hooks to (6, 38.6)
//   halo               x -8..2.3, z 37..39.8      seven gold stars on a ring
//   torso / arms       chest z 20..25; elbows (0.9, 21.2) / (-7, 22.1); palms up at (3.4, 24.5) / (-8.5, 26)
//   back hair / locks  shoulders z 24.5, locks flowing out to tips at (11.5, 15.5) and (-12.8, 15.8); drape navy inside
//   wings              near x 2..16.3, z 23..35.3; far x -16..-6; three lobes, pale root, crescent moon at (8.3, 27.6)
//   hair column        z 23 -> 11 down the middle (x -6.5..1), sweeps right to (7.4, 7), back into the disc
//   galaxy disc        centre (0, 3.6), r 3.6: pink / cyan arms, white core
//   tendrils           near (6.6, 16.9) -> (14, 11.5) curling; far (-9.2, 15.7) -> (-12.6, 11.5), (-8.3, 14.6) -> (-7.5, 7.6)
//   back               the drape's big pink / cyan galaxy swirl, a swirl on the back of the head, crescent wings
include <lib.scad>

OX = 2;   // sheet x + OX = the scad's own sheet x (the art's body axis sits at sheet x -2)
function S(sx, z, y = 0) = fromSheet(sx + OX, z, y);

skin = [0.66, 0.61, 0.9];
hair = [0.37, 0.27, 0.63];
hairDark = [0.2, 0.12, 0.44];
rim = [0.74, 0.7, 0.94];
pink = [0.82, 0.6, 0.94, NOGLOW];
cyan = [0.6, 0.82, 0.97, NOGLOW];
core = [0.96, 0.93, 0.99, NOGLOW];
cape = [0.29, 0.2, 0.54];
capeIn = [0.14, 0.08, 0.33];
lockA = [0.34, 0.24, 0.6];
lockB = [0.42, 0.3, 0.7];
wingC = [0.72, 0.64, 0.95];
wingPale = [0.87, 0.83, 0.98, NOGLOW];
moon = [0.97, 0.84, 0.97, NOGLOW];
star = [1, 0.98, 0.94, NOGLOW];
gold = [0.98, 0.82, 0.42, NOGLOW];
goldDark = [0.78, 0.58, 0.28];
tendril = [0.6, 0.56, 0.86];
ink = [0.18, 0.09, 0.4];
iris = [0.64, 0.38, 0.9, NOGLOW];
glint = [0.99, 0.84, 1, NOGLOW];

// ---- helpers
module stripe2d(pts, w) {
  for (i = [0 : len(pts) - 2]) hull() { translate(pts[i]) circle(w, $fn = 8); translate(pts[i + 1]) circle(w, $fn = 8); }
}
// A stripe drawn on the FRONT sheet (sheet coords), as a prism along the view: intersect a grown body with it.
module viewPaint(pts, w) {
  pp(0) rotate([90, 0, 0]) linear_extrude(height = 120, center = true) stripe2d([for (p = pts) [p[0] + OX, p[1]]], w);
}
// A stripe in scad (x, z), as a prism over the back half (y > 0).
module backPaint(pts, w) { rotate([90, 0, 0]) translate([0, 0, -60]) linear_extrude(60) stripe2d(pts, w); }
function spiral(c, R, turns, n = 16, ph = 0, dir = 1) =
  [for (i = [0 : n]) let(t = i / n, a = ph + dir * t * 360 * turns, rr = R * (0.1 + 0.9 * t)) c + [rr * cos(a), rr * sin(a)]];
// Four-point sparkle lying in the XZ plane (turn it with rz to sit on a surface).
module sparkle(p, s = 0.6, rz = 0) {
  color(star) translate(p) rotate([0, 0, rz]) {
    scale([s, 0.12, s * 0.22]) sphere(1, $fn = 6);
    scale([s * 0.22, 0.12, s]) sphere(1, $fn = 6);
  }
}
module star5(r, c) {
  color(c) rotate([90, 0, 0]) linear_extrude(0.8, center = true)
    polygon([for (i = [0 : 9]) let(a = 90 + i * 36, rr = (i % 2 == 0) ? r : r * 0.45) [rr * cos(a), rr * sin(a)]]);
}

// ---- head: the hair ball with the face set in a hood
HEAD = [[5.6, 5.0, 5.9], [0, -0.4, 31.5]];
FACE = [[4.4, 4.2, 4.3], [0, -2.2, 29.8]];
color(hair) difference() {
  ell(HEAD[0], HEAD[1]);
  translate([0, -3, 29.9]) rotate([90, 0, 0]) cylinder(h = 10, r = 3.9, $fn = 32);
}
color(skin) translate(FACE[1]) scale(FACE[0]) sphere(1, $fn = 40);
// pale rim of the hood round the face, painted on the hair
color(rim) intersection() {
  ell(HEAD[0] + [0.15, 0.15, 0.15], HEAD[1]);
  translate([0, -2, 29.9]) rotate([90, 0, 0]) linear_extrude(10) difference() { circle(4.5, $fn = 32); circle(3.9, $fn = 32); }
}

// eyes: big ovals, dark rim, violet iris, a bright pink-white core, a lash flick at the outer top corner
mirror_x() {
  eye([2.55, -5.2, 29.6], 1.3, iris = iris, sclera = ink, pupil = glint, yaw = 12);
  // the art's big glowing pink-white core
  color(glint) translate([2.55, -5.2, 29.6]) rotate([0, 0, 12]) translate([0.05, -0.92, -0.05]) scale([0.5, 0.22, 0.62]) sphere(1, $fn = 14);
  color(ink) translate([3.8, -4.7, 30.9]) rotate([0, 0, 12]) rotate([0, -35, 0]) scale([0.65, 0.18, 0.2]) sphere(1, $fn = 10);
}
// small smile
color(ink) translate([0, -5.55, 27.75]) rotate([90, 0, 0]) intersection() {
  rotate_extrude($fn = 20) translate([0.75, 0]) circle(0.12, $fn = 6);
  translate([-2, -2.3, -1]) cube([4, 2, 2]);
}
sparkle([-0.4, -5.95, 32.0], 0.6);

// back of the head: a pink / cyan swirl painted on the hair
color(pink) intersection() { ell(HEAD[0] + [0.2, 0.2, 0.2], HEAD[1]); backPaint(spiral([0.3, 32.6], 3.6, 1.4, 16, 0), 0.38); }
color(cyan) intersection() { ell(HEAD[0] + [0.2, 0.2, 0.2], HEAD[1]); backPaint(spiral([0.3, 32.6], 3.2, 1.2, 14, 180), 0.3); }
for (p = [[-2.5, 4.4, 34.5], [2.8, 4.5, 30], [1.4, 5.2, 33.8]]) sparkle(p, 0.45);

// top curl: rises off the crown to the viewer's right and hooks over
CURL = [S(0.5, 34.8), S(3, 35), S(5, 35.6), S(5.6, 36.7), S(4.6, 37.6), S(4.8, 38.4), S(6, 38.6)];
CURL_R = [1.6, 1.3, 1.0, 0.8, 0.6, 0.45, 0.22];
chain(CURL, CURL_R, hair);
// side locks: break away from the head beside the cheeks and fall past the shoulders
LOCK = [[3.9, -0.6, 32.6], [5.4, -0.9, 30.6], [5.0, -1.2, 28.6], [3.6, -1.2, 26.8], [2.6, -1.0, 24.8], [2.5, -1.2, 22.4], [2.4, -1.0, 19.8]];
LOCK_R = [1.5, 1.25, 1.05, 1.0, 1.0, 1.0, 0.85];
mirror_x() {
  chain(LOCK, LOCK_R, hair);
}

// halo: a ring of seven gold stars above the head
translate([0, -1, 38.1]) rotate([16, 0, 0]) {
  color(goldDark) rotate_extrude($fn = 36) translate([4.8, 0]) circle(0.3, $fn = 6);
  for (a = [0 : 360 / 7 : 359]) translate([4.8 * cos(a - 90), 4.8 * sin(a - 90), 0.5]) rotate([0, 0, a]) star5(a > 100 && a < 260 ? 1.1 : 1.4, gold);
}

// ---- torso and arms (open palms raised)
blob([[[1.0, 0.9, 1.2], [0, -0.6, 25.0]], [[2.2, 1.7, 1.8], [0, -0.3, 22.7]], [[1.7, 1.4, 1.4], [0, 0, 20.6]]], skin);
sparkle([-0.9, -2.05, 22.9], 0.55, -10);
SH = [2.1, -0.4, 23.5]; EL = [4.4, -1.1, 21.5]; HA = [6.3, -2.2, 24.5];
mirror_x() {
  limb(SH, EL, 0.8, 0.65, skin);
  limb(EL, HA, 0.65, 0.55, skin);
  translate(HA + [0.1, 0, 0.4]) rotate([0, 25, 0]) {
    color(skin) scale([0.95, 0.75, 0.42]) sphere(1, $fn = 14);
    for (f = [[-0.6, -0.3], [-0.1, -0.5], [0.45, -0.35], [0.85, 0.1]]) color(skin) translate([f[0], f[1], 0.45]) scale([0.18, 0.18, 0.42]) sphere(1, $fn = 8);
  }
}

// ---- the back hair: a soft drape behind the shoulders (navy and starry inside, the galaxy swirl on its back), and
// long wavy locks flowing out and down from the shoulders on both sides, tapering to nothing
module capeHull(k = 0) {
  union() {
    hull() {
      translate([0, 1.2, 24.6]) scale([3.4 - k, 2.4 - k, 0.4]) sphere(1, $fn = 24);
      translate([0, 2.2, 21.5]) scale([6.0 - k, 4.2 - k, 0.4]) sphere(1, $fn = 28);
    }
    hull() {
      translate([0, 2.2, 21.5]) scale([6.0 - k, 4.2 - k, 0.4]) sphere(1, $fn = 28);
      translate([0, 2.8, 14.5]) scale([7.4 - k, 5.0 - k, 0.4]) sphere(1, $fn = 32);
    }
  }
}
module capeCut() { translate([0, -9.2, 18]) cube([40, 16, 30], center = true); }
color(cape) difference() { capeHull(0); capeHull(0.35); capeCut(); }
color(capeIn) difference() { capeHull(0.35); capeHull(0.7); capeCut(); translate([0, 0, 25.6]) cube([40, 40, 4], center = true); }
// the galaxy swirl on the drape's back
color(pink) intersection() { difference() { capeHull(-0.15); capeHull(0.1); } backPaint(spiral([0, 19.4], 4.8, 1.5, 20, 0), 0.55); translate([0, 25, 18]) cube([40, 40, 30], center = true); }
color(cyan) intersection() { difference() { capeHull(-0.15); capeHull(0.1); } backPaint(spiral([0, 19.4], 4.2, 1.3, 18, 180), 0.42); translate([0, 25, 18]) cube([40, 40, 30], center = true); }
color(core) intersection() { difference() { capeHull(-0.2); capeHull(0.1); } backPaint([[0, 19.4], [0.2, 19.6]], 0.85); translate([0, 25, 18]) cube([40, 40, 30], center = true); }
for (p = [[-4.2, 6.6, 17.6], [4.4, 6.8, 16.8], [2.6, 5.4, 22.4], [-2.8, 5.2, 22.8]]) sparkle(p, 0.5, atan2(p[0], 8));
for (p = [[-5, -0.2, 19], [5, 0, 18.4]]) sparkle(p, 0.5, -30);

// A flat tapered ribbon (a hair lock, a smoke strand): width ws[i] in the XZ plane, 2 t thick.
module ribbon(pts, ws, t, c) {
  color(c) for (i = [0 : len(pts) - 2]) hull() {
    translate(pts[i]) scale([ws[i], t, ws[i]]) sphere(1, $fn = 10);
    translate(pts[i + 1]) scale([ws[i + 1], t, ws[i + 1]]) sphere(1, $fn = 10);
  }
}
// three locks per side, overlapping into one flowing mass: broad at the drape, fanning out and down to soft points
LOCKS = [
  [[[5, 2.4, 22.6], [8, 2.6, 21.2], [10.8, 2.5, 19.4], [12.8, 2.3, 17.4], [14, 2.1, 15.6], [15, 1.9, 14.6]], [2.0, 2.0, 1.8, 1.4, 0.8, 0.15]],
  [[[5.4, 3.2, 20.4], [7.6, 3.4, 18.4], [9.6, 3.2, 16.2], [11, 3.0, 14.0], [12.2, 2.8, 12.4], [13.2, 2.6, 11.8]], [2.0, 1.9, 1.7, 1.3, 0.7, 0.12]],
  [[[5.6, 3.6, 17.6], [6.8, 3.6, 15.2], [7.6, 3.4, 13.0], [8.6, 3.2, 11.2], [9.8, 3.0, 10.0]], [1.8, 1.7, 1.4, 0.9, 0.12]],
];
mirror_x() for (k = [0 : 2]) ribbon(LOCKS[k][0], LOCKS[k][1], 0.45, k == 1 ? lockB : lockA);

// ---- the hair column: falls down the front, sweeps right, coils back into the galaxy disc
COL = [S(-2.2, 21.5, 0.6), S(-2.4, 19.5, 0.5), S(-3.0, 16.8, 0.4), S(-2.9, 13.8, 0.3), S(-1.2, 11.4, 0.2), S(2.2, 9.9, 0.1),
       S(5.6, 8.7, 0), S(7.4, 7.0, 0), S(6.6, 5.2, 0), S(4.4, 4.9, 0), S(2.4, 5.8, 0), S(1.0, 6.7, 0)];
COL_R = [2.4, 3.0, 3.3, 3.3, 3.0, 2.5, 2.1, 1.7, 1.4, 1.2, 1.0, 0.8];
COL_SY = 0.8;   // the column is a little flatter than wide
scale([1, COL_SY, 1]) chain(COL, COL_R, hair, $fs = 1);
module colGrown(g) { scale([1, COL_SY, 1]) chain(COL, [for (r = COL_R) r + g], $fs = 1); }
// streaks along the column (front and back)
color(pink) intersection() { colGrown(0.15); viewPaint([[-1.4, 21], [-1.6, 18.9], [-3.4, 16.3], [-3.7, 13.6], [-2.4, 11.8], [0.4, 10.9], [4, 10.0], [6.5, 8.4], [7.1, 6.6]], 0.42); }
color(cyan) intersection() { colGrown(0.15); viewPaint([[-3.6, 21], [-4.6, 18.4], [-5.2, 15.2], [-4.8, 12.4], [-2.8, 10.4], [0.5, 9.3], [3.8, 8.3], [5.6, 6.8]], 0.36); }
color(hairDark) intersection() { colGrown(0.12); viewPaint([[0.2, 20], [-0.4, 17], [-0.4, 14], [1.2, 12], [4.4, 11.0], [7.6, 9.4], [8.6, 7.4], [7.6, 5.0]], 0.6); }
for (p = [S(-1, 15.5, -2.4), S(1.5, 11.6, -2.2), S(5.4, 9.9, -1.7)]) sparkle(p, 0.45, 30);

// ---- the galaxy disc on the ground: a coiled pillow facing the view, painted with spiral arms
DISC = [[3.6, 1.4, 3.6], [OX, 0, 3.6]];   // in the picture plane (pp)
pp(0) {
  ell(DISC[0], DISC[1], hair);
  color(pink) intersection() { ell(DISC[0] + [0, 0.15, 0], DISC[1]); rotate([90, 0, 0]) linear_extrude(10, center = true) stripe2d(spiral([OX, 3.6], 3.1, 1.25, 16, 30, -1), 0.4); }
  color(cyan) intersection() { ell(DISC[0] + [0, 0.15, 0], DISC[1]); rotate([90, 0, 0]) linear_extrude(10, center = true) stripe2d(spiral([OX, 3.6], 2.6, 1.1, 14, 210, -1), 0.36); }
  color(core) intersection() { ell(DISC[0] + [0, 0.18, 0], DISC[1]); rotate([90, 0, 0]) linear_extrude(10, center = true) translate([OX, 3.6]) circle(0.8, $fn = 12); }
}

// ---- wings: leaf wings with three lobes, spread sideways off the upper back
WING = [[2, 24.3], [3.5, 26.5], [5, 28.5], [6.3, 29.8], [8, 30.4], [10, 30.6], [12, 31.3], [13.5, 32.4], [15, 34.4], [16.1, 35.3],
        [16.3, 34], [15.6, 32], [14.4, 30.3], [13, 29.1], [11.6, 27.9], [10.2, 27.4], [11.5, 27.6], [13.3, 28.4], [14.3, 28.6],
        [13.7, 27.3], [12.4, 25.9], [11, 25.1], [9.5, 24.9], [7.8, 24.8], [9.5, 24.3], [11.1, 23.7], [10, 23.1], [8.5, 23],
        [7.2, 23.2], [6.2, 23.7], [5, 24], [3.5, 24.2]];
function wpt(p) = [(p[0] - 0.15) / 0.866, p[1] - 0.7];
WY = 4.3;
module wingFlat(t, c, g = 0.45) { translate([0, WY, 0]) plate([for (p = WING) wpt(p)], t, 0.3, c, g); }
mirror_x() {
  wingFlat(0.8, wingC);
  // pale iridescent root
  color(wingPale) intersection() { wingFlat(1.0, undef); translate([wpt([1.6, 0])[0], WY, wpt([0, 24.6])[1]]) rotate([90, 0, 0]) cylinder(h = 4, r = 6.2, center = true, $fn = 32); }
  color(cyan) intersection() { wingFlat(1.05, undef); translate([0, WY, 0]) rotate([90, 0, 0]) linear_extrude(4, center = true) stripe2d([wpt([3.4, 25.6]), wpt([5.2, 28.2]), wpt([7.6, 29.4])], 0.28); }
  color(pink) intersection() { wingFlat(1.05, undef); translate([0, WY, 0]) rotate([90, 0, 0]) linear_extrude(4, center = true) stripe2d([wpt([3.6, 24.8]), wpt([6, 25.2]), wpt([7.6, 24.3])], 0.28); }
  // crescent moon (both faces), open towards the root
  for (s = [-1, 1]) color(moon) translate([wpt([8.3, 27.6])[0], WY + s * 0.45, wpt([8.3, 27.6])[1]]) rotate([90, 0, 0])
    linear_extrude(0.2, center = true) difference() { circle(1.45, $fn = 22); translate([-0.75, 0.15]) circle(1.2, $fn = 22); }
  // sparkles (both faces)
  for (q = [[12.2, 30.3, 0.6], [10.7, 29.5, 0.45], [10.2, 26.6, 0.5], [5.3, 27.3, 0.45], [6.1, 24.6, 0.45]], s = [-1, 1])
    sparkle([wpt(q)[0], WY + s * 0.5, wpt(q)[1]], q[2]);
}

// ---- pale smoke strands: one per side, out of the middle lock, waving down and flicking outward at the end
FR = [[10.5, 2.6, 15], [12.8, 2.4, 13.6], [14.8, 2.2, 12.0], [15.4, 2.0, 10.0], [14.6, 1.9, 8.2], [15.2, 1.8, 6.8], [16.2, 1.8, 6.6]];
FR_W = [0.5, 0.5, 0.45, 0.38, 0.28, 0.15, 0.04];
mirror_x() ribbon(FR, FR_W, 0.28, tendril);
