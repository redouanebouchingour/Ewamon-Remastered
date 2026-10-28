// Voidraith: a tall wraith in a long purple-black robe, a pale skull under a deep hood with a draped cowl, long
// ragged sleeves ending in bony clawed hands, the robe trailing into tatters, wisps of violet void energy around it.
include <lib.scad>

robe = [0.3, 0.24, 0.38];
robeLt = [0.42, 0.35, 0.5];
robeDk = [0.15, 0.11, 0.2];
void = [0.05, 0.03, 0.08];
bone = [0.86, 0.82, 0.7];
boneDk = [0.55, 0.5, 0.42];
magic = [0.62, 0.3, 0.85];
glow = [0.85, 0.6, 1];

// Robe: a long bell from the shoulders to a flared hem.
color(robe) hull() {
  translate([0, 0.5, 29]) scale([5.5, 4.5, 3]) sphere(1, $fn = 28);
  translate([0, 0.5, 6]) scale([9.5, 8, 1]) sphere(1, $fn = 32);
}
// Vertical folds.
for (a = [-70, -40, -10, 20, 50, 110, 160, 210, 250]) color(robeDk) rotate([0, 0, a - 90]) hull() {
  translate([5, 0, 27]) sphere(0.45, $fn = 8);
  translate([9, 0, 6.5]) sphere(0.75, $fn = 8);
}
// Torn patches showing pale lining.
color(boneDk) translate([-5.5, -5.2, 12]) rotate([0, 20, 20]) scale([0.8, 0.4, 1.8]) sphere(1, $fn = 10);
color(boneDk) translate([4.5, -5.8, 16]) rotate([0, -20, -20]) scale([0.7, 0.4, 1.6]) sphere(1, $fn = 10);
// Ragged hem trailing on the ground.
for (i = [0 : 17]) {
  a = i * 20;
  l = (i % 3 == 0) ? 6 : (i % 2 == 0 ? 4.5 : 3.5);
  color(i % 2 == 0 ? robe : robeDk) rotate([0, 0, a]) hull() {
    translate([8.8, 0, 6.2]) scale([0.7, 2, 0.8]) sphere(1, $fn = 10);
    translate([9.5 + l * 0.35, 0, max(0.3, 6.2 - l)]) sphere(0.25, $fn = 6);
  }
}

// Draped cowl around the shoulders.
color(robeLt) translate([0, -0.5, 30]) scale([7, 5.5, 2.6]) sphere(1, $fn = 28);
color(robeDk) translate([0, -4.8, 28.5]) scale([4, 1.2, 2.5]) sphere(1, $fn = 16);

// Hood with a deep opening and a skull inside.
color(robe) difference() {
  translate([0, 0.5, 35]) scale([5, 5.2, 5.6]) sphere(1, $fn = 32);
  translate([0, -5, 34]) scale([3.4, 3.2, 4]) sphere(1, $fn = 24);
}
spike([0, 1.5, 39.5], [0, 1.5, 2.5], 2, 0.4, robe);
ell([3.2, 2.5, 3.8], [0, -1.5, 34.3], void);
// Skull.
translate([0, -3.6, 34]) {
  color(bone) scale([2.3, 2, 2.6]) sphere(1, $fn = 20);
  color(bone) translate([0, -0.6, -2.2]) scale([1.5, 1.4, 1]) sphere(1, $fn = 16);
  mirror_x() color(void) translate([0.95, -1.75, 0.3]) scale([0.7, 0.4, 0.75]) sphere(1, $fn = 12);
  mirror_x() color(magic) translate([0.95, -2.05, 0.3]) sphere(0.25, $fn = 8);
  color(void) translate([0, -1.95, -0.9]) scale([0.3, 0.3, 0.4]) sphere(1, $fn = 8);
  color(boneDk) for (x = [-0.8 : 0.4 : 0.8]) translate([x, -1.9, -2.3]) cube([0.12, 0.3, 0.7], center = true);
}

// Sleeves and bony clawed hands, reaching out to both sides.
module arm(s) {
  // Sleeve: a widening cone with a ragged cuff.
  color(robe) hull() {
    translate([4.5 * s, 0, 30]) sphere(2.2, $fn = 14);
    translate([10.5 * s, -2.5, 22]) scale([2.6, 2.6, 1.6]) sphere(1, $fn = 14);
  }
  for (k = [0 : 4]) color(robeDk) hull() {
    translate([(10.5 + (k - 2) * 1) * s, -2.5 + (k % 2) * 1.2, 21.5]) sphere(0.5, $fn = 6);
    translate([(10.8 + (k - 2) * 1.2) * s, -2.6 + (k % 2) * 1.2, 18 - (k % 2) * 1.5]) sphere(0.15, $fn = 6);
  }
  // Hand and long claws.
  ell([1.6, 1.3, 1.5], [11.5 * s, -3.5, 20.5], bone);
  for (f = [-2 : 2]) chain([[11.5 * s + f * 0.5, -3.8, 20], [(12.5 + f * 0.3) * s + f * 0.6, -5.5, 18.5 - abs(f) * 0.2],
                             [(13 + f * 0.3) * s + f * 0.9, -6.5, 15.8 - abs(f) * 0.4]], [0.45, 0.38, 0.12], bone);
}
arm(1);
arm(-1);

// Void wisps around the hands and shoulders.
for (w = [[14, -6, 18, 0.7], [15, -4, 21, 0.5], [13, -7, 14, 0.4], [-14, -6, 17, 0.6], [-15.5, -5, 20.5, 0.45],
          [5.5, 2, 39, 0.5], [-6, 1.5, 37, 0.4], [7, -1, 35.5, 0.35], [-9, -6, 9, 0.5], [10, -5, 5, 0.6]]) {
  color(magic) translate([w[0], w[1], w[2]]) sphere(w[3] * 1.4, $fn = 10);
  color(glow) translate([w[0], w[1] - w[3], w[2]]) sphere(w[3] * 0.6, $fn = 8);
}
