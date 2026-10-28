// Dunescale: Burrowyrm grown legs: a sandy four-legged lizard with a nose horn, violet-striped crystal frills on its
// cheeks, a shell of rounded rust-brown boulder plates on its back, violet leg bands and a crystal tail tip.
include <lib.scad>

// Brow ridge over an eye at p (size s, same yaw), overhanging its front; the inner end drops `drop` (share of s)
// towards the nose so the face itself scowls.
module brow(p, s, drop, c, yaw = 0) {
  color(c) translate(p) rotate([0, 0, yaw]) hull() {
    translate([s * 1.0, s * 0.1, s * 0.8]) scale([s * 0.55, s * 0.62, s * 0.42]) rotate([0, 90, 0]) sphere(1, $fn = 12);
    translate([-s * 0.8, -s * 0.12, s * (0.7 - drop)]) scale([s * 0.55, s * 0.62, s * 0.4]) rotate([0, 90, 0]) sphere(1, $fn = 12);
    // Sealed back over the eye's top so no sclera shows above the ridge.
    translate([s * 0.1, s * 0.2, s * 0.95]) scale([s * 1.05, s * 0.75, s * 0.5]) rotate([0, 90, 0]) sphere(1, $fn = 12);
  }
}

sand = [0.88, 0.6, 0.25];
sandHi = [0.95, 0.72, 0.36, NOGLOW];
sandDk = [0.74, 0.48, 0.18];
plate = [0.72, 0.36, 0.14];
plateDk = [0.58, 0.28, 0.1];
violet = [0.5, 0.25, 0.72];
crystalHi = [0.95, 0.92, 1];
claw = [0.96, 0.92, 0.82];

// Body: a long barrel.
blob([[[8.4, 8, 7], [0, 0, 12]], [[7, 7, 6.4], [0, 7, 12]], [[6.4, 6, 6], [0, -6, 13]]], sand);
// Pale belly.
ell([6.2, 9, 3.4], [0, 0, 6.8], sandHi);

// Boulder plates on the back: rounded rust stones, big along the spine, smaller down the flanks and tail.
stones = [[0, -3, 22, 4.8], [0, 2.5, 23, 5], [0, 8, 21, 4.2], [0, 12.5, 18, 3.4],
          [-4.6, -1, 18.6, 3.6], [4.6, -1, 18.6, 3.6], [-4.8, 5, 18.6, 3.6], [4.8, 5, 18.6, 3.6],
          [-4, 10.2, 15.4, 2.8], [4, 10.2, 15.4, 2.8], [-7.2, 2, 13.8, 2.6], [7.2, 2, 13.8, 2.6],
          [-7, -3.6, 14.4, 2.4], [7, -3.6, 14.4, 2.4], [-6.4, 7.4, 13.4, 2.4], [6.4, 7.4, 13.4, 2.4],
          [0, -7.6, 18.4, 3]];
for (i = [0 : len(stones) - 1]) let(s = stones[i])
  ell([s[3], s[3], s[3] * 0.8], [s[0], s[1], s[2]], i % 3 == 1 ? plateDk : plate);

// Tail: tapering out behind with a violet crystal tip.
chain([[0, 10, 11], [2, 16, 9], [6, 21, 8], [10, 24, 9]], [5, 3.8, 2.6, 1.6], sand);
for (p = [[1, 16, 13], [5, 20.5, 11]]) ell([2.2, 2.2, 1.8], p, plate);
spike([10, 24, 9], [3, 2.4, 3.2], 1.8, 0.05, violet);
color(crystalHi) translate([11, 24.8, 10.2]) scale([0.3, 1, 0.3]) sphere(1.2, $fn = 8);

// Head, scaled up round its neck joint so it reads big like the sprite.
translate([0, -9, 17.5]) scale(1.25) translate([0, 9, -15]) {
// Head: a wedge-shaped head with a horned snout.
blob([[[6, 5.4, 5.2], [0, -11, 16]], [[4, 4, 3.4], [0, -16, 13.8]], [[2.6, 2.6, 2.4], [0, -19, 13]]], sand);
// Violet stripe across the brow and nose.
color(violet) translate([0, -11.8, 19.4]) rotate([-20, 0, 0]) scale([1.3, 4, 1.2]) sphere(1, $fn = 14);
mirror_x() color(violet) translate([3.4, -15.6, 13.4]) rotate([0, 0, -30]) scale([0.8, 1.6, 1]) sphere(1, $fn = 10);
// Nose horn.
spike([0, -19, 14.6], [0, -2, 3.8], 1.5, 0.15, sandHi);
// Small ear horns.
mirror_x() spike([3.6, -9, 20], [1.2, 1.6, 3], 1.1, 0.1, sandDk);
// Eyes: violet with a white sclera, set high on the head.
mirror_x() {
  eye([3.6, -14.1, 17.3], 2.1, iris = [0.62, 0.3, 0.88], pupil = [0.15, 0.06, 0.2], yaw = 22, lid = 0.36, lid_tilt = 24, lid_c = violet, slit = 0.5);
  brow([3.6, -14.1, 17.6], 1.8, 0.3, sandDk, 22);
}
// Mouth line.
mirror_x() color([0.3, 0.16, 0.06]) hull() {
  translate([0.6, -20.4, 11.8]) sphere(0.2, $fn = 6);
  translate([3.8, -15, 12]) sphere(0.2, $fn = 6);
}
// Cheek frills: violet crystal fans with white streaks, one on each side of the head.
mirror_x() translate([5.6, -9.4, 16.6]) rotate([0, -12, 25]) {
  for (a = [-50 : 25 : 50]) {
    color(violet) hull() {
      sphere(0.9, $fn = 8);
      translate([3.6 * cos(a) + 1.6, 0, 4.4 * sin(a)]) sphere(0.6, $fn = 8);
      translate([4.8 * cos(a + 9) + 1.6, 0, 5 * sin(a + 9)]) sphere(0.25, $fn = 6);
    }
    color(crystalHi) hull() {
      translate([1, -0.4, 0]) sphere(0.25, $fn = 6);
      translate([3.6 * cos(a) + 1.2, -0.5, 4 * sin(a)]) sphere(0.2, $fn = 6);
    }
  }
  // Sand-coloured frill spine.
  limb([0, 0, 0], [3, 0.4, 5], 0.9, 0.3, sand);
}
}

// Legs: four stocky legs with violet bands and pale claws.
module leg(x, y) {
  limb([x, y, 9], [x * 1.05, y, 2], 2.8, 2.6, sand);
  color(violet) translate([x * 1.05, y, 4.6]) cylinder(h = 1.6, r = 2.95, center = true, $fn = 20);
  ell([2.8, 3.4, 1.6], [x * 1.05, y - 0.6, 1.6], sand);
  for (a = [-25, 0, 25]) spike([x * 1.05 + sin(a) * 1.8, y - 3.6, 1], [sin(a) * 0.4, -1.1, -0.3], 0.5, 0.06, claw);
}
mirror_x() { leg(5.8, -5); leg(6, 7); }
// Violet collar stripe on the chest.
color(violet) translate([0, -8.6, 11]) rotate([-55, 0, 0]) scale([4.8, 0.7, 2.2]) sphere(1, $fn = 16);
