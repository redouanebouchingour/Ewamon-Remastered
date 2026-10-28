// Lawlander Tenjin: the sheriff ascended: a cream shirt and gold-trimmed cream poncho, a pale hat with a gold band,
// glowing eyes, gold veins through his leathers, a golden lasso and a gold halo ring set with a jade stone.
include <lib.scad>

fur = [0.48, 0.44, 0.4];
furDk = [0.24, 0.19, 0.15];
furHi = [0.55, 0.48, 0.38];
cream = [0.9, 0.86, 0.78];
band = [0.22, 0.2, 0.19];
shirt = [0.92, 0.88, 0.74];
mantle = [0.93, 0.89, 0.76];
mantleHi = [0.92, 0.72, 0.25];
jade = [0.55, 0.65, 0.45];
glowEye = [1, 0.95, 0.75];
vest = [0.88, 0.83, 0.68];
gold = [0.95, 0.78, 0.35];
cape = [0.93, 0.89, 0.76];
pants = [0.45, 0.3, 0.18];
leather = [0.5, 0.32, 0.18];
leatherDk = [0.32, 0.2, 0.12];
bullet = [0.95, 0.8, 0.35];
buckle = [0.7, 0.68, 0.62];
hat = [0.88, 0.84, 0.7];
hatDk = [0.75, 0.7, 0.56];
hatBand = [0.92, 0.7, 0.2];
bandana = [0.6, 0.3, 0.18];
claw = [0.85, 0.82, 0.74];
steel = [0.65, 0.67, 0.7];
rope = [1, 0.75, 0.4];
wheat = [0.88, 0.76, 0.42];
eyeCol = [1, 0.95, 0.75];

// Boots with spurs, chunky trouser legs.
mirror_x() {
  blob([[[2.8, 4.2, 1.7], [5.5, -1.4, 1.7]], [[2.6, 2.6, 3.4], [5.5, 0.6, 4.5]]], leatherDk);
  color(steel) translate([5.5, 3.4, 2.6]) rotate([0, 90, 0]) cylinder(h = 0.4, r = 1.1, center = true, $fn = 8);
  color(steel) translate([5.5, 0.6, 2]) scale([2.85, 2.85, 1]) cylinder(h = 0.6, r = 1, $fn = 20);
  limb([5.5, 0.6, 7], [5.2, 0, 10.5], 3, 3.4, pants);
  limb([5.2, 0, 10.5], [4.2, 0.5, 15], 3.4, 3.8, pants);
}

// Hips, belt, holster with a gun and a coiled lasso.
blob([[[7.5, 5.5, 3.6], [0, 0.5, 15.5]]], pants);
color(leather) translate([0, 0.5, 17.4]) scale([7.6, 5.8, 1]) cylinder(h = 1.6, r = 1, center = true, $fn = 36);
color(buckle) translate([0, -5.4, 17.4]) cube([2.2, 0.6, 1.6], center = true);
blob([[[1.5, 1.4, 2.6], [7.6, -1.5, 14.5]], [[1.2, 1.2, 1], [7.4, -1.2, 16.6]]], leather);
color(furDk) translate([7.6, -2.4, 17.6]) rotate([20, 0, 0]) scale([0.8, 1.6, 0.8]) sphere(1, $fn = 10);
color(rope) translate([8.4, 1.5, 12.5]) rotate([0, 90, 0]) for (r = [2.1, 2.7]) rotate_extrude($fn = 24) translate([r, 0]) circle(0.33, $fn = 6);
limb([8.6, 2.5, 10.5], [8.8, 3, 6.5], 0.3, 0.3, rope);

// Barrel chest in a blue shirt, hunched forward.
torso = [8, 6.4, 7.5];
torsoC = [0, -0.5, 24];
color(shirt) hull() {
  translate([0, 0.5, 19]) scale([7.2, 5.6, 3]) sphere(1, $fn = 28);
  translate(torsoC) scale(torso) sphere(1, $fn = 32);
}
// Leather vest over the shirt, open down the middle, with a sheriff's star.
color(vest) difference() {
  hull() { translate([0, 0.5, 19]) scale([7.5, 5.9, 3]) sphere(1, $fn = 28); translate(torsoC) scale(torso * 1.04) sphere(1, $fn = 32); }
  translate([0, -10, 26]) cube([2.4, 10, 20], center = true);
  translate([0, 0, 36]) cube([30, 30, 10], center = true);
}
module star5(r) { polygon([for (i = [0 : 9]) let(a = 90 + i * 36, q = i % 2 == 0 ? r : r * 0.45) [q * cos(a), q * sin(a)]]); }
color(gold) translate([4.6, -6.3, 23]) rotate([0, 0, -28]) rotate([90, 0, 0]) linear_extrude(0.8, center = true) star5(1.6);
// Poncho cape over the shoulders: a rounded collar with a gold trim line.
color(mantle) intersection() {
  translate([0, 0.5, 25]) scale([9.6, 7.6, 7.6]) sphere(1, $fn = 32);
  translate([0, 0, 33]) cube([30, 30, 14], center = true);
}
color(mantleHi) translate([0, 0.5, 26.2]) scale([9.55, 7.55, 1]) cylinder(h = 0.5, r = 1, center = true, $fn = 36);
// Bandolier from the right shoulder to the left hip, studded with cartridges.
color(leather) translate([0, -0.5, 24]) rotate([0, 38, 0]) scale([1, 0.84, 1]) rotate_extrude($fn = 36) translate([8.7, 0]) square([1.2, 2.6], center = true);
for (t = [-50 : 14 : 50]) color(bullet) translate([0, -0.5, 24]) rotate([0, 38, 0]) scale([1, 0.84, 1]) rotate([0, 0, -90 + t])
  translate([9.4, 0, 0]) scale([0.6, 0.6, 1]) cylinder(h = 2.4, r = 0.6, center = true, $fn = 6);

// Front run of the bandolier: shoulder to hip over the chest, with cartridges.
bandPts = [[6.5, -4.6, 29.5], [3, -6.9, 26], [-1.5, -7.4, 22.5], [-6.5, -5.4, 18.6]];
chain(bandPts, [0.9, 0.9, 0.9, 0.9], leather);
for (i = [0 : 2]) for (t = [0.15 : 0.25 : 0.9]) let(p = bandPts[i] + (bandPts[i + 1] - bandPts[i]) * t)
  color(bullet) translate(p + [0, -0.8, 0]) rotate([0, 50, 0]) cylinder(h = 2.2, r = 0.38, center = true, $fn = 6);

// Arms: shirt sleeves, leather bracers, big paws with long claws, hanging low and forward.
mirror_x() {
  ell([3.4, 3.8, 2.6], [8.2, 0, 28.2], mantle);
  limb([9, 0, 26], [11, -1.5, 20], 2.8, 2.6, shirt);
  limb([11, -1.5, 20], [11.5, -3, 14.5], 2.9, 2.6, leather);
  color(leatherDk) translate([11.2, -2.2, 17.6]) rotate([15, 0, 0]) scale([1.03, 1.03, 1]) cylinder(h = 0.8, r = 2.9, center = true, $fn = 16);
  ell([2.6, 2.4, 2.4], [11.6, -3.6, 12.4], fur);
  for (a = [-40, -12, 15, 42]) spike([11.6 + sin(a) * 1.6, -4.6, 11.4], [sin(a) * 0.6, -1.6, -3], 0.55, 0.05, claw);
}

// Head held low and forward: badger face with a cream muzzle and dark mask bands, amber eyes under a scowl.
head = [6.2, 5.8, 5.4];
headC = [0, -6, 31];
ell(head, headC, fur);
// Cream cheek ruff.
mirror_x() ell([2.6, 2.4, 3], [3.4, -7.6, 29.6], cream);
blob([[[3.4, 3, 2.6], [0, -9, 30]], [[1.9, 1.8, 1.5], [0, -12.4, 29.6]]], cream);
color(band) translate([0, -14, 29.9]) scale([1.1, 0.7, 0.8]) sphere(1, $fn = 12);
ell([1.4, 3, 2.8], [0, -9.6, 33.4], cream);
mirror_x() {
  limb([2.6, -10, 31.6], [4.6, -5, 33.2], 1.2, 1.7, band);
  eye([2.6, -10.6, 31.6], 0.85, iris = eyeCol, pupil = [0.1, 0.05, 0], sclera = eyeCol, yaw = -18, shine = false);
  color(glowEye) translate([2.6, -11.3, 31.6]) sphere(0.45, $fn = 8);
  color(band) translate([2.4, -10.8, 32.6]) rotate([0, -15, -18]) scale([1.4, 0.5, 0.35]) sphere(1, $fn = 10);
}
// Mouth line and a wheat stalk.
color(band) translate([0, -12, 28.4]) scale([1.4, 0.4, 0.25]) sphere(1, $fn = 10);
limb([1.4, -12.2, 28.5], [6.5, -13.4, 27], 0.2, 0.16, wheat);
for (k = [0 : 2]) ell([0.6, 0.35, 0.3], [5.9 + k * 0.7, -13.2, 27.2 - k * 0.2], wheat);
mirror_x() ell([1.4, 0.9, 1.4], [4.4, -4, 35], fur);

// Red bandana: a neck band, a triangle over the chest, and a knot with tails at the side.
color(bandana) translate([0, -4, 27.6]) rotate([18, 0, 0]) scale([5.6, 5, 1]) cylinder(h = 1.8, r = 1, center = true, $fn = 28);
color(bandana) hull() {
  translate([-4.2, -8.4, 27.2]) sphere(0.6, $fn = 8);
  translate([4.2, -8.4, 27.2]) sphere(0.6, $fn = 8);
  translate([-0.8, -8.4, 21.6]) sphere(0.5, $fn = 8);
}
ell([1.3, 1, 1.1], [5, -2, 29.4], bandana);
limb([5, -2, 29.4], [8.5, -0.5, 31.2], 0.9, 0.3, bandana);
limb([5, -2, 29.4], [8.2, 0.5, 28.2], 0.9, 0.3, bandana);

// Tattered duster cape hanging from the shoulders down the back, with grey patches and a frayed hem.
color(cape) difference() {
  hull() { translate([0, 1, 27]) scale([9.4, 7, 2]) sphere(1, $fn = 32); translate([0, 1.5, 9]) scale([11, 8.4, 1]) sphere(1, $fn = 32); }
  hull() { translate([0, 1, 27]) scale([8.7, 6.3, 2.6]) sphere(1, $fn = 32); translate([0, 1.5, 9]) scale([10.3, 7.7, 1.6]) sphere(1, $fn = 32); }
  translate([0, -18, 18]) cube(40, center = true);
}
// Embroidered gold bands across the back of the poncho.
for (z = [12, 21]) let(f = (27 - z) / 18, rx = 9.4 + 1.6 * f, ry = 7 + 1.4 * f, cy = 1 + 0.5 * f)
  chain([for (a = [15 : 15 : 165]) [rx * cos(a), cy + ry * sin(a) + 0.15, z + ((a / 15) % 2) * 0.8]], [for (a = [15 : 15 : 165]) 0.32], mantleHi);
// Gold trim bands along the hem and across the back.
color(mantleHi) difference() {
  hull() { translate([0, 1, 12]) scale([10.85, 8.3, 0.5]) sphere(1, $fn = 32); translate([0, 1.5, 9]) scale([11.1, 8.5, 0.6]) sphere(1, $fn = 32); }
  translate([0, -18, 10]) cube([40, 40, 10], center = true);
}
color(mantleHi) difference() {
  translate([0, 1.2, 15]) scale([10.75, 8.2, 0.4]) sphere(1, $fn = 32);
  translate([0, -18, 15]) cube([40, 40, 4], center = true);
}
// The bandolier's strap across the back of the mantle.
color(leather) translate([0, 7.8, 24]) rotate([-6, 0, 0]) rotate([0, -35, 0]) cube([15, 1, 1.6], center = true);

// Gold veins through the trousers and bracers.
mirror_x() {
  chain([[7.6, -2.6, 13.5], [8, -2.2, 10], [7.6, -2.8, 7.5]], [0.25, 0.25, 0.2], gold);
  chain([[4, -3.4, 14], [3.4, -3.2, 11], [4.2, -3.2, 8.5]], [0.25, 0.25, 0.2], gold);
  chain([[13.2, -2.6, 19.5], [13.8, -3.4, 17], [13.6, -4.4, 15]], [0.25, 0.25, 0.2], gold);
}
// Halo: a gold ring standing behind the head, a jade stone at its crown.
color(gold) translate([4, 0, 38]) rotate([90, 0, 0]) rotate_extrude($fn = 40) translate([6.5, 0]) circle(0.45, $fn = 8);
color(jade) translate([4, -0.2, 44.6]) scale([1, 0.6, 1]) sphere(1, $fn = 14);
color(gold) translate([4, 0, 44.6]) rotate([90, 0, 0]) rotate_extrude($fn = 16) translate([1.1, 0]) circle(0.3, $fn = 6);
// Golden motes drifting around.
for (p = [[-13, -4, 30], [14, -6, 24], [-12, 2, 18], [15, 4, 14], [-10, -6, 36]]) color(gold) translate(p) scale([0.6, 0.6, 0.9]) sphere(1, $fn = 4);

// Battered cowboy hat, tipped forward over the eyes.
translate([0, -6.5, 34.8]) rotate([8, 0, 0]) {
  color(hat) mirror_x() intersection() {
    translate([0, -12, -2]) cube([14, 24, 8]);
    translate([3.5, 0, 0]) rotate([0, -14, 0]) translate([-3.5, 0, 0]) difference() {
      scale([9.4, 8.2, 1]) cylinder(h = 0.8, r = 1, $fn = 40);
      translate([0, 0, -0.1]) scale([5, 4.6, 1]) cylinder(h = 1, r = 1, $fn = 30);
    }
  }
  color(hat) intersection() { translate([-3.5, -9, 0]) cube([7, 18, 0.8]); scale([9.4, 8.2, 1]) cylinder(h = 0.8, r = 1, $fn = 40); }
  color(hat) hull() {
    translate([0, 0, 0.4]) scale([5, 4.6, 1]) cylinder(h = 1, r = 1, $fn = 30);
    translate([0, 0, 4.6]) scale([4, 4.2, 1.5]) sphere(1, $fn = 24);
  }
  color(hatDk) translate([0, 0, 6]) scale([1.3, 3.2, 0.6]) sphere(1, $fn = 14);
  color(hatBand) translate([0, 0, 1.2]) scale([5.1, 4.7, 1]) cylinder(h = 1, r = 1, $fn = 30);
}
