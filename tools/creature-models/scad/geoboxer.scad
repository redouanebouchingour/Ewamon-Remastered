// Geoboxer: Pebfist grown up. A hulking clay-brown brawler armoured in faceted stone slabs veined with glowing magma,
// both boulder fists raised beside a gritted-teeth scowl, in the same wide crouch.
include <lib.scad>

skin = [0.62, 0.47, 0.31];
skinHi = [0.72, 0.56, 0.38];
skinDk = [0.47, 0.34, 0.22];
stone = [0.55, 0.47, 0.37];
stoneHi = [0.66, 0.58, 0.47];
stoneDk = [0.42, 0.35, 0.27];
magma = [1, 0.5, 0.08];
dirt = [0.45, 0.36, 0.25];
eyeC = [0.42, 0.24, 0.08];

// Faceted stone slab: a low-poly ellipsoid.
module rock(r, p, rot = [0, 0, 0], c = stone) {
  color(c) translate(p) rotate(rot) scale(r) sphere(1, $fn = 7);
}
// Glowing magma vein between points.
module vein(pts) chain(pts, [for (q = pts) 0.32], magma);

// Torso: a broad V, wider than Pebfist's.
blob([[[10.5, 6.5, 5.5], [0, 0.5, 21]], [[6.5, 5, 4], [0, 0, 13.5]]], skin);
// Stone chest plates and abs.
mirror_x() rock([4.4, 2.2, 3.2], [3.4, -4.8, 21.5], [0, 10, 15], stone);
for (z = [13, 16.2]) mirror_x() rock([1.8, 1.2, 1.4], [1.8, -4.4, z], [0, 0, 10], stoneHi);
vein([[0, -6.4, 23.5], [0.6, -6.6, 20.5], [-0.4, -6.2, 18]]);
vein([[3.5, -7, 22.5], [5, -6.8, 20.5], [6.4, -6.2, 21.5]]);
vein([[-2.5, -6.9, 21], [-4.5, -6.8, 23], [-6.5, -6, 22]]);
// Back slabs.
mirror_x() rock([4.8, 2.6, 5], [3.8, 4.8, 21], [0, -10, -10], stone);
mirror_x() rock([3, 2, 3], [2.8, 5, 13.5], [0, 0, 0], stoneHi);
vein([[0, 7.4, 24], [0.5, 7.2, 20], [-0.3, 6.8, 16], [0.8, 5.6, 12]]);
vein([[3, 7.3, 23], [5.5, 7, 19.5]]);
vein([[-2.5, 7.4, 21], [-5.5, 7, 23]]);
// Hips.
blob([[[6.8, 5, 3.2], [0, 0.5, 11]]], skin);
mirror_x() ell([3.1, 2.3, 2.6], [2.6, 4.4, 10.5], skinHi);

// Head: bald, set low between the shoulders; snarl with gritted teeth.
ell([6.2, 6, 6.6], [0, -2, 30.5], skin);
mirror_x() ell([1.1, 1.4, 1.7], [6.1, -1.2, 30], skinDk);  // ears
mirror_x() {
  // Deep-set glaring eyes: a dark socket, the eye sunk into it, a heavy brow ridge slanting down to the nose.
  color(skinDk) translate([2.5, -6.7, 30.9]) scale([1.9, 0.8, 1.6]) sphere(1, $fn = 14);
  eye([2.5, -7, 30.8], 1.45, iris = [0.85, 0.5, 0.12], sclera = [0.96, 0.9, 0.78], pupil = [0.08, 0.04, 0.02], yaw = 8, flat = 0.5,
      lid = 0.4, lid_tilt = 30, lid_c = skinDk, slit = 0.55);
  color(skin) hull() {
    translate([4.4, -6.2, 33]) scale([1.5, 1.2, 0.9]) sphere(1, $fn = 12);
    translate([0.9, -7.7, 32]) scale([1, 1, 0.7]) sphere(1, $fn = 10);
  }
}
ell([1, 1.2, 1.3], [0, -8.5, 29.2], skinHi);  // nose
color([0.25, 0.12, 0.06]) translate([0, -7.4, 26.6]) scale([2.4, 1, 1]) sphere(1, $fn = 16);  // open snarl
color([0.96, 0.94, 0.86]) translate([0, -8.1, 26.6]) scale([2.1, 0.5, 0.65]) sphere(1, $fn = 14);  // teeth
color([0.25, 0.12, 0.06]) translate([0, -8.5, 26.6]) cube([3.6, 0.3, 0.14], center = true);

// Arms: huge stone pauldrons, slab-armoured forearms, boulder fists raised high on both sides of the head.
module arm(sx) {
  sh = [sx * 10, 0.5, 23.5];
  el = [sx * 14, 0, 17];
  fist = [sx * 13, -4.5, 31];
  rock([5, 5, 4.4], sh + [sx * 0.5, 0, 1], [10, sx * 20, 0], stone);
  rock([3.2, 3.2, 2.6], sh + [sx * 1.4, -2, 3.2], [0, sx * 20, 30], stoneHi);
  limb(sh, el, 3.6, 3.2, skin);
  ell([3, 3, 3], el + [sx * -0.8, -1, 2], skinHi);  // bicep
  limb(el, fist + [0, 1.5, -2.5], 3.4, 3.6, skin);
  rock([4.8, 4.4, 5.6], (el + fist) / 2 + [sx * 1, -0.4, -0.5], [-20, sx * -15, 0], stone);  // forearm slab
  vein([(el + fist) / 2 + [sx * 3.2, -1.8, -3], (el + fist) / 2 + [sx * 4.4, -1.2, 0], (el + fist) / 2 + [sx * 3.8, -2.4, 3]]);
  // Fist: a block of stone knuckles.
  rock([6.6, 6, 6.4], fist, [0, 0, sx * 10], stone);
  for (k = [0 : 3]) rock([1.9, 1.6, 1.6], fist + [sx * (-3 + k * 2), -5.4, 2.8 - k * 0.2], [0, 0, 0], stoneHi);
  rock([1.8, 2.4, 2.6], fist + [sx * -4.6, -3, -1.6], [0, 0, 0], stoneDk);  // thumb
  vein([fist + [sx * 3.5, -4.4, -2.5], fist + [sx * 5.4, -2.4, 0.5], fist + [sx * 4.8, 0, 4]]);
}
arm(-1);
arm(1);

// Legs: a wide crouch, plated thighs and knees, bare feet.
mirror_x() {
  chain([[4, 0.5, 10], [9.5, -1.5, 6], [10.5, 0, 1.6]], [4, 3.2, 2.5], skin);
  rock([3, 2.8, 2.6], [9.4, -3, 7], [0, 15, 20], stone);  // knee plate
  vein([[8.2, -5.3, 7.5], [9.6, -5.6, 6.2], [10.8, -5.2, 7.2]]);
  ell([2.8, 2.6, 2.6], [7.5, -1.5, 8.8], skinHi);
  blob([[[2.8, 4.2, 1.3], [11, -2, 1.3]], [[2.4, 2.2, 1.3], [10.5, 1, 1.5]]], skin);
  for (i = [0 : 3]) color(skinDk) translate([9.5 + i * 1.05, -6, 0.7]) scale([0.8, 0.9, 0.65]) sphere(1, $fn = 10);
}

// Dust kicked up around the feet.
for (d = [[-16, -2, 3.2], [16, -1, 3.2], [-15, 5, 2.6], [15, 5, 2.6], [-8, -8, 2.2], [8, -7, 2.2], [0, 6, 2.6]])
  ell([d[2], d[2], d[2] * 0.3], [d[0], d[1], d[2] * 0.25], dirt);
for (d = [[-17.5, -1, 3.5], [17, 2, 4], [-16, 6, 2.5]]) color(dirt) translate(d) sphere(0.8, $fn = 8);
