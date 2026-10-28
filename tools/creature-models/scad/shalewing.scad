// Shalewing: a slate-grey baby pterosaur hatching from a spotted tan egg, a shell cap on its head, an orange beak and
// little bat wings with tan membranes.
include <lib.scad>

slate = [0.3, 0.33, 0.4];
slateHi = [0.4, 0.43, 0.5];
shell = [0.68, 0.56, 0.4];
shellIn = [0.55, 0.44, 0.3];
spot = [0.47, 0.37, 0.27];
membrane = [0.7, 0.57, 0.4];
beak = [0.93, 0.55, 0.16, NOGLOW];
beakDark = [0.7, 0.35, 0.08];
claw = [0.8, 0.68, 0.5];

// Eggshell piece: a hollow egg band between z0 and z1 with a zigzag edge of teeth on the open side.
module shellPart(r, c, z0, z1, teethUp, n = 11) {
  color(shell) difference() {
    translate(c) scale(r) sphere(1, $fn = 36);
    translate(c) scale(r - [0.8, 0.8, 0.8]) sphere(1, $fn = 36);
    translate([-50, -50, teethUp ? z1 : z0 - 100]) cube([100, 100, 100]);
  }
  // Teeth around the rim.
  zr = teethUp ? z1 : z0;
  k = sqrt(max(0.01, 1 - pow((zr - c[2]) / r[2], 2)));
  for (i = [0 : n - 1]) {
    a = i * 360 / n;
    p = [c[0] + r[0] * k * cos(a) * 0.95, c[1] + r[1] * k * sin(a) * 0.95, zr];
    color(shell) translate(p) rotate([0, 0, a]) scale([0.5, 1.6, 1]) rotate([teethUp ? 0 : 180, 0, 0]) cylinder(h = 2.6, r1 = 1, r2 = 0.05, $fn = 4);
  }
}

// Body inside the egg (only the chest shows above the rim).
ell([7, 6, 8], [0, 0, 14], slate);

// Lower eggshell with spots.
shellPart([10, 9, 11], [0, 0, 11], 0, 15, true);
for (s = [[200, 10], [240, -10], [300, 5], [330, -15], [20, 0], [100, -8], [150, 6], [60, 12], [270, 20]])
  color(spot) translate([0, 0, 11]) rotate([0, 0, s[0]]) rotate([0, -s[1], 0]) translate([0, 0, 0]) translate([10, 0, 0]) scale([0.3, 1.1, 1]) sphere(1, $fn = 10);

// Feet poking out under the egg.
mirror_x() {
  ell([2.4, 3.4, 1.4], [5, -4, 1.2], slate);
  for (a = [-30, 0, 30]) spike([5 + sin(a) * 1.4, -7, 0.8], [sin(a) * 0.5, -1.1, -0.4], 0.45, 0.05, claw);
}

// Neck and a big baby head.
limb([0, 0, 18], [0, -1, 23], 4.4, 4.6, slate);
ell([8, 7.4, 7.2], [0, -1, 27.5], slate);
ell([5, 2, 3], [0, -5.4, 21.5], slateHi);
// Shell cap on the head, tilted back a little.
translate([0, 0.5, 28]) rotate([-12, 0, 0]) translate([0, 0, -28]) {
  shellPart([8.8, 8.2, 9.4], [0, 0, 28], 30, 45, false, 10);
  color(spot) for (s = [[0, 30], [120, 20], [220, 40], [300, 25], [60, 50]]) translate([0, 0, 28]) rotate([0, 0, s[0]]) rotate([0, -s[1], 0]) translate([8.7, 0, 0]) scale([0.3, 1.1, 1.1]) sphere(1, $fn = 10);
}

// Big orange beak pointing forward and down, open, with a darker lower jaw and a tiny tooth.
color(beak) hull() {
  translate([0, -6.2, 26.8]) scale([3.6, 1.8, 2.8]) sphere(1, $fn = 16);
  translate([0, -15.5, 23.4]) sphere(0.6, $fn = 10);
}
color(beakDark) hull() {
  translate([0, -6.2, 23.4]) scale([2.8, 1.8, 1.4]) sphere(1, $fn = 14);
  translate([0, -12, 21.2]) sphere(0.6, $fn = 10);
}
color("white") spike([1.4, -8.4, 24.6], [0, 0, -1.2], 0.4, 0.05);
// Big brown-orange eyes above the beak.
mirror_x() eye([4.8, -6, 27.8], 2.3, iris = [0.72, 0.4, 0.12], pupil = [0.15, 0.08, 0.04], yaw = -30);

// Wings: grey arm bone up to a tan wrist claw, a long finger down to the tip, a tan membrane between.
module wing() {
  sh = [5, 0, 19]; wr = [12, 1, 27]; tip = [19, 2, 9]; base = [7, 1.5, 15];
  color(membrane) hull() {
    translate(sh) sphere(0.4, $fn = 8);
    translate(wr) sphere(0.4, $fn = 8);
    translate(tip) sphere(0.3, $fn = 8);
    translate(base) sphere(0.3, $fn = 8);
  }
  limb(sh, wr, 1.4, 1.1, slate);
  chain([wr, [17, 1.6, 20], tip], [1.1, 0.9, 0.3], slate);
  spike(wr, [-0.5, -0.4, 2.4], 0.7, 0.1, claw);
}
mirror_x() wing();
