// Burrowyrm: a little orange sand wyrm poking up out of a dirt mound: a ringed yellow belly, a yellow snout and eye
// mask, big violet eyes, violet crystal horns and a row of crystal spikes down its back.
include <lib.scad>

orange = [0.88, 0.42, 0.14];
orangeDk = [0.74, 0.32, 0.1];
yellow = [0.97, 0.7, 0.25];
yellowDk = [0.8, 0.52, 0.16];
crystal = [0.45, 0.3, 0.7];
crystalHi = [0.92, 0.88, 1];
dirt = [0.82, 0.6, 0.28];
dirtDk = [0.66, 0.46, 0.2];
irisC = [0.42, 0.26, 0.62];

// Neck/body column rising from the mound, leaning back a little.
blob([[[9.4, 8.6, 3], [0, 1, 5]], [[8.2, 7.6, 4], [0, 1, 14]], [[6.4, 6, 4], [0, 0, 21]]], orange);
// Ringed yellow belly down the front.
blob([[[6.4, 3.6, 3], [0, -5, 5]], [[5.8, 3.6, 4], [0, -4.4, 14]], [[4.6, 3.4, 4], [0, -4.2, 21]]], yellow);
for (z = [7 : 3.2 : 23]) color(yellowDk) translate([0, -5.4, z]) scale([5.4, 2.9, 0.24]) sphere(1, $fn = 20);

// Head: big round head with a broad yellow snout pushing forward.
ell([10.6, 9.2, 8.8], [0, -1.6, 31.5], orange);
blob([[[7, 4, 4.6], [0, -8, 27.6]], [[6, 3.4, 3.6], [0, -13, 27]]], yellow);
// Nostrils and smile.
mirror_x() ell([0.55, 0.4, 0.7], [2, -16.2, 27.8], [0.3, 0.16, 0.06]);
// Smile: a thin dark curve along the side of the snout.
mirror_x() color([0.35, 0.18, 0.06]) hull() {
  translate([1.6, -15.6, 24.6]) sphere(0.2, $fn = 6);
  translate([6, -10.8, 25.2]) sphere(0.2, $fn = 6);
}
// Yellow masks round the eyes, then big violet eyes.
mirror_x() {
  color(yellow) translate([5.2, -8.6, 33.4]) rotate([0, 0, -32]) scale([3.8, 1.4, 4]) sphere(1, $fn = 18);
  eye([5.3, -9.5, 33.6], 2.8, iris = irisC, pupil = [0.18, 0.1, 0.3], yaw = -30);
}

// Crystal horns on the head.
module crystal_spike(p, d, r) {
  spike(p, d, r, 0.05, crystal);
  // White glint facet.
  color(crystalHi) translate(p + d * 0.35) rotate(_dir_rot(d)) translate([0, -r * 0.45, 0]) scale([0.3, 0.2, 1]) sphere(r * 0.7, $fn = 8);
}
mirror_x() crystal_spike([5.8, -0.6, 38.4], [1, 0.4, 5], 2.1);

// Crystal spikes down the back of the neck.
for (s = [[7.4, 30, 2.4, 3.6], [6.8, 22, 2.3, 3.4], [8, 14.5, 2.2, 3.2], [8.8, 7.5, 2, 3]])
  crystal_spike([0, s[0], s[1]], [0, s[3], s[3] * 0.9], s[2]);

// Dirt mound: a ring of rounded clods round the base.
color(dirt) translate([0, 0.5, 0]) scale([13, 12, 3.6]) sphere(1, $fn = 32);
for (a = [0 : 24 : 359]) let(r = 11 + 1.5 * sin(a * 3)) {
  ell([3.8, 3.4, 3], [cos(a) * r, sin(a) * r * 0.92 + 0.5, 2.2 + 0.6 * cos(a * 2)], (a / 24) % 2 == 0 ? dirt : dirtDk);
}
for (p = [[-16, -7, 0.6], [15, -9, 0.5], [-7, -16, 0.5], [17, 4, 0.6]]) ell([1, 1, 0.7], p, dirtDk);
