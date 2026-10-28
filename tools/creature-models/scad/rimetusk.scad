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
ivory = [0.95, 0.9, 0.76];

// Cheap low-poly spike for the many fur locks and snow points.
module lock(p, d, r, c) color(c) translate(p) rotate(_dir_rot(d)) cylinder(h = norm(d), r1 = r, r2 = 0.05, $fn = 6);

// Body: a mammoth's profile, not a dome: a high shoulder hump sloping down to a lower rump, a deep shaggy belly.
module bodyShape(k = 1) hull() {
  translate([0, -1, 18.5]) scale([10.5, 8.5, 10] * k) sphere(1, $fn = 24);
  translate([0, 10, 14]) scale([9.5, 7.5, 8] * k) sphere(1, $fn = 24);
  translate([0, 4, 11]) scale([10.4, 11, 5.5] * k) sphere(1, $fn = 24);
}
color(fur) bodyShape();
// Shaggy skirt: long locks hanging round the belly line, alternating shades.
for (i = [0 : 27]) let(a = i * 360 / 28, p = [10.6 * sin(a), 4 - 11.4 * cos(a), 10.5])
  lock(p, [0.4 * sin(a), -0.4 * cos(a), -5.4 - (i % 3) * 0.9], 2.2, [furDk, fur, furLt][i % 3]);
// Fur locks down the flanks below the snow line.
for (row = [0 : 1]) for (i = [0 : 17]) let(a = i * 20 + row * 10, z = 17 - row * 3.4, k = 1 - row * 0.04,
                                          p = [10.4 * k * sin(a), 3 - 10.4 * k * cos(a), z])
  if (cos(a) < 0.6) lock(p, [0.3 * sin(a), -0.3 * cos(a), -3.6], 1.6, [furLt, fur, furDk][(i + row) % 3]);

// Legs: thick pillars, shaggy at the top, snow cuffs and pale icy toenails.
for (p = [[6.4, -2.5], [-6.4, -2.5], [6.4, 11], [-6.4, 11]]) {
  limb([p[0], p[1], 10], [p[0], p[1], 2.4], 3.7, 3.5, fur, $fn = 18);
  color(snow) translate([p[0], p[1], 2.6]) scale([4.3, 4.3, 1.9]) sphere(1, $fn = 18);
  for (a = [0 : 40 : 359]) lock([p[0] + 3.9 * sin(a), p[1] - 3.9 * cos(a), 3.4], [0, 0, -2.2], 1, snow);
  for (t = [-1, 0, 1]) ell([0.95, 0.8, 0.9], [p[0] + t * 1.7, p[1] - 3.6, 0.9], nail);
}
// Tail with an ice tip, hanging behind.
limb([0, 17, 15], [0, 19, 10.5], 1.1, 0.8, fur);
spike([0, 19, 10.5], [0, 1.4, -3], 1.2, 0.1, ice);

// Head: big and high at the front, a tall domed crown over a long face that narrows into the trunk.
module headShape() hull() {
  translate([0, -8.5, 24]) scale([7.2, 6.5, 7.5]) sphere(1, $fn = 24);
  translate([0, -13.5, 17.5]) scale([6.2, 4.6, 6]) sphere(1, $fn = 24);
  translate([0, -16.8, 13]) scale([3.6, 2.8, 3.2]) sphere(1, $fn = 18);
}
color(fur) headShape();
// Ears: shaggy flaps on the sides of the head.
mirror_x() color(furDk) translate([8, -7, 19]) rotate([0, -12, 30]) scale([1.6, 4, 5.6]) sphere(1, $fn = 16);
mirror_x() for (z = [14.5, 17, 19.5]) lock([9, -7.2, z], [0.6, 0.4, -3.6], 1, fur);
// Shaggy fringe over the brow, hanging in points between the eyes.
for (i = [0 : 8]) let(x = -6 + i * 1.5, y = -14.4 + abs(x) * 0.42)
  lock([x, y + 0.6, 22.6], [x * 0.05, -0.8, -3 - (i % 2) * 1.2], 1.4, [furDk, fur, furLt][i % 3]);
// Fierce glowing eyes, sunk into the face under a heavy shaggy brow that slants down to the trunk.
mirror_x() {
  eye([3.8, -15.5, 19.6], 2.1, iris = [0.6, 0.9, 1, GLOW], pupil = [0.92, 0.99, 1, GLOW], sclera = [0.25, 0.55, 0.95, GLOW],
      yaw = 8, shine = false, lid = 0.48, lid_tilt = 32, lid_c = furDk, slit = 0.4);
  color(furDk) hull() {
    translate([5.8, -14.4, 22.4]) scale([1.6, 1.6, 1]) sphere(1, $fn = 12);
    translate([1.4, -17, 21]) scale([1, 1.1, 0.7]) sphere(1, $fn = 10);
  }
}
// Trunk: thick at the face, ridged, hanging to the ground and curling forward at the tip.
trunk = [[0, -16.6, 14], [0, -18.6, 9.5], [0, -19.4, 5.5], [0, -19.6, 2.6], [0, -21.4, 1.6], [0, -22.6, 2.8]];
trunkR = [3.2, 2.7, 2.2, 1.8, 1.5, 1.2];
chain(trunk, trunkR, fur);
for (i = [1 : 3]) for (f = [0.25, 0.75]) let(p = trunk[i] + (trunk[i + 1] - trunk[i]) * f, r = trunkR[i] + (trunkR[i + 1] - trunkR[i]) * f)
  color(furDk) translate(p) scale([r * 1.05, r * 1.05, 0.35]) sphere(1, $fn = 14);
for (f = [0.3, 0.7]) let(p = trunk[0] + (trunk[1] - trunk[0]) * f) color(furDk) translate(p) rotate([-25, 0, 0]) scale([3, 3, 0.35]) sphere(1, $fn = 14);

// Huge curled tusks: ivory, sweeping down, out and up into a C on each side of the trunk, ice crusting the outer edge.
tuskPts = [[3.6, -16.4, 12], [6.4, -19.6, 7.6], [10.4, -21, 6.8], [14, -20.4, 9.8], [15, -19.6, 14.4], [13.4, -19.4, 18],
           [10.6, -19.8, 18.2]];
tuskR = [2.5, 2.5, 2.4, 2.2, 1.9, 1.5, 0.8];
curl = [10.6, -20, 12.4];
// Chaikin subdivision: smooths a polyline (and its radii) so the curl reads as a curve, not a chain of segments.
function chaikin(v) = concat([v[0]], [for (i = [0 : len(v) - 2], f = [0.25, 0.75]) v[i] * (1 - f) + v[i + 1] * f], [v[len(v) - 1]]);
tP = chaikin(chaikin(tuskPts));
tR = chaikin(chaikin(tuskR));
mirror_x() {
  chain(tP, tR, ivory, $fn = 14);
  frost = [for (i = [4 : len(tP) - 1]) let(d = tP[i] - curl, n = d / norm(d)) tP[i] + n * tR[i] * 0.6];
  chain(frost, [for (i = [4 : len(tP) - 1]) tR[i] * 0.8], ice, $fn = 10);
  for (i = [6 : 4 : 14]) ell([0.7, 0.7, 0.7], frost[i] + [0, -0.8, 0.6], snow);
}

// Snow: a mantle over the shoulders and back and a cap on the crown, the edges dripping into icicles.
module drips(n, rx, ry, cy, z0, slope) {
  for (i = [0 : n - 1]) {
    a = i * 360 / n;
    len = (i % 3 == 0) ? 3.6 : ((i % 3 == 1) ? 2.2 : 1.4);
    translate([rx * sin(a), cy - ry * cos(a), z0 + slope * cos(a)]) rotate([180, 0, 0]) rotate([0, 0, a])
      linear_extrude(len, scale = 0.05) scale([1.5, 6]) circle(1.3, $fn = 4);
  }
}
color(snow) intersection() {
  scale([1.05, 1.04, 1.05]) translate([0, 0, -0.5]) bodyShape();
  union() {
    translate([0, 4, 19.5]) rotate([-12, 0, 0]) translate([0, 0, 15]) cube([40, 44, 30], center = true);
    drips(24, 11, 12, 4, 19.6, -2.2);
  }
}
color(snow) intersection() {
  translate([0, -10, 21]) scale(1.06) translate([0, 10, -21]) headShape();
  union() {
    translate([0, -8, 25.5]) rotate([-30, 0, 0]) translate([0, 0, 10]) cube([30, 30, 20], center = true);
    drips(16, 7.6, 7, -8.5, 25.4, 2.4);
  }
}
// Angular ice shards breaking through the snow mantle down the back and haunches, like the sprite's.
for (c = [[6, 9, 21.6, 1.8, 20, 30], [-6.4, 11, 20.8, 1.6, -25, 15], [3, 15, 19.4, 1.5, 40, -20], [-3.4, 17, 17.8, 1.4, 10, 45],
          [8.6, 2, 21.4, 1.5, 35, 60], [-8.4, 4, 21.2, 1.6, -10, -30], [0, 19, 15.4, 1.3, 30, 30]])
  color(ice) translate([c[0], c[1], c[2]]) rotate([c[4], c[5], c[4] - c[5]]) cube(c[3] * 1.3, center = true);
// Frozen droplets on the fur.
for (p = [[8.4, 2, 15.5], [-9, 6, 14.5], [7.4, 12, 13], [-6.6, -4, 15], [9.6, -1, 12], [-8.4, 14, 12.6], [4.6, -15.2, 15.2],
          [4, 17.4, 12.4], [-4.6, 17, 13.4], [9, 9, 10.4], [-9.6, 9.6, 10.8], [0, 18.6, 12]])
  color(ice) translate(p) scale([0.9, 0.9, 1.3]) sphere(1, $fn = 8);

// Heap of angular glacier ice on the crown, spilling back over the shoulders.
crystals = [[0, -8.5, 31, 5, 10, 20], [3.6, -4.5, 30.5, 5.2, -15, 35], [-3.4, -4, 30.8, 4.8, 20, -25],
            [0, -1, 33.5, 5.6, 35, 10], [0, -6, 36, 4, 45, 45], [2.8, 3, 29.5, 4.4, -20, 50], [-2.8, 3.5, 29.2, 4.2, 15, -40],
            [0, 8, 26, 4.2, 40, 15], [5.6, -1, 27.5, 3.4, 10, 70], [-5.8, -0.5, 27.5, 3.4, -30, 20], [0, 13, 23, 3.4, 25, 30]];
for (c = crystals) {
  color(c[3] > 4.5 ? snow : ice) translate([c[0], c[1], c[2] - 1.2]) rotate([c[4], c[5], c[4] + c[5]]) cube(c[3] * 1.2, center = true);
  color(iceDk) translate([c[0], c[1], c[2] - 1.2]) rotate([c[4], c[5], c[4] + c[5]]) translate([c[3] * 0.18, c[3] * 0.18, 0])
    cube(c[3] * 0.86, center = true);
}
// Brown fur showing through the snow on the back, like the sprite's patches.
color(fur) intersection() {
  scale([1.065, 1.05, 1.06]) translate([0, 0, -0.5]) bodyShape();
  for (p = [[4, 12, 22], [-3, 15, 20], [7.6, 6, 22], [-7.4, 9, 20.5], [2, 18, 17], [-9.4, 2, 21]])
    translate(p) scale([1.8, 1.6, 2.2]) sphere(1, $fn = 8);
}
