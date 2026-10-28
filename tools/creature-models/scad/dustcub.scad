// Dustcub: a chubby badger cub playing cowboy: a big brown hat, red bandana, torn vest, belt and holster, a lasso on
// its hip, spurred boots and a stalk of wheat in its mouth, fists up for a scrap.
include <lib.scad>

fur = [0.36, 0.26, 0.18];
furDk = [0.24, 0.17, 0.12];
cream = [0.86, 0.76, 0.58];
band = [0.18, 0.13, 0.1];
hat = [0.4, 0.28, 0.18];
hatDk = [0.3, 0.2, 0.13];
hatBand = [0.15, 0.12, 0.1];
bandana = [0.8, 0.16, 0.12];
vest = [0.46, 0.4, 0.3];
leather = [0.55, 0.36, 0.2];
leatherDk = [0.38, 0.24, 0.13];
buckle = [0.75, 0.68, 0.55];
rope = [0.72, 0.6, 0.35];
steel = [0.7, 0.72, 0.75];
pad = [0.85, 0.5, 0.45];
wheat = [0.9, 0.78, 0.4];

// Boots with spurs.
mirror_x() {
  blob([[[2.6, 3.8, 1.6], [4.5, -1.2, 1.6]], [[2.4, 2.4, 3], [4.5, 0.5, 4]]], leather);
  color(leatherDk) translate([4.5, 0.5, 6.2]) cylinder(h = 1, r = 2.6, $fn = 20);
  color(steel) translate([4.5, 3, 2.4]) rotate([0, 90, 0]) cylinder(h = 0.4, r = 1, center = true, $fn = 8);
  limb([4.5, 0.5, 7], [4, 0.5, 10], 2.6, 3, fur);
}
// Short stubby tail.
limb([0, 5.5, 9], [0, 8, 8], 1.8, 1.2, fur);

// Round torso with a cream belly.
torso = [7.2, 6.2, 8];
torsoC = [0, 0, 15];
ell(torso, torsoC, fur);
ell([4.8, 2, 6], [0, -4.6, 14.5], cream);

// Torn vest: a shell of the torso, open at the front, ragged hem.
color(vest) difference() {
  translate(torsoC) scale(torso * 1.06) sphere(1, $fn = 32);
  translate(torsoC) scale(torso * 0.98) sphere(1, $fn = 32);
  translate([0, 0, 1]) cube([30, 30, 26], center = true);
  translate([0, -10, 18]) cube([6.5, 10, 20], center = true);
}
// Ragged hem tatters and a patch on the back.
for (a = [30 : 30 : 330]) color(vest) translate([7.4 * sin(a), 6.4 * cos(a), 13.6]) rotate([0, 0, -a]) scale([0.9, 0.3, 1]) sphere(1, $fn = 6);
color(furDk) translate([2, 6.3, 18]) rotate([-10, 0, 0]) scale([1.5, 0.4, 1.5]) sphere(1, $fn = 6);
color(furDk) translate([-3, 6, 16]) rotate([-10, 0, 0]) scale([1, 0.4, 1.2]) sphere(1, $fn = 6);

// Belt with a big buckle, holster on the left hip, lasso coiled on the right.
color(leather) translate([0, 0, 11.6]) scale([7.15, 6.7, 1]) cylinder(h = 2, r = 1, center = true, $fn = 36);
color(buckle) translate([0, -6.85, 11.6]) cube([2.4, 0.6, 1.8], center = true);
color(leatherDk) translate([0, -7.2, 11.6]) cube([1.4, 0.4, 0.9], center = true);
blob([[[1.4, 1.2, 2.4], [-7.2, -1, 9.5]], [[1, 1, 1], [-7, -1, 12]]], leatherDk);
color(rope) translate([7.6, 0.5, 9.5]) rotate([0, 90, 0]) for (r = [2, 2.6]) rotate_extrude($fn = 24) translate([r, 0]) circle(0.35, $fn = 6);
color(rope) translate([7.8, 0.5, 9.5]) rotate([0, 90, 0]) limb([1, 2, 0], [-1, 4, 0], 0.3, 0.3, rope);

// Arms: fists up, the right raised high showing a pink paw pad.
mirror_x() limb([6, -0.5, 18.5], [8.5, -2.5, 16], 2.4, 2.2, fur);
limb([8.5, -2.5, 16], [9.5, -4.5, 20.5], 2.2, 2.2, fur);
ell([2.3, 2, 2.3], [9.5, -4.8, 21.5], fur);
limb([-8.5, -2.5, 16], [-8, -5, 21], 2.2, 2.2, fur);
ell([2.6, 2, 2.6], [-8.2, -5.4, 22.6], fur);
color(pad) translate([-8.2, -7.4, 22.6]) scale([1.4, 0.4, 1.4]) sphere(1, $fn = 12);

// Head: round, with a cream face and a dark mask band across the eyes.
head = [6.4, 5.8, 5.6];
headC = [0, -0.5, 26];
ell(head, headC, fur);
ell([4, 2.4, 3], [0, -4.2, 25.5], cream);
blob([[[2.4, 2.4, 1.8], [0, -6.8, 24.5]], [[1.5, 1.5, 1.2], [0, -8.4, 24.8]]], cream);
color(band) translate([0, -9.6, 25]) scale([1, 0.6, 0.7]) sphere(1, $fn = 12);
mirror_x() ell([1.7, 1, 1.4], [2.6, -4.8, 26.4], band);
// Badger stripes: cream blaze up the forehead, dark bands running back over the eyes.
ell([1.6, 3, 3.4], [0, -4, 29.2], cream);
mirror_x() limb([2.8, -4.6, 27.4], [4.8, 0, 28.5], 1.3, 1.6, band);
mirror_x() eye([2.5, -5.4, 26.6], 1, iris = [0.15, 0.1, 0.06], sclera = [0.3, 0.2, 0.12], yaw = -18);
// Smile and a wheat stalk in the corner of the mouth.
color(band) translate([0, -7.8, 23.6]) rotate([0, 0, 0]) scale([1.3, 0.4, 0.3]) sphere(1, $fn = 10);
limb([-1.2, -7.8, 23.6], [-6.5, -8.2, 25], 0.22, 0.18, wheat);
for (k = [0 : 2]) ell([0.6, 0.35, 0.3], [-6.2 + k * 0.7, -8.2, 25.3 - k * 0.1], wheat);
// Round ears.
mirror_x() { ell([1.6, 1, 1.6], [4.6, 0, 30], fur); ell([0.9, 0.5, 0.9], [4.6, -0.8, 30], cream); }

// Red bandana: a band round the neck, a triangle over the chest and a knot with tails at the side.
color(bandana) translate([0, -0.5, 21.6]) scale([5.4, 5, 1]) cylinder(h = 1.6, r = 1, center = true, $fn = 28);
color(bandana) hull() {
  translate([-4, -4.6, 21.4]) sphere(0.6, $fn = 8);
  translate([4, -4.6, 21.4]) sphere(0.6, $fn = 8);
  translate([0.6, -6.6, 16.4]) sphere(0.5, $fn = 8);
}
ell([1.2, 1, 1], [5, 1, 21.8], bandana);
limb([5, 1, 21.8], [7.8, 1.5, 22.8], 0.8, 0.3, bandana);
limb([5, 1, 21.8], [7.5, 2.5, 20], 0.8, 0.3, bandana);

// Cowboy hat: a dented crown with a dark band on a wide brim curled up at the sides, tilted back a little.
translate([0, 0.5, 29]) rotate([-10, 0, 0]) {
  // Brim: two halves, each tipped up towards its edge.
  color(hat) mirror_x() intersection() {
    translate([0, -12, -2]) cube([14, 24, 8]);
    translate([3.5, 0, 0]) rotate([0, -16, 0]) translate([-3.5, 0, 0]) difference() {
      scale([10, 8.6, 1]) cylinder(h = 0.8, r = 1, $fn = 40);
      translate([0, 0, -0.1]) scale([5.4, 5, 1]) cylinder(h = 1, r = 1, $fn = 30);
    }
  }
  color(hat) translate([-0.5, -5, 0]) cube([1, 10, 0.8]);
  color(hat) intersection() { translate([-3.5, -9, 0]) cube([7, 18, 0.8]); scale([10, 8.6, 1]) cylinder(h = 0.8, r = 1, $fn = 40); }
  color(hat) translate([0, 0, 0.4]) scale([5.4, 5, 1]) cylinder(h = 1.4, r = 1, $fn = 30);
  color(hat) hull() {
    translate([0, 0, 1]) scale([5.4, 5, 1]) cylinder(h = 1, r = 1, $fn = 30);
    translate([0, 0, 5.2]) scale([4.4, 4.4, 1.6]) sphere(1, $fn = 24);
  }
  color(hatDk) translate([0, 0, 6.6]) scale([1.4, 3.4, 0.6]) sphere(1, $fn = 14);
  color(hatBand) translate([0, 0, 1.6]) scale([5.5, 5.1, 1]) cylinder(h = 1.1, r = 1, $fn = 30);
}
