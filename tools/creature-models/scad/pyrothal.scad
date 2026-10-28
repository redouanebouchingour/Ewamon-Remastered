// Pyrothal: Serpyre grown legs. A navy bipedal dragon with a golden belly and jaw, a tall golden horn and a crest of
// blue spikes on its head, ice-blue crystal spikes along its back, arms and tail, and dark grey claws.
include <lib.scad>

blue = [0.14, 0.27, 0.55];
blueDk = [0.08, 0.16, 0.38];
blueHi = [0.24, 0.42, 0.72];
gold = [0.93, 0.74, 0.2];
goldDk = [0.75, 0.55, 0.12];
ice = [0.6, 0.85, 0.96];
iceDk = [0.38, 0.66, 0.85];
claw = [0.3, 0.28, 0.3];

module crystal(p, d, r = 0.9) {
  spike(p, d, r, 0.05, ice);
  spike(p + [0.3, 0.3, 0], d * 0.7, r * 0.6, 0.05, iceDk);
}

// Torso leaning slightly forward, a gold belly plate.
blob([[[6.5, 5.5, 6], [0, 0.5, 17]], [[5.5, 4.8, 5.5], [0, -0.5, 24]]], blue);
blob([[[4.6, 2, 5], [-0.6, -4.6, 16.5]], [[3.6, 2, 4.5], [-0.8, -4.6, 24]], [[2.4, 1.6, 2], [-1, -3.6, 29]]], gold);
for (z = [14, 17, 20, 23]) color(goldDk) translate([-0.6, -6.4, z]) scale([3.6, 0.3, 0.2]) sphere(1, $fn = 10);

// Neck and head.
blob([[[3.4, 3.2, 3], [-0.5, -0.5, 28]], [[3, 3, 2.6], [-1, -1.5, 31.5]]], blue);
translate([-1, -2, 33.5]) rotate([0, 0, -12]) scale(1.3) {
  blob([[[3.2, 3.4, 2.8], [0, 0.5, 0]], [[2, 3, 1.8], [0, -5, -0.4]]], blue);
  // Gold lower jaw.
  blob([[[2.6, 2.6, 1.2], [0, -1.4, -2]], [[1.5, 2.2, 0.9], [0, -5.6, -1.6]]], gold);
  color(blueDk) translate([0, -5, -1.25]) scale([1.6, 2.6, 0.25]) sphere(1, $fn = 12);
  mirror_x() ell([0.3, 0.25, 0.3], [0.8, -7.8, 0.4], blueDk);
  // Gold eyes under a heavy brow.
  mirror_x() {
    eye([2.1, -2.6, 1], 0.95, iris = [0.95, 0.7, 0.1], pupil = [0.15, 0.08, 0.02], sclera = [1, 0.9, 0.6], yaw = -28);
    color(blueDk) translate([2.1, -3, 1.9]) rotate([0, -18, -28]) scale([1.5, 0.6, 0.5]) sphere(1, $fn = 12);
  }
  // Tall golden horn on the brow, swept up and back.
  color(gold) translate([-1.2, -1, 2]) rotate([-20, -8, 0]) scale([0.55, 1.3, 1]) cylinder(h = 9, r1 = 1.6, r2 = 0.15, $fn = 12);
  color(gold) translate([1.4, -0.6, 2]) rotate([-30, 12, 0]) scale([0.5, 1, 1]) cylinder(h = 5.5, r1 = 1.2, r2 = 0.1, $fn = 10);
  // Blue crest spikes behind the horn.
  for (m = [[0, 2, 2, 0, -50, 6], [2, 2, 1, 25, -60, 5], [-2, 2, 1, -25, -60, 5], [2.4, 2.5, -0.5, 45, -85, 4.5],
            [-2.4, 2.5, -0.5, -45, -85, 4.5], [0, 3, 0, 0, -85, 5]])
    color(blueHi) translate([m[0], m[1], m[2]]) rotate([0, 0, -m[3]]) rotate([m[4], 0, 0]) scale([1, 0.45, 1]) cylinder(h = m[5], r1 = 1.4, r2 = 0.1, $fn = 10);
}

// Arms raised, claws open.
mirror_x() {
  chain([[5.5, -0.5, 25.5], [9.5, -2, 20.5], [12, -4.5, 25]], [2.2, 1.9, 1.6], blue);
  ell([1.9, 1.8, 1.9], [12.2, -5, 25.8], blue);
  for (a = [-35, 0, 35]) spike([12.2 + sin(a) * 1.4, -5.6, 27.2], [sin(a) * 0.8, -0.6, 2.2], 0.5, 0.05, claw);
  spike([13.6, -5.4, 25], [1.6, -0.6, -0.4], 0.45, 0.05, claw);
  // Ice crystals on the forearm and shoulder.
  crystal([10, 0, 21.5], [1.6, 1.4, -2]);
  crystal([6.5, 2.5, 28], [1.6, 2, 2.4], 1.1);
}

// Back crystals running down the spine.
for (i = [0 : 3]) {
  z = 29 - i * 4.5;
  mirror_x() crystal([2, 4.5 + i * 0.2, z], [1.4, 3.6, 2.4 - i * 0.4], 1.5 - i * 0.12);
}

// Legs: thick thighs, bent knees, splayed feet with dark claws.
mirror_x() {
  ell([3.8, 4, 4.4], [4.8, 0.5, 11], blue);
  chain([[5, 0, 10], [6.5, -2.5, 6], [6.8, 0, 2]], [3.2, 2.2, 1.9], blue);
  blob([[[2.6, 3.8, 1.3], [7, -2.4, 1.2]], [[2, 1.8, 1.4], [6.8, 0.6, 1.4]]], blue);
  for (a = [-30, 0, 30]) spike([7 + sin(a) * 1.6, -5.6, 0.9], [sin(a) * 0.6, -1.6, -0.4], 0.5, 0.05, claw);
  crystal([7.6, -2.6, 6.5], [1.6, -0.8, 0.6], 0.8);
  crystal([8.2, 1.6, 10], [1.8, 1, 1], 0.9);
}

// Tail sweeping back and out to the viewer's right, gold underside, crystals along its top.
tail = [[2, 3, 12], [7, 5, 7], [13, 4.5, 4.5], [18, 2.5, 5.5], [20.5, 0.5, 9.5], [20.5, -1, 15]];
tr = [4, 3.4, 2.6, 2, 1.5, 0.9];
chain(tail, tr, blue);
chain([for (p = tail) p + [0, -0.6, -0.9]], [for (r = tr) r * 0.85], gold);
chain(tail, tr, blue);
for (i = [1 : len(tail) - 2]) crystal(tail[i] + [0, 0.8, tr[i] * 0.8], [0.6, 1.6, 2.4], tr[i] * 0.45);
