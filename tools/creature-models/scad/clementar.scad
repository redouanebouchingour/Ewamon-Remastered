// Clementar: a tan fennec elder in a long hooded olive-plaid djellaba, a maroon fez with a green star between two tall
// orange-and-cream-banded ears, a sly half-lidded eye and a wink, and a cluster of three leafy oranges held up on each
// open hand. A big bushy tail sweeps out along the ground behind it and curls up at the tip.
//
// Checklist (sheet frame: height 40, feet z = 0, x = art centre; sheet x = 0.866 x + 0.5 y at the 30 deg camera):
//   head      light tan [0.82, 0.68, 0.38] wide fox head x -7.8..7.4, z 25.6..33.6; widest at the ear bases (z 31..33),
//             tapering to the chin at (-4, 25.6); cream [0.94, 0.82, 0.58] lower face x -7.5..-0.7, z 25.6..29.5
//   snout     short, the dark maroon nose at sheet (-4.6, 27.5); a smiling mouth line (-3.2, 26.5) -> (-1, 27.4)
//   eyes      near eye open, half-lidded, orange iris, at (-2.7..-0.1, 29..30.2); far eye a wink line at (-6.5..-5.4, 30)
//   ears      two tall plates: far (left) x -10.5..-4.4, z 30.2..39.9; near (right) x 1..9.2, z 30.8..39.9; each an
//             orange [0.93, 0.47, 0.06] outer band (GLOWS), a cream band beside it, light tan on the inner side
//   fez       maroon [0.47, 0.13, 0.13] truncated cone x -4.6..0.7, z 32.7..37.6 (worn forward), green star at (-2.8, 35)
//   robe      olive M2 [0.27, 0.23, 0.13] djellaba with dark [0.18, 0.14, 0.08] plaid lines: hem x -8.8..4.8 at z 5,
//             waist x -7.6..5 at z 15.5, shoulders x -8..6.3 at z 24.5, the hood rising behind the head to (3.8, 28.2);
//             its dark lining shows at x 1..5.8, z 22.3..27.8; tan chest fur in the V x -5.8..1, z 22.3..28;
//             cream front trim x -4.7..-3.1, z 17.4..22.6
//   sash      woven gold [0.82, 0.68, 0.38] / red [0.47, 0.13, 0.13] / olive band z 14.5..17; its fringed end hangs
//             down-left from (-7.6, 15.8) to (-14.4, 11) and (-12, 7.6)
//   sleeves   wide, draped: far from the shoulder (-8, 24.5) to the wrist (-12, 20) and the drape corner (-13.4, 15.2);
//             near from (6.3, 23.5) to the wrist (10.8, 19.5) and the corner (9, 15.1); undersides dark
//   hands     tan, open palms up under the fruit: far x -17..-11.6, z 17.5..21.3; near x 9.6..14, z 18.7..21.1
//   oranges   r 1.7, GLOWS: near (10.3, 26.2), (7.8, 22.9), (12, 23.6); far (-13.9, 25.6), (-16.6, 23), (-12.9, 22.3);
//             green leaves between them (not in the sheet palette, ~[0.30, 0.52, 0.22])
//   tail      light tan pillow along the ground to the right, x 3.2..19.6, z 4.1..19.5, curling up to a tip at (17, 19.5)
//   feet      tan: far foot x -9.6..-4.8 (toes out to the left), near foot x 2.4..5.8 (toes towards the camera), z 0..4.9
//   back      plaid robe, the hood's outside, the sash and its end on the creature's right, the tail on its left,
//             the ears tan from behind, the fez; the ground shadow in the art is not modelled
include <lib.scad>

tan = [0.82, 0.68, 0.38];
tanDk = [0.65, 0.49, 0.28];
cream = [0.94, 0.82, 0.58];
orange = [0.93, 0.47, 0.06, GLOW];      // the sheet: #ed790e GLOWS (fruit and the ears' outer bands)
olive = [0.30, 0.27, 0.15];
oliveLt = [0.38, 0.37, 0.21];
dark = [0.18, 0.14, 0.08];
ink = [0.10, 0.04, 0.02];
maroon = [0.47, 0.13, 0.13];
maroonDk = [0.34, 0.13, 0.08];
gold = [0.82, 0.68, 0.38];
leaf = [0.30, 0.43, 0.20, NOGLOW];
iris = [0.86, 0.52, 0.22, NOGLOW];

// The half-space in front of depth d0 (pp frame): a marking cut with it only shows on the camera-facing surface.
module front(d0 = 0) { pp(0) translate([-60, d0 - 120, -60]) cube(120); }
// Lay the children (a body part grown a little) flush on the surface where the camera sees the sheet outline pts.
module mark(pts, d0 = 0) { intersection() { union() children(); prism(pts); front(d0); } }

// ---- robe: a long djellaba, a hull of flattened ellipsoids cut to the sheet outline
robePts = [[-8.8, 5.0], [-2, 4.7], [4.8, 4.9], [5.8, 7], [5.6, 12], [5.2, 15], [5.5, 18], [6.0, 21], [6.3, 23.5],
           [5.3, 26.2], [3.8, 28.2], [2.0, 29.0], [-2.0, 29.0], [-5.5, 28.0], [-7.0, 26.8], [-8.0, 24.6],
           [-8.3, 20], [-7.8, 17], [-7.6, 15.5], [-8.2, 12], [-8.5, 8]];
module robeHull(g = 0) {
  hull() {
    translate([0, -0.4, 4.8]) scale([9.2 + g, 7.2 + g, 1.2]) sphere(1, $fn = 26);
    translate([0, -0.2, 10]) scale([8.0 + g, 6.4 + g, 1.2]) sphere(1, $fn = 26);
    translate([0, 0, 15.5]) scale([7.4 + g, 5.8 + g, 1.2]) sphere(1, $fn = 26);
    translate([0, 0, 21.5]) scale([7.4 + g, 5.8 + g, 1.5]) sphere(1, $fn = 26);
    translate([0, 0.3, 24.5]) scale([7.0 + g, 5.4 + g, 1.5]) sphere(1, $fn = 26);
    translate([0, 2.2, 28]) scale([4.5 + g, 3.6 + g, 1.4]) sphere(1, $fn = 22);
  }
}
module robeCut(g = 0) { intersection() { robeHull(g); prism(robePts); } }
color(olive) robeCut();
// plaid: dark rings and radial lines, lighter bands between the rings
color(dark) intersection() {
  robeCut(0.25);
  union() {
    for (z = [7, 10, 13, 19.5, 22.5]) translate([-30, -30, z - 0.2]) cube([60, 60, 0.4]);
    for (a = [0 : 30 : 330]) rotate([0, 0, a]) translate([-0.2, 0, 3]) cube([0.4, 30, 23]);
  }
}
color(oliveLt) intersection() {
  robeCut(0.2);
  union() for (z = [8.5, 11.5, 21]) translate([-30, -30, z - 0.35]) cube([60, 60, 0.7]);
}
// the hood's dark lining, open behind the neck on the creature's left
hoodInPts = [[-3.2, 22.3], [1.0, 26.3], [2.5, 27.9], [4.5, 27.4], [5.9, 25.5], [5.9, 23.4], [4.2, 22.2], [1.5, 23.4],
             [-2.0, 21.6]];
color(dark) mark(hoodInPts) robeHull(0.4);
// tan chest fur in the V of the collar, with the neck behind it
chestPts = [[-5.2, 27.3], [-3.2, 22.6], [0.6, 26.2], [-1.2, 27.7]];
color(tan) mark(chestPts) robeHull(0.5);
ell([2.4, 1.5, 2.4], [0, -4.2, 24.8], tan);
// cream trim down the front opening
trimPts = [[-4.7, 22.7], [-3.1, 22.7], [-3.1, 17.3], [-4.7, 17.3]];
color(cream) mark(trimPts) robeHull(0.55);
color(dark) mark([[-4.1, 22.7], [-3.7, 22.7], [-3.7, 17.3], [-4.1, 17.3]]) robeHull(0.7);
// the woven sash: a gold band with a red stripe and olive checks
color(gold) intersection() { robeCut(0.5); translate([-30, -30, 14.5]) cube([60, 60, 2.5]); }
color(maroon) intersection() { robeCut(0.7); translate([-30, -30, 15.3]) cube([60, 60, 1.0]); }
color(olive) intersection() {
  robeCut(0.85);
  translate([-30, -30, 15.3]) cube([60, 60, 1.0]);
  union() for (a = [0 : 36 : 359]) rotate([0, 0, a]) translate([-0.5, 0, 0]) cube([1.0, 30, 40]);
}
// the sash's fringed end hanging down the creature's right side
sashEndPts = [[-7.6, 16.0], [-9.6, 13.8], [-12.2, 12.2], [-14.4, 11.1], [-14.2, 10.2], [-12.4, 9.5], [-12.1, 7.6],
              [-11.0, 7.6], [-10.6, 9.4], [-9.0, 11.2], [-7.4, 13.2]];
pp(3.2) {
  plate(sashEndPts, 1.2, 0.3, [0.71, 0.37, 0.14]);
  translate([0, -0.25, 0]) plate([[-8.6, 14.9], [-10.6, 12.8], [-11.9, 12.0], [-12.1, 11.3], [-10.3, 12.0], [-8.2, 14.4]], 1.2, 0.2, gold);
  translate([0, -0.25, 0]) plate([[-11.2, 10.4], [-13.4, 10.6], [-13.5, 10.0], [-11.4, 9.7]], 1.2, 0.15, olive);
}

// ---- sleeves: wide draped djellaba sleeves on arms held out sideways, palms up
module sleeveHull(g = 0) {
  hull() {
    translate([6.2, -1.2, 23.0]) sphere(2.7 + g, $fn = 20);
    translate([12.3, -2.8, 19.6]) sphere(2.2 + g, $fn = 20);
    translate([13.0, -2.4, 15.9]) sphere(1.0 + g, $fn = 12);
    translate([5.8, -1.0, 16.1]) sphere(1.0 + g, $fn = 12);
  }
}
module sleeve() {
  color(olive) sleeveHull();
  // plaid: light bands along the sleeve and dark lines across it
  color(oliveLt) intersection() { sleeveHull(0.15); union() for (z = [18.0, 21.6]) translate([0, -20, z - 0.45]) cube([30, 40, 0.9]); }
  color(dark) intersection() { sleeveHull(0.2); union() for (x = [8.2, 10.8]) translate([x - 0.2, -20, 10]) cube([0.4, 40, 20]); }
  color(dark) hull() {
    translate([13.0, -2.6, 15.8]) sphere(1.05, $fn = 12);
    translate([5.8, -1.2, 16.0]) sphere(1.05, $fn = 12);
    translate([9.8, -2.6, 17.4]) sphere(1.3, $fn = 12);
  }
}
// ---- hands: open palms holding the fruit from below, a thumb up at the inner side
module hand() {
  color(tan) hull() {
    translate([14.0, -4.8, 19.5]) scale([2.3, 2.0, 1.3]) sphere(1, $fn = 18);
    translate([16.6, -5.4, 19.8]) sphere(1.1, $fn = 12);
  }
  limb([13.4, -5.0, 20.2], [12.0, -6.2, 21.8], 0.7, 0.55, tan);   // thumb
  for (p = [[17.0, -5.0, 21.2], [16.2, -7.0, 20.9], [14.6, -7.4, 20.7]]) limb([15.0, -5.4, 20.0], p, 0.7, 0.55, tan);
}

// ---- oranges: three per hand with leaves, resting on the palm (placed off the near cluster's sheet positions)
module cluster() {
  ell([2.2, 2.0, 1.95], fromSheet(10.2, 25.5, -4.6), orange);
  ell([2.2, 2.0, 1.9], fromSheet(8.0, 22.6, -4.8), orange);
  ell([2.4, 2.1, 1.95], fromSheet(12.4, 23.2, -5.4), orange);
  // leaves: a pair at the top-right, one at the top-left, one low on the right (small, dark green)
  petal([1.4, 0.4, 0.6], fromSheet(12.6, 28.4, -4.4), [0, -30, 30], leaf);
  petal([1.1, 0.4, 0.55], fromSheet(14.2, 24.6, -4.6), [0, 40, 20], leaf);
  petal([1.0, 0.35, 0.5], fromSheet(6.6, 25.3, -4.6), [0, -25, 30], leaf);
  petal([0.7, 0.3, 0.4], fromSheet(10.0, 28.0, -4.6), [0, 60, 30], leaf);
}
// the far arm reads about two units further out in the art than a mirror of the near one
for (s = [1, -1]) mirror([s < 0 ? 1 : 0, 0, 0]) translate([s < 0 ? 1.8 : 0, 0, 0]) { sleeve(); hand(); cluster(); }

// ---- head: a wide fox face, cut to the sheet outline; cream lower face; a short cream snout
headPts = [[-7.8, 31.2], [-7.6, 29.2], [-7.5, 28.3], [-6.5, 27.0], [-5.2, 26.0], [-4.0, 25.5], [-2.5, 25.7],
           [-0.5, 26.4], [1.5, 26.9], [3.5, 27.4], [4.3, 28.6], [5.1, 30.6], [6.5, 31.9], [7.4, 32.7], [6, 33.4],
           [3, 33.7], [0, 33.9], [-3, 33.7], [-5.5, 33.1], [-7.2, 32.3]];
module skull(g = 0) {
  hull() {
    translate([0, -1.2, 30.2]) scale([4.8 + g, 4.6 + g, 3.6 + g]) sphere(1, $fn = 28);                   // skull
    for (s = [-1, 1]) translate([s * 5.4, -1.6, 31.0]) scale([2.4 + g, 3.2 + g, 2.4 + g]) sphere(1, $fn = 20); // cheek ruffs
    translate([0, -4.0, 27.2]) scale([3.2 + g, 3.4 + g, 2.0 + g]) sphere(1, $fn = 20);                   // chin
    translate([0, -4.0, 29.2]) scale([3.3 + g, 3.6 + g, 2.3 + g]) sphere(1, $fn = 20);                   // brow / muzzle bridge
  }
}
color(tan) intersection() { skull(); prism(headPts); }
creamPts = [[-7.5, 28.0], [-7.4, 29.3], [-6.4, 29.6], [-4.2, 29.3], [-2.7, 29.0], [-1.0, 28.6], [-0.6, 27.6],
            [-1.6, 26.3], [-3.0, 25.5], [-4.8, 25.6], [-6.5, 26.6]];
color(cream) mark(creamPts, -0.9) skull(0.3);
// snout and nose
module snout(g = 0) {
  hull() {
    translate([0, -5.6, 27.9]) sphere(2.2 + g, $fn = 20);
    translate([0, -7.8, 27.5]) sphere(1.45 + g, $fn = 16);
  }
}
color(tan) snout();
ell([1.7, 2.6, 1.1], [0, -6.0, 26.9], cream);   // cream lower jaw
ell([0.85, 0.7, 0.6], [0, -9.0, 27.7], maroonDk);
// the smile: a dark line along the near side of the muzzle
mouthPts = [[-3.4, 26.2], [-1.3, 26.5], [-0.7, 27.5], [-1.3, 27.5], [-1.6, 27.0], [-3.4, 26.7]];
color(ink) mark(mouthPts, -5) { snout(0.35); skull(0.3); }
// eyes: the near one open and half-lidded with an orange iris, the far one a wink
eyeP = [2.3, -6.3, 29.9];
translate(eyeP) scale([1.3, 1, 0.7]) translate(-eyeP)
  eye(eyeP, 1.25, iris = iris, sclera = cream, yaw = 20, pupil = ink, flat = 0.5, lid = 0.3, lid_tilt = 6, lid_c = dark,
      squint = 0.05, slit = 0.7);
// the wink: a dark lid line with a sliver of iris under it
color(dark) translate([-2.9, -5.9, 30.1]) rotate([0, 0, -30]) scale([1.3, 0.35, 0.32]) sphere(1, $fn = 12);
color(iris) translate([-2.9, -5.85, 29.6]) rotate([0, 0, -30]) scale([0.85, 0.3, 0.3]) sphere(1, $fn = 10);
color(dark) translate([-2.9, -5.85, 29.25]) rotate([0, 0, -30]) scale([1.0, 0.3, 0.2]) sphere(1, $fn = 10);

// ---- ears: tall plates in the picture plane, each with its orange outer band and cream band
farEarPts = [[-7.9, 30.9], [-8.6, 32.4], [-9.6, 34.4], [-10.3, 36.7], [-10.5, 39.3], [-10.1, 39.9], [-9.0, 39.8],
             [-7.7, 36.8], [-6.7, 34.4], [-5.2, 32.2], [-4.6, 31.0], [-5.6, 30.2]];
farOrangePts = [[-7.6, 31.6], [-8.8, 33.3], [-9.7, 35.6], [-10.1, 37.8], [-10.1, 39.3], [-9.3, 39.5], [-8.3, 37.8],
                [-7.9, 35.6], [-7.0, 33.3], [-6.6, 31.6]];
farCreamPts = [[-6.6, 31.8], [-7.0, 33.3], [-7.9, 35.6], [-8.3, 37.8], [-8.9, 39.3], [-8.0, 38.6], [-7.4, 37.8],
               [-7.1, 35.6], [-6.3, 33.3], [-5.8, 31.8]];
nearEarPts = [[1.0, 32.3], [2.0, 34.6], [4.3, 36.7], [6.8, 39.2], [7.4, 39.9], [9.2, 39.6], [9.0, 37.0], [8.4, 34.6],
              [7.5, 32.4], [5.5, 30.8], [3.0, 31.2]];
nearOrangePts = [[4.4, 32.0], [4.3, 33.3], [5.1, 35.6], [6.2, 37.8], [7.0, 39.3], [8.6, 39.4], [8.2, 37.8], [7.3, 35.6],
                 [6.8, 33.3], [6.2, 31.8]];
nearCreamPts = [[2.6, 31.8], [2.7, 33.3], [3.4, 35.6], [5.2, 37.8], [6.6, 39.2], [7.0, 39.3], [6.2, 37.8], [5.1, 35.6],
                [4.1, 33.3], [3.8, 31.8]];
// (the camera looks 10 deg down: a part d behind the picture plane reads 0.17 d higher, so the ears are shifted back)
pp(3.0) translate([0, 0, -0.4]) {
  plate(farEarPts, 1.3, 0.3, tan);
  translate([0, -0.35, 0]) plate(farOrangePts, 1.2, 0.25, orange);
  translate([0, -0.3, 0]) plate(farCreamPts, 1.2, 0.2, cream);
}
pp(-5.2) translate([0, 0, 0.9]) {
  plate(nearEarPts, 1.3, 0.3, tan);
  translate([0, -0.35, 0]) plate(nearOrangePts, 1.2, 0.25, orange);
  translate([0, -0.3, 0]) plate(nearCreamPts, 1.2, 0.2, cream);
}

// ---- fez: a maroon truncated cone worn forward on the skull, a green star on its front
color(maroon) translate([0, -3.2, 32.6]) cylinder(h = 5.0, r1 = 2.75, r2 = 2.35, $fn = 28);
color(maroonDk) translate([0, -3.2, 37.55]) cylinder(h = 0.25, r = 2.35, $fn = 28);
starPts = [for (i = [0 : 9]) let(r = i % 2 == 0 ? 1.35 : 0.55, a = 90 + i * 36) [-2.8 + r * cos(a), 35.0 + r * sin(a)]];
pp(-6.0) plate(starPts, 0.7, 0.1, leaf);

// ---- feet and ankles: the creature's right foot stepped out and turned outward, the left pointing at the camera
module foot(ankle, toe) {
  color(tan) hull() {
    translate(ankle + [0, 0, 2.4]) sphere(1.5, $fn = 14);
    translate(toe + [0, 0, 1.2]) scale([1.4, 1.2, 1.0]) sphere(1, $fn = 14);
  }
  d = toe - ankle;
  side = [-d[1], d[0], 0] / norm([d[0], d[1], 0]);
  for (s = [-1, 0, 1]) color(tan) translate(toe + side * s * 1.0 + [0, 0, 0.75]) sphere(0.75, $fn = 10);
  limb(ankle + [0, 0, 2.6], ankle + [0, 0, 7], 1.4, 1.4, tan);
}
foot([-5.2, -3.6, 0], [-7.4, -7.4, 0]);
foot([4.8, -1.6, 0], [7.2, -5.8, 0]);

// ---- tail: a bushy pillow along the ground behind the creature's left side, its tip curling up
tailPts = [[16, 19.5], [17.1, 19.5], [18.1, 18.9], [17.7, 18.5], [19, 18.5], [19.2, 18.2], [18.3, 17.8], [19.6, 17.6],
           [18.5, 17.6], [16.8, 16.3], [16.8, 14.4], [17.5, 14.2], [18.1, 13.2], [18.1, 10], [16.4, 8.2], [16.8, 6.9],
           [15, 5.4], [13.9, 5.4], [13.7, 4.6], [11.6, 4.1], [6.5, 5], [5.3, 6.3], [5.9, 6.7], [5.5, 8.8], [4.7, 9],
           [4.2, 11.9], [3.4, 12.1], [3.2, 14.2], [6.1, 14.2], [6.3, 13.2], [7.8, 13.2], [9.7, 12.3], [9.9, 12.8],
           [10.8, 13], [11.2, 16.3], [14.5, 18.9], [15.8, 19.3]];
// round segments along the tail's spine read off the sheet (sheet x, sheet z, depth behind the picture plane, radius),
// cut to the traced outline; 1.3 low for the camera's downward look at 7.5 behind the picture plane
tailSpine = [[4.6, 9.8, 6.0, 3.8], [8.5, 8.8, 7.0, 4.6], [12.6, 9.0, 8.0, 5.0], [15.2, 11.0, 8.5, 4.4],
             [15.4, 14.6, 8.5, 3.8], [16.4, 17.0, 8.2, 2.8], [17.6, 18.4, 8.0, 1.8]];
module tailRough(g = 0) {
  for (i = [0 : len(tailSpine) - 2]) hull() for (j = [i, i + 1]) {
    t = tailSpine[j];
    translate(fromSheet(t[0], t[1] - 1.3, t[2])) scale([1, 0.85, 1]) sphere(t[3] + g, $fn = 16);
  }
}
module tailPrism(pts, g = 0.45) { pp(0) translate([0, 0, -1.3]) rotate([90, 0, 0]) linear_extrude(height = 120, center = true) offset(r = g) polygon(pts); }
color(tan) intersection() { tailRough(); tailPrism(tailPts); }
// darker fur along the underside
tailUnderPts = [[3.0, 9.8], [5.6, 6.3], [8.5, 4.3], [12.0, 3.6], [14.6, 4.6], [16.6, 6.4], [18.4, 9.8], [17.0, 9.6],
                [14.0, 7.6], [11.0, 7.0], [8.0, 7.6], [5.6, 9.4]];
color(tanDk) intersection() { tailRough(0.25); tailPrism(tailPts, 0.6); tailPrism(tailUnderPts, 0); }
