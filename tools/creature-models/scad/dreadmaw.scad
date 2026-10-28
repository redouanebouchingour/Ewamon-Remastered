// Dreadmaw: Gnashfin grown into a hulking black pirate shark: a huge grin, a torn purple bandana with a bone charm,
// ragged navy fins and a rusty chain with an anchor wound round its tail.
include <lib.scad>

black = [0.12, 0.12, 0.16];
blackHi = [0.2, 0.2, 0.26];
navy = [0.2, 0.28, 0.52];
cream = [0.95, 0.9, 0.74];
mouthDark = [0.08, 0.05, 0.1];
bandana = [0.32, 0.22, 0.52];
bandanaHi = [0.42, 0.3, 0.64];
bone = [0.92, 0.88, 0.78];
rust = [0.78, 0.35, 0.15];
irisC = [0.7, 0.3, 0.75];

// Torso: a big pear, head grown into the shoulders.
blob([[[11, 9, 9], [0, 0, 11]], [[10, 8.5, 8], [0, -0.5, 19]]], black);
// Navy ragged hem round the belly and hips.
// Navy lower belly with ragged flame-like points rising into the black.
blob([[[10.8, 8.8, 5], [0, 0, 8.5]]], navy);
color(navy) for (a = [0 : 24 : 359]) let(r = 1 + 0.25 * sin(a * 3)) hull() {
  translate([cos(a) * 10.4, sin(a) * 8.4, 10]) sphere(1.6, $fn = 8);
  translate([cos(a + 8) * 10.6 * r, sin(a + 8) * 8.6 * r, 15 + 1.5 * sin(a * 5)]) sphere(0.3, $fn = 6);
}

// Head: wide, flat-topped shark head.
hc = [0, -1.5, 28];
ell([12, 11, 8.5], hc, black);
blob([[[11, 9.8, 3.5], [0, -2, 23.5]]], black);
// Snout ridge.
ell([7, 4.5, 3.5], [0, -9, 30.5], black);

// The grin.
function my(x) = -12.7 + 0.05 * x * x;
color(mouthDark) hull() for (x = [-11 : 1.5 : 11]) translate([x, my(x) + 1, 25.4]) scale([1, 0.6, 2]) sphere(1.6, $fn = 10);
module teeth_row(z0, dz, w) {
  for (x = [-10 : w : 10.1]) {
    y = my(x) - 0.2;
    color(cream) translate([x, y, z0]) hull() {
      translate([-w / 2, 0.3, 0]) sphere(0.7, $fn = 8);
      translate([w / 2, 0.3, 0]) sphere(0.7, $fn = 8);
      translate([0, -0.2, dz]) sphere(0.3, $fn = 6);
    }
  }
}
color(cream) hull() for (x = [-10.8 : 1.35 : 10.8]) translate([x, my(x) + 0.1, 28.4]) scale([1, 1, 0.8]) sphere(0.9, $fn = 8);
color(cream) hull() for (x = [-10 : 1.25 : 10]) translate([x, my(x) + 0.2, 22.2]) scale([1, 1, 0.8]) sphere(0.8, $fn = 8);
teeth_row(27.8, -3.4, 2.2);
teeth_row(22.6, 3.0, 2.0);

// Narrow purple eyes with a heavy scarred brow.
mirror_x() {
  eye([5.2, -10.8, 31.6], 1.8, iris = irisC, pupil = [0.25, 0.05, 0.3], sclera = [0.85, 0.8, 0.9], yaw = -22, flat = 0.4);
  color(blackHi) translate([5, -11.3, 33.3]) rotate([0, 20, -22]) scale([3, 1.1, 0.8]) sphere(1, $fn = 14);
}
color(blackHi) translate([-5.4, -11.2, 33.5]) rotate([0, 60, -20]) scale([0.35, 0.35, 2.6]) sphere(1, $fn = 8);

// Torn purple bandana round the neck, a bone charm hanging at the front and a knot at the back.
color(bandana) translate([0, -0.8, 20.6]) scale([11.6, 10.2, 2.4]) sphere(1, $fn = 32);
color(bandana) hull() {
  translate([-7, -9, 20.5]) sphere(0.8, $fn = 8);
  translate([7, -9, 20.5]) sphere(0.8, $fn = 8);
  translate([0, -9.4, 13]) sphere(0.6, $fn = 8);
}
color(bandanaHi) hull() {
  translate([-4, -9.8, 20]) sphere(0.4, $fn = 8);
  translate([4, -9.8, 20]) sphere(0.4, $fn = 8);
  translate([0, -10, 15]) sphere(0.3, $fn = 8);
}
// Bone charm.
color(bone) translate([0, -10.4, 16.6]) {
  scale([0.6, 0.5, 1.8]) sphere(1, $fn = 10);
  mirror_x() translate([0.8, 0, 1.6]) sphere(0.75, $fn = 10);
  mirror_x() translate([0.8, 0, -1.6]) sphere(0.75, $fn = 10);
}
// Knot and tails at the back.
ell([2.2, 1.6, 1.8], [0, 9.6, 21.5], bandana);
mirror_x() color(bandana) hull() {
  translate([1, 9.8, 21.5]) sphere(1, $fn = 8);
  translate([5, 11, 18]) sphere(0.5, $fn = 8);
  translate([3, 10.6, 17]) sphere(0.4, $fn = 8);
}

// Jagged dorsal fin on the crown, ragged trailing edge.
color(black) hull() {
  translate([0, 0, 34]) scale([1.8, 7, 1]) sphere(1, $fn = 14);
  translate([0, 7, 46]) sphere(0.6, $fn = 8);
}
color(black) for (i = [0 : 2]) hull() {
  translate([0, 2.5 + i * 1.6, 37 + i * 2.6]) sphere(0.9, $fn = 8);
  translate([0, 6.5 + i * 1.6, 38 + i * 2.6]) sphere(0.35, $fn = 8);
}

// Arms: thick fin-arms hanging down, ragged navy tips.
mirror_x() {
  limb([9.5, -0.5, 20], [13, -1.5, 12], 3, 2.6, black);
  color(navy) hull() {
    translate([13, -1.5, 12]) sphere(2.6, $fn = 12);
    translate([14.5, -2, 6]) sphere(0.6, $fn = 8);
    translate([12, -1, 6.5]) sphere(0.5, $fn = 8);
  }
  for (k = [-1, 1]) color(navy) hull() {
    translate([13 + k * 1.4, -1.5, 9]) sphere(1, $fn = 8);
    translate([13 + k * 2.6, -1.8, 4.5]) sphere(0.3, $fn = 8);
  }
}

// Short legs with pale claws.
mirror_x() {
  ell([4, 4, 4], [5.5, 0, 4.2], black);
  ell([3.6, 4.8, 1.8], [5.8, -1.5, 1.8], black);
  for (a = [-25, 0, 25]) spike([5.8 + sin(a) * 1.8, -6, 1.2], [sin(a) * 0.5, -1.2, -0.4], 0.5, 0.05, bone);
}

// Tail swept out to the viewer's right with a big ragged fin.
chain([[3, 6, 8], [10, 7, 6.5], [16, 5, 7.5], [20, 3, 10]], [5.5, 4, 3, 2.2], black);
color(navy) hull() {
  translate([10, 6.6, 5]) sphere(2.5, $fn = 10);
  translate([16, 4.8, 6]) sphere(2, $fn = 10);
}
color(black) hull() {
  translate([20, 3, 10]) scale([1.4, 1.6, 2]) sphere(1.8, $fn = 10);
  translate([24, 5, 27]) sphere(0.8, $fn = 8);
  translate([23, 2, 19]) sphere(0.7, $fn = 8);
}
color(navy) hull() {
  translate([21, 1.6, 12]) sphere(1.1, $fn = 8);
  translate([22.8, 1.4, 18]) sphere(0.5, $fn = 8);
  translate([20.5, 1.6, 17]) sphere(0.5, $fn = 8);
}
color(black) hull() {
  translate([20, 3, 9]) sphere(1.5, $fn = 10);
  translate([26, 4, 4]) sphere(0.6, $fn = 8);
}

// Rusty chain looped round the tail, an anchor dangling from it.
module link(p, rot) {
  color(rust) translate(p) rotate(rot) scale([1, 0.6, 1]) rotate_extrude($fn = 12) translate([1.2, 0]) circle(0.45, $fn = 6);
}
for (i = [0 : 9]) {
  t = i / 9;
  a = t * 540;
  link([10 + t * 8, 6.4 - t * 2 + 4.4 * sin(a), 7 + 4.4 * cos(a) + t * 2], [i * 90, 0, 30]);
}
for (i = [0 : 3]) link([18.5, 1.5, 6 - i * 1.7], [0, i % 2 * 90, 0]);
// Anchor: shank, stock and curved arms.
color(rust) {
  translate([18.5, 1.3, 1]) cylinder(h = 5, r = 0.45, $fn = 8);
  translate([18.5, 1.3, 5]) rotate([0, 90, 0]) cylinder(h = 3, r = 0.35, center = true, $fn = 8);
  translate([18.5, 1.3, 3]) rotate([-90, 0, 0]) rotate_extrude(angle = 180, $fn = 16) translate([2, 0]) circle(0.4, $fn = 6);
  for (x = [16.5, 20.5]) translate([x, 1.3, 3]) cylinder(h = 1.2, r1 = 0.6, r2 = 0.05, $fn = 8);
}
