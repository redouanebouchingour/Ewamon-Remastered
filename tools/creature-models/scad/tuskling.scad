// Tuskling: a baby woolly mammoth. Shaggy brown fur, a cap of icy-blue snow over its head and shoulders, big blue
// eyes ringed in cream, a trunk curled up high, two stubby ice tusks, round ears, short stumpy legs, a tufted tail.
include <lib.scad>

fur = [0.55, 0.33, 0.18];
furDk = [0.42, 0.24, 0.12];
furLt = [0.65, 0.42, 0.24];
snow = [0.72, 0.86, 0.95];
snowLt = [0.85, 0.93, 0.99];
ice = [0.55, 0.78, 0.95];
cream = [0.95, 0.85, 0.6];
nail = [0.3, 0.3, 0.33];

// Body: a round barrel, low.
blob([[[9, 10, 7.5], [0, 4, 12]], [[8, 6, 6.5], [0, -1, 12]]], fur);
// Shaggy fringe hanging off the belly and flanks: short downward fur points.
for (i = [0 : 19]) {
  a = i * 18;
  spike([8.2 * sin(a), 3.5 - 9 * cos(a), 9.5], [0.8 * sin(a), -0.8 * cos(a), -2.6 - (i % 2)], 1.6, 0.2, (i % 2 == 0) ? furDk : fur);
}

// Legs: four short thick stumps with dark toenails.
for (p = [[5, -2], [-5, -2], [5, 9], [-5, 9]]) {
  limb([p[0], p[1], 8], [p[0], p[1], 2.2], 2.8, 2.6, fur);
  for (t = [-1, 0, 1]) ell([0.8, 0.7, 0.8], [p[0] + t * 1.3, p[1] - 2.3, 0.8], nail);
}
// Tail with a dark tuft.
limb([0, 13.5, 13], [0, 15.5, 9.5], 0.8, 0.6, fur);
ell([1.2, 1.2, 1.6], [0, 15.8, 8.6], furDk);

// Head: big and round, at the front.
blob([[[8.5, 7.5, 8], [0, -5, 17.5]], [[5.5, 4.5, 4.5], [0, -9.5, 14.5]]], fur);
// Round ears on the sides, darker inside.
mirror_x() {
  color(fur) translate([7.6, -3, 17.5]) rotate([0, 0, 25]) scale([2.5, 1.2, 3.2]) sphere(1, $fn = 20);
  color(furDk) translate([7.9, -4, 17.5]) rotate([0, 0, 25]) scale([1.6, 0.6, 2.2]) sphere(1, $fn = 16);
}
// Big blue eyes in a cream ring.
mirror_x() {
  color(cream) translate([3.6, -10.6, 18.3]) rotate([0, 0, -25]) scale([2.6, 1, 2.8]) sphere(1, $fn = 20);
  eye([3.6, -10.9, 18.3], 2, iris = [0.15, 0.45, 0.85], pupil = [0.05, 0.12, 0.3], sclera = [0.75, 0.88, 1], yaw = -25);
}
// Trunk: starting between the eyes, hanging forward then curling up and over to the viewer's left.
chain([[0, -11.5, 14.5], [-0.5, -13.8, 11.5], [-3, -15.2, 10.5], [-6, -15, 12.5], [-7.8, -14, 16.5], [-8, -12.6, 20.5],
       [-7, -12.2, 22]],
      [2.6, 2.2, 1.9, 1.7, 1.5, 1.4, 1.2], fur);
color(furDk) translate([-6.8, -12.4, 22.6]) sphere(0.9, $fn = 10);
// Little ice tusks either side of the trunk.
mirror_x() color(ice) hull() {
  translate([3, -11.5, 13]) sphere(1.3, $fn = 12);
  translate([4, -14.5, 12]) sphere(0.6, $fn = 10);
}
// Shaggy cheek fur.
mirror_x() spike([6, -7, 14], [1, -1, -3], 2, 0.2, furLt);

// Snow cap: a shell hugging the top of the head, its lower edge dripping into icicle points.
module headShape() hull() {
  translate([0, -5, 17.5]) scale([8.5, 7.5, 8]) sphere(1, $fn = 32);
  translate([0, -9.5, 14.5]) scale([5.5, 4.5, 4.5]) sphere(1, $fn = 24);
}
color(snow) intersection() {
  translate([0, -5, 17.5]) scale(1.08) translate([0, 5, -17.5]) headShape();
  union() {
    translate([0, -5, 20]) rotate([-12, 0, 0]) translate([0, 0, 10]) cube([30, 30, 20], center = true);
    for (i = [0 : 17]) {
      a = i * 20;
      front = cos(a) > 0.6;
      len = front ? 1.2 : ((i % 3 == 0) ? 4 : ((i % 3 == 1) ? 2.6 : 1.8));
      translate([10 * sin(a), -5 - 10 * cos(a), 20.05 + 2.13 * cos(a)]) rotate([180, 0, 0]) rotate([0, 0, -a]) linear_extrude(len, scale = 0.05) scale([1, 2.5]) circle(1.6, $fn = 4);
    }
  }
}
// Snow spilling onto the shoulders and the top of the back.
color(snow) intersection() {
  hull() {
    translate([0, 4, 12]) scale([9.4, 10.4, 7.9]) sphere(1, $fn = 32);
    translate([0, -1, 12]) scale([8.4, 6.4, 6.9]) sphere(1, $fn = 28);
  }
  union() {
    translate([0, 0, 27.5]) cube([30, 40, 20], center = true);
    for (i = [0 : 9]) {
      x = -8 + i * 1.8;
      translate([x, 0, 17.55]) rotate([180, 0, 0]) linear_extrude((i % 2 == 0) ? 3 : 1.8, scale = 0.05) scale([1, 9]) circle(1.2, $fn = 4);
    }
  }
}
