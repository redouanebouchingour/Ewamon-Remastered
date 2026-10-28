// Galeforth: Gustling grown into a proud raptor. A fierce tan head with a cream face and one long cream crest blade
// sweeping back over it, a red scarf knotted at the neck with its ends streaming out, a cream chest, broad wings held
// half-open with brown bands and cream tips, orange taloned feet, and two tail streamers ending in red tufts.
include <lib.scad>

tan = [0.8, 0.62, 0.36];
tanDark = [0.62, 0.45, 0.26];
band = [0.42, 0.27, 0.15];
cream = [0.97, 0.9, 0.7];
red = [0.82, 0.24, 0.14];
redDark = [0.62, 0.15, 0.1];
beak = [0.95, 0.5, 0.15, NOGLOW];
foot = [0.98, 0.55, 0.15, NOGLOW];
talon = [0.25, 0.2, 0.18];
iris = [1, 0.5, 0.05];
socket = [0.3, 0.18, 0.1];

// Hard brow ridge over an eye at p (radius s, turned yaw like the eye): a hulled wedge in the skin colour, high at the
// temple and slanting down towards the nose, overhanging the eye so the face itself scowls.
module brow(p, s, yaw, drop, c) {
  translate(p) rotate([0, 0, yaw]) color(c) hull() {
    translate([s * 1.0, s * 0.05, s * 1.25]) scale([s * 0.6, s * 0.7, s * 0.36]) sphere(1, $fn = 12);
    translate([-s * 0.95, -s * 0.25, s * (1.25 - drop)]) scale([s * 0.5, s * 0.62, s * 0.32]) sphere(1, $fn = 12);
    translate([0, s * 0.9, s * 1.1]) scale([s * 1.1, s * 0.6, s * 0.5]) sphere(1, $fn = 12);
  }
}
// Flat scales / plates laid on an ellipsoid (centre cen, radii r): each [azimuth, elevation, size].
module plates(cen, r, list, th = 0.35, c) {
  for (t = list) let(az = t[0], el = t[1], sz = t[2])
    color(c) translate([cen[0] + r[0] * cos(el) * cos(az), cen[1] + r[1] * cos(el) * sin(az), cen[2] + r[2] * sin(el)])
      rotate([0, 0, az]) rotate([0, 90 - el, 0]) scale([sz, sz * 1.15, th]) sphere(1, $fn = 8);
}

// Body: a deep chest over short thighs, cream front.
module bodyShape(k = 1) {
  hull() {
    translate([0, 0, 21]) scale([8.5, 7.5, 9] * k) sphere(1, $fn = 32);
    translate([0, 0.5, 12]) scale([6.5, 6, 5] * k) sphere(1, $fn = 28);
  }
}
color(tan) bodyShape();
color(cream) intersection() { bodyShape(1.015); translate([0, -7, 18]) scale([5.5, 4, 10]) sphere(1, $fn = 20); }
for (z = [13, 16, 19]) for (x = [-2, 2]) color(tanDark) translate([x + (z % 2), -7.2, z]) rotate([0, 40, 0]) scale([0.9, 0.3, 0.25]) sphere(1, $fn = 8);

// Overlapping feather scallops down the back so it doesn't read as a plain egg from behind.
for (r = [0 : 3]) for (k = [-2 : 2]) let(z = 26 - r * 3.6, a = 90 + k * 22 + (r % 2) * 11)
  if (abs(a - 90) < 50) color(r % 2 == 0 ? tanDark : tan) translate([cos(a) * 7.2, sin(a) * 6.4 + 0.3, z]) rotate([0, 0, a - 90]) rotate([-75, 0, 0]) scale([1.7, 2.2, 0.45]) sphere(1, $fn = 10);

// Legs: feathered thighs, orange shanks, talons.
mirror_x() {
  ell([3, 3.2, 3.6], [4, 0, 9], tan);
  limb([4.2, -0.5, 6], [4.5, -1, 1.2], 1, 0.9, foot);
  for (a = [-32, 0, 32]) {
    limb([4.5, -1, 1], [4.5 + sin(a) * 3.2, -1 - cos(a) * 3.2, 0.8], 0.75, 0.55, foot);
    spike([4.5 + sin(a) * 3.4, -1 - cos(a) * 3.4, 0.8], [sin(a) * 0.4, -cos(a) * 0.8, -0.7], 0.45, 0.05, talon);
  }
  limb([4.5, -1, 1], [4.5, 2, 0.8], 0.7, 0.5, foot);
}

// Wings: broad, half-open, hanging from the shoulders, a brown band and cream feather tips.
module wingShape(k = 1) {
  hull() {
    translate([8.5, 1, 25]) scale([2.4, 5, 3.2] * k) sphere(1, $fn = 20);
    translate([12.5, 2, 11]) scale([1.7, 6.8, 5.5] * k) sphere(1, $fn = 20);
  }
}
mirror_x() {
  color(tan) wingShape();
  color(band) intersection() { wingShape(1.03); translate([12, 1.5, 10.5]) cube([10, 16, 2.6], center = true); }
  // Primary feathers fanning down from the wing's lower edge, cream tipped.
  for (i = [0 : 4]) {
    y = -2.5 + i * 2;
    color(tan) hull() { translate([12.6, y, 9]) sphere(1.1, $fn = 10); translate([13.2 + i * 0.2, y + 0.5, 5.5 - (i % 2)]) sphere(0.9, $fn = 10); }
    color(cream) hull() { translate([13.2 + i * 0.2, y + 0.5, 5.5 - (i % 2)]) sphere(0.9, $fn = 10); translate([13.4 + i * 0.25, y + 0.8, 2.8 - (i % 2)]) sphere(0.3, $fn = 8); }
  }
  color(tanDark) translate([10, -1.5, 20]) rotate([0, 15, 0]) scale([1.2, 2.6, 4]) sphere(1, $fn = 14);
  // Covert feather rows on the outside of the wing.
  for (r = [0 : 2]) for (k = [0 : 2]) color(r % 2 == 0 ? tanDark : cream)
    translate([11.2 + r * 0.6, -2.4 + k * 2.4 + (r % 2) * 1.2, 21 - r * 3.4]) rotate([0, 10, 0]) scale([0.6, 1.3, 1.9]) sphere(1, $fn = 10);
}

module headShape(k = 1) {
  hull() {
    translate([0, -0.5, 33.5]) scale([5.5, 5.5, 5.2] * k) sphere(1, $fn = 28);
    translate([0, -3, 32]) scale([3.8, 3.5, 3.4] * k) sphere(1, $fn = 20);
  }
}
translate([0, -1, 29]) scale(1.2) translate([0, 0, -29]) {
// Head: a narrow raptor head, cream face, hooked beak, fierce orange eyes under brows.
color(tan) headShape();
color(cream) intersection() { headShape(1.02); translate([0, -6, 32.5]) scale([5, 4, 3.6]) sphere(1, $fn = 20); }
// A cream swirl on the forehead.
color(cream) translate([0, -4.8, 36]) rotate([70, 0, 0]) rotate_extrude(angle = 300, $fn = 16) translate([1, 0]) circle(0.3, $fn = 6);
mirror_x() {
  color(socket) translate([2.15, -5.3, 33.4]) rotate([0, 0, 14]) scale([1.45, 0.6, 1.25]) sphere(1.2, $fn = 14);
  eye([2.1, -5.25, 33.4], 1.5, iris = iris, pupil = [0.1, 0.03, 0.0], sclera = [1, 0.95, 0.8], yaw = 14, flat = 0.45,
      lid = 0.45, lid_tilt = 30, lid_c = socket);
  brow([2.1, -5.25, 33.4], 1.5, 14, 0.8, tan);
}
color(beak) hull() {
  translate([0, -6.2, 31.8]) scale([1.4, 1, 1.1]) sphere(1, $fn = 12);
  translate([0, -8.6, 31.4]) sphere(0.4, $fn = 8);
  translate([0, -8.6, 30]) sphere(0.15, $fn = 6);
}
// Back-of-head feather tufts.
for (t = [[-2, 32], [0, 34.5], [2, 32]]) spike([t[0], 3.8, t[1]], [t[0] * 0.5, 3, 1.5], 1.4, 0.1, tan);
// The crest blade: from the brow, up and back in one long curve.
chain([[0, -2.5, 37.5], [0.5, -1, 41.5], [2.5, 0.5, 44.5], [6, 2, 46], [10, 3.5, 45], [13, 4.5, 42.5], [14, 5, 39.5]],
      [1.6, 1.8, 1.8, 1.6, 1.3, 0.9, 0.3], cream);

}

// Red scarf around the neck, knotted on the right shoulder, ends streaming out to the viewer's right.
color(red) translate([0, -0.5, 28]) scale([6.5, 6.2, 2.3]) sphere(1, $fn = 28);
color(red) hull() {
  translate([-3.5, -5, 27.8]) sphere(0.8, $fn = 10);
  translate([3.5, -5, 27.8]) sphere(0.8, $fn = 10);
  translate([0, -6.2, 23]) sphere(0.6, $fn = 8);
}
ell([1.8, 1.6, 1.6], [5.5, -2, 28], redDark);
module scarfEnd(pts, ws) {
  for (i = [0 : len(pts) - 2]) color(red) hull() {
    translate(pts[i]) scale([0.5, 0.35, ws[i]]) sphere(1, $fn = 10);
    translate(pts[i + 1]) scale([0.5, 0.35, ws[i + 1]]) sphere(1, $fn = 10);
  }
}
scarfEnd([[6, -2, 28], [10, -1, 29], [14, 0, 29.5], [17, 0.5, 30.5]], [1.6, 1.8, 1.5, 0.6]);
scarfEnd([[6, -2, 27.5], [9.5, -0.5, 26], [13, 0.5, 26], [16, 1, 25]], [1.4, 1.6, 1.3, 0.5]);

// Two tail streamers, each ending in a red tuft.
chain([[2, 6, 11], [8, 9, 12], [14, 9, 14], [18, 8, 13]], [1, 0.9, 0.8, 0.8], cream);
petal([1.6, 1.3, 2.8], [18.4, 8, 15], [0, -20, 0], red);
chain([[1, 6, 10], [6, 9, 7], [11, 9, 5], [14, 8, 3]], [1, 0.9, 0.8, 0.8], cream);
petal([1.6, 1.3, 2.8], [14.4, 8, 1.6], [0, 15, 0], red);
