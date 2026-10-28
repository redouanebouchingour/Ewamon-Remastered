// Magmolith: Embrock grown into a hulking basalt saurian, a long crocodilian head, a ridge of stone spikes down its
// back, lava cracks across its whole hide and a tail that curls into a hook dripping molten rock.
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
function nEll(az, el) = [cos(el) * sin(az), -cos(el) * cos(az), sin(el)];
// Lava crack: a thin glowing polyline over an ellipsoid surface, given as [az, el] pairs.
module crack(c, r, pts, w = 0.45) {
  for (i = [0 : len(pts) - 2])
    limb(onEll(c, r, pts[i][0], pts[i][1]), onEll(c, r, pts[i + 1][0], pts[i + 1][1]), w, w, lava);
}
// A flat faceted stone plate lying on an ellipsoid.
module plate(c, r, az, el, s, col = rock) {
  color(col) translate(onEll(c, r, az, el, -0.4)) rotate(_dir_rot(nEll(az, el))) rotate([0, 0, az * 1.7])
    cylinder(h = 1.3, r1 = s, r2 = s * 0.72, $fn = 6);
}
// A flat stone blade (dorsal spike): a thin faceted base swept to a point along d.
module blade(p, d, len, w, col) {
  color(col) hull() {
    translate(p) scale([w * 0.42, w, w * 0.45]) sphere(1, $fn = 8);
    translate(p + d * len) sphere(0.15, $fn = 6);
  }
}

chestC = [0, -4, 15.5]; chestR = [9.6, 8, 9.6];
hipC = [0, 8, 12.5]; hipR = [9.6, 9, 8.4];

// Torso: hunched, massive shoulders up front, hips lower behind, dark underbelly.
color(rock) hull() {
  translate(chestC) scale(chestR) sphere(1, $fn = 32);
  translate(hipC) scale(hipR) sphere(1, $fn = 32);
}
color(belly) hull() {
  translate([0, -3, 9.5]) scale([7.2, 6, 4.4]) sphere(1, $fn = 24);
  translate([0, 9, 8]) scale([7.8, 7.4, 3.8]) sphere(1, $fn = 24);
}
// Stone plates over the flanks and haunches.
for (p = [[70, 40, 3.2], [-70, 40, 3.2], [100, 15, 3.2], [-100, 15, 3.2], [135, 35, 3.4], [-135, 35, 3.4],
          [150, 5, 3], [-150, 5, 3], [180, 35, 3.2], [115, -15, 2.8], [-115, -15, 2.8]])
  plate(hipC, hipR, p[0], p[1], p[2], p[0] % 3 == 0 ? rockHi : rock);
for (p = [[55, 25, 3], [-55, 25, 3], [90, 5, 3], [-90, 5, 3]])
  plate(chestC, chestR, p[0], p[1], p[2], p[0] < 0 ? rockHi : rock);

// Lava cracks: a net over the chest and flanks, and down the back between the spikes.
crack(chestC, chestR, [[-55, 15], [-30, 0], [0, -12], [30, 0], [55, 15]]);
crack(chestC, chestR, [[-30, 0], [-25, 28], [-40, 50]]);
crack(chestC, chestR, [[30, 0], [25, 28], [40, 50]]);
crack(chestC, chestR, [[0, -12], [-8, -32], [4, -50]]);
crack(chestC, chestR, [[-25, 28], [0, 40], [25, 28]]);
crack(chestC, chestR, [[-55, 15], [-75, 35]]);
crack(chestC, chestR, [[55, 15], [75, 35]]);
mirror_x() {
  crack(hipC, hipR, [[70, -15], [88, 5], [104, -10], [122, 8], [142, -10], [160, 12]]);
  crack(hipC, hipR, [[88, 5], [92, 28], [110, 52]]);
  crack(hipC, hipR, [[122, 8], [128, 32], [150, 50]]);
  crack(hipC, hipR, [[160, 12], [170, 40]]);
}

// Neck: short and thick, carrying the head level and forward.
color(rock) hull() {
  translate([0, -5, 20]) scale([8, 6.4, 7]) sphere(1, $fn = 24);
  translate([0, -9.5, 23.5]) scale([7.4, 5.4, 5.4]) sphere(1, $fn = 24);
}
color(belly) hull() {
  translate([0, -11.4, 18.8]) scale([5, 3.2, 2.6]) sphere(1, $fn = 20);
  translate([0, -14, 20.6]) scale([5.4, 4, 2.4]) sphere(1, $fn = 20);
}
crack([0, -9.5, 23.5], [7.4, 5.4, 5.4], [[-70, 10], [-50, -20], [-20, -35]]);
crack([0, -9.5, 23.5], [7.4, 5.4, 5.4], [[70, 10], [50, -20], [20, -35]]);

// Head: a long, heavy crocodilian head carried level; a flat skull and snout over a wide lower jaw, a long mouth line,
// heavy brows over lava-lit eyes.
module head() {
  color(rock) hull() {
    translate([0, 2, 1.2]) scale([6.6, 5, 3.8]) sphere(1, $fn = 28);
    translate([0, -5, 1]) scale([5.8, 4.4, 3]) sphere(1, $fn = 24);
    translate([0, -12, 0.2]) scale([4.4, 2.4, 2.3]) sphere(1, $fn = 20);
  }
  // Low skull ridge between the brows.
  color(rockHi) hull() mirror_x() translate([2.6, -1.6, 3.8]) rotate([0, -14, -18]) scale([2.4, 2.4, 1]) sphere(1, $fn = 12);
  // Lower jaw.
  color(rock) hull() {
    translate([0, 0, -2.4]) scale([6.2, 4.6, 2.6]) sphere(1, $fn = 24);
    translate([0, -10.6, -1.6]) scale([4.2, 2.4, 1.5]) sphere(1, $fn = 18);
  }
  color([0.12, 0.08, 0.07]) for (s = [-1, 1]) chain(
    [[s * 6.2, 3, -0.4], [s * 6, -2, -0.6], [s * 5.2, -7.4, -0.4], [s * 3.8, -12, -0.2], [0, -13, -0.1]],
    [0.45, 0.45, 0.42, 0.4, 0.38]);
  mirror_x() {
    // Big glowing lava eyes sunk into the skull under a heavy stone brow that slants down to the snout.
    eye([4.2, -6.9, 2], 2.5, iris = [1, 0.8, 0.25, GLOW], pupil = [0.15, 0.03, 0.02], sclera = [1, 0.42, 0.06, GLOW], yaw = 12,
        flat = 0.55, lid = 0.45, lid_tilt = 30, lid_c = rock, slit = 0.35);
    color(rockHi) hull() {
      translate([4.9, -5.6, 4.6]) scale([1.7, 2, 0.9]) sphere(1, $fn = 12);
      translate([1.8, -9, 3.3]) scale([0.9, 1.2, 0.6]) sphere(1, $fn = 10);
    }
    limb([5.4, -4.6, 4.9], [2.2, -8.6, 3.8], 0.22, 0.2, lava);
    color(rockDark) translate([1.6, -13.3, 0.9]) scale([0.5, 0.35, 0.4]) sphere(1, $fn = 8);
    // Cheek crack and short stone horns at the back of the skull.
    for (i = [0 : 1]) limb([[5.6, 1, 0.2], [6.2, -1.4, -0.2]][i] + [0.5, 0, 0], [[6.2, -1.4, -0.2], [5.8, -3.6, 0.4]][i] + [0.5, 0, 0], 0.32, 0.32, lava);
    blade([3.4, 3.6, 3.6], [0.25, 0.6, 0.5], 4, 1.6, rockHi);
  }
}
translate([0, -12, 25.5]) rotate([-4, 0, 0]) scale(1.3) head();

// Dorsal ridge: flat stone blades from behind the head down the back, tallest over the shoulders.
for (sp = [[-5, 29.5, 5, 3.4], [1, 26, 7, 4.2], [7.5, 23, 6, 3.8], [13.5, 19, 4.2, 3]])
  mirror_x() blade([2.6, sp[0], sp[1] - 2.4], [0.3, 0.4, 1], sp[2], sp[3], sp[0] > 0 && sp[0] < 10 ? rockHi : rock);
for (sp = [[-2, 28.5, 6, 3.4], [4.5, 25.5, 7.5, 4], [10.5, 21.5, 5.5, 3.4], [16, 17, 3.5, 2.6]])
  blade([0, sp[0], sp[1] - 1.6], [0, 0.45, 1], sp[2], sp[3], rockDark);

// Legs: thick, splayed, elbows and knees out, long-toed clawed feet.
module foot(p, yaw) {
  translate(p) rotate([0, 0, yaw]) {
    color(rockDark) hull() {
      translate([0, 0.5, 1.3]) scale([3.3, 3.3, 1.5]) sphere(1, $fn = 16);
      translate([0, -2, 1.1]) scale([3.5, 2, 1.1]) sphere(1, $fn = 14);
    }
    for (a = [-34, -11, 11, 34]) {
      tip = [sin(a) * 5.5, -cos(a) * 5.8, 0.7];
      limb([sin(a) * 1.5, -1.6, 1.2], tip, 1.05, 0.7, rockDark);
      spike(tip + [0, 0, 0.1], [sin(a) * 0.9, -cos(a) * 1.4, -0.6], 0.55, 0.06, claw);
    }
  }
}
mirror_x() {
  chain([[7, -4, 15], [12, -5.5, 9], [11.8, -7.5, 2.6]], [4.8, 3.9, 3.2], rock);
  plate([12, -5.5, 9], [3.9, 3.9, 3.9], 70, 10, 2.5, rockHi);
  crack([12, -5.5, 9], [3.9, 3.9, 3.9], [[20, 40], [10, 0], [30, -30]], 0.35);
  foot([12, -8.2, 0], -12);
  color(rock) translate([8.4, 10, 12]) scale([4.4, 6, 6.2]) sphere(1, $fn = 22);
  chain([[9.6, 9, 10], [12.4, 8.5, 6], [11.8, 9.4, 2.4]], [4.4, 3.5, 2.9], rock);
  plate([8.4, 10, 12], [4.4, 6, 6.2], 90, 15, 2.8, rockHi);
  foot([12, 8, 0], -16);
}

// Tail: a heavy tail that sweeps back and rises in an S into a hook, cracked all over, its hook dripping lava.
tailPts = [[0, 16, 11], [3, 22, 8], [10, 24.5, 9], [15.5, 22.5, 13.5], [17, 19, 19], [16.5, 16, 25], [15.5, 13, 30]];
tailR = [6.4, 5.4, 4.6, 3.9, 3.4, 3, 2.7];
chain(tailPts, tailR, rock);
chain([for (i = [0 : 3]) tailPts[i] + [0, 0.4, -tailR[i] * 0.4]], [for (i = [0 : 3]) tailR[i] * 0.72], belly);
for (side = [-1, 1]) {
  chain([for (i = [0 : len(tailPts) - 1]) tailPts[i] + [side * tailR[i] * 0.93, 0, (i % 2 == 0 ? 0.7 : -0.7)]],
        [for (i = [0 : len(tailPts) - 1]) 0.4], lava);
}
// Glowing rings between the tail's stone segments.
for (i = [1 : len(tailPts) - 1]) let(d = tailPts[min(i + 1, len(tailPts) - 1)] - tailPts[i - 1])
  color(lava) translate(tailPts[i]) rotate(_dir_rot(d)) scale([1, 1, 0.07]) sphere(tailR[i] + 0.15, $fn = 18);
// Stone plates and a lava net over the tail: on each segment, hexagonal plates on top and the upper flanks with long
// glowing cracks running between them, so it reads as plated rock rather than a tube from behind.
function tnorm(t) = let(u = [0, 0.45, 1], n = u - t * (u * t)) n / norm(n);
module tailNet(pts, R) {
  for (i = [0 : len(pts) - 2]) let(a = pts[i], b = pts[i + 1], t = (b - a) / norm(b - a), n = tnorm(t), bn = cross(t, n),
                                    r = (R[i] + R[i + 1]) / 2, m = (a + b) / 2) {
    for (ang = [-72, 0, 72]) let(dr = n * cos(ang) + bn * sin(ang))
      color((i + ang / 72) % 2 == 0 ? rockHi : rock) translate(m + dr * (r - 0.35)) rotate(_dir_rot(dr)) rotate([0, 0, 30 * i])
        cylinder(h = 0.9, r1 = r * 0.5, r2 = r * 0.36, $fn = 6);
    for (ang = [-36, 36, -108, 108]) let(d0 = n * cos(ang) + bn * sin(ang), dk = n * cos(ang + 12) + bn * sin(ang + 12))
      color(lava) {
        hull() { translate(a + d0 * (R[i] + 0.1)) sphere(0.3, $fn = 6); translate(m + dk * (r + 0.1)) sphere(0.3, $fn = 6); }
        hull() { translate(m + dk * (r + 0.1)) sphere(0.3, $fn = 6); translate(b + d0 * (R[i + 1] + 0.1)) sphere(0.3, $fn = 6); }
      }
  }
}
tailNet(tailPts, tailR);
// The hook: curls over forward, molten on its underside, glowing drips hanging down.
hook = [[15.5, 13, 30], [14.2, 10, 32.6], [12.4, 7, 32.4], [11.4, 5.2, 30.2]];
hookR = [2.7, 2.5, 2.1, 1.5];
chain(hook, hookR, rock);
for (i = [1 : 2]) color(lava) translate(hook[i]) rotate(_dir_rot(hook[i + 1] - hook[i - 1])) scale([1, 1, 0.08]) sphere(hookR[i] + 0.15, $fn = 16);
chain([for (i = [1 : 3]) hook[i] + [0, 0.3, -hookR[i] * 0.45]], [for (i = [1 : 3]) hookR[i] * 0.75], lavaDeep);
ell([1.5, 1.5, 1.5], [11.3, 5.1, 29.6], lava);
for (d = [[11, 5.4, 28.6, 3, 0.6], [12.6, 7, 30.2, 2.6, 0.5], [14, 9.4, 30.4, 1.8, 0.45]]) {
  limb([d[0], d[1], d[2]], [d[0], d[1], d[2] - d[3]], d[4], d[4] * 0.6, lava);
  color(lavaHot) translate([d[0], d[1], d[2] - d[3] - 0.5]) sphere(d[4] * 0.8, $fn = 10);
}
