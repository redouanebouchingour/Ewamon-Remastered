// Resilithorn: Resilith's final form has grounded itself into a six-legged armoured forest beast. A shell of leaf-green
// plates sprouting a ridge of fresh leaves, a horned mask with glowing orange eyes, chunky plated legs with red claws,
// a thick tail, and two branching antlers hung with leaves and blue berries.
include <lib.scad>

green = [0.42, 0.6, 0.25];
greenHi = [0.56, 0.74, 0.34];
greenDk = [0.27, 0.42, 0.16];
leafC = [0.55, 0.8, 0.4];
leafHi = [0.7, 0.9, 0.5];
bark = [0.44, 0.3, 0.2];
barkDk = [0.32, 0.21, 0.14];
berry = [0.3, 0.45, 0.85];
red = [0.82, 0.12, 0.2];
under = [0.2, 0.22, 0.28];
eyeOr = [1, 0.55, 0.1];

// Faceted armour plate.
module plate(r, p, rot = [0, 0, 0], c = green) color(c) translate(p) rotate(rot) scale(r) sphere(1, $fn = 8);
module leaf(p, rot, s = 1, c = leafC) color(c) translate(p) rotate(rot) translate([0, 0, 1.6 * s]) scale([0.8 * s, 0.3 * s, 1.8 * s]) sphere(1, $fn = 10);

// Body: dark underbelly and a domed shell of plates.
ell([9, 12, 5], [0, 2, 11], under);
ell([10.5, 13.5, 7.5], [0, 2.5, 15], green);
for (r = [[-1, -6, 22, -20], [1, 1, 23.5, 0], [-1, 8, 22, 20]])
  for (sx = [-1, 1]) plate([4.4, 4.6, 2.4], [sx * 4.4, r[1], r[2] - 1.5], [r[3], sx * 25, 0], (sx + r[0]) == 0 ? greenHi : green);
for (y = [-5, 2, 9]) mirror_x() plate([3.6, 4.4, 3.2], [9, y, 14.5], [0, 60, 0], greenDk);
// Raised armoured chest in front of the shell, the head sits on top of it.
blob([[[7.5, 5, 6], [0, -8, 18]], [[6, 4, 4], [0, -9, 12]]], green);
plate([5, 2.4, 4.5], [0, -12, 15.5], [10, 0, 0], greenHi);
color(bark) translate([0, -13.6, 14]) scale([2.6, 1, 3.2]) sphere(1, $fn = 12);  // bark chest patch
// Ridge of fresh leaves along the shell.
for (i = [0 : 7]) {
  y = -7 + i * 2.6;
  z = 22.5 - pow((y - 2.5) / 13.5, 2) * 6;
  for (sx = [-1, 1]) leaf([sx * 1.8, y, z - 0.5], [0, sx * 30, 0], 1.5 + (i % 2) * 0.4, i % 2 == 0 ? leafC : leafHi);
}
for (y = [12, 15]) mirror_x() leaf([5, y, 15], [-50, 30, 0], 1, leafC);

// Head: a squared armoured mask low at the front with a single brow horn.
translate([0, -3, 8]) {
blob([[[5.2, 4.6, 4.6], [0, -12, 15.5]], [[4.2, 3.4, 3.6], [0, -14.6, 13.5]]], green);
plate([5.6, 3, 2.4], [0, -13.5, 19], [-15, 0, 0], greenHi);  // brow plate
mirror_x() plate([2.8, 2.4, 3], [3.6, -15, 12.8], [0, 0, -20], greenDk);  // cheek plates
color(bark) translate([0, -16.3, 12]) scale([2.2, 1.2, 2.4]) sphere(1, $fn = 14);  // snout
color(barkDk) translate([0, -17.3, 11]) scale([1.6, 0.4, 0.4]) sphere(1, $fn = 10);  // mouth
spike([0, -14, 20], [0, -3, 6], 1.4, 0.1, bark);  // brow horn
mirror_x() leaf([4.8, -12, 19], [0, 50, 0], 1.3, leafC);  // leaf ears
mirror_x() {
  // Glowing orange eyes sunk into the mask under a heavy brow that slants down to the snout.
  eye([2.7, -16.4, 15.3], 1.75, iris = [1, 0.55, 0.1, GLOW], sclera = [1, 0.82, 0.3], pupil = [0.4, 0.06, 0], yaw = 12,
      flat = 0.5, lid = 0.4, lid_tilt = 32, lid_c = greenDk, slit = 0.4);
  color(greenHi) hull() {
    translate([4.4, -15.4, 17.7]) scale([1.5, 1.3, 0.85]) sphere(1, $fn = 10);
    translate([1, -17.2, 16.9]) scale([0.9, 0.9, 0.6]) sphere(1, $fn = 10);
  }
}
}

// Antlers: branching brown boughs rising from the head, with leaves and hanging blue berries.
module antler(sx) {
  b0 = [sx * 3, -13, 27];
  b1 = [sx * 6, -12, 33];
  b2 = [sx * 7, -11, 41];
  b3 = [sx * 12.5, -11, 38];
  b4 = [sx * 3.5, -11.5, 39];
  b5 = [sx * 11.5, -11.5, 31];
  chain([b0, b1, b2], [1.3, 1, 0.55], bark);
  limb(b1, b3, 0.75, 0.4, bark);
  limb(b1 + [sx * -0.3, 0, 2.5], b4, 0.6, 0.35, bark);
  limb(b0 + [sx * 1.5, 0, 2.5], b5, 0.65, 0.35, bark);
  for (t = [[b2, [0, sx * -15, 0]], [b3, [0, sx * 50, 0]], [b4, [0, sx * -40, 0]], [b5, [0, sx * 70, 0]],
            [(b1 + b3) / 2, [0, sx * 20, 0]], [(b0 + b5) / 2, [0, sx * 40, 0]]])
    leaf(t[0], t[1], 1.6, leafHi);
  for (t = [[b2, [sx * 1.6, 0, -1.5]], [b3, [sx * -1.2, 0, -2]], [b4, [sx * -1.4, 0, -1.5]], [b5, [0, 0, -1.6]], [b1, [sx * 1.6, 0, -0.8]],
            [(b1 + b3) / 2, [0, 0, -1.4]]])
    color(berry) translate(t[0] + t[1] + [0, 0, -0.9]) sphere(0.9, $fn = 10);
}
antler(1);
antler(-1);
// Small twigs sprouting from the shell sides.
mirror_x() {
  limb([9, 4, 18], [14, 6, 21], 0.4, 0.25, bark);
  leaf([14, 6, 21], [0, 60, 0], 0.7, leafHi);
  color(berry) translate([13, 6, 19.8]) sphere(0.6, $fn = 8);
}

// Six chunky plated legs, splayed outward, with red claws.
module legx(b, sx, fwd) {
  k = b + [sx * 4, fwd, -3];
  f = k + [sx * 1.2, fwd * 0.4, -k[2] + 1.2];
  limb(b, k, 2.4, 2, under);
  plate([2.6, 2.8, 3.6], k + [sx * 0.6, 0, -1.6], [0, sx * 15, 0], green);
  plate([2.2, 2.4, 1.6], k + [sx * 0.2, -0.4, 1.4], [0, sx * 30, 0], greenHi);
  limb(k, f, 2, 1.8, green);
  for (a = [-30, 0, 30]) spike(f + [sin(a) * 1.3, -1.6, -0.6], [sin(a) * 0.8, -2.4, -0.6], 0.75, 0.05, red);
}
for (sx = [-1, 1]) {
  legx([sx * 7, -7, 10], sx, -2);
  legx([sx * 8, 1, 9.5], sx, 0);
  legx([sx * 7, 9, 10], sx, 2);
}

// Thick plated tail down to the ground behind.
chain([[0, 14, 11], [2, 19, 7], [5, 21.5, 3.5], [8, 22, 2]], [4, 3.2, 2.2, 1.2], green);
for (i = [0 : 3]) {
  p = [[0, 15.5, 13.5], [1.4, 18.6, 10], [3.4, 20.8, 6.5], [6, 22, 4]][i];
  plate([2.8 - i * 0.5, 2.4, 1.4], p, [-40 - i * 10, 0, i * 15], greenHi);
  leaf(p + [0, 0, 1], [-30, 0, 0], 0.8 - i * 0.1, leafC);
}
