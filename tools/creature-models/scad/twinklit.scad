// Twinklit: a puffy teal five-pointed star with a cream star-shaped face, sleepy closed eyes, navy diamond markings
// holding little sparkles, and a trail of sparkles swirling under it.
include <lib.scad>

teal = [0.45, 0.78, 0.7];
tealDark = [0.3, 0.6, 0.56];
cream = [1, 0.96, 0.7];
navy = [0.15, 0.17, 0.4];
spark = [1, 0.92, 0.6];
pinkSpark = [1, 0.8, 0.85];
ink = [0.12, 0.13, 0.25];

cz = 21;   // centre height of the star
R = 16;    // tip radius

// A puffy star in the XZ plane: hull of a fat core with each tip. th = half-thickness in Y.
module puffy_star(R, core, th, tipR, c) {
  color(c) for (i = [0 : 4]) {
    a = 90 + i * 72;
    hull() {
      scale([core, th, core]) sphere(1, $fn = 24);
      translate([R * cos(a), 0, R * sin(a)]) scale([tipR, th * 0.55, tipR]) sphere(1, $fn = 14);
    }
  }
}

// Body: a teal star, slightly darker back layer for depth.
translate([0, 0, cz]) {
  puffy_star(R, 10.5, 5.5, 3.6, teal);
  translate([0, 1.2, 0]) puffy_star(R * 0.97, 10, 5, 3.2, tealDark);
  // Cream face: a smaller flat star on the front.
  translate([0, -4.4, 0.4]) puffy_star(9.5, 6, 1.1, 2, cream);
  // Sleepy closed eyes (arcs) and a small smile.
  mirror_x() color(ink) translate([3.2, -5.9, 1.6]) rotate([90, 0, 0]) rotate([0, 0, 200]) rotate_extrude(angle = 140, $fn = 16) translate([1.7, 0]) circle(0.35, $fn = 8);
  color(ink) translate([0, -5.9, -1.4]) rotate([90, 0, 0]) rotate([0, 0, 200]) rotate_extrude(angle = 140, $fn = 16) translate([1.3, 0]) circle(0.3, $fn = 8);
  // Navy diamonds with a sparkle in each, on the upper tip and two arms, plus one lower-left.
  marks = [[2, 11], [11.5, 3.5], [-10.5, -8.5]];
  for (m = marks) translate([m[0], -4.9, m[1]]) {
    color(navy) rotate([0, 45, 0]) scale([1, 0.5, 1]) cube([3.4, 2, 3.4], center = true);
    color(spark) rotate([0, 45, 0]) scale([1, 0.5, 1]) translate([0, -0.6, 0]) cube([1.4, 2, 1.4], center = true);
  }
  // Small cream dots on the other tips.
  for (m = [[-12.5, 4], [7, -9.5], [9.5, -11.5]]) color(cream) translate([m[0], -3, m[1]]) scale([1, 0.5, 1]) sphere(0.9, $fn = 10);
}

// Four-point sparkle.
module sparkle(p, s, c) {
  color(c) translate(p) for (r = [0, 90]) rotate([0, r, 0]) scale([s * 0.25, s * 0.25, s]) sphere(1, $fn = 8);
}
// Trail: sparkles swirling from under the star to the ground.
trail = [[10, 2, 9, 2.4], [12, 0, 6, 1.6], [9, -2, 3, 2], [4, -1, 1.8, 1.6], [-1, 1, 1.8, 2.2], [-6, 2, 2.4, 1.5], [7, 4, 4.4, 1.4]];
for (i = [0 : len(trail) - 1]) sparkle([trail[i][0], trail[i][1], trail[i][2]], trail[i][3], i % 2 == 0 ? spark : pinkSpark);
