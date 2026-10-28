// Clementar Majin: Clementar corrupted. Dark brown bristling fur, glowing red eyes and a fanged snarl, red-lined ears,
// a cracked fez, the olive djellaba torn at the hem and veined with glowing red cracks, a red sigil on the chest,
// thorny brown vines coiled round its arms, body and tail, and clusters of blood-orange fruit split with red light.
include <lib.scad>

// Brow ridge over an eye at p (size s, same yaw), overhanging its front; the inner end drops `drop` (share of s)
// towards the nose so the face itself scowls.
module brow(p, s, drop, c, yaw = 0) {
  color(c) translate(p) rotate([0, 0, yaw]) hull() {
    translate([s * 1.0, s * 0.1, s * 0.8]) scale([s * 0.55, s * 0.62, s * 0.42]) rotate([0, 90, 0]) sphere(1, $fn = 12);
    translate([-s * 0.8, -s * 0.12, s * (0.7 - drop)]) scale([s * 0.55, s * 0.62, s * 0.4]) rotate([0, 90, 0]) sphere(1, $fn = 12);
    // Sealed back over the eye's top so no sclera shows above the ridge.
    translate([s * 0.1, s * 0.2, s * 0.95]) scale([s * 1.05, s * 0.75, s * 0.5]) rotate([0, 90, 0]) sphere(1, $fn = 12);
  }
}

fur = [0.42, 0.27, 0.17];
furDk = [0.28, 0.17, 0.1];
cream = [0.55, 0.38, 0.25];
earIn = [0.82, 0.16, 0.1];
glow = [1, 0.22, 0.08];
vine = [0.36, 0.22, 0.13];
thorn = [0.55, 0.4, 0.28];
fang = [0.95, 0.92, 0.85];
fez = [0.5, 0.08, 0.1];
fezTop = [0.42, 0.06, 0.08];
star = [0.15, 0.45, 0.2];
robe = [0.27, 0.29, 0.15];
robeDk = [0.2, 0.22, 0.12];
robeLine = [0.22, 0.24, 0.13];
sashY = [0.85, 0.65, 0.22];
sashR = [0.7, 0.2, 0.12];
sashG = [0.25, 0.45, 0.2];
orange = [0.85, 0.3, 0.1];
orangeHi = [1, 0.2, 0.08];
leafC = [0.25, 0.48, 0.18];
nose = [0.25, 0.15, 0.12];

module ear(p, d, w, inner, tip, outer) {
  color(outer) hull() {
    translate(p) scale([w, w * 0.4, w * 0.8]) sphere(1, $fn = 18);
    translate(p + d * 0.45) scale([w * 0.85, w * 0.3, w * 0.85]) sphere(1, $fn = 14);
  }
  color(tip) hull() {
    translate(p + d * 0.45) scale([w * 0.84, w * 0.29, w * 0.84]) sphere(1, $fn = 14);
    translate(p + d) sphere(0.4, $fn = 8);
  }
  color(inner) hull() {
    translate(p + [0, -w * 0.4, 0.8]) scale([w * 0.6, w * 0.2, w * 0.55]) sphere(1, $fn = 14);
    translate(p + d * 0.45 + [0, -w * 0.32, 0]) scale([w * 0.55, w * 0.15, w * 0.55]) sphere(1, $fn = 12);
    translate(p + d * 0.85 + [0, -0.9, 0]) sphere(0.3, $fn = 8);
  }
}

module fruit(p, r) {
  color(orange) translate(p) scale([r, r, r * 0.92]) sphere(1, $fn = 18);
  for (a = [200, 300, 60]) color(orangeHi) translate(p + [r * 0.68 * cos(a), r * 0.68 * sin(a), r * 0.1]) rotate([0, 0, a]) scale([0.3, 0.42, 0.42] * r) sphere(1, $fn = 8);
}

// A hand-held cluster of three oranges with leaves.
module cluster(p) {
  fruit(p + [-1.4, 0, 0], 1.9);
  fruit(p + [1.4, -0.3, 0], 1.9);
  fruit(p + [0, 0.4, 2.2], 1.9);
  for (a = [20, 140, 260]) petal([1.8, 0.7, 0.18], p + [cos(a) * 2.6, sin(a) * 1.6, 3.2], [0, -25, a], leafC);
  limb(p + [0, 0.4, 3.8], p + [0, 0.4, 4.6], 0.2, 0.15, leafC);
}

module fezHat(p, tilt) {
  translate(p) rotate([0, tilt, 0]) {
    color(fez) cylinder(h = 4, r1 = 3, r2 = 2.5, $fn = 24);
    color(fezTop) translate([0, 0, 4]) cylinder(h = 0.3, r = 2.5, $fn = 24);
    color(star) translate([0, -2.8, 2]) rotate([90 - 7, 0, 0]) linear_extrude(0.5, center = true)
      polygon([for (i = [0 : 9]) let(r = i % 2 == 0 ? 1.1 : 0.45, a = 90 + i * 36) [r * cos(a), r * sin(a)]]);
    chain([[-0.8, -2.7, 4.2], [-0.2, -2.8, 3.2], [-1, -2.9, 2.4], [-0.4, -3, 1.4]], [0.2, 0.2, 0.2, 0.18], [0.1, 0.03, 0.03]);
  }
}

// Feet peeking out from under the robe.
mirror_x() ell([1.6, 2.6, 1.1], [3, -1.6, 1.1], fur);
mirror_x() limb([3, 0, 1.4], [3, 0, 4], 1.3, 1.3, fur);

// Robe: a long flared djellaba from the shoulders to the ankles.
color(robe) hull() {
  translate([0, 0.2, 3.5]) scale([6.6, 5.4, 1]) sphere(1, $fn = 28);
  translate([0, 0, 13]) scale([5.2, 4.2, 3]) sphere(1, $fn = 28);
  translate([0, 0, 20]) scale([5.6, 4.2, 3.6]) sphere(1, $fn = 28);
}
// Glowing red cracks veining the robe: zigzag chains laid on its surface. [angle, z0, z1, wiggle]
function robeRx(z) = z < 13 ? 6.6 - (z - 3.5) * 0.6 / 9.5 : 6.0 - (z - 13) * 0.4 / 7;
function robeRy(z) = z < 13 ? 5.4 - (z - 3.5) * 0.6 / 9.5 : 4.8 - (z - 13) * 0.6 / 7;
function onRobe(a, z) = [(robeRx(z) - 0.05) * sin(a), -(robeRy(z) - 0.05) * cos(a), z];
for (c = [[-35, 4, 12, 8], [25, 4.5, 11, -9], [70, 5, 12.4, 7], [-80, 4, 11, -8], [150, 4, 12, 9], [200, 4.5, 12, -8],
          [-140, 5, 12, 8], [-30, 15.5, 21, 9], [40, 15, 20.5, -8], [100, 15, 21, 8], [180, 15, 21.5, -9], [-110, 15.5, 21, 8]])
  chain([for (k = [0 : 4]) onRobe(c[0] + (k % 2 == 0 ? 0 : c[3]), c[1] + (c[2] - c[1]) * k / 4)], [0.28, 0.25, 0.25, 0.22, 0.18], glow, $fn = 6);
// Torn hem: ragged flaps hanging below the robe.
for (a = [0 : 30 : 330]) color(robe) hull() {
  translate([6.4 * sin(a), 0.2 - 5.2 * cos(a), 3.4]) scale([1.3, 1.3, 0.3]) sphere(1, $fn = 6);
  translate([6.9 * sin(a + 8), 0.2 - 5.6 * cos(a + 8), 2.2 - (a % 60) / 60 * 0.8]) sphere(0.2, $fn = 4);
}
// Red sigil on the chest: a glowing ring split by a crack.
translate([0, -4.75, 18.4]) rotate([90, 0, 0]) {
  color(glow) difference() {
    cylinder(h = 0.6, r = 2, center = true, $fn = 20);
    cylinder(h = 1, r = 1.4, center = true, $fn = 20);
  }
  color(furDk) cylinder(h = 0.5, r = 1.4, center = true, $fn = 20);
  color(glow) linear_extrude(0.7, center = true) polygon([[-0.2, 1.4], [0.35, 0.3], [-0.25, -0.2], [0.25, -1.4], [-0.05, -0.2], [-0.6, 0.3]]);
}
// Hood bunched behind the neck.
ell([4.6, 3.2, 3.4], [0, 3.2, 23.4], robe);
ell([3.6, 2.4, 2.4], [0, 3.8, 21.4], robeDk);

// Woven sash at the waist, with a fringed end hanging on the viewer's left.
color(sashY) translate([0, 0, 13.6]) scale([6.5, 5.4, 1.5]) sphere(1, $fn = 28);
for (dz = [-0.65, 0.65]) color(sashR) translate([0, 0, 13.6 + dz]) scale([6.38, 5.3, 0.28]) sphere(1, $fn = 28);
for (a = [0 : 30 : 330]) color(a % 60 == 0 ? sashG : sashR) translate([6.45 * sin(a), -5.35 * cos(a), 13.6]) scale([0.55, 0.55, 0.55]) sphere(1, $fn = 8);
color(sashY) hull() {
  translate([-4.8, -2.6, 13.2]) sphere(0.8, $fn = 10);
  translate([-8, -2.5, 7]) scale([1.6, 0.35, 0.8]) sphere(1, $fn = 10);
}
color(sashR) translate([-6.6, -2.6, 9.4]) rotate([0, -30, 0]) scale([1.5, 0.4, 0.35]) sphere(1, $fn = 8);
for (i = [0 : 3]) limb([-9.2 + i * 0.7, -2.5, 6.6 + i * 0.4], [-9.6 + i * 0.7, -2.5, 4.8 + i * 0.4], 0.18, 0.15, sashR);

// Neck and head: a fox head with a cream muzzle, one eye winking.
ell([2.8, 2.6, 2], [0, -0.6, 23.4], fur);
blob([[[5.6, 4.8, 4.8], [0, -0.6, 27.8]], [[3.8, 3.6, 3.2], [0, -2, 26.4]]], fur);
mirror_x() spike([4.2, -0.8, 26], [2, 0.4, -1.4], 1.3, 0.1, fur);
blob([[[2.6, 2, 1.9], [0, -4.4, 26]], [[1.1, 1.2, 0.9], [0, -7.6, 26.4]]], cream);
ell([0.7, 0.5, 0.55], [0, -8.6, 26.8], nose);
// Snarling open mouth with fangs.
color([0.25, 0.04, 0.04]) translate([0, -6.2, 25.1]) scale([1.6, 1.4, 0.7]) sphere(1, $fn = 14);
mirror_x() spike([0.9, -7.1, 25.7], [0, -0.1, -1.1], 0.32, 0.05, fang);
mirror_x() spike([0.9, -6.9, 24.5], [0, -0.1, 0.9], 0.28, 0.05, fang);
// Glowing red eyes under furious brows.
mirror_x() {
  eye([2.4, -4.0, 28.8], 1.65, iris = [1, 0.22, 0.08, GLOW], pupil = [0.4, 0.02, 0.02], sclera = [1, 0.45, 0.3], yaw = 8, flat = 0.42, lid = 0.48, lid_tilt = 32, lid_c = furDk, slit = 0.3);
  brow([2.4, -4.0, 28.8], 1.65, 0.65, fur, 8);
}
// Bristling fur spikes round the head and neck.
for (sp = [[[4.6, 1, 29], [1.6, 1.2, 1.4]], [[-4.6, 1, 29], [-1.6, 1.2, 1.4]], [[3, 3, 24], [1.6, 1.4, -0.8]],
           [[-3, 3, 24], [-1.6, 1.4, -0.8]], [[0, 4, 27], [0, 2, 0.8]], [[5, -1, 27.5], [2.2, 0.6, 0.4]], [[-5, -1, 27.5], [-2.2, 0.6, 0.4]]])
  spike(sp[0], sp[1], 1, 0.1, fur);

// Tall ears and the fez.
mirror_x() ear([3.2, 0.4, 30.4], [5, 2.5, 11.5], 3, earIn, fur, fur);
fezHat([0.2, 0, 31.3], 4);

// Sleeved arms raised to shoulder height, fur hands holding the orange clusters.
mirror_x() {
  limb([4.8, 0, 21.4], [8.6, -1.4, 18.4], 1.9, 1.7, robe);
  limb([8.6, -1.4, 18.4], [10.6, -2.4, 21], 1.7, 1.6, robe);
  ell([1.6, 1.5, 1.2], [11, -2.6, 22.2], fur);
  cluster([11.2, -2.6, 24.6]);
}

// Thorny vines: a helix of brown capsules with pale thorns, wound around a path.
module vineCoil(a, b, r, turns, n) {
  pts = [for (i = [0 : n]) let(t = i / n, ang = t * 360 * turns, d = b - a,
            ref = abs(d[2]) > 0.9 * norm(d) ? [1, 0, 0] : [0, 0, 1],
            u = cross(d, ref) / norm(cross(d, ref)), v = cross(d / norm(d), u))
           a + d * t + (u * cos(ang) + v * sin(ang)) * r];
  chain(pts, [for (i = [0 : n]) 0.42], vine, $fn = 8);
  for (i = [1 : 2 : n - 1]) let(o = pts[i] - (a + (b - a) * i / n)) spike(pts[i], o / norm(o) * 1.2 + [0, 0, 0.3], 0.28, 0.04, thorn);
}
mirror_x() vineCoil([4.8, 0, 21.4], [10.6, -2.4, 21], 2, 2, 14);
vineCoil([0, 0, 4.5], [0, 0, 11.5], 6.9, 1.2, 16);
vineCoil([1.5, 4.5, 9], [12.5, 6.5, 13], 3.4, 2, 14);

// Big brown tail curving out behind on the viewer's right.
blob([[[1.4, 1.4, 1.4], [1.5, 4.5, 9]], [[3.6, 3.2, 3.4], [7, 7, 6.5]], [[4.6, 3.6, 4.6], [11.5, 6.5, 9.5]]], fur);
blob([[[4.4, 3.4, 4], [12.2, 6.5, 11.6]], [[1.8, 1.6, 2], [13.4, 6, 17.4]]], furDk);
// Spiky tail fur.
for (sp = [[[9, 9.6, 12], [0, 2.4, 1]], [[14.6, 6, 13], [2.4, 0, 0.6]], [[12, 9.4, 8], [0.4, 2.4, -1]], [[15, 6.5, 9], [2, 1, -1]]]) spike(sp[0], sp[1], 1, 0.1, fur);
