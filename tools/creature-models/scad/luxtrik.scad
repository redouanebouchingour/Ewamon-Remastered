// Luxtrik: a hunched olive moss-beetle. A plump plated body grown over with moss nubs and tiny pink buds, two pairs
// of big veined leaf-wings raised over its back, crab-like pincer forelegs, twig antennae sprouting leaves and
// glowing green gem eyes.
include <lib.scad>

olive = [0.5, 0.52, 0.18];
oliveLight = [0.66, 0.68, 0.3];
oliveDark = [0.32, 0.32, 0.12];
wingC = [0.62, 0.66, 0.28];
wingLight = [0.76, 0.8, 0.42];
veinC = [0.4, 0.42, 0.14];
bark = [0.35, 0.24, 0.14];
bud = [0.85, 0.55, 0.5];
gem = [0.3, 0.9, 0.35];
clawTip = [0.78, 0.72, 0.42];

module leaf(p, d, w, c) {
  l = norm(d);
  color(c) translate(p) rotate(_dir_rot(d)) translate([0, 0, l / 2]) scale([w, w * 0.35, l / 2]) sphere(1, $fn = 10);
}
// Moss nub with a pink bud on top.
module nub(p) {
  color(oliveLight) translate(p) scale([1, 1, 0.8]) sphere(1.1, $fn = 10);
  color(bud) translate(p + [0, 0, 1]) sphere(0.45, $fn = 8);
}

// Body: a plump thorax and a rounded abdomen, plated.
blob([[[7, 6.5, 6], [0, -2, 13]], [[6, 5, 5], [0, -6, 14]]], olive);
blob([[[7.5, 7, 6.5], [0, 6, 13]], [[5, 5, 4], [0, 12, 11]]], olive);
// Plate seams (darker bands) across the abdomen.
for (y = [4]) color(oliveDark) translate([0, y, 13 - (y - 4) * 0.2]) rotate([90, 0, 0]) scale([1, 1, 1]) rotate_extrude($fn = 28) translate([y < 10 ? 7.1 : 5.6, 0]) circle(0.4, $fn = 6);
// Moss nubs over the back.
for (p = [[-3, -2, 18.6], [2.5, -3, 18.4], [0, 2, 19.2], [-4.5, 5, 18.2], [4, 6, 18.4], [-1.5, 9, 17.6], [3, 11, 15.6], [-4, 12, 14.6], [6, 1, 16.8], [-6.4, 0, 16]]) nub(p);

// Head: a lowered wedge at the front.
blob([[[4.6, 4, 4], [0, -9.5, 11.5]], [[3, 3, 2.6], [0, -13.5, 10]]], olive);
ell([3.2, 2.4, 1.6], [0, -11, 14.4], oliveLight);
// Gem eyes on the sides of the head, faceted.
mirror_x() {
  color(gem) translate([3.4, -11.4, 12]) rotate([0, 0, -30]) scale([1.6, 1.3, 1.6]) sphere(1, $fn = 8);
  color([0.8, 1, 0.8]) translate([3.6, -12.6, 12.6]) sphere(0.4, $fn = 8);
}
// Little mandibles.
mirror_x() spike([1.4, -15.5, 9.2], [-0.6, -1.4, -0.8], 0.5, 0.05, clawTip);

// Twig antennae curving forward and out, sprouting leaves.
mirror_x() {
  chain([[1.6, -11, 14.5], [4, -14, 19], [8, -16, 21.5], [12, -15, 20], [14, -14, 17]], [0.5, 0.45, 0.4, 0.35, 0.3], bark);
  leaf([4, -14, 19], [1, -0.5, 2], 0.7, wingLight);
  leaf([8, -16, 21.5], [0, -0.5, 2.2], 0.7, wingC);
  leaf([12, -15, 20], [1, -0.5, 2], 0.6, wingLight);
  leaf([14, -14, 17], [0.6, 0, -1.6], 0.6, wingC);
}

// Wings: two pairs of big veined leaves, raised and swept back.
module wing(p, rot, s, c) {
  translate(p) rotate(rot) {
    color(c) scale([s[0], 0.5, s[1]]) translate([0, 0, 1]) sphere(1, $fn = 24);
    color(veinC) translate([0, -0.35, s[1]]) scale([0.25, 0.25, s[1] * 0.95]) sphere(1, $fn = 8);
    for (k = [0.5, 1, 1.5]) mirror([1, 0, 0]) color(veinC)
      translate([s[0] * 0.25, -0.35, s[1] * k]) rotate([0, 50, 0]) scale([0.18, 0.2, s[0] * 0.55]) sphere(1, $fn = 6);
    for (k = [0.5, 1, 1.5]) color(veinC)
      translate([s[0] * 0.25, -0.35, s[1] * k]) rotate([0, 50, 0]) scale([0.18, 0.2, s[0] * 0.55]) sphere(1, $fn = 6);
  }
}
mirror_x() {
  wing([3, 0, 18], [-35, 28, 0], [4.2, 10], wingC);
  wing([4, 4, 17], [-60, 52, 10], [3.4, 8.5], wingLight);
}

// Pincer forelegs: thick plated arms ending in two-pronged claws.
mirror_x() {
  limb([5, -6, 11], [9, -9, 8], 2.2, 2, olive);
  limb([9, -9, 8], [10.5, -13, 5], 2, 2.4, oliveLight);
  ell([2.6, 3, 2.4], [10.5, -13.5, 4.8], olive);
  color(clawTip) hull() { translate([9.4, -15, 4.4]) sphere(1.1, $fn = 10); translate([9, -18, 2.6]) sphere(0.25, $fn = 6); }
  color(clawTip) hull() { translate([11.8, -15, 4.4]) sphere(1.1, $fn = 10); translate([12.4, -18, 2.4]) sphere(0.25, $fn = 6); }
  nub([10.5, -12, 7.6]);
}
// Back legs: stubby, clawed.
mirror_x() for (y = [2, 9]) {
  limb([5.5, y, 9], [8.5, y + 1, 4], 1.8, 1.6, olive);
  limb([8.5, y + 1, 4], [9.5, y, 1], 1.6, 1.4, oliveDark);
  for (a = [-25, 25]) spike([9.5, y, 1], [sin(a), -1.6, -0.6], 0.6, 0.05, clawTip);
}
