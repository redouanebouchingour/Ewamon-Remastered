// Embrock: a squat basalt lizard, head raised, glowing lava cracks webbing its chest and flanks, little flames
// licking from its brow and a tail that curls up into a molten tip.
include <lib.scad>

rock = [0.4, 0.38, 0.34];
rockHi = [0.52, 0.5, 0.45];
rockDark = [0.27, 0.25, 0.23];
belly = [0.38, 0.2, 0.16];
lava = [1, 0.45, 0.08];
lavaHot = [1, 0.75, 0.25];
lavaDeep = [0.8, 0.22, 0.05];
claw = [0.62, 0.6, 0.55];

// Point on an ellipsoid (centre c, radii r) at azimuth az (0 = -Y front, 90 = +X) and elevation el, pushed out by g.
function onEll(c, r, az, el, g = 0.15) =
  [c[0] + (r[0] + g) * cos(el) * sin(az), c[1] - (r[1] + g) * cos(el) * cos(az), c[2] + (r[2] + g) * sin(el)];
// Lava crack: a thin glowing polyline over an ellipsoid surface, given as [az, el] pairs.
module crack(c, r, pts, w = 0.45) {
  for (i = [0 : len(pts) - 2])
    limb(onEll(c, r, pts[i][0], pts[i][1]), onEll(c, r, pts[i + 1][0], pts[i + 1][1]), w, w, lava);
}

bodyC = [0, 3, 11]; bodyR = [9.5, 12, 8];
chestC = [0, -5, 15]; chestR = [7.6, 6.4, 8];

// Body and chest.
color(rock) translate(bodyC) scale(bodyR) sphere(1, $fn = 36);
color(rock) translate(chestC) scale(chestR) sphere(1, $fn = 32);
// Dark molten underbelly.
color(belly) translate([0, 1, 6.5]) scale([8, 11, 4]) sphere(1, $fn = 28);
// Rocky lumps on the back.
for (b = [[-4, 4, 18, 3], [4, 6, 18, 3], [0, 9, 17, 3.2], [-6, 10, 14, 2.6], [6, 0, 17, 2.8], [-2, -1, 19, 2.6],
          [2, 12, 15, 2.6], [-7, 2, 15, 2.4]])
  color(b[0] < 0 ? rockHi : rock) translate([b[0], b[1], b[2]]) scale([b[3], b[3], b[3] * 0.7]) sphere(1, $fn = 14);

// Lava cracks: a web over the chest and the flanks.
crack(chestC, chestR, [[-50, 10], [-25, -5], [0, -20], [25, -5], [50, 15]]);
crack(chestC, chestR, [[-25, -5], [-15, 25], [5, 40]]);
crack(chestC, chestR, [[25, -5], [20, 25], [35, 45]]);
crack(chestC, chestR, [[0, -20], [-5, -45]]);
crack(chestC, chestR, [[-50, 10], [-70, 35]]);
mirror_x() {
  crack(bodyC, bodyR, [[70, -20], [85, 0], [100, -15], [120, 5], [140, -10], [150, 15]]);
  crack(bodyC, bodyR, [[85, 0], [95, 25], [110, 35]]);
  crack(bodyC, bodyR, [[120, 5], [130, 30]]);
}
crack(bodyC, bodyR, [[150, 30], [170, 50], [190, 40], [200, 60]]);

// Head: a broad, flat toad-like head lifted high, a wide mouth line, heavy brows.
blob([[[6.6, 6, 4.6], [0, -8, 24.5]], [[5.4, 4.4, 3.4], [0, -12.5, 23.5]]], rock);
color(belly) translate([0, -10, 21]) scale([5.4, 5, 2.4]) sphere(1, $fn = 24);
color(rockDark) intersection() {
  blob([[[6.75, 6.15, 4.75], [0, -8, 24.5]], [[5.55, 4.55, 3.55], [0, -12.5, 23.5]]]);
  translate([0, -14, 22.6]) cube([16, 8, 0.6], center = true);
}
mirror_x() {
  eye([3.4, -14.6, 25.8], 1.5, iris = lava, pupil = [0.15, 0.03, 0.02], sclera = lavaHot, yaw = -25);
  color(rockHi) translate([3.6, -14, 27.6]) rotate([0, -15, -25]) scale([2.4, 1.4, 0.8]) sphere(1, $fn = 14);
  ell([0.35, 0.3, 0.35], [1.2, -16.6, 24.4], rockDark);
  // Brow flames.
  for (f = [[0, 0, 5, 1.3, lavaDeep], [1, -0.6, 3.6, 0.9, lava], [-0.6, 0.6, 3, 0.7, lavaHot]])
    color(f[4]) hull() {
      translate([4.6 + f[0], -11 + f[1], 28.4]) sphere(f[3]);
      translate([4.9 + f[0] * 1.6, -11.4 + f[1], 28.4 + f[2]]) sphere(0.15);
    }
}

// Legs: thick stony limbs with splayed clawed feet.
mirror_x() for (leg = [[6.5, -6, 9, 8.5, -8], [7, 9, 8, 8.5, 10]]) {
  limb([leg[0], leg[1], leg[2]], [leg[3], leg[4], 2], 3.6, 2.6, rock);
  ell([3, 3, 3], [leg[0] + 0.8, leg[1], leg[2] - 1], rockHi);
  blob([[[3, 3.6, 1.4], [leg[3], leg[4] - 1.5, 1.4]], [[2.4, 2, 1.3], [leg[3], leg[4] + 0.6, 1.4]]], rockDark);
  for (a = [-30, 0, 30]) spike([leg[3] + sin(a) * 1.8, leg[4] - 4.6, 1], [sin(a) * 0.7, -1.4, -0.4], 0.55, 0.08, claw);
}

// Tail: sweeps out the back and curls high, glowing towards a molten crescent tip.
chain([[2, 13, 9], [7, 17, 8], [12, 18, 11], [14, 17, 16], [14, 15, 21], [13.5, 13, 25]], [3.6, 3, 2.6, 2.2, 1.9, 1.7], rock);
crack([7, 17, 8], [3, 3, 3], [[60, -60], [90, 0], [120, 40]], 0.35);
chain([[13.5, 13, 25], [13, 11, 28.5], [12, 8.5, 30], [10.5, 6.8, 29.5]], [1.9, 1.8, 1.2, 0.3], lavaDeep);
chain([[13.8, 12.8, 25.5], [13.3, 10.8, 29], [12.2, 8.7, 30.6]], [1.4, 1.2, 0.6], lava);
ell([1.3, 1.3, 1.3], [13.6, 13.3, 24.6], lavaHot);
// Embers dripping off the tip.
for (e = [[11, 8, 27, 0.4], [12.4, 9.5, 26, 0.35], [10, 7, 25, 0.3]]) color(lava) translate([e[0], e[1], e[2]]) sphere(e[3], $fn = 8);
