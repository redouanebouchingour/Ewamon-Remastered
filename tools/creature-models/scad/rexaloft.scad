// Rexaloft: Scalewisp grown into an upright emerald dragon: a lean S-curved standing body with a pale-green banded
// belly, a wedge head framed by a spined fin frill, a horn sweeping back and up into a hook, huge deep-blue bat wings
// that reach the ground and a heavy tail curling round its feet.
include <lib.scad>

scale_ = [0.12, 0.54, 0.3];
scaleHi = [0.3, 0.74, 0.45];
scaleDark = [0.05, 0.32, 0.18];
belly = [0.45, 0.8, 0.5];
bellyLine = [0.22, 0.6, 0.34];
membrane = [0.17, 0.22, 0.62];
membrane2 = [0.11, 0.14, 0.44];
claw = [0.85, 0.9, 0.82];
eyeGlow = [1, 0.85, 0.2, GLOW];
mouth = [0.04, 0.2, 0.12];
socket = [0.02, 0.12, 0.07];
membraneDk = [0.07, 0.09, 0.3];

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
module batwing(S, E, W, tips, root, r = 1, th = 0.4) {
  chain([S, E, W], [r * 1.5, r * 1.15, r], scaleHi);
  for (f = tips) limb(W, f, r * 0.85, r * 0.32, scaleHi);
  spike(W, [0, -0.4, 2.6], r * 0.7, 0.05, scaleHi);
  // Dark rim along the leading edge, a hooked thumb claw and claws at the finger tips.
  chain([S + [0, -0.6, 0.5], E + [0, -0.6, 0.6], W + [0, -0.5, 0.5], tips[0] + [0, 0, 0.3]], [r * 1.1, r * 0.85, r * 0.75, r * 0.3], scaleDark);
  chain([W, W + [-1.1, -1.5, 0.6], W + [-1.8, -2.2, -0.6]], [r * 0.55, r * 0.35, r * 0.06], claw);
  for (f = tips) spike(f, (f - W) * 0.1, r * 0.32, 0.03, claw);
  // Darker membrane shading along each finger, on both faces.
  for (f = tips) for (sd = [-1, 1]) color(membraneDk) hull() {
    translate(W + [0, sd * th * 1.2, 0]) sphere(th * 2.4, $fn = 6);
    translate(W + (f - W) * 0.85 + [0, sd * th * 1.2, 0]) sphere(th * 1.3, $fn = 6);
  }
  color(membrane) hull() for (q = [E, W, tips[0]]) translate(q) sphere(th, $fn = 8);
  for (k = [0 : len(tips) - 2]) panel([W], tips[k], tips[k + 1], 0.84, k % 2 == 0 ? membrane2 : membrane, th);
  panel([W, E, S], tips[len(tips) - 1], root, 0.8, membrane2, th);
}

// Torso: upright and S-curved, chest thrust forward, a narrow waist, haunches behind.
blob([[[4.8, 4.2, 4.6], [0, -1.2, 25]], [[3.8, 3.6, 4], [0, -0.4, 19.5]], [[3.6, 3.4, 3.4], [0, 0.4, 15]]], scale_);
blob([[[4.6, 4.4, 4], [0, 1.4, 12.6]]], scale_);
blob([[[3.3, 2, 3.6], [0, -3.3, 24.2]], [[2.2, 1.9, 3], [0, -2.5, 18]], [[1.4, 1.6, 1.6], [0, -2.2, 13.4]]], belly);
for (z = [13.4 : 1.9 : 27]) color(bellyLine) translate([0, -4.1 - (z - 13) * 0.05 + abs(z - 23.6) * 0.03, z]) scale([1.3 + (z - 13) * 0.14, 0.5, 0.22]) sphere(1, $fn = 12);

// Scale rows on the flanks, back and thighs (darker green) so the body isn't a smooth tube from behind.
mirror_x() {
  plates([0, -1.2, 25], [4.8, 4.2, 4.6], [for (az = [-10 : 22 : 100]) for (el = [-20 : 20 : 40]) [az + el * 0.3, el, 1.05]], 0.35, scaleDark);
  plates([0, 0.4, 16], [3.7, 3.5, 3.8], [for (az = [0 : 25 : 100]) for (el = [-20 : 25 : 30]) [az, el, 0.95]], 0.35, scaleDark);
  plates([0, 1.4, 12.6], [4.6, 4.4, 4], [for (az = [20 : 25 : 100]) for (el = [0 : 25 : 50]) [az, el, 1]], 0.35, scaleDark);
}

// Neck: an S rising from the chest, pale throat in front.
chain([[0, -0.6, 27.5], [0, -1.6, 31], [0, -3.6, 33.6]], [3.1, 2.5, 2.3], scale_);
chain([[0, -2.8, 27.4], [0, -3.6, 30.6], [0, -5, 32.6]], [1.9, 1.6, 1.4], belly);

// Head: a narrow wedge, brow ridge over glowing yellow eyes, closed jaw with a pale chin.
module head() {
  color(scale_) hull() {
    translate([0, 0, 0.3]) scale([2.6, 2.6, 2.3]) sphere(1, $fn = 22);
    translate([0, -4.4, -0.3]) scale([1.8, 1.8, 1.4]) sphere(1, $fn = 18);
    translate([0, -6.8, -0.8]) scale([1.3, 0.9, 1]) sphere(1, $fn = 14);
  }
  color(belly) hull() {
    translate([0, -0.6, -1.8]) scale([2, 2, 1]) sphere(1, $fn = 16);
    translate([0, -6, -2]) scale([1.1, 0.8, 0.55]) sphere(1, $fn = 12);
  }
  // Mouth line along the jaw.
  mirror_x() color(mouth) hull() { translate([1.6, -2.6, -1.3]) sphere(0.22, $fn = 6); translate([1.05, -6.8, -1.4]) sphere(0.2, $fn = 6); }
  color(scaleHi) hull() { translate([0, -2.4, 2.1]) scale([1.1, 1.6, 0.6]) sphere(1, $fn = 12); translate([0, -6.6, 0.1]) scale([0.6, 0.7, 0.4]) sphere(1, $fn = 10); }
  mirror_x() {
    color(scaleDark) translate([0.65, -7.5, -0.1]) scale([0.35, 0.25, 0.2]) sphere(1, $fn = 8);
    color(socket) translate([1.7, -2.85, 0.85]) rotate([0, 0, 36]) scale([1.5, 0.6, 1.25]) sphere(1.05, $fn = 14);
    eye([1.65, -2.8, 0.85], 1.25, iris = eyeGlow, pupil = [0.1, 0.04, 0.0], sclera = [0.95, 0.6, 0.1, GLOW], yaw = 36, flat = 0.5,
        lid = 0.42, lid_tilt = 32, lid_c = socket);
    brow([1.65, -2.8, 0.85], 1.25, 36, 0.75, scale_);
    // Cheek spikes.
    spike([2.2, -0.6, -1], [2, 2.4, -0.8], 0.5, 0.05, scaleHi);
  }
}
translate([0, -4.4, 35.4]) rotate([-4, 0, 0]) scale(1.15) head();

// Fin frill: spines fanning round the back of the head, light-green webbing between them.
frillC = [0, -3.6, 36];
frill = [for (a = [-75 : 25 : 75]) [sin(a) * 8, 1.6 + abs(sin(a)) * 0.6, 36 + cos(a) * 7 - 1]];
for (k = [0 : len(frill) - 2]) panel([frillC], frill[k], frill[k + 1], 0.86, scaleHi, 0.3);
mirror_x() for (a = [70, 95]) let(t = [sin(a) * 5.6, 0.6, 36 + cos(a) * 4.6 - 1])
  color(scaleHi) hull() { translate(frillC) sphere(0.45, $fn = 8); translate(t) sphere(0.3, $fn = 6); translate(t + [0, 0, 1.4]) sphere(0.3, $fn = 6); }
for (f = frill) limb(frillC, f, 0.5, 0.14, scale_);
// Horn: sweeping back off the crown, then up and over into a hook.
chain([[0, -1.4, 38.2], [0, 1, 41], [0.4, 2, 45], [1, 0.6, 48.6], [1.4, -2.4, 49.6], [1.6, -4.4, 48], [1.6, -4, 46]],
      [1.3, 1.1, 0.95, 0.8, 0.65, 0.45, 0.15], scale_);

// Spines down the back of the neck and spine.
for (i = [0 : 6]) spike([0, 2.6 + (i > 1 ? 1.2 : 0) - i * 0.1, 33 - i * 3], [0, 2, 0.9], 0.8, 0.1, scaleHi);

// Arms: lean, bent, clawed hands held forward.
mirror_x() {
  ell([1.9, 2.2, 2.2], [4.2, -1, 25.2], scale_);
  chain([[4.8, -1, 24.6], [6.8, -1, 20.4], [5.4, -5.4, 18.4]], [1.6, 1.2, 1], scale_);
  for (a = [-35, 0, 35]) chain([[5.4, -5.8, 18.2], [5.4 + sin(a) * 1.4, -7.2, 17.8], [5.4 + sin(a) * 1.6, -7.6, 16.6]], [0.45, 0.35, 0.08], claw);
}

// Legs: digitigrade, thick thighs, thin shins, long clawed feet; the left one stepped forward.
module leg(hip, knee, ankle, toe) {
  ell([2.8, 3.6, 4], hip, scale_);
  plates(hip, [2.8, 3.6, 4], [for (az = [-40 : 30 : 80]) for (el = [-20 : 22 : 30]) [hip[0] > 0 ? az : 180 - az, el, 0.8]], 0.35, scaleDark);
  chain([hip, knee, ankle, toe], [3, 2, 1.3, 1.1], scale_);
  for (a = [-32, 0, 32]) spike(toe + [sin(a) * 0.8, -0.6, -0.2], [sin(a) * 1, -1.8, -0.4], 0.45, 0.05, claw);
}
leg([3.6, 1, 12], [5, -3.6, 8], [5.2, 1.2, 3.4], [5.2, -2.4, 0.9]);
leg([-3.6, 1, 12], [-5.2, -1.6, 7.6], [-5.4, 3, 3.4], [-5.2, 0, 0.9]);

// Huge deep-blue wings: the arm rises high above the shoulders, the fingers drop nearly to the ground.
mirror_x() batwing([4, 2.4, 26], [10.5, 5.4, 34], [15, 6.6, 42],
  [[24.5, 8, 39], [25.5, 11, 28], [23, 11, 17], [19, 9, 8], [13.6, 6, 6]], [4.4, 2.8, 14], r = 1);

// Heavy tail: down behind and curling round to the creature's left at its feet, spined on top.
tailPts = [[0, 4, 12], [1, 9, 7.4], [5, 12, 4.6], [11, 11, 3.6], [14, 6, 4.4], [13, 1, 6.6], [10.6, -1, 8.6]];
tailRs = [3.6, 3, 2.5, 2.1, 1.6, 1.1, 0.5];
chain(tailPts, tailRs, scale_);
// Pale belly plates under the tail and darker scale bands across it.
color(belly) for (i = [0 : 4]) hull() { translate(tailPts[i] + [0, 0, -tailRs[i] * 0.45]) sphere(tailRs[i] * 0.62, $fn = 10); translate(tailPts[i + 1] + [0, 0, -tailRs[i + 1] * 0.45]) sphere(tailRs[i + 1] * 0.62, $fn = 10); }
for (i = [0 : len(tailPts) - 2]) for (u = [0.35, 0.8]) let(d = tailPts[i + 1] - tailPts[i], r = tailRs[i] + (tailRs[i + 1] - tailRs[i]) * u)
  color(scaleDark) translate(tailPts[i] + d * u) rotate(_dir_rot(d)) scale([r * 1.06, r * 1.06, r * 0.28]) sphere(1, $fn = 10);
for (i = [1 : 5]) spike(tailPts[i] + [0, 0, tailRs[i] * 0.7], [0, 0, 1.6], 0.6, 0.1, scaleHi);
