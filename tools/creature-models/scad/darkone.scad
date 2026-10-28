// Darkone: a floating shadow wraith, a white red-veined ruff round its throat, a blue flame plume over one red
// eye, flames on its shoulders and in its claws, a ragged black skirt trailing into blue fire.
include <lib.scad>

shade = [0.17, 0.16, 0.18];
shadeHi = [0.27, 0.26, 0.29];
ruff = [0.93, 0.93, 0.95];
vein = [0.6, 0.08, 0.1];
redBand = [0.7, 0.1, 0.1];
flameDk = [0.15, 0.42, 0.88];
flame = [0.3, 0.68, 0.98];
flameHi = [0.5, 0.85, 1];
eyeRed = [1, 0.12, 0.08, GLOW];

module tongue(p, d, r, c) {
  color(c) hull() {
    translate(p) sphere(r);
    translate(p + d) sphere(0.2);
  }
}
module fire(p, s = 1) {
  tongue(p, [0, 0, 5] * s, 2 * s, flameDk);
  tongue(p + [0.5, -0.5, 0] * s, [1.5, 0, 3.5] * s, 1.4 * s, flame);
  tongue(p + [-0.5, -0.8, 0] * s, [-1, -0.3, 3] * s, 1.2 * s, flame);
  ell([0.9, 0.9, 1.2] * s, p + [0, -1.2, 0.6] * s, flameHi);
}

// Blue fire wisps below the body (it floats).
tongue([0, 0, 7], [0, 0, -7], 5, flameDk);
tongue([2, -1, 6.5], [1.5, -1, -5.5], 3, flame);
tongue([-2, -1.5, 6.5], [-1.5, -0.5, -5], 2.6, flame);
ell([2, 1.5, 2], [0, -3.5, 4.5], flameHi);

// Ragged skirt.
blob([[[5, 4.4, 4], [0, 0, 18]], [[7.5, 6.5, 2.5], [0, 0, 11]]], shade);
for (a = [0 : 30 : 359]) spike([7 * sin(a), -6 * cos(a), 11], [2.4 * sin(a), -2 * cos(a), -4 - (a / 30 % 2) * 2], 1.6, 0.15, shade);

// Torso.
blob([[[6, 4.4, 4], [0, 0, 22.5]], [[4, 3.5, 3], [0, 0, 18]]], shade);
// Ragged tatters hanging off the torso under the ruff, a second torn layer over the skirt.
for (a = [-165 : 30 : 165]) let(k = abs(a) % 60 == 15) color(k ? shadeHi : shade) hull() {
  translate([4.8 * sin(a), -3.4 * cos(a), 20.5]) rotate([0, 0, -a]) scale([1.6, 0.35, 1]) sphere(1, $fn = 8);
  translate([6 * sin(a), -4.4 * cos(a), 15 - (k ? 1.5 : 0)]) sphere(0.12, $fn = 4);
}

// Head: dark, round, nested in the ruff.
blob([[[4.2, 3.8, 4.2], [0, -1.2, 28]], [[2.6, 2.6, 2.4], [0, 1.6, 32]]], shade);
// Ruff: the coat collar's thick white lining framing the face (facing forward, sagging low), red veins radiating on it.
ruffC = [0, -1.6, 27.4];
// A crescent cradling the head from below (the turned-up collar), not a ring: the top of the head stays free.
color(ruff) translate(ruffC) rotate([78, 0, 0]) scale([1.05, 1.1, 1]) rotate([0, 0, 165]) rotate_extrude(angle = 210, $fn = 36)
  translate([5.4, 0]) scale([1, 1.4]) circle(2.2, $fn = 16);
// Rounded collar points where the crescent ends beside the cheeks.
for (a = [165, 375]) color(ruff) translate(ruffC + [5.4 * cos(a) * 1.05, 0, 5.4 * sin(a) * 1.08]) scale([1, 1.2, 1.2]) sphere(2.2, $fn = 14);
for (a = [195 : 18 : 345]) color(vein) translate(ruffC + [5.6 * cos(a) * 1.05, -3.2 + 1.1 * sin(a), 5.6 * sin(a) * 1.08]) rotate([0, -a + 90, 0]) cube([0.4, 0.4, 2.8], center = true);
// High coat collar: a dark shell rising from the shoulders round the back and sides of the head and flaring out at
// the top, open at the front where the white ruff lines it; its top rim is trimmed red (the sprite's back view).
// A rounded shell (outer and inner ellipsoids), open at the front behind the ruff and at the top round the head.
module collar() difference() {
  translate([0, 1.6, 27]) scale([8.5, 6.2, 9]) sphere(1, $fn = 32);
  translate([0, 0.8, 27.6]) scale([7.6, 5.2, 8.4]) sphere(1, $fn = 32);
  translate([0, -2, 0]) rotate([-10, 0, 0]) translate([-20, -30, 0]) cube([40, 30, 60]);
  translate([-20, -20, 35.2]) cube([40, 40, 20]);
  translate([-20, -20, 0]) cube([40, 40, 20]);
}
color(shade) difference() { collar(); translate([-20, -20, 34]) cube([40, 40, 2]); }
// Red trim round the rim.
color(redBand) intersection() { collar(); translate([-20, -20, 34]) cube([40, 40, 1.2]); }
// Coat body: flowing down from the collar over the back and into the ragged skirt.
blob([[[6.4, 4.4, 2], [0, 1.6, 21]], [[7.2, 5.6, 2.5], [0, 1.2, 14]]], shade);

// Visible red eye on the viewer's left; the other is under the plume.
// Big and glowing, sunk into the dark head under a hard brow that slants down to the middle of the face.
eye([-1.7, -4.55, 28.5], 1.6, iris = [1, 0.6, 0.3, GLOW], pupil = [0.1, 0, 0], sclera = eyeRed, yaw = 10, lid = 0.45,
    lid_tilt = 30, lid_c = shade, slit = 0.3);
color(shade) hull() {
  translate([-3.5, -3.6, 30.4]) scale([1, 1, 0.55]) sphere(1, $fn = 10);
  translate([-0.3, -5.1, 29.8]) scale([0.7, 0.8, 0.45]) sphere(1, $fn = 8);
}
// Flame plume: from the crown, down over the viewer's right eye, and a tall tongue up.
chain([[1.2, -4.4, 27.5], [1.6, -4.2, 30.5], [0.6, -1.4, 33.5], [-1, 0, 37.5], [0.5, 1.5, 41.5], [2.5, 2, 44]], [1.8, 2.4, 2.8, 2.2, 1.4, 0.3], flameDk);
chain([[1.4, -5.2, 28], [1.6, -5, 31], [0.8, -2.6, 34], [-0.4, -1.2, 37.5]], [1.3, 1.7, 1.8, 0.6], flame);
chain([[1.6, -6, 29.5], [1.4, -5.6, 32.5], [0.6, -3.4, 34.5]], [0.8, 0.9, 0.4], flameHi);

// Shoulders: rounded pads with blue flames above.
mirror_x() {
  ell([3.6, 3.2, 3.2], [7, 0.5, 24.5], shade);
  fire([8.4, 1.5, 26.5], 0.9);
}
// Long thin arms reaching down, clawed hands cupping blue flames.
mirror_x() {
  chain([[7.5, -0.5, 22.5], [11, -1.5, 18], [13, -3, 13]], [1.6, 1.2, 1], shade);
  ell([1.6, 1.4, 1.4], [13.3, -3.4, 12], shade);
  for (t = [-40, 0, 40]) chain([[13.3 + sin(t) * 1.1, -4.4, 12], [13.6 + sin(t) * 1.8, -5.4, 10.6], [13.6 + sin(t) * 1.6, -5, 9.4]], [0.45, 0.32, 0.1], shadeHi);
  ell([1.2, 1.2, 1.6], [13.5, -5, 9], flame);
  ell([0.6, 0.6, 0.8], [13.5, -5.6, 9], flameHi);
}
