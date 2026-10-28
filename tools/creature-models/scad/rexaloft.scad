// Rexaloft: Scalewisp grown into an upright emerald dragon: a lean standing body with a pale-green banded belly, a
// fanned fin frill around a narrow head, a horn that sweeps back and curls into a hook, huge deep-blue bat wings and a
// heavy tail curling round its feet.
include <lib.scad>

scale_ = [0.12, 0.52, 0.3];
scaleHi = [0.3, 0.72, 0.45];
scaleDark = [0.05, 0.3, 0.18];
belly = [0.45, 0.78, 0.5];
bellyLine = [0.25, 0.6, 0.35];
membrane = [0.24, 0.32, 0.78];
claw = [0.85, 0.9, 0.82];
eyeGlow = [1, 0.85, 0.25];

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

// Torso: upright, a little S-curved.
blob([[[5.5, 4.5, 6], [0, 0, 24]], [[5, 4.5, 5], [0, 0.5, 17]], [[4.5, 4, 4], [0, 1, 12]]], scale_);
blob([[[3.6, 2, 5.5], [0, -3.2, 22.5]], [[3, 2, 4.5], [0, -2.8, 15]]], belly);
for (z = [13 : 2.2 : 27]) color(bellyLine) translate([0, -4.6 + abs(z - 20) * 0.08, z]) scale([2.8, 0.4, 0.25]) sphere(1, $fn = 12);

// Neck and head.
chain([[0, 0, 28], [0, -1, 31], [0, -2, 33]], [3.2, 2.8, 2.6], scale_);
blob([[[2.8, 3.2, 2.8], [0, -2.5, 35]], [[1.8, 3, 1.6], [0, -6.5, 34]]], scale_);
ell([1.6, 2.6, 0.9], [0, -6, 32.8], belly);
mirror_x() {
  ell([0.3, 0.25, 0.25], [0.8, -9.3, 34.4], scaleDark);
  eye([2, -5.2, 35.6], 0.9, iris = eyeGlow, pupil = [0.1, 0.06, 0.02], sclera = eyeGlow, yaw = -35, flat = 0.6, shine = false);
  color(scaleDark) translate([2, -5.3, 36.4]) rotate([0, -15, -35]) scale([1.4, 0.5, 0.45]) sphere(1, $fn = 12);
}
// Fin frill: spined fans either side of the head and behind it.
mirror_x() for (k = [[60, 6], [30, 7], [0, 7], [-30, 6], [-60, 4.6]]) {
  a = k[0]; l = k[1];
  limb([1.6, 0, 35], [1.6 + cos(a) * l, 0.4, 35 + sin(a) * l], 0.5, 0.15, scaleHi);
}
mirror_x() color(scaleHi) hull() for (k = [[60, 5.4], [30, 6.2], [0, 6.2], [-30, 5.2], [-60, 4]])
  translate([1.6 + cos(k[0]) * k[1], 0.6, 35 + sin(k[0]) * k[1]]) sphere(0.25, $fn = 6);
// Horn sweeping back and up into a hook over the head.
chain([[0, 0.5, 38], [0, 2.5, 42], [1, 2, 46], [2.5, -1, 48], [3, -3, 46.5], [2.4, -2.6, 44.6]],
      [1.4, 1.2, 1, 0.8, 0.6, 0.3], scaleHi);
// Spines down the back.
for (i = [0 : 5]) spike([0, 3.6 - i * 0.1, 29 - i * 3], [0, 2.2, 0.8], 0.9, 0.1, scaleHi);

// Arms with clawed hands held forward.
mirror_x() {
  chain([[5, -0.5, 25], [7, -3, 20], [6, -6, 17]], [1.8, 1.4, 1.2], scale_);
  for (a = [-30, 0, 30]) chain([[6, -6.5, 17], [6 + sin(a) * 1.4, -8, 16.6], [6 + sin(a) * 1.6, -8.4, 15.4]], [0.5, 0.4, 0.1], claw);
}

// Legs: a bent stance, one forward.
chain([[3.5, 0, 12], [6, -2, 7.5], [6, 1, 3.5], [6, -1, 1]], [3.4, 2.4, 1.6, 1.4], scale_);
chain([[-3.5, 0, 12], [-5.5, 1, 7.5], [-5.5, 4, 3.5], [-5, 2, 1]], [3.4, 2.4, 1.6, 1.4], scale_);
for (f = [[6, -1], [-5, 2]]) for (a = [-30, 0, 30])
  spike([f[0] + sin(a) * 1, f[1] - 1.6, 0.8], [sin(a) * 1, -2, -0.3], 0.5, 0.05, claw);

// Huge deep-blue wings raised up and out.
mirror_x() batwing([4, 2.5, 26], [10, 4, 33], [14, 5, 40],
  [[24, 9, 42], [27, 6, 30], [25, 3, 18], [20, 0.5, 9], [13, 0, 7]], [5, 1.5, 13], scaleDark, membrane, r = 1);

// Heavy tail: down behind and curling round to the creature's left at its feet.
tailPts = [[0, 4, 12], [2, 9, 8], [7, 11, 5], [12, 8, 4], [14, 3, 5], [13, -1, 7]];
chain(tailPts, [3.6, 3, 2.4, 1.9, 1.4, 0.9], scale_);
for (i = [1 : 4]) spike(tailPts[i] + [0, 0, 1.6], [0, 0, 1.4], 0.6, 0.1, scaleHi);
