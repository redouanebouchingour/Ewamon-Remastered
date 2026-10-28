// Scalewisp: a lean teal wyvern-pup crouched on all fours: a narrow horned head with ember eyes, a spiny back ridge,
// raised violet bat wings on teal bones and a long whip tail that curls up into a frond of spines.
include <lib.scad>

scale_ = [0.13, 0.6, 0.58];
scaleHi = [0.25, 0.75, 0.7];
scaleDark = [0.06, 0.4, 0.4];
belly = [0.45, 0.72, 0.62];
membrane = [0.72, 0.42, 0.82];
membraneDark = [0.45, 0.24, 0.55];
claw = [0.9, 0.92, 0.88];
ember = [1, 0.45, 0.1];

// Bat wing: arm shoulder -> elbow -> wrist, finger bones to tips, violet membranes between them and back to the body.
module batwing(S, E, W, tips, root, bone, mem, r = 0.8) {
  chain([S, E, W], [r * 1.6, r * 1.2, r], bone);
  for (f = tips) limb(W, f, r * 0.8, r * 0.3, bone);
  for (k = [0 : len(tips) - 2]) color(k % 2 == 0 ? mem : mem * 0.85) hull() {
    translate(W) sphere(0.2, $fn = 6);
    translate(tips[k]) sphere(0.2, $fn = 6);
    translate(tips[k + 1]) sphere(0.2, $fn = 6);
  }
  color(mem * 0.9) hull() {
    translate(W) sphere(0.2, $fn = 6);
    translate(tips[len(tips) - 1]) sphere(0.2, $fn = 6);
    translate(root) sphere(0.2, $fn = 6);
    translate(S) sphere(0.2, $fn = 6);
  }
}

// Body: a lean crouched torso, chest low at the front.
blob([[[6.5, 7.5, 5.5], [0, 1, 10.5]], [[6, 5.5, 5.5], [0, -5, 10]], [[4.5, 4.5, 4.5], [0, 7, 10.5]]], scale_);
ell([4, 6, 3], [0, -3, 7.4], belly);

// Neck and head, low and forward.
chain([[0, -7, 12], [0, -11, 13], [0, -13.5, 13.5]], [3.6, 3, 2.8], scale_);
blob([[[3.4, 3.8, 3], [0, -15, 14]], [[2.2, 3.6, 1.8], [0, -19.5, 13]]], scale_);
ell([2, 3.4, 1], [0, -18.5, 11.8], belly);
color(scaleDark) translate([0, -21.2, 12.7]) scale([1.4, 0.6, 0.4]) sphere(1, $fn = 10);
mirror_x() {
  ell([0.35, 0.3, 0.3], [0.9, -22.8, 13.4], scaleDark);
  eye([2.5, -17.6, 14.6], 1.1, iris = ember, pupil = [0.15, 0.03, 0.02], sclera = [1, 0.75, 0.4], yaw = -35, flat = 0.6);
  color(scaleDark) translate([2.4, -17.6, 15.6]) rotate([0, -15, -35]) scale([1.6, 0.6, 0.5]) sphere(1, $fn = 12);
  // Horns sweeping back, and cheek spines.
  limb([2, -14, 16], [3.4, -8.5, 19], 1, 0.15, scaleHi);
  limb([3, -13, 14], [5.6, -10, 15.6], 0.7, 0.1, scaleHi);
}
// Spine ridge along the neck and back.
for (i = [0 : 8]) {
  y = -12 + i * 2.6;
  spike([0, y, 16 - abs(y + 2) * 0.12], [0, 1.2, 2.6 - i * 0.12], 0.9, 0.1, scaleHi);
}

// Legs: crouched, elbows out, with white claws.
mirror_x() {
  ell([3, 3.4, 3.4], [5, -5, 9], scale_);
  chain([[5, -5, 9], [8, -7, 5], [7, -9, 1]], [2.4, 1.9, 1.5], scale_);
  for (a = [-30, 0, 30]) spike([7 + sin(a) * 0.8, -10, 0.8], [sin(a) * 0.8, -1.6, -0.3], 0.4, 0.05, claw);
  ell([4, 4.6, 4.6], [5.4, 6, 8.6], scale_);
  chain([[6.4, 6, 7], [8, 3.5, 3.5], [7.6, 2, 1]], [2.4, 1.8, 1.5], scale_);
  for (a = [-30, 0, 30]) spike([7.6 + sin(a) * 0.8, 1, 0.8], [sin(a) * 0.8, -1.6, -0.3], 0.4, 0.05, claw);
}

// Raised violet wings.
mirror_x() batwing([4, -2, 14], [9, 1, 21], [13, 3, 28],
  [[22, 7, 31], [24, 5, 22], [21, 2, 15], [16, 0.5, 12]], [5, 2, 13], scaleDark, membrane);

// Long tail sweeping back and curling up into a frond.
tailPts = [[0, 9, 11], [1, 15, 9], [3, 20, 9], [5, 24, 13], [6, 25, 19], [5, 23, 24], [4, 20, 26]];
chain(tailPts, [3.4, 2.8, 2.3, 1.9, 1.6, 1.3, 1], scale_);
for (i = [1 : 5]) spike(tailPts[i] + [0, 0, 1], [0, 0.4, 1.6], 0.6, 0.1, scaleHi);
for (k = [[-1.5, -1, 3], [1.5, -1, 3], [-2.5, 1, 2], [2.5, 1, 2], [0, -2.4, 2], [0, 1.5, 3.5]])
  limb([4, 20, 26], [4 + k[0], 20 + k[1], 26 + k[2]], 0.6, 0.1, scaleHi);
