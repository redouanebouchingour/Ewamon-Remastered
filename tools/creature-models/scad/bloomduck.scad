// Bloomduck: a green duck crowned with a pink hibiscus, a red-orange bill and a scowl, teal wings held out, a long
// spray of leafy tail feathers and orange webbed feet. Stink lines curl up from the flower.
include <lib.scad>

green = [0.55, 0.78, 0.25];
greenDk = [0.36, 0.58, 0.18];
belly = [0.86, 0.92, 0.45];
teal = [0.1, 0.42, 0.36];
tealHi = [0.18, 0.55, 0.45];
leaf = [0.3, 0.6, 0.22];
leafHi = [0.5, 0.75, 0.3];
pink = [0.93, 0.42, 0.55];
pinkHi = [0.98, 0.6, 0.7];
magenta = [0.78, 0.12, 0.35];
stamen = [0.96, 0.85, 0.2];
bill = [0.93, 0.35, 0.25];
billDk = [0.72, 0.2, 0.15];
foot = [0.93, 0.4, 0.15];
stink = [0.85, 0.72, 0.25];

// Body: a plump duck torso leaning slightly forward.
blob([[[11, 11, 9], [0, 1, 11]], [[8.5, 8, 7.5], [0, -2, 15]]], green);
ell([7, 3.5, 7], [0, -6.8, 12.5], belly);

// Neck and head.
blob([[[5.5, 5.5, 5], [0, -2, 18]], [[7.5, 7, 6.5], [0, -3, 24]]], green);
// Bill: wide, flat, red-orange.
color(bill) hull() {
  translate([0, -8.5, 23]) scale([3.8, 1.8, 2]) sphere(1, $fn = 20);
  translate([0, -14, 22]) scale([3.6, 2, 1.4]) sphere(1, $fn = 20);
}
color(billDk) translate([0, -12.4, 21.2]) scale([3.1, 2.4, 0.6]) sphere(1, $fn = 16);
// Scowling eyes: pale blue under heavy dark brows.
mirror_x() {
  eye([3.4, -8.6, 25.4], 1.9, iris = [0.25, 0.55, 0.75], pupil = [0.05, 0.1, 0.15], sclera = [0.8, 0.92, 0.95], yaw = -25, flat = 0.4);
  color([0.12, 0.2, 0.1]) translate([3.2, -9.2, 27.2]) rotate([0, 22, -25]) scale([2.6, 0.7, 0.5]) sphere(1, $fn = 12);
}
// Darker cheek spot.
mirror_x() ell([1, 0.5, 1], [6, -6, 23], greenDk);

// Hibiscus on the head: five big pink petals, magenta centre, yellow stamens.
translate([0, -2, 29.5]) scale(1.65) {
  for (i = [0 : 4]) {
    a = i * 72 + 18;
    color(i % 2 == 0 ? pink : pinkHi) rotate([0, 0, a]) translate([4.6, 0, 0]) rotate([0, -40, 0]) scale([4.2, 3.8, 1.8]) sphere(1, $fn = 22);
  }
  ell([3, 3, 1.8], [0, 0, 0.4], magenta);
  for (i = [0 : 4]) {
    a = i * 72;
    limb([0, 0, 0.5], [cos(a) * 1.2, sin(a) * 1.2, 2.8], 0.4, 0.35, leafHi);
    ell([0.7, 0.7, 0.7], [cos(a) * 1.2, sin(a) * 1.2, 3.0], stamen);
  }
}

// Stink lines: little zigzags rising above the flower.
module zig(p, s) {
  chain([p, p + [s, 0, 1.2], p + [-s, 0, 2.4], p + [s, 0, 3.6], p + [0, 0, 4.6]], [0.32, 0.32, 0.32, 0.32, 0.25], stink);
}
zig([-7, -2, 37], 0.6);
zig([-1.5, -3, 39], 0.7);
zig([4.5, -2, 38], 0.6);

// Wings: teal, held out and down from the shoulders, with feather tips.
mirror_x() {
  translate([12, 0, 14]) rotate([0, 62, -12]) {
    color(teal) scale([5, 1.5, 9.5]) sphere(1, $fn = 22);
    for (k = [-1.5 : 1 : 1.5]) color(tealHi) translate([k * 1.8, -0.8, -6.5]) scale([1.2, 0.9, 4]) sphere(1, $fn = 14);
  }
}

// Tail: a long spray of leafy feathers sweeping back and to the viewer's right.
for (f = [[18, 0, leaf], [32, 10, leafHi], [8, -12, leaf], [26, -24, leafHi], [12, 24, leaf]]) {
  color(f[2]) translate([4, 8, 9]) rotate([0, 0, f[0] - 25]) rotate([f[1] - 30, 0, 0]) translate([0, 9, 0]) scale([2.4, 10, 1.1]) sphere(1, $fn = 20);
}
color(greenDk) translate([3, 7, 9]) scale([4, 3, 3]) sphere(1, $fn = 20);

// Legs and orange webbed feet.
mirror_x() {
  limb([4.5, 0, 4], [5, -1, 1.2], 1.2, 1, foot);
  for (a = [-30, 0, 30]) limb([5, -1, 0.8], [5 + sin(a) * 2.8, -1 - cos(a) * 3.6, 0.6], 0.8, 0.6, foot);
}
