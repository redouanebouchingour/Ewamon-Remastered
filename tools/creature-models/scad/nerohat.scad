// Nerohat: a round charcoal ghost-pot with a little blue cowboy hat, red eyes ringed in gold, a gold zig-zag band
// round its middle and thin wavy arms ending in big grey spidery hands resting on the ground.
include <lib.scad>

body = [0.24, 0.21, 0.22];
bodyHi = [0.36, 0.33, 0.34];
face = [0.4, 0.36, 0.38];
gold = [0.78, 0.62, 0.18];
hat = [0.18, 0.28, 0.55];
hatHi = [0.28, 0.4, 0.7];
hatDk = [0.1, 0.15, 0.32];
hand = [0.3, 0.3, 0.34];
eyeRed = [0.9, 0.15, 0.1];

// Body: an egg.
ell([9, 8.4, 9.4], [0, 0, 10], body);
ell([2, 1.2, 2], [-3.5, 4.2, 15.5], bodyHi);
// Grey face patch.
color(face) intersection() {
  translate([0, 0, 10]) scale([9.15, 8.55, 9.55]) sphere(1, $fn = 32);
  translate([0, -10, 13.6]) scale([8.6, 8, 4.4]) sphere(1, $fn = 24);
}

// Gold zig-zag band all the way round.
zig = [for (i = [0 : 24]) let(a = i * 15) [cos(a), sin(a), (i % 2 == 0 ? 1 : -1)]];
for (i = [0 : 23]) {
  a0 = i * 15; a1 = (i + 1) * 15;
  z0 = 8 + (i % 2 == 0 ? 1.1 : -1.1);
  z1 = 8 + (i % 2 == 0 ? -1.1 : 1.1);
  r0 = 8.95 * sqrt(1 - pow((z0 - 10) / 9.4, 2));
  r1 = 8.95 * sqrt(1 - pow((z1 - 10) / 9.4, 2));
  limb([r0 * cos(a0), r0 * sin(a0) * 8.4 / 9, z0], [r1 * cos(a1), r1 * sin(a1) * 8.4 / 9, z1], 0.45, 0.45, gold);
}

// Eyes: red with gold rims, angry.
mirror_x() {
  translate([3.1, -7.9, 10.6]) rotate([0, 0, -20]) {
    color(gold) scale([1.6, 0.6, 1.4]) sphere(1, $fn = 18);
    color(eyeRed) translate([0, -0.45, 0]) scale([1.05, 0.4, 0.95]) sphere(1, $fn = 16);
    color([0.15, 0, 0]) translate([0.1, -0.75, 0]) scale([0.3, 0.2, 0.55]) sphere(1, $fn = 10);
  }
}

// Cowboy hat: wide brim with upturned sides, a pinched crown, a band.
translate([0, 0.5, 18.6]) rotate([-8, 0, 0]) {
  color(hat) difference() {
    scale([7.4, 5.6, 1]) cylinder(h = 0.7, r = 1, $fn = 36);
  }
  mirror_x() color(hat) translate([6, 0, 0.6]) rotate([0, -35, 0]) scale([2, 4.6, 0.6]) sphere(1, $fn = 18);
  color(hatHi) hull() {
    translate([0, 0, 0.5]) scale([3.6, 3, 1]) sphere(1, $fn = 24);
    translate([0, 0, 3.2]) scale([2.8, 2.2, 1]) sphere(1, $fn = 20);
  }
  color(hatDk) translate([0, -0.4, 4]) scale([0.6, 1.8, 0.5]) sphere(1, $fn = 12);
  color(hatDk) translate([0, 0, 0.9]) scale([3.65, 3.05, 1]) cylinder(h = 0.8, r = 1, $fn = 24);
}

// Thin wavy arms reaching out to big spidery hands on the ground.
mirror_x() {
  chain([[8, -1, 8], [11, -2, 6], [14, -1.5, 5], [16, -3, 3.5]], [0.7, 0.6, 0.55, 0.5], hand);
  ell([2.4, 2, 1.4], [17, -3.8, 2.4], hand);
  // Long fingers splayed up and out, tips curling down.
  for (f = [[-50, 5.5], [-15, 6.5], [20, 6], [55, 5]]) {
    a = f[0]; l = f[1];
    chain([[17, -3.8, 2.6], [17 + sin(a) * l * 0.5, -3.8 - cos(a) * l * 0.25, 2.6 + l * 0.6], [17 + sin(a) * l * 0.85, -3.8 - cos(a) * l * 0.5, 2.6 + l * 0.75], [17 + sin(a) * l, -3.8 - cos(a) * l * 0.6, 2.6 + l * 0.5]], [0.7, 0.55, 0.45, 0.25], hand);
  }
  // Thumb.
  chain([[15.5, -4.4, 2.4], [14.2, -6, 1.2], [13.6, -6.6, 0.5]], [0.6, 0.45, 0.3], hand);
}
