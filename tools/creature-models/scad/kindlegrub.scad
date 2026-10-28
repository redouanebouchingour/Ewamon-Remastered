// Kindlegrub: a soot-brown grub with lava seams between its segments, glowing eyes, bone horns, and a cracked
// magma rock on its back that burns with a little flame.
include <lib.scad>

brown = [0.2, 0.16, 0.14];
brownHi = [0.28, 0.23, 0.2];
rock = [0.25, 0.21, 0.19];
lava = [1, 0.45, 0.08];
lavaCore = [1, 0.75, 0.2];
bone = [0.78, 0.7, 0.6];
flameRed = [0.95, 0.3, 0.08];
flameOrange = [1, 0.58, 0.1];
flameCore = [1, 0.88, 0.35];

// Body segments from the head back, with glowing lava rings in the seams.
segs = [[-2, 8.6, 9], [4, 8.4, 8.8], [10, 8, 8.4], [15.5, 7.2, 7.6], [20, 6, 6.4]]; // [y, radius, z]
for (s = segs) ell([s[1], 3.6, s[1] * 0.92], [0, s[0], s[2]], brown);
for (i = [0 : len(segs) - 2]) {
  a = segs[i]; b = segs[i + 1];
  y = (a[0] + b[0]) / 2;
  r = (a[1] + b[1]) / 2 * 0.93;
  z = (a[2] + b[2]) / 2;
  color(lava) translate([0, y, z]) rotate([90, 0, 0]) scale([r, r * 0.95, 1]) cylinder(h = 1.6, r = 1, center = true, $fn = 32);
}
// Fill between segments so the seams read as thin glowing lines rather than gaps.
for (s = segs) ell([s[1] * 0.97, 2.6, s[1] * 0.89], [0, s[0] + 1.6, s[2]], brown);

// Head: a big round dark head out front, taller than the body.
ell([9.6, 8, 9.6], [0, -9, 13], brown);
ell([5, 3, 3.2], [0, -15, 8.6], brownHi);
// Glowing orange eyes, no pupils.
mirror_x() {
  color(lava) translate([4.4, -15.6, 14.6]) rotate([0, 0, -26]) scale([2.4, 1.2, 2.9]) sphere(1, $fn = 16);
  color(lavaCore) translate([4.3, -16.5, 15]) rotate([0, 0, -26]) scale([1.3, 0.7, 1.6]) sphere(1, $fn = 12);
}
// Glowing cheek spots and a little mouth.
mirror_x() color(lava) translate([7.2, -12.6, 8.8]) scale([1.5, 0.9, 1.4]) sphere(1, $fn = 12);
color([0.08, 0.05, 0.05]) translate([0, -17.4, 8.6]) scale([1.6, 0.5, 0.6]) sphere(1, $fn = 12);
// Short thick bone horns curving up, small mandible tusks.
mirror_x() {
  chain([[4.2, -8.5, 20.5], [5.2, -9, 24], [6.2, -9.6, 26.5]], [1.8, 1.2, 0.3], bone);
  spike([3.4, -16, 7], [0.4, -1, -2.4], 0.8, 0.12, bone);
}

// Stubby bone-coloured legs under every segment.
for (s = [[-6, 0], [-2, 0], [4, 0], [10, 0], [16, 0]]) mirror_x() {
  limb([5.5, s[0], 3], [6.6, s[0] - 0.6, 0.9], 1.5, 1.1, bone);
}

// Cracked magma rock on the back: lumpy dark stones with glowing cracks between them.
module rocklump() {
  for (p = [[0, 4, 19], [-3.2, 3, 18], [3.2, 3.2, 18.5], [0, 1, 17.5], [-2, 6.5, 17.5], [2.6, 6.4, 18], [0, 4.6, 22.4],
            [-2.2, 2.6, 21.4], [2.4, 2.6, 21.2]])
    ell([3.2, 3.2, 2.8], p, rock);
}
translate([0, 4, 15]) scale(1.35) translate([0, -4, -15]) {
  color(lava) translate([0, 4, 19.4]) scale([5.6, 5.2, 4.6]) sphere(1, $fn = 24);
  rocklump();
}
// Crater rim on top.
color(lava) translate([0, 4.2, 27]) scale([1.6, 1.6, 0.6]) sphere(1, $fn = 14);

// Flame: a twisting tongue rising from the rock, with two floating embers.
module tongue(p, d, r, c) {
  color(c) hull() {
    translate(p) sphere(r);
    translate(p + d) sphere(0.15);
  }
}
translate([0, 0, 2.6]) {
// S-curved flame built from stacked tongues.
color(flameRed) hull() { translate([0, 4.2, 25]) sphere(2.6); translate([1.6, 4.2, 29]) sphere(1.9); }
color(flameRed) hull() { translate([1.6, 4.2, 29]) sphere(1.9); translate([-0.8, 4.2, 33]) sphere(1.2); }
color(flameRed) hull() { translate([-0.8, 4.2, 33]) sphere(1.2); translate([0.6, 4.2, 37.5]) sphere(0.2); }
color(flameOrange) hull() { translate([0, 3.3, 25.4]) sphere(1.9); translate([1.2, 3.1, 29]) sphere(1.2); }
color(flameOrange) hull() { translate([1.2, 3.1, 29]) sphere(1.2); translate([-0.4, 3.3, 32]) sphere(0.3); }
ell([1.2, 1, 1.6], [0.2, 2.4, 26], flameCore);
for (p = [[-5.5, 4, 29], [5.5, 4, 28.5], [2.5, 4, 38.5]]) tongue(p, [0, 0, 2.4], 0.9, flameOrange);
}
