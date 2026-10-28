// Puffinch: a round tan chick with a cream heart-shaped face and belly, big brown eyes, a little orange beak, a tuft of
// crest feathers, stubby flapping wings, orange feet and two long ribbon tail feathers trailing along the ground.
include <lib.scad>

tan = [0.78, 0.6, 0.36];
tanDark = [0.62, 0.45, 0.26];
cream = [0.97, 0.9, 0.7];
beak = [0.95, 0.5, 0.15, NOGLOW];
foot = [0.98, 0.55, 0.15, NOGLOW];
iris = [0.3, 0.18, 0.1];

// Body: one round egg.
color(tan) translate([0, 0, 16]) scale([13, 12, 14]) sphere(1, $fn = 40);
// Cream face (two lobes meeting in a heart) and belly.
// (patches are the body shell grown slightly, cut to shape, so they sit flush)
module shell(k = 1.015) { translate([0, 0, 16]) scale([13, 12, 14] * k) sphere(1, $fn = 40); }
color(cream) intersection() {
  shell();
  union() {
    mirror_x() translate([4.4, -12, 19.5]) scale([6.4, 6, 6.6]) sphere(1, $fn = 20);
    translate([0, -12, 9]) scale([10.5, 6, 9]) sphere(1, $fn = 24);
  }
}
// Little chevron "v"s on the belly.
for (x = [-3, 0, 3]) color(tanDark) translate([x, -11.4, 10.5]) rotate([0, 45, 0]) scale([1, 0.3, 0.25]) sphere(1, $fn = 8);
// Big eyes.
mirror_x() eye([4.3, -10.9, 20], 2.5, iris = iris, pupil = [0.08, 0.05, 0.03], yaw = -18, flat = 0.4);
// Beak.
color(beak) hull() {
  translate([0, -11.6, 17])  scale([1.8, 1, 1.2]) sphere(1, $fn = 14);
  translate([0, -14.2, 15.8]) sphere(0.25, $fn = 8);
}
// Crest tuft.
for (c = [[-2.5, -15, 6], [0, 0, 7.5], [2.5, 15, 6], [1, 30, 5]]) color(tanDark)
  hull() { translate([c[0], 1, 28.5]) scale([1.4, 1, 1]) sphere(1.3, $fn = 10); translate([c[0] + c[1] * 0.12, 0, 28.5 + c[2]]) sphere(0.6, $fn = 8); }

// Stubby wings held out and up, cream-tipped.
mirror_x() {
  // Three feather fingers fanning out from the shoulder.
  for (f = [[0, 5.5, tan], [-22, 5, tan], [-44, 4.2, cream]]) color(f[2])
    translate([12, 1, 18]) rotate([0, f[0] - 25, -12]) translate([f[1] * 0.7, 0, 0]) scale([f[1], 1.1, 1.5]) sphere(1, $fn = 14);
}

// Orange feet with three toes.
mirror_x() {
  limb([5, -1, 4], [5, -2, 1], 0.9, 0.7, foot);
  for (a = [-30, 0, 30]) limb([5, -2, 0.8], [5 + sin(a) * 3.4, -2 - cos(a) * 3.4, 0.6], 0.8, 0.5, foot);
}

// Ribbon tail feathers: two thin wavy streamers trailing behind and to the viewer's right along the ground.
module streamer(pts) {
  for (i = [0 : len(pts) - 2]) color(tan) hull() {
    translate(pts[i]) scale([0.9, 0.9, 0.5]) sphere(1, $fn = 10);
    translate(pts[i + 1]) scale([0.9, 0.9, 0.5]) sphere(1, $fn = 10);
  }
}
streamer([[6, 10, 6], [11, 12, 3], [15, 10, 2.2], [18, 13, 1], [21, 11, 0.6], [24, 13, 0.6]]);
streamer([[4, 11, 5], [7, 15, 2], [11, 17, 1.4], [15, 15, 0.6], [18, 18, 0.6], [22, 17, 0.6]]);
