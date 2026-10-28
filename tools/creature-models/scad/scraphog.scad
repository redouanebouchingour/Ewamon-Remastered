// Scraphog: a stocky boar armoured in cracked brown stone plates with dark grey grout between them, a ridge of stone
// spikes and a cluster of violet crystals along its back, red eyes over a big pig snout and curved cream tusks.
include <lib.scad>

grout = [0.3, 0.28, 0.28];
rock = [0.6, 0.4, 0.25];
rockHi = [0.74, 0.52, 0.34];
rockDk = [0.46, 0.3, 0.2];
crystal = [0.62, 0.42, 0.78];
crystalHi = [0.82, 0.68, 0.95];
tusk = [0.92, 0.84, 0.66];
snout = [0.7, 0.48, 0.38];
eyeC = [0.85, 0.12, 0.08];

// Stone plates on an ellipsoid surface: centre c, radii r, list of [azimuth, elevation, size].
module plates(c, r, list, th = 0.9) {
  for (i = [0 : len(list) - 1]) {
    t = list[i];
    az = t[0]; el = t[1]; sz = t[2];
    p = [c[0] + r[0] * cos(el) * cos(az), c[1] + r[1] * cos(el) * sin(az), c[2] + r[2] * sin(el)];
    color(i % 3 == 0 ? rockHi : (i % 3 == 1 ? rock : rockDk))
      translate(p) rotate([0, 0, az]) rotate([0, 90 - el, 0]) scale([sz, sz * 1.1, th]) sphere(1, $fn = 10);
  }
}
// A hexagonal crystal shard from p along d.
module crystal(p, d, r) {
  l = norm(d);
  translate(p) rotate(_dir_rot(d)) {
    color(crystal) cylinder(h = l * 0.75, r = r, $fn = 6);
    color(crystalHi) translate([0, 0, l * 0.75]) cylinder(h = l * 0.25, r1 = r, r2 = 0.05, $fn = 6);
  }
}

// Body: a barrel on short legs, grey grout under the stone plates.
bc = [0, 1, 13];
br = [8.5, 11.5, 8];
ell(br, bc, grout);
plates(bc, br, [for (el = [-30, -5, 20, 45, 70], k = [0 : 11]) [k * 30 + (el % 30) + 8, el, el > 60 ? 2.6 : 2.9]], 1.3);

// Back: stone spikes down the spine, violet crystals clustered over the shoulders and middle.
for (i = [0 : 5]) spike([0, -6 + i * 3.4, 20], [0, 1, 4.5 - abs(i - 2) * 0.5], 1.8, 0.1, i % 2 == 0 ? rockDk : rock);
mirror_x() for (i = [0 : 3]) spike([3.6, -4 + i * 4, 19.4], [1.2, 0.8, 3.2], 1.4, 0.1, rockDk);
crystal([0, -1, 19], [0.5, 0.5, 9], 1.2);
crystal([1.6, 0.5, 19], [2.2, 0.8, 7], 1.0);
crystal([-1.5, 1.5, 19], [-2, 1, 7.5], 1.0);
crystal([0.8, 3.5, 19], [1, 1.5, 6], 0.9);
crystal([-0.8, -3.5, 19], [-1.2, -0.5, 6], 0.9);
crystal([2.5, -2.5, 18.5], [2.5, -0.5, 4.5], 0.8);
crystal([-2.6, 4.5, 18.5], [-2.2, 1, 5], 0.8);

// Head: a broad plated boar head with a big snout, red eyes under heavy brows, pointed ears.
hc = [0, -11, 13.5];
ell([6.4, 5.6, 5.6], hc, grout);
plates(hc, [6.4, 5.6, 5.6], [for (el = [10, 40, 70], k = [0 : 9]) let(az = k * 36 + el)
  if (el > 30 || abs(((az - 270 + 720) % 360) - 180) < 120) [az, el, 2.5]], 1.2);
color(rock) translate([0, -14, 13]) scale([5, 3, 4.2]) sphere(1, $fn = 22);
// Snout disc with nostrils.
color(snout) translate([0, -17.2, 11.6]) rotate([90, 0, 0]) scale([3.2, 2.6, 1]) cylinder(h = 2.6, r = 1, center = true, $fn = 20);
mirror_x() color([0.25, 0.14, 0.1]) translate([1.2, -18.6, 11.6]) scale([0.6, 0.3, 0.8]) sphere(1, $fn = 10);
mirror_x() {
  // Glowing red eyes on a dark socket, sunk under a heavy stone brow that slants down to the snout.
  eye([3.1, -15.2, 15.2], 1.75, iris = [1, 0.18, 0.08, GLOW], pupil = [0.15, 0.02, 0.02], sclera = [0.2, 0.1, 0.08], yaw = 10,
      flat = 0.55, shine = false, lid = 0.48, lid_tilt = 32, lid_c = rockDk, slit = 0.35);
  color(rockDk) hull() {
    translate([4.6, -14.4, 17.4]) scale([1.5, 1.4, 0.85]) sphere(1, $fn = 10);
    translate([1.2, -16.4, 16.4]) scale([0.9, 1, 0.6]) sphere(1, $fn = 10);
  }
  // Ears: pointed stone wedges.
  color(rockHi) translate([5, -9.5, 18.6]) rotate([15, 30, 10]) scale([1.6, 1, 3]) sphere(1, $fn = 12);
  // Tusks: from the jaw, curving out and up.
  chain([[2.4, -16.6, 9.8], [4.6, -18.6, 8.6], [6.8, -19.4, 10.4], [7.4, -18.6, 13.4], [6.8, -17.2, 15.4]], [1.4, 1.3, 1, 0.6, 0.1], tusk);
  // Lower jaw tusk stubs.
  spike([1.6, -16.8, 9.4], [0.3, -0.4, 1.8], 0.4, 0.05, tusk);
}
color(rockDk) translate([0, -15.6, 9.6]) scale([3.6, 2.4, 1.4]) sphere(1, $fn = 16);

// Legs: four stout plated legs with hooves.
mirror_x() for (y = [-6, 8]) {
  limb([5.5, y, 11], [6, y - 0.5, 2.5], 3, 2.6, grout);
  plates([5.8, y, 7], [2.8, 2.8, 4.5], [for (el = [-40, -5, 30], k = [0 : 5]) [k * 60 + el, el, 2]], 0.7);
  color(rockDk) translate([6, y - 1, 1.4]) scale([2.8, 3, 1.4]) sphere(1, $fn = 16);
  for (a = [-20, 20]) color(grout) translate([6 + sin(a) * 1.5, y - 3.6, 1]) scale([0.9, 0.7, 1]) sphere(1, $fn = 8);
}

// Short tail stub.
chain([[0, 12, 15], [0, 14, 15.5], [0.8, 15, 14]], [1, 0.7, 0.3], rockDk);
