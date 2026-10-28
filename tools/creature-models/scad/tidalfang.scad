// Tidalfang: a sleek aqua sea dragon standing tall: a pearly banded belly, a round-eyed head with swept horns and fin
// ears, a translucent lilac sail of webbed spines down its back, little clawed arms and a long tail that loops round
// and ends in a finned curl, with water droplets hanging around it.
include <lib.scad>

aqua = [0.22, 0.72, 0.74];
aquaHi = [0.42, 0.85, 0.85];
aquaDark = [0.1, 0.48, 0.52];
pearl = [0.85, 0.88, 0.92];
pearlLine = [0.68, 0.72, 0.8];
sail = [0.82, 0.86, 0.96];
sailRib = [0.4, 0.78, 0.8];
claw = [0.9, 0.95, 0.95];
drop = [0.45, 0.68, 0.95];

// Torso: upright S-curve.
blob([[[5.5, 5, 5], [0, 1, 13]], [[5, 4.5, 5.5], [0, 0, 20]], [[4, 4, 4], [0, -1, 25]]], aqua);
blob([[[4, 2.2, 4.5], [0, -3, 13.5]], [[3.6, 2.2, 5], [0, -3.4, 20]], [[2.6, 2, 3.5], [0, -4.4, 25.5]]], pearl);
for (z = [11 : 2 : 27]) color(pearlLine) translate([0, -5.2 - (z > 22 ? (z - 22) * 0.25 : 0), z]) scale([3, 0.4, 0.22]) sphere(1, $fn = 12);

// Neck and head.
chain([[0, -1, 26], [0, -2.5, 29.5], [0, -3, 32]], [3.4, 3, 2.8], aqua);
blob([[[4, 4, 3.6], [0, -3, 34.5]], [[2.6, 3.4, 2.2], [0, -7.5, 33]]], aqua);
ell([2.2, 3, 1.1], [0, -7.2, 31.6], pearl);
mirror_x() {
  ell([0.35, 0.3, 0.3], [1, -10.6, 33.4], aquaDark);
  eye([2.6, -6, 35.2], 1.6, iris = [0.15, 0.25, 0.3], pupil = [0.04, 0.06, 0.08], yaw = -30, flat = 0.6);
  // Horns sweeping back and up.
  chain([[1.8, -2, 37.4], [2.8, 0.5, 40.6], [2.4, 2.2, 43]], [1.1, 0.7, 0.15], aquaHi);
  // Fin ears.
  color(sail) hull() { translate([3.6, -1.8, 35]) sphere(0.3, $fn = 6); translate([7.4, 0.5, 38]) sphere(0.3, $fn = 6);
    translate([7.6, 1, 34]) sphere(0.3, $fn = 6); translate([4, -0.5, 33.4]) sphere(0.3, $fn = 6); }
  limb([3.6, -1.8, 35], [7.4, 0.5, 38], 0.4, 0.15, aquaHi);
  limb([3.8, -1.2, 34.2], [7.6, 1, 34], 0.4, 0.15, aquaHi);
}

// Back sail: webbed spines fanning out behind the shoulders, translucent lilac membrane between.
ribs = [[2, 31, 5, 38], [3, 27, 9, 41], [3.5, 23, 12, 40], [3.6, 19, 14, 35], [3.4, 15, 14, 28], [3, 12, 11, 20]];
// rib = [y at spine, z at spine, back reach, tip z]
function ribBase(r) = [1.2, r[0] + 0.5, r[1]];
function ribTip(r) = [r[2] * 0.75, r[0] + r[2] * 0.6, r[3]];
mirror_x() {
  for (k = [0 : len(ribs) - 2]) color(k % 2 == 0 ? sail : sail * 0.94) hull() {
    translate(ribBase(ribs[k])) sphere(0.3, $fn = 6);
    translate(ribTip(ribs[k])) sphere(0.3, $fn = 6);
    translate(ribBase(ribs[k + 1])) sphere(0.3, $fn = 6);
    translate(ribTip(ribs[k + 1])) sphere(0.3, $fn = 6);
  }
  for (r = ribs) limb(ribBase(r), ribTip(r), 0.6, 0.2, sailRib);
}
// Spine crest between the sails.
for (r = ribs) spike([0, r[0] + 0.6, r[1]], [0, 1, 1.4], 0.6, 0.1, aquaHi);

// Little arms with clawed hands.
mirror_x() {
  chain([[4.4, -1.6, 23], [6.4, -4, 20], [5.6, -6, 18.4]], [1.4, 1.1, 0.9], aqua);
  for (a = [-30, 0, 30]) spike([5.6 + sin(a) * 0.8, -6.6, 18.2], [sin(a) * 0.6, -1.2, -0.4], 0.35, 0.05, claw);
  color(sail) hull() { translate([6.4, -3.6, 20.6]) sphere(0.3, $fn = 6); translate([8.4, -2, 22]) sphere(0.3, $fn = 6);
    translate([6.6, -2.4, 18.6]) sphere(0.3, $fn = 6); }
}

// Legs: strong thighs, digitigrade feet.
mirror_x() {
  ell([3.4, 4, 4.4], [4.6, 1, 10], aqua);
  chain([[5, 0.5, 8], [5.8, 3, 4], [5.6, 0.5, 1]], [2.2, 1.6, 1.3], aqua);
  for (a = [-30, 0, 30]) spike([5.6 + sin(a) * 1, -1, 0.8], [sin(a) * 1, -2, -0.3], 0.45, 0.05, claw);
  color(sail) hull() { translate([7.6, 1, 10]) sphere(0.3, $fn = 6); translate([10, 3, 9]) sphere(0.3, $fn = 6);
    translate([7.4, 3, 7]) sphere(0.3, $fn = 6); }
}

// Tail: back from the hips, a big loop up the creature's left side, then out into a finned curl.
loopC = [13, 8, 13];
tailPts = concat([[0, 5, 11], [5, 8, 7]],
  [for (t = [-120 : 40 : 220]) loopC + [6.5 * cos(t), (t - 50) * 0.008, 6.5 * sin(t)]],
  [[18, 9, 3], [22, 8, 3.4], [23.4, 7.6, 6], [22.4, 7.4, 7.6], [21, 7.4, 6.6]]);
tailRs = [for (i = [0 : len(tailPts) - 1]) 3.6 - i * 3.1 / (len(tailPts) - 1)];
chain(tailPts, tailRs, aqua);
for (i = [2 : 2 : 10]) spike(tailPts[i] + [0, 1.6, 0], [0, 1.6, 0], 0.5, 0.1, aquaHi);
// Tail-tip fin.
color(sail) hull() { translate([20, 8.6, 3.2]) sphere(0.3, $fn = 6); translate([24, 9, -0]) sphere(0.3, $fn = 6);
  translate([26, 8.4, 5]) sphere(0.3, $fn = 6); translate([23.4, 7.6, 6]) sphere(0.3, $fn = 6); }

// Water droplets hanging nearby.
for (d = [[-10, -6, 30], [10, -6, 32], [-12, -2, 22], [12, -4, 24], [-9, -6, 10], [9, -7, 14]])
  color(drop) translate(d) { sphere(0.8, $fn = 10); translate([0, 0, 0.4]) cylinder(h = 1.4, r1 = 0.75, r2 = 0, $fn = 10); }
