// Tidespine: a blue upright sail-backed dinosaur with a cream belly and jaw, a sail of pale ice crystals and grey
// stones on its back, crystal spikes down a long tail ending in a grey fan fin, a glowing gem on its chest.
include <lib.scad>

blue = [0.18, 0.43, 0.62];
blueHi = [0.3, 0.56, 0.75];
blueDk = [0.12, 0.3, 0.46];
cream = [0.93, 0.87, 0.66];
crystal = [0.78, 0.9, 0.96];
crystalHi = [0.92, 0.97, 1];
crystalDk = [0.66, 0.8, 0.9];
rock = [0.55, 0.55, 0.58];
rockDk = [0.34, 0.34, 0.37];
gem = [0.4, 0.85, 1];
claw = [0.3, 0.3, 0.33];

// Torso: upright pear with a cream belly.
blob([[[6, 5.5, 6.5], [0, 1, 12]], [[4.4, 4.2, 4.4], [0, -0.5, 19.5]]], blue);
blob([[[3.8, 2.4, 5.2], [0, -3.6, 11.5]], [[2.4, 2, 3.2], [0, -3.2, 19]]], cream);
// Chest gem in a rock setting.
ell([1.8, 0.8, 1.8], [-1.2, -5.2, 17.5], rock);
ell([1.2, 0.8, 1.3], [-1.2, -5.7, 17.6], gem);
// Rock clusters at the hips.
mirror_x() for (r = [[5.4, -2.5, 10, 1.4], [6.4, -0.5, 11.5, 1.2], [5.6, -3.4, 12.6, 1]]) ell([r[3], r[3], r[3] * 0.8], [r[0], r[1], r[2]], r[3] > 1.1 ? rock : rockDk);

// Neck and head: long neck curving forward, a long snout.
chain([[0, 0, 20], [0, -1.5, 24.5], [0, -2.5, 28]], [3.4, 2.9, 2.8], blue);
ell([3.2, 2.4, 2.8], [0, -2.4, 24.2], cream);
blob([[[3.4, 3.6, 3], [0, -2.4, 30]], [[2.2, 4.6, 1.8], [0, -8.5, 29]]], blue);
// Cream lower jaw.
blob([[[2.6, 3, 1.2], [0, -3, 27.6]], [[1.8, 3.6, 0.9], [0, -8.5, 27.8]]], cream);
color(blueDk) translate([0, -7.5, 28.4]) scale([2.1, 5, 0.25]) sphere(1, $fn = 20);
mirror_x() ell([0.3, 0.3, 0.3], [0.9, -12.8, 29.6], blueDk);
// Brow ridge and eyes.
mirror_x() {
  eye([2.7, -4.8, 30.6], 1.2, iris = [0.3, 0.75, 0.95], yaw = -30);
  color(blueHi) translate([2.6, -4.6, 31.9]) rotate([0, -10, -30]) scale([1.6, 1, 0.5]) sphere(1, $fn = 14);
}

// Crystal sail: a tall crystal cluster standing on the spine, its shards fanning sideways as well as back so it
// reads from the front and behind, with grey stones set in it.
module shard(p, d, r, c) {
  l = norm(d);
  color(c) translate(p) rotate(_dir_rot(d)) {
    cylinder(h = l * 0.72, r1 = r * 0.8, r2 = r, $fn = 6);
    translate([0, 0, l * 0.72]) cylinder(h = l * 0.28, r1 = r, r2 = 0.05, $fn = 6);
  }
}
sail = [ // [x lean, y lean, length]
  [0, 1, 16], [-3.5, 1.5, 14], [3.5, 1.5, 14], [-6, 3, 11], [6, 3, 11], [-2, 5, 13], [2, 5, 13], [-4.5, 6.5, 10], [4.5, 6.5, 10],
  [0, 8, 9], [-8, 4, 7], [8, 4, 7]];
for (i = [0 : len(sail) - 1]) {
  v = sail[i];
  shard([v[0] * 0.15, 5 + v[1] * 0.1, 14], [v[0], v[1], v[2]], 2.3 - i * 0.06, i % 3 == 0 ? crystalDk : i % 3 == 1 ? crystal : crystalHi);
}
ell([1.8, 1.6, 2.4], [-1.2, 7, 22.5], rockDk);
ell([1.5, 1.4, 1.6], [1.8, 6.4, 19], rock);

// Arms: short with grey crystal-studded hands.
mirror_x() {
  chain([[4.4, -1.5, 19], [6, -3.5, 15.5], [6.4, -5.5, 14]], [1.6, 1.3, 1.2], blue);
  ell([1.5, 1.4, 1.2], [6.6, -6.4, 13.6], blue);
  for (t = [-35, 0, 35]) spike([6.6 + sin(t) * 1, -7.3, 13.4], [sin(t) * 0.5, -1.1, -0.6], 0.4, 0.05, claw);
  spike([6.8, -5.6, 14.6], [0.8, 0, 1.8], 0.5, 0.05, crystal);
}

// Legs: thick digitigrade thighs, clawed feet.
mirror_x() {
  ell([3.4, 4, 4.4], [4.4, 0, 7.8], blue);
  chain([[4.6, 0.6, 5], [5, 1.6, 2.6], [5, -0.4, 1]], [2.4, 1.6, 1.4], blue);
  blob([[[2.2, 3.2, 1.1], [5, -2, 1.1]], [[1.6, 1.6, 1], [5, 1, 1]]], blue);
  for (t = [-28, 0, 28]) spike([5 + sin(t) * 1.4, -4.8, 0.8], [sin(t) * 0.5, -1.4, -0.4], 0.5, 0.05, claw);
}

// Tail: long, sweeping back and to the viewer's right, crystal spikes along it, a grey fan fin at the tip.
tail = [[0, 4, 9], [3, 9, 6], [8, 12, 5.5], [13, 12, 8], [15, 10, 12], [15, 8.5, 16]];
chain(tail, [3.6, 2.8, 2.2, 1.7, 1.3, 1], blue);
for (i = [1 : 3]) spike(tail[i] + [0, 0, 1.2], [0.2, 0.3, 2.4], 0.7, 0.1, crystal);
// Fan fin: a fan of grey rays, and a crystal at the tip.
for (a = [-50 : 20 : 50]) color(a % 40 == 10 || a % 40 == -30 ? rock : [0.66, 0.66, 0.68]) translate([15, 8.5, 16]) rotate([0, 0, 30]) rotate([0, a, 0]) translate([0, 0, 3]) scale([0.9, 0.35, 3.4]) sphere(1, $fn = 12);
spike([15, 8.5, 16], [-0.4, -0.3, 6], 1, 0.1, crystalHi);
