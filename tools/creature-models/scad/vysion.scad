// Vysion: a slim red-and-green android hovering, a big flowing golden cape off its shoulders, the legs merging into a
// curling green wisp tail that dissolves into gold sparkles.
//
// Checklist (front sheet, raw x; the torso's centre reads at sheet x -2.3, so scad x = (sx + 2.3 - 0.5 y) / 0.866):
// - Head x -6.3..-1, z 31.2..38.5, jutting forward: a narrow red cowl, a green crown with a widow's peak down to a gold
//   forehead gem (-5, 35.5), green frames down the face sides, a green chin guard, a short mouth line (-4.3, 32.1).
// - Eyes: two narrow almond pale-lemon eyes (far -5.7, near -3.5, z 33.8), slanted angry, outer corners up, no pupil.
// - Fins: two long green blades rising from green ear plates, swept up and back (tips -2.7 / 2.4 at z 40).
// - Torso: red pecs in a V round a gold chest gem (-4, 27.5), green lats, green abs, a red V to the crotch, slim waist.
// - Arms: red shoulder pads, green upper arms, red forearms with a gold cuff, green hands with four long pale claws.
//   Far arm spread out (hand -15, 13.5), near arm hanging (hand 8.5, 12); symmetric in the scad.
// - Legs: green thighs with red fronts and red knee pads, merging at the knees into a tail curling right then down to
//   a thin tip (3, 0.5), a gold wisp along it and gold sparkles round it.
// - Cape: two big gold drapes off the shoulders, near one to x 17.8 with a tip at (12.9, 6.3) and an inner fold to
//   (4, 12.8), far one a flap to (-17.8, 21.6) and a ribbon to (-4.2, 7.4); darker gold folds. Back: the two drapes
//   cover the back with a slit at the spine.
include <lib.scad>

red = [0.63, 0.2, 0.27];
redDark = [0.45, 0.13, 0.19];
green = [0.3, 0.45, 0.32];
greenDark = [0.19, 0.31, 0.23];
greenHi = [0.43, 0.55, 0.42];
gold = [0.95, 0.78, 0.26, NOGLOW];
goldDark = [0.8, 0.6, 0.18, NOGLOW];
gem = [1, 0.9, 0.42, GLOW];
spark = [0.98, 0.9, 0.47, GLOW];
eyeC = [0.99, 0.95, 0.61, GLOW];
eyeCore = [1, 0.98, 0.85, GLOW];
claw = [0.59, 0.71, 0.55];
ink = [0.22, 0.09, 0.06];

OX = 2.3;   // the torso's sheet offset: raw sheet x + OX = sheet x of the scad frame
function S(sx, z, y = 0) = fromSheet(sx + OX, z, y);

// ---- Head: a narrow red cowl jutting forward, green crown and frames, gem, angry slit eyes, swept fins.
module skull(g = 0) blob([[[2.25 + g, 2.6 + g, 2.5 + g], [0, -2.6, 36]], [[1.55 + g, 1.9 + g, 1.9 + g], [0, -3.5, 33.2]]]);
color(red) skull();
color(green) intersection() {                                          // crown with a widow's peak, face frames
  skull(0.06);
  union() {
    translate([-5, -8, 37.3]) cube([10, 6, 5]);
    translate([0, -5, 37.2]) rotate([0, 45, 0]) cube([1.5, 4, 1.5], center = true);
    mirror_x() translate([1.42, -8, 31.6]) cube([3, 5.2, 3.9]);
  }
}
color(goldDark) translate([0, -5.0, 35.45]) rotate([90, 0, 0]) scale([0.58, 1.0, 1]) cylinder(h = 0.5, r = 1, $fn = 4, center = true);
color(gem) translate([0, -5.18, 35.45]) rotate([90, 0, 0]) scale([0.4, 0.78, 1]) cylinder(h = 0.5, r = 1, $fn = 4, center = true);
ell([0.7, 0.42, 0.42], [0, -4.4, 31.6], green);                        // chin guard
color(ink) translate([0, -5.12, 32.3]) scale([0.5, 0.12, 0.09]) sphere(1, $fn = 10);   // mouth
// Eyes: narrow pale-lemon almonds, outer corners up, in a dark socket line.
EYE = [1.05, -4.78, 33.95];
mirror_x() translate(EYE) rotate([0, -16, 18]) {
  color(ink) translate([0, 0.12, 0.04]) scale([0.86, 0.3, 0.4]) sphere(1, $fn = 14);
  color(eyeC) scale([0.74, 0.3, 0.27]) sphere(1, $fn = 14);
  color(eyeCore) translate([0.05, -0.12, 0]) scale([0.42, 0.24, 0.15]) sphere(1, $fn = 10);
}
mirror_x() {
  ell([0.45, 1.25, 1.5], [2.05, -2.2, 35.3], green);                   // ear plate
  color(green) hull() {                                                // fin, base to the bend
    translate([2.15, -1.6, 35.4]) scale([0.32, 1.0, 1.1]) sphere(1, $fn = 12);
    translate([2.7, 1.4, 37.6]) scale([0.22, 0.5, 0.5]) sphere(1, $fn = 8);
  }
  color(green) hull() {                                                // fin, bend to the tip
    translate([2.7, 1.4, 37.6]) scale([0.22, 0.5, 0.5]) sphere(1, $fn = 8);
    translate([2.95, 4.3, 39.9]) sphere(0.12, $fn = 6);
  }
}
limb([0, -0.3, 30], [0, -2, 33], 1.25, 1.15, greenDark);              // neck

// ---- Torso: red chest and pecs round the gem, green lats and abs, red V to the crotch.
blob([[[3.4, 2.4, 2.6], [0, 0.1, 27.4]], [[2.5, 2.0, 2.4], [0, 0.2, 22.6]]], greenDark);
blob([[[3.9, 2.6, 2.3], [0, -0.1, 28.8]], [[2.6, 2.2, 1.4], [0, 0, 26.9]]], red);   // upper chest and back
mirror_x() color(red) translate([1.85, -1.55, 27.2]) rotate([0, -18, 0]) scale([1.9, 1.3, 1.6]) sphere(1, $fn = 20);  // pec
mirror_x() ell([1.15, 1.7, 2.8], [2.75, 0.1, 24.2], green);           // lats
for (z = [24.4, 22.85, 21.3]) mirror_x() ell([0.92, 0.26, 0.78], [0.94, -1.92, z], green);   // abs
color(gold) translate([0, -2.75, 27.1]) rotate([90, 0, 0]) scale([0.8, 1.35, 1]) cylinder(h = 0.6, r = 1, $fn = 4, center = true);
color(gem) translate([0, -3.05, 27.1]) rotate([90, 0, 0]) scale([0.5, 0.95, 1]) cylinder(h = 0.5, r = 1, $fn = 4, center = true);
blob([[[2.9, 2.2, 1.6], [0, 0.2, 19.2]], [[1.0, 0.9, 1.4], [0, -0.9, 17.4]]], red);   // hips, the V to the crotch

// ---- Legs merging into the wisp tail.
mirror_x() {
  limb([2.3, 0.2, 17.6], [1.1, -0.8, 11.2], 1.9, 1.4, green);          // thigh
  color(red) translate([1.9, -1.0, 14.8]) rotate([-8, 12, 0]) scale([0.95, 0.75, 2.5]) sphere(1, $fn = 14);   // thigh front
  ell([1.05, 0.85, 0.95], [1.15, -1.8, 10.9], red);                    // knee pad
}
TAIL = [S(-2.2, 9.6, -0.8), S(0, 8, -0.8), S(2.5, 7.4, -0.8), S(4.4, 6.3, -0.6), S(4.2, 4.3, -0.4), S(3, 2.6, -0.2), S(2.9, 0.4, 0)];
blob([[[1.9, 1.7, 1.6], [0, -0.7, 10.3]], [[1.6, 1.4, 1.4], TAIL[0]]], green);
chain(TAIL, [1.75, 1.45, 1.3, 1.15, 0.8, 0.5, 0.14], green);
chain([S(-0.3, 9.9, -1.6), S(2.3, 9.9, -1.6), S(4.2, 9.5, -1.4), S(5.4, 8.4, -1.2), S(5.6, 6.6, -1)], [0.3, 0.38, 0.32, 0.22, 0.08], gold);
chain([S(4.9, 5.8, -0.8), S(5.6, 4.5, -0.6), S(5.3, 3.1, -0.4)], [0.28, 0.18, 0.06], gold);
for (s = [[0.9, 4.5, -1.5], [1.1, 3.1, 1], [-1.2, 1.8, -0.5], [1.6, 0.6, -1], [5.6, 10.8, 0.5], [6.2, 9.3, -1],
          [6.4, 3.6, 0.8], [5.5, 2.2, -1], [4.5, 1.0, 0.5], [-1.6, 4.6, 1]])
  color(spark) translate(S(s[0], s[1], s[2])) rotate([30, 20, s[0] * 40]) cube(0.6, center = true);

// ---- Arms (the creature's +X arm; mirrored).
module talon(pts, rs) for (i = [0 : len(pts) - 2]) color(claw) hull() {
  translate(pts[i]) sphere(rs[i], $fn = 8);
  translate(pts[i + 1]) sphere(rs[i + 1], $fn = 6);
}
SH = [6.6, 0.4, 28.6]; EL = [9.6, 1.6, 22.2]; WR = [12.6, 0.2, 16.2]; HA = [13.4, -1.2, 14.3];
function lerp(a, b, t) = a + (b - a) * t;
mirror_x() {
  ell([2.0, 2.1, 1.9], [6.4, 0.4, 28.8], red);                         // shoulder pad
  limb(SH, EL, 1.45, 1.2, green);                                      // upper arm
  ell([1.25, 1.25, 1.25], EL, greenDark);                                 // elbow
  limb(EL, WR, 1.35, 1.05, red);                                        // forearm
  limb(lerp(EL, WR, 0.72), lerp(EL, WR, 0.8), 1.24, 1.2, gold);       // cuff
  ell([0.95, 0.95, 0.95], WR, greenDark);                              // wrist
  color(green) translate(HA) rotate([-12, 0, 8]) scale([0.95, 1.05, 1.1]) sphere(1, $fn = 14);   // hand
  for (s = [-1.3, -0.45, 0.4, 1.2]) {                                  // four long fingers ending in curved talons
    color(green) hull() { translate(HA + [s * 0.4, -0.3, -0.4]) sphere(0.38, $fn = 8); translate(HA + [s * 1.05, -0.6, -2.0]) sphere(0.3, $fn = 8); }
    talon([HA + [s * 1.05, -0.6, -2.0], HA + [s * 1.45, -1.0, -3.9], HA + [s * 1.35, -1.9, -5.3], HA + [s * 1.05, -2.6, -5.7]], [0.28, 0.2, 0.1, 0.03]);
  }
  ell([1.6, 1.4, 0.7], [4.6, 1.2, 31.0], gold);                         // cape strap over the shoulder
}

// ---- Cape: two thick gold drapes traced off the front sheet, bent round the back (depth per sheet x, see bend()).
// bend(knots): children authored in raw sheet x (inside pp()), each strip between two knots [x, depth] sheared to
// that depth, so the front silhouette stays the art's while the drape curves round the body; kz pushes the lower
// cape back.
module bend(knots, kz = 0.06, z0 = 31) {
  n = len(knots);
  for (i = [0 : n - 2]) {
    a = knots[i][0]; b = knots[i + 1][0];
    k = (knots[i + 1][1] - knots[i][1]) / (b - a);
    lo = i == 0 ? a - 30 : a;
    hi = i == n - 2 ? b + 30 : b;
    multmatrix([[1, 0, 0, 0], [k, 1, -kz, knots[i][1] - k * a + kz * z0], [0, 0, 1, 0], [0, 0, 0, 1]])
      intersection() { children(); translate([lo, -20, -5]) cube([hi - lo, 40, 50]); }
  }
}
// A drape: a plate with a thicker middle so it reads as cloth from the side.
module drape(pts, t = 1.4) {
  plate(pts, t * 0.55, 0.4, gold);
  plate(pts, t, 0.4, gold, grow = -0.5);
}
NEAR = [[-0.3, 32.4], [1.5, 32.8], [4, 32.4], [6.7, 30.3], [11.1, 28.1], [15.1, 24.3], [16.6, 21.8], [17.6, 19],
        [17.8, 14.8], [16.3, 9.9], [12.9, 6.3], [14.6, 11], [14.6, 14.4], [13.1, 16.9], [10.6, 18.4], [8.5, 20.5],
        [7, 22.5], [6, 21.5], [5.4, 17.6], [4, 12.8], [3.6, 16.7], [1.8, 19.5], [0.8, 22], [0.6, 25], [0.8, 28.5],
        [0.3, 30.5]];
FAR = [[-2.8, 32.4], [-4.8, 32.5], [-6.3, 32.1], [-7.5, 30.5], [-9.1, 28.8], [-11.1, 26.7], [-14.7, 25],
       [-17.8, 21.6], [-15.8, 20.1], [-12.3, 20.3], [-10.2, 19], [-9.4, 15.5], [-6.7, 9.8], [-4.2, 7.4], [-6.4, 10.9],
       [-7.1, 14.1], [-6.9, 18.7], [-6.2, 20.3], [-3.6, 22], [-2.8, 26], [-2.6, 30]];
FOLDS_NEAR = [[[8.6, 26.5], [11, 23.5], [13.5, 19], [14.8, 14], [14.6, 11.5], [13.6, 15], [11.8, 19.5], [9.4, 23.5], [7.8, 25.8]],
              [[3.0, 25], [4.5, 22.5], [4.7, 18.5], [4.2, 15], [3.8, 18.5], [3.4, 22.3]],
              [[15.5, 23.2], [17, 19.5], [17.2, 15], [16.0, 11.5], [16.4, 15.5], [16.0, 19.5], [14.8, 22.8]]];
FOLDS_FAR = [[[-9.5, 27.5], [-12.5, 25.6], [-16.5, 22.2], [-12.5, 24.3], [-9.8, 26.2]],
             [[-6.5, 21], [-7.6, 16.5], [-7.2, 12.5], [-6.4, 11.5], [-6.6, 15], [-6.2, 19.5]]];
pp(0) translate([OX, 0, 0]) let($fs = 1.1) {
  translate([0, 0, 0.4]) bend([[-0.5, 3.2], [3.5, 1.0], [9.5, -1.5], [17.8, -4.5]]) {
    drape(NEAR);
    for (f = FOLDS_NEAR) plate(f, 1.6, 0.2, goldDark, grow = 0.1);
  }
  translate([0, 0, -1.3]) bend([[-17.8, 11.5], [-12, 9], [-7.5, 7], [-2.5, 5]]) {
    drape(FAR);
    for (f = FOLDS_FAR) plate(f, 1.6, 0.2, goldDark, grow = 0.1);
  }
}
// Mantle behind the neck joining the two drapes.
blob([[[1.3, 1.0, 1.4], [4.8, 2.9, 31.1]], [[1.4, 1.1, 1.6], [0, 3.3, 31.7]], [[1.3, 1.0, 1.4], [-4.8, 2.9, 31.1]]], gold);
