// Pyrecap: Cindercap grown up. A red lizard under a two-tier spotted mushroom cap, smoke billowing from charcoal
// shoulder vents, soot-black claws and feet, a fire in its belly and a flame on its tail.
include <lib.scad>

body = [0.82, 0.16, 0.1];
bodyDk = [0.6, 0.1, 0.07];
soot = [0.16, 0.16, 0.18];
smoke = [0.3, 0.3, 0.32];
smokeHi = [0.5, 0.5, 0.52];
capRed = [0.82, 0.14, 0.1];
spot = [0.98, 0.6, 0.25];
gill = [0.78, 0.62, 0.45];
belly = [1, 0.62, 0.15];
bellyCore = [1, 0.92, 0.55];
flameRed = [0.93, 0.2, 0.05];
flameOrange = [1, 0.55, 0.08];
flameCore = [1, 0.9, 0.4];
claw = [0.94, 0.94, 0.92];
dark = [0.08, 0.05, 0.05];

module dome(r, z) {
  scale(r) difference() {
    sphere(1, $fn = 40);
    translate([0, 0, -1.2]) cube(2.4, center = true);
  }
}
module spots(rx, ry, rz, z0, list) {
  for (s = list) {
    az = s[0]; el = s[1]; r = s[2];
    p = [rx * cos(el) * cos(az), ry * cos(el) * sin(az), z0 + rz * sin(el)];
    color(spot) translate(p) rotate([0, 90 - el, az]) scale([1, 1, 0.35]) sphere(r, $fn = 12);
  }
}

// Torso: taller and leaner than Cindercap.
blob([[[7.5, 6.5, 7], [0, 0, 9]], [[6.5, 5.6, 6], [0, -0.5, 16]]], body);
// Belly fire.
ell([4.4, 2.2, 5.4], [0, -5.2, 11], belly);
ell([2.6, 1.4, 3.2], [0, -6.6, 11.5], bellyCore);
for (t = [[-1.5, 14], [1.5, 14.5], [0, 15.5]]) spike([t[0], -5.6, t[1]], [0, -0.2, 2.4], 1.1, 0.1, flameOrange);

// Head with a long snout and a toothy grin.
blob([[[6.8, 6.2, 5.8], [0, -1, 23]], [[4.4, 4.6, 3.8], [0, -6, 21.5]]], body);
ell([3.2, 2.6, 2.2], [0, -9.2, 21], body);
mirror_x() ell([0.35, 0.3, 0.35], [1, -11.4, 21.8], dark);
color(dark) translate([0, -10.4, 19.8]) rotate([90, 0, 0]) scale([2.6, 0.6, 0.45]) cylinder(h = 0.6, r = 1, center = true, $fn = 16);
for (x = [-1.4, 1.4]) spike([x, -10.6, 20.2], [0, 0, -0.9], 0.35, 0.05, claw);
mirror_x() {
  eye([3.3, -6.8, 23.4], 1.7, iris = [1, 0.75, 0.1], pupil = dark, sclera = [1, 0.95, 0.6], yaw = -20);
  color(bodyDk) translate([3.3, -7.4, 25.3]) rotate([0, -20, -18]) scale([2.2, 0.9, 0.7]) sphere(1, $fn = 14);
}

// Two-tier mushroom cap, tilted back off the face.
translate([0, 1.5, 27]) rotate([-10, 0, 0]) {
  color(gill) translate([0, 0, -0.6]) scale([14.6, 13.6, 2]) sphere(1, $fn = 40);
  color(capRed) dome([15.5, 14.5, 5], 0);
  spots(15.5, 14.5, 5, 0, [[0, 15, 1.5], [45, 20, 1.3], [90, 12, 1.5], [135, 22, 1.3], [180, 15, 1.5], [225, 20, 1.4], [270, 14, 1.5], [315, 22, 1.3], [20, 50, 1.2], [110, 50, 1.2], [200, 50, 1.2], [290, 50, 1.2]]);
  translate([0, 0, 4]) {
    color(gill) translate([0, 0, -0.3]) scale([10.2, 9.7, 1.8]) sphere(1, $fn = 32);
    color(capRed) dome([10.5, 10, 6], 0);
    spots(10.5, 10, 6, 0, [[30, 20, 1.3], [100, 25, 1.2], [170, 20, 1.3], [240, 25, 1.2], [310, 20, 1.3], [0, 70, 1.2], [140, 60, 1.1], [260, 60, 1.1]]);
  }
}

// Charcoal shoulder vents puffing smoke.
mirror_x() {
  ell([4, 3.8, 3.5], [8, -0.5, 17.5], soot);
  ell([1.3, 0.8, 1], [8.5, -4.2, 18.5], [1, 0.8, 0.25]);
  for (p = [[11, -1, 19.5, 3.4], [14.5, -1, 20.5, 3.4], [17.5, -0.5, 22, 2.8], [13.5, -2, 23, 2.6], [18, -1.5, 18.8, 2.4], [16, 0.5, 24, 2.2]])
    ell([p[3], p[3], p[3] * 0.85], [p[0], p[1], p[2]], p[2] > 21 ? smokeHi : smoke);
}

// Arms: red upper arms, soot-black forearms with white claws.
mirror_x() {
  limb([7, -1, 16], [9.5, -3.5, 12.5], 2, 1.8, body);
  limb([9.5, -3.5, 12.5], [10, -6.5, 10], 2.1, 2.2, soot);
  for (a = [-30, 0, 30]) spike([10 + sin(a) * 1.4, -8.2, 9.6], [sin(a) * 0.6, -1.4, -0.8], 0.45, 0.05, claw);
}

// Legs: red thighs, soot-black feet with claws.
mirror_x() {
  ell([3.4, 3.6, 4], [4.6, -0.3, 5.4], body);
  blob([[[2.8, 4.2, 1.7], [4.9, -2.2, 1.7]], [[2.4, 2.2, 1.5], [4.9, 0.6, 1.6]]], soot);
  for (a = [-28, 0, 28]) spike([4.9 + sin(a) * 1.6, -6, 1.0], [sin(a) * 0.5, -1.3, -0.4], 0.5, 0.05, claw);
}

// Tail: red with a cream underside, curling out to the right and up into a flame.
chain([[2.5, 4.5, 6], [8, 7.5, 4], [13.5, 7, 5], [16.5, 4.5, 9], [17, 2.5, 13]], [3.2, 2.6, 2, 1.6, 1.3], body);
chain([[8, 6.6, 2.4], [13.5, 6.2, 3.6]], [1.8, 1.4], [1, 0.85, 0.55]);
module tongue(p, d, r, c) {
  color(c) hull() {
    translate(p) sphere(r);
    translate(p + d) sphere(0.15);
  }
}
tongue([17, 2.5, 13.5], [0, -0.5, 8], 2.4, flameRed);
tongue([17.5, 2.5, 13.5], [3.5, 0, 5.5], 1.8, flameRed);
tongue([16.4, 2.5, 13.5], [-3, 0.5, 5.5], 1.8, flameRed);
tongue([17.2, 1.5, 13.5], [1.5, -1.5, 6.5], 1.6, flameOrange);
ell([1.5, 1.5, 2], [17, 1.8, 14.8], flameCore);
