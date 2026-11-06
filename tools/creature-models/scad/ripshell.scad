// Ripshell: a turtle brawler in a wide fighting stance, its huge gold shell slung on its back like a dish with a
// leather backpack strapped on top.
//
// Checklist (front sheet, x = sheet x, z = height; the build's 30 deg camera):
// - Head z 26..34 at sx -8..0, jutting forward and low over the chest: a teal skull, a blunt snout pointing forward
//   (sx -8, z 28..30), an olive-gold lower jaw (sx -6..-1, z 26..28), a grim downturned mouth line.
// - Face: one small glowing cyan eye seen (sx -3.4, z 29.8) in a dark socket under a heavy brow slanting down to the
//   snout; the far eye is hidden behind the snout (modelled anyway).
// - Horns: a rhino horn on the snout (base sx -7.3 z 29.6, tip sx -9.6 z 33.6, pale cyan-teal) and a pair of tall
//   ear horns on the skull (tips sx -7.6 / -2, z 36.8).
// - Torso teal-green; an olive-gold plastron of six plates (2 x 3, sx -6.4..1.3, z 17..25), lighter belly bands below.
// - Right arm (-X) raised: a huge blue-grey gauntlet fist at sx -17..-11, z 20..29, fingers facing the viewer.
//   Left arm (+X) low: the fist in front of the belly, sx 2.5..9.5, z 12..19. Steel-teal armour on shoulders,
//   forearms, thighs and shins; teal skin at the joints.
// - Legs: a wide lunge. +X leg bent under the body, foot out to sx 13 with three pale yellow claws; -X leg stretched
//   out sideways, foot at sx -14..-9 (raised on the art's rubble: here on the ground). Spikes on the outer calves.
// - Shell: a big hollow gold dish on the back, z 12.5..36, flaring out past the body on the +X side (sx 17 at z 16),
//   its brown underside seen inside the rim; the -X rim peeks out behind the head (sx -10, z 25..29).
// - Back: the shell's scutes (a vertebral ring, costal and marginal plates, dark seams), the backpack on its top
//   (bx -11..0, z 27..38.5) with a flap, buckles, a side pocket, a grey-blue knob on top and a rope hanging to +X.
include <lib.scad>

skin = [0.32, 0.58, 0.49];
skinLt = [0.40, 0.66, 0.56];
armour = [0.17, 0.34, 0.38];
armourDk = [0.08, 0.17, 0.21];
fistC = [0.18, 0.33, 0.38];
knuckle = [0.29, 0.49, 0.53];
plastron = [0.70, 0.61, 0.31];
plastronDk = [0.36, 0.33, 0.17];
horn = [0.38, 0.68, 0.62];
ink = [0.04, 0.09, 0.12];
eyeC = [0.25, 0.88, 0.95, GLOW];
eyeLt = [0.62, 0.96, 0.98, GLOW];
shell = [0.84, 0.62, 0.22];
shellDk = [0.52, 0.33, 0.12];
shellIn = [0.36, 0.22, 0.09];
leather = [0.47, 0.31, 0.18];
leatherDk = [0.30, 0.19, 0.10];
rope = [0.58, 0.40, 0.22];
buckle = [0.92, 0.74, 0.32, NOGLOW];
claw = [0.94, 0.78, 0.40, NOGLOW];
knob = [0.55, 0.66, 0.64];

// ---- Torso: pelvis, chest, shoulders.
module torso(g = 0) {
  hull() {
    translate([0, 0.8, 14.5]) scale([6.2 + g, 5.0 + g, 4.2 + g]) sphere(1, $fn = 28);
    translate([0, 0.2, 20.5]) scale([7.0 + g, 5.6 + g, 5.0 + g]) sphere(1, $fn = 28);
    translate([0, 0.6, 24.2]) scale([7.6 + g, 5.0 + g, 3.4 + g]) sphere(1, $fn = 28);
  }
}
color(skin) torso();
// Plastron: a dark groove layer, then six raised olive-gold plates (sheet outlines), only on the front.
module front() { translate([-50, -100, 0]) cube([100, 98, 100]); }
color(plastronDk) intersection() { torso(0.2); prism([[-6.7, 16.9], [1.1, 16.9], [1.6, 25.6], [-6.9, 25.6]]); front(); }
color(plastron) for (pl = [
  [[-6.3, 22.4], [-3.0, 22.4], [-3.0, 25.3], [-5.7, 25.3], [-6.5, 24.2]],
  [[-2.4, 22.4], [1.0, 22.4], [1.4, 24.2], [0.6, 25.3], [-2.4, 25.3]],
  [[-5.9, 19.9], [-3.0, 19.9], [-3.0, 22.0], [-6.2, 22.0]],
  [[-2.4, 19.9], [0.7, 19.9], [1.0, 22.0], [-2.4, 22.0]],
  [[-5.2, 17.2], [-3.0, 17.2], [-3.0, 19.5], [-5.7, 19.5]],
  [[-2.4, 17.2], [-0.3, 17.2], [0.4, 19.5], [-2.4, 19.5]]])
  intersection() { torso(0.45); prism(pl); front(); }
color(skinLt) for (pl = [[[-4.6, 15.1], [-0.6, 15.1], [-0.6, 16.6], [-4.4, 16.6]], [[-3.9, 13.6], [-1.4, 13.6], [-1.4, 14.7], [-3.9, 14.7]]])
  intersection() { torso(0.3); prism(pl); front(); }

// ---- Head, built about its own centre H (x = -1.2: the head sits a little to the creature's right, as drawn).
H = [-1.2, -6, 30.5];
// Eye sunk into the skull in a dark socket, squashed front-to-back, under a heavy skin brow slanting down to the snout.
module socket_eye(p, size, yaw, squash = 0.6) {
  translate(p) rotate([0, 0, yaw]) {
    color(ink) translate([0, size * 0.35, -size * 0.05]) scale([1.3, 0.6, 1.05]) sphere(size, $fn = 16);
    scale([1, squash, 1]) eye([0.01, 0, 0], size, iris = eyeLt, sclera = eyeC, pupil = eyeLt, lid = 0.42, lid_tilt = 28,
                              lid_c = skin, slit = 0.5);
    color(skin) hull() {
      translate([size * 1.1, size * 0.5, size * 1.05]) scale([0.6, 0.7, 0.45]) sphere(size, $fn = 12);
      translate([-size * 1.2, -size * 0.1, size * 0.4]) scale([0.55, 0.7, 0.4]) sphere(size, $fn = 12);
      translate([0, size * 1.2, size * 0.8]) scale([1.2, 0.7, 0.5]) sphere(size, $fn = 12);
    }
  }
}
translate(H) {
  // Skull and blunt snout.
  color(skin) hull() {
    translate([0, 0.4, 0.7]) scale([3.3, 3.3, 2.7]) sphere(1, $fn = 28);
    translate([0, -3.6, -1.2]) scale([2.2, 2.9, 1.9]) sphere(1, $fn = 24);
  }
  // Olive-gold lower jaw under the snout.
  ell([2.3, 3.0, 1.2], [0, -2.0, -2.9], plastron);
  mirror_x() {
    socket_eye([2.15, -3.3, -0.4], 1.0, 28);
    // Grim mouth line along the snout's lower edge, the corner turned down.
    chain([[1.2, -5.7, -1.9], [2.1, -3.4, -2.15], [2.6, -1.2, -2.6]], [0.22, 0.22, 0.2], ink);
    // Ear horns.
    spike([2.4, -0.2, 2.2], [0.8, -1.0, 4.3], 0.95, 0.12, horn);
  }
  // Rhino horn on the snout, curving up and forward.
  chain([[0, -5.0, 0.2], [-0.2, -7.2, 1.6], [-0.5, -9.5, 3.1]], [1.0, 0.7, 0.15], horn);
}
// Thick neck into the shoulders.
limb([-0.5, -1.5, 24.5], [-1.2, -5.2, 28.8], 3.0, 2.8, skin);

// Gauntlet fist: dark blue-grey with four curled finger rolls facing local -Y.
module fist(p, r, yaw = 0) {
  translate(p) rotate([0, 0, yaw]) {
    ell(r, [0, 0, 0], fistC);
    for (k = [-0.6, -0.2, 0.2, 0.6]) let(w = sqrt(1 - k * k))
      color(knuckle) translate([0, -r[1] * w + 0.45, k * r[2]]) scale([r[0] * 0.8 * w, 0.9, r[2] * 0.19]) sphere(1, $fn = 16);
  }
}

// A dark seam ring round a limb's armour at share t of the way from p1 to p2.
module band(p1, p2, t, r, w = 0.4) {
  color(armourDk) translate(p1 + (p2 - p1) * t) rotate(_dir_rot(p2 - p1)) cylinder(h = w, r = r, center = true, $fn = 22);
}

// ---- Right arm (-X): raised high, the fist beside the head.
ell([3.3, 3.4, 3.2], [-7.8, 0.5, 24.8], armour);
limb([-8, 0.5, 24.5], [-11.2, -0.5, 20.8], 2.4, 2.2, skin);
ell([2.4, 2.4, 2.4], [-11.2, -0.5, 20.8], armour);
limb([-11.2, -0.5, 20.8], [-14.0, -3.2, 23.6], 2.5, 2.8, armour);
fist([-14.8, -4.4, 24.6], [3.1, 3.0, 4.2], -15);
band([-11.2, -0.5, 20.8], [-14.0, -3.2, 23.6], 0.4, 2.75);

// ---- Left arm (+X): low guard, the fist in front of the belly.
ell([3.3, 3.4, 3.2], [7.8, 0.5, 24], armour);
limb([8, 0.5, 23.5], [11.2, 1.5, 17.5], 2.4, 2.3, skin);
ell([2.4, 2.4, 2.4], [11.2, 1.5, 17.5], armour);
limb([11.2, 1.5, 17.5], [10.4, -5.4, 15.6], 2.5, 2.7, armour);
fist([10, -7.4, 15.3], [2.9, 3.0, 3.4], 20);
band([11.2, 1.5, 17.5], [10.4, -5.4, 15.6], 0.4, 2.7);

// ---- Legs: a wide lunge.
module calfSpikes(pts, d) for (p = pts) spike(p, d, 0.65, 0.06, skin);
// +X leg: bent under the body, toes turned out.
ell([3.4, 3.4, 3.4], [4.5, 1, 12.5], skin);
limb([4.5, 1, 12.5], [8.4, -2.5, 7.5], 4.0, 3.3, armour);
ell([2.8, 2.6, 2.8], [8.4, -2.8, 7.5], skinLt);
limb([8.4, -2.5, 7.5], [10.0, -1.0, 2.6], 3.1, 2.5, armour);
band([4.5, 1, 12.5], [8.4, -2.5, 7.5], 0.55, 3.75);
band([8.4, -2.5, 7.5], [10.0, -1.0, 2.6], 0.45, 2.95);
translate([10.2, -1.2, 0]) rotate([0, 0, 45]) {
  blob([[[2.6, 3.8, 1.5], [0, -2.2, 1.5]], [[2.4, 2.2, 1.6], [0, 0.8, 1.6]]], skin);
  for (a = [-30, 0, 30]) spike([sin(a) * 1.7, -5.5, 1.0], [sin(a) * 0.4, -1.5, -0.7], 0.55, 0.05, claw);
}
calfSpikes([[10.9, -0.4, 10.2], [11.4, -0.6, 8.0], [11.8, -0.4, 5.8]], [1.4, 1.3, 0.5]);
// -X leg: stretched out sideways, toes pointing forward and a little out.
ell([3.4, 3.4, 3.4], [-4.5, 1, 12.5], skin);
limb([-4.5, 1, 12.5], [-11.5, 0.5, 10.5], 4.0, 3.3, armour);
ell([2.8, 2.6, 2.8], [-11.5, 0.2, 10.5], skinLt);
limb([-11.5, 0.5, 10.5], [-13.5, 0.5, 2.6], 3.1, 2.5, armour);
band([-4.5, 1, 12.5], [-11.5, 0.5, 10.5], 0.55, 3.75);
band([-11.5, 0.5, 10.5], [-13.5, 0.5, 2.6], 0.45, 2.95);
translate([-13.7, 0.3, 0]) rotate([0, 0, -20]) {
  blob([[[2.6, 3.8, 1.5], [0, -2.2, 1.5]], [[2.4, 2.2, 1.6], [0, 0.8, 1.6]]], skin);
  for (a = [-30, 0, 30]) spike([sin(a) * 1.7, -5.5, 1.0], [sin(a) * 0.4, -1.5, -0.7], 0.55, 0.05, claw);
}
calfSpikes([[-14.3, 2.6, 9.6], [-15.7, 2.4, 7.2], [-15.9, 2.2, 4.8]], [-1.2, 1.6, 0.5]);

// ---- Shell: a hollow gold dish on the back (its axis +Y), tipped so the +X side hangs lower.
SC = [2.5, 6, 22.5];
SR = [16, 8.5, 13.5];
module dome(g = 0) scale([SR[0] + g, SR[1] + g, SR[2] + g]) sphere(1, $fn = 40);
translate(SC) rotate([0, 30, 0]) rotate([38, 0, 0]) {
  difference() {
    color(shell) dome();
    color(shellIn) dome(-1.0);
    color(shellDk) translate([0, -50, 0]) cube(100, center = true);
  }
  // Scute seams painted on the dome: two rings and radial seams between them and the rim.
  color(shellDk) intersection() {
    difference() { dome(0.15); dome(-0.4); }
    union() {
      for (yy = [0.36, 0.78]) translate([0, SR[1] * yy, 0]) cube([40, 0.32, 40], center = true);
      for (a = [0 : 30 : 359]) rotate([0, a, 0]) intersection() {
        translate([0, SR[1] * 0.18, 10]) cube([0.32, SR[1] * 0.36, 20], center = true);
      }
      for (a = [22.5 : 45 : 359]) rotate([0, a, 0])
        translate([0, SR[1] * 0.57, 10]) cube([0.32, SR[1] * 0.42, 20], center = true);
    }
  }
}

// ---- Backpack on the shell's top, its back face towards +Y.
module rbox(s, p, r = 1) translate(p) hull() for (i = [-1, 1], j = [-1, 1], k = [-1, 1])
  translate([i * (s[0] / 2 - r), j * (s[1] / 2 - r), k * (s[2] / 2 - r)]) sphere(r, $fn = 12);
color(leather) rbox([9, 4.8, 8.4], [0, 9.6, 33.8], 2.2);
color(leatherDk) rbox([9.4, 4.4, 3.4], [0, 10.0, 37.0], 1.6);            // top flap
color(leather) rbox([5.4, 1.6, 4.0], [0, 12.1, 33.0], 0.7);              // back pocket
color(leatherDk) rbox([2.0, 4.2, 4.6], [5.0, 9.5, 33.6], 0.8);           // side pocket
color(leatherDk) for (x = [-2.2, 2.2]) rbox([1.0, 0.6, 6.4], [x, 12.2, 35.0], 0.25);
color(buckle) for (x = [-2.2, 2.2]) rbox([1.4, 0.6, 1.1], [x, 12.5, 35.6], 0.2);
color(leather) translate([-0.4, 9.5, 38.5]) cylinder(h = 0.8, r = 1.3, $fn = 16);
ell([1.2, 1.2, 0.9], [-0.4, 9.5, 39.4], knob);
// Rope from the pack's top corner, hanging down on the +X side.
chain([[4.0, 9.5, 37.2], [6.6, 9.2, 36.0], [9.0, 8.6, 33.8], [10.6, 8.2, 31.6], [11.2, 7.8, 29.8]],
      [0.5, 0.5, 0.48, 0.45, 0.6], rope);
