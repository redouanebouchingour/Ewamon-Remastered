// Mesadrake: a low, heavy crawling drake: violet back over a sandy-yellow face and belly, three rust-red mesa buttes
// rising from its spine, stubby yellow horns, pale claws and a long violet tail; dust swirls round its feet.
include <lib.scad>

violet = [0.52, 0.3, 0.68];
violetDk = [0.4, 0.22, 0.55];
yellow = [0.9, 0.68, 0.3];
yellowDk = [0.78, 0.56, 0.22];
mesa = [0.78, 0.33, 0.13];
mesaDk = [0.6, 0.24, 0.09];
mesaTop = [0.85, 0.42, 0.18];
claw = [0.96, 0.9, 0.78];
dust = [0.98, 0.78, 0.45, NOGLOW];

// Body: long and low, violet above, yellow below.
blob([[[9.5, 8.5, 6], [0, -2, 10]], [[8.5, 8, 5.5], [0, 7, 9.5]], [[6, 6, 4.5], [0, 14, 8]]], violet);
blob([[[8.6, 8, 4], [0, -2, 7.2]], [[7.6, 7.4, 3.6], [0, 7, 6.6]]], yellow);
// Yellow flank patches licking up into the violet.
for (p = [[8, 0, 9], [8.2, 6, 8.5], [-8, 0, 9], [-8.2, 6, 8.5], [6.6, -6.5, 10]]) ell([1.8, 2.8, 2.6], p, yellow);

// Mesa buttes on the spine: flat-topped rust stumps with vertical fissures, big at the shoulders, smaller behind.
module butte(p, r, h) {
  translate(p) {
    color(mesa) cylinder(h = h, r1 = r * 1.12, r2 = r, $fn = 24);
    color(mesaTop) translate([0, 0, h]) scale([1, 1, 0.22]) sphere(r, $fn = 24);
    // Fissures down the sides.
    color(mesaDk) for (a = [0 : 45 : 359]) rotate([0, 0, a + 10]) translate([r * 1.02, 0, h * 0.15]) scale([0.3, 0.45, 1]) cylinder(h = h * 0.75, r = 1, $fn = 6);
  }
}
butte([0, -1, 13], 6, 7);
butte([0, 7.5, 12.5], 4.2, 5.5);
butte([0, 13.5, 10.5], 3, 4.5);

// Head, scaled up round the neck so it reads big like the sprite.
translate([0, -9, 9]) scale(1.3) translate([0, 9, -9]) {
// Head: broad and flat, violet crown over a yellow face.
blob([[[6.6, 5.6, 4.6], [0, -12.5, 9.5]], [[5, 4, 3.4], [0, -17, 8]]], yellow);
color(violet) hull() {
  translate([0, -11, 12]) scale([6, 4.6, 2.6]) sphere(1, $fn = 20);
  translate([0, -15, 11]) scale([3, 2.6, 1.6]) sphere(1, $fn = 14);
}
// Stubby yellow horns.
mirror_x() spike([4.4, -10.5, 13.2], [1.2, 1.4, 3.2], 1.2, 0.15, yellow);
// Eyes: dark violet, set into the yellow face.
mirror_x() eye([3.3, -18.9, 10], 1.8, iris = [0.3, 0.14, 0.38], pupil = [0.1, 0.05, 0.12], yaw = -22);
// Nostrils and mouth.
mirror_x() ell([0.4, 0.3, 0.4], [1.4, -20.8, 8.6], [0.35, 0.2, 0.08]);
mirror_x() color([0.35, 0.2, 0.08]) hull() {
  translate([0.6, -20.6, 6.6]) sphere(0.2, $fn = 6);
  translate([4.4, -16, 6.6]) sphere(0.2, $fn = 6);
}
}

// Legs: thick, splayed crawling legs with yellow knees and pale claws.
module leg(x, y, front) {
  color(violet) hull() {
    translate([x * 0.8, y, 9]) sphere(3.2, $fn = 14);
    translate([x * 1.25, y - 1, 5.5]) sphere(2.6, $fn = 14);
  }
  limb([x * 1.25, y - 1, 5.5], [x * 1.3, y - 2, 1.6], 2.4, 2, yellow);
  ell([2.6, 3, 1.4], [x * 1.3, y - 2.8, 1.4], yellow);
  for (a = [-25, 0, 25]) spike([x * 1.3 + sin(a) * 1.8, y - 5.4, 1], [sin(a) * 0.5, -1.4, -0.3], 0.55, 0.06, claw);
}
mirror_x() { leg(8, -6, true); leg(8, 8, false); }

// Long violet tail sweeping out to the viewer's right and curling.
mirror([1, 0, 0]) {
chain([[0, 14, 7.5], [-3, 20, 5], [-8, 24, 3], [-13, 24.5, 2], [-16, 21.5, 1.6]], [4.6, 3.6, 2.6, 1.7, 0.8], violet);
chain([[0, 14, 5.5], [-3, 20, 3.4], [-8, 23.6, 1.8]], [3.4, 2.4, 1.4], yellowDk);
}

// Dust swirls on the ground.
for (s = [[-14, -14, 0, 4], [13, -12, 40, 3.5], [16, 6, 120, 4], [-15, 8, 200, 3]])
  color(dust) translate([s[0], s[1], 0.4]) rotate([0, 0, s[2]]) rotate_extrude(angle = 140, $fn = 16) translate([s[3], 0]) scale([1, 0.5]) circle(0.6, $fn = 6);
