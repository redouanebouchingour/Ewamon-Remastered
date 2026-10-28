// Pebblit: a round mauve boulder studded with pale cobbles, a pale smiling face set into the front,
// two quartz crystal clusters on top, stubby rocky arms and crystal feet.
include <lib.scad>

rock = [0.36, 0.24, 0.37];
rockDark = [0.32, 0.22, 0.33];
cobble = [0.72, 0.6, 0.68];
cobbleLight = [0.86, 0.76, 0.8];
face = [1, 0.98, 1];
faceShade = [0.85, 0.78, 0.86];
quartz = [0.93, 0.85, 0.88];
quartzShade = [0.8, 0.68, 0.76];
line = [0.25, 0.16, 0.25];

module crystal(p, d, r, c) {
  l = norm(d);
  color(c) translate(p) rotate(_dir_rot(d)) {
    cylinder(h = l * 0.72, r = r, $fn = 6);
    translate([0, 0, l * 0.72]) cylinder(h = l * 0.28, r1 = r, r2 = 0.05, $fn = 6);
  }
}

// Body: one round boulder.
ell([13, 12, 12.5], [0, 0, 17], rock);

// Cobbles over the boulder (skipping the face disc): [azimuth, elevation, size].
for (az = [0 : 30 : 359], el = [-40, -12, 18, 46]) {
  a = az + (el % 20 == 0 ? 15 : 0);
  // a is the angle from +X; the face looks along -Y (a = 270).
  inFace = abs(a - 270) < 50 && el > -30 && el < 40;
  if (!inFace) {
    p = [13 * cos(el) * cos(a), 12 * cos(el) * sin(a), 17 + 12.5 * sin(el)];
    color((az / 30 + el) % 3 == 0 ? cobbleLight : cobble) translate(p) rotate([0, 90 - el, a]) scale([1, 1, 0.45]) sphere(3.2, $fn = 12);
  }
}
ell([3, 3, 1.4], [0, 0, 29.2], cobble);

// Face disc set into the front.
ell([8, 2.6, 7.4], [0, -10.2, 18.6], faceShade);
ell([7.1, 2.4, 6.7], [0, -10.8, 18.8], face);
// Eyes and a wide smile.
mirror_x() eye([2.9, -13.3, 20.6], 1.8, iris = [0.45, 0.4, 0.45], pupil = [0.15, 0.1, 0.15], sclera = [1, 0.97, 1]);
mirror_x() color(line) translate([2.9, -12.7, 23.4]) rotate([0, 12, 0]) scale([1.6, 0.4, 0.3]) sphere(1, $fn = 10);
color(line) translate([0, -13.4, 17.6]) rotate([90, 0, 0]) difference() {
  scale([3.6, 2.4, 1]) cylinder(h = 0.6, r = 1, $fn = 24, center = true);
  translate([0, 0.7, 0]) scale([3.6, 2.4, 1]) cylinder(h = 1, r = 1, $fn = 24, center = true);
}
// A small crystal chip on the forehead.
crystal([0, -11.6, 24.4], [0, -0.6, 1.4], 0.6, quartzShade);

// Two crystal clusters on top.
mirror_x() {
  crystal([5.5, -1, 27.5], [0.5, -0.3, 6.5], 1.4, quartz);
  crystal([7.5, 0, 26.5], [2, 0.2, 4.6], 1.1, quartzShade);
  crystal([4.2, 1, 28], [-0.8, 1, 4.4], 1, quartzShade);
}

// Stubby rocky arms, fists of cobbles.
mirror_x() {
  limb([11, -1, 16], [15.5, -3, 14], 2.6, 2.4, rock);
  ell([3.4, 3.2, 3.2], [16.5, -3.5, 13.5], cobble);
  ell([1.8, 1.6, 1.8], [17.5, -5.5, 14.5], cobbleLight);
}

// Short legs ending in crystal feet.
mirror_x() {
  limb([5.5, -1, 7], [6.5, -2, 3], 3, 2.6, rock);
  crystal([6.5, -2, 0], [0, 0, 3.6], 2.4, quartzShade);
  crystal([5.2, -4.4, 0], [-0.6, -1, 2.6], 1.2, quartz);
  crystal([7.6, -4.6, 0], [0.6, -1, 2.4], 1.1, quartz);
  crystal([8.6, -1, 0], [1, 0, 2.6], 1.1, quartz);
}
