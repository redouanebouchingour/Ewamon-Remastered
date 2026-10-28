// Craterhulk: Meteorb grown into a hulking golem of cratered meteor boulders. A glowing aqua star core set in a stone
// ring on its chest (front and back), aqua eyes, huge fists cracked with molten orange, and pebbles orbiting on aqua
// trails beside its shoulders.
include <lib.scad>

rock = [0.42, 0.42, 0.46];
rockHi = [0.52, 0.52, 0.56];
rockDark = [0.22, 0.22, 0.26];
glow = [0.75, 1, 0.92];
glowDeep = [0.22, 0.62, 0.56];
lava = [1, 0.45, 0.12];
lavaHot = [1, 0.75, 0.3];
trail = [0.55, 0.8, 0.8];

// A cratered boulder: ellipsoid r at p, with crater dimples at [azimuth, elevation] list.
module boulder(r, p, craters = [], c = rock) {
  color(c) translate(p) scale(r) sphere(1, $fn = 24);
  for (k = craters) {
    d = [cos(k[1]) * cos(k[0]), cos(k[1]) * sin(k[0]), sin(k[1])];
    color(rockDark) translate(p + [d[0] * r[0], d[1] * r[1], d[2] * r[2]] * 0.96) rotate(_dir_rot(d)) scale([1, 1, 0.4]) sphere(min(r) * 0.28, $fn = 12);
  }
}
module star5(r, th, c) {
  color(c) linear_extrude(height = th, center = true)
    polygon([for (i = [0 : 9]) let(a = 90 + i * 36, rr = i % 2 == 0 ? r : r * 0.45) [rr * cos(a), rr * sin(a)]]);
}

// Legs: stacked boulders.
mirror_x() {
  boulder([4.2, 4.2, 4], [5.2, 0, 11.5], [[-90, 10], [0, 20]]);
  boulder([4, 4.4, 3.6], [5.6, -0.6, 4.6], [[-80, 0], [20, -10]]);
  boulder([4.4, 5.4, 2.2], [5.8, -1.6, 1.6], [[-90, 10]], rockDark);
}

// Torso: a broad boulder chest with smaller boulders packed around it.
boulder([10.5, 6.2, 9], [0, 0, 22], [[30, 50], [150, 40], [90, 60]]);
boulder([6, 5, 4], [0, 0.5, 13.6], [[-60, 0], [240, 0]]);
for (a = [[-6, -3, 16, 3.2], [6, -3, 16, 3.2], [-8.6, 1, 22, 3.4], [8.6, 1, 22, 3.4]]) boulder([a[3], a[3], a[3]], [a[0], a[1], a[2]], [[-90, 20]]);

// Chest core: stone ring, deep glow, bright aqua star. Same on the back.
for (side = [-1, 1]) {
  y = side * 6.0;
  color(rockHi) translate([0, y, 22]) rotate([90, 0, 0]) rotate_extrude($fn = 28) translate([4.6, 0]) scale([1, 1.3]) circle(1.3, $fn = 10);
  color(glowDeep) translate([0, y, 22]) scale([4.4, 1, 4.4]) sphere(1, $fn = 24);
  translate([0, y + side * 0.6, 22]) color(glow) for (i = [0 : 4]) let(a = 90 + i * 72) hull() {
    scale([1.6, 0.9, 1.6]) sphere(1, $fn = 14);
    translate([3.6 * cos(a), 0, 3.6 * sin(a)]) scale([0.4, 0.4, 0.4]) sphere(1, $fn = 8);
  }
}

// Head: a cratered boulder low between the shoulders, with a brow ridge and glowing eyes.
boulder([5.6, 5, 5], [0, -1, 34], [[60, 50], [130, 40], [90, 75], [270, 50]]);
color(rock) translate([0, -4.6, 35.4]) scale([5, 1.6, 1.2]) sphere(1, $fn = 18);
mirror_x() {
  color(rockDark) translate([2.3, -5, 33.6]) rotate([0, -15, 0]) scale([2.0, 0.8, 1.3]) sphere(1, $fn = 14);
  color(glow) translate([2.3, -5.4, 33.6]) rotate([0, -15, 0]) scale([1.6, 0.8, 1.0]) sphere(1, $fn = 14);
}

// Shoulders: big cratered boulders.
mirror_x() boulder([6, 5.6, 5.6], [11.5, 0.5, 29], [[0, 30], [60, 20], [-60, 20], [90, 40]]);

// Arms: boulder upper arm, then a huge fist split by molten cracks.
mirror_x() {
  boulder([3.6, 3.6, 4.4], [14, 0, 21], [[0, 0]]);
  boulder([6, 5.6, 6.4], [15, -1, 12], [[0, -20], [90, 0]]);
  // Molten crack web on the fist: rings of lava around a few dark knuckle boulders.
  for (k = [[-90, 10], [-50, -10], [-130, -15], [0, -10], [-90, -40]]) {
    d = [cos(k[1]) * cos(k[0]), cos(k[1]) * sin(k[0]), sin(k[1])];
    q = [15, -1, 12] + [d[0] * 6, d[1] * 5.6, d[2] * 6.4] * 0.92;
    color(lava) translate(q) rotate(_dir_rot(d)) rotate_extrude($fn = 16) translate([1.8, 0]) circle(0.65, $fn = 8);
    color(rockDark) translate(q) rotate(_dir_rot(d)) scale([1, 1, 0.5]) sphere(1.4, $fn = 12);
  }
  color(lavaHot) translate([15, -1, 12] + [0, -5.4, -1]) scale([0.5, 0.3, 2]) sphere(1, $fn = 8);
}

// Orbiting pebbles on faint aqua arcs beside the shoulders.
mirror_x() {
  color(trail) translate([17, 0, 31]) rotate([0, 0, 0]) rotate([90, 0, 0]) rotate_extrude(angle = 140, $fn = 24) translate([5.5, 0]) circle(0.25, $fn = 6);
  for (p = [[22, -1, 34, 1.4], [21.5, -1, 27, 1.1], [19, 0, 38, 1.0]]) color(rockDark) translate([p[0], p[1], p[2]]) sphere(p[3], $fn = 10);
}
