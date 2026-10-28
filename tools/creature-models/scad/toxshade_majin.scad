// Toxshade Majin: Toxshade corrupted. Magenta crystal spikes burst from its back, glowing red cracks web the black fur
// from a burning core in its chest, the eyes and drool turn blood red, and the tail ends in a barbed hook.
include <lib.scad>

fur = [0.2, 0.21, 0.24];
furHi = [0.32, 0.34, 0.37];
furDk = [0.11, 0.11, 0.14];
skin = [0.36, 0.3, 0.36];
ear = [0.55, 0.42, 0.47];
tox = [0.48, 0.26, 0.72];
toxHi = [0.64, 0.42, 0.88];
crystal = [0.72, 0.12, 0.42];
crystalHi = [0.95, 0.3, 0.6];
red = [1, 0.12, 0.08];
redHi = [1, 0.6, 0.35];
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
// Magenta crystal spikes along the spine and shoulders.
for (c = [[0, 2, 31, [0, 1, 7], 2], [-5, 4, 29, [-2, 2, 7], 1.8], [5, 4, 29, [2, 2, 7], 1.8], [0, 8, 27, [0, 3, 7], 2],
          [-8, 7, 23, [-3, 3, 5], 1.6], [8, 7, 23, [3, 3, 5], 1.6], [-4, 11, 20, [-1.5, 4, 5], 1.6], [4, 11, 20, [1.5, 4, 5], 1.6],
          [-9, -1, 25, [-3, 0, 5], 1.4], [9, -1, 25, [3, 0, 5], 1.4], [0, 12, 14, [0, 5, 3], 1.4]]) {
  spike([c[0], c[1], c[2]], c[3], c[4], 0.08, crystal);
  spike([c[0], c[1], c[2]] + [0.3, -0.3, 0.3], c[3] * 0.85, c[4] * 0.45, 0.05, crystalHi);
}
// Burning core in the chest with red cracks radiating over the body.
ell([2.4, 1, 2.4], [-1.5, -9.3, 18], red);
ell([1.2, 0.8, 1.2], [-1.5, -10, 18.2], redHi);
for (d = [[-4.5, 21.5], [2, 22], [3.5, 15], [-5, 13.5], [-1, 12]])
  color(red) hull() { translate([-1.5, -9.4, 18]) sphere(0.45, $fn = 8); translate([d[0], -9.1 + 0.6 * abs(d[0]) / 5, d[1]]) sphere(0.2, $fn = 6); }
module crack(pts) chain(pts, [for (p = pts) 0.35], red);
crack([onBody(-120, 30, 1.03), onBody(-150, 40, 1.04), onBody(-170, 25, 1.04), onBody(170, 45, 1.04)]);
crack([onBody(-30, 30, 1.08), onBody(0, 40, 1.04), onBody(30, 25, 1.04), onBody(60, 40, 1.04), onBody(90, 30, 1.04)]);
crack([onBody(60, 40, 1.04), onBody(80, 10, 1.04), onBody(110, -10, 1.04)]);
crack([onBody(120, 50, 1.04), onBody(140, 20, 1.04), onBody(160, 0, 1.04)]);
crack([onBody(10, 0, 1.06), onBody(30, -20, 1.04), onBody(50, -35, 1.03)]);
// Red rune ring around the right eye.
color(red) translate([-3.2, -12.6, 27.8]) rotate([90, 0, -28]) difference() { cylinder(h = 0.6, r = 3, center = true, $fn = 20); cylinder(h = 1, r = 2.5, center = true, $fn = 20); }
for (p = [[-4, 4, 32], [0, 9, 29], [-7, 9, 26]])
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
for (d = [[-1.4, -14, 4], [0.2, -14.8, 3], [1.5, -14, 5]]) limb([d[0], d[1], 21.6], [d[0], d[1], 21.6 - d[2]], 0.5, 0.3, red);
// Glowing eyes under a heavy brow.
mirror_x() {
  eye([3.2, -12.2, 27.8], 1.9, iris = red, sclera = [1, 0.4, 0.25], pupil = [0.3, 0, 0], yaw = -28, flat = 0.5);
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
    ell([0.45, 0.45, 0.8], [8.5 + sin(a) * 2.4, -13.6, 5.6], red);
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
// Barbed hook at the tail tip.
spike([11.5, 10, 21.5], [-1.5, 0, -3], 0.8, 0.05, crystal);
spike([12.5, 9.5, 23.5], [1.2, 0, 2.5], 0.6, 0.05, crystal);

// Smog pooling around the feet.
for (s = [[0, 0, 1.6, 6], [10, -4, 1.4, 4], [-10, -4, 1.4, 4], [12, 6, 1.6, 4], [-12, 6, 1.6, 4], [0, 12, 1.4, 5],
          [6, -9, 1.2, 3.5], [-6, -9, 1.2, 3.5], [-6, 14, 1.4, 3.5], [14, -1, 3, 3], [-14, -1, 3, 3]])
  ell([s[3] * 1.2, s[3] * 1.2, s[3] * 0.4], [s[0], s[1], s[2] * 0.7], smog);
for (s = [[-15, 3, 5], [15, 4, 6], [-13, -7, 4], [12, 11, 4]])
  chain([[s[0], s[1], 2], [s[0] * 1.1, s[1], s[2] + 1], [s[0] * 1.05, s[1] + 1, s[2] + 3]], [1.4, 1, 0.4], smogHi);
