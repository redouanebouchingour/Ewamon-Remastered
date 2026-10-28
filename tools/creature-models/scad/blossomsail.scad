// Blossomsail: a lilac-grey dove with raised cherry-blossom wings, a flower crown and a long trailing tail of green
// leaf feathers, with blossom petals drifting about it.
include <lib.scad>

grey = [0.72, 0.72, 0.82];
greyDark = [0.55, 0.55, 0.68];
greyLight = [0.85, 0.85, 0.92];
pink = [0.98, 0.72, 0.74];
pinkLight = [1, 0.86, 0.86];
pinkDark = [0.95, 0.6, 0.66];
leaf = [0.42, 0.65, 0.3];
leafDark = [0.28, 0.48, 0.2];
leafLight = [0.6, 0.8, 0.42];
beak = [0.45, 0.48, 0.52];
blossom = [1, 0.78, 0.82];
blossomCore = [0.95, 0.45, 0.55];

// Body: a teardrop leaning forward, chest out.
blob([[[4.6, 4.4, 6.5], [0, 0, 18.5]], [[2.8, 3, 3.5], [0.8, 1.8, 11.5]]], grey);
ell([3.4, 2.2, 5], [0, -2.6, 19], greyLight);
// Neck and head.
limb([0, -0.5, 22], [0, -1.5, 29], 3.2, 2.8, grey);
blob([[[3.6, 4, 3.4], [0, -1.5, 31]], [[2.4, 2.6, 2.4], [0, -3.5, 30.5]]], grey);
// Beak.
spike([0, -5.5, 30.6], [0, -2.6, -0.6], 1.1, 0.1, beak);
// Eyes: plum with a bright highlight.
mirror_x() eye([2.2, -3.8, 31.7], 1.3, iris = [0.55, 0.15, 0.4], pupil = [0.2, 0.05, 0.15], yaw = -40);

// Flower crown: a ring of blossoms with leaves on the head.
module bloom(p, s) {
  translate(p) {
    for (a = [0 : 72 : 359]) color(blossom) rotate([0, 0, a]) translate([s * 0.9, 0, 0]) scale([s, s * 0.7, s * 0.45]) sphere(1, $fn = 10);
    color(blossomCore) translate([0, 0, s * 0.3]) sphere(s * 0.45, $fn = 8);
  }
}
for (a = [0 : 45 : 359]) {
  p = [3.2 * cos(a), -1.5 + 3.4 * sin(a), 33.4 + 0.6 * sin(a)];
  if (a % 90 == 0) bloom(p, 1.2);
  else color(leaf) translate(p) rotate([0, 0, a]) scale([1.6, 0.8, 0.4]) sphere(1, $fn = 10);
}
bloom([0.8, -1, 34.8], 1.3);
bloom([-1.6, -1.5, 34.6], 1.0);
for (p = [[1.8, -1, 36], [-0.8, -0.6, 36.4]]) color(blossom) translate(p) scale([0.8, 0.8, 1.1]) sphere(1, $fn = 10);

// Wings: raised up and out in a V, arm in grey, layered pink feathers fanning out from the arm's outer edge.
mirror_x() translate([3.5, 0, 23]) rotate([0, 0, -22]) translate([-3.5, 0, -23]) {
  chain([[3.5, 0, 23], [7, 0.5, 26], [9.5, 1, 31], [11.5, 1.5, 37]], [2, 1.7, 1.4, 1], grey);
  // Back row (darker, longer) then front row (light).
  for (row = [0 : 1]) for (i = [0 : 8]) {
    t = i / 8;
    base = [4 + t * 7.5, 1.6 - row * 1.0, 23.5 + t * 13.5];
    ang = 105 - t * 80;  // lower feathers point out sideways, upper ones up
    len = (row == 0 ? 12 : 9) + (1 - abs(t - 0.45) * 2) * 3;
    color(row == 0 ? pinkDark : (i % 2 == 0 ? pink : pinkLight))
      translate(base) rotate([0, ang, 0]) translate([0, 0, len / 2]) scale([2.2, 0.7, len / 2]) sphere(1, $fn = 14);
  }
}

// Feet: little green-grey talons tucked under.
mirror_x() {
  limb([2, -1, 12.5], [2.4, -2.4, 10], 0.7, 0.5, leafDark);
  for (a = [-30, 0, 30]) spike([2.4, -2.4, 10], [sin(a) * 1, -1, -0.6], 0.3, 0.05, leafDark);
}

// Tail: a long cascade of green leaf feathers sweeping down and to the viewer's right, ending in pink buds.
// [angle in the xz plane from straight down (positive = to +x), length, y tilt]
tails = [[-14, 11, 2], [2, 13, 3], [18, 14, 2.5], [34, 14, 3.5], [50, 13, 2], [66, 11, 3], [80, 9, 4], [10, 11, 5], [42, 12, 5]];
for (i = [0 : len(tails) - 1]) {
  t = tails[i];
  ang = t[0]; L = t[1];
  color(i % 3 == 0 ? leafDark : (i % 3 == 1 ? leaf : leafLight))
    translate([0.8, 2.5, 10]) rotate([-t[2] * 3, 180 - ang, 0]) translate([0, 0, L / 2]) scale([1.9, 0.6, L / 2]) sphere(1, $fn = 14);
  color(blossom) translate([0.8, 2.5, 10] + [sin(ang) * L, t[2] * 3 * L / 57, -cos(ang) * L]) scale([1.1, 1.1, 0.8]) sphere(1, $fn = 10);
}
// Petals drifting nearby.
for (p = [[-9, -1, 12], [-11, 0, 8], [-8, 1, 5], [-13, 1, 4], [-6, -2, 2], [14, -1, 12], [16, 2, 6]])
  color(pinkLight) translate(p) rotate([30, 20, p[0] * 7]) scale([1, 0.4, 0.6]) sphere(1, $fn = 10);
