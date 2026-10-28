// Glacifang: a pale ice drake on all fours, crystal spikes down its back, frosted bat wings, green eyes, curled tail.
include <lib.scad>

skin = [0.86, 0.92, 0.98];
shade = [0.68, 0.79, 0.92];
belly = [0.78, 0.86, 0.9];
crystal = [0.72, 0.88, 1.0];
crystalHi = [0.9, 0.97, 1.0];
membrane = [0.93, 0.96, 1.0];
membraneLav = [0.9, 0.86, 1.0];
bone = [0.64, 0.76, 0.92];
eyeGreen = [0.3, 0.75, 0.2];
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
  eye([3.1, -18.9, 19.6], 1.5, iris = eyeGreen, pupil = [0.05, 0.2, 0.05], yaw = 35, flat = 0.6);
  color(bone) translate([2.9, -19.3, 21.1]) rotate([0, 22, 35]) scale([2.3, 1, 0.65]) sphere(1, $fn = 14);
}
// Swept-back horns and cheek spikes.
mirror_x() {
  chain([[2.4, -14.5, 21], [3.4, -12, 24.5], [4, -9, 26]], [1, 0.6, 0.15], crystal);
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
tailPts = [[0, 9, 12], [4, 14, 12], [10, 15, 10], [14, 11, 7], [14.5, 5, 4], [11, 1, 2.5]];
tailRs = [3.8, 3.1, 2.5, 1.9, 1.3, 0.6];
chain(tailPts, tailRs, skin);
for (i = [1 : 4]) spike(tailPts[i] + [0, 0, tailRs[i] * 0.7], [0, 0, 2.2 - i * 0.3], 0.8, 0.05, crystal);

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

// Frost puffs drifting from the mouth.
for (p = [[-2.6, -24, 17.4], [-3.8, -25, 19.2], [-1.4, -25.5, 19.8]]) ell([0.8, 0.8, 0.8], p, crystalHi);
