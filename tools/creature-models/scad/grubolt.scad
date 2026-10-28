// Grubolt: a steel-blue armoured grub reared up on stubby legs, its plated back curling down into a drill-bit tail,
// a pale grey head with beady black eyes and little mandibles.
include <lib.scad>

plate = [0.42, 0.52, 0.62];
plateHi = [0.58, 0.68, 0.78];
seam = [0.22, 0.27, 0.33];
under = [0.6, 0.62, 0.66];
underDark = [0.42, 0.44, 0.48];
head = [0.55, 0.6, 0.66];
drill = [0.5, 0.55, 0.62];
drillDark = [0.3, 0.33, 0.38];

// Body segments along a curve: from the head (front, high) down and back to the tail (rear, low).
// [y, z, rx, ry, rz, tilt]
segs = [[-1, 22, 9.4, 8.2, 5.4, -30], [0.5, 17, 10, 8.8, 5.6, -15], [1.5, 11.5, 10, 9, 5.6, 0],
        [3.5, 6.5, 9, 8.4, 5, 25], [7.5, 4, 7.4, 7, 4.4, 55], [11.5, 3.5, 5.8, 5.6, 3.6, 75]];
for (i = [0 : len(segs) - 1]) {
  s = segs[i];
  // Dark seam ring under each plate.
  color(seam) translate([0, s[0], s[1]]) rotate([s[5], 0, 0]) scale([s[2] * 0.92, s[3] * 0.92, s[4] * 1.12]) sphere(1, $fn = 28);
  color(plate) translate([0, s[0] + 0.6, s[1] + 0.4]) rotate([s[5], 0, 0]) scale([s[2], s[3], s[4] * 0.88]) sphere(1, $fn = 28);
}
// Plated top over the head (a hood-like front plate).
color(plateHi) translate([0, -2, 26]) rotate([-40, 0, 0]) scale([8.6, 7.4, 4.6]) sphere(1, $fn = 28);

// Pale ribbed belly on the front face of the body.
for (z = [6 : 3.4 : 18])
  color(z % 2 < 1 ? under : underDark) translate([0, -5.6 + (z - 12) * 0.08, z]) scale([5.6, 3, 1.9]) sphere(1, $fn = 20);

// Head poking out under the front plate.
blob([[[5.6, 4.6, 4.4], [0, -6.5, 22]], [[3.4, 3, 2.8], [0, -10.5, 20.5]]], head);
mirror_x() {
  eye([3.2, -9.6, 23], 1.3, iris = [0.05, 0.05, 0.08], pupil = [0.05, 0.05, 0.08], sclera = [0.85, 0.87, 0.9], yaw = -30);
  // Mandibles.
  chain([[1.6, -12.5, 19.6], [2.2, -13.6, 18.2], [1.2, -14, 17]], [0.7, 0.55, 0.25], underDark);
}
color(seam) translate([0, -13.2, 20.2]) scale([1.5, 0.5, 0.4]) sphere(1, $fn = 12);

// Little forelegs on the chest and two pairs of stubby walking legs.
mirror_x() {
  chain([[4.6, -5, 16], [6.4, -8, 14.5], [5.4, -10, 15.5]], [1.1, 0.9, 0.6], underDark);
  chain([[4.8, -5, 12], [6.6, -8, 10.8], [5.6, -9.8, 11.6]], [1.1, 0.9, 0.6], underDark);
  limb([5, -3.5, 5], [5.6, -4.2, 1.2], 2, 1.6, under);
  ell([2, 2.4, 1.1], [5.6, -4.8, 1.1], underDark);
  limb([5.6, 3, 4], [6.2, 2.8, 1.2], 1.8, 1.4, under);
}

// Drill tail: a ridged cone pointing up and back.
translate([0, 14, 4.6]) rotate([-38, 0, 0]) {
  color(drillDark) cylinder(h = 2, r = 3.6, $fn = 20);
  for (k = [0 : 4]) color(k % 2 == 0 ? drill : drillDark) translate([0, 0, 1.6 + k * 2.2])
    cylinder(h = 2.4, r1 = 3.4 - k * 0.66, r2 = 2.9 - k * 0.66, $fn = 16);
  color(drill) translate([0, 0, 12.4]) cylinder(h = 2, r1 = 0.5, r2 = 0.05, $fn = 12);
}
