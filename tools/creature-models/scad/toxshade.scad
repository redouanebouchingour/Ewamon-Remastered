// Toxshade: a hulking upright black rat, shaggy back bristling with smoke, glowing violet toxin blotches, violet eyes
// and dripping claws, crouched in a pool of dark smog with its tail curling up behind.
include <lib.scad>

fur = [0.2, 0.21, 0.24];
furHi = [0.32, 0.34, 0.37];
furDk = [0.11, 0.11, 0.14];
skin = [0.36, 0.3, 0.36];
ear = [0.55, 0.42, 0.47];
tox = [0.66, 0.36, 0.95];
toxHi = [0.85, 0.65, 1];
smog = [0.27, 0.3, 0.3];
smogHi = [0.38, 0.41, 0.4];

// Torso ellipsoid used to place surface blotches.
bc = [0, 2, 15];
br = [10.5, 9.5, 12];
function onBody(az, el, k = 1) = bc + [br[0] * k * cos(el) * cos(az), br[1] * k * cos(el) * sin(az), br[2] * k * sin(el)];

module blotch(az, el, s, c = tox) {
  color(c) translate(onBody(az, el, sin(az) < -0.2 ? 1.16 : 1.06)) rotate([0, 90 - el, az]) scale([1, 0.75, 0.3]) sphere(s, $fn = 14);
}

// Torso: a big hunched barrel.
blob([[br, bc], [[8, 8, 7], [0, 0, 24]]], fur);
ell([6.5, 3, 8], [0, -6.5, 15], furHi);
// Blotches on the chest.
for (b = [[-3, 19, 1.8], [3.5, 12, 2.2], [-2.5, 9, 1.5], [1.5, 22, 1.3]]) {
  y = -6.5 - 3 * sqrt(max(0.05, 1 - pow(b[0] / 6.5, 2) - pow((b[1] - 15) / 8, 2))) - 0.2;
  color(tox) translate([b[0], y, b[1]]) scale([1, 0.35, 0.8]) sphere(b[2], $fn = 14);
  color(toxHi) translate([b[0] + 0.3, y - 0.4, b[1] + 0.3]) scale([0.5, 0.2, 0.4]) sphere(b[2], $fn = 10);
}

// Shaggy bristles along the shoulders and back (some of them smoky wisps).
for (i = [0 : 13]) {
  az = 30 + i * 9;
  el = 25 + (i % 3) * 12;
  sx = (i % 2 == 0) ? 1 : -1;
  for (m = [1, -1])
    spike(onBody(m > 0 ? az : 180 - az, el, 0.85) + [0, 0, 1], [m * cos(az) * 3, 3 + (i % 4), 6 + (i % 3) * 2], 1.6, 0.1, i % 4 == 0 ? furDk : fur);
}
for (p = [[-4, 4, 32], [3, 6, 33], [0, 9, 29], [-7, 9, 26], [7, 8, 27]])
  chain([p, p + [1.5, 1.5, 3], p + [-0.5, 3, 6]], [1.4, 0.9, 0.3], furDk);

// Violet toxin blotches.
for (b = [[-60, 10, 2.4], [-100, 30, 2], [-20, -15, 2.6], [20, 30, 2.2], [60, 5, 2.6], [90, 40, 2.2], [120, 0, 2.6],
          [150, 30, 2], [-140, 20, 2.4], [170, -10, 2.2], [45, -30, 2], [-45, 45, 1.8]]) {
  blotch(b[0], b[1], b[2]);
  color(toxHi) translate(onBody(b[0], b[1], sin(b[0]) < -0.2 ? 1.18 : 1.08)) rotate([0, 90 - b[1], b[0]]) scale([0.5, 0.35, 0.2]) sphere(b[2], $fn = 10);
}

// Head: thrust forward and down.
blob([[[6.5, 6, 5.8], [0, -7, 27]], [[3.6, 4, 3.2], [0, -13, 24.5]], [[1.8, 2, 1.7], [0, -16, 23.5]]], fur);
ell([1.1, 0.9, 0.9], [0, -17.6, 23.8], [0.42, 0.34, 0.4]);
// Snarling mouth with violet drool and fangs.
color(furDk) translate([0, -14.6, 22]) scale([2.4, 2, 0.8]) sphere(1, $fn = 14);
mirror_x() spike([0.8, -15.8, 22.4], [0, -0.2, -1.4], 0.4, 0.05, [0.95, 0.93, 0.88]);
for (d = [[-1.4, -14, 4], [0.2, -14.8, 3], [1.5, -14, 5]]) limb([d[0], d[1], 21.6], [d[0], d[1], 21.6 - d[2]], 0.5, 0.3, tox);
// Glowing eyes under a heavy brow.
mirror_x() {
  eye([3.2, -12.2, 27.8], 1.9, iris = tox, sclera = toxHi, pupil = [0.25, 0.05, 0.35], yaw = -28, flat = 0.5);
  color(furDk) translate([3.2, -12.6, 29.6]) rotate([0, -22, -28]) scale([2.2, 0.8, 0.6]) sphere(1, $fn = 12);
}
// Whiskers.
mirror_x() for (a = [-10, 8]) color(furHi) translate([1.8, -15.5, 23.5]) rotate([a, 0, -20]) rotate([0, 90, 0]) cylinder(h = 4.5, r = 0.12, $fn = 6);
// Ears.
mirror_x() {
  petal([2.8, 0.9, 3], [4.8, -4, 31.5], [10, 0, -30], fur);
  petal([2, 0.4, 2.2], [4.8, -4.6, 31.5], [10, 0, -30], ear);
}

// Arms: hanging forward, long claws dripping violet.
mirror_x() {
  chain([[8, -2, 21], [10, -7, 15], [8.5, -11, 10]], [3, 2.2, 1.6], fur);
  blotch(-40, 20, 1.6);
  for (a = [-30, 0, 30]) {
    spike([8.5 + sin(a) * 1.2, -12, 9.6], [sin(a) * 1.2, -1.5, -3.2], 0.45, 0.06, skin);
    ell([0.45, 0.45, 0.8], [8.5 + sin(a) * 2.4, -13.6, 5.6], tox);
  }
}

// Legs: heavy haunches, clawed feet.
mirror_x() {
  ell([4.5, 6, 6], [7, 2, 7], fur);
  blotch(-10, -30, 2);
  blob([[[2.6, 4.5, 1.4], [7, -3, 1.4]], [[2, 2, 1.4], [7, 1, 1.6]]], fur);
  for (a = [-25, 0, 25]) spike([7 + sin(a) * 1.4, -7, 1], [sin(a) * 0.8, -1.8, -0.5], 0.45, 0.05, skin);
}

// Tail: thick at the root, curling up behind to the viewer's right.
chain([[2, 10, 6], [6, 15, 3], [11, 16, 3.5], [15, 14, 7], [17, 12, 12], [17.5, 11, 17], [16.5, 10, 21], [14.5, 9.5, 23.5], [12.5, 9.5, 23.5], [11.5, 10, 21.5]],
      [2, 1.7, 1.5, 1.3, 1.1, 1, 0.9, 0.75, 0.6, 0.45], skin);

// Smog pooling around the feet.
for (s = [[0, 0, 1.6, 6], [10, -4, 1.4, 4], [-10, -4, 1.4, 4], [12, 6, 1.6, 4], [-12, 6, 1.6, 4], [0, 12, 1.4, 5],
          [6, -9, 1.2, 3.5], [-6, -9, 1.2, 3.5], [-6, 14, 1.4, 3.5], [14, -1, 3, 3], [-14, -1, 3, 3]])
  ell([s[3] * 1.2, s[3] * 1.2, s[3] * 0.4], [s[0], s[1], s[2] * 0.7], smog);
for (s = [[-15, 3, 5], [15, 4, 6], [-13, -7, 4], [12, 11, 4]])
  chain([[s[0], s[1], 2], [s[0] * 1.1, s[1], s[2] + 1], [s[0] * 1.05, s[1] + 1, s[2] + 3]], [1.4, 1, 0.4], smogHi);
