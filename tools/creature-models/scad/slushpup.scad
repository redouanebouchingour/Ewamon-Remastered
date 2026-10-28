// Slushpup: a round, fluffy seal pup in frosty white-grey fur, ice-crystal ears, a crystal tail tuft, puffing frost.
include <lib.scad>

fur = [0.86, 0.89, 0.93];
furShade = [0.72, 0.77, 0.84];
muzzle = [0.94, 0.95, 0.97];
ice = [0.68, 0.84, 0.97];
iceHi = [0.88, 0.95, 1.0];
pad = [0.55, 0.7, 0.88];
dark = [0.12, 0.13, 0.16];
puff = [0.9, 0.94, 0.98];

// Round body: a big squashed ball, slightly wider at the rump.
blob([[[11, 11, 9], [0, 3, 9.5]], [[9, 8, 8], [0, -4, 10]]], fur);
ell([7, 6, 5], [0, -8, 6.5], muzzle);

// Fluffy fur ruff behind the head.
blob([[[8.6, 4, 7], [0, -5.5, 13.5]]], fur);

// Head, low at the front of the ball.
blob([[[7.2, 6.4, 6.4], [0, -9.5, 13]], [[4.6, 4, 3.6], [0, -13.5, 11]]], fur);
// Muzzle and nose, little smile.
ell([3.4, 2.6, 2.4], [0, -15, 11.2], muzzle);
mirror_x() ell([1.8, 1.4, 1.6], [1.4, -15.6, 10.6], muzzle);
ell([1.1, 0.8, 0.8], [0, -17.4, 12.3], dark);
color(dark) translate([0, -17.1, 10.2]) rotate([90, 0, 0]) scale([1.6, 0.4, 0.3]) cylinder(h = 0.4, r = 1, center = true, $fn = 14);
// Big glossy black eyes.
mirror_x() eye([3.6, -14.1, 14.2], 1.6, iris = dark, pupil = dark, sclera = dark, yaw = 30, flat = 0.6);
// Brows and whisker dots.
mirror_x() for (p = [[2.4, -16.3, 11.8], [3, -16, 11]]) ell([0.2, 0.2, 0.2], p, furShade);

// Ice-crystal ears: flat shards, pale and translucent-looking.
mirror_x() {
  petal([1.7, 0.45, 3.6], [5, -8, 19.2], [6, 28, 15], ice);
  petal([1, 0.4, 2.4], [5.1, -8.4, 19.4], [6, 28, 15], iceHi);
}

// Front flippers tucked under the chest, back feet with blue pads.
mirror_x() {
  blob([[[2.6, 3.6, 1.6], [6.5, -9.5, 2.2]], [[2.2, 2.2, 2.4], [6.5, -6, 4]]], fur);
  for (a = [-1, 0, 1]) ell([0.5, 0.35, 0.6], [6.5 + a * 1.1, -12.9, 2.6], furShade);
  blob([[[2.8, 2.4, 3.4], [8.5, 9, 3.6]]], fur);
  ell([1.9, 0.4, 2.2], [8.6, 11.2, 3.8], pad);
  for (a = [-1, 0, 1]) ell([0.55, 0.3, 0.55], [8.6 + a * 1.2, 11.4, 6.2 - abs(a) * 0.5], pad);
}

// Crystal tail tuft at the back.
for (i = [0 : 6]) let(a = -60 + i * 20) spike([0, 13, 7], [sin(a) * 2.4, 4 + cos(a) * 1.2, cos(a) * 3.2 - 0.6], 0.8, 0.05, i % 2 == 0 ? ice : iceHi);
// Crystal patch on the flank.
mirror_x() for (i = [0 : 3]) spike([9.8, 5 + i * 1.2, 9], [1.4, 0.6, 3.2 - i * 0.3], 0.6, 0.05, ice);

// A puff of frost breath from the mouth.
for (p = [[-1.5, -22, 9], [-3.5, -23.5, 9.8], [-2, -25, 8], [-4.5, -25.5, 8.6], [-3, -27, 9.8], [-5, -26.5, 10.6]]) ell([1.4, 1.4, 1.3], p, puff);
