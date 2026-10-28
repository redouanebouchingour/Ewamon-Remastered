// Toxshade Majin: Toxshade corrupted. Magenta crystal spikes burst from its back, glowing red cracks web the black fur
// from a burning core in its chest, the eyes and drool turn blood red, and the tail ends in a barbed hook.
include <lib.scad>

fur = [0.23, 0.24, 0.26];
furHi = [0.42, 0.44, 0.47];
furDk = [0.11, 0.11, 0.14];
skin = [0.4, 0.33, 0.39];
ear = [0.58, 0.44, 0.5];
tox = [0.48, 0.26, 0.72];
toxHi = [0.64, 0.42, 0.88];
crystal = [0.72, 0.12, 0.42];
crystalHi = [0.95, 0.3, 0.6];
red = [1, 0.12, 0.08];
redHi = [1, 0.6, 0.35];
eyeV = [1, 0.1, 0.06, GLOW];
eyeHi = [1, 0.55, 0.3, GLOW];
smog = [0.27, 0.3, 0.3];
smogHi = [0.38, 0.41, 0.4];
fang = [0.95, 0.93, 0.86];

// A shaggy lock of fur: flat at the root, tapering to a point along d.
module tuft(p, d, r, c) {
  color(c) hull() { translate(p) scale([1, 0.6, 1]) sphere(r, $fn = 8); translate(p + d) sphere(0.12, $fn = 4); }
}
// A flat toxin blotch lying on a surface with outward normal n.
module blotch(p, n, s) {
  rot = _dir_rot(n);
  color(tox) translate(p) rotate(rot) scale([1, 0.75, 0.25]) sphere(s, $fn = 12);
  color(tox) translate(p) rotate(rot) translate([s * 0.6, s * 0.5, 0]) scale([0.6, 0.5, 0.25]) sphere(s, $fn = 10);
  color(toxHi) translate(p + n / norm(n) * 0.25) rotate(rot) translate([-s * 0.2, s * 0.15, 0]) scale([0.45, 0.25, 0.2]) sphere(s, $fn = 8);
}

// Body: a hunched mound, haunches low at the back, the spine arching up to the shoulders, which hang forward.
blob([[[9.5, 8.5, 8], [0, 5, 9]], [[10, 9, 9], [0, 3.5, 18]], [[8.5, 7, 6], [0, -2.5, 22]], [[5.5, 5, 4.5], [0, -7, 21]]], fur);
// Paler chest and belly under the shoulders.
blob([[[6, 3, 6], [0, -4.5, 15]], [[5, 3, 4], [0, -5.5, 20]]], furHi);

// Head, scaled up about the neck.
translate([0, -1, 22]) scale(1.18) translate([0, 0, -22]) {
// Head: a rat's wedge, low and thrust forward, the long snout tapering to a pink nose.
color(fur) hull() {
  translate([0, -9, 23]) scale([5, 5, 4.4]) sphere(1, $fn = 24);
  translate([0, -14, 21.2]) scale([3.2, 3.4, 2.8]) sphere(1, $fn = 18);
  translate([0, -19.4, 19.6]) scale([1.3, 1.4, 1.2]) sphere(1, $fn = 12);
}
ell([0.9, 0.8, 0.8], [0, -20.6, 19.9], skin);
// Snarl: the lower jaw dropped open under the snout, long rat fangs, violet drool.
color(furDk) hull() {
  translate([0, -12, 19.6]) scale([3, 3, 1.4]) sphere(1, $fn = 14);
  translate([0, -17.4, 18]) scale([1, 1, 0.7]) sphere(1, $fn = 10);
}
color([0.3, 0.12, 0.25]) hull() {
  translate([0, -13.6, 20]) scale([2.2, 2, 0.6]) sphere(1, $fn = 12);
  translate([0, -17.4, 19]) scale([0.9, 0.8, 0.5]) sphere(1, $fn = 8);
}
mirror_x() spike([0.6, -19, 19.2], [0, -0.2, -1.8], 0.42, 0.05, fang);
mirror_x() spike([1.6, -16.5, 19.4], [0, 0, -1.2], 0.35, 0.05, fang);
for (d = [[-1.6, -15.5, 4], [0.3, -18.5, 3], [1.7, -15, 5.5]]) limb([d[0], d[1], 19], [d[0], d[1], 19 - d[2]], 0.5, 0.3, red);
// Blood-red eyes sunk in dark sockets under a hard brow that slants down to the snout: a scowl.
mirror_x() {
  color(furDk) translate([2.75, -13.2, 23.2]) rotate([0, 0, -35]) scale([2.1, 1, 1.9]) sphere(1, $fn = 16);
  eye([2.55, -13.6, 23.2], 1.75, iris = eyeHi, sclera = eyeV, pupil = [0.25, 0, 0], yaw = -35, flat = 0.5,
      lid = 0.48, lid_tilt = 30, lid_c = furDk, slit = 0.35);
  color(fur) hull() {
    translate([4.4, -11.6, 25.2]) scale([1.2, 1.5, 0.75]) sphere(1, $fn = 10);
    translate([1.3, -14.9, 24.3]) scale([0.8, 1.1, 0.55]) sphere(1, $fn = 8);
  }
}
// A red rune ring round the right eye.
color(red) translate([-2.75, -14.1, 23.3]) rotate([0, 0, -35]) rotate([90, 0, 0]) difference() {
  cylinder(h = 0.6, r = 2.5, center = true, $fn = 20);
  cylinder(h = 1, r = 2.05, center = true, $fn = 20);
}
// Shaggy cheek tufts sweeping back under the ears.
mirror_x() for (k = [0 : 2]) tuft([4.2 + k * 0.4, -11 + k * 1.8, 21.6 - k * 0.6], [2.2, 1.6, -2.4], 1.4, k == 1 ? furHi : fur);
// Whiskers.
mirror_x() for (a = [-12, 6]) color(furHi) translate([1.2, -18.4, 19.8]) rotate([a, 0, -15]) rotate([0, 90, 0]) cylinder(h = 5, r = 0.12, $fn = 5);
// Round ears at the back of the head.
mirror_x() {
  petal([2.4, 0.8, 2.6], [4.4, -6.4, 27.2], [10, 0, -25], fur);
  petal([1.7, 0.4, 1.9], [4.4, -7, 27.2], [10, 0, -25], ear);
}
}

// Shaggy fur hanging off the flanks and haunches, so the mound has a ragged edge.
for (row = [0 : 2]) for (i = [0 : 9]) let(a = -40 + i * 26 + row * 12, z = 20 - row * 6,
                                          p = [9.2 * sin(a), 4 + 8.6 * cos(a) * (cos(a) > 0 ? 1 : 0.8), z])
  tuft(p, [sin(a) * 2, cos(a) * 1.5, -5.5], 1.7, (i + row) % 3 ? fur : furDk);
// The smoky mane: thick ragged locks streaming up and back from the crown, neck and spine, the tips flicking aside.
module wisp(p, h, lean, curl, r, c) {
  m = p + [lean * 0.5, h * 0.45, h * 0.55];
  t = p + [lean + curl, h * 0.95, h * 0.9];
  color(c) {
    hull() { translate(p) sphere(r, $fn = 8); translate(m) sphere(r * 0.6, $fn = 8); }
    hull() { translate(m) sphere(r * 0.6, $fn = 8); translate(t) sphere(0.15, $fn = 4); }
  }
}
for (w = [[-2, -7, 26.5, 7, -2, -2], [2, -6, 27, 8, 2, 2], [-4, -1, 26.5, 9, -3, -2], [4, 0, 26.5, 10, 3, 2], [-6, 4, 24, 8, -4, -2], [6, 5, 24, 9, 4, 2],
          [-4, 10, 20, 7, -3, -2], [4, 10, 20, 7, 3, 2], [-8, 0, 22, 6, -4, -1], [8, 1, 22, 6, 4, 1]])
  wisp([w[0], w[1], w[2]], w[3], w[4], w[5], 2.4, (w[0] + w[1]) % 3 == 0 ? furDk : fur);

// Violet toxin blotches over the back, shoulders and haunches, placed on the hump and haunch ellipsoids.
function onEll(c, r, az, el, k = 1.04) = c + [r[0] * k * cos(el) * sin(az), -r[1] * k * cos(el) * cos(az), r[2] * k * sin(el)];
function nEll(r, az, el) = [cos(el) * sin(az) / r[0], -cos(el) * cos(az) / r[1], sin(el) / r[2]];
hump = [[10, 9, 9], [0, 3.5, 18]];
haunch = [[9.5, 8.5, 8], [0, 5, 9]];
// Streaky fur over the hump and haunches: rows of flat locks lying back and down, lighter and darker streaks mixed
// in so the back is not one smooth blob.
for (row = [0 : 3]) for (i = [0 : 10]) let(el = 50 - row * 18, az = -150 + i * 30 + (row % 2) * 15,
                                           e = row < 3 ? hump : haunch, q = onEll(e[1], e[0], az, row < 3 ? el : 10, 1),
                                           o = [sin(az), -cos(az), 0], k = (i * 5 + row * 3) % 4)
  if (abs(az) > 45) color(k == 0 ? furHi : k == 1 ? furDk : fur) hull() {
    translate(q) rotate([0, 0, az]) scale([1.8, 0.6, 1.4]) sphere(1, $fn = 8);
    translate(q + o * 1.6 + [0, 0, -4.5 - k * 0.6]) sphere(0.15, $fn = 4);
  }
for (b = [[hump, -70, 30, 2.2], [hump, 110, 35, 2], [hump, 170, 20, 2.4], [hump, -150, 45, 2], [hump, -100, 5, 2.2],
          [hump, 90, 0, 2.2], [haunch, -120, -5, 2], [haunch, 135, 5, 2.2], [haunch, 75, -10, 2.4], [hump, 40, 40, 1.6]])
  blotch(onEll(b[0][1], b[0][0], b[1], b[2]), nEll(b[0][0], b[1], b[2]), b[3]);

// Magenta crystal spikes bursting from the spine and shoulders.
for (c = [[0, -2, 26.5, [0, 1, 8], 2.2], [-4.5, 1, 25.5, [-2.5, 2, 7], 1.9], [4.5, 2, 25.5, [2.5, 2, 7], 1.9], [0, 6, 26, [0, 3, 8], 2.2],
          [-7.5, 6, 21, [-3.5, 3, 5.5], 1.7], [7.5, 7, 21, [3.5, 3, 5.5], 1.7], [-3.5, 11, 20, [-1.5, 4.5, 5], 1.7],
          [3.5, 11, 20, [1.5, 4.5, 5], 1.7], [-8.5, -3, 21, [-3.5, -0.5, 5], 1.4], [8.5, -2, 21, [3.5, -0.5, 5], 1.4], [0, 12.5, 14, [0, 5, 2.5], 1.5]]) {
  spike([c[0], c[1], c[2]], c[3] * 1.3, c[4] * 1.2, 0.08, crystal);
  spike([c[0], c[1], c[2]] + [0.3, -0.3, 0.3], c[3] * 1.1, c[4] * 0.55, 0.05, crystalHi);
}
// Burning core in the chest, red cracks radiating from it and webbing over the back.
ell([2.2, 1, 2.2], [-1.5, -8.6, 17], red);
ell([1.1, 0.8, 1.1], [-1.5, -9.3, 17.2], redHi);
for (d = [[-5, 21], [2.5, 21.5], [3.5, 13.5], [-5, 12.5], [-1, 10.5]])
  color(red) hull() { translate([-1.5, -8.6, 17]) sphere(0.45, $fn = 8); translate([d[0], -7.8 + 0.4 * abs(d[0]) / 5, d[1]]) sphere(0.2, $fn = 6); }
module crack(pts) chain([for (p = pts) onEll(hump[1], hump[0], p[0], p[1], 1.02)], [for (p = pts) 0.35], red);
crack([[-120, 30], [-150, 40], [-170, 25], [170, 45]]);
crack([[-60, 40], [-30, 45], [10, 50], [40, 40], [80, 30]]);
crack([[100, 40], [120, 10], [140, -10]]);
crack([[150, 50], [170, 20], [-170, 0]]);
crack([[-80, 10], [-100, -10], [-120, -20]]);

// Arms: long and bony, reaching forward and down from the shoulders, claws dripping violet.
mirror_x() {
  chain([[7.5, -4, 22], [10.5, -8, 15], [9, -13, 9]], [3.4, 2.3, 1.6], fur);
  blotch([9.8, -4.6, 19], [1, -0.4, 0.2], 1.4);
  for (a = [-35, 0, 35]) {
    chain([[9 + sin(a) * 1.2, -13.6, 8.6], [9 + sin(a) * 2.2, -16, 6.6], [9 + sin(a) * 2.4, -16.4, 4.4]], [0.5, 0.35, 0.06], skin);
    ell([0.4, 0.4, 0.75], [9 + sin(a) * 2.4, -16.4, 3.2], red);
  }
}

// Legs: heavy haunches and long rat feet with claws.
mirror_x() {
  ell([4.5, 6.5, 6], [7.5, 3, 7], fur);
  blotch([11.9, 2, 7.5], [1, -0.1, 0.1], 2.3);
  blob([[[2.4, 5, 1.3], [7.8, -3, 1.3]], [[2, 2, 1.4], [7.8, 2, 1.6]]], fur);
  for (a = [-25, 0, 25]) spike([7.8 + sin(a) * 1.4, -7.6, 1], [sin(a) * 0.8, -1.8, -0.5], 0.45, 0.05, skin);
}

// Tail: long and bare, curling up behind to the viewer's right.
chain([[2, 12, 6], [6, 16, 3], [11, 17, 3.5], [15, 15, 7], [17, 13, 12], [17.5, 12, 17], [16.5, 11, 21], [14.5, 10.5, 23.5], [12.5, 10.5, 23.5], [11.5, 11, 21.5]],
      [1.8, 1.5, 1.3, 1.1, 1, 0.9, 0.8, 0.65, 0.5, 0.35], skin);
// Scaly rings banding the bare tail.
tailPts = [[2, 12, 6], [6, 16, 3], [11, 17, 3.5], [15, 15, 7], [17, 13, 12], [17.5, 12, 17], [16.5, 11, 21], [14.5, 10.5, 23.5]];
tailRs = [1.8, 1.5, 1.3, 1.1, 1, 0.9, 0.8, 0.65];
for (i = [1 : len(tailPts) - 2]) for (t = [0, 0.5]) let(d = tailPts[i + 1] - tailPts[i], c = tailPts[i] + d * t,
                                                     r = tailRs[i] + (tailRs[i + 1] - tailRs[i]) * t)
  color(ear * 0.7) translate(c) rotate(_dir_rot(d)) cylinder(h = 0.35, r = r + 0.12, center = true, $fn = 12);

// Barbed hook at the tail tip.
spike([11.5, 11, 21.5], [-1.5, 0, -3], 0.8, 0.05, crystal);
spike([12.5, 10.5, 23.5], [1.2, 0, 2.5], 0.6, 0.05, crystal);

// Smog pooling around the feet: one low rolling bank, lumpy at the rim, with a few curls rising.
color(smog) hull() for (s = [[0, 2, 13, 11], [0, -6, 10, 6]]) translate([s[0], s[1], 0.6]) scale([s[2], s[3], 1.2]) sphere(1, $fn = 24);
for (i = [0 : 13]) let(a = i * 360 / 14, r = 12.5 + (i % 3) * 1.2)
  color(i % 2 ? smog : smogHi) translate([r * sin(a), 2 - r * 0.85 * cos(a), 1.2]) scale([3.4, 3.4, 1.6 + (i % 2) * 0.6]) sphere(1, $fn = 12);
for (s = [[-15, 3, 5], [15, 4, 6], [-13, -8, 4], [13, 11, 4]])
  chain([[s[0], s[1], 2], [s[0] * 1.1, s[1], s[2] + 1], [s[0] * 1.05, s[1] + 1, s[2] + 3], [s[0], s[1] + 1.5, s[2] + 3.6]], [1.4, 1, 0.6, 0.2], smogHi);
