// Shardling: a stocky little golem of faceted silver crystal flecked with rainbow glints, a big round head with
// glowing pale-blue eyes and a cocky grin, a prism shard held up like a dagger, and a rainbow aura flaring behind it.
include <lib.scad>

silver = [0.86, 0.89, 0.95];
silverLight = [0.92, 0.95, 1];
silverDark = [0.7, 0.75, 0.84];
glowEye = [0.7, 0.95, 1];
mouth = [0.25, 0.3, 0.4];
rainbow = [[1, 0.45, 0.45], [1, 0.7, 0.35], [1, 0.92, 0.4], [0.5, 0.9, 0.5], [0.45, 0.75, 1], [0.7, 0.55, 1]];

// Faceted ellipsoid: low-poly so the planes read as cut crystal.
module facet(r, p, c, fn = 9, rot = [0, 0, 0]) { color(c) translate(p) rotate(rot) scale(r) sphere(1, $fn = fn); }
// Rainbow fleck stuck on a surface point p facing out along n.
module fleck(p, n, i, s = 0.8) {
  color(rainbow[i % 6]) translate(p) rotate(_dir_rot(n)) scale([s, s * 0.5, 0.2]) cube(2, center = true);
}

// Torso: a round faceted barrel.
facet([10.4, 8.6, 8.6], [0, 0, 14.5], silver, 10, [0, 0, 18]);
facet([8, 3, 6], [0, -6.2, 14.5], silverLight, 7, [0, 0, 10]);
// Head: big, round, sunk into the shoulders.
H = [0, -1.5, 28];
facet([8, 7.6, 7.2], H, silver, 12, [0, 0, 15]);
facet([6.4, 3, 4.6], H + [0, -5.4, 0.6], silverLight, 9);
// Glowing angry eyes with slanted brows, and a smirk.
mirror_x() {
  color(glowEye) translate(H + [2.6, -7.5, 0.8]) rotate([0, 0, -15]) scale([1.5, 0.6, 1.1]) sphere(1, $fn = 14);
  color("white") translate(H + [2.4, -8, 1.1]) sphere(0.5, $fn = 8);
  color(silverDark) translate(H + [2.6, -7.6, 2.6]) rotate([0, 20, -15]) scale([2.2, 0.8, 0.5]) sphere(1, $fn = 10);
}
color(mouth) translate(H + [0.6, -7.6, -2.2]) rotate([0, -12, 0]) scale([1.6, 0.4, 0.3]) sphere(1, $fn = 10);
color(mouth) translate(H + [2.1, -7.2, -1.8]) rotate([0, -45, 0]) scale([0.6, 0.35, 0.25]) sphere(1, $fn = 8);

// Shoulders and arms: chunky faceted blocks.
mirror_x() {
  facet([4.4, 4.4, 4], [10, 0, 20], silver, 8);
}
// Viewer's right arm: hanging down, fist clenched.
facet([3.4, 3.4, 4], [12, -0.5, 15], silverDark, 8);
facet([3.8, 3.8, 3.6], [12.6, -1.5, 9.5], silver, 8);
// Viewer's left arm: forearm raised, holding the prism shard upright.
facet([3.4, 3.4, 3.8], [-12.4, -1, 16], silverDark, 8);
facet([3.4, 3.4, 3.2], [-13.4, -4, 13.5], silver, 8);
// Prism shard dagger: a hexagonal crystal with a rainbow sheen, pommel in the fist.
translate([-13.6, -6, 15]) rotate([0, -12, 0]) {
  color(rainbow[4]) cylinder(h = 10, r1 = 1.4, r2 = 1.6, $fn = 6);
  color(rainbow[5]) translate([0, -0.4, 0]) cylinder(h = 10, r1 = 1.1, r2 = 1.3, $fn = 6);
  color(silverLight) translate([0, 0, 10]) cylinder(h = 3.4, r1 = 1.6, r2 = 0, $fn = 6);
  color(rainbow[1]) translate([0.6, -0.9, 3]) cube([0.4, 0.4, 5], center = true);
  color(rainbow[3]) translate([-0.6, -0.9, 5]) cube([0.4, 0.4, 4], center = true);
  color(silverDark) translate([0, 0, -1.6]) cylinder(h = 1.6, r = 0.8, $fn = 6);
}

// Legs: short faceted stumps with block feet.
mirror_x() {
  facet([3.6, 3.6, 3.4], [5, 0, 6], silverDark, 8);
  facet([3.8, 4.8, 2.2], [5.4, -1, 2.2], silver, 8);
}

// Rainbow glints over the body and head.
for (i = [0 : 17]) {
  az = i * 47; el = (i % 5) * 16 - 25;
  n = [sin(az) * cos(el), -cos(az) * cos(el), sin(el)];
  fleck([0, 0, 14.5] + [10.4 * n[0], 8.6 * n[1], 8.6 * n[2]] * 0.98, n, i);
}
for (i = [0 : 9]) {
  az = i * 61 + 30; el = (i % 4) * 18 - 5;
  n = [sin(az) * cos(el), -cos(az) * cos(el), sin(el)];
  if (!(abs(az % 360) < 50 && el < 30)) fleck(H + [8 * n[0], 7.6 * n[1], 7.2 * n[2]] * 0.98, n, i + 2);
}

// Rainbow aura: flat prism shards fanned in an arc behind the head and shoulders.
for (i = [0 : 14]) {
  a = -95 + i * 13.5;
  L = 4 + (i % 3) * 1.6;
  color(rainbow[i % 6]) translate([0, 5.5, 23] + [10.5 * sin(a), 0, 9.5 * cos(a)]) rotate([0, a, 0]) rotate([90, 0, 0])
    linear_extrude(height = 0.6, center = false) polygon([[-1.3, 0], [1.3, 0], [0, L]]);
}
// Floating chips.
for (i = [0 : 7]) {
  a = i * 45 + 20;
  color(rainbow[(i + 3) % 6]) translate([15 * sin(a), -2 + (i % 2) * 3, 20 + 13 * cos(a)]) rotate([a, 30, a]) scale([0.4, 0.4, 1]) cube(1.4, center = true);
}
