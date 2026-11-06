// Stormchick: a static-charged chick that is one round ball of spiky yellow down: two big round startled eyes with
// tiny pupils, a small orange beak wide open, a lightning mark on the brow, two zigzag lightning bolts for a tail out
// of its back-right, stubby wings, dangling orange three-toed feet and a few blue sparks crackling round it.
//
// Checklist (front sheet, x = art sheet x, z = art sheet z; the watermark sparkle at the bottom right is not art):
// - ball: x -19..11, z 7..40 with the tufts, the round core about radius 13 round (-4, 23). Its outline is ragged
//   with soft pointed tufts all round; the face itself is smooth fluff. Lower third darker orange (front and back).
// - eyes: far x -13.8..-9.4, z 22.5..27.6; near x -5.4..0, z 22.1..27.6: round white discs, a thin ink ring, a tiny
//   black dot pupil in the middle, no highlight. They read as the face turned ~14 deg towards +X.
// - beak: x -9.4..-5.8, z 19.7..24.3, orange, wide open: a hooked upper bill, a small lower bill, a dark mouth and a
//   red tongue.
// - brow mark: an orange zigzag bolt x -9.1..-5.1, z 26.2..32.8, between and above the eyes.
// - tail: two yellow zigzag bolts x 8.5..16.2, z 17.3..29.8, pointing up and out; the back art has them on the
//   creature's +X back, so they stand out of the back-right quadrant.
// - wings: a small fluffy fan low on each flank (back art x 3..11, z 12..21), pointing back and down.
// - feet: orange, three long toes hanging down: far x -13.7..-8, near x -3.6..0.8, z 7.6..14.
// - sparks: light-blue zigzags round the ball and two on its front.
// Feet on the ground: the art's foot line z 7 is the scad ground (everything is authored in art z, then lowered G).
include <lib.scad>

fluff = [0.98, 0.82, 0.33];
fluffDark = [0.92, 0.65, 0.24];
fluffDeep = [0.86, 0.6, 0.25];
boltC = [1.0, 0.84, 0.18, NOGLOW];   // the signature bolts: bright gold, apart from the down
markC = [0.84, 0.55, 0.2];
orange = [0.94, 0.56, 0.27, NOGLOW];
mouthIn = [0.35, 0.08, 0.07];
tongue = [0.85, 0.36, 0.3];
ink = [0.06, 0.04, 0.05];
white = [0.98, 0.98, 0.99];
spark = [0.62, 0.8, 1.0, NOGLOW];

G = 7;              // the art's foot line: everything is lowered by it
C = [0, 0, 23];     // ball centre (art z)
R = 13;             // core radius
FACE = 14;          // the face's turn towards +X
EAZ = 21;           // the eyes' azimuth either side of the face
EEL = 14.7;         // their elevation
ER = 12.6;          // their centre's distance from C

function dirAE(az, el) = [cos(el) * sin(az), -cos(el) * cos(az), sin(el)];
function unit(v) = v / norm(v);
FDIR = dirAE(FACE, 6);

// Round startled eye looking along -Y: an ink ring, a white disc, a tiny dot pupil, no highlight.
module bigEye() {
  color(ink) scale([3.0, 0.9, 3.0]) sphere(1, $fn = 28);
  color(white) translate([0, -0.25, 0]) scale([2.65, 0.9, 2.65]) sphere(1, $fn = 28);
  color(ink) translate([0, -1.05, 0]) scale([0.62, 0.3, 0.62]) sphere(1, $fn = 12);
}

// A soft pointed tuft on the ball at unit normal n: a thin flap of down, wide at its root and pointed, lifted h off the
// surface and combed l along s (away from the face). Seen on the rim it is a spike of the outline; seen face-on it
// lies like a feather plate, so the ball reads as fluff, not a blowfish.
module tuft(n, s, h, l, c, w = 4.0) {
  a = cross(n, s);
  p = C + n * (R - 0.3);
  q = C + n * (R + h) + s * l;
  d = unit(q - p);
  m = unit(cross(a, d));
  color(c) hull() {
    multmatrix([[a[0], d[0], m[0], p[0]], [a[1], d[1], m[1], p[1]], [a[2], d[2], m[2], p[2]], [0, 0, 0, 1]])
      scale([w, 2.6, 1.3]) sphere(1, $fn = 10);
    translate(q) sphere(0.3, $fn = 6);
  }
}

// A small zigzag spark (thin capsules), standing in the plane `yaw` turns to, `s` long.
module sparkZ(p, s = 1, yaw = 30, tilt = 0) {
  pts = [[0, 0], [0.9, 0.7], [0.15, 1.3], [1.2, 2.3]];
  translate(p) rotate([0, tilt, yaw]) for (i = [0 : 2])
    limb([pts[i][0] * s, 0, pts[i][1] * s], [pts[i + 1][0] * s, 0, pts[i + 1][1] * s], 0.28, 0.28, spark);
}

// A point on the ball's front seen at model sheet x `sx` (the ball centre reads 0), art height z, radius r.
function onFront(sx, z, r) = let(zz = z - C[2], d = -sqrt(max(0, r * r - zz * zz - sx * sx)))
  [0.866 * sx - 0.5 * d, 0.5 * sx + 0.866 * d, z];

TAZ = 124;                            // the tail's azimuth (back-right)
TAILP = [sin(TAZ) * 11, -cos(TAZ) * 11];   // the tail's root (scad x, y)
TPROJ = cos(TAZ - 120);                    // how much of the plate's length the front view sees
TAILX = 0.866 * TAILP[0] + 0.5 * TAILP[1] - 4;   // the art sheet x of TAILP
module tailBolt(pts, d) {
  translate([TAILP[0], TAILP[1], -1.5]) rotate([0, 0, TAZ - 90]) translate([0, d, 23])
    scale([1.6 / TPROJ, 1, 1.6]) translate([-TAILX, 0, -23]) plate(pts, 2.8, 0.4, boltC, 0.25);
}
WROOT = C + dirAE(98, -10) * 12.2;   // the near wing's root

translate([0, 0, -G]) {
  // ---- The ball of down, darker orange on its lower third.
  color(fluff) translate(C) sphere(R, $fn = 48);
  color(fluffDark) intersection() {
    translate(C) sphere(R + 0.15, $fn = 48);
    translate([-20, -20, 0]) cube([40, 40, 16.5]);
  }

  // Brow mark: the art's zigzag bolt laid flush on the forehead (front only).
  color(markC) intersection() {
    translate(C) sphere(R + 0.2, $fn = 48);
    prism([for (p = [[-5.8, 32.8], [-9.1, 29.4], [-9.1, 28.6], [-7.2, 28.8], [-8.4, 26.2], [-5.1, 30.2], [-6.6, 30.3]])
           [p[0] + 4, p[1] + 1.6]]);
    translate([-20, -40, 0]) cube([40, 34, 45]);
  }

  // ---- Tufts all round (golden-angle spread), the face left smooth.
  N = 86;
  for (i = [0 : N - 1]) {
    z = 1 - 2 * (i + 0.5) / N;
    rr = sqrt(1 - z * z);
    th = i * 137.508;
    n = [rr * cos(th), rr * sin(th), z];
    t = FDIR - n * (n * FDIR);
    dn = [0, 0, -1] - n * (-n[2]);
    s0 = norm(t) > 0.12 ? -unit(t) : unit([1, 0, 0] - n * n[0]);
    s = norm(dn) > 0.25 ? unit(s0 + 0.5 * unit(dn)) : s0;
    if (n * FDIR < cos(47) && z > -0.95) {
      h = z < -0.6 ? 3.0 : 2.8 + (i % 3) * 0.7;
      c = z < -0.62 ? fluffDeep : z < -0.4 ? fluffDark : (i % 5 == 0 ? fluffDark : fluff);
      tuft(n, s, h, 1.2, c);
    }
  }
  // A crown of three taller tufts on top (the art's tallest spikes), combed back a little.
  for (k = [[-14, 4.2], [12, 3.4], [40, 3.0]]) {
    n = unit(dirAE(FACE + k[0], 72));
    tuft(n, unit([0, 1, 0] - n * n[1]), k[1], 0.8, fluff);
  }

  // ---- The face (eyes placed in the scad frame; the rig copies these numbers).
  for (sg = [-1, 1]) let(az = FACE + sg * EAZ)
    translate(C + dirAE(az, EEL) * ER) rotate([0, 0, az]) rotate([-EEL, 0, 0]) bigEye();

  // Open beak, in the face's turn: a hooked upper bill, a small lower bill, the dark mouth and the tongue between.
  rotate([0, 0, FACE]) {
    color(mouthIn) translate([0, -13.0, 22.5]) scale([1.7, 1.3, 1.5]) sphere(1, $fn = 16);
    color(tongue) translate([0, -13.9, 21.6]) scale([1.1, 0.8, 0.5]) sphere(1, $fn = 12);
    color(orange) hull() {
      translate([0, -12.8, 24.8]) scale([2.4, 1.4, 1.2]) sphere(1, $fn = 16);
      translate([0, -15.2, 24.4]) scale([1.3, 1.0, 0.8]) sphere(1, $fn = 12);
      translate([0, -16.0, 22.5]) sphere(0.5, $fn = 10);
    }
    color(orange) hull() {
      translate([0, -12.7, 20.7]) scale([2.0, 1.2, 0.9]) sphere(1, $fn = 14);
      translate([0, -15.2, 20.0]) scale([0.9, 0.6, 0.5]) sphere(1, $fn = 10);
    }
  }

  // ---- Tail: two zigzag bolts (thick plates) out of the back-right quadrant, pointing up and out as drawn. Traced in
  // art sheet x / z; the plate stands at azimuth 135 (back-right) so it reads from the front, side and back.
  tailBolt([[6.4, 24.6], [8.4, 24.2], [10.9, 28.1], [11.5, 25.7], [16.2, 29.8], [12.7, 23.6], [11.2, 24.4], [9.4, 21.6], [6.4, 22.4]], -0.7);
  tailBolt([[6.4, 20.6], [9.2, 20.8], [11.5, 23.2], [12.7, 21.4], [16.2, 23.0], [11.8, 17.3], [11.2, 19.6], [9.6, 18.8], [6.4, 18.6]], 0.7);

  // ---- Stubby wings: three fluffy feathers on each flank, fanned back and down.
  mirror_x() for (f = [[5.2, 1.6, 1.2], [4.8, 3.4, 1.0], [3.8, 5.0, 0.8]]) {
    tip = WROOT + [1.8 + f[2], f[0], -f[1]];
    color(f[1] > 4 ? fluffDark : fluff) hull() {
      translate(WROOT) scale([1.3, 1.9, 1.9]) sphere(1, $fn = 12);
      translate(tip) scale([0.7, 0.9, 0.9]) sphere(1, $fn = 8);
    }
  }

  // ---- Feet: a short leg under the ball and three long toes hanging down to the ground.
  mirror_x() {
    limb([4.6, -4.8, 14.5], [5.0, -6.2, 11.8], 1.1, 0.95, orange);
    for (t = [[5.1, -9.0, 7.55], [7.0, -8.0, 7.65], [3.3, -8.4, 7.65]])
      limb([5.0, -6.2, 11.8], t, 0.72, 0.55, orange);
  }

  // ---- Sparks: round the rim and two crackling on the front.
  sparkZ([-12.5, -2, 34.5], 1.3, 30, -20);
  sparkZ([10.5, -1, 33.5], 1.2, 30, 25);
  sparkZ([-17, -3, 14.5], 1.2, 30, -10);
  sparkZ([13.5, 1, 10.5], 1.1, 30, 15);
  sparkZ(onFront(6.0, 30.0, 13.3), 1.0, 30, 10);
  sparkZ(onFront(-9.0, 17.0, 13.6), 1.0, 30, -15);
}
