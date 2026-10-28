// Pebfist: a squat, bald, clay-brown little boxer in a wide fighting crouch, two big slate-grey gloves up, scowling.
include <lib.scad>

skin = [0.66, 0.5, 0.33];
skinHi = [0.76, 0.6, 0.41];
skinDk = [0.5, 0.36, 0.23];
glove = [0.42, 0.5, 0.55];
gloveHi = [0.56, 0.64, 0.69];
gloveDk = [0.3, 0.36, 0.4];
dirt = [0.45, 0.36, 0.25];
eyeC = [0.42, 0.24, 0.08];

// Torso: broad shoulders tapering to the waist.
blob([[[9, 6, 5], [0, 0.5, 21]], [[6.5, 5, 4], [0, 0, 14]]], skin);
// Pecs and abs.
mirror_x() ell([3.8, 1.8, 2.6], [3, -4.6, 21], skinHi);
for (z = [13.5, 16.3]) mirror_x() ell([1.6, 1, 1.2], [1.7, -4.3, z], skinHi);
// Hips.
blob([[[6.6, 5, 3.2], [0, 0.5, 11.5]]], skin);
// Back muscles and glutes.
mirror_x() ell([4, 2, 4.5], [3.4, 4.6, 20.5], skinHi);
mirror_x() ell([3, 2.2, 2.6], [2.6, 4.4, 11], skinHi);

// Head: big and round, sitting low on the shoulders; scowling face.
ell([7.6, 7.2, 8], [0, -1.5, 31], skin);
mirror_x() ell([1.3, 1.6, 2], [7.4, -0.5, 30.5], skinDk);  // ears
// Heavy frowning brows over deep-set eyes.
mirror_x() {
  color(skinDk) translate([2.9, -7.3, 31.1]) scale([2.1, 0.8, 1.8]) sphere(1, $fn = 16);  // eye socket
  eye([2.9, -7.6, 31], 1.65, iris = [0.62, 0.36, 0.1], sclera = [0.96, 0.9, 0.78], pupil = [0.08, 0.04, 0.02], yaw = 8,
      flat = 0.5, lid = 0.42, lid_tilt = 30, lid_c = skinDk, slit = 0.6);
  // Brow ridge overhanging the eye, slanting down to the nose.
  color(skin) hull() {
    translate([5, -6.6, 33.5]) scale([1.6, 1.3, 0.95]) sphere(1, $fn = 12);
    translate([1.1, -8.4, 32.6]) scale([1.1, 1, 0.75]) sphere(1, $fn = 10);
  }
}
ell([1.1, 1.3, 1.5], [0, -9, 29.4], skinHi);  // nose
color([0.3, 0.17, 0.08]) translate([0, -8.3, 26.7]) scale([1.8, 0.6, 0.4]) sphere(1, $fn = 14);  // frown
mirror_x() color([0.3, 0.17, 0.08]) translate([1.6, -8.1, 26.4]) scale([0.5, 0.5, 0.35]) sphere(1, $fn = 8);

// Arms in a guard: the viewer's left glove high beside the face, the right one forward at chest height.
module glove_at(p, s = 4.5) {
  ell([s, s * 1.05, s * 0.95], p, glove);
  ell([s * 0.55, s * 0.5, s * 0.45], p + [s * 0.1, -s * 0.55, s * 0.4], gloveHi);
  ell([s * 0.45, s * 0.6, s * 0.5], p + [s * 0.75, -s * 0.2, -s * 0.15], gloveDk);  // thumb
  color(gloveDk) translate(p + [0, s * 0.35, -s * 0.55]) cylinder(h = s * 0.6, r = s * 0.62, center = true, $fn = 20);  // cuff
}
chain([[-8, 0, 23], [-12, -1, 17], [-12, -4, 24]], [3.3, 2.9, 2.5], skin);
ell([3.6, 3.4, 3], [-9, 0, 23.5], skinHi);  // shoulder
ell([2.6, 2.6, 2.8], [-12.3, -0.8, 18.5], skinHi);  // bicep bulge
glove_at([-11.5, -6.5, 28], 5);
chain([[8, 0, 23], [11.5, -1, 16.5], [5.5, -6, 18]], [3.3, 2.9, 2.5], skin);
ell([3.6, 3.4, 3], [9, 0, 23.5], skinHi);
ell([2.6, 2.6, 2.8], [11.6, -0.6, 18.5], skinHi);
glove_at([2.5, -10.5, 19], 5.5);

// Legs: a wide crouch, knees bent outward, bare feet with toes.
mirror_x() {
  chain([[4, 0.5, 10.5], [9.5, -1.5, 6], [10.5, 0, 1.6]], [3.8, 3, 2.3], skin);
  ell([2.8, 2.6, 2.6], [8.6, -1.8, 7.5], skinHi);  // thigh
  blob([[[2.6, 4, 1.3], [11, -2, 1.3]], [[2.2, 2, 1.3], [10.5, 1, 1.5]]], skin);
  for (i = [0 : 3]) color(skinDk) translate([9.6 + i * 1, -5.8, 0.7]) scale([0.75, 0.9, 0.65]) sphere(1, $fn = 10);
}

// Dust kicked up around the feet.
for (d = [[-15, -2, 3], [15, -1, 3], [-14, 4, 2.5], [14, 5, 2.5], [-8, -7, 2], [8, -6, 2], [0, 6, 2.5]])
  ell([d[2], d[2], d[2] * 0.3], [d[0], d[1], d[2] * 0.25], dirt);
for (d = [[-16.5, -1, 3.5], [16, 2, 4], [-15, 6, 2.5]]) color(dirt) translate(d) sphere(0.8, $fn = 8);
