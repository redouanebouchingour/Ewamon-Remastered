// Scorpit: a small tan scorpion with big pale eyes, purple-tipped spikes and a tail arching over into a white venom
// bulb dripping lime-green poison.
include <lib.scad>

tan = [0.78, 0.6, 0.3];
tanDark = [0.6, 0.44, 0.2];
tanHi = [0.88, 0.72, 0.4];
purple = [0.42, 0.18, 0.5];
spikeWhite = [0.95, 0.93, 0.97];
bulb = [0.97, 0.96, 0.95];
venom = [0.7, 0.9, 0.2];
ink = [0.18, 0.1, 0.2];

// A white spike with a purple base (the sprite's crystal studs).
module stud(p, d, r) {
  spike(p, d * 0.45, r, r * 0.75, purple);
  spike(p + d * 0.42, d * 0.58, r * 0.78, 0.05, spikeWhite);
}

// Head-thorax, a broad rounded shell.
blob([[[9, 8, 7.5], [0, -5, 9.5]], [[7, 6, 5.4], [0, 1, 8]]], tan);
ell([5.5, 4, 3], [0, -4, 15], tanHi);
// Abdomen segments running back.
for (i = [0 : 3]) ell([6.4 - i * 0.7, 2.8, 4.6 - i * 0.4], [0, 5 + i * 3.2, 7.4 - i * 0.2], i % 2 == 0 ? tan : tanDark);

// Face: two big pale eyes with purple rims, a small mouth.
mirror_x() {
  ell([3.2, 1.6, 3.6], [3.6, -11.6, 10.4], purple);
  eye([3.6, -12.1, 10.6], 3.0, iris = [0.32, 0.1, 0.38], sclera = [0.97, 0.95, 1], yaw = -18, pupil = [0.12, 0.04, 0.15]);
}
color(ink) translate([0, -12.6, 6.4]) scale([1.6, 0.4, 0.4]) sphere(1, $fn = 12);
// Little brow studs on the head.
stud([0, -6, 16.4], [0, -0.5, 3.2], 1.0);
stud([-3, -9, 15], [-0.6, -1, 2.4], 0.8);

// Back studs along the spine.
for (i = [0 : 3]) mirror_x() stud([2.4, 1 + i * 3.2, 11.6 - i * 0.4], [0.6, 0.4, 3], 0.9);

// Pincers: arm, then a tan crescent claw with a purple inner edge.
module pincer() {
  chain([[6, -6, 8], [12, -9, 7], [14.5, -13, 8.5]], [1.9, 1.6, 1.8], tan);
  // Claw: an open crescent standing upright, purple on the inside.
  translate([15.5, -15.5, 11.5]) rotate([90, 0, 35]) {
    color(tan) rotate([0, 0, -110]) rotate_extrude(angle = 280, $fn = 24) translate([4, 0]) scale([1.3, 1]) circle(1.5, $fn = 12);
    color(purple) rotate([0, 0, -100]) rotate_extrude(angle = 260, $fn = 24) translate([2.7, 0]) circle(0.6, $fn = 8);
  }
}
mirror_x() pincer();

// Legs: four per side, short tan stumps ending in purple-and-white spikes.
mirror_x() for (i = [0 : 3]) {
  y = -4 + i * 4;
  limb([5.5, y, 6], [9.5, y + 0.5, 4.5], 1.4, 1.1, tan);
  spike([9.6, y + 0.5, 4.6], [1, 0, -2], 1.1, 0.8, purple);
  spike([10.4, y + 0.5, 2.8], [0.6, 0, -2.6], 0.85, 0.05, spikeWhite);
}

// Tail: segments arching up from the back and curling forward over the body.
tailPts = [[0, 14, 7], [0, 18, 11], [0, 20, 17], [0, 19.5, 23], [0, 17, 28], [0, 12.5, 31.5], [0, 7, 33]];
tailR = [3.4, 3.6, 3.6, 3.5, 3.4, 3.2, 3.0];
chain(tailPts, tailR, tan);
// Darker segment bands.
for (i = [1 : len(tailPts) - 2]) color(tanDark) translate(tailPts[i]) sphere(tailR[i] + 0.25, $fn = 16);
for (i = [1 : len(tailPts) - 2]) color(tan) translate((tailPts[i] + tailPts[i + 1]) / 2) sphere((tailR[i] + tailR[i + 1]) / 2 + 0.3, $fn = 16);

// Venom bulb: a big white sphere with lime venom splashed over its back half and drips below.
ell([7, 6.5, 6.5], [0, 2, 30], bulb);
color(venom) intersection() {
  translate([0, 2, 30]) scale([7.2, 6.7, 6.7]) sphere(1, $fn = 32);
  translate([-10, 2.5, 20]) cube([20, 10, 20]);
}
// Venom tongues licking forward over the bulb.
for (a = [-40, -10, 20, 50]) color(venom) translate([0, 2, 30]) rotate([a * 0.6, 0, a]) translate([0, -3.6, 0]) scale([1.4, 3.6, 4]) sphere(1, $fn = 14);
// Drips and the stinger point.
for (d = [[-3, 0], [0, -2], [3.2, 1]]) {
  limb([d[0], 2 + d[1], 24.6], [d[0], 2 + d[1], 22.2], 0.8, 0.5, venom);
  ell([0.9, 0.9, 1.1], [d[0], 2 + d[1], 21.4], venom);
}
spike([0, -3.5, 28], [0, -3, -1.8], 1.2, 0.05, spikeWhite);
