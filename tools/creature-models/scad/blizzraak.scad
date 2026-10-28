// Blizzraak: Glacifang grown into a deep-blue ice dragon, armoured in blue crystal clusters, a bladed tail held high.
include <lib.scad>

skin = [0.45, 0.68, 0.9];
shade = [0.3, 0.5, 0.78];
belly = [0.78, 0.9, 0.98];
crystal = [0.2, 0.45, 0.85];
crystalHi = [0.6, 0.82, 1.0];
membrane = [0.7, 0.86, 1.0];
membraneLav = [0.55, 0.75, 0.97];
bone = [0.3, 0.55, 0.85];
eyeGreen = [0.95, 0.97, 1.0];
mouth = [0.3, 0.12, 0.2];
claw = [0.95, 0.97, 1.0];

module sheet(pts, c, r = 0.35) {
  color(c) hull() for (p = pts) translate(p) sphere(r, $fn = 8);
}

// Torso: deep chest in front, hips behind.
blob([[[6.2, 7, 6.2], [0, -5, 13]], [[5.6, 6, 5.4], [0, 4, 12.5]]], skin);
ell([4.4, 6.5, 3.4], [0, -2, 9], belly);

// Neck and head, low and forward: a broad skull and a long wedge snout.
limb([0, -8, 15], [0, -13, 17], 4.4, 3.8, skin);
blob([[[5, 4.6, 4.2], [0, -15, 18.6]], [[3.2, 4.4, 2.4], [0, -20.5, 17]]], skin);
ell([2.6, 3.6, 1.3], [0, -19.5, 19.3], shade);
// Lower jaw, open a little, with fangs.
blob([[[2.8, 3.6, 1.2], [0, -18, 14.6]], [[2, 2.4, 1], [0, -21, 15]]], shade);
ell([2.4, 3.2, 0.6], [0, -19.4, 15.6], mouth);
mirror_x() {
  spike([1.6, -21.6, 16.4], [0, 0, -1.4], 0.45, 0.05, claw);
  spike([1.9, -19.5, 16.3], [0, 0, -1.1], 0.4, 0.05, claw);
  ell([0.3, 0.3, 0.3], [0.9, -22.9, 17.4], mouth);
}
// Green eyes under heavy ridges.
mirror_x() {
  eye([3.1, -18.9, 19.6], 1.5, iris = eyeGreen, pupil = [0.1, 0.25, 0.5], yaw = 35, flat = 0.6);
  color(bone) translate([2.9, -19.3, 21.1]) rotate([0, 22, 35]) scale([2.3, 1, 0.65]) sphere(1, $fn = 14);
}
// Swept-back horns and cheek spikes.
mirror_x() {
  chain([[2.4, -14.5, 21], [3.4, -12, 24.5], [4, -9, 26]], [1, 0.6, 0.15], crystal);
  chain([[1.2, -15, 21.5], [1.6, -13, 25.5], [1.8, -10.5, 27.5]], [0.9, 0.55, 0.12], crystalHi);
  spike([3.8, -15, 17.5], [3, 2.5, 0.6], 0.8, 0.05, crystal);
  spike([3.6, -13, 19.5], [2.6, 3, 1.5], 0.6, 0.05, crystalHi);
}

// Crystal spikes along the spine, head to tail root.
spines = [[-12, 21.5, 2.4], [-9, 20, 3.6], [-6, 19.5, 4.4], [-3, 19, 4.6], [0, 18.4, 4.2], [3, 17.6, 3.6], [6, 16.6, 3]];
for (s = spines) {
  spike([0, s[0], s[1]], [0, 1.2, s[2]], 1.3, 0.05, crystal);
  spike([1.2, s[0] + 0.6, s[1] - 0.6], [1.3, 0.8, s[2] * 0.6], 0.8, 0.05, crystalHi);
  spike([-1.2, s[0] + 0.6, s[1] - 0.6], [-1.3, 0.8, s[2] * 0.6], 0.8, 0.05, crystalHi);
}

// Crystal armour clusters over the shoulders and back.
module cluster(p, n, sz) {
  for (i = [0 : n - 1]) let(a = i * 360 / n + p[0] * 13, e = 30 + (i % 3) * 18)
    color(i % 2 == 0 ? crystal : crystalHi) translate(p) rotate([0, 90 - e, a]) scale([1, 1, 1.4]) sphere(sz * (0.8 + (i % 3) * 0.2), $fn = 6);
}
for (p = [[4.6, -6, 18.2], [-4.6, -6, 18.2], [3.4, -1, 19.2], [-3.4, -1, 19.2], [0, -3, 20], [0, 4, 18.6], [4.4, 4, 17], [-4.4, 4, 17], [0, -9, 20],
          [6, -3, 15], [-6, -3, 15]])
  cluster(p, 7, 2.1);

// Legs: crouched forelegs, heavy hind legs, white claws.
module foot(p) {
  blob([[[1.9, 2.4, 1.1], p], [[1.6, 1.4, 1], p + [0, 1.4, 0.3]]], skin);
  for (a = [-30, 0, 30]) spike(p + [sin(a) * 1.3, -2.2, -0.2], [sin(a) * 0.4, -1.1, -0.5], 0.38, 0.05, claw);
}
mirror_x() {
  ell([3, 3.6, 4], [4.8, -6.5, 11], skin);
  limb([5, -7, 11], [6.4, -9, 6], 2.8, 2.2, skin);
  limb([6.4, -9, 6], [6.4, -10.5, 1.3], 2.2, 1.8, skin);
  foot([6.4, -11, 1.1]);
  ell([4, 5, 5.2], [4.8, 5, 9], skin);
  limb([5.4, 6.5, 6], [6, 4, 1.4], 2.6, 1.9, skin);
  foot([6, 3, 1.1]);
}

// Tail: long, sweeping out behind and curling toward the viewer's right, spiked on top.
tailPts = [[0, 9, 12], [3, 15, 10], [9, 17, 8], [14, 13, 9], [16, 7, 14], [16, 3, 22]];
tailRs = [4, 3.3, 2.6, 2, 1.4, 0.8];
chain(tailPts, tailRs, skin);
for (i = [1 : 4]) spike(tailPts[i] + [0, 0, tailRs[i] * 0.7], [0, 0, 2.4 - i * 0.3], 0.9, 0.05, crystal);
// Ice blade on the tail tip.
color(crystalHi) hull() { translate([16, 3, 21]) sphere(1, $fn = 8); translate([16, 2, 30]) sphere(0.2, $fn = 6); translate([16, 0.5, 24]) sphere(0.6, $fn = 6); }
color(crystal) hull() { translate([16, 3.5, 21]) sphere(0.8, $fn = 8); translate([16, 5.5, 27]) sphere(0.2, $fn = 6); }

// Wings: bone arm to a high tip, fingers fanning down, pale membrane with a lavender sheen.
module wing() {
  root = [4, -4, 19];
  elbow = [10, 1, 27];
  tip = [15, 8, 38];
  f1 = [20, 9, 29];
  f2 = [16, 9, 23];
  f3 = [10, 6, 20];
  sheet([elbow, tip, f1], membrane);
  sheet([root, elbow, f1, f2], membraneLav);
  sheet([root, f2, f3], membrane);
  limb(root, elbow, 1.3, 1, bone);
  limb(elbow, tip, 1, 0.5, bone);
  limb(elbow, f1, 0.6, 0.3, bone);
  limb(elbow, f2, 0.6, 0.3, bone);
  limb(elbow, f3, 0.5, 0.3, bone);
  spike(tip, [1, 0, 2], 0.5, 0.05, bone);
}
mirror_x() wing();

