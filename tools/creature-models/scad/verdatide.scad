// Verdatide: Mossling grown into a great sea turtle, a meadow of grass, flowers and stones on its shell, a mossy beard,
// barnacled flippers.
include <lib.scad>

skin = [0.36, 0.55, 0.3];
skinDark = [0.3, 0.42, 0.2];
spot = [0.27, 0.35, 0.18];
shell = [0.16, 0.3, 0.12];
scute = [0.3, 0.52, 0.2];
scuteHi = [0.38, 0.6, 0.24];
moss = [0.5, 0.72, 0.28];
rim = [0.45, 0.32, 0.2];
leaf = [0.42, 0.7, 0.24];
barnacle = [0.78, 0.76, 0.72];
beard = [0.4, 0.5, 0.2];

// The shell: a tall, heavy dome raised on the body (not a flat lid), its front edge overhanging the head.
SH = [15.5, 17, 15];
SZ = 7;
function dome(az, el, k = 1) = [SH[0] * k * cos(el) * cos(az), SH[1] * k * cos(el) * sin(az), SZ + SH[2] * k * sin(el)];
function domeN(az, el) = [cos(el) * cos(az) / SH[0], cos(el) * sin(az) / SH[1], sin(el) / SH[2]];

// Brown underside rim and the body under the shell.
color(rim) translate([0, 0, SZ - 0.8]) scale([SH[0] - 0.5, SH[1] - 0.5, 2.6]) sphere(1, $fn = 32);
color(skin) translate([0, 0, 4.6]) scale([12, 13.5, 4.2]) sphere(1, $fn = 28);
// Dark dome: shows as the grooves between the scutes.
color(shell) translate([0, 0, SZ]) scale(SH) difference() {
  sphere(1, $fn = 36);
  translate([0, 0, -1.2]) cube(2.4, center = true);
}
// Scutes: thick hexagonal plates tiling the dome, [azimuth, elevation, size]; a top plate, two rings and a flared
// marginal row along the lower edge.
module scuteAt(az, el, r, c, h = 1) {
  color(c) translate(dome(az, el, 0.985)) rotate(_dir_rot(domeN(az, el))) rotate([0, 0, az + 30])
    cylinder(h = h, r1 = r, r2 = r * 0.82, $fn = 6);
}
scuteAt(0, 90, 6, scuteHi);
for (a = [0 : 60 : 359]) scuteAt(a + 30, 54, 6.2, a % 120 == 0 ? scuteHi : scute);
for (a = [0 : 36 : 359]) scuteAt(a, 24, 5.4, scute);
color(scute) translate([0, 0, SZ + 0.6]) scale([SH[0] + 1.2, SH[1] + 1.2, 2]) sphere(1, $fn = 32);
color(shell) translate([0, 0, SZ + 1.2]) scale([SH[0] + 1.05, SH[1] + 1.05, 1.2]) sphere(1, $fn = 32);

// Moss over the crown of the shell.
color(moss) translate([0, 1, SZ + SH[2] - 1.6]) scale([8, 9, 3]) sphere(1, $fn = 20);
for (p = [[-3, -3], [3.5, 4], [2, -5], [-4, 4]]) color(moss) translate([p[0], p[1], SZ + SH[2] - 0.2]) scale([2.6, 2.6, 1.4]) sphere(1, $fn = 10);
for (p = [[30, 55], [150, 50], [250, 58], [320, 40], [100, 35], [200, 30]])
  color(moss) translate(dome(p[0], p[1], 1.05)) rotate(_dir_rot(domeN(p[0], p[1]))) scale([3.6, 3.2, 1]) sphere(1, $fn = 12);

// Grass tufts, flowers and stones in the meadow on the shell.
module tuft(p, yaw) {
  for (i = [0 : 4]) let(a = yaw + i * 72) spike(p, [cos(a) * 1.3, sin(a) * 1.3, 3.6 + (i % 2) * 1.4], 0.6, 0.05, leaf);
}
module flower(p, c) {
  limb(p, p + [0, 0, 3], 0.2, 0.2, leaf);
  for (a = [0 : 72 : 359]) color(c) translate(p + [0.8 * cos(a), 0.8 * sin(a), 3.1]) scale([0.75, 0.75, 0.3]) sphere(1, $fn = 8);
  color([1, 0.9, 0.4]) translate(p + [0, 0, 3.3]) sphere(0.4, $fn = 8);
}
for (s = [[0, 88, 0], [40, 64, 20], [120, 66, 40], [200, 64, 10], [290, 62, 50], [80, 42, 0], [160, 40, 30],
          [250, 40, 60], [330, 42, 10], [20, 26, 0], [130, 26, 0], [210, 24, 0]])
  tuft(dome(s[0], s[1], 1.04), s[2]);
fl = [[1, 0.8, 0.25], [0.75, 0.55, 0.95], [0.45, 0.6, 1], [0.95, 0.6, 0.85]];
for (i = [0 : 11]) let(az = i * 30 + 10, el = 34 + (i % 3) * 16) flower(dome(az, el, 1.04), fl[i % 4]);
for (s = [[60, 72], [230, 48], [140, 32], [310, 64]])
  color([0.55, 0.57, 0.55]) translate(dome(s[0], s[1], 1.03)) scale([1.8, 1.5, 1.1]) sphere(1, $fn = 8);

// Head: big and old, pushed out from under the front rim on a thick neck; a broad beaked face, heavy calm lids and a
// long beard of moss.
module head() {
  color(skin) hull() {
    translate([0, -12, 8]) scale([5.4, 4, 4.6]) sphere(1, $fn = 20);
    translate([0, -17, 9.4]) scale([5, 3.6, 4.4]) sphere(1, $fn = 20);
  }
  color(skin) hull() {
    translate([0, -19.5, 10.6]) scale([5.6, 5, 4.8]) sphere(1, $fn = 24);
    translate([0, -24, 9.8]) scale([3.8, 2.6, 3.2]) sphere(1, $fn = 20);
  }
  // Beak: a darker hooked upper lip and a mouth line.
  color(skinDark) hull() {
    translate([0, -25.6, 9.6]) scale([2.8, 1.2, 1.8]) sphere(1, $fn = 14);
    translate([0, -26.4, 8.4]) sphere(0.6, $fn = 8);
  }
  color(spot) for (s = [-1, 1]) chain([[s * 4.4, -21.5, 8.4], [s * 3, -24.4, 8.3], [0, -26.2, 8.2]], [0.3, 0.3, 0.3]);
  for (p = [[3, -19, 14.4], [-2.5, -18, 14.8], [0.4, -21.4, 14.6], [4.2, -16, 12.6]]) ell([1.1, 1.1, 0.6], p, spot);
  mirror_x() {
    // Calm, old eyes: big and dark with a catchlight, round pupils, heavy lids drooping to the outer corner and a soft
    // lower lid; sunk into the face under a wrinkled brow so only their fronts show.
    eye([3.6, -22.8, 11.7], 1.95, iris = [0.12, 0.1, 0.06], pupil = [0.03, 0.03, 0.03], sclera = [0.9, 0.9, 0.78], yaw = 24,
        flat = 0.55, lid = 0.3, lid_tilt = -12, lid_c = skinDark, squint = 0.12, slit = 1, shine = true);
    color(skinDark) hull() {
      translate([5, -21, 14]) scale([1.3, 1.2, 0.55]) sphere(1, $fn = 10);
      translate([2, -23.4, 14.1]) scale([1.1, 1, 0.5]) sphere(1, $fn = 10);
    }
    // Wrinkles under the eyes and on the cheeks.
    for (w = [[[2.4, -24.2, 9.4], [4.6, -22.6, 9.2]], [[5, -20, 9.6], [5.6, -18, 10.8]]]) limb(w[0], w[1], 0.22, 0.18, spot);
    ell([0.35, 0.3, 0.35], [0.9, -26.4, 10.6], spot);
  }
  // Beard: strands of moss hanging from the jaw down to the ground.
  for (i = [0 : 13]) let(x = -4.2 + i * 0.65, l = 7 - abs(x) * 0.7 + (i % 3) * 1.2, w = (i * 7) % 5 * 0.25 - 0.5)
    chain([[x, -22.6 + abs(x) * 0.55, 7.6], [x * 1.1 + w, -24.2, 7.2 - l * 0.5], [x * 1.2 - w, -23.6, 7 - l]],
          [0.75, 0.55, 0.15], [moss, beard, skinDark][i % 3]);
}
// Raised and enlarged so the face reads under the shell's front lip.
translate([0, -20, 9]) scale(1.22) translate([0, 20, -9]) translate([0, 1.6, 2.6]) head();

// Flippers: long, broad sea-turtle paddles; the front pair reaches forward and out, barnacled, the back pair is short.
module flipper(root, tip, w) {
  color(skin) hull() {
    translate(root) scale([w * 0.55, w * 0.55, 1.8]) sphere(1, $fn = 16);
    translate(root + (tip - root) * 0.45 + [0, 0, -0.4]) scale([w, w, 1.2]) sphere(1, $fn = 16);
    translate(tip) scale([w * 0.4, w * 0.4, 0.6]) sphere(1, $fn = 12);
  }
}
mirror_x() {
  flipper([11, -10, 5], [19, -24, 0.6], 7);
  // Barnacle clusters near the flipper's elbow and along its middle.
  for (t = [[0.3, 0.8], [0.36, -1.4], [0.42, 1.8], [0.5, 0], [0.56, -1.2], [0.62, 1], [0.7, -0.2]])
    let(k = t[0], q = [11 + 8 * k + t[1] * 0.8, -10 - 14 * k + t[1] * 0.5, 5 - 4.4 * k + 0.9]) {
      color(barnacle) translate(q) cylinder(h = 1.4, r1 = 1.3, r2 = 0.85, $fn = 8);
      color([0.45, 0.43, 0.4]) translate(q + [0, 0, 1.35]) sphere(0.55, $fn = 6);
    }
  flipper([11, 10, 4.5], [19, 21, 0.6], 4.4);
  for (t = [[0.45, 0.6], [0.55, -0.8]]) let(k = t[0], q = [11 + 8 * k + t[1], 10 + 11 * k - t[1], 4.5 - 3.9 * k + 0.6])
    color(barnacle) translate(q) cylinder(h = 1, r1 = 0.9, r2 = 0.6, $fn = 8);
}
// Darker mottling over the flippers, as on the sprite.
mirror_x() {
  for (m = [[13.6, -14, 4.2, 1.8], [16, -19, 2.6, 1.6], [12.6, -17.4, 3.5, 1.2], [18, -22.6, 1.4, 1.1], [14.6, 14.4, 3.3, 1.2],
            [17, 18.6, 1.9, 1]])
    color(spot) translate([m[0], m[1], m[2] + 1.1]) scale([m[3], m[3], 0.5]) sphere(1, $fn = 10);
  // A big barnacle crust on the hind flipper.
  for (b = [[15.4, 15.2, 3.1, 1.1], [16.6, 16.8, 2.4, 0.9], [14.4, 16.6, 3.1, 0.8]]) {
    color(barnacle) translate([b[0], b[1], b[2]]) cylinder(h = 1.3, r1 = b[3], r2 = b[3] * 0.65, $fn = 8);
    color([0.45, 0.43, 0.4]) translate([b[0], b[1], b[2] + 1.25]) sphere(b[3] * 0.45, $fn = 6);
  }
}
// Moss draped over the shell's rim at the back and sides, hanging in ragged strands.
for (i = [0 : 9]) let(az = 22 + i * 15 + (i % 3) * 3, el = 4, p = dome(az, el, 1.07), l = 1.4 + ((i * 7) % 4) * 0.9)
  chain([p + [0, 0, 1.2], p + [cos(az) * 0.6, sin(az) * 0.6, -l * 0.5], p + [cos(az) * 0.4, sin(az) * 0.4, -l]], [1.2, 0.8, 0.3],
        i % 2 == 0 ? moss : beard);
// Little pointed tail.
spike([0, 16, 5.5], [0, 4, -1.8], 1.8, 0.2, skin);
