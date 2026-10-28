// Scalewisp: a lean teal wyvern-pup crouched on all fours: a narrow horned head with ember eyes, a spiny back ridge,
// raised violet bat wings on teal bones and a long whip tail that curls up into a frond of spines.
include <lib.scad>

scale_ = [0.13, 0.6, 0.58];
scaleHi = [0.25, 0.75, 0.7];
scaleDark = [0.06, 0.4, 0.4];
belly = [0.45, 0.72, 0.62];
membrane = [0.72, 0.42, 0.82];
membrane2 = [0.55, 0.3, 0.66];
claw = [0.9, 0.92, 0.88];
ember = [1, 0.42, 0.06, GLOW];
mouth = [0.04, 0.25, 0.25];
socket = [0.02, 0.15, 0.16];
membraneDk = [0.42, 0.2, 0.52];
bellyDk = [0.3, 0.58, 0.5];

// Hard brow ridge over an eye at p (radius s, turned yaw like the eye): a hulled wedge in the skin colour, high at the
// temple and slanting down towards the nose, overhanging the eye so the face itself scowls.
module brow(p, s, yaw, drop, c) {
  translate(p) rotate([0, 0, yaw]) color(c) hull() {
    translate([s * 1.0, s * 0.05, s * 1.25]) scale([s * 0.6, s * 0.7, s * 0.36]) sphere(1, $fn = 12);
    translate([-s * 0.95, -s * 0.25, s * (1.25 - drop)]) scale([s * 0.5, s * 0.62, s * 0.32]) sphere(1, $fn = 12);
    translate([0, s * 0.9, s * 1.1]) scale([s * 1.1, s * 0.6, s * 0.5]) sphere(1, $fn = 12);
  }
}
// Flat scales / plates laid on an ellipsoid (centre cen, radii r): each [azimuth, elevation, size].
module plates(cen, r, list, th = 0.35, c) {
  for (t = list) let(az = t[0], el = t[1], sz = t[2])
    color(c) translate([cen[0] + r[0] * cos(el) * cos(az), cen[1] + r[1] * cos(el) * sin(az), cen[2] + r[2] * sin(el)])
      rotate([0, 0, az]) rotate([0, 90 - el, 0]) scale([sz, sz * 1.15, th]) sphere(1, $fn = 8);
}

// Bat wing: a thick bone arm (shoulder S, elbow E, wrist W) and finger spars fanning from the wrist; the membrane is a
// slab between neighbouring fingers, notched halfway so the trailing edge scallops, plus an inner panel to the flank.
module panel(base, b, c, depth, col, th) {
  ctr = base[0];
  m = ctr + ((b + c) / 2 - ctr) * depth;
  color(col) hull() { for (q = base) translate(q) sphere(th * 1.5, $fn = 8); translate(b) sphere(th, $fn = 8); translate(m) sphere(th, $fn = 8); }
  color(col) hull() { for (q = base) translate(q) sphere(th * 1.5, $fn = 8); translate(m) sphere(th, $fn = 8); translate(c) sphere(th, $fn = 8); }
}
module batwing(S, E, W, tips, root, r = 1, th = 0.35) {
  chain([S, E, W], [r * 1.5, r * 1.15, r], scale_);
  for (f = tips) limb(W, f, r * 0.75, r * 0.3, scale_);
  spike(W, [0, -0.6, 2], r * 0.6, 0.05, scaleHi);
  // Dark teal rim along the leading edge, a hooked thumb claw and claws at the finger tips.
  chain([S + [0, -0.6, 0.5], E + [0, -0.6, 0.6], W + [0, -0.5, 0.5], tips[0] + [0, 0, 0.3]], [r * 1.1, r * 0.85, r * 0.75, r * 0.3], scaleDark);
  chain([W, W + [-1, -1.4, 0.6], W + [-1.7, -2, -0.5]], [r * 0.55, r * 0.35, r * 0.06], claw);
  for (f = tips) spike(f, (f - W) * 0.1, r * 0.32, 0.03, claw);
  // Darker violet shading along each finger, on both faces.
  for (f = tips) for (sd = [-1, 1]) color(membraneDk) hull() {
    translate(W + [0, sd * th * 1.2, 0]) sphere(th * 2.4, $fn = 6);
    translate(W + (f - W) * 0.85 + [0, sd * th * 1.2, 0]) sphere(th * 1.3, $fn = 6);
  }
  color(membrane) hull() for (q = [E, W, tips[0]]) translate(q) sphere(th, $fn = 8);
  for (k = [0 : len(tips) - 2]) panel([W], tips[k], tips[k + 1], 0.84, k % 2 == 0 ? membrane2 : membrane, th);
  panel([W, E, S], tips[len(tips) - 1], root, 0.78, membrane2, th);
}

// Torso: low slung, a deep chest in front and the haunches raised behind.
blob([[[4.6, 5, 4.6], [0, -4, 11]], [[4, 4, 4], [0, 1, 12]], [[4.4, 3.6, 4.4], [0, 5, 12.6]]], scale_);
blob([[[3.4, 3, 2.8], [0, -6.4, 9.4]], [[2.8, 4, 1.8], [0, -1, 8.4]]], belly);

// Belly scutes across the chest; scale rows over the shoulders and haunches.
plates([0, -6.4, 9.4], [3.4, 3, 2.8], [for (el = [-40 : 20 : 40]) [-90, el, 1.6]], 0.3, bellyDk);
mirror_x() {
  plates([4.2, 5, 11], [3.2, 4, 4.4], [for (az = [-30 : 26 : 70]) for (el = [-15 : 20 : 45]) [az + el * 0.4, el, 0.85]], 0.35, scaleDark);
  plates([0, 1, 12], [4, 4, 4], [for (az = [10 : 28 : 90]) for (el = [20 : 22 : 70]) [az, el, 0.85]], 0.35, scaleDark);
  plates([4, -5, 11], [2.6, 3, 3.4], [for (az = [-40 : 30 : 40]) for (el = [-10 : 22 : 35]) [az, el, 0.7]], 0.35, scaleDark);
}

// Neck stretched forward and low.
blob([[[3.2, 3.2, 3.2], [0, -7.6, 13.2]], [[2.4, 2.4, 2.4], [0, -11.6, 12]]], scale_);
color(belly) hull() { translate([0, -9.4, 10.6]) scale([2, 2, 1.6]) sphere(1, $fn = 14); translate([0, -12.2, 10.4]) scale([1.6, 1.4, 1.2]) sphere(1, $fn = 12); }

// Head: a long, flat-topped wedge with a closed jaw, ember eyes under a heavy brow, horns swept back.
module head() {
  color(scale_) hull() {
    translate([0, 0, 0.3]) scale([2.6, 2.6, 2.2]) sphere(1, $fn = 22);
    translate([0, -4.4, -0.1]) scale([2, 1.8, 1.5]) sphere(1, $fn = 18);
    translate([0, -7, -0.5]) scale([1.4, 1, 1.1]) sphere(1, $fn = 14);
  }
  color(belly) hull() {
    translate([0, -0.4, -1.7]) scale([2.1, 2, 1]) sphere(1, $fn = 16);
    translate([0, -6.2, -1.7]) scale([1.2, 0.9, 0.55]) sphere(1, $fn = 12);
  }
  mirror_x() {
    color(mouth) hull() { translate([1.75, -2.4, -1.1]) sphere(0.14, $fn = 6); translate([1.2, -7, -1.1]) sphere(0.12, $fn = 6); }
    color(scaleDark) translate([0.7, -7.7, 0.1]) scale([0.35, 0.25, 0.2]) sphere(1, $fn = 8);
    color(socket) translate([1.75, -2.85, 0.85]) rotate([0, 0, 36]) scale([1.5, 0.6, 1.25]) sphere(1.05, $fn = 14);
    eye([1.7, -2.8, 0.85], 1.25, iris = ember, pupil = [0.2, 0.02, 0.0], sclera = [1, 0.8, 0.3], yaw = 36, flat = 0.5,
        lid = 0.42, lid_tilt = 30, lid_c = socket);
    brow([1.7, -2.8, 0.85], 1.25, 36, 0.72, scale_);
    // Horns and cheek spikes.
    chain([[1.4, 0, 1.8], [2.2, 2.6, 3.4], [2.6, 5, 4.6]], [0.8, 0.5, 0.1], scaleHi);
    spike([2.2, -0.4, -0.8], [1.8, 2.4, -0.2], 0.5, 0.05, scaleHi);
    spike([2.4, 0.6, 0.4], [1.6, 2.4, 0.8], 0.45, 0.05, scale_);
  }
}
translate([0, -12.2, 13.2]) rotate([-6, 0, 0]) scale(1.4) head();

// Spiny ridge from the crown down the neck and back.
for (i = [0 : 8]) let(y = -11 + i * 2.4, z = 15.4 + (i < 4 ? i * 0.8 : 3.2 - (i - 4) * 0.5))
  spike([0, y, z], [0, 1.4, 2.6 - abs(i - 3) * 0.2], 0.75, 0.05, scaleHi);

// Legs: crouched and splayed, bent elbows, clawed paws.
module foot(p) {
  color(scale_) hull() { translate(p) scale([1.5, 1.9, 0.9]) sphere(1, $fn = 14); translate(p + [0, 1, 0.3]) scale([1.2, 1, 0.8]) sphere(1, $fn = 10); }
  for (a = [-32, 0, 32]) spike(p + [sin(a) * 1.1, -1.7, -0.2], [sin(a) * 0.4, -1.1, -0.5], 0.32, 0.05, claw);
}
mirror_x() {
  blob([[[2.6, 3, 3.4], [4, -5, 11]], [[2, 2, 2], [5.6, -4, 7.4]]], scale_);
  limb([5.6, -4, 7.4], [6, -4.4, 4.2], 1.9, 1.6, scale_);
  limb([6, -4.4, 4.2], [5.8, -7.6, 1.4], 1.6, 1.3, scale_);
  foot([5.8, -8.2, 0.9]);
  ell([3.2, 4, 4.4], [4.2, 5, 11], scale_);
  limb([5, 6.4, 8], [5.6, 7.6, 3.6], 2.4, 1.6, scale_);
  limb([5.6, 7.6, 3.6], [5.6, 4.8, 1.3], 1.6, 1.3, scale_);
  foot([5.6, 4.2, 0.9]);
}

// Whip tail: out behind, then sweeping up in a tall arc on the creature's left to a frond of spines.
tailPts = [[0, 8.6, 12.4], [1, 14, 10], [4, 18, 9], [8.4, 19, 12], [11, 17, 18], [11.6, 14, 24], [10.6, 11, 28]];
tailRs = [2.8, 2.2, 1.7, 1.4, 1.1, 0.8, 0.5];
chain(tailPts, tailRs, scale_);
// Scale bands across the tail so it doesn't read as a plain tube.
for (i = [0 : len(tailPts) - 2]) for (u = [0.35, 0.8]) let(d = tailPts[i + 1] - tailPts[i], r = tailRs[i] + (tailRs[i + 1] - tailRs[i]) * u)
  color(scaleDark) translate(tailPts[i] + d * u) rotate(_dir_rot(d)) scale([r * 1.06, r * 1.06, r * 0.28]) sphere(1, $fn = 10);
for (i = [1 : 5]) spike(tailPts[i] + [0, 0, tailRs[i] * 0.7], [-0.6, 0.6, 1.3], 0.45, 0.05, scaleHi);
for (k = [[0, -1, 3], [1.6, -0.4, 2.6], [-1.6, -0.4, 2.6], [1, 1.6, 2.2], [-1, 1.6, 2.2], [0, 2.2, 1.2]])
  spike(tailPts[6], k * 1.3, 0.5, 0.05, k[1] < 0 ? scaleHi : scale_);

// Wings: raised and swept back, the near one high, violet scalloped membrane on teal bones.
mirror_x() batwing([3.6, -2, 15.6], [10, -2.6, 21.6], [14, -1, 29.6],
  [[24, 2.6, 29], [24.6, 6.6, 21], [20, 8.6, 14.6], [13, 8.4, 12.4]], [4.4, 5, 14], r = 0.9);
