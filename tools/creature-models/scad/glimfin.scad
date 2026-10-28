// Glimfin: a round, cheerful anglerfish pup. Cyan body with a dark blue back, a navy stalk dangling a glowing yellow
// lure in front of its face, a spiky dorsal crest, yellow-tipped side fins and a forked tail.
include <lib.scad>

cyan = [0.3, 0.72, 0.85];
cyanHi = [0.55, 0.86, 0.94];
navy = [0.14, 0.3, 0.62];
navyDk = [0.08, 0.18, 0.42];
yellow = [1, 0.84, 0.25];
yellowHi = [1, 0.96, 0.65, GLOW];
mouth = [0.55, 0.15, 0.1];
tongueC = [0.95, 0.5, 0.35];
dark = [0.05, 0.07, 0.15];

// Round body.
ell([12, 11, 11], [0, 0, 13], cyan);
// Dark blue back, cap over the top and rear.
color(navy) intersection() {
  translate([0, 0.6, 13.4]) scale([12.1, 11.1, 11.1]) sphere(1, $fn = 32);
  translate([0, 4, 21]) rotate([-35, 0, 0]) cube([30, 30, 14], center = true);
}
// Pale belly.

// Yellow star freckles.
module star(p, s, rot) {
  color(yellow) translate(p) rotate(rot) for (a = [0, 90]) rotate([0, a, 0]) scale([s, 0.3, s * 0.3]) sphere(1, $fn = 8);
}
star([0, -9.5, 22], 1.2, [-30, 0, 0]);
star([-9, -6, 16], 1, [0, 0, 40]);
star([9.5, 3, 20], 1, [0, 0, -60]);

// Big shiny eyes.
mirror_x() eye([4.4, -9.4, 16.5], 2.8, iris = [0.12, 0.3, 0.6], pupil = dark, yaw = -25);
// Open smile.
color(mouth) translate([0, -10.2, 11.5]) rotate([12, 0, 0]) scale([4, 1.6, 3]) difference() {
  sphere(1, $fn = 20);
  translate([0, 0, 1]) cube(2, center = true);
}
ell([2.4, 1, 1.2], [0, -11.2, 9.4], tongueC);

// Dorsal crest: three dark blue spikes running back from the crown.
for (i = [0 : 2]) {
  z = 25 - i * 2.5; y = 1 + i * 4;
  color(navyDk) translate([0, y, z]) rotate([-30 - i * 15, 0, 0]) scale([0.9, 3.4, 6 - i]) sphere(1, $fn = 14);
}

// Angler stalk arching over the head and forward, with a glowing lure.
chain([for (t = [0 : 0.125 : 1]) [-1 - 16 * t, -2 - 7 * t, 24.5 + 9 * sin(t * 180) - 2 * t]], [for (t = [0 : 8]) 0.8 - t * 0.03], navy);
ell([3, 3, 3], [-17.2, -9, 19.8], yellow);
ell([1.6, 1.6, 1.6], [-17.8, -10.8, 20.8], yellowHi);
// Sparkles near the lure.
for (p = [[-21.5, -9, 19], [-14, -11, 15.5], [-20, -10, 24]]) ell([0.5, 0.5, 0.5], p, yellow);

// Side fins: dark blue, flared back, tipped with yellow.
mirror_x() {
  color(navy) translate([12.5, 0, 14]) rotate([0, -30, -15]) scale([6, 1.2, 3.4]) sphere(1, $fn = 18);
  ell([2, 1.4, 1.8], [17, -0.8, 16.8], yellow);
}

// Little feet.
mirror_x() ell([2.6, 3.6, 1.6], [5, -3, 1.6], cyan);

// Forked tail fin out the back.
limb([0, 9, 9], [0, 13, 7], 2.5, 1.6, cyan);
color(navy) translate([0, 15, 8]) rotate([0, 0, 0]) for (s = [-1, 1]) rotate([s * 40, 0, 0]) translate([0, 2, 0]) scale([0.9, 4, 1.8]) sphere(1, $fn = 14);
