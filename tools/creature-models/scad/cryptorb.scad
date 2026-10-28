// Cryptorb: a glowing red eye at the heart of a dark teal vortex, ringed by orbiting slate shards, red data cubes and
// little red sentinel orbs. It floats; the lowest shard is its "feet".
include <lib.scad>

swirl = [0.1, 0.2, 0.2];
swirlHi = [0.22, 0.38, 0.36];
core = [0.08, 0.08, 0.1];
red = [0.9, 0.08, 0.18];
redHot = [1, 0.45, 0.5];
shard = [0.24, 0.23, 0.28];
shardHi = [0.38, 0.37, 0.43];
shardEdge = [0.45, 0.12, 0.12];
bit = [0.75, 0.15, 0.1];
bitOrange = [0.9, 0.45, 0.2];
wire = [0.85, 0.6, 0.45];

c = [0, 0, 21]; // centre of the vortex

// Core: dark sphere wrapped in swirl bands, a big red eye in front and a dimmer one behind.
translate(c) {
  color(core) scale([1, 0.8, 1]) sphere(7, $fn = 36);
  // Swirl: spiral arcs facing the viewer, tightening towards the eye, front and back.
  for (side = [-1, 1]) for (i = [0 : 6]) color(i % 2 ? swirl : swirlHi)
    translate([0, side * (1.5 + i * 0.35), 0]) rotate([90, 0, 0]) rotate([0, 0, i * 52 + (side > 0 ? 25 : 0)])
      rotate_extrude(angle = 200 - i * 10, $fn = 32) translate([6.2 + i * 0.9, 0]) scale([0.7 + (i % 3) * 0.2, 1.4]) circle(1, $fn = 8);
  // Front eye.
  color(shardEdge) translate([0, -6.2, 0]) scale([5, 2, 5]) sphere(1, $fn = 28);
  color(red) translate([0, -7, 0]) scale([4, 1.6, 4]) sphere(1, $fn = 28);
  color(redHot) translate([0, -8.1, 0.2]) scale([2, 0.8, 2]) sphere(1, $fn = 20);
  color("white") translate([0.6, -8.7, 0.8]) sphere(0.7, $fn = 10);
  // The eye shows through from behind too.
  color(shardEdge) translate([0, 6.2, 0]) scale([4, 1.8, 4]) sphere(1, $fn = 24);
  color(red) translate([0, 7, 0]) scale([2.8, 1.4, 2.8]) sphere(1, $fn = 20);
}

// A curved slate shard: a thin bent slab with a rusty underside, pointing along its local +X.
module shardPiece(len, wid) {
  color(shard) hull() {
    translate([-len / 2, 0, 0]) scale([0.4, 0.7, wid * 0.3]) sphere(1, $fn = 8);
    translate([0, -0.4, 0]) scale([len * 0.3, 1.1, wid / 2]) sphere(1, $fn = 12);
    translate([len / 2, 0.3, 0]) sphere(0.25, $fn = 6);
  }
  color(shardHi) translate([0, -1.1, 0.2]) scale([len * 0.22, 0.4, wid * 0.3]) sphere(1, $fn = 10);
  color(shardEdge) translate([0, 0.7, -wid * 0.25]) scale([len * 0.3, 0.6, wid * 0.2]) sphere(1, $fn = 10);
}
// Ring of shards: [angle around the vortex (in the X/Z plane), radius, depth y, length, width, roll].
shards = [[100, 17, -1, 9, 4, 30], [55, 17, 1, 8, 3.5, 0], [15, 16, -2, 7, 3, -20], [-30, 16, 1, 9, 4.5, 10],
          [-80, 18, -1, 8, 3.5, 0], [-130, 17, 2, 8, 3.5, 20], [-170, 16, -2, 7, 3.5, -10], [150, 17, 1, 8, 4, 10],
          [80, 13, 6, 5, 2.5, 0], [-100, 13, -6, 5, 2.5, 0]];
for (s = shards) {
  a = s[0];
  translate(c + [s[1] * cos(a), s[2], s[1] * sin(a)]) rotate([0, -a - 90, 0]) rotate([s[5], 0, 0]) shardPiece(s[3] * 1.35, s[4] * 1.3);
}

// Little red sentinel orbs and data bits drifting in the field.
for (o = [[-14, -2, 34], [14, 0, 6]]) {
  color(core) translate(o) sphere(1.8, $fn = 16);
  color(red) translate(o + [0, -1.2, 0]) sphere(1.3, $fn = 14);
}
bits = [[-12, -3, 30, 1], [-8, -1, 33, 0], [-11, -2, 13, 1], [-12.5, 0, 15, 0], [10, -2, 12, 1], [6, 2, 31, 0],
        [-4, -4, 35, 1], [3, -3, 34, 0], [-2, 3, 33, 1], [11, 1, 27, 0], [-6, 2, 8, 1], [5, -2, 7, 0], [-13, 1, 22, 0]];
for (b = bits) color(b[3] ? bit : bitOrange) translate([b[0], b[1], b[2]]) rotate([20, 30, b[0] * 7]) cube(1.2, center = true);
// Frayed wires trailing off a couple of shards.
chain([[-15, -1, 27], [-13, -2, 25.5], [-12.5, -1, 23]], [0.25, 0.25, 0.2], wire);
chain([[8, 0, 36], [6, -1, 35], [4.5, 0, 36]], [0.25, 0.25, 0.2], wire);
