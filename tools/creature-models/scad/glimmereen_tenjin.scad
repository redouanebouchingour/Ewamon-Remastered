// Glimmereen Tenjin: Glimmereen ascended, remodelled on its sprite (2026-11-04) from scad/glimmereen.scad.
// Checklist (front sheet; the body's centre is at sheet (-4.65, 17.1) and the body reads about 0.95 of the base's
// size because the art also fits the ribbons and the sun in its 40 units, so every art point goes through ART()):
//   body   the base's pearl puff, periwinkle under the belly, thin gold kintsugi seams over it (down the near side,
//          one on the far cheek, two on the back).
//   face   eyes closed in a serene smile: two wide U arcs with a flick at each end (sheet x -6.3..-1.2 and
//          -14.5..-11.1, z 16..17.5), plum ink; a small U smile (x -10.5..-7.2, z 13..14.2); pink blush ovals.
//   bow    lavender-pink, the base's bow; the knot sheet (-6.1, 26.6).
//   antenna gold from the knot up and to the creature's right, a gold sun-bead r 2.3 at sheet (-10.4, 35.6) with
//          eight short rays (glows).
//   ribbons two cream-gold streamers from the bow: one up from the knot to sheet (0.3, 39.3), one from behind the
//          near loop out and up to sheet (11.5, 38.4).
//   halo   a big gold ring round the head top, sheet x -11.8..9, z 22.3..33.3 (front dipping), a small ring standing
//          on its back edge at sheet (1.7, 33.3).
//   wings  the base's two pairs but pointed: upper tips at sheet (20.6, 36.8), lower tips down at (17.2, 1.9); a gold
//          rim, sky blue at the root through mint to pale gold at the tips, white sparkles.
//   arms, legs  the base's.
//   sparkles  a few small gold stars floating round it (glow).
//   back   no face; the seams, the wings, the halo, the bow and the sun.
include <lib.scad>

pearl = [0.96, 0.95, 0.96, NOGLOW];
peri = [0.77, 0.81, 0.91, NOGLOW];
legC = [0.9, 0.91, 0.97, NOGLOW];
shine = [1, 1, 1, NOGLOW];
blush = [0.93, 0.71, 0.75, NOGLOW];
bowC = [0.94, 0.84, 0.95, NOGLOW];
knotC = [0.82, 0.75, 0.92, NOGLOW];
antC = [0.93, 0.8, 0.45, NOGLOW];
ribbonC = [0.96, 0.9, 0.7, NOGLOW];
haloC = [0.88, 0.72, 0.36, NOGLOW];
seamC = [0.84, 0.66, 0.3, NOGLOW];
sunC = [0.96, 0.8, 0.36, GLOW];
rayC = [0.97, 0.92, 0.5, GLOW];
moteC = [0.98, 0.9, 0.55, GLOW];
rimT = [0.92, 0.8, 0.52, NOGLOW];
creamW = [0.96, 0.9, 0.74, NOGLOW];
mintW = [0.86, 0.95, 0.84, NOGLOW];
blueW = [0.84, 0.92, 0.98, NOGLOW];
sparkle = [1, 1, 1, NOGLOW];
inkC = [0.3, 0.2, 0.36];

// Body ellipsoid (the base's).
B = [11.8, 11, 9.8];
BZ = 18.2;
FDZ = 1.7;
// The art: body centre and scale against the base body.
AC = [-4.65, 17.1];
AK = 0.95;
// A point read off the front art at sheet (sx, sz), placed at scad depth y.
function ART(sx, sz, y = 0) = let(rx = (sx - AC[0]) / AK, rz = (sz - AC[1]) / AK + BZ) [(rx - 0.5 * y) / 0.866, y, rz - 0.17 * y];
function ARTS(ps, y = 0) = [for (p = ps) ART(p[0], p[1], y)];
function onBodyE(az, el, g = 1.006) = [B[0] * g * cos(el) * sin(az), -B[1] * g * cos(el) * cos(az), BZ + B[2] * g * sin(el)];

module tint(c, d = 0.08) {
  color(c) intersection() {
    translate([0, 0, BZ]) scale(B + [d, d, d]) sphere(1, $fn = 56);
    children();
  }
}
module viewerSide() { pp(0) translate([-60, -60, -10]) cube([120, 60, 60]); }
// A front-art outline as a prism along the view, scaled from the art onto the body.
module artPrism(pts) {
  pp(0) translate([0, 0, BZ + FDZ]) scale(1 / AK) translate([-AC[0], 0, -AC[1]]) rotate([90, 0, 0])
    linear_extrude(height = 120 * AK, center = true) polygon(pts);
}
module artDot(c, r) {
  pp(0) translate([0, 0, BZ + FDZ]) scale(1 / AK) translate([c[0] - AC[0], 0, c[1] - AC[1]]) rotate([90, 0, 0])
    scale([r[0], r[1], 1]) cylinder(h = 120, r = 1, center = true, $fn = 20);
}
// A flat four-point star facing the viewer.
module star4(p, s, c) {
  translate(p) rotate([0, 0, 30]) color(c) {
    scale([s, 0.25 * s, 0.24 * s]) sphere(1, $fn = 8);
    scale([0.24 * s, 0.25 * s, s]) sphere(1, $fn = 8);
  }
}

// ---- Body
color(pearl) translate([0, 0, BZ]) scale(B) sphere(1, $fn = 56);
tint(peri) translate([0, 0, 3.5]) scale([16, 16, 8.6]) sphere(1, $fn = 28);
tint(shine, 0.14) translate([-6.5, -7.6, 25]) scale([2.6, 2.6, 1.8]) sphere(1, $fn = 16);
// gold kintsugi seams
for (seam = [[[50, 62], [60, 42], [76, 18], [82, 0], [76, -24], [68, -44], [58, -62]],
             [[-44, 52], [-32, 36], [-36, 22], [-28, 8]], [[-32, 36], [-20, 30]],
             [[150, 45], [165, 20], [150, 0], [170, -25], [160, -45]], [[210, 30], [195, 10], [215, -15]]])
  chain([for (q = seam) onBodyE(q[0], q[1])], [for (q = seam) 0.2], seamC, $fn = 6);

// ---- Face: closed serene eyes, the smile and the blush, traced from the art and laid on the face
tint(inkC, 0.16) intersection() {
  viewerSide();
  union() {
    artPrism([[-6.3, 17.55], [-5.9, 17.05], [-5.3, 16.45], [-4.5, 16.05], [-3.5, 16.0], [-2.6, 16.3], [-1.9, 16.75],
      [-1.15, 16.85], [-1.25, 17.3], [-2.0, 17.25], [-2.8, 16.85], [-3.6, 16.6], [-4.6, 16.6], [-5.4, 16.95], [-5.9, 17.6]]);
    artPrism([[-14.6, 17.2], [-13.9, 16.7], [-13.4, 16.25], [-12.7, 16.0], [-12.0, 16.15], [-11.5, 16.55], [-11.05, 17.35],
      [-11.5, 17.4], [-11.95, 16.75], [-12.6, 16.55], [-13.3, 16.75], [-13.95, 17.25]]);
    artPrism([[-10.5, 14.15], [-9.9, 13.25], [-9.55, 12.95], [-7.95, 12.95], [-7.6, 13.25], [-7.15, 14.15], [-7.6, 14.15],
      [-8.05, 13.4], [-9.45, 13.4], [-10.1, 14.15]]);
  }
}
tint(blush, 0.12) intersection() {
  viewerSide();
  union() { artDot([-2.6, 14.5], [1.5, 1.05]); artDot([-13.5, 14.4], [1.25, 0.95]); }
}

// ---- Bow (the base's, lavender)
KNOT = [0, -1.9, 28.6];
color(knotC) translate(KNOT) scale([1.4, 1.3, 1.7]) sphere(1, $fn = 18);
mirror_x() color(bowC) hull() {
  translate(KNOT + [0.6, 0, 0]) scale([0.8, 1.1, 1.3]) sphere(1, $fn = 14);
  translate([4.7, -1.3, 29.6]) rotate([0, 22, 0]) scale([2.8, 1.8, 3.5]) sphere(1, $fn = 22);
}

// ---- Antenna and its sun-bead
ANT = [[-0.3, -1.4, 29.2], [-0.82, -1, 30.05], [-1.43, -1, 32.47], [-2.52, -1, 34.57], [-3.98, -1, 36.37]];
chain(ANT, [0.62, 0.6, 0.58, 0.55, 0.52], antC);
SUN = [-6.41, -1, 37.87];
ell([2.4, 2.4, 2.4], SUN, sunC);
ell([1, 0.7, 0.9], SUN + [-0.8, -1.75, 0.9], [1, 0.97, 0.8, NOGLOW]);
for (a = [0 : 45 : 315]) let(d = [cos(a) * cos(30), cos(a) * sin(30), sin(a)])
  spike(SUN + d * 2.2, d * 1.7, 0.55, 0.08, rayC);

// ---- Two ribbon streamers from the bow
RIBA = [[-0.6, 0.2, 29], [-1.07, 0.5, 30.1], [-0.72, 0.5, 32.75], [0.01, 0.5, 35.2], [0.01, 0.5, 37.5], [1.11, 0.5, 39.6],
  [3.29, 0.5, 41.2], [5.73, 0.5, 41.5]];
RIBB = [[3.6, 0.2, 28.6], [5.45, 0.5, 28.44], [8.77, 0.5, 29.7], [11.44, 0.5, 31.2], [12.9, 0.5, 33.1], [13.75, 0.5, 35.3],
  [14.97, 0.5, 37.6], [16.73, 0.5, 39.5], [19.34, 0.5, 40.5]];
chain(RIBA, [0.6, 0.65, 0.65, 0.62, 0.62, 0.6, 0.58, 0.45], ribbonC);
chain(RIBB, [0.6, 0.65, 0.65, 0.65, 0.62, 0.62, 0.6, 0.58, 0.45], ribbonC);

// ---- The halo: a big gold ring round the head top, its front dipping 30 deg, and a small ring on its back edge
HALO = [3.35, 1, 29.3];
HR = 10.9;
translate(HALO) rotate([0, 0, 30]) rotate([30, 0, 0]) {
  color(haloC) rotate_extrude($fn = 56) translate([HR, 0]) circle(0.48, $fn = 8);
  rotate([0, 0, -17.6]) translate([0, HR, 1.5]) rotate([90, 0, 0]) color(haloC)
    rotate_extrude($fn = 20) translate([1.1, 0]) circle(0.32, $fn = 6);
}

// ---- Wings: pointed outlines traced from the near wings, unprojected into the base's wing plane (through (2, 7.6),
// swept back 6 deg); a gold rim, then sky blue at the root, mint in the middle and pale gold at the tips.
WR = [2, 7.6];
WS = 6;
function wingPt(p) = let(rx = (p[0] - AC[0]) / AK, rz = (p[1] - AC[1]) / AK + BZ, x = (rx - 3.695) / 0.9186,
  y = WR[1] + tan(WS) * (x - WR[0])) [(x - WR[0]) / cos(WS), rz - 0.17 * y];
function wingPts(ps) = [for (p = ps) wingPt(p)];
UPPER = wingPts([[20.6, 36.8], [19.3, 36.6], [15, 33], [11.5, 31.2], [8.5, 28.8], [5.5, 26.2], [2, 24], [0, 21], [2, 17.5],
  [6.4, 16.6], [10.3, 16.6], [14.2, 18.6], [14.4, 20.2], [13, 21.1], [15.7, 23.9], [17, 24.6], [18.2, 27.2], [18.7, 30.6],
  [20.2, 34.1]]);
LOWER = wingPts([[3, 16], [8.7, 16.3], [12.2, 13.6], [14.6, 10.8], [15.9, 7.8], [16.9, 4.5], [17.2, 1.9], [16.2, 1.9],
  [14.2, 3.9], [11.2, 6.6], [8.2, 8.8], [5.5, 10.4], [2.5, 12]]);
WD = 1.8;
module slabShape(pts, depth, inset, grow) {
  hull() for (k = [[0, 0.1], [0.45, 0.6], [1, 1]])
    rotate([90, 0, 0]) linear_extrude(height = max(0.1, depth * k[1]), center = true) offset(r = grow - inset * k[0]) polygon(pts);
}
module wing(pts, root, r1, r2, stars) {
  slab(pts, WD, rimT, inset = 1.2);
  for (z = [[blueW, 0, r1], [mintW, r1, r2], [creamW, r2, 60]]) color(z[0]) intersection() {
    slabShape(pts, WD + 0.6, 0.6, -0.3);
    difference() {
      translate([root[0], 0, root[1]]) rotate([90, 0, 0]) cylinder(h = 10, r = z[2], center = true, $fn = 32);
      if (z[1] > 0) translate([root[0], 0, root[1]]) rotate([90, 0, 0]) cylinder(h = 12, r = z[1], center = true, $fn = 32);
    }
  }
  for (s = stars) for (y = [-1, 1]) translate([wingPt(s[0])[0], y * (WD / 2 + 0.27), wingPt(s[0])[1]]) color(sparkle) {
    scale([s[1], 0.16, 0.22 * s[1]]) sphere(1, $fn = 8);
    scale([0.22 * s[1], 0.16, s[1]]) sphere(1, $fn = 8);
  }
}
mirror_x() translate([WR[0], WR[1], 0]) rotate([0, 0, WS]) {
  wing(UPPER, [0, 21], 6.5, 16.5, [[[12.5, 26], 1.3], [[16.5, 31], 0.7], [[8.5, 21.5], 0.5]]);
  wing(LOWER, [0, 14], 5.5, 12.5, [[[10.5, 11.5], 0.8], [[14.2, 6.5], 0.5]]);
}

// ---- Floating gold sparkles
for (p = [[19.3, 20.6], [13.6, 15.3], [-20.2, 25], [-18.5, 21.5], [-16, 2], [8.2, 4.8], [16.5, 37]])
  star4(ART(p[0], p[1], -3), 0.75, moteC);

// ---- Arms and legs (the base's)
mirror_x() color(pearl) translate([12.6, -0.5, 12.9]) rotate([0, 15, 0]) scale([3.6, 2.3, 2.25]) sphere(1, $fn = 22);
mirror_x() {
  limb([4.5, 1, 2.8], [4.5, 1, 10], 2.8, 2.35, legC);
  color(peri) intersection() {
    translate([4.5, 1, 2.8]) sphere(2.86);
    translate([0, -5, -1]) cube([10, 12, 2.2]);
  }
}
