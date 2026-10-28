// Castlemaw: a hulking honey badger under a shaggy dark fur cloak, a bone skull plate on its chest, a belt of bones,
// steel-banded arms that end in cannon barrels, bone-spiked pauldrons and spikes along its back.
include <lib.scad>

fur = [0.16, 0.19, 0.18];
furHi = [0.27, 0.31, 0.29];
cloak = [0.12, 0.15, 0.14];
cream = [0.9, 0.86, 0.74];
bone = [0.85, 0.8, 0.66];
boneDark = [0.6, 0.55, 0.44];
steel = [0.38, 0.4, 0.44];
steelDark = [0.2, 0.21, 0.24];
mask = [0.09, 0.09, 0.1];
socket = [0.07, 0.07, 0.08];
eyeRed = [1, 0.1, 0.06, GLOW];
mouth = [0.4, 0.08, 0.08];
claw = [0.85, 0.8, 0.68];

// A shaggy lock of fur: flat at the root, tapering to a point along d.
module tuft(p, d, r, c) {
  color(c) hull() {
    translate(p) scale([1, 0.6, 1]) sphere(r, $fn = 8);
    translate(p + d) sphere(0.15, $fn = 4);
  }
}

// Legs: thick, bowed, set wide under the hips, bear feet with bone claws.
mirror_x() {
  blob([[[4.6, 4.8, 5.4], [6, 1.5, 10]], [[3.6, 3.8, 3.4], [7.5, 0, 4]]], fur);
  blob([[[3.8, 5, 1.8], [7.8, -1.6, 1.8]]], fur);
  for (a = [-30, -10, 10, 30]) spike([7.8 + sin(a) * 2.6, -5.8, 1.4], [sin(a) * 0.5, -1.8, -1], 0.6, 0.05, claw);
}

// Torso: a broad, hunched wedge, narrow at the hips and wide across the shoulders, leaning forward.
blob([[[7, 5.5, 5], [0, 2, 12]], [[8.4, 6.4, 5], [0, 0.5, 18]], [[12, 7, 5], [0, -0.5, 25]], [[7, 5.5, 4], [0, -2.5, 30]]], fur);
// Bone belt: a row of vertebrae round the waist.
for (a = [-120 : 15 : 120]) let(x = 8.4 * sin(a), y = 2 - 7.4 * cos(a))
  color(a % 30 == 0 ? bone : boneDark) hull() {
    translate([x, y, 11.2]) sphere(1, $fn = 8);
    translate([x, y, 13.4]) sphere(1, $fn = 8);
  }

// Chest skull: a bone cranium with deep sockets, a nose hole, cheekbones and a toothy jaw.
module skull() {
  color(bone) hull() {
    translate([0, -6.4, 23.4]) scale([5.2, 2, 3.6]) sphere(1, $fn = 20);
    translate([0, -6.6, 19.6]) scale([4.2, 1.8, 2]) sphere(1, $fn = 16);
  }
  color(bone) hull() {
    translate([0, -6.6, 17.6]) scale([3.4, 1.6, 1.4]) sphere(1, $fn = 14);
    translate([0, -6.2, 15.4]) scale([2.6, 1.4, 1]) sphere(1, $fn = 12);
  }
  // Sockets slant down to the middle, an angry stare.
  mirror_x() color(socket) translate([2.1, -8, 21.6]) rotate([0, -18, 0]) scale([1.7, 0.7, 1.25]) sphere(1, $fn = 12);
  color(socket) hull() {
    translate([-0.6, -8.1, 19.6]) sphere(0.3, $fn = 6);
    translate([0.6, -8.1, 19.6]) sphere(0.3, $fn = 6);
    translate([0, -8.1, 18.5]) sphere(0.2, $fn = 6);
  }
  for (x = [-2.1 : 0.84 : 2.2]) color(socket) translate([x, -7.8, 16.6]) cube([0.3, 0.8, 2.4], center = true);
}
translate([0, 0, -1.2]) translate([0, -6.5, 20]) scale([1.25, 1.1, 1.2]) translate([0, 6.5, -20]) skull();
// Chest fur: shaggy locks framing the skull and ridged dark belly bands under it, so the front is not a plain block.
mirror_x() for (k = [0 : 4]) let(z = 27 - k * 3.4, x = 7.4 - k * 0.35)
  tuft([x, -5.4 + k * 0.3, z], [-1.2, -1.4, -4.2], 1.6, k % 2 ? furHi : fur);
for (k = [0 : 2]) color(k == 1 ? furHi : fur) translate([0, -5.8 + k * 0.3, 15.6 - k * 1.5])
  scale([5.6 - k * 0.6, 1.6, 0.7]) sphere(1, $fn = 14);


module head_shape(g = 0) {
  hull() {
    translate([0, -4, 33.6]) scale([5.2 + g, 5 + g, 4 + g]) sphere(1, $fn = 24);
    translate([0, -9, 32.8]) scale([3.6 + g, 3.4 + g, 2.8 + g]) sphere(1, $fn = 20);
    translate([0, -13.6, 31.8]) scale([1.6 + g, 1.6 + g, 1.4 + g]) sphere(1, $fn = 14);
  }
}
// Neck scruff: a thick ruff of fur that the head sinks into, joining it to the shoulders and the cloak mound.
color(fur) hull() {
  translate([0, 1, 30]) scale([8.5, 6, 4]) sphere(1, $fn = 18);
  translate([0, 2, 35]) scale([7, 5, 4]) sphere(1, $fn = 18);
}
mirror_x() for (k = [0 : 3]) tuft([6.5 + k * 0.4, -2 + k * 1.8, 34.5 - k * 1.2], [2.6, -0.6, -3.6], 1.7, k % 2 ? furHi : cloak);
// Head, scaled up about the neck: big and low, the skull sunk into the ruff and thrust forward.
translate([0, 2.5, 28.5]) scale(1.5) translate([0, 0, -29]) {
// Head: a badger's wedge, low and thrust forward: a broad flat skull narrowing to a pointed snout. Cream, with a
// black band from the nose back through the eyes, a black jaw and a black nose.
color(cream) head_shape();
// Black band: along each side of the head from the snout back through the eye to the ear, the crown stays cream.
mirror_x() color(mask) intersection() {
  head_shape(0.12);
  hull() {
    translate([1.1, -16, 31.6]) cube([10, 0.1, 2.2]);
    translate([1.6, -2, 33]) cube([10, 0.1, 3.6]);
  }
}
// Round cream-rimmed ears at the back corners.
mirror_x() { ell([1.4, 0.8, 1.1], [4.2, -1.8, 35.9], cream); ell([0.8, 0.5, 0.6], [4.2, -2.5, 35.9], mask); }
// Nose.
ell([1.2, 1, 0.9], [0, -15, 32.2], mask);
// Snarl: a dark lower jaw dropped under the snout, a red mouth and bone fangs.
color(mask) hull() {
  translate([0, -5, 30]) scale([4, 3.2, 1.6]) sphere(1, $fn = 16);
  translate([0, -11, 29.4]) scale([1.8, 1.2, 1]) sphere(1, $fn = 12);
}
color(mouth) hull() {
  translate([0, -8.6, 30.5]) scale([2.8, 2.4, 0.9]) sphere(1, $fn = 14);
  translate([0, -12, 30.4]) scale([1.3, 0.8, 0.6]) sphere(1, $fn = 10);
}
for (t = [-1, -0.45, 0.45, 1]) spike([1.8 * t, -12 + abs(t) * 1.4, 31.4], [0, -0.1, -1.4], 0.38, 0.05, claw);
for (t = [-1, 1]) spike([1.6 * t, -11.4, 29.6], [0, -0.1, 1.3], 0.34, 0.05, claw);
// Red eyes sunk into the black band under a hard black brow that slants down to the nose: a scowl.
mirror_x() {
  eye([2.4, -10.6, 33.2], 1.5, iris = [1, 0.55, 0.2, GLOW], pupil = [0.15, 0, 0], sclera = eyeRed, yaw = -38,
      lid = 0.42, lid_tilt = 30, lid_c = mask, slit = 0.3, squint = 0.12);
  color(mask) hull() {
    translate([3.3, -9.7, 34.7]) scale([0.8, 1.2, 0.5]) sphere(1, $fn = 10);
    translate([1.1, -11.6, 33.9]) scale([0.6, 0.9, 0.45]) sphere(1, $fn = 8);
  }
}
}

// Shaggy cloak: a hunched mound of fur rising behind the head, humped over the shoulders, bellying out over the back
// and drawn in a little at the ragged hem: an egg, not a bell.
color(cloak) hull() {
  translate([0, 5, 38]) scale([8, 4.5, 4.5]) sphere(1, $fn = 20);
  translate([0, 8, 30]) scale([15, 7, 5]) sphere(1, $fn = 20);
  translate([0, 9.5, 20]) scale([16, 7.5, 7]) sphere(1, $fn = 20);
  translate([0, 8.5, 6]) scale([12.5, 6, 4]) sphere(1, $fn = 20);
}
// Cloak fronts hanging open beside the chest, from the shoulders to the knees.
mirror_x() color(cloak) hull() {
  translate([9.5, -2, 27]) scale([2.6, 2.6, 2]) sphere(1, $fn = 12);
  translate([11, -4, 16]) scale([2, 2, 2]) sphere(1, $fn = 10);
  translate([12.5, -1, 5]) scale([2, 2.4, 1.5]) sphere(1, $fn = 10);
}
// Ragged lapels: locks hanging off the cloak fronts' inner edges.
mirror_x() for (k = [0 : 3]) tuft([10 + k * 0.6, -4.4, 25 - k * 5.5], [-0.6, -0.8, -5], 1.5, k % 2 ? furHi : cloak);
// A lock of shag: a flat blade lying along the mound (rooted wide along the tangent at angle a), tapering along d.
module lock(p, a, d, w, c) {
  color(c) hull() {
    translate(p) rotate([0, 0, -a]) scale([w, 0.4 * w, 0.8 * w]) sphere(1, $fn = 8);
    translate(p + d) sphere(0.15, $fn = 4);
  }
}
// The cloak's outline per height: half-width, half-depth and centre depth (matches the hull above).
function mrx(z) = z > 30 ? 8 + 7 * (38 - z) / 8 : z > 20 ? 15 + (30 - z) * 0.1 : 16 - (20 - z) * 0.25;
function mry(z) = z > 30 ? 4.5 + 2.5 * (38 - z) / 8 : 7.2;
function myc(z) = z > 30 ? 5 + 3 * (38 - z) / 8 : 8.5 + min(z - 6, 14) / 14;
// The shag: overlapping rows of long flat locks pointing down and out, lengths jittered so the rows don't read as
// rings, every few a lighter streak.
for (row = [0 : 6]) let(z = 38 - row * 5.2, n = 8 + row)
  for (i = [0 : n - 1]) let(a = -112 + 224 * (i + (row % 2) * 0.5) / n, rx = mrx(z), ry = mry(z),
                            j = (i * 7 + row * 5) % 5,
                            p = [rx * sin(a), myc(z) + ry * cos(a), z + (j - 2) * 0.5],
                            o = [sin(a), cos(a), 0],
                            l = 6.5 + j * 1.3 + (row == 6 ? 2 : 0))
    lock(p, a, o * (1.2 + row * 0.25) + [((i % 3) - 1) * 0.8, 0, -l], 2.6 + j * 0.2,
         (i * 3 + row) % 5 == 0 ? furHi : cloak);
// Ragged hem: long and short locks alternating.
for (i = [0 : 14]) let(a = -104 + 208 * i / 14, p = [12.6 * sin(a), 8.5 + 6.2 * cos(a), 4.5])
  lock(p, a, [sin(a) * 1.2, cos(a) * 1.2, -(i % 3 == 0 ? 4.6 : 3)], 2, i % 2 ? cloak : furHi);
// A spiky crest of fur standing up behind the head.
for (i = [0 : 6]) let(x = -7.5 + i * 2.5)
  tuft([x, 5 + abs(x) * 0.1, 38.5 - abs(x) * 0.4], [x * 0.45, 3, 7 - abs(x) * 0.4], 2, i % 2 ? furHi : cloak);
// A pale streak of bone-coloured fur across the shoulders (the sprite's back highlight).
color(furHi) hull() {
  translate([-6, 8.6, 34.5]) sphere(0.9, $fn = 8);
  translate([6, 9.4, 33]) sphere(0.7, $fn = 8);
}
// Bone spikes along the back.
// Bone horns jutting through the shag along the back, big enough to clear the locks.
for (s = [[0, 10.5, 35], [-6.5, 13, 29], [6.5, 13, 29], [-4, 15, 22], [4, 15, 22], [-9, 14.5, 15], [9, 14.5, 15],
          [0, 15.5, 13]])
  spike(s, [s[0] * 0.25, 6.5, 3.2], 1.8, 0.1, bone);

// Arms: a spiked steel pauldron, a banded upper arm, and a forearm that is a cannon barrel aimed forward-down.
module arm(s) {
  // Pauldron: two overlapping plates with a bone trim, bone spikes on top.
  color(steel) hull() {
    translate([s * 12, 0, 27]) scale([4.6, 5, 2.8]) sphere(1, $fn = 18);
    translate([s * 14.5, -0.5, 24]) scale([2.6, 4.2, 1.6]) sphere(1, $fn = 14);
  }
  color(steelDark) translate([s * 14.2, -0.4, 23.6]) scale([2.8, 4.4, 1.2]) sphere(1, $fn = 14);
  color(bone) translate([s * 12.6, -0.2, 26.6]) scale([4.2, 4.6, 0.6]) sphere(1, $fn = 18);
  spike([s * 11.5, -1, 29], [s * 0.8, 0, 4.4], 1.2, 0.1, bone);
  spike([s * 14, 0, 28.5], [s * 2.6, 0, 3], 1, 0.1, bone);
  spike([s * 12, 3, 28.5], [0, 1.5, 3.4], 0.9, 0.1, bone);
  // Upper arm: a dark sleeve with two steel bands.
  limb([s * 13.6, 0, 24], [s * 14.8, -2.6, 16.5], 3.2, 3.4, fur);
  for (k = [0.3, 0.7]) color(steel) translate([s * (13.6 + 1.2 * k), -2.6 * k, 24 - 7.5 * k])
    rotate([-19, s * 9, 0]) cylinder(h = 1.4, r = 3.6, center = true, $fn = 16);
  // Forearm cannon: elbow at the top, the muzzle out in front, banded in steel and bone.
  e = [s * 14.8, -2.6, 16.5];
  m = [s * 15.6, -10.5, 10.5];
  d = m - e;
  color(steelDark) hull() { translate(e) sphere(3.4, $fn = 16); translate(m) sphere(3, $fn = 16); }
  for (k = [0.15, 0.45, 0.75]) color(k == 0.45 ? bone : steel)
    translate(e + d * k) rotate(_dir_rot(d)) cylinder(h = 1.3, r = 3.75 - k * 0.5, center = true, $fn = 18);
  color(steel) translate(m) rotate(_dir_rot(d)) cylinder(h = 1.6, r = 3.2, center = true, $fn = 18);
  color(socket) translate(m + d / norm(d) * 0.6) rotate(_dir_rot(d)) cylinder(h = 0.4, r = 2, $fn = 14);
  // Claws curling out under the barrel.
  for (a = [-30, 0, 30]) spike([s * 15.6 + sin(a) * 2, -7.4, 8.2], [sin(a) * 0.4, -1, -2.6], 0.55, 0.05, claw);
}
arm(1);
arm(-1);
