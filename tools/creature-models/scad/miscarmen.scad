// Miscarmen: a floating pale-lavender ghost head, a swept white hair cap topped with a crown of olive-yellow spiky
// tufts, big yellow eyes with red pupils, a frayed wispy lower edge, and a thin tail trailing to the side that ends
// in two spiky blue starbursts marked with red.
include <lib.scad>

ghost = [0.78, 0.76, 0.92];
ghostDk = [0.62, 0.6, 0.78];
white = [0.97, 0.97, 1];
olive = [0.72, 0.7, 0.24];
oliveLt = [0.88, 0.86, 0.4];
star = [0.62, 0.68, 0.92];
red = [0.85, 0.2, 0.22];
dark = [0.12, 0.1, 0.16];

lift = 7;  // floats off the ground

module burst(p, s) {
  translate(p) {
    color(star) scale([1, 0.6, 1]) sphere(1.9 * s, $fn = 14);
    for (a = [0 : 60 : 359]) spike([0, 0, 0], [4.2 * s * cos(a), 0.6 * sin(a * 2), 4.2 * s * sin(a)], 1.1 * s, 0.08, star);
    color(red) translate([0, -1.4 * s, 0]) rotate([0, 30, 0]) scale([0.3, 0.3, 1]) sphere(1.1 * s, $fn = 8);
  }
}

translate([0, 0, lift]) {
  // Head body: a big round blob, a bit wider than tall.
  color(ghost) translate([0, 0, 10]) scale([10, 9, 8.5]) sphere(1, $fn = 44);
  // Wispy frayed lower edge.
  // Lower body: a soft skirt that narrows into a wispy tail curling back.
  color(ghost) hull() {
    translate([0, 0, 5]) scale([8, 7.5, 3]) sphere(1, $fn = 32);
    translate([0, 1, 0]) scale([5.5, 5, 1.5]) sphere(1, $fn = 24);
  }
  for (a = [0 : 45 : 359]) color(a % 90 == 0 ? ghost : ghostDk) rotate([0, 0, a + 22]) hull() {
    translate([5, 0, 1]) scale([1.6, 2.4, 1.2]) sphere(1, $fn = 12);
    translate([5.8, 0, -1.6 - (a % 90 == 0 ? 1.2 : 0)]) sphere(0.5, $fn = 8);
  }

  // White hair cap sweeping back over the head, with a curl over the forehead.
  color(white) difference() {
    translate([0, 1, 12.5]) scale([10.3, 9.3, 7.6]) sphere(1, $fn = 32);
    translate([0, -9, 6]) rotate([-25, 0, 0]) cube([24, 12, 14], center = true);
    translate([0, 0, 0]) cube([24, 24, 16], center = true);
  }
  chain([[-8, -5.5, 12], [-5, -8.2, 13.6], [-1, -8.6, 13], [2, -7.5, 14.5]], [1.6, 1.5, 1.2, 0.9], white);

  // Crown of olive-yellow spiky tufts.
  tufts = [[-6, -2, 17, 4.5, -30], [-2, -4, 18.5, 4, -10], [2.5, -3, 18.5, 5, 10], [6.5, -1, 17, 4.5, 30],
           [-3.5, 2.5, 19, 4, -15], [3, 3, 19, 4.5, 15], [0, 6, 17.5, 4, 0], [-7, 4, 15, 3.5, -45], [7.5, 4, 15, 3.5, 45]];
  for (t = tufts) translate([t[0], t[1], t[2]]) rotate([0, t[4], 0]) scale(1.45) {
    color(olive) scale([1.6, 1.6, 1]) sphere(1.2, $fn = 12);
    spike([0, 0, 0], [0, 0, t[3]], 1.2, 0.1, olive);
    spike([0, 0, 0.5], [1.4, 0.3, t[3] * 0.7], 0.8, 0.1, oliveLt);
    spike([0, 0, 0.5], [-1.4, -0.3, t[3] * 0.6], 0.8, 0.1, olive);
  }

  // Big yellow eyes with red pupils and dark rims, a hint of a white cheek ruff below.
  mirror_x() {
    color(dark) translate([3.4, -7.6, 8.6]) rotate([0, 0, -22]) scale([2.8, 1.2, 2.3]) sphere(1, $fn = 18);
    translate([3.4, -8.1, 8.6]) rotate([0, 0, -22]) {
      color([0.98, 0.88, 0.12]) scale([2.1, 1, 1.9]) sphere(1, $fn = 20);
      color([0.85, 0.12, 0.32]) translate([-0.5, -0.75, -0.2]) scale([0.9, 0.4, 1.3]) sphere(1, $fn = 14);
      color(white) translate([0.5, -0.9, 0.7]) sphere(0.35, $fn = 8);
    }
    color(white) translate([5.5, -6.3, 5.4]) scale([3, 1.6, 1.2]) sphere(1, $fn = 14);
  }

  // Tail: a thin curling stalk out to the viewer's right ending in two spiky starbursts.
  chain([[7, 4, 4], [11, 5, 2], [14, 3, 3], [16, 0, 6], [17, -1, 9]], [1.2, 0.9, 0.7, 0.6, 0.5], ghostDk);
  burst([17, -1, 9.5], 1.1);
  burst([14.5, 2.5, 3.5], 0.85);
}
