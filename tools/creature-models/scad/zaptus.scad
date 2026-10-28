// Zaptus: a purple egg-shaped bulb with cream patches, big cyan eyes, stubby flipper arms and a dark wick on its
// crown that spits a pale blue spark.
include <lib.scad>

body = [0.4, 0.27, 0.62];
bodyHi = [0.52, 0.4, 0.75];
dark = [0.24, 0.15, 0.4];
cream = [0.93, 0.86, 0.62];
cyan = [0.35, 0.9, 0.85];
spark = [0.72, 0.82, 1];
sparkCore = [0.92, 0.96, 1];

// Egg body.
color(body) translate([0, 0, 15]) scale([11, 10, 13]) sphere(1, $fn = 40);
// Sheen on the upper back.
color(bodyHi) translate([-3, 6, 22]) scale([4, 2.5, 3.5]) sphere(1, $fn = 18);

// Surface decal: a flattened ellipsoid sitting on the egg surface at (azimuth, elevation), azimuth 0 = front.
module decal(az, el, r, c, rot = 0) {
  q = [cos(el) * sin(az), -cos(el) * cos(az), sin(el)];
  p = [11 * q[0], 10 * q[1], 15 + 13 * q[2]];
  n = [q[0] / 11, q[1] / 10, q[2] / 13];
  color(c) intersection() {
    translate([0, 0, 15]) scale([11.15, 10.15, 13.15]) sphere(1, $fn = 40);
    translate(p) rotate(_dir_rot(n)) rotate([0, 0, rot]) scale([r[0], r[1], 3]) sphere(1, $fn = 18);
  }
}
// Cream belly crescent (front) and spots.
decal(0, -50, [8, 3.6], cream);
mirror_x() decal(40, -12, [2.6, 1.4], cream, 30);
decal(-8, 48, [1.4, 2.6], cream, 10);
decal(25, 50, [1.2, 2], cream, 30);
// Back: a big cream flame mark and a spot.
decal(180, -20, [3.4, 7], cream);
decal(140, -25, [1.6, 2.6], cream, 30);
decal(210, 10, [1.6, 2.4], cream, -20);

// Big round cyan eyes with dark rims.
mirror_x() {
  q = [cos(12) * sin(24), -cos(12) * cos(24), sin(12)];
  translate([11 * q[0], 10 * q[1], 15 + 13 * q[2]]) rotate([0, 0, 24]) scale(1.15) {
    color(dark) scale([2.9, 0.8, 3.1]) sphere(1, $fn = 20);
    color(cyan) translate([0, -0.4, 0]) scale([2.3, 0.8, 2.5]) sphere(1, $fn = 20);
    color([0.6, 1, 0.95]) translate([0, -0.75, 0]) scale([1.2, 0.6, 1.3]) sphere(1, $fn = 14);
    color("white") translate([0.7, -1, 0.9]) sphere(0.5, $fn = 10);
  }
}
// Tiny mouth.
color(dark) translate([0, -10, 12.2]) sphere(0.45, $fn = 10);

// Flipper arms and stubby feet.
mirror_x() {
  petal([4, 2.2, 1.8], [11, -1, 12], [0, -25, -10], body);
  ell([2.6, 2.8, 2.2], [5, -2.5, 1.8], dark);
}

// Wick: a dark curling tuft on the crown.
blob([[[3.6, 3.4, 2], [0, 0.5, 27.5]], [[2.2, 2, 1.6], [0.6, 0.5, 30]]], dark);
chain([[0.6, 0.5, 30], [1.6, 0.3, 32.5], [3.5, -0.5, 33.5]], [2, 1.5, 0.7], dark);
ell([1.6, 1.4, 2.2], [-1.8, 0.8, 30], dark);
ell([1.4, 1.4, 1.8], [2.2, 1.2, 29.6], dark);

// Lightning: a zigzag of pale blue capsules leaping from the wick tip.
chain([[3.5, -0.5, 33.5], [5.5, -0.5, 36], [4.2, -0.5, 37.5], [6.5, -0.5, 40], [5.8, -0.5, 41.5], [8, -0.5, 43]],
      [0.9, 0.7, 0.7, 0.55, 0.5, 0.25], spark);
ell([1.4, 1.2, 1.4], [3.6, -0.5, 33.8], sparkCore);
chain([[-1, 0, 35], [-2.5, 0, 37], [-1.5, 0, 38], [-3, 0, 39.5]], [0.45, 0.4, 0.35, 0.2], spark);
