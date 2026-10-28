// Dreambud: a sleepy lavender cloud with a band of pink puffs round its middle, heavy-lidded eyes, a yellow crescent
// moon on its brow, pink star ornaments on each side, stubby feet and little stars drifting about.
include <lib.scad>

lav = [0.74, 0.68, 0.94];
lavDark = [0.6, 0.54, 0.84];
pink = [0.96, 0.72, 0.88];
pinkDark = [0.86, 0.58, 0.8];
moon = [1, 0.88, 0.45];
starPink = [0.98, 0.58, 0.64];
starBlue = [0.55, 0.72, 0.98];
starViolet = [0.62, 0.48, 0.9];
lid = [0.5, 0.42, 0.68];
ink = [0.12, 0.1, 0.16];

// Five-pointed puffy star facing -Y.
module star(p, r, c, rot = [0, 0, 0], t = 0.5) {
  color(c) translate(p) rotate(rot) rotate([90, 0, 0]) hull() {
    translate([0, 0, -t]) linear_extrude(height = 2 * t) polygon([for (i = [0 : 9]) let(a = 90 + i * 36, rr = i % 2 == 0 ? r : r * 0.48) [rr * cos(a), rr * sin(a)]]);
  }
}
// Plain extruded star (not hulled, keeps the points).
module star5(p, r, c, rot = [0, 0, 0], t = 0.5) {
  color(c) translate(p) rotate(rot) rotate([90, 0, 0]) translate([0, 0, -t])
    linear_extrude(height = 2 * t) polygon([for (i = [0 : 9]) let(a = 90 + i * 36, rr = i % 2 == 0 ? r : r * 0.48) [rr * cos(a), rr * sin(a)]]);
}

C = [0, 0, 18];
// Upper cloud: a lavender ball with lumpy puffs over its top half.
ell([13, 12, 12], C, lav);
// Puffs only round the rim and crown, leaving the face smooth: [azimuth (0 = front), elevation, radius].
for (q = [[90, 10, 4.6], [-90, 10, 4.6], [60, 45, 4.4], [-60, 45, 4.4], [120, 40, 4.6], [-120, 40, 4.6], [0, 70, 5],
          [180, 60, 5], [150, 15, 4.6], [-150, 15, 4.6], [180, 25, 4.6], [30, 62, 4.2], [-30, 62, 4.2], [110, -5, 4],
          [-110, -5, 4], [90, 70, 4], [-90, 70, 4], [140, 75, 4]]) {
  n = [sin(q[0]) * cos(q[1]), -cos(q[0]) * cos(q[1]), sin(q[1])];
  color(abs(q[0]) > 100 ? lavDark : lav) translate(C + [10.4 * n[0], 9.6 * n[1], 9.6 * n[2]]) sphere(q[2], $fn = 20);
}
// Pink puff band round the lower body.
for (a = [0 : 36 : 359]) {
  ell([5, 4.6, 3.9], C + [11.6 * sin(a), -10.8 * cos(a), -4.5 + 0.8 * sin(a * 3)], (a / 36) % 3 == 1 ? pinkDark : pink);
}
for (a = [18 : 45 : 359]) ell([4.4, 4, 3.6], C + [9 * sin(a), -8.4 * cos(a), -9], pinkDark);
ell([9.6, 9, 4.4], C + [0, 0, -9.5], lavDark);
// Feet.
mirror_x() ell([3.4, 3.6, 2.6], [5, -1, 2.6], lavDark);

// Face: sleepy half-lidded eyes with lashes, a tiny drool drop.
mirror_x() translate([4.6, -11.9, 19.5]) rotate([0, 0, 18]) scale(1.4) {
  color("white") scale([2.6, 1, 1.5]) sphere(1, $fn = 18);
  color(ink) translate([-0.3, -0.6, -0.4]) scale([1.3, 0.8, 1]) sphere(1, $fn = 14);
  color("white") translate([0.2, -1.2, -0.1]) sphere(0.3, $fn = 8);
  // Heavy lid over the top half.
  color(lid) translate([0, -0.1, 0.4]) scale([2.9, 1.3, 1.2]) sphere(1, $fn = 18);
  color(ink) translate([0, -0.8, -0.05]) scale([3, 0.5, 0.3]) sphere(1, $fn = 12);
  color(ink) translate([2.8, -0.6, 0.6]) rotate([0, -30, 0]) scale([0.9, 0.3, 0.25]) sphere(1, $fn = 8);
}
color([0.75, 0.85, 1]) translate([2.5, -11.6, 13.5]) scale([0.8, 0.6, 1.2]) sphere(1, $fn = 10);

// Crescent moon on the brow (viewer's left of centre).
color(moon) translate([-3, -9.4, 25.5]) rotate([90 - 35, 0, -12]) translate([0, 0, -0.7]) linear_extrude(height = 1.4)
  difference() { circle(3.2, $fn = 32); translate([1.4, 1.1]) circle(2.8, $fn = 32); }

// Star ornaments on either side of the head.
star5([11, -5, 26], 4.6, starPink, [0, -10, 35], 1.2);
star5([-12.4, -3, 23], 3.6, starPink, [0, 15, -35], 1);

// Little stars drifting around.
star5([8, -6, 38], 1.6, starBlue, [0, 0, 20], 0.3);
star5([13, -3, 35], 1.8, starViolet, [0, 0, 40], 0.3);
star5([-15, -4, 9], 1.6, starPink, [0, 0, -30], 0.3);
star5([13, -4, 6], 1.4, starViolet, [0, 0, 30], 0.3);
star5([-12, 2, 38], 1.4, starBlue, [0, 0, -40], 0.3);
for (p = [[15, -2, 18], [-16, -2, 15], [4, -8, 37], [-8, -5, 36]]) color(starBlue) translate(p) sphere(0.5, $fn = 8);
