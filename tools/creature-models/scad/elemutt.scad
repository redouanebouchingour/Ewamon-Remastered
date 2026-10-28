// Elemutt, rebuilt from the measurement sheet (front height 40, feet z = 0, x centred).
//
// Checklist (sheet x, z):
// - Body plan: a chubby cream puppy standing with its legs splayed, both arms flung wide, head turned to the camera.
// - Head: a big round cream ball x -8.2..7.6, z 18.7..33.6; the face is drawn frontal (the eyes read at -3.5 and 3.8
//   on the sheet), so the head is turned 30 degrees to the camera. No muzzle.
// - Ears: floppy, flaring out either side: viewer's left (-X) x -11..-7 z 26..31.5 with its brown inside showing,
//   viewer's right (+X) x 7..10.3 z 25..32, cream.
// - Top-knot bun: dark grey ball x -2..7 z 32.6..40 (off centre to +X), lighter swirl on top, brown hair band at its
//   base x -5..4.5 z 32.6..35.
// - Arrow marking: grey (M2) Aang arrow on the brow: shaft x -1.5..0.7 z 30..34, head x -5.3..1.1 at z 29.5 down to
//   the point at (-2.8, 26.6); small grey flicks beside the brows at z 28..29 and under the eyes at z 21.5..22.5.
// - Eyes: big round grey-blue eyes 3.3 wide x 4 tall at (-3.5, 24.4) and (3.8, 24.4), white highlight; nose a small
//   dark dot at (-2.7, 22.3); a small w smile x -4..-1 z 20.5..21.5.
// - Body: cream pear z 6.5..19, x -6..6 at the hips; small darker chest tuft x -1..1 z 14..17.
// - Arms: -X arm straight out to the hand at x -14.6..-10 z 13.4..18; +X arm raised to the hand at x 11..14.6 z 15.6..21.2.
//   Open paws with three finger bumps. Grey marks on the back of the forearms (seen in the back art).
// - Legs: splayed, cream thighs from the hips (z 12), dark brown (M1) rocky knee lumps with ochre rock nuggets
//   (-9.3..-5 z 4.7..11 and 2.5..9.2 z 4..13), dark brown shins and feet; feet turned outward, three cream claws each.
// - Tail: cream, from the +X hip (7.5, 9) out and up to the tip at (13.6, 14.3).
// - Back: the grey stripe runs from the bun down the back of the head and the spine to the tail root (z 12).
// - Glow: nothing glows (NOGLOW on the claws' white).
include <lib.scad>

fur    = [0.91, 0.77, 0.59];
furDk  = [0.81, 0.63, 0.48];
boot   = [0.46, 0.29, 0.22];
rockDk = [0.45, 0.27, 0.18];
rock   = [0.75, 0.52, 0.20];
bun    = [0.45, 0.40, 0.37];
bunHi  = [0.57, 0.51, 0.47];
band   = [0.36, 0.23, 0.19];
mark   = [0.63, 0.66, 0.68];
earIn  = [0.41, 0.26, 0.19];
ink    = [0.15, 0.09, 0.14];
claw   = [0.97, 0.97, 0.97, NOGLOW];
iris   = [0.40, 0.48, 0.52];

// ---- Head (turned 30 degrees to face the camera, like the drawing).
hc = [0.3, -1.2, 26.0];
HEAD_YAW = 30;
module skull(k = 1) {
  hull() {
    scale([7.8, 7.0, 7.2] * k) sphere(1, $fn = 36);
    translate([0, -0.8, -2.5]) scale([6.8, 6.6, 5.5] * k) sphere(1, $fn = 28);
  }
}
module headAt() { translate(hc) rotate([0, 0, HEAD_YAW]) children(); }

headAt() {
  color(fur) skull();
  // Floppy ears flaring out either side of the head.
  mirror_x() color(fur) hull() {
    translate([6.2, -0.3, 4.6]) sphere(1.5, $fn = 16);
    translate([9.6, 0.3, 1.0]) scale([2.3, 2.2, 4.2]) sphere(1, $fn = 20);
  }
  // The -X ear shows its brown inside in the art.
  color(earIn) translate([-9.9, -1.9, 0.8]) scale([1.6, 0.5, 3.3]) sphere(1, $fn = 16);
  // Eyes: big, round, shiny.
  mirror_x() eye([3.7, -5.5, -1.6], 2.0, iris = iris, pupil = [0.10, 0.10, 0.14], yaw = 8);
  // Nose (drawn a little left of centre) and the small smile.
  color(ink) translate([-1.9, -6.9, -3.9]) scale([0.85, 0.5, 0.6]) sphere(1, $fn = 12);
  color(ink) chain([[-3.3, -6.5, -5.1], [-2.6, -6.8, -5.6], [-1.9, -6.6, -5.2], [-1.2, -6.8, -5.6], [-0.5, -6.5, -5.1]],
                   [0.22, 0.22, 0.22, 0.22, 0.22]);
}

// Brow arrow and flicks: laid flush on the front half of the skull by the sheet's outline.
arrowPts = [[-1.5, 34], [0.7, 34], [0.7, 30.2], [1.1, 30.2], [1.1, 29.3], [-2.8, 26.6], [-5.3, 29.3], [-5.3, 30.2], [-1.5, 30.2]];
flicks = [[[-6.3, 28.1], [-4.5, 28.4], [-4.5, 29.2], [-6.3, 28.9]],
          [[0.3, 28.2], [2.3, 28.4], [2.3, 29.3], [0.3, 29.1]],
          [[-5.6, 21.8], [-4.4, 21.8], [-4.4, 22.6], [-5.6, 22.6]],
          [[3.0, 21.3], [4.6, 21.3], [4.6, 22.6], [3.0, 22.6]]];
color(mark) intersection() {
  headAt() skull(1.04);
  union() { prism(arrowPts); for (f = flicks) prism(f); }
  translate([-60, -60, 0]) cube([120, 60 + hc[1] + 1, 60]);
}

// Top-knot bun with its brown hair band.
ell([4.8, 4.0, 1.3], [0.5, 0.2, 33.5], band);
ell([4.8, 4.4, 3.8], [1.5, 0.5, 36.2], bun);
ell([1.8, 1.4, 1.1], [3.0, -1.6, 38.3], bunHi);

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

// Grey stripe down the back of the head and the spine (traced from the back sheet).
backStripe = [[-3.3, 31.9], [-1.7, 31.9], [-2.6, 29.7], [-2.6, 25.9], [-1.3, 23], [-0.7, 23], [-0.4, 21], [0.2, 20.8], [0.2, 19.8],
              [-0.6, 19.6], [0.2, 19.4], [0.2, 17.8], [-2.7, 12.1], [-3.7, 12.7], [-3.7, 13.6], [-3.1, 13.8], [-3.3, 14.5],
              [-2.4, 15.2], [-2.4, 16.3], [-1.5, 17.4], [-1.3, 19.9], [-1.5, 21.4], [-3.3, 23.4], [-4.2, 25.9], [-4.2, 29.7],
              [-3.7, 29.9], [-3.3, 31.7]];
color(mark) intersection() {
  union() { headAt() skull(1.04); torso(1.05); }
  ppBack(0) rotate([90, 0, 0]) linear_extrude(height = 120, center = true) polygon(backStripe);
  translate([-60, hc[1] + 1.5, 0]) cube([120, 60, 60]);
}

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
ell([1.5, 0.5, 0.5], [-11.4, 0.6, 15.7], mark);
ell([1.5, 0.5, 0.5], [11.8, 0.6, 18.6], mark);

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
