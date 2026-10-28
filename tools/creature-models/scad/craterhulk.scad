// Craterhulk: a hulking golem of cratered meteor boulders with a glowing aqua star core in a stone ring on its chest.
//
// Checklist (front sheet, x = sheet x, z = sheet z; feet on z ~0.4, no ground shadow in the art):
//   - head: one big round boulder, x -6.5..6.5, z 28.4..39.4, craters on the crown (one big, two small);
//     two slanted angry aqua eyes at (-5.1, 32.3) and (-0.4, 32.3), ~2.3 wide; a dark frown line at z 30.3
//   - shoulders: two boulders r~4, centres (-10.4, 28.2) and (9.5, 27.4), one big crater each
//   - torso: a broad chest x -9.5..9, z 15.4..28.4 packed from boulders; the core ring centred (-3, 20.9),
//     ring r 5.5 in pale stone (M1), teal disc inside (M4), aqua five-point star r 3.2 (M3); belly boulder z 11.4..16.9
//   - arms: upper arm boulders beside the chest (x -16.5..-12 / 12..17.5, z 15..22); fists r~4.5 at (-15.2, 12) and
//     (13.5, 10.4) with a web of glowing orange cracks (M5, GLOWS) around dark craters on their lower front
//   - legs: two thick boulder columns, x -12.5..-2.5 and 1..10, z 0.4..14.4, knee craters, flat foot boulders
//   - orbit: three dark pebbles (r 1.5 / 1.2 / 1) and a thin aqua chevron trail beside each shoulder, z 24..36
//   - back: the same ring + star on the back, shoulders, the head's craters, lava on the fists' outer sides
// Colours: rock M0 mid [0.27, 0.25, 0.31], craters #171d30, ring rim M1, disc M4, star / eyes M3 (NOGLOW), lava M5 (GLOW).
include <lib.scad>

rock = [0.27, 0.25, 0.31];
rockLit = [0.39, 0.36, 0.41];
crater = [0.09, 0.11, 0.19];
rim = [0.60, 0.55, 0.54];
disc = [0.14, 0.35, 0.36];
aqua = [0.66, 0.95, 0.85, NOGLOW];
trail = [0.54, 0.80, 0.79, NOGLOW];
lava = [0.98, 0.60, 0.22, GLOW];
lavaDark = [0.53, 0.18, 0.23, NOGLOW];

// A crater on the surface of the ellipsoid (radii r, centre p) in direction d: a lit rim disc under a dark dimple.
module dimple(r, p, d, s) {
  n = d / norm(d);
  q = p + [n[0] * r[0], n[1] * r[1], n[2] * r[2]];
  color(rockLit) translate(q * 0.985 + p * 0.015) rotate(_dir_rot(n)) scale([1, 1, 0.3]) sphere(s * 1.3, $fn = 10);
  color(crater) translate(q * 0.99 + p * 0.01) rotate(_dir_rot(n)) scale([1, 1, 0.42]) sphere(s, $fn = 10);
}
// A cratered boulder: ellipsoid r at p with craters at [azimuth, elevation, size share] (azimuth 0 = -Y, the front).
module boulder(r, p, craters = [], c = rock, fn = 22) {
  color(c) translate(p) scale(r) sphere(1, $fn = fn);
  for (k = craters) dimple(r, p, [sin(k[0]) * cos(k[1]), -cos(k[0]) * cos(k[1]), sin(k[1])], min(r) * (k[2] == undef ? 0.3 : k[2]));
}
module star5(r, th, c) {
  color(c) linear_extrude(height = th, center = true)
    polygon([for (i = [0 : 9]) let(a = 90 + i * 36, rr = i % 2 == 0 ? r : r * 0.48) [rr * cos(a), rr * sin(a)]]);
}

// ---- Head: one big boulder, craters on the crown.
boulder([6.8, 6.2, 5.6], [0, 0, 33.9], [[0, 78, 0.42], [-50, 45, 0.22], [60, 55, 0.2], [150, 40, 0.25], [-150, 15, 0.28], [180, 55, 0.2]], rock, 32);
// Brow ledge over the eyes.
color(rock) hull() { translate([-4.2, -4.6, 33.6]) scale([1.4, 1.4, 0.8]) sphere(1, $fn = 12); translate([4.2, -4.6, 33.6]) scale([1.4, 1.4, 0.8]) sphere(1, $fn = 12); }
// Angry aqua eyes: slanted almonds, the inner ends low, sunk in dark sockets.
mirror_x() {
  color(crater) translate([2.7, -5.3, 32.2]) rotate([0, 0, 12]) rotate([0, -26, 0]) scale([2.1, 0.9, 1.5]) sphere(1, $fn = 16);
  color(aqua) translate([2.7, -5.9, 32.2]) rotate([0, 0, 12]) rotate([0, -26, 0]) scale([1.7, 0.8, 1.25]) sphere(1, $fn = 16);
}
// Frown.
color(crater) translate([0, -5.4, 30.1]) scale([3.0, 0.6, 0.45]) sphere(1, $fn = 12);

// ---- Torso: a broad chest boulder with smaller boulders packed round it, a belly boulder below.
boulder([10, 7, 6.8], [0, 0, 22], [[35, 40, 0.28], [-120, 30, 0.25], [120, 20, 0.25], [180, 50, 0.25]], rock, 30);
boulder([6.2, 5.5, 3.6], [0, 0.5, 14.2], [[-40, -10, 0.3], [130, 0, 0.3]], rock);
for (a = [[-7.2, -2.5, 16.5, 3.4], [7.2, -2.5, 16.5, 3.4], [-8.4, 0, 24.5, 3.6], [8.4, 0, 24.5, 3.6], [0, -2, 27.2, 3.8]])
  boulder([a[3], a[3], a[3] * 0.95], [a[0], a[1], a[2]], [[a[0] < 0 ? -30 : 30, 15, 0.3]]);
// Hips.
mirror_x() boulder([4.6, 4.2, 3.8], [6.5, -1, 13.5], [[-20, 0, 0.3]]);
// Core: pale stone ring, deep teal disc, bright aqua star; the same on the back.
for (side = [-1, 1]) {
  y = side * 6.6;
  color(rim) translate([0, y, 20.9]) rotate([90, 0, 0]) rotate_extrude($fn = 28) translate([4.7, 0]) scale([1, 1.4]) circle(1.1, $fn = 8);
  color(disc) translate([0, y + side * 0.2, 20.9]) scale([4.6, 1.0, 4.6]) sphere(1, $fn = 24);
  translate([0, y + side * 0.95, 20.9]) rotate([90, 0, 0]) star5(3.3, 0.8, aqua);
}

// ---- Shoulders: big cratered boulders.
mirror_x() boulder([4.2, 4.0, 4.0], [11.5, 1, 27.8], [[20, 10, 0.42], [-70, 35, 0.22], [100, 30, 0.22], [180, 20, 0.3]], rock, 24);

// ---- Arms: an upper-arm boulder beside the chest, then a huge fist webbed with molten cracks.
mirror_x() {
  limb([11.5, 1, 27.8], [16, -0.5, 19], 3.0, 2.8, rock);
  boulder([4.0, 3.8, 4.0], [16, -0.5, 19], [[0, 10, 0.32], [90, 20, 0.25]]);
  F = [17.5, -1, 11.3];
  FR = [4.3, 4.5, 4.8];
  boulder(FR, F, [[150, 10, 0.3]], rock, 24);
  // Molten web: lava rings round dark crater islands on the fist's lower front and outer side.
  for (k = [[-10, -5, 2.3], [40, -30, 1.9], [-45, -40, 1.8], [85, -10, 1.8], [-5, -62, 1.7], [60, 20, 1.5]]) {
    d = [sin(k[0]) * cos(k[1]), -cos(k[0]) * cos(k[1]), sin(k[1])];
    q = F + [d[0] * FR[0], d[1] * FR[1], d[2] * FR[2]] * 0.93;
    color(lava) translate(q) rotate(_dir_rot(d)) rotate_extrude($fn = 12) translate([k[2], 0]) circle(0.62, $fn = 6);
    color(lavaDark) translate(q) rotate(_dir_rot(d)) rotate_extrude($fn = 12) translate([k[2] + 0.5, 0]) circle(0.3, $fn = 5);
    color(crater) translate(q) rotate(_dir_rot(d)) scale([1, 1, 0.5]) sphere(k[2] * 0.8, $fn = 10);
  }
  // Cracks running between the rings.
  for (c = [[[-20, -45], [20, -5]], [[55, -35], [95, 5]], [[-50, -20], [-10, 5]]])
    color(lava) hull() for (k = c) {
      d = [sin(k[0]) * cos(k[1]), -cos(k[0]) * cos(k[1]), sin(k[1])];
      translate(F + [d[0] * FR[0], d[1] * FR[1], d[2] * FR[2]] * 0.98) sphere(0.5, $fn = 8);
    }
}

// ---- Legs: thick boulder columns, wide apart, hulled from the thigh to the flat foot boulder; a knee crater.
mirror_x() {
  blob([[[4.8, 4.8, 4.6], [7.6, -2, 10.6]], [[5.0, 5.4, 3.3], [8.0, -2.6, 3.5]]], rock);
  dimple([4.8, 4.8, 4.6], [7.6, -2, 10.6], [0.2, -1, 0.3], 1.5);
  dimple([4.8, 4.8, 4.6], [7.6, -2, 10.6], [1, -0.3, 0.5], 1.0);
  dimple([5.0, 5.4, 3.3], [8.0, -2.6, 3.5], [0.1, -1, 0.1], 1.6);
  dimple([5.0, 5.4, 3.3], [8.0, -2.6, 3.5], [0, 1, 0.2], 1.4);
}

// ---- Orbiting pebbles on thin aqua chevron trails beside the shoulders.
mirror_x() {
  chain([[13.0, 1.5, 32.6], [16.4, 1.5, 31.4], [19.0, 1.5, 29.0], [17.2, 1.5, 26.4], [14.6, 1.5, 25.3]], [0.3, 0.32, 0.34, 0.32, 0.3], trail);
  for (p = [[15.8, 1.5, 35.0, 1.5], [20.2, 1.5, 29.6, 1.2], [18.0, 1.5, 24.2, 1.0]]) boulder([p[3], p[3], p[3]], [p[0], p[1], p[2]], [[0, 20, 0.35]], rock, 12);
}
