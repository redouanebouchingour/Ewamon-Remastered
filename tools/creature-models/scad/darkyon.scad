// Darkyon: Darkone grown into a tall shadow sorcerer: a long ragged black gown with a teal front, a teal ruff with
// horned shoulders, a crown of blue fire over a hooded head with one red eye, a fireball in one claw and a ring of
// blue flame round its hem.
include <lib.scad>

shade = [0.17, 0.17, 0.2];
shadeHi = [0.28, 0.29, 0.33];
teal = [0.18, 0.55, 0.6];
tealHi = [0.3, 0.7, 0.72];
flameDk = [0.1, 0.25, 0.85];
flame = [0.2, 0.5, 0.97];
flameHi = [0.45, 0.85, 1];
eyeRed = [0.9, 0.12, 0.1];

module tongue(p, d, r, c) {
  color(c) hull() {
    translate(p) sphere(r);
    translate(p + d) sphere(0.2);
  }
}
// A wavy flame: a fat base that flickers sideways into a fine tip, with a brighter inner tongue. lean = sideways.
module fire(p, s = 1, lean = 1) {
  chain([p, p + [0.8 * lean, 0, 2.6] * s, p + [-0.6 * lean, 0, 4.6] * s, p + [1 * lean, 0, 6.8] * s], [2.2, 1.7, 1, 0.2] * s, flame);
  chain([p + [0, -1, 0] * s, p + [0.6 * lean, -1.2, 2] * s, p + [-0.3 * lean, -1, 3.6] * s], [1.4, 1, 0.2] * s, flameHi);
}

// Ring of blue fire round the hem.
for (a = [0 : 40 : 359]) fire([9.4 * sin(a), 0.5 - 8.4 * cos(a), 1.6], 0.85 + 0.3 * ((a / 40) % 2), (a / 40) % 2 == 0 ? 1 : -1);
blob([[[9.5, 8.5, 1.4], [0, 0.5, 1.4]]], flameDk);

// Long ragged gown: a cone to the floor, a teal front panel, torn hem points.
blob([[[4.5, 3.6, 3], [0, 0, 24]], [[9, 7.5, 2], [0, 0.5, 4]]], shade);
color(teal) hull() {
  translate([0, -3.4, 19]) scale([1, 0.6, 1]) sphere(1.2);
  translate([0, -7.4, 3]) scale([3.6, 0.8, 1]) sphere(1.2);
}
for (a = [0 : 24 : 359]) spike([8.4 * sin(a), 0.5 - 7 * cos(a), 4.5], [2 * sin(a), -1.7 * cos(a), -4 + (a / 24 % 2) * 1.2], 1.8, 0.15, shade);
// Folds.
for (a = [-150 : 40 : 150]) if (abs(a) > 30) color(shadeHi) hull() {
  translate([3.8 * sin(a), 0.2 - 3.2 * cos(a), 21]) sphere(0.5);
  translate([8.6 * sin(a), 0.5 - 7.2 * cos(a), 4]) sphere(0.8);
}

// Chest and teal ruff.
blob([[[5.4, 4, 3.4], [0, 0, 25.5]], [[3.6, 3, 2.5], [0, 0, 21.5]]], shade);
blob([[[5.2, 4.4, 1.8], [0, -0.3, 28]]], teal);
for (a = [-150 : 25 : 150]) spike([4.6 * sin(a), -0.3 - 4 * cos(a), 28], [1.8 * sin(a), -1.6 * cos(a), -2.4], 1.6, 0.1, (a / 25) % 2 == 0 ? teal : tealHi);
// Horned shoulders.
mirror_x() {
  ell([3, 2.8, 2.6], [6, 0.5, 26], shade);
  spike([7, 0.5, 27.5], [3.5, 0.5, 5], 1.6, 0.15, shade);
}

// Head: a dark hood with a blue fire crest sweeping over the viewer's right eye.
blob([[[3.8, 3.6, 4], [0, -0.5, 31]], [[2.4, 2.4, 2], [0, 1.4, 34]]], shade);
eye([-1.5, -3.7, 31], 1.3, iris = eyeRed, pupil = [0.2, 0, 0], sclera = [0.85, 0.82, 0.86], yaw = 12);
// Hood of blue flame: a big swoop over the head and right eye.
blob([[[3.8, 3.4, 2.6], [0.6, -0.5, 35]], [[2.2, 1.8, 2.2], [1.6, -3.4, 32]]], flame);
ell([2.2, 1.6, 1.4], [0.4, -2.6, 36], flameHi);
// Crown of fire around the head.
fire([-1.5, 0.5, 36], 1.3, -1);
fire([2.5, 0.8, 35.5], 1.4, 1);
fire([-5, 1, 33], 0.9, -1);
fire([5.5, 1.5, 32], 0.8, 1);

// Arms: long and thin with spiked forearms and big claws.
mirror_x() {
  chain([[6.5, 0, 24.5], [9.5, -1, 19], [11.5, -2.5, 15]], [1.5, 1.2, 1], shade);
  for (i = [0 : 2]) spike([10 + i * 0.6, -0.6, 19 - i * 1.6], [1.6, 1.2, 0.8], 0.6, 0.05, teal);
  ell([1.5, 1.3, 1.3], [11.8, -3, 14], shade);
  for (t = [-40, 0, 40]) chain([[11.8 + sin(t) * 1.1, -4, 14], [12.2 + sin(t) * 1.8, -5, 12.6], [12.2 + sin(t) * 1.6, -4.6, 11.2]], [0.45, 0.32, 0.1], shadeHi);
}
// Fireball in the viewer's left claw.
ell([2.6, 2.6, 2.6], [-12.2, -5, 12.5], flame);
ell([1.5, 1.5, 1.5], [-12.2, -6.8, 12.8], flameHi);
fire([-12.2, -5, 13.5], 0.7, -1);
