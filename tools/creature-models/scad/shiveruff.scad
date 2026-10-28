// Shiveruff: a white arctic fox pup with an icy-blue fur ruff, ice crystals sprouting on its head and ears,
// a big snowball tail and dark navy paws.
include <lib.scad>

fur = [0.93, 0.95, 1];
furShade = [0.8, 0.87, 0.97];
ruff = [0.55, 0.82, 0.95];
ruffDark = [0.38, 0.68, 0.9];
ice = [0.62, 0.86, 0.98];
iceDeep = [0.4, 0.7, 0.93];
paw = [0.12, 0.2, 0.42];
mouth = [0.75, 0.15, 0.2];
nose = [0.1, 0.12, 0.25];

// Faceted ice crystal: a hexagonal shard from p along d.
module crystal(p, d, r, c) {
  l = norm(d);
  color(c) translate(p) rotate(_dir_rot(d)) {
    cylinder(h = l * 0.7, r1 = r * 0.8, r2 = r, $fn = 6);
    translate([0, 0, l * 0.7]) cylinder(h = l * 0.3, r1 = r, r2 = 0.05, $fn = 6);
  }
}

// Body: a stout loaf along Y.
blob([[[6.5, 6.5, 6], [0, -2, 11.5]], [[6, 6, 5.5], [0, 5, 11]]], fur);

// Legs: white upper, navy socks.
module leg(x, y) {
  limb([x, y, 10], [x, y - 0.3, 4], 2.5, 2.3, fur);
  limb([x, y - 0.3, 4.2], [x, y - 0.6, 1.2], 2.5, 2.4, paw);
  ell([2.7, 3.3, 1.4], [x, y - 1.2, 1.4], paw);
  // White fur flick over the sock.
  spike([x, y - 2.3, 5], [0, -0.3, -1.6], 1.1, 0.1, fur);
}
mirror_x() { leg(4, -4); leg(4, 7.5); }

// Ice-blue ruff around the neck: a puffy collar bristling with pointed tufts, hanging over the chest.
ell([7.6, 6.4, 4.6], [0, -5.5, 15.5], ruff);
ell([6, 3.2, 4.8], [0, -10, 13.5], ruff);
for (a = [0 : 24 : 359]) {
  d = [cos(a), sin(a) * 0.85, 0];
  spike([0, -5.5, 15.5] + d * 6.2, d * 3.2 + [0, 0, -2.6], 1.9, 0.15, (a / 24) % 2 == 0 ? ruff : ruffDark);
}
for (x = [-5 : 2.5 : 5]) spike([x, -11.2, 12.5], [x * 0.15, -1, -3.6], 1.6, 0.15, abs(x) % 5 == 0 ? ruffDark : ruff);

// Head: big and round (pup proportions).
ell([8.4, 7.6, 7.6], [0, -8, 23], fur);
// Cheek fluff.
mirror_x() for (z = [19.5, 22.5]) spike([6.8, -9, z], [2.6, -0.3, -0.9], 1.6, 0.1, fur);
// Muzzle.
ell([3.6, 2.6, 2.6], [0, -14.4, 20.6], fur);
ell([1.2, 0.8, 0.9], [0, -16.9, 21.8], nose);
// Open mouth with fangs.
color(mouth) translate([0, -15.6, 19.2]) scale([2.3, 1.3, 1.2]) sphere(1, $fn = 18);
mirror_x() spike([1.2, -16.6, 20], [0, 0, -0.9], 0.35, 0.05, "white");
// Big blue eyes.
mirror_x() eye([3.6, -14, 24], 2.3, iris = [0.3, 0.65, 0.92], pupil = [0.06, 0.12, 0.3], yaw = -22);
// Ice-blue brow marks.
mirror_x() petal([1.3, 0.5, 0.6], [2.4, -14.6, 27.2], [0, 0, -15], ice);

// Ears with ice-crystal lining.
mirror_x() {
  color(fur) hull() {
    translate([4.5, -7, 28]) scale([1.3, 0.8, 1]) sphere(2.8);
    translate([6.4, -7, 35.5]) sphere(0.4);
  }
  crystal([4.8, -9, 28.5], [1.2, -0.2, 5.6], 1.2, ice);
}

// Ice crystals clustered on the crown and behind the ears.
crystal([0, -10.5, 29], [0, -0.6, 3.6], 1, ice);
crystal([-1.7, -9.5, 29], [-0.8, -0.3, 3.2], 0.9, iceDeep);
crystal([1.7, -9.5, 29], [0.8, -0.3, 3.2], 0.9, iceDeep);
mirror_x() {
  crystal([6.5, -5.5, 27.5], [2.6, 1, 5.5], 1.3, ice);
  crystal([7, -4.5, 26.5], [4.8, 1.5, 2.6], 1.1, iceDeep);
  crystal([6, -4, 28.5], [1.6, 2, 6], 1.1, ice);
}

// Snowball tail: a big white puff at the back with icy-blue flame tips at its base.
ell([7, 6.5, 7], [0, 13.5, 19], fur);
for (a = [200 : 28 : 340])
  spike([0, 9.4, 19] + [5.6 * cos(a), 0, 5.6 * sin(a)], [cos(a) * 1.2, 2.8, sin(a) * 1.2 + 1.2], 2.2, 0.1, ruff);
color(ruff) translate([0, 13.5, 19]) intersection() {
  scale([7.1, 6.6, 7.1]) sphere(1, $fn = 28);
  translate([0, 0, -1.5]) rotate([25, 0, 0]) translate([-10, -10, -20]) cube([20, 20, 20]);
}
