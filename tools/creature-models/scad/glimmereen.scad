// Glimmereen: Glimp grown into a bubble fairy, remodelled on its sprite (2026-11-04).
// Checklist (front sheet; the body's centre is at sheet x -4.85, so the art is shifted by OX = 4.85):
//   body   one big round puff, sheet x -16.4..6.7, z 8.4..27.6: ellipsoid 11.8 x 11 x 9.8 at z 18.2. Warm pearl
//          white, periwinkle under the belly, a white gloss top-left.
//   face   turned about 7 deg towards the viewer as drawn. Two big tall oval eyes (3.2 x 4.5), dark violet with a
//          darker rim, a big white glint in the upper half and a lighter violet lower third; centres sheet x -4.8 /
//          -12.95, z 18.45. A wide flat U smile (sheet x -10.9..-7.4, z 14.2..15.4), plum ink. Pink blush ovals under
//          the outer eye corners (sheet (-2.7, 15.5) and (-14.15, 15.4)).
//   bow    a big pink bow on top: knot sheet (-6.3, 28.4), loops x -11.2..1.2, z 25.4..32.8, tall rounded lobes.
//   antenna lavender stalk rising from the knot, curving to the viewer's left, ending in a gold bead r 2.4 at
//          sheet (-10.7, 37.6) with a pale highlight top-left.
//   wings  two pairs of big translucent butterfly wings behind the body, swept back 6 deg: the upper pair a broad
//          lobe out to sheet (20.8, 35.7) with a notch and a small lower lobe, the lower pair a rounded lobe out to
//          sheet (15.3, 8.5). Pale lilac-white rim, pale sky-blue inside, white four-point sparkles.
//   arms   a fat oval stub each side (near one sheet x 3..9.3, z 10.3..15), tipping a little down outwards.
//   legs   two short round stubs, sheet z 0..9, about 4.8 wide, at x +-4.5; pale with periwinkle soles.
//   back   no face; the pearl body between the wings (back sheet x -6.6..7.3), the bow and the antenna.
include <lib.scad>

pearl = [0.96, 0.95, 0.96, NOGLOW];
peri = [0.77, 0.81, 0.91, NOGLOW];
legC = [0.9, 0.91, 0.97, NOGLOW];
shine = [1, 1, 1, NOGLOW];
blush = [0.93, 0.71, 0.75, NOGLOW];
bowC = [0.9, 0.67, 0.72, NOGLOW];
knotC = [0.84, 0.57, 0.67, NOGLOW];
antC = [0.75, 0.74, 0.91, NOGLOW];
gold = [0.9, 0.76, 0.32, NOGLOW];
goldHi = [0.99, 0.95, 0.75, NOGLOW];
rimC = [0.94, 0.92, 0.98, NOGLOW];
wingC = [0.84, 0.9, 0.98, NOGLOW];
sparkle = [1, 1, 1, NOGLOW];
eyeDark = [0.24, 0.15, 0.4];
eyeMid = [0.29, 0.18, 0.5];
eyeLow = [0.56, 0.43, 0.8];
inkC = [0.3, 0.2, 0.36];

// Body ellipsoid.
B = [11.8, 11, 9.8];
BZ = 18.2;
// The art's offset (sheet x of the body centre is -4.85) and the face's drop on the sheet (the camera looks 10 deg
// down, so the front of the body reads about 1.7 lower than it sits).
OX = 4.85;
FDZ = 1.7;
FACE = 7;   // the face is turned this far towards the viewer
function onBody(psi, z, out = 0) =
  let(k = sqrt(max(0, 1 - pow((z - BZ) / B[2], 2))), d = [sin(psi), -cos(psi), 0])
  [B[0] * k * sin(psi) + out * d[0], -B[1] * k * cos(psi) + out * d[1], z];

module tint(c, d = 0.08) {
  color(c) intersection() {
    translate([0, 0, BZ]) scale(B + [d, d, d]) sphere(1, $fn = 56);
    children();
  }
}
module viewerSide() { pp(0) translate([-60, -60, -10]) cube([120, 60, 60]); }
// A front-sheet outline (art coordinates) as a prism along the view.
module artPrism(pts) { pp(0) translate([OX, 0, FDZ]) rotate([90, 0, 0]) linear_extrude(height = 120, center = true) polygon(pts); }
module artDot(c, r) { pp(0) translate([OX + c[0], 0, FDZ + c[1]]) rotate([90, 0, 0]) scale([r[0], r[1], 1]) cylinder(h = 120, r = 1, center = true, $fn = 20); }

// ---- Body
color(pearl) translate([0, 0, BZ]) scale(B) sphere(1, $fn = 56);
// periwinkle under the belly
tint(peri) translate([0, 0, 3.5]) scale([16, 16, 8.6]) sphere(1, $fn = 28);
// white gloss top-left of the face
tint(shine, 0.14) translate(onBody(-40, 25, 0)) scale([2.6, 2.6, 1.8]) sphere(1, $fn = 16);

// ---- Face
EYE = 1.7;
EZ = 20.1;
EYEZ = 1.36;   // the eyes are tall ovals
module glimEye(psi) {
  translate(onBody(psi, EZ, -0.35)) scale([1, 1, EYEZ]) rotate([0, 0, psi]) {
    eye([0, 0, 0], EYE, iris = eyeMid, sclera = eyeDark, pupil = eyeMid, shine = false, flat = 0.6);
    color(eyeLow) translate([0, -0.66 * EYE, -0.42 * EYE]) scale([0.5, 0.2, 0.34] * EYE) sphere(1, $fn = 14);
    color(shine) translate([-0.05 * EYE, -0.8 * EYE, 0.34 * EYE]) scale([0.5, 0.12, 0.48] * EYE) sphere(1, $fn = 14);
  }
}
glimEye(FACE + 22.5);
glimEye(FACE - 22.5);
// the smile and the blush, traced from the art and laid on the face
tint(inkC, 0.16) intersection() {
  viewerSide();
  artPrism([[-10.95, 15.5], [-10.55, 14.6], [-10.1, 14.15], [-7.95, 14.15], [-7.45, 14.6], [-7.35, 15.5],
    [-7.8, 15.5], [-8.1, 14.95], [-8.3, 14.6], [-9.8, 14.6], [-10.2, 14.95], [-10.5, 15.5]]);
}
tint(blush, 0.12) intersection() {
  viewerSide();
  union() { artDot([-2.7, 15.55], [1.55, 1.15]); artDot([-14.15, 15.4], [1.25, 1]); }
}

// ---- Bow: a knot and two tall rounded loops leaning outwards
KNOT = [0, -1.9, 28.6];
color(knotC) translate(KNOT) scale([1.4, 1.3, 1.7]) sphere(1, $fn = 18);
mirror_x() color(bowC) hull() {
  translate(KNOT + [0.6, 0, 0]) scale([0.8, 1.1, 1.3]) sphere(1, $fn = 14);
  translate([4.7, -1.3, 29.6]) rotate([0, 22, 0]) scale([2.8, 1.8, 3.5]) sphere(1, $fn = 22);
}

// ---- Antenna from the knot, curving to the creature's right, and its gold bead
ANT = [[-0.3, -1.4, 29.2], [-0.95, -1.1, 30.6], [-2.25, -1, 33.9], [-3.65, -1, 35.7], [-4.6, -1, 36.6]];
chain(ANT, [0.75, 0.75, 0.72, 0.7, 0.68], antC);
BEAD = [-6.2, -1, 37.8];
ell([2.4, 2.4, 2.4], BEAD, gold);
ell([1.1, 0.8, 1], BEAD + [-0.9, -1.75, 0.9], goldHi);

// ---- Wings: outlines traced from the near wings on the front sheet, unprojected into a plane through (2, 7.6)
// swept back 6 deg; the far pair is the mirror.
WR = [2, 7.6];
WS = 6;
function wingPt(p) = let(x = (p[0] + 1.155) / 0.9186, y = WR[1] + tan(WS) * (x - WR[0]))
  [(x - WR[0]) / cos(WS), p[1] - 0.17 * y];
function wingPts(ps) = [for (p = ps) wingPt(p)];
UPPER = wingPts([[18.7, 35.7], [20.2, 35], [20.8, 33.3], [20.2, 31], [19.6, 28.7], [18.9, 27.5], [18.5, 26.4],
  [17.7, 25.3], [17.2, 24.7], [13.8, 22.4], [15.1, 21.7], [15.7, 20], [13, 18.1], [10.9, 17.5], [7.1, 17.7],
  [1, 19.5], [0, 23], [2, 25.5], [4.3, 27.6], [7.3, 30.4], [10.5, 32.7], [14.1, 34.6], [16.5, 35.4]]);
LOWER = wingPts([[3, 17], [7.9, 17.1], [10, 16.4], [12, 14.8], [14.3, 12.5], [15.3, 10.6], [14.9, 8], [12.8, 7.2],
  [10.5, 7.4], [7.5, 8], [5, 9.2], [2.5, 10.8], [1, 14]]);
WD = 2.2;
module star(p, s) {
  for (y = [-1, 1]) translate([p[0], y * (WD / 2 + 0.02), p[1]]) {
    color(sparkle) scale([s, 0.16, 0.22 * s]) sphere(1, $fn = 8);
    color(sparkle) scale([0.22 * s, 0.16, s]) sphere(1, $fn = 8);
  }
}
module wing(pts, stars) {
  slab(pts, WD, rimC, inset = 1.2);
  slab(pts, WD + 0.5, wingC, inset = 1.2, grow = -0.55);
  for (s = stars) star(wingPt(s[0]), s[1]);
}
mirror_x() translate([WR[0], WR[1], 0]) rotate([0, 0, WS]) {
  wing(UPPER, [[[9.9, 28], 1.5], [[15.5, 31.6], 0.8], [[12.6, 21.6], 0.5], [[17.6, 33.4], 0.45]]);
  wing(LOWER, [[[11.2, 11.8], 0.9], [[13.4, 9.4], 0.5]]);
}

// ---- Arms: fat oval stubs, tipping a little down outwards
mirror_x() color(pearl) translate([12.6, -0.5, 12.9]) rotate([0, 15, 0]) scale([3.6, 2.3, 2.25]) sphere(1, $fn = 22);

// ---- Legs: short round stubs with periwinkle soles
mirror_x() {
  limb([4.5, 1, 2.8], [4.5, 1, 10], 2.8, 2.35, legC);
  color(peri) intersection() {
    translate([4.5, 1, 2.8]) sphere(2.86);
    translate([0, -5, -1]) cube([10, 12, 2.2]);
  }
}
