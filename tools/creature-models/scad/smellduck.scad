// Smellduck: a round lime-green duckling with a pink scalloped bud crest, a pink beak dripping drool and a dark teal
// leaf tail it holds at its side.
include <lib.scad>

green = [0.6, 0.86, 0.3];
greenHi = [0.72, 0.94, 0.4];
greenDk = [0.42, 0.66, 0.2];
pink = [0.82, 0.25, 0.45];
pinkHi = [0.95, 0.45, 0.58];
pinkDk = [0.6, 0.15, 0.32];
beak = [0.88, 0.32, 0.4];
beakDk = [0.66, 0.2, 0.28];
teal = [0.13, 0.45, 0.37];
tealHi = [0.2, 0.55, 0.45];
foot = [0.66, 0.9, 0.5];
drool = [0.7, 0.88, 1];

// Body: a squat pear.
blob([[[11.5, 9.5, 9], [0, 0, 10]], [[10, 8.5, 8], [0, -0.5, 17]]], green);

// Head merging into the body (duck-like, no neck).
blob([[[9.5, 8, 7], [0, -0.5, 24]], [[9.5, 8, 5], [0, -0.5, 19]]], green);
// Little ear tufts.
mirror_x() spike([7.2, 0, 28.5], [1.2, 0, 2.6], 1.4, 0.2, green);

// Sleepy half-lidded eyes.
mirror_x() {
  eye([4, -7.2, 25.6], 1.7, iris = [0.55, 0.12, 0.12], pupil = [0.25, 0.05, 0.05], yaw = -22, flat = 0.4);
  color(green) translate([4, -7.5, 26.6]) rotate([0, 0, -22]) scale([2.1, 0.9, 1.0]) sphere(1, $fn = 16);
  color([0.1, 0.12, 0.08]) translate([4, -8.1, 26.0]) rotate([0, 0, -22]) scale([2, 0.4, 0.25]) sphere(1, $fn = 12);
}

// Beak: a chunky flat-tipped wedge pointing forward and down.
color(beak) hull() {
  translate([0, -6.5, 22]) scale([3.4, 1.5, 2.6]) sphere(1, $fn = 20);
  translate([0, -12, 19.5]) scale([3.8, 1.2, 2.6]) sphere(1, $fn = 20);
}
color(beakDk) translate([0, -11.8, 18]) scale([3.2, 1.2, 0.8]) sphere(1, $fn = 16);
mirror_x() ell([0.4, 0.3, 0.4], [1.2, -13.1, 20.6], beakDk);
// Drool drip.
limb([-1.2, -12.2, 17.5], [-1.2, -12.4, 12.5], 0.45, 0.8, drool);
ell([0.95, 0.95, 1.2], [-1.2, -12.4, 12.1], drool);

// Crest: a scallop-shell fan of pink ribs standing on the crown, leaning back.
translate([0, 1, 29.5]) rotate([-18, 0, 0]) {
  for (i = [-4 : 4]) {
    a = i * 19;
    c = (abs(i) % 2 == 0) ? pink : pinkHi;
    color(c) rotate([0, a, 0]) translate([0, 0, 5]) scale([3.2, 3.4, 6.4]) sphere(1, $fn = 20);
  }
  for (i = [-3.5 : 1 : 3.5]) color(pinkDk) rotate([0, i * 19, 0]) translate([0, 0, 5.4]) scale([0.3, 3.7, 6]) sphere(1, $fn = 12);
  color(pink) scale([5, 3.8, 2.5]) sphere(1, $fn = 20);
}

// Stubby wing nubs.
mirror_x() petal([1.4, 3, 4], [10.2, 0.5, 15], [0, 20, -10], greenDk);

// Teal leaf tail held out to the viewer's right.
color(teal) translate([13.5, 2, 9]) rotate([0, 25, -30]) scale([5, 2.6, 6.5]) sphere(1, $fn = 28);
color(tealHi) translate([13.1, -0.3, 10]) rotate([0, 25, -30]) scale([3.6, 1.2, 4.8]) sphere(1, $fn = 20);
limb([9.5, 1, 8], [12, 1.5, 8.5], 1.5, 1.6, green);

// Webbed feet.
mirror_x() {
  limb([4.5, 0, 3], [4.5, -1, 1.2], 1.8, 1.4, green);
  for (a = [-30, 0, 30]) limb([4.5, -1, 0.8], [4.5 + sin(a) * 3, -1 - cos(a) * 3.8, 0.7], 0.8, 0.6, foot);
}
