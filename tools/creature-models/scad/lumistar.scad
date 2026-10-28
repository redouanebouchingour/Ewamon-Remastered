// Lumistar: Twinklit grown a body. A teal star head with a cream face and big navy eyes, a lilac halo ring around it,
// a navy starry cloak with gold trim and a teal gem clasp, mitten hands, and a cream-teal wisp tail instead of legs.
include <lib.scad>

teal = [0.45, 0.78, 0.7];
tealDark = [0.3, 0.6, 0.56];
cream = [1, 0.95, 0.66];
navy = [0.16, 0.16, 0.38];
navyHi = [0.24, 0.24, 0.5];
gold = [0.98, 0.86, 0.45];
halo = [0.75, 0.6, 0.92];
gem = [0.4, 0.85, 0.8];
ink = [0.12, 0.13, 0.25];

module puffy_star(R, core, th, tipR, c) {
  color(c) for (i = [0 : 4]) {
    a = 90 + i * 72;
    hull() {
      scale([core, th, core]) sphere(1, $fn = 24);
      translate([R * cos(a), 0, R * sin(a)]) scale([tipR, th * 0.55, tipR]) sphere(1, $fn = 14);
    }
  }
}
module sparkle(p, s, c, rot = [0, 0, 0]) {
  color(c) translate(p) rotate(rot) for (r = [0, 90]) rotate([0, r, 0]) scale([s * 0.28, s * 0.28, s]) sphere(1, $fn = 8);
}

// Wisp tail: curls from under the cloak down to the ground and out to the viewer's right.
chain([[0, 0, 14], [1, 0, 9], [3, -0.5, 5], [6, 0, 2], [10, 1, 1.2]], [4.4, 3.4, 2.4, 1.4, 0.4], teal);
chain([[0, -1.6, 13], [1, -1.8, 9], [3, -1.8, 5.4], [6, -1, 2.6]], [3.2, 2.4, 1.6, 0.8], cream);

// Cloak: a flared navy bell, gold hem, open at the front to show a teal chest.
color(navy) difference() {
  hull() {
    translate([0, 0, 25]) scale([5.5, 5, 2]) sphere(1, $fn = 28);
    translate([0, 0, 13]) scale([12, 10, 1.6]) sphere(1, $fn = 36);
  }
  translate([0, -11, 11]) linear_extrude(height = 11, scale = 0.1) polygon([[-4.5, 0], [4.5, 0], [0, 9]]);
}
color(teal) hull() {
  translate([0, -2.6, 22]) scale([2.8, 2, 3]) sphere(1, $fn = 16);
  translate([0, -4, 14]) scale([3.4, 2.6, 1]) sphere(1, $fn = 16);
}
color(gold) translate([0, 0, 12.4]) scale([12.2, 10.2, 1]) rotate_extrude($fn = 36) translate([0.97, 0]) circle(0.12, $fn = 8);
// Hood collar around the neck.
color(navyHi) translate([0, 0.5, 25.5]) scale([6.6, 6, 2.4]) sphere(1, $fn = 24);
// Gem clasp at the throat.
color(gold) translate([0, -5.4, 24.6]) rotate([0, 45, 0]) cube([2.6, 1.2, 2.6], center = true);
color(gem) translate([0, -5.9, 24.6]) rotate([0, 45, 0]) cube([1.6, 1, 1.6], center = true);
// Gold stars scattered over the cloak (front and back).
for (s = [[30, 15.5, 2], [55, 18, 1.6], [130, 15, 2], [160, 19, 1.5], [200, 16, 2.2], [235, 20, 1.6], [270, 15.5, 2],
          [305, 19, 1.6], [340, 15, 1.8], [90, 21, 1.4], [110, 17, 1.6], [250, 17, 1.4]]) {
  a = s[0]; z = s[1]; t = (z - 13) / 12;
  rx = 12 - t * 6.5; ry = 10 - t * 5;
  sparkle([rx * cos(a) * 1.01, ry * sin(a) * 1.01, z], s[2], gold, [0, 0, a + 90]);
}

// Arms: navy sleeves with gold cuffs, teal mitten hands raised out to the sides.
mirror_x() {
  limb([4.5, 0, 23], [10, -1, 21], 2.4, 2.1, navy);
  color(gold) translate([10.4, -1, 21.1]) rotate([0, 80, 0]) cylinder(h = 0.8, r = 2.2, center = true, $fn = 16);
  ell([2, 1.6, 2.2], [12.4, -1.2, 22], teal);
  ell([0.8, 0.8, 1.2], [11.8, -1.6, 24], teal);
}

// Head: the star, with cream face and big eyes.
translate([0, 0, 33]) {
  puffy_star(10.5, 9, 4.4, 3.4, teal);
  translate([0, 1, 0]) puffy_star(10.1, 8.6, 4, 3.1, tealDark);
  translate([0, -3.8, -0.6]) puffy_star(6.4, 6.8, 1.2, 2.6, cream);
  mirror_x() eye([2.9, -4.9, -0.2], 2.3, iris = navy, sclera = navyHi, pupil = [0.06, 0.06, 0.18], flat = 0.4, yaw = -10);
  color(ink) translate([0, -5.0, -3.6]) rotate([90, 0, 0]) rotate([0, 0, 210]) rotate_extrude(angle = 120, $fn = 14) translate([1, 0]) circle(0.25, $fn = 6);
  // Halo ring, tilted towards the viewer.
  color(halo) rotate([12, 0, 0]) scale([14, 7, 1]) rotate_extrude($fn = 40) translate([1, 0]) scale([0.05, 0.5]) circle(1, $fn = 8);
}
// A few floating sparkles around the head.
sparkle([-13, -2, 36], 1.4, gold);
sparkle([13, -1, 38], 1.2, gold);
sparkle([-11, -1, 41], 1, gold);
