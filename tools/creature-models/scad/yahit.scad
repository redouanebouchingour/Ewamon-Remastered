// Yahit: a grub-like worm with a segmented tail-body, a top hat, a monocle and two big red boxing gloves.
include <lib.scad>

skin = [0.55, 0.43, 0.38];
skinDk = [0.42, 0.32, 0.28];
seg = [0.58, 0.55, 0.45];
segDk = [0.42, 0.4, 0.33];
hatBlack = [0.15, 0.15, 0.16];
hatBand = [0.5, 0.1, 0.12];
glove = [0.86, 0.15, 0.13];
gloveHi = [1, 0.4, 0.38];
gold = [0.85, 0.62, 0.15];
lace = [0.97, 0.97, 0.97];

// Segmented lower body: stacked rings tapering to the ground.
segs = [[0, 4.2, 3.6], [3.4, 5.0, 4], [7.2, 5.8, 4.2], [11.2, 6.5, 4.4], [15, 7.0, 4.2]];
for (i = [0 : len(segs) - 1]) {
  s = segs[i];
  ell([s[1], s[1] * 0.9, s[2] * 0.62], [0, 0.5, s[0] + s[2] * 0.6], i % 2 == 0 ? seg : segDk);
}
blob([[[3.8, 3.6, 3], [0, 0.5, 3]], [[6.4, 6, 4], [0, 0.5, 16]]], segDk);

// Upper body / head: a wide rounded lump leaning forward.
blob([[[10.5, 8.5, 7], [0, 0, 23]], [[8.5, 7.5, 5.5], [0, -1.5, 27]]], skin);
// Snout bulge forward-left.
blob([[[5, 4.5, 3.6], [-1.5, -6.5, 24]], [[3.2, 3, 2.6], [-3, -9, 23.5]]], skin);
// Mouth line.
color(skinDk) translate([-2, -9.6, 22.3]) rotate([0, 0, 15]) scale([4, 0.6, 0.35]) sphere(1, $fn = 16);
// Wrinkle lines on the back.
for (z = [20, 23.5]) color(skinDk) translate([0, 8.3, z]) scale([5, 0.6, 0.35]) sphere(1, $fn = 16);

// Eyes: one plain, one behind a gold monocle with a chain.
eye([-4.8, -6.6, 28], 1.5, iris = [0.15, 0.15, 0.15], yaw = 25);
eye([3, -7.4, 28], 1.6, iris = [0.15, 0.15, 0.15], yaw = -15);
color(gold) translate([3, -8.4, 28]) rotate([90, 0, -15]) rotate_extrude($fn = 24) translate([2.4, 0]) circle(0.45, $fn = 8);
color([0.85, 0.9, 0.95]) translate([3, -8.3, 28]) rotate([90, 0, -15]) cylinder(h = 0.2, r = 2.2, center = true, $fn = 20);
chain([[5.3, -8.2, 27], [7, -7, 25], [8.2, -5, 25.5]], [0.25, 0.25, 0.25], hatBlack);

// Top hat sitting on the crown.
translate([0, 0, 32]) {
  color(hatBlack) cylinder(h = 0.9, r = 7.2, $fn = 32);
  color(hatBand) translate([0, 0, 0.9]) cylinder(h = 2.2, r = 5, $fn = 32);
  color(hatBlack) translate([0, 0, 3.1]) cylinder(h = 5.5, r1 = 5, r2 = 5.3, $fn = 32);
}

// Thin arms bent out to the sides ending in huge gloves.
module arm(side) {
  sx = side;
  chain([[sx * 8, -1, 22], [sx * 12.5, -2, 19], [sx * 14.5, -4, 24]], [1.5, 1.4, 1.5], skin);
  // Glove cuff with laces.
  limb([sx * 14, -4, 24], [sx * 15, -5, 26], 2, 2.2, lace);
  blob([[[5.6, 5.2, 5.6], [sx * 17, -6, 30]], [[4.4, 4.4, 4.4], [sx * 16.5, -8, 28]]], glove);
  ell([2.6, 2.6, 2.4], [sx * 13.8, -8.5, 29], glove);
  color(gloveHi) translate([sx * 17.5, -11.1, 32]) rotate([20, 0, 0]) scale([2.2, 0.4, 1.4]) sphere(1, $fn = 16);
}
arm(-1);
arm(1);
