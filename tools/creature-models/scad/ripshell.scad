// Ripshell: a hulking teal turtle brawler, armoured limbs and huge fists, a broad gold shell on its back with a
// brown backpack strapped on top, two horns on its head.
include <lib.scad>

teal = [0.18, 0.55, 0.5];
tealDk = [0.1, 0.36, 0.36];
armour = [0.22, 0.42, 0.5];
plastron = [0.72, 0.62, 0.22];
gold = [0.85, 0.65, 0.18];
goldDk = [0.62, 0.43, 0.1];
leather = [0.45, 0.28, 0.14];
leatherDk = [0.3, 0.18, 0.09];
claw = [0.95, 0.8, 0.3];
eyeGlow = [0.4, 0.95, 0.95];

// Torso.
blob([[[7.5, 6, 6], [0, 0, 16]], [[8.5, 6.5, 6], [0, 0, 22]]], teal);
// Plastron with plate grooves.
color(plastron) translate([0, -5.2, 19]) scale([5, 2, 6.5]) sphere(1, $fn = 24);
color(goldDk) for (z = [16.5, 19.5, 22.5]) translate([0, -6.9, z]) cube([7, 0.4, 0.3], center = true);
color(goldDk) translate([0, -7, 19]) cube([0.3, 0.4, 9], center = true);

// Shell: wide dome on the back, rim flaring past the body.
translate([0, 5, 19]) rotate([-80, 0, 0]) {
  color(gold) scale([13, 14, 9]) difference() { sphere(1, $fn = 40); translate([0, 0, -1.2]) cube(2.4, center = true); }
  color(goldDk) scale([13.8, 14.8, 1.2]) sphere(1, $fn = 40);
  // Scute grooves: two rings and radial seams, laid on the dome surface.
  color(goldDk) for (k = [[0.55, 0.83], [0.85, 0.5]]) scale([13 * k[0], 14 * k[0], 1]) translate([0, 0, 9 * k[1]])
    rotate_extrude($fn = 40) translate([1, 0]) circle(r = 0.06, $fn = 6);
  color(goldDk) for (a = [0 : 45 : 359]) for (t = [0.2 : 0.1 : 0.9]) let(el = acos(t))
    translate([13 * t * cos(a), 14 * t * sin(a), 9 * sin(el) + 0.05]) sphere(0.45, $fn = 8);
}
// Backpack on top of the shell.
translate([0, 9, 29]) {
  color(leather) translate([0, 0, 0]) cube([7, 4.5, 6], center = true);
  color(leather) translate([0, 0, 3]) scale([3.5, 2.25, 1.4]) sphere(1, $fn = 20);
  color(leatherDk) translate([0, 2.4, -0.5]) cube([5, 1.4, 3.5], center = true);
  color(leatherDk) translate([0, -0.5, 2.6]) cube([7.4, 5, 0.6], center = true);
  chain([[3.5, -1, 2], [5.5, 1, 0], [6.5, 3, -2]], [0.4, 0.35, 0.3], leatherDk);
}

// Head: low and jutting forward.
blob([[[4.5, 4.5, 4], [0, -3, 29]], [[3.5, 3.5, 3], [0, -6.5, 28]]], teal);
ell([3, 2, 1.5], [0, -8, 26.6], plastron);
mirror_x() {
  eye([2.2, -7.4, 29.8], 1.4, iris = eyeGlow, pupil = [0.05, 0.25, 0.3], sclera = eyeGlow, yaw = -20);
  color(tealDk) translate([2.4, -7.6, 30.9]) rotate([0, -20, -20]) scale([1.6, 0.6, 0.45]) sphere(1, $fn = 12);
  spike([2.8, -2, 32], [1.8, 0.5, 5], 1.2, 0.1, tealDk);
}
spike([0, -7.5, 30], [0, -1.5, 2.5], 0.8, 0.1, tealDk);

// Arms: armoured upper arms and big fists held up in a guard.
mirror_x() {
  ell([3.4, 3.4, 3.4], [9, -1, 24], armour);
  limb([9.5, -1, 23], [11.5, -4, 17], 2.6, 2.4, teal);
  ell([3, 3.2, 3], [11.5, -4.5, 16.5], armour);
  limb([11.5, -4.5, 16.5], [11, -7, 22], 2.4, 2.4, teal);
  blob([[[3.4, 3.2, 3.6], [11, -8, 24]], [[2.6, 2.6, 2.8], [11, -9, 26]]], armour);
  color(tealDk) for (z = [24, 25.6, 27.2]) translate([11, -11.1, z]) scale([2.6, 0.5, 0.5]) sphere(1, $fn = 10);
}

// Legs: wide stance, armoured thighs, clawed feet.
mirror_x() {
  ell([3.6, 3.8, 4], [5.5, 0, 11], armour);
  limb([5.5, 0, 11], [8, -1, 5], 3.2, 2.6, teal);
  ell([3, 3, 2.4], [8, -1, 5], armour);
  blob([[[3, 4.2, 1.6], [8.5, -2.5, 1.6]], [[2.6, 2.4, 1.6], [8.5, 0.5, 1.6]]], teal);
  for (a = [-28, 0, 28]) spike([8.5 + sin(a) * 1.6, -6.2, 1.0], [sin(a) * 0.5, -1.3, -0.4], 0.5, 0.05, claw);
  spike([10.5, 0, 8], [1.6, 0, 0.8], 0.6, 0.05, tealDk);
}
