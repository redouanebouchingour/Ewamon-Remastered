// Caldermole: Coalette grown into an upright magma kaiju. Charcoal plated hide split by glowing lava cracks, a molten
// heart blazing through its chest, a mane of flames down its back and on its brow, heavy clawed arms, pillar legs and
// a long segmented tail curling up into a tall flame.
include <lib.scad>

coal = [0.22, 0.19, 0.23];
coalHi = [0.33, 0.29, 0.34];
coalDark = [0.13, 0.11, 0.13];
crack = [1, 0.62, 0.1];
crackRed = [0.95, 0.32, 0.05];
coreHi = [1, 0.88, 0.45];
flameRed = [0.9, 0.22, 0.05];
flameOrange = [1, 0.55, 0.08];
flameCore = [1, 0.88, 0.35];
claw = [0.88, 0.78, 0.6];

// A licking flame from p along d, base radius r: a yellow-hot root, then a fan of separate licks (a tall wavy centre
// one and two pairs of shorter ones swept out to the sides), each orange tapering into a sharp red point.
module lick(p, d, sd, r, c0) {
  m1 = p + d * 0.4 + sd * r * 0.35;
  m2 = p + d * 0.72 - sd * r * 0.2;
  color(c0) hull() { translate(p) sphere(r, $fn = 10); translate(m1) sphere(r * 0.62, $fn = 8); }
  color(flameOrange) hull() { translate(m1) sphere(r * 0.62, $fn = 8); translate(m2) sphere(r * 0.3, $fn = 6); }
  color(flameRed) hull() { translate(m2) sphere(r * 0.3, $fn = 6); translate(p + d + sd * r * 0.3) sphere(0.04, $fn = 4); }
}
module flame(p, d, r) {
  side = [d[1], -d[0], 0] / max(norm([d[0], d[1]]), 0.001);
  sd = norm([d[0], d[1]]) < 0.3 ? [1, 0, 0] : side;
  dep = cross(d / norm(d), sd);
  color(flameCore) hull() { translate(p + d * 0.06) sphere(r * 0.72, $fn = 10); translate(p + d * 0.26) sphere(r * 0.3, $fn = 8); }
  lick(p + d * 0.05, d, sd, r * 0.9, flameOrange);
  for (s = [-1, 1]) {
    lick(p + d * 0.12 + sd * s * r * 0.5, d * 0.72 + sd * s * r * 2.3, sd * s, r * 0.6, flameOrange);
    lick(p + d * 0.06 + sd * s * r * 0.7 + dep * s * r * 0.3, d * 0.42 + sd * s * r * 3, -sd * s, r * 0.45, flameRed);
  }
}
// A glowing lava crack along a polyline.
module crackline(pts, r = 0.32) {
  for (i = [0 : len(pts) - 2]) color(crack) hull() { translate(pts[i]) sphere(r, $fn = 6); translate(pts[i + 1]) sphere(r, $fn = 6); }
}
// Point on an ellipsoid (centre c, radii r) at azimuth az (0 = -Y front, 90 = +X) and elevation el, pushed out by g.
function onEll(c, r, az, el, g = 0.12) =
  [c[0] + (r[0] + g) * cos(el) * sin(az), c[1] - (r[1] + g) * cos(el) * cos(az), c[2] + (r[2] + g) * sin(el)];
module crackOn(c, r, pts, w = 0.32) crackline([for (q = pts) onEll(c, r, q[0], q[1])], w);

chestC = [0, -3.5, 21]; chestR = [7.8, 6.6, 7.4];
bellyC = [0, 0, 14.5]; bellyR = [8.6, 7.6, 7];

// Upper body (torso, head, mane, arms), pitched forward over the hips like the sprite.
module upper() {
// Torso: massive shoulders over a deep chest and a heavy belly and hips.
color(coal) hull() {
  translate(chestC) scale(chestR) sphere(1, $fn = 28);
  translate(bellyC) scale(bellyR) sphere(1, $fn = 28);
  translate([0, 3, 10]) scale([8.6, 7.4, 5]) sphere(1, $fn = 24);
  translate([0, 1.5, 25.5]) scale([5.4, 5.4, 5]) sphere(1, $fn = 24);
}
// Molten heart: a branching glow in the chest.
color(crackRed) translate(onEll(chestC, chestR, 0, -12, -1.2)) rotate([12, 0, 0]) scale([3.4, 1.4, 4.6]) sphere(1, $fn = 14);
color(crack) translate(onEll(chestC, chestR, 0, -12, -0.7)) rotate([12, 0, 0]) scale([2, 1, 3]) sphere(1, $fn = 12);
color(coreHi) translate(onEll(chestC, chestR, 0, -12, -0.2)) rotate([12, 0, 0]) scale([0.9, 0.5, 1.6]) sphere(1, $fn = 10);
// Rays branching out of the heart.
mirror_x() for (r = [[[4, 0], [14, 14], [20, 30]], [[4, -10], [16, -8], [26, -4]], [[3, -22], [12, -34], [20, -44]],
                     [[0, 2], [4, 18], [2, 32]]])
  crackOn(chestC, chestR, r, 0.5);
mirror_x() {
  crackOn(chestC, chestR, [[5, 15], [22, 30], [35, 48], [55, 55]], 0.4);
  crackOn(chestC, chestR, [[8, -5], [28, -2], [48, 8], [65, 2]], 0.4);
  crackOn(chestC, chestR, [[8, -20], [24, -30], [40, -28]], 0.38);
  crackOn(chestC, chestR, [[28, -2], [32, 15], [50, 25]]);
  crackOn(chestC, chestR, [[40, 60], [70, 40], [85, 15], [80, -15]], 0.3);
  // Belly plates: horizontal seams and a centre line.
  crackOn(bellyC, bellyR, [[0, -15], [25, -12], [50, -16], [70, -10]], 0.28);
  crackOn(bellyC, bellyR, [[0, -40], [25, -38], [48, -42]], 0.28);
  crackOn(bellyC, bellyR, [[25, -12], [25, -38]], 0.28);
  // Flanks and back.
  crackOn(bellyC, bellyR, [[90, 20], [100, -5], [120, -25], [140, -10]]);
  crackOn(chestC, chestR, [[100, 30], [120, 5], [150, 0], [165, -20]]);
  crackOn(chestC, chestR, [[120, 5], [135, 35]]);
  crackOn(bellyC, bellyR, [[150, 30], [160, 0], [150, -30]]);
}

// Neck: thick, sloping up and forward from the shoulders.
blob([[[6.4, 6, 6], [0, -2, 26]], [[5.4, 4.6, 4.6], [0, -8, 31]]], coal);

// Head: a kaiju's head, not a ball: a low skull drawn into a blunt snout over a heavy jaw, a mouth line that turns up
// into a grin, big glowing lava eyes sunk under heavy brow ridges that slant down to the nose.
module head() {
  color(coal) hull() {
    translate([0, 1.5, 1]) scale([4.8, 4.2, 3.2]) sphere(1, $fn = 24);
    translate([0, -4, 0.8]) scale([4.2, 3.4, 2.5]) sphere(1, $fn = 20);
    translate([0, -9, 0]) scale([3.2, 1.8, 1.9]) sphere(1, $fn = 16);
  }
  color(coalHi) hull() {
    translate([0, 0, -2]) scale([4.6, 3.8, 2.2]) sphere(1, $fn = 20);
    translate([0, -7.8, -1.3]) scale([3, 2, 1.3]) sphere(1, $fn = 16);
  }
  color(coalDark) for (s = [-1, 1]) chain(
    [[s * 4.6, 1.4, 0.4], [s * 4.6, -1.4, -0.5], [s * 4, -5.4, -0.4], [s * 2.8, -8.8, -0.2], [0, -9.6, -0.1]],
    [0.34, 0.34, 0.32, 0.3, 0.28]);
  mirror_x() {
    // Fangs peeking out of the grin.
    for (f = [[3.6, -5, -0.6], [2.2, -8.2, -0.4]]) spike(f, [0, -0.1, -1], 0.42, 0.05, claw);
    eye([3.1, -5.9, 2.0], 1.75, iris = [1, 0.85, 0.3, GLOW], pupil = [0.2, 0.04, 0.02], sclera = [1, 0.45, 0.05, GLOW],
        yaw = 6, flat = 0.55, lid = 0.4, lid_tilt = 30, lid_c = coal, slit = 0.35);
    // Brow ridge: a heavy plated overhang slanting down to the nose, a crack along its crest.
    color(coal) hull() {
      translate([4, -3.8, 3.9]) scale([1.2, 1.5, 0.7]) sphere(1, $fn = 12);
      translate([1.2, -6.4, 3.1]) scale([0.7, 0.9, 0.5]) sphere(1, $fn = 10);
    }
    crackline([[4.5, -2.8, 4.5], [2.8, -5, 4.1], [1.4, -6.6, 3.5]], 0.18);
    color(coalDark) translate([1.2, -9.9, 0.9]) scale([0.4, 0.3, 0.35]) sphere(1, $fn = 8);
    crackline([[4.2, 0, 2.4], [4.8, 2.4, 1], [4.5, 4, -1]], 0.22);
  }
}
translate([0, -10.5, 32]) rotate([-14, 0, 0]) scale(1.25) head();
// Flame crest on the brow, streaming back.
flame([0, -10.5, 33.6], [0, 4.5, 7], 2.4);
mirror_x() flame([2.6, -8.5, 33.2], [1.6, 3.6, 5.5], 1.7);

// Dorsal flames: a blazing mane from the back of the head down the spine, tallest over the shoulders.
for (i = [0 : 3]) {
  y = 1 + i * 3; z = 30.5 - i * 5.2; h = 11 - abs(i - 1) * 1.6;
  flame([0, y, z], [0, 3.5, h], 3 - i * 0.2);
  if (i == 1 || i == 2) mirror_x() flame([3.4, y - 0.6, z - 1.4], [2, 2.6, h * 0.7], 2.2);
}

// Arms: heavy shoulders, forearms hanging forward, big pale claws curling down.
mirror_x() {
  color(coal) translate([8.4, -2, 24]) scale([3.8, 4, 4]) sphere(1, $fn = 20);
  chain([[8.8, -2, 23.5], [11.4, -4, 18], [11, -8, 14.8]], [3.4, 2.9, 2.6], coal);
  crackline([[11.6, -6, 17.6], [12.6, -4.4, 20], [11.8, -3, 23]], 0.26);
  crackline([[11.6, -7.6, 15.4], [13.4, -6, 16.8]], 0.24);
  ell([2.8, 2.6, 2.2], [11, -9.4, 13.6], coal);
  for (a = [-35, 0, 35]) chain([[11 + sin(a) * 1.8, -11, 13.6], [11 + sin(a) * 2.2, -12.6, 12.2], [11 + sin(a) * 2.2, -12.2, 10.4]],
                              [0.65, 0.45, 0.06], claw);
}

}
translate([0, 2, 9]) rotate([14, 0, 0]) translate([0, -2, -9]) upper();

// Legs: huge plated thighs, thick pillar shins, broad clawed feet, cracks between the plates.
mirror_x() {
  color(coal) translate([7.4, 1, 10]) scale([5.8, 6.6, 7]) sphere(1, $fn = 22);
  crackOn([7.4, 1, 10], [5.8, 6.6, 7], [[30, 40], [60, 10], [70, -25], [55, -50]], 0.3);
  crackOn([7.4, 1, 10], [5.8, 6.6, 7], [[60, 10], [100, 15], [130, 0]], 0.3);
  limb([7.8, -0.5, 6], [8, -1.2, 2.6], 4.2, 4, coal);
  blob([[[4.2, 5.2, 2], [8, -3, 2]], [[3.6, 3, 1.8], [8, 0.8, 1.9]]], coalHi);
  for (a = [-30, 0, 30]) spike([8 + sin(a) * 2.4, -7.8, 1.3], [sin(a) * 0.6, -1.8, -0.7], 0.75, 0.05, claw);
}

// Tail: long and thick, sliding back along the ground, then rising behind to the viewer's right into a tall flame.
tail = [[0, 7, 10], [2.5, 14, 5.5], [8, 19, 4.5], [14, 19, 6], [18.5, 15.5, 10], [20, 11.5, 16], [20, 9.5, 21.5], [19.5, 9, 25]];
tailR = [6.2, 5.4, 4.6, 3.9, 3.3, 2.7, 2.2, 1.8];
chain(tail, tailR, coal);
// Segment rings glowing between the tail plates, and a seam down each side.
for (i = [1 : len(tail) - 2])
  color(crack) translate(tail[i]) rotate(_dir_rot(tail[i + 1] - tail[i - 1])) scale([1, 1, 0.1]) sphere(tailR[i] + 0.25, $fn = 18);
for (s = [-1, 1]) chain([for (i = [0 : len(tail) - 1]) tail[i] + [s * tailR[i] * 0.9, 0, 0]], [for (i = tail) 0.3], crack);
// Raised scutes on each segment's outer curve, a pale ridge plate on top of each, and a crack zigzag over them, so
// the tail reads as plated from behind rather than a smooth tube.
function tnorm(t) = let(u = [0, 0.45, 1], n = u - t * (u * t)) n / norm(n);
for (i = [0 : len(tail) - 2]) let(a = tail[i], b = tail[i + 1], t = (b - a) / norm(b - a), n = tnorm(t),
                                  r = (tailR[i] + tailR[i + 1]) / 2, m = (a + b) / 2) {
  color(i % 2 == 0 ? coalHi : coal) hull() {
    translate(a + (b - a) * 0.2 + n * r * 0.72) sphere(r * 0.42, $fn = 10);
    translate(a + (b - a) * 0.8 + n * r * 0.72) sphere(r * 0.38, $fn = 10);
  }
  for (s = [-1, 1]) let(sd = cross(t, n) * s)
    color(coalHi) hull() {
      translate(a + (b - a) * 0.25 + sd * r * 0.62 + n * r * 0.42) sphere(r * 0.34, $fn = 8);
      translate(a + (b - a) * 0.75 + sd * r * 0.6 + n * r * 0.4) sphere(r * 0.3, $fn = 8);
    }
  crackline([a + n * (r * 1.12), m + n * (r * 1.12) + cross(t, n) * r * 0.3, b + n * (tailR[i + 1] * 1.12)], 0.22);
}
// Small flames along the top of the tail.
flame([5, 17, 9.6], [0, 1.5, 5.5], 1.9);
flame([13, 20, 9], [0.8, 0.8, 4.6], 1.6);
// The tail's flame: tall and wide.
flame([19.5, 9, 25], [-0.5, -0.5, 15], 4.8);
flame([21.8, 9.6, 25], [3, 0.5, 8], 2.8);
