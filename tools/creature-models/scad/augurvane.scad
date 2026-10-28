// Augurvane: a standing navy-black raven seer with a spiky cream-tipped crest, a glowing third eye over two pale violet
// eyes, a cream beak, a dark collar set with a violet gem, long wings fading to cream, and a gold lantern in one hand.
include <lib.scad>

navy = [0.17, 0.15, 0.24];
navyHi = [0.24, 0.21, 0.33];
cream = [0.86, 0.82, 0.66];
creamDk = [0.66, 0.62, 0.48];
gem = [0.85, 0.6, 1];
gemDk = [0.5, 0.25, 0.65];
gold = [0.62, 0.38, 0.08];
goldDk = [0.45, 0.27, 0.06];
flame = [1, 0.82, 0.3];

// Body: an upright egg, chest forward.
blob([[[7, 6.5, 9], [0, 0.5, 16]], [[5.5, 5, 5], [0, -1, 21]], [[5.5, 5.5, 4], [0, 1, 9]]], navy);
// Collar: a dark band around the neck with a violet gem at the front.
color(navyHi) translate([0, -0.2, 24.5]) scale([6.2, 6, 1.6]) sphere(1, $fn = 28);
color(gemDk) translate([0, -6.2, 23]) scale([1.2, 0.6, 1.6]) sphere(1, $fn = 14);
color(gem) translate([0, -6.6, 23]) scale([0.8, 0.5, 1.2]) sphere(1, $fn = 12);

// Head.
blob([[[6.5, 6, 6], [0, 0, 30]], [[4.8, 4.5, 4.5], [0, -2.5, 29]]], navy);
// Crest: a fan of spiky feathers sweeping up and back, the outer ones tipped in cream.
crest = [[0, 2, 35, 0, 2, 8, navy], [2.5, 1.5, 34.5, 4, 1, 6, cream], [-2.5, 1.5, 34.5, -4, 1, 6, cream],
         [4.5, 1, 32, 6, 0.5, 3, navy], [-4.5, 1, 32, -6, 0.5, 3, navy], [1, 4, 34, 2, 6, 5, navy],
         [-1, 4, 34, -2, 6, 5, cream], [0, 5.5, 31, 0, 7, 1, navy], [3.5, 4, 32, 5, 5, 2, cream],
         [-3.5, 4, 32, -5, 5, 2, navy]];
for (s = crest) {
  spike([s[0], s[1], s[2]], [s[3] * 0.6, s[4] * 0.6, s[5] * 0.6], 2.5, 1.1, navy);
  spike([s[0] + s[3] * 0.55, s[1] + s[4] * 0.55, s[2] + s[5] * 0.55], [s[3] * 0.5, s[4] * 0.5, s[5] * 0.5], 1.4, 0.1, s[6]);
}
// Cheek tufts.
mirror_x() spike([5, -1, 28], [3, 0.5, -1.5], 1.4, 0.1, navy);

// Eyes: two pale violet glowing eyes and a third on the forehead.
mirror_x() eye([2.6, -5.6, 30], 1.6, iris = [1, 0.95, 1], pupil = [1, 0.95, 1], sclera = [0.8, 0.45, 0.9], yaw = -22, shine = false);
eye([0, -5.4, 33.6], 1.5, iris = [1, 0.95, 1], pupil = [1, 0.95, 1], sclera = [0.8, 0.45, 0.9], shine = false);

// Cream beak, slightly hooked.
color(cream) hull() {
  translate([0, -6, 28.4]) scale([1.8, 1.4, 1.5]) sphere(1, $fn = 16);
  translate([0, -11, 26.6]) sphere(0.35, $fn = 10);
}
color(creamDk) hull() {
  translate([0, -6, 27.4]) scale([1.3, 1, 0.8]) sphere(1, $fn = 14);
  translate([0, -9, 26.8]) sphere(0.3, $fn = 10);
}

// Wings: long, folded down the sides, navy at the shoulder and cream on the long flight feathers with a faint
// navy vane marking on each.
module wing(lantern = false) {
  petal([2.6, 4, 7], [7.5, 0.8, 19], [0, -12, 0], navy);
  for (i = [0 : 4]) {
    petal([2.4, 1.0, 7.5], [9.6 + i * 0.7, -3 + i * 1.8, 11 - i * 0.6], [0, -30 - i * 6, 0], cream);
    petal([0.8, 0.6, 2.2], [10.9 + i * 0.7, -3.8 + i * 1.8, 9.2 - i * 0.6], [0, -30 - i * 6, 0], creamDk);
  }
  petal([3, 1.4, 5], [8.8, -0.5, 16], [0, -20, 0], navy);
}
mirror_x() wing();
// Tail: a few long cream feathers behind.
for (a = [-22, 0, 22]) petal([1.5, 0.8, 6], [sin(a) * 2.5, 7, 7], [-55, a, 0], cream);
ell([3, 2, 3], [0, 5.5, 9], navy);

// The arm on the viewer's left reaches forward and holds a gold lantern.
limb([-6.5, -1, 20], [-9.5, -5, 17], 1.4, 1.1, navy);
ell([1.4, 1.3, 1.2], [-9.8, -5.5, 16.6], cream);
module lantern(p) {
  translate(p) {
    color(gold) rotate([90, 0, 0]) rotate_extrude($fn = 20) translate([1.2, 0]) circle(0.25, $fn = 8);
    translate([0, 0, -2]) {
      color(goldDk) cylinder(h = 0.8, r1 = 0.8, r2 = 1.8, $fn = 16);
      color(goldDk) translate([0, 0, -0.6]) cylinder(h = 0.6, r = 2, $fn = 16);
      translate([0, 0, -5.4]) {
        color(flame) translate([0, 0, 0.6]) cylinder(h = 4.2, r = 1.75, $fn = 16);
        color(gold) for (a = [45 : 90 : 359]) rotate([0, 0, a]) translate([1.6, 0, 0.6]) cylinder(h = 4.2, r = 0.3, $fn = 6);
        color(goldDk) cylinder(h = 0.7, r = 2.1, $fn = 16);
      }
      color([1, 0.95, 0.7]) translate([0, 0, -3]) sphere(0.9, $fn = 12);
    }
  }
}
translate([-9.8, -5.5, 15.2]) scale(1.4) lantern([0, 0, 0]);

// Legs and cream three-toed feet.
mirror_x() {
  limb([3, 0.5, 9], [3.4, 0, 1.2], 1.4, 1, navy);
  for (a = [-35, 0, 35]) {
    limb([3.4, 0, 0.8], [3.4 + sin(a) * 3.2, -cos(a) * 3.2, 0.6], 0.75, 0.55, cream);
    spike([3.4 + sin(a) * 3.4, -cos(a) * 3.4, 0.6], [sin(a) * 0.8, -cos(a) * 0.8, -0.4], 0.45, 0.05, creamDk);
  }
  limb([3.4, 0, 0.8], [3.4, 2.6, 0.6], 0.6, 0.5, cream);
}
