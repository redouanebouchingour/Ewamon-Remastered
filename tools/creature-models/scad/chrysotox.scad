// Chrysotox: a hulking gorilla-shaped golem of grey-green fibrous stone. Every surface is shingled with long pointed
// leaf-like fibre strands that hang downward (a shaggy coat, ragged only at the silhouette); the head is sunk low
// between huge shoulders with no neck, its pale shaggy face holding two small angry glowing violet eyes under a fan of
// strands sweeping up into a crown, a beard of hanging strands over a dark maw. Long heavy arms hang almost to the
// ground ending in fibrous fists with long hooked fingers; short thick legs on broad shaggy feet.
//
// Checklist (front sheet, units = 40 tall, the haze in the art is NOT modelled):
//   head      sheet x -8.5..0.5, z 23..37: crown fan of up-swept strands from the brow to z 37, eyes at x -6.0 and
//             -2.1, z 28.4 (violet, pink core, angry slant down to the nose, dark rims), beard of hanging strands
//             z 27..23 over a dark mouth. The face looks at the viewer (head turned 25 deg towards +X).
//   shoulders near x 2.4..13.7 z 23..35 (strands swept up and out at the top), far x -13.3..-7.3 z 24..33.
//   torso     x -7.8..5.5 z 12.7..24, the chest grey with a green tint, a V fringe of strands hanging over the belly.
//   arms      far: upper x -12..-8 z 24..18, forearm bundle x -17.8..-8.6 z 22..9.6, fist with hooked fingers to z 4.6.
//             near: green, forearm x 1.4..16.7 z 21..4.6, strands up-outward at the elbow (z 23), fist to z 4.
//   legs      far x -11.8..-1.6 z 1..12.7, near x 1.4..11.6 z 0..12.7, short pillars splaying into shaggy feet.
//   colours   dark grey-brown base [0.27, 0.26, 0.23], strands mid [0.39, 0.39, 0.33] .. light [0.53, 0.54, 0.46] ..
//             pale [0.62, 0.63, 0.54]; green tint [0.48, 0.55, 0.40] on the chest and the near forearm; face pale.
//   back      the same shingled strands all over in chevron rows pointing down.
include <lib.scad>

base = [0.31, 0.29, 0.25];
dk = [0.27, 0.26, 0.23];
mid = [0.4, 0.38, 0.33];
lt = [0.5, 0.49, 0.42];
pale = [0.6, 0.59, 0.51];
grn = [0.46, 0.51, 0.39];
grnL = [0.55, 0.6, 0.46];
faceC = [0.6, 0.58, 0.52];
mouthC = [0.12, 0.11, 0.09];
eyeRim = [0.3, 0.1, 0.4, NOGLOW];
eyeC = [0.62, 0.24, 0.86, GLOW];

GREY = [lt, mid, pale, lt, mid, pale];
GREEN = [grn, grnL, lt, grn, grnL, pale];

function nz(v) = v / norm(v);

// One fibre strand: a long flat pointed leaf from p0 to its tip p1, lying on a surface whose outward normal is `nrm`,
// arched `bulge` off the straight line between them (so it hugs a round body).
module leaf(p0, p1, nrm, w, c, th = 0.45, bulge = 0.6) {
  d = p1 - p0;
  L = norm(d);
  u = d / L;
  n = nz(nrm - (nrm * u) * u);
  s = cross(n, u);
  color(c) multmatrix([[u[0], s[0], n[0], p0[0]], [u[1], s[1], n[1], p0[1]], [u[2], s[2], n[2], p0[2]], [0, 0, 0, 1]])
    hull() {
      translate([L * 0.34, 0, bulge]) scale([L * 0.4, w * 0.5, th]) sphere(1, $fn = 6);
      translate([L, 0, 0]) sphere(0.1, $fn = 3);
    }
}

// Ellipsoid surface point and normal at azimuth az (0 = +X, -90 = front) and elevation el.
function eS(c, r, az, el, k = 1) = c + k * [r[0] * cos(el) * cos(az), r[1] * cos(el) * sin(az), r[2] * sin(el)];
function eN(r, az, el) = nz([cos(el) * cos(az) / r[0], cos(el) * sin(az) / r[1], sin(el) / r[2]]);

// Strands shingled on an ellipsoid: each [az, el, az1, el1, w]: from (az, el) to the tip at (az1, el1), the tip lifted
// `lift` off the surface. el1 < el hangs it down.
module shag(c, r, list, cols, lift = 1.4) {
  for (i = [0 : len(list) - 1]) let(t = list[i], az = t[0], el = t[1], az1 = t[2], el1 = t[3], w = t[4],
      p0 = eS(c, r, az, el, 0.96), p1 = eS(c, r, az1, el1) + lift * eN(r, az1, el1),
      m = eS(c, r, (az + az1) / 2, (el + el1) / 2), b = max(0.25, norm(m - (p0 + p1) / 2) + 0.15))
    leaf(p0, p1, eN(r, (az + az1) / 2, (el + el1) / 2), w, cols[i % len(cols)], bulge = b);
}
// Rows of hanging strands: each row [el, n, dEl, w] spreads n strands over az0..az1, every other row offset half a step.
// azk < 1 turns the tips towards az 0 (outward on a +X part), for strands swept up and out.
module coat(c, r, rows, cols, az0 = -180, az1 = 180, lift = 1.4, azk = 1)
  shag(c, r, [for (k = [0 : len(rows) - 1], i = [0 : rows[k][1] - 1])
    let(row = rows[k], az = az0 + (i + (k % 2 == 0 ? 0.5 : 1)) * (az1 - az0) / row[1]) [az, row[0], az * azk, row[0] - row[2], row[3]]], cols, lift);

// Strands on a capsule from A to B (radius r there): rows [t, n, len, w, lift]: n strands rooted at t along A..B round
// the axis (phi 0 = outward +X, 90 = front -Y), hanging `len` towards B, the tip `lift` off the surface.
module coatLimb(A, B, r, rows, cols) {
  ax = nz(B - A);
  e1 = nz(cross(ax, [0, 1, 0]));
  e2 = cross(ax, e1);
  for (k = [0 : len(rows) - 1], i = [0 : rows[k][1] - 1])
    let(row = rows[k], ph = (i + (k % 2) * 0.5) * 360 / row[1], rad = cos(ph) * e1 + sin(ph) * e2,
        p0 = A + row[0] * (B - A) + r * 0.95 * rad, p1 = p0 + row[2] * ax + row[4] * rad)
      leaf(p0, p1, rad, row[3], cols[(k * 3 + i) % len(cols)], bulge = 0.7);
}

module cap(p1, p2, r1, r2, c, fn = 14) { color(c) hull() { translate(p1) sphere(r1, $fn = fn); translate(p2) sphere(r2, $fn = fn); } }

// ---------------- torso ----------------
CH = [0, 0.5, 22.5];
CHR = [9, 7.5, 7];
BE = [0, 0, 15];
BER = [7.2, 6.2, 5];
color(base) hull() { translate(CH) scale(CHR) sphere(1, $fn = 14); translate(BE) scale(BER) sphere(1, $fn = 12); }
// chest: green-tinted strands at the front (the lowest row the V fringe over the belly), grey chevrons at the back
coat(CH, CHR, [[70, 4, 55, 3.6], [42, 7, 55, 3.2], [14, 7, 55, 3.2], [-14, 7, 45, 3.2]], GREEN, -180, 0);
coat(CH, CHR, [[70, 5, 55, 3.6], [42, 6, 55, 3.6], [14, 6, 55, 3.4], [-14, 6, 45, 3.4]], GREY, 0, 180);
// belly and hips
coat(BE, BER, [[5, 9, 55, 3.8], [-30, 6, 40, 3.6]], [mid, lt, pale, lt, mid]);

// ---------------- shoulders ----------------
SH = [10.5, 0.5, 27.5];
SHR = [5.2, 5.2, 4.4];
// the fan of strands swept up and out over each shoulder: [angle from vertical towards +X, length]
FAN = [[8, 8.5], [30, 9.2], [54, 8.8], [80, 7.6], [106, 6.4]];
mirror_x() {
  color(base) translate(SH) scale(SHR) sphere(1, $fn = 12);
  for (l = [0 : 2], k = [0 : len(FAN) - 1]) let(y = (l - 1) * 3.4, a = FAN[k][0] + (l == 1 ? 6 : 0), L = FAN[k][1] - abs(l - 1) * 1.2,
      p0 = [8.2 + k * 0.4, y, 26.2], p1 = p0 + [sin(a) * L, y * 0.45, cos(a) * L], m = (p0 + p1) / 2)
    leaf(p0, p1, m - (SH + [-3, 0, -2]), 3.2, [pale, lt, mid, lt, pale, mid, lt][(l * 2 + k) % 7], bulge = 0.9);
  // the underside: hanging strands
  coat(SH, SHR, [[40, 7, 55, 3.4], [-10, 8, 45, 3.2]], [mid, lt, pale, mid], lift = 1.2);
}

// ---------------- head ----------------
HC = [0, -7.5, 32];
HEAD_YAW = 25;
EYE = [2.15, -3.75, -1.9];
translate(HC) rotate([0, 0, HEAD_YAW]) {
  color(mid) scale([4.4, 4.2, 4.3]) sphere(1, $fn = 14);
  // pale shaggy face mask
  color(faceC) translate([0, -2.4, -1.5]) scale([3.9, 2.1, 3.2]) sphere(1, $fn = 18);
  // eyes: small angry glowing violet almonds in dark rims, slanted down to the nose
  mirror_x() {
    color(mouthC) translate([EYE[0], EYE[1] + 0.4, EYE[2] + 0.05]) rotate([0, 0, 18]) scale([1.5, 0.6, 1.0]) sphere(1, $fn = 12);
    eye(EYE, 1.1, iris = eyeC, sclera = eyeRim, yaw = 18, pupil = eyeC, shine = false, lid = 0.36, lid_tilt = 28, lid_c = faceC);
  }
  // the brow: broad strands from between the eyes fanning up and back into a crown
  for (k = [-3 : 3]) let(a = k * 22, e = 1 - abs(k) * 0.06)
    leaf([k * 0.4, -4.1, -0.8], [sin(a) * 4.8 * e, -0.8 + abs(k) * 0.9, 1.2 + cos(a) * 5.6 * e], [sin(a) * 0.5, -1, 0.5], 2.4,
         k % 2 == 0 ? pale : lt, bulge = 1);
  for (k = [-2 : 2]) let(a = k * 30)
    leaf([k * 1.2, -1, 2.5], [sin(a) * 4.2, 2.6, 2 + cos(a) * 4.4], [sin(a) * 0.5, 0.3, 1], 2.6, k % 2 == 0 ? mid : lt, bulge = 0.8);
  mirror_x() {
    // the sides: strands swept back from the cheeks
    leaf([3.4, -2.2, 0.4], [5.6, 2.2, 3.2], [1, -0.3, 0.3], 2.4, mid, bulge = 0.7);
    leaf([3.4, -2, -2], [5.8, 2, -1], [1, -0.2, 0], 2.4, lt, bulge = 0.6);
    // a ragged upper lip under the eyes
    for (x = [0.6, 2]) leaf([x, -4.3, -2.9], [x + 0.2, -4.5, -4.3], [0, -1, 0], 1, pale, bulge = 0.25);
  }
  // the maw and the beard of hanging strands over it
  color(mouthC) translate([0, -3.6, -3.7]) scale([2.6, 1, 1.5]) sphere(1, $fn = 14);
  for (k = [-4 : 4]) let(x = k * 0.85)
    leaf([x, -3.8 + abs(k) * 0.12, -3], [x * 1.12, -4.6 + abs(k) * 0.22, -7.3 + abs(k) * 0.35], [0, -1, 0], k % 2 == 0 ? 1 : 0.75,
         k % 2 == 0 ? pale : lt, bulge = 0.4);
  mirror_x() leaf([3, -2.6, -2.2], [3.7, -3.2, -6.6], [1, -1, 0], 1.8, mid, bulge = 0.5);
  // the back of the head: shingled
  shag([0, 0, 0], [4.4, 4.2, 4.3], [for (az = [10 : 40 : 170]) [az, 35, az, -15, 3], for (az = [30 : 60 : 150]) [az, 75, az, 30, 3], for (az = [0 : 45 : 180]) [az, 55, az, 5, 2.8]], [mid, lt, pale]);
}

// ---------------- arms ----------------
S = [10.5, 0.5, 27.5];
E = [12.7, -3, 16];
W = [16, -4.5, 8.5];
F = [16.3, -5, 6.6];
module arm(cols) {
  cap(S, E, 3.6, 3.3, base);
  cap(E, W, 3.8, 3.4, base);
  color(base) translate([14.6, -3.9, 12.2]) scale([4.4, 4.3, 4.5]) sphere(1, $fn = 16);
  coatLimb(S, E, 3.5, [[0.2, 5, 6, 3.4, 1.6], [0.6, 5, 5.5, 3.4, 1.8]], cols);
  coatLimb(E, W, 4.3, [[-0.2, 6, 6.5, 3.8, 1.8], [0.25, 6, 6.5, 3.8, 2], [0.7, 6, 4.5, 3.4, 1.8]], cols);
  // strands at the elbow swept up and out
  for (k = [0 : 2]) leaf(E + [2, -1.5 + k * 1.8, 1 + k * 0.5], E + [5.2 + k * 0.6, -1.5 + k * 2.4, 7.5 - k * 1.8], [1, 0, 0.3], 2.8,
                         cols[k % len(cols)], bulge = 0.7);
  // the fist and its long hooked fingers
  color(base) translate(F) scale([3.3, 3.3, 2.9]) sphere(1, $fn = 14);
  for (a = [-50, -15, 20, 55]) let(dx = sin(a), dy = -cos(a))
    chain([F + [dx * 2.2, dy * 2.2, -1.2], F + [dx * 3.2, dy * 3.2, -2.6], F + [dx * 2.9, dy * 2.9 - 0.4, -3.6], F + [dx * 2, dy * 2 - 0.6, -2.4]],
          [0.85, 0.65, 0.4, 0.12], mid);
}
arm(GREEN);
mirror([1, 0, 0]) arm(GREY);

// ---------------- legs ----------------
H = [8, -0.5, 13];
A = [8.3, -1.5, 3.8];
FT = [8.3, -2.2, 1.8];
mirror_x() {
  cap(H, A, 4.4, 4.0, base);
  color(base) translate(FT) scale([3.8, 4.4, 1.8]) sphere(1, $fn = 14);
  // the thigh strands, then a skirt splaying out into the shaggy foot
  coatLimb(H + [0, 0, 1], A, 4.3, [[0, 6, 6.5, 3.8, 1.6], [0.5, 7, 5.5, 3.8, 2.4], [1.02, 7, 3.4, 3.4, 2.2]], [mid, lt, pale, mid, lt]);
  // the toes: strands lying forward over the foot
  for (k = [-1 : 1]) leaf(FT + [k * 2, -2.5, 1.6], FT + [k * 2.8, -6.6, -1.3], [k * 0.3, -0.6, 1], 2.8, k == 0 ? lt : mid, bulge = 0.5);
}
