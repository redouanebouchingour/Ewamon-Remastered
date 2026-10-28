// Lumyth: a starry galaxy spirit, a lavender face in swirling violet hair, a gold star halo, moon-marked fairy
// wings, a cape, and a long wavy tail ending in a spiral galaxy.
include <lib.scad>

skin = [0.72, 0.64, 0.95];
skinHi = [0.82, 0.76, 1];
hair = [0.4, 0.25, 0.7];
hairDark = [0.26, 0.16, 0.5];
streak = [0.85, 0.6, 0.95];
streakBlue = [0.6, 0.75, 1];
cape = [0.32, 0.2, 0.6];
capeIn = [0.5, 0.3, 0.75];
wing = [0.84, 0.78, 1];
wingHi = [0.95, 0.8, 1];
moon = [0.98, 0.92, 1];
gold = [1, 0.8, 0.25];
goldDark = [0.85, 0.6, 0.15];
eyeGlow = [0.95, 0.75, 1];
star = [1, 1, 0.92];

// Spiral swirl in the plane normal to Y (facing the camera), turns about centre p, radius R.
module swirl(p, R, turns, r, c, flip = false) {
  n = 18;
  pts = [for (i = [0 : n]) let(t = i / n, a = t * 360 * turns * (flip ? -1 : 1), rr = R * (0.15 + 0.85 * t))
         p + [rr * cos(a), 0, rr * sin(a)]];
  chain(pts, [for (i = [0 : n]) r * (0.4 + 0.6 * i / n)], c);
}

// Four-point sparkle star.
module sparkle(p, s = 0.6) {
  color(star) translate(p) {
    scale([s, s * 0.3, s * 0.3]) sphere(1, $fn = 8);
    scale([s * 0.3, s * 0.3, s]) sphere(1, $fn = 8);
  }
}

// Five-point star (for the halo), lying in the XZ plane facing -Y, radius r.
module star5(r, c) {
  color(c) rotate([90, 0, 0]) linear_extrude(0.8, center = true)
    polygon([for (i = [0 : 9]) let(a = 90 + i * 36, rr = (i % 2 == 0) ? r : r * 0.45) [rr * cos(a), rr * sin(a)]]);
}

// Galaxy orb at the bottom of the tail.
ell([3.6, 3, 3.6], [1, 0, 3.6], hair);
mirror([0, 0, 0]) {
  swirl([1, -2.6, 3.6], 3.2, 1.6, 0.6, streak);
  swirl([1, -2.9, 3.6], 1.6, 1, 0.5, moon);
  translate([0, 5.4, 0]) swirl([1, -2.6, 3.6], 3.2, 1.6, 0.6, streak, true);
}

// Wavy tail rising from the orb to the body, braided in two strands.
chain([[1, 0, 6.5], [-2.5, 0, 9], [-1, 0.5, 12], [2, 0.5, 14], [1, 0, 17]], [2.6, 2.4, 2.4, 2.8, 3.4], hair);
chain([[1.8, -1.6, 6.5], [-1.5, -1.8, 9], [0, -1.6, 12], [2.6, -1.6, 14.5], [1.5, -2, 17]], [0.7, 0.8, 0.8, 0.9, 1], streak);
chain([[0, 1.6, 7], [-3, 1.5, 9.5], [-1.5, 2, 12.5], [1.4, 2, 14.5]], [0.6, 0.7, 0.7, 0.8], streakBlue);

// Flowing robe below the torso, widening into tendrils.
blob([[[3.6, 3, 2], [0, 0, 24]], [[5, 4, 3], [0, 0.4, 19]], [[3, 2.6, 2], [0.6, 0.2, 16]]], hair);
chain([[0, -3.8, 23], [-1, -4.3, 20], [0.2, -4, 17.5]], [0.7, 0.8, 0.7], streak);
chain([[2.4, -3.4, 23], [3.4, -3.6, 20], [2.6, -3.2, 17.5]], [0.5, 0.6, 0.5], streakBlue);
chain([[-2.4, -3.4, 23], [-3.6, -3.4, 20], [-3, -3, 18]], [0.5, 0.6, 0.5], skinHi);

// Cape: a flared shell hanging from the shoulders, deep violet outside with paler swirls on the back.
color(cape) difference() {
  hull() {
    translate([0, 1, 26]) scale([5, 3.5, 1]) sphere(1, $fn = 24);
    translate([0, 2.5, 16]) scale([7.5, 5, 1]) sphere(1, $fn = 28);
  }
  hull() {
    translate([0, 0.2, 26.5]) scale([4.2, 2.8, 1]) sphere(1, $fn = 24);
    translate([0, 1.5, 15]) scale([6.8, 4.4, 1]) sphere(1, $fn = 28);
  }
  translate([0, -10, 10]) cube([30, 12, 30], center = true);
}
swirl([0, 7.2, 20], 3.6, 1.7, 0.6, streak);
swirl([0, 7.4, 20], 1.6, 1, 0.45, moon);
for (p = [[-4, 6, 23], [4.5, 6.5, 18], [-5.5, 6.8, 17], [3, 5.6, 24], [-2, 7.3, 16.5]]) sparkle(p, 0.5);
// Cape hem tendrils.
mirror_x() {
  chain([[6.5, 1, 16], [8.5, 0, 13], [8.5, -0.5, 10], [10, 0, 8]], [0.9, 0.8, 0.6, 0.3], cape);
  chain([[5.5, 4, 15.5], [6.5, 4, 12], [5, 3.6, 9.5]], [0.8, 0.7, 0.3], capeIn);
}

// Torso and arms raised with open palms.
blob([[[2.8, 2.2, 2.6], [0, 0, 25.5]], [[2.2, 1.8, 1.5], [0, 0, 23]]], skin);
mirror_x() {
  limb([2.6, 0, 26.5], [4.6, -1.5, 25], 0.9, 0.8, skin);
  limb([4.6, -1.5, 25], [5.6, -2.5, 27.4], 0.8, 0.7, skin);
  ell([0.9, 0.5, 1.1], [5.8, -2.8, 28.2], skin);
}

// Head: lavender face.
ell([5.4, 4.8, 5], [0, 0, 31.5], skin);

mirror_x() eye([2, -4.4, 31.6], 1.35, iris = eyeGlow, pupil = [0.6, 0.35, 0.9], sclera = [0.35, 0.18, 0.55], yaw = -14);
// Small smile.
color(hairDark) translate([0, -4.75, 29.4]) rotate([90, 0, 0]) scale([0.9, 0.3, 0.3]) cylinder(h = 0.4, r = 1, center = true, $fn = 12);
// Hair: covers back and top, a swoop across the brow, a curl rising to the viewer's right.
blob([[[5.8, 4.8, 5.4], [0, 1.6, 32.4]], [[4.4, 4, 3.5], [0, 2.5, 27.5]]], hair);
ell([5, 3.4, 2.2], [0.6, -1.4, 35.8], hair);
petal([2.8, 1.2, 1.4], [2, -3.6, 35], [0, -20, 0], hair);
swirl([-1.6, -4.2, 35.2], 1.4, 1, 0.3, streak);
chain([[2.6, 1, 36], [5, 1.4, 38.5], [6.6, 1, 37.6], [6, 0.6, 36]], [1.6, 1.2, 0.9, 0.4], hair);
// Side locks falling down past the shoulders.
mirror_x() chain([[4.4, 0.6, 31], [5.4, 0.6, 27.5], [4.6, 0.3, 24], [5.8, 0.4, 21]], [1.6, 1.4, 1.1, 0.5], hairDark);
mirror_x() chain([[4.6, -0.6, 30], [5.8, -0.6, 26.5], [5.2, -0.8, 23.5]], [0.5, 0.5, 0.3], streak);
// Back of hair: swirl and sparkles.
swirl([0, 6.2, 31], 2.8, 1.5, 0.5, streak);
for (p = [[-2.6, 5.4, 34], [3, 5.2, 28.5], [2.2, 5.8, 33.5]]) sparkle(p, 0.45);

// Halo of gold stars.
translate([0, 1.2, 39.5]) rotate([-28, 0, 0]) {
  color(goldDark) rotate_extrude($fn = 32) translate([3.6, 0]) circle(0.35, $fn = 8);
  for (a = [0 : 60 : 359]) translate([3.6 * cos(a), 3.6 * sin(a), 0.4]) rotate([0, 0, a + 90]) star5(1.3, gold);
}

// Fairy wings: translucent lavender leaves with a crescent moon, sweeping up and outward from the back.
module flat(pts, t, c) { color(c) hull() for (q = pts) translate(q) sphere(t, $fn = 8); }
module fairywing() {
  // Upper wing: a long leaf curving up and out; lower wing: a shorter one angled down.
  flat([[3, 4, 28], [7, 4.6, 33], [10.5, 5, 38], [11.5, 5, 35], [9, 4.8, 30], [4, 4.2, 26.5]], 0.3, wing);
  flat([[5, 4.1, 29.5], [8.2, 4.4, 33], [10.2, 4.6, 36], [9.6, 4.4, 32]], 0.35, wingHi);
  flat([[3, 4, 25.5], [8, 4.6, 24], [10.5, 5, 21], [7, 4.6, 22.5], [3.5, 4.2, 24.5]], 0.3, wing);
  // Crescent moon on the upper wing (both faces).
  for (s = [-1, 1]) translate([8.6, 4.75 + s * 0.42, 33]) rotate([90, 0, 0]) color(moon)
    linear_extrude(0.25, center = true) difference() { circle(1.4, $fn = 20); translate([0.7, 0.4]) circle(1.2, $fn = 20); }
  for (s = [-1, 1]) translate([7.6, 4.6 + s * 0.42, 23.5]) rotate([90, 0, 0]) color(moon)
    linear_extrude(0.25, center = true) difference() { circle(0.9, $fn = 16); translate([0.45, 0.25]) circle(0.78, $fn = 16); }
  sparkle([10.2, 4.3, 36.5], 0.45);
  sparkle([6, 4, 30.5], 0.4);
}
mirror_x() translate([3, 0, 28]) rotate([0, 0, 12]) scale([1.5, 1, 1.15]) translate([-3, 0, -28]) fairywing();
// Floating sparkles around.
for (p = [[-8, -1, 24], [8.5, -2, 21], [-6.5, -2, 12], [6, -2, 9]]) sparkle(p, 0.5);
