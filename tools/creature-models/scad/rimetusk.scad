// Rimetusk: a towering woolly mammoth crowned with a heap of angular glacier ice. Shaggy brown fur under a thick
// snow mantle with frozen droplets, glowing ice-blue eyes, a long ridged trunk, huge ivory tusks curling up and out
// with frosted icy outer edges, snow cuffs round the feet, ears and an ice-tipped tail.
include <lib.scad>

fur = [0.47, 0.28, 0.15];
furDk = [0.35, 0.2, 0.1];
furLt = [0.66, 0.42, 0.22];
snow = [0.76, 0.88, 0.96];
ice = [0.6, 0.82, 0.97];
iceDk = [0.4, 0.62, 0.88];
nail = [0.8, 0.9, 0.96];

// Body: a big domed barrel, the shoulders highest.
module bodyShape(k = 1) hull() {
  translate([0, 3, 14]) scale([11.5, 12, 10] * k) sphere(1, $fn = 28);
  translate([0, -3, 18]) scale([10, 8, 10] * k) sphere(1, $fn = 24);
}
color(fur) bodyShape();

// Shaggy fur: rows of downward locks layered all over the body (alternating shades).
for (row = [0 : 3]) {
  z = 18 - row * 3.4;
  for (i = [0 : 21]) {
    a = i * 360 / 22 + row * 8;
    k = sqrt(max(0.15, 1 - pow((z - 15) / 10.5, 2)));
    p = [11.6 * k * sin(a), 0.5 - 11.6 * k * cos(a), z];
    color((i + row) % 3 == 0 ? furDk : ((i + row) % 3 == 1 ? fur : furLt))
      translate(p) rotate([0, 0, -a]) rotate([-12, 0, 0]) mirror([0, 0, 1]) linear_extrude(4.5, scale = 0.05) scale([1.8, 0.8]) circle(1, $fn = 6);
  }
}

// Cheap low-poly spike for the many fur locks and snow points.
module lock(p, d, r, c) color(c) translate(p) rotate(_dir_rot(d)) cylinder(h = norm(d), r1 = r, r2 = 0.05, $fn = 6);

// Legs: thick pillars, shaggy at the top, pale icy toenails.
for (p = [[6.5, -3], [-6.5, -3], [6.5, 10], [-6.5, 10]]) {
  limb([p[0], p[1], 9], [p[0], p[1], 2.4], 3.4, 3.2, fur, $fn = 18);
  for (a = [0 : 45 : 359]) lock([p[0] + 3.2 * sin(a), p[1] - 3.2 * cos(a), 7], [0.4 * sin(a), -0.4 * cos(a), -3], 1.2, furDk);
  color(snow) translate([p[0], p[1], 2.6]) scale([4, 4, 1.8]) sphere(1, $fn = 20);
  for (a = [0 : 40 : 359]) lock([p[0] + 3.6 * sin(a), p[1] - 3.6 * cos(a), 2.6], [0, 0, -1.8], 0.9, snow);
  for (t = [-1, 0, 1]) ell([0.9, 0.8, 0.9], [p[0] + t * 1.6, p[1] - 3.3, 0.9], nail);
}
// Tail with an ice tip, sticking out behind.
limb([0, 14.5, 15], [0, 18, 11.5], 1, 0.8, fur);
spike([0, 18, 11.5], [0, 2.5, -2.5], 1.1, 0.1, ice);

// Head: low and forward, under a heavy brow.
module headShape() hull() {
  translate([0, -8, 15.5]) scale([9, 7, 8.5]) sphere(1, $fn = 28);
  translate([0, -13, 12]) scale([5.5, 4, 5]) sphere(1, $fn = 20);
}
color(fur) headShape();
// Ears: shaggy flaps.
mirror_x() color(furDk) translate([9, -6.5, 14]) rotate([0, -10, 20]) scale([2.4, 1.4, 4.5]) sphere(1, $fn = 16);
// Fierce blue eyes under a frowning snowy brow.
mirror_x() {
  eye([3.8, -14.4, 15.4], 1.7, iris = [0.55, 0.85, 1], pupil = [0.9, 0.98, 1], sclera = [0.3, 0.6, 0.95], yaw = -20, shine = false);
  color(snow) translate([3.8, -14.6, 17.4]) rotate([0, -20, -20]) scale([2.8, 1.0, 0.8]) sphere(1, $fn = 14);
}
// Trunk: ridged, hanging down to the ground and curling forward.
chain([[0, -15.5, 12], [0, -16.5, 8], [0, -17, 4.5], [0, -18.5, 2], [0, -20, 2.4]], [2.8, 2.3, 1.9, 1.6, 1.3], fur);
for (z = [5 : 1.6 : 12]) color(furDk) translate([0, -16.4 - (12 - z) * 0.12, z]) scale([2.2, 1.4, 0.3]) sphere(1, $fn = 14);
// Huge curled tusks: ivory, sweeping down, forward and up into a curl, the outer side crusted in ice.
ivory = [0.95, 0.9, 0.76];
tuskPts = [[3.6, -14, 10.5], [6, -17, 6.5], [9.5, -18.5, 5], [12.8, -18.5, 7.5], [13.8, -18, 11.5], [12, -17.8, 14], [9.8, -18, 13.2]];
tuskR = [1.9, 1.9, 1.8, 1.6, 1.4, 1.1, 0.7];
curl = [10.5, -18, 10];
mirror_x() {
  chain(tuskPts, tuskR, ivory, $fn = 14);
  // Frost crust along the outer side of the curl.
  frost = [for (i = [1 : 6]) let(d = tuskPts[i] - curl, n = d / norm(d)) tuskPts[i] + n * tuskR[i] * 0.55];
  chain(frost, [for (i = [1 : 6]) tuskR[i] * 0.8], ice, $fn = 10);
}

// Snow: a shell over the brow, crown and the whole top of the back, its edge dripping into icicles.
module drips(n, r, cx, cy, z0, slope) {
  for (i = [0 : n - 1]) {
    a = i * 360 / n;
    len = (i % 3 == 0) ? 4 : ((i % 3 == 1) ? 2.5 : 1.6);
    translate([r * sin(a), cy - r * 1.2 * cos(a), z0 + slope * cos(a)]) rotate([180, 0, 0]) rotate([0, 0, a]) linear_extrude(len, scale = 0.05) scale([1.5, 6]) circle(1.3, $fn = 4);
  }
}
color(snow) intersection() {
  translate([0, 0, 0]) scale([1.05, 1.04, 1.06]) bodyShape();
  union() {
    translate([0, 0, 28.5]) cube([40, 40, 20], center = true);
    drips(22, 10, 0, 1, 18.55, 0);
  }
}
color(snow) intersection() {
  translate([0, -8, 15.5]) scale(1.07) translate([0, 8, -15.5]) headShape();
  union() {
    translate([0, -8, 19]) rotate([-15, 0, 0]) translate([0, 0, 10]) cube([30, 30, 20], center = true);
    drips(14, 9.5, 0, -8, 19.05, 2.0);
  }
}
// Snow drifts on the flanks.
color(snow) intersection() {
  scale([1.05, 1.03, 1.03]) bodyShape();
  mirror_x() {
    translate([11, 4, 13]) scale([3, 4, 1.8]) sphere(1, $fn = 12);
    translate([11, 9, 15]) scale([3, 2, 1.4]) sphere(1, $fn = 10);
    translate([10, -3, 11]) scale([3, 2.6, 1.4]) sphere(1, $fn = 10);
  }
}
// Heap of angular glacier ice on the crown and shoulders.
crystals = [[0, -7, 27, 5, 10, 20], [4, -2.5, 29, 5.5, -15, 35], [-4, -1.5, 28.5, 5, 20, -25], [0, 2, 33, 5.5, 35, 10],
            [3, 6, 29, 4.6, -20, 50], [-3, 6.5, 28.5, 4.4, 15, -40], [0, 10.5, 25.5, 4, 40, 15], [6, 1.5, 26, 3.6, 10, 70],
            [-6.2, 2, 26, 3.6, -30, 20], [0, -1.5, 37, 3.6, 45, 45], [1.5, -10.5, 23.5, 3, 25, 30]];
for (c = crystals) {
  color(c[3] > 4 ? snow : ice) translate([c[0], c[1], c[2]]) rotate([c[4], c[5], c[4] + c[5]]) cube(c[3], center = true);
  color(iceDk) translate([c[0], c[1], c[2]]) rotate([c[4], c[5], c[4] + c[5]]) translate([c[3] * 0.18, c[3] * 0.18, 0]) cube(c[3] * 0.72, center = true);
}
