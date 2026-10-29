// Elemutt, rebuilt from the measurement sheet (front height 40, feet z = 0, x centred).
//
// Checklist (sheet x, z):
// - Body plan: a chubby cream puppy standing with its legs splayed, both arms flung wide, head turned to the camera.
// - Head: a big round cream ball x -8.2..7.6, z 18.7..33.6; the face is three-quarter (eyes at sheet -5.9 and 1.9,
//   face centre -2 while the head's centre is -0.3), so the head is turned about 14 degrees towards the camera.
// - Ears: floppy, flaring out either side: viewer's left (-X) x -11..-7 z 26..31.5 with its brown inside showing,
//   viewer's right (+X) x 7..10.3 z 25..32, cream.
// - Top-knot bun: dark grey ball x -2..7 z 32.6..40 (off centre to +X), lighter swirl on top, brown hair band at its
//   base x -5..4.5 z 32.6..35.
// - Arrow marking: grey (M2) Aang arrow on the brow: shaft x -1.5..0.7 z 30..34, head x -5.3..1.1 at z 29.5 down to
//   the point at (-2.8, 26.6); small grey flicks beside the brows at z 28..29 and under the eyes at z 21.5..22.5.
// - Eyes (zoom): big round grey-blue eyes 2.7..4 wide x 4.1 tall at (-5.9, 24.5) and (1.9, 24.5), white highlight;
//   nose a small dark dot at (-3.4, 21.9) on a faint muzzle bump; a small w smile x -5..-1 z 20.
// - Body: cream pear z 6.5..19, x -6..6 at the hips; small darker chest tuft x -1..1 z 14..17.
// - Arms: -X arm straight out to the hand at x -14.6..-10 z 13.4..18; +X arm raised to the hand at x 11..14.6 z 15.6..21.2.
//   Open paws with three finger bumps. Grey marks on the back of the forearms (seen in the back art).
// - Legs: splayed, cream thighs from the hips (z 12), dark brown (M1) rocky knee lumps with ochre rock nuggets
//   (-9.3..-5 z 4.7..11 and 2.5..9.2 z 4..13), dark brown shins and feet; feet turned outward, three cream claws each.
// - Tail: cream, from the +X hip (7.5, 9) out and up to the tip at (13.6, 14.3).
// - Back: the grey stripe runs from the bun down the back of the head and the spine to the tail root (z 12).
// - Glow: nothing glows (NOGLOW on the claws' white).
include <lib.scad>

fur    = [0.94, 0.80, 0.62];
furDk  = [0.81, 0.63, 0.48];
boot   = [0.46, 0.29, 0.22];
rockDk = [0.45, 0.27, 0.18];
rock   = [0.75, 0.52, 0.20];
bun    = [0.47, 0.42, 0.39];
bunHi  = [0.60, 0.54, 0.50];
band   = [0.36, 0.23, 0.19];
mark   = [0.63, 0.66, 0.68];
earIn  = [0.41, 0.26, 0.19];
ink    = [0.15, 0.09, 0.14];
claw   = [0.97, 0.97, 0.97, NOGLOW];
iris   = [0.47, 0.57, 0.62];

// ---- Head (turned 30 degrees to face the camera, like the drawing).
hc = [0.3, -1.2, 26.0];
HEAD_YAW = 14;
module skull(k = 1) {
  hull() {
    scale([7.8, 7.0, 7.2] * k) sphere(1, $fn = 36);
    translate([0, -0.8, -2.5]) scale([6.8, 6.6, 5.5] * k) sphere(1, $fn = 28);
  }
}
module headAt() { translate(hc) rotate([0, 0, HEAD_YAW]) children(); }

headAt() {
  color(fur) skull();
  // Faint muzzle bump round the nose.
  color(fur) translate([-0.5, -5.6, -3.6]) scale([2.6, 1.8, 1.7]) sphere(1, $fn = 20);
  // Floppy ears flaring out either side of the head, tips drooping.
  mirror_x() color(fur) hull() {
    translate([5.8, 0, 5.0]) sphere(1.5, $fn = 16);
    translate([9.0, 0.3, 1.8]) rotate([0, -35, 0]) scale([2.4, 1.6, 3.5]) sphere(1, $fn = 20);
  }
  // Tan shading on the ears' undersides.
  mirror_x() color(furDk) translate([9.3, 0.0, 0.2]) rotate([0, -25, 0]) scale([1.6, 1.7, 2.0]) sphere(1, $fn = 16);
  // Eyes: big, round, shiny.
  mirror_x() eye([3.6, -5.75, -1.5], 2.0, iris = iris, sclera = [0.16, 0.15, 0.22], pupil = [0.10, 0.10, 0.14], yaw = 2, shine = true);
  // Nose and the small smile.
  color(ink) translate([-0.6, -7.3, -3.9]) scale([0.8, 0.5, 0.55]) sphere(1, $fn = 12);
  color(ink) chain([[-2.4, -6.6, -5.7], [-1.6, -6.9, -6.1], [-0.8, -6.8, -5.8], [0.0, -6.9, -6.1], [0.8, -6.6, -5.7]],
                   [0.16, 0.16, 0.16, 0.16, 0.16]);
}

// Brow arrow and flicks: laid flush on the front half of the skull by the sheet's outline.
arrowPts = [[-1.5, 34], [0.7, 34], [0.7, 30.2], [1.1, 30.2], [1.1, 29.3], [-2.8, 26.6], [-5.3, 29.3], [-5.3, 30.2], [-1.5, 30.2]];
flicks = [[[-6.3, 28.1], [-4.5, 28.4], [-4.5, 29.2], [-6.3, 28.9]],
          [[0.3, 28.2], [2.3, 28.4], [2.3, 29.3], [0.3, 29.1]],
          [[-7.7, 21.8], [-6.5, 21.8], [-6.5, 22.7], [-7.7, 22.7]],
          [[2.9, 21.6], [4.1, 21.6], [4.1, 22.9], [2.9, 22.9]]];
color(mark) intersection() {
  headAt() skull(1.04);
  union() { prism(arrowPts); for (f = flicks) prism(f); }
  translate([-60, -60, 0]) cube([120, 60 + hc[1] + 1, 60]);
}

// Top-knot bun (lumpy swirl, off to +X) on a small brown hair band.
ell([2.8, 2.6, 1.0], [1.6, 0.4, 32.9], band);
color(bun) hull() {
  translate([2.4, 1.0, 35.5]) scale([5.0, 4.2, 3.4]) sphere(1, $fn = 24);
  translate([1.8, 0.6, 37.7]) scale([3.2, 2.9, 1.8]) sphere(1, $fn = 20);
}
// Swirl lumps in the lighter grey.
for (b = [[0.2, -1.8, 36.5, 2.0], [3.2, -2.3, 35.0, 1.9], [4.6, -0.8, 37.1, 1.7], [1.6, -0.2, 38.3, 1.6], [6.0, 0.8, 34.6, 1.5]])
  ell([b[3], b[3] * 0.75, b[3] * 0.6], [b[0], b[1], b[2]], bunHi);

// ---- Body.
module torso(k = 1) {
  hull() {
    translate([0, 0, 16.5]) scale([4.2, 3.8, 3.6] * k) sphere(1, $fn = 28);
    translate([0, 0, 11]) scale([6, 5.4, 5.5] * k) sphere(1, $fn = 32);
  }
}
color(fur) torso();
// Chest tuft.
for (i = [-1, 0, 1]) spike([2.6 + i * 0.8, -4.8 + abs(i) * 0.2, 16.3], [i * 0.3, -0.5, -1.9], 0.55, 0.05, furDk);

// Grey stripe from the bun down the back of the head (on the skull's midline) and wiggling down the spine.
headAt() for (i = [0 : 5]) let(a = 25 + i * 22, b = a + 22)
  limb([0, 7.1 * sin(a), 7.3 * cos(a) + (a > 90 ? -2.2 * sin(a - 90) : 0)],
       [0, 7.1 * sin(b), 7.3 * cos(b) + (b > 90 ? -2.2 * sin(b - 90) : 0)], 0.75, 0.75, mark);
chain([[-0.8, 3.0, 19.6], [0.6, 3.9, 17.8], [-0.4, 4.9, 15.4], [0.5, 5.4, 12.8], [0, 5.3, 11.4]], [0.7, 0.7, 0.7, 0.7, 0.5], mark);

// ---- Arms: -X straight out, +X raised; open paws with three finger bumps.
module paw(p, dir, up) {
  ell([2.0, 1.5, 2.4], p, fur);
  for (a = [-1, 0, 1]) ell([0.7, 0.6, 0.7], p + dir * 1.9 + [0, 0, a * 1.3 + up], fur);
}
limb([-4.2, -0.4, 16.4], [-9, -0.8, 14.8], 2.0, 1.8, fur);
limb([-9, -0.8, 14.8], [-13.2, -1.1, 14.6], 1.8, 1.7, fur);
paw([-13.6, -1.2, 14.8], [-1, 0, 0], 0.2);
limb([4.2, -0.4, 17.0], [9.5, -0.8, 16.9], 2.0, 1.8, fur);
limb([9.5, -0.8, 16.9], [14.5, -1.1, 18.2], 1.8, 1.7, fur);
paw([15.0, -1.2, 18.5], [1, 0, 0], 0.3);
// Grey marks on the back of each forearm (the back art).
for (k = [0, 1]) {
  ell([1.4, 0.5, 0.45], [-10.2 - k * 2.0, 1.2, 15.6 + k * 0.4], mark);
  ell([1.4, 0.5, 0.45], [10.6 + k * 2.0, 1.2, 17.8 + k * 0.8], mark);
}

// ---- Legs: splayed, rocky knee greaves, dark shins, feet turned outward.
module leg(kx, fx, toe) {
  s = kx < 0 ? -1 : 1;
  limb([3.4 * s, 0, 12], [kx, -0.3, 7.6], 3, 2.6, fur);
  ell([3.2, 3.0, 3.5], [kx, -0.6, 7.4], rockDk);
  for (n = [[kx + 2.3 * s, -1.8, 9.2, 1.3], [kx + 2.9 * s, 0.2, 7.0, 1.4], [kx + 1.8 * s, -2.6, 6.0, 1.2],
            [kx - 0.3 * s, -3.0, 8.4, 1.1], [kx + 1.2 * s, -1.2, 10.8, 1.0], [kx + 2.6 * s, -1.4, 4.9, 1.0]])
    color(rock) translate([n[0], n[1], n[2]]) rotate([n[2] * 20, n[0] * 10, 0]) sphere(n[3], $fn = 7);
  limb([kx + 0.2 * s, -0.6, 5.5], [fx, -1.0, 2.6], 2.3, 2.0, boot);
  color(boot) translate([fx + 0.4 * s, -1.3, 1.3]) rotate([0, 0, toe * s]) scale([2.7, 2.0, 1.3]) sphere(1, $fn = 20);
  d = [sin(toe) * s, -cos(toe), 0];
  q = [cos(toe) * s, sin(toe), 0];
  for (i = [-1, 0, 1]) spike([fx + 0.4 * s, -1.3, 0.9] + d * 2.3 + q * (i * 0.9), d * 1.5 + [0, 0, -0.25], 0.45, 0.05, claw);
}
leg(-6.2, -7.8, 50);
leg(6.8, 8.8, 55);

// ---- Tail: out to +X and up.
chain([[3.5, 3.6, 8.8], [7.5, 4.2, 8.6], [11, 3.8, 10.0], [13.6, 3.2, 12.8]], [1.8, 1.8, 1.5, 0.7], fur);
