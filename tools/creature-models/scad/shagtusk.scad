// Shagtusk: a heavy woolly mammoth in layered shaggy brown fur. Snow lies over its brow and down its back, with a
// ridge of ice spikes along the spine and drifts on its flanks; a low head with fierce blue eyes, a ridged trunk,
// two crystal-ice tusks pointing forward, pale icy toenails and an ice-tipped tail.
include <lib.scad>

fur = [0.55, 0.33, 0.17];
furDk = [0.4, 0.23, 0.11];
furLt = [0.66, 0.42, 0.22];
snow = [0.76, 0.88, 0.96];
ice = [0.6, 0.82, 0.97];
iceDk = [0.4, 0.62, 0.88];
nail = [0.8, 0.9, 0.96];

// Body: a big domed barrel, the shoulders highest.
module bodyShape(k = 1) hull() {
  translate([0, 3, 14]) scale([11, 12, 9] * k) sphere(1, $fn = 32);
  translate([0, -4, 16]) scale([10, 7, 9] * k) sphere(1, $fn = 28);
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

// Legs: thick pillars, shaggy at the top, pale icy toenails.
for (p = [[6.5, -3], [-6.5, -3], [6.5, 10], [-6.5, 10]]) {
  limb([p[0], p[1], 9], [p[0], p[1], 2.4], 3.4, 3.2, fur);
  for (a = [0 : 45 : 359]) spike([p[0] + 3.2 * sin(a), p[1] - 3.2 * cos(a), 7], [0.4 * sin(a), -0.4 * cos(a), -3], 1.2, 0.1, furDk);
  for (t = [-1, 0, 1]) ell([0.9, 0.8, 0.9], [p[0] + t * 1.6, p[1] - 3, 0.9], nail);
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
  eye([3.8, -14.4, 15.4], 1.7, iris = [0.15, 0.5, 0.95], pupil = [0.05, 0.15, 0.4], sclera = [0.85, 0.95, 1], yaw = -20);
  color(snow) translate([3.8, -14.6, 17.4]) rotate([0, -20, -20]) scale([2.8, 1.0, 0.8]) sphere(1, $fn = 14);
}
// Trunk: ridged, hanging down to the ground and curling forward.
chain([[0, -15.5, 12], [0, -16.5, 8], [0, -17, 4.5], [0, -18.5, 2], [0, -20, 2.4]], [2.8, 2.3, 1.9, 1.6, 1.3], fur);
for (z = [5 : 1.6 : 12]) color(furDk) translate([0, -16.4 - (12 - z) * 0.12, z]) scale([2.2, 1.4, 0.3]) sphere(1, $fn = 14);
// Crystal ice tusks: a pale stub then a faceted ice crystal, pointing forward and out.
mirror_x() {
  limb([3.4, -14.5, 10], [5, -17.5, 8.5], 1.3, 1.1, [0.9, 0.93, 0.95]);
  color(ice) hull() {
    translate([5, -17.5, 8.5]) rotate([0, 0, 20]) scale([1.6, 1.6, 1.6]) sphere(1, $fn = 6);
    translate([6.6, -22.5, 7.5]) sphere(0.2, $fn = 6);
  }
  color(iceDk) hull() {
    translate([5.3, -18, 8]) scale([1.0, 1.0, 1.0]) sphere(1, $fn = 6);
    translate([6.4, -21, 7.3]) sphere(0.2, $fn = 6);
  }
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
// Ice spikes along the spine.
for (s = [[-4.5, 3.2], [-1, 4.2], [2.5, 3.8], [6, 3.2], [9.5, 2.4]])
  color(ice) translate([0, s[0], 23.4 - abs(s[0] - 1) * 0.15]) cylinder(h = s[1] * 1.3, r1 = 1.6, r2 = 0.1, $fn = 5);
