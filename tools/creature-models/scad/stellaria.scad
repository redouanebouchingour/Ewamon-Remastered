// Stellaria: Lumistar ascended. A mint-skinned star spirit with long flowing night-sky hair crowned with gold stars,
// a navy gown traced with a gold constellation, teal-edged trailing sleeves of cloth, slender arms held out.
include <lib.scad>

mint = [0.62, 0.86, 0.72];
mintDark = [0.45, 0.7, 0.6];
night = [0.17, 0.2, 0.42];
nightHi = [0.26, 0.3, 0.55];
hairPurple = [0.32, 0.22, 0.5];
tealEdge = [0.3, 0.62, 0.6];
gold = [1, 0.88, 0.5];
eyeWhite = [0.96, 0.94, 1];
eyeIris = [0.6, 0.3, 0.7];

module star5(r, th, c) {
  color(c) linear_extrude(height = th, center = true)
    polygon([for (i = [0 : 9]) let(a = 90 + i * 36, rr = i % 2 == 0 ? r : r * 0.45) [rr * cos(a), rr * sin(a)]]);
}
module sparkle(p, s, c) {
  color(c) translate(p) for (r = [0, 90]) rotate([0, r, 0]) scale([s * 0.28, s * 0.28, s]) sphere(1, $fn = 8);
}

// Legs: slender mint legs below the gown, toes pointed.
mirror_x() chain([[2, 0, 15], [2.2, -0.5, 7], [2.6, -1.4, 0.8]], [1.5, 1.1, 0.6], mint);

// Gown: a navy bell from the waist, flared and wavy at the hem.
color(night) hull() {
  translate([0, 0, 25]) scale([3.6, 3, 2]) sphere(1, $fn = 24);
  translate([0, 0, 9]) scale([7, 5.6, 1]) sphere(1, $fn = 32);
}
// Wavy teal hem petals.
for (a = [0 : 30 : 330]) color(tealEdge) translate([7 * cos(a), 5.6 * sin(a), 8.6]) rotate([0, 0, a]) scale([0.8, 2.2, 1.4]) sphere(1, $fn = 12);
// Gold constellation on the front of the gown: star dots joined by thin lines.
cons = [[-3.2, -4.4, 20], [-1.4, -5.2, 16.6], [1.6, -5.8, 14.4], [3.4, -6.2, 11], [0.4, -6.6, 11.4], [-2.6, -6.4, 12.6]];
for (i = [0 : len(cons) - 2]) limb(cons[i], cons[i + 1], 0.18, 0.18, gold);
for (p = cons) sparkle(p - [0, 0.3, 0], 1.0, gold);
// The same on the back.
for (i = [0 : len(cons) - 2]) limb([cons[i][0], -cons[i][1], cons[i][2]], [cons[i + 1][0], -cons[i + 1][1], cons[i + 1][2]], 0.18, 0.18, gold);
for (p = cons) sparkle([p[0], -p[1] + 0.3, p[2]], 1.0, gold);

// Torso and neck.
color(night) translate([0, 0, 27]) scale([3.4, 2.6, 3.4]) sphere(1, $fn = 20);
limb([0, 0, 29], [0, -0.3, 32], 1.2, 1.1, mint);
// Teal bow at the throat with a gold star.
mirror_x() color(tealEdge) translate([1.6, -2.4, 30]) rotate([0, 30, 0]) scale([1.8, 0.8, 1]) sphere(1, $fn = 12);
translate([0, -2.9, 30]) rotate([90, 0, 0]) star5(1.6, 0.6, gold);

// Flowing cape-sleeves: navy sheets falling from the shoulders and flaring out to wavy teal edges.
mirror_x() {
  color(night) hull() {
    translate([3, 0, 30]) sphere(1, $fn = 10);
    translate([8, 1, 18]) scale([2, 1, 1]) sphere(1, $fn = 10);
    translate([13, 1.5, 9]) scale([1.6, 0.8, 2]) sphere(1, $fn = 10);
    translate([7, 2.5, 6]) scale([2, 0.8, 1]) sphere(1, $fn = 10);
  }
  for (z = [7, 11, 15]) color(tealEdge) translate([13.6 - (15 - z) * 0.1, 1.5, z]) scale([1.2, 1, 2]) sphere(1, $fn = 10);
  color(tealEdge) translate([10, 2.4, 6.6]) scale([3, 0.9, 1.1]) sphere(1, $fn = 12);
}

// Arms held out wide, slightly down.
mirror_x() {
  limb([3, -0.3, 29.5], [8.5, -1.4, 27.5], 1.1, 0.9, mint);
  limb([8.5, -1.4, 27.5], [13.5, -2, 27.2], 0.9, 0.7, mint);
  ell([1.3, 0.6, 0.9], [14.6, -2, 27.2], mint);
  for (a = [-30, 0, 30]) limb([15, -2, 27.2], [15 + cos(a) * 1.6, -2.2, 27.2 + sin(a) * 1.6], 0.3, 0.2, mint);
}

// Head (big, chibi).
ell([5, 4.6, 5.6], [0, -0.6, 37], mint);
// Big white eyes with purple irises.
mirror_x() eye([2.1, -4.6, 37], 1.75, iris = eyeIris, sclera = eyeWhite, pupil = [0.25, 0.08, 0.35], yaw = -22, flat = 0.5);
color(mintDark) translate([0, -5.1, 34]) scale([0.9, 0.3, 0.25]) sphere(1, $fn = 10);
// Forehead gem diamond.
color(tealEdge) translate([0, -4.6, 41]) rotate([0, 45, 0]) scale([1, 0.4, 1]) cube(1.6, center = true);

// Hair: a dark night-sky mass behind and around the head, falling in waves to the hips.
color(hairPurple) translate([0, 1.2, 39]) scale([5.8, 5, 5]) sphere(1, $fn = 24);
color(night) hull() {
  translate([0, 2.6, 37]) scale([5.8, 3.4, 4]) sphere(1, $fn = 20);
  translate([0, 4.4, 17]) scale([4.6, 2, 2]) sphere(1, $fn = 20);
}
mirror_x() {
  chain([[5, 0, 37], [6.6, 1.2, 31], [7.4, 2.2, 24], [6.6, 3, 17]], [2, 2, 1.6, 0.6], night);
  chain([[3.8, 2.4, 33], [8.6, 3, 26], [9.6, 3.6, 19], [8.4, 4.6, 14]], [1.6, 1.6, 1.2, 0.4], nightHi);
}
// Night sparkles in the hair.
for (p = [[-3, 6.4, 31], [2.4, 6.4, 26], [-1.6, 6.6, 21], [3.4, 6.2, 34], [-3.6, 6.4, 25], [1.6, 6.6, 19], [0, 6.2, 29]]) sparkle(p, 1.2, gold);

// Crown: gold stars ringed around the top of the head.
for (a = [-80 : 32 : 260]) {
  r = 6;
  translate([r * cos(a), 0.4, 39 + 4.8 * sin(min(170, max(10, a))) + 0.8])
    translate([0, 0, 0]) rotate([90, 0, 0]) rotate([0, 0, a]) star5(1.6, 1.0, gold);
}
// Star on the top.
translate([0, 0, 45.4]) rotate([90, 0, 0]) star5(2.2, 1.2, gold);
