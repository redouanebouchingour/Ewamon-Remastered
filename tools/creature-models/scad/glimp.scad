// Glimp: a pearly soap-bubble sprite. A big round iridescent body (pink at the face, sky blue below), a ring of small
// bubbles on its crown with a little candle-flame wick, stubby bubble arms and feet, and a cheerful face.
include <lib.scad>

pearl = [0.9, 0.94, 1];
pink = [1, 0.86, 0.95];
blue = [0.72, 0.85, 1];
lilac = [0.84, 0.8, 1];
shine = [1, 1, 1];
wick = [0.6, 0.72, 0.95];
flame = [0.98, 0.86, 0.5];
flameTip = [0.9, 0.9, 0.7];
eyeC = [0.25, 0.2, 0.5];

// Body: a big sphere with a pinkish face side and a blue underside.
// Iridescent tints are thin shells of the body clipped to a region, so they sit flush.
module tint(c, d = 0.08) {
  color(c) intersection() {
    translate([0, 0, 14.5]) scale([11 + d, 10.5 + d, 10.5 + d]) sphere(1, $fn = 40);
    children();
  }
}
ell([11, 10.5, 10.5], [0, 0, 14.5], pearl);
tint(pink) translate([-1, -16, 16]) scale([11, 10, 10]) sphere(1, $fn = 24);
tint(blue) translate([0, 0, -1]) scale([16, 16, 13]) sphere(1, $fn = 24);
tint(lilac, 0.12) translate([-12, 4, 15]) scale([6, 8, 7]) sphere(1, $fn = 20);
tint(lilac, 0.12) translate([10, 8, 18]) scale([6, 7, 6]) sphere(1, $fn = 20);
// Glossy highlights.
tint(shine, 0.2) translate([-4.6, -9, 21]) scale([2.4, 2, 1.4]) sphere(1, $fn = 14);
tint(shine, 0.2) translate([-1.4, -9.8, 22.8]) scale([0.9, 1, 0.7]) sphere(1, $fn = 10);
tint(shine, 0.2) translate([4, 9, 20]) scale([2, 2, 1.4]) sphere(1, $fn = 14);

// Face: big dark violet eyes and a little smile.
mirror_x() eye([3.8, -9.75, 16.4], 1.6, iris = eyeC, pupil = [0.12, 0.1, 0.3], sclera = eyeC, yaw = -20, flat = 0.5);
color(eyeC) translate([0, -10.45, 13]) rotate([90, 0, 0]) difference() {
  cylinder(h = 0.5, r = 1.6, center = true, $fn = 20);
  cylinder(h = 1, r = 1.15, center = true, $fn = 20);
  translate([0, 1.5, 0]) cube([4, 3, 2], center = true);
}

// Crown of little bubbles around the top.
for (a = [0 : 45 : 315]) ell([2, 2, 1.8], [cos(a) * 3.6, sin(a) * 3.2, 24.6], a % 90 == 0 ? blue : pearl);
// Wick and its soft flame.
limb([0, 0, 24.5], [0.6, 0, 29], 0.45, 0.4, wick);
color(flame) hull() {
  translate([0.8, 0, 30.4]) scale([1.3, 1.1, 1.4]) sphere(1, $fn = 16);
  translate([2.2, 0, 33.4]) sphere(0.3, $fn = 8);
}
ell([0.6, 0.5, 0.8], [0.8, -0.7, 30.2], flameTip);

// Stubby bubble arms.
mirror_x() {
  ell([2.4, 2.2, 2.4], [11.2, -0.5, 12.5], pearl);
  ell([0.7, 0.4, 0.6], [11.4, -2.6, 13.5], shine);
}
// Bubble feet.
mirror_x() {
  limb([4.4, 0, 6], [4.6, -0.4, 2.6], 2, 2, pearl);
  ell([2.8, 3.2, 2.2], [4.6, -1, 2.2], blue);
  ell([0.7, 0.5, 0.5], [3.8, -3.6, 3], shine);
}
// A stray bubble.
ell([0.8, 0.8, 0.8], [9, -5, 1.2], pearl);
