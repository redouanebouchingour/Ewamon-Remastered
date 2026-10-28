// Geoboxer: a hulking clay-brown brawler, bald and scowling with gritted teeth, both boulder fists raised in a guard
// beside its head, its forearms armoured in faceted stone slabs cracked with magma, in a wide crouch.
//
// Checklist (front sheet, x = sheet x, z = sheet z; the feet stand on z ~5.4, the grey ground puddle and dust are
// not modelled):
//   - head: bald dome x -8.5..1.5, z 28.4..39.2 (centre (-3.5, 33.8)), turned to look at the viewer; heavy slanted
//     brows, small dark eyes at (-5.8, 33.2) and (-2.5, 33.2), a broad nose, a wide gritted-teeth grimace z 29.2..30.9
//   - torso: broad chest x -7.5..5, z 18.4..28.4: two big pec slabs, a six-pack below, magma cracks down the middle
//   - arms: raised guard. Fists: left (creature's -X) block x -21.5..-12.5, z 28.4..35.4; right x 5.5..16.5,
//     z 27.4..38.9 (nearer the camera, drawn bigger); forearm slabs below them x -18..-10.5 / 3..13, z 19.4..28.4;
//     elbows low at z ~20, upper arms rising to the shoulders at (-8, 27) / (6, 28); magma veins on the slabs
//   - legs: wide crouch; knees out at (-12.5, 10.5) and (10.5, 10), thighs from hips at z ~16, shins to feet at
//     z 5.4..8.9, x -13.5..-8.5 and 6..12.5, toes forward
//   - back: bare muscled back, the slab-armoured backs of the arms and fists, magma cracks on the spine and arms
// Colours: skin M0 mid [0.48, 0.35, 0.26], slabs #957b5b, highlights #ac8b62, creases #482f25, magma #ef7919 (no
// GLOWS on the sheet: NOGLOW), teeth grey M1, mouth M2.
include <lib.scad>

skin = [0.48, 0.35, 0.26];
skinHi = [0.68, 0.55, 0.38];
skinDk = [0.38, 0.30, 0.24];
crease = [0.28, 0.18, 0.15];
slab = [0.58, 0.48, 0.36];
slabHi = [0.77, 0.66, 0.51];
slabDk = [0.34, 0.23, 0.18];
magma = [0.94, 0.47, 0.10, NOGLOW];
teeth = [0.80, 0.80, 0.80];
mouth = [0.16, 0.11, 0.09];

// Faceted stone slab: a low-poly ellipsoid.
module rock(r, p, rot = [0, 0, 0], c = slab, fn = 7) { color(c) translate(p) rotate(rot) scale(r) sphere(1, $fn = fn); }
// Magma vein: a thin bright crack through the points.
module vein(pts, w = 0.42) chain(pts, [for (q = pts) w], magma);

// ---- Torso: a broad chest leaning forward, pec slabs, a six-pack, a narrow waist.
blob([[[8.0, 5.6, 4.8], [0, -2, 25.5]], [[5.8, 4.8, 3.8], [0, -1.5, 18.5]]], skin);
mirror_x() rock([4.2, 2.4, 3.0], [3.7, -6.2, 26.4], [0, 8, 12], skinHi, 8);
for (z = [21.8, 19.6, 17.6]) mirror_x() rock([1.7, 1.2, 1.1], [1.7, -5.6 + (21.8 - z) * 0.25, z], [0, 0, 0], skinHi, 10);
color(crease) translate([0, -6.6, 20]) scale([0.25, 0.6, 3.2]) sphere(1, $fn = 8);
vein([[0.3, -7.2, 27.5], [-0.4, -7.4, 25.5], [0.5, -7.2, 23.5]]);
vein([[-4.5, -6.8, 28.5], [-6.2, -6.2, 26.5], [-7.0, -5.0, 24.5]]);
vein([[-2.6, -7.4, 25.6], [-1.8, -7.6, 23.2]]);
vein([[4.0, -6.8, 24.5], [5.5, -6.2, 22.5]]);
// Hips.
ell([5.4, 4.4, 2.8], [0, -1, 15.6], skin);
// Back muscles and a magma crack down the spine.
mirror_x() ell([3.6, 2.4, 4.4], [3.2, 2.6, 24.5], skinDk);
vein([[0.2, 4.6, 28], [-0.3, 4.9, 24], [0.4, 4.4, 20], [-0.2, 3.4, 17]]);

// ---- Head: bald, hunched forward and turned to the viewer; brows, eyes, nose, gritted teeth, ears.
translate([0, -6.5, 33.6]) rotate([0, 0, 22]) {
  ell([5.2, 5.3, 5.4], [0, 0, 0], skin);
  ell([5.4, 4.4, 3.2], [0, -0.6, -2.4], skin);                      // heavy jaw
  mirror_x() ell([1.0, 1.3, 1.6], [5.1, 0.6, -0.6], skinDk);         // ears
  // Brows: thick ridges slanting down to the nose.
  mirror_x() color(skinDk) hull() {
    translate([3.6, -4.4, 1.2]) scale([1.2, 1.0, 0.8]) sphere(1, $fn = 10);
    translate([0.8, -5.0, 0.0]) scale([0.9, 0.9, 0.7]) sphere(1, $fn = 10);
  }
  mirror_x() color(crease) hull() {
    translate([3.4, -4.9, 0.9]) scale([0.9, 0.5, 0.35]) sphere(1, $fn = 8);
    translate([1.0, -5.3, -0.2]) scale([0.6, 0.5, 0.3]) sphere(1, $fn = 8);
  }
  // Eyes: small, dark, glaring under the brows.
  mirror_x() eye([2.2, -4.6, -0.6], 1.0, iris = [0.25, 0.15, 0.08], sclera = [0.92, 0.88, 0.78], pupil = [0.05, 0.03, 0.02], yaw = 10, flat = 0.5,
                 lid = 0.42, lid_tilt = 28, lid_c = skinDk, slit = 0.6);
  // Nose.
  ell([1.3, 1.3, 1.1], [0, -5.3, -1.6], skinHi);
  // Grimace: a dark mouth slot with two rows of gritted teeth, and the creased cheeks beside it.
  color(mouth) translate([0, -4.9, -3.6]) scale([3.3, 1.0, 1.0]) sphere(1, $fn = 16);
  color(teeth) translate([0, -5.55, -3.3]) scale([2.9, 0.45, 0.42]) sphere(1, $fn = 14);
  color(teeth) translate([0, -5.55, -4.0]) scale([2.7, 0.45, 0.38]) sphere(1, $fn = 14);
  for (x = [-2.0, -1.0, 0, 1.0, 2.0]) color(mouth) translate([x, -5.9, -3.65]) scale([0.12, 0.3, 0.5]) sphere(1, $fn = 6);
  mirror_x() color(crease) translate([3.6, -3.9, -3.2]) rotate([0, 0, -20]) scale([0.25, 0.6, 1.4]) sphere(1, $fn = 8);
}

// ---- Arms: raised guard. Elbow low beside the waist, a solid faceted boulder forearm rising to a boulder fist
// beside the head; big fitted plates half-sunk into the mass, knuckle plates on the fist's top, magma in the seams.
module arm(sx) {
  sh = [sx * 7.4, -1.2, 27.4];
  el = [sx * 12.4, -4.0, 20.8];
  mid = [sx * 14.0, -4.5, 26.0];
  fi = [sx * 16.2, -4.6, 33.0];
  ell([3.4, 3.2, 3.2], sh, skin);                                           // deltoid
  limb(sh, el, 3.3, 3.2, skin);                                             // upper arm
  ell([3.4, 3.0, 4.0], (sh + el) / 2 + [sx * 0.4, -1.4, 1.0], skin);       // bicep
  // Forearm block.
  color(slab) hull() {
    translate(el + [sx * 0.4, -0.4, 1.2]) rotate([0, sx * -10, 0]) scale([3.9, 3.5, 3.4]) sphere(1, $fn = 7);
    translate(mid) rotate([0, sx * -8, 0]) scale([4.5, 4.0, 3.8]) sphere(1, $fn = 7);
  }
  // Fist: a bigger boulder on top of the forearm.
  color(slab) hull() {
    translate(mid + [sx * 0.8, -0.2, 2.0]) scale([4.4, 4.0, 3.4]) sphere(1, $fn = 7);
    translate(fi) rotate([0, sx * 12, 0]) scale([5.2, 4.7, 4.8]) sphere(1, $fn = 8);
  }
  // Fitted plates: lit on the outer-top faces, dark in the creases.
  rock([3.0, 2.2, 3.4], mid + [sx * 3.4, -2.2, -0.4], [0, sx * 25, sx * 10], slabHi);
  rock([2.6, 2.4, 2.6], mid + [sx * -1.6, -3.2, -1.8], [0, 0, sx * 30], slabDk);
  rock([2.8, 2.0, 2.2], mid + [sx * 1.2, -3.6, 2.6], [0, sx * 15, 0], slabHi);
  rock([3.2, 2.6, 2.4], fi + [sx * 3.6, -1.6, -2.6], [0, sx * 35, 0], slabHi);
  rock([2.6, 2.4, 2.8], fi + [sx * -3.2, -3.2, -1.8], [0, 0, sx * -20], slabDk);
  // Knuckle plates across the top-front of the fist, a thumb at the inner side.
  for (k = [0 : 3]) rock([1.9, 1.7, 1.8], fi + [sx * (-3.3 + k * 2.1), -3.4 - abs(k - 1.5) * 0.25, 3.6 - abs(k - 1.5) * 0.35], [0, 0, 0], slabHi);
  rock([2.0, 2.6, 2.6], fi + [sx * -4.6, -2.2, -0.6], [0, 0, 0], slabHi);
  // Magma seams.
  vein([mid + [sx * 4.4, -1.4, -3.6], mid + [sx * 4.8, -1.0, 0.4], mid + [sx * 4.0, -2.0, 3.6], fi + [sx * 4.8, -1.6, -1.6]]);
  vein([mid + [sx * -2.0, -3.8, -3.8], mid + [sx * -1.0, -4.2, -0.4]]);
  vein([fi + [sx * -1.6, 3.2, 4.2], fi + [sx * 0.8, 4.0, 1.2], fi + [sx * 2.6, 3.6, -2.4]]);   // back of the fist
  vein([mid + [sx * 1.0, 3.6, 2.0], mid + [sx * 2.0, 3.8, -2.0], el + [sx * 1.0, 3.0, 0]]);  // back of the forearm
}
arm(-1);
arm(1);

// ---- Legs: a wide crouch, thighs out to the knees, shins down to flat bare feet with toes forward.
mirror_x() {
  limb([4.6, -1.2, 15.2], [12.8, -3, 10.4], 4.5, 3.6, skin);
  ell([3.4, 3.0, 3.0], [13.2, -3.6, 10.0], skinHi);                         // knee
  limb([12.8, -3, 10.4], [12.2, -3.4, 7.4], 3.3, 2.9, skin);
  blob([[[3.0, 3.0, 2.0], [12.2, -3.6, 7.0]], [[2.6, 2.2, 1.5], [11.6, -8.8, 6.4]]], skin);
  for (i = [0 : 3]) color(skinDk) translate([10.1 + i * 1.05, -10.5 + abs(i - 1.5) * 0.25, 5.9]) scale([0.55, 0.8, 0.6]) sphere(1, $fn = 8);
}
