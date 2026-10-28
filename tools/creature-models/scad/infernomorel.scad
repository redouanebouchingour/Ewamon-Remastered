// Infernomorel: the last of the Cindercap line. A hunched charcoal brute in a wide crouch under a broad maroon
// mushroom cap crowned with fire; a carved jack-o'-lantern face, a glowing furnace grate in its chest, huge
// boulder hands with lava claws held out to both sides.
// Modelled off .cache/measure/infernomorel (front 40.7 x 40 units, feet z = 0, art centre x = 0).
//
// Checklist (sheet x, z):
//   cap        x -17..16, z 21..30     maroon (M0 dark #550f0c), thick rounded rim (3 units tall at the sides), a
//              bright red band along the lower rim (M3 x -10..8, z 23..28), red + orange lava streaks on top.
//   fire       x -13..12, z 28..40     crown of flames on the cap: red tongues outside, orange, a big pale yellow core
//              (x -9.5..6.6, z 28..35.6); tallest tongue at x -2..1.5 up to 40; tongues all round (back view too).
//   head       x -9..7, z 17..27       charcoal dome under the cap, face turned to the camera.
//   eyes       far x -8..-3, near x 1..5, z 24..27   angry glowing slits rising outwards (orange, yellow core).
//   mouth      x -5..3, z 19.5..22.5   jagged grin of glowing yellow teeth in a dark mouth.
//   torso      shoulders x -9..13 z 16..24 (22 wide), hips x -10..12 z 5..12; hunched, charcoal (M1 #1b191c).
//   chest      x -4.5..3.5, z 7.5..16  glowing orange oval with two rows of yellow bars (a furnace grate).
//   arms       thick, out and down from the shoulders to the hands: far hand x -20..-10 z 6..15.5, near hand
//              x 10..20 z 4..16: dark boulder fists with orange/yellow lava patches and 4 lava claws pointing down.
//   legs       wide crouch: far foot x -12.4..-4 z 0..6 (lava toes x -12..-7), near foot x 7..15 z 0..6
//              (lava toes x 8..14, z 0..4); thick thighs from the hips.
//   markings   red lava cracks on the shoulders, upper arms, near thigh (x 5..8, z 8..10).
//   back       charcoal back with lighter grey shaggy streaks (M1 #5f6061), the cap's orange underside band, the
//              fire spreading, lava claws on both hands, small white heel claws.
//   glow       sprite: #fa9804 orange glows. GLOW on the eyes, teeth, chest bars, claw tips and the fire core;
//              NOGLOW on the red flame and lava red.
include <lib.scad>

coal = [0.12, 0.11, 0.12];               // M1 dark (the front body)
coalHi = [0.31, 0.30, 0.32];             // M1 mid: edges, the back streaks
coalLt = [0.40, 0.40, 0.41];             // M1 light: back fur highlights
capDk = [0.38, 0.06, 0.04, NOGLOW];      // M0 dark: the cap
capRed = [0.62, 0.06, 0.03, NOGLOW];     // M0: cap streaks
capBright = [0.84, 0.06, 0.03, NOGLOW];  // #d70f07 patches
rimRed = [0.66, 0.03, 0.02, NOGLOW];     // M3 band
flameRed = [0.93, 0.23, 0.01, NOGLOW];   // #ed3c01
flameOrange = [0.98, 0.40, 0.01, NOGLOW];// #f96602
glowOrange = [0.98, 0.60, 0.01, GLOW];   // #fa9804 GLOWS
yellow = [0.99, 0.78, 0.06, GLOW];       // #fdc811
paleYellow = [0.99, 0.91, 0.33, GLOW];   // #fce955
lava = [0.84, 0.13, 0.03, NOGLOW];       // cracks
ink = [0.02, 0.01, 0.01];
white = [0.9, 0.9, 0.9];

module frontHalf(y = 0) { translate([-60, y - 120, -10]) cube([120, 120, 80]); }
// Flame tongue: a fat teardrop from p along d, bending its tip a little in +x.
module tongue(p, d, r, c) {
  color(c) hull() { translate(p) sphere(r, $fn = 12); translate(p + d * 0.45) sphere(r * 0.7, $fn = 10); }
  color(c) hull() { translate(p + d * 0.45) sphere(r * 0.7, $fn = 10); translate(p + d + [d[2] * 0.12, 0, 0]) sphere(0.25, $fn = 6); }
}
module vein(pts, r = 0.35) { chain(pts, [for (p = pts) r], lava); }

// ---- torso: hunched, broad shoulders high, narrower hips; centred on the sheet at x 1.5.
module torso(g = 0) {
  hull() {
    translate([0, 0, 8.5]) scale([9 + g, 7.5 + g, 4.5 + g]) sphere(1, $fn = 32);
    translate([0, 0.5, 19]) scale([11.2 + g, 8 + g, 5.2 + g]) sphere(1, $fn = 32);
  }
}
color(coal) torso();
// Chest grate: an orange oval laid on the chest, two rows of yellow bars standing just proud of it.
chestOval = [[-0.5, 16.2], [1.8, 15.6], [3.4, 13.8], [3.8, 11.5], [3.4, 9.2], [1.8, 7.6], [-0.5, 7.2], [-2.8, 7.6], [-4.4, 9.2], [-4.8, 11.5], [-4.4, 13.8], [-2.8, 15.6]];
color(glowOrange) intersection() { torso(0.4); prism(chestOval); frontHalf(-1); }
color(ink) intersection() { torso(0.6); prism([[-3.8, 12.1], [3, 12.1], [3, 11.3], [-3.8, 11.3]]); frontHalf(-1); }
for (bx = [-3.2, -1.6, 0, 1.6]) for (row = [[12.6, 15.0], [8.3, 10.7]])
  color(yellow) intersection() { torso(0.8); prism([[bx - 0.5, row[0]], [bx + 0.5, row[0]], [bx + 0.5, row[1]], [bx - 0.5, row[1]]]); frontHalf(-1); }
// Lava cracks: red flecks on the shoulders and the near thigh's red patch, laid flush on the torso.
mirror_x() {
  color(lava) intersection() { torso(0.35); translate([7.5, -6.5, 19.5]) rotate([0, -20, 0]) scale([0.9, 3, 3.5]) sphere(1, $fn = 10); }
  color(lava) intersection() { torso(0.35); translate([10, -4, 22]) scale([2.2, 2.5, 0.8]) sphere(1, $fn = 10); }
}
color(lava) intersection() { torso(0.4); translate([7, -6, 9.4]) scale([2.6, 3, 1.2]) sphere(1, $fn = 10); }
color(lava) intersection() { torso(0.35); translate([-6.5, -5.5, 10.5]) rotate([0, 30, 0]) scale([0.8, 3, 2.6]) sphere(1, $fn = 10); }

// ---- head: a charcoal dome under the cap, turned 20 degrees to the camera; the carved face on its front.
translate([0, -3, 0]) rotate([0, 0, 20]) translate([0, 3, 0]) {
  color(coal) hull() {
    translate([0, -3, 22]) scale([8.5, 7, 5.2]) sphere(1, $fn = 30);
    translate([0, -4, 18.5]) scale([7, 6, 3]) sphere(1, $fn = 24);
  }
  // Eyes: angry slits rising outwards: orange slit, yellow core, a dark brow ridge above.
  mirror_x() {
    translate([4.6, -9.1, 25.0]) rotate([0, 0, 25]) rotate([0, -32, 0]) {
      color(glowOrange) scale([2.8, 1.0, 1.25]) sphere(1, $fn = 14);
      color(paleYellow) translate([0.3, -0.5, 0]) scale([1.5, 0.8, 0.6]) sphere(1, $fn = 10);
    }
    color(coal) translate([4.4, -9.0, 27.0]) rotate([0, 0, 25]) rotate([0, -32, 0]) scale([3.4, 1.3, 1.1]) sphere(1, $fn = 12);
  }
  // Grin: a dark mouth with two rows of jagged glowing teeth.
  color(ink) translate([0, -9.4, 20.8]) scale([4.6, 0.9, 1.9]) sphere(1, $fn = 20);
  for (t = [[-3.3, 0.9], [-2, 1.3], [-0.6, 1.5], [0.8, 1.4], [2.2, 1.1], [3.3, 0.8]]) {
    color(yellow) translate([t[0], -9.95 - (0.2 * abs(t[0]) / 3.3), 21.5]) cube([1.0, 0.8, t[1] * 1.3], center = true);
    color(glowOrange) translate([t[0] + 0.6, -9.95 - (0.2 * abs(t[0]) / 3.3), 20.0]) cube([1.0, 0.8, t[1] * 1.0], center = true);
  }
}

// ---- cap: a broad maroon pillow with a thick rim, pitched up 18 degrees at the front so its rim arches over the
// face (the art's underside curve); a red band along the rim, lava streaks lying flush on top.
capC = [0, -1, 24.8];
module capShape(g = 0) {
  hull() {
    scale([18.5 + g, 14 + g, 2.1 + g]) sphere(1, $fn = 48);
    translate([0, 0, 3]) scale([14.2 + g, 10.8 + g, 4.6 + g]) sphere(1, $fn = 40);
  }
}
translate(capC) rotate([-22, 0, 0]) {
  color(capDk) capShape();
  // Red band on the lower rim all round.
  color(rimRed) intersection() { capShape(0.3); translate([-30, -30, -1.2]) cube([60, 60, 1.5]); }
  // Underside: dark.
  color(ink) translate([0, 0, -1.6]) scale([17.8, 13.4, 1.0]) sphere(1, $fn = 40);
  // Lava streaks radiating over the top, cut flush to the surface: [azimuth, inner radius share, width, colour].
  for (s = [[-120, 0.4, 1.8, capBright], [-70, 0.45, 1.6, glowOrange], [-35, 0.5, 1.7, capRed], [-10, 0.45, 1.8, capBright],
            [20, 0.45, 1.6, glowOrange], [60, 0.45, 1.7, capRed], [110, 0.45, 1.7, capBright], [150, 0.45, 1.6, glowOrange],
            [-160, 0.45, 1.6, capRed], [-95, 0.65, 1.4, flameOrange], [-50, 0.7, 1.4, capBright], [85, 0.65, 1.5, flameOrange],
            [-140, 0.75, 1.3, glowOrange], [40, 0.75, 1.3, capBright], [180, 0.7, 1.3, capBright]]) {
    az = s[0]; k = s[1];
    p0 = [18.5 * k * cos(az), 14 * k * sin(az), 2.1 + 4.6 * sqrt(max(0, 1 - k * k)) + 0.6];
    p1 = [18.5 * cos(az) * 1.02, 14 * sin(az) * 1.02, 1.6];
    color(s[3]) intersection() { capShape(0.4); hull() { translate(p0) sphere(s[2] * 0.6, $fn = 8); translate(p1) sphere(s[2] * 0.45, $fn = 8); } }
  }
}

// ---- fire crown: a dense blaze on the cap: a tall red mass, orange inside it, a big pale yellow core at the
// front, and thinner jagged tongues rising out of the mass all round, the tallest at the front-centre.
translate([0, -1.5, 31]) {
  color(flameRed) hull() { translate([0, 1, 0]) scale([13.5, 10, 4]) sphere(1, $fn = 36); translate([-1, 0.5, 3]) scale([10, 7, 4.5]) sphere(1, $fn = 32); }
  color(flameOrange) hull() { translate([-0.5, -2.5, 0.3]) scale([11.5, 8, 4]) sphere(1, $fn = 32); translate([-1, -2.5, 3.8]) scale([8, 5.5, 4]) sphere(1, $fn = 28); }
  color(paleYellow) hull() { translate([-1, -5.5, 0.6]) scale([8.2, 5.5, 3.4]) sphere(1, $fn = 24); translate([-1.5, -5, 3.6]) scale([5.2, 3.5, 3.2]) sphere(1, $fn = 20); }
  // Tongues: [x, y, base r, height, colour, lean x, lean y]; bases sunk in the mass so only the tips show.
  for (f = [[0, -2.5, 3.0, 11, flameRed, 0.4, 0], [-0.3, -2.5, 2.2, 9.5, flameOrange, 0.3, 0], [-0.6, -3, 1.4, 8, paleYellow, 0.2, 0],
            [-8.5, -5, 2.4, 6, flameRed, -1.2, -0.4], [-12, -0.5, 2.0, 4.5, flameRed, -1.6, 0], [-6, -7.5, 2.4, 6.5, flameOrange, -0.8, -0.8],
            [-5.5, -6.5, 1.4, 5, paleYellow, -0.4, -0.4], [-3.5, -8.5, 2.2, 5, flameRed, 0, -1.2], [3, -8.5, 2.2, 5.5, flameOrange, 0.4, -1.2],
            [3.5, -7.5, 1.3, 4, paleYellow, 0.3, -0.4], [7, -6.5, 2.4, 5, flameRed, 1.2, -0.8], [10.5, -3, 2.2, 3.5, flameRed, 1.6, -0.4],
            [11.5, 3, 2.0, 4, flameRed, 1.6, 0.4], [6.5, 7.5, 2.4, 6, flameOrange, 0.8, 1.2], [0.5, 8.5, 2.6, 8, flameRed, 0, 1.6],
            [1, 7.5, 1.6, 6.5, paleYellow, 0, 0.8], [-5.5, 7.5, 2.4, 7, flameOrange, -0.8, 1.2], [-10.5, 4.5, 2.0, 5, flameRed, -1.6, 0.8],
            [-4.5, 2, 2.4, 8.5, flameOrange, -0.4, 0], [4.5, 1.5, 2.4, 6.5, flameOrange, 0.4, 0], [-4, 1.5, 1.4, 7, paleYellow, -0.3, 0],
            [4, 1, 1.4, 5.5, paleYellow, 0.3, 0], [-13.5, 2.5, 1.4, 3, flameRed, -1.6, 0.4], [13.5, -1, 1.4, 3.5, flameRed, 1.6, 0],
            [-8.5, 0, 2.0, 7, flameRed, -0.8, 0], [8.5, 0.5, 2.0, 5, flameRed, 0.8, 0], [-2.5, -5.5, 1.2, 7, paleYellow, 0, -0.3],
            [2, 4.5, 1.6, 7.5, flameOrange, 0.2, 0.4], [-7, 4, 1.6, 6, flameRed, -0.6, 0.4], [-10, -6.5, 1.6, 4, flameOrange, -1, -0.8], [9.5, -6, 1.6, 4, flameOrange, 1, -0.8]])
    color(f[4]) hull() {
      translate([f[0], f[1], 0]) sphere(f[2], $fn = 10);
      translate([f[0] + f[5] * 0.5, f[1] + f[6] * 0.5, f[3] * 0.55]) sphere(f[2] * 0.7, $fn = 8);
      translate([f[0] + f[5], f[1] + f[6], f[3]]) sphere(0.3, $fn = 6);
    }
}

// ---- arms: thick, out and down from the shoulders; boulder fists with lava and four lava claws each.
mirror_x() {
  limb([9.5, -1, 19.5], [14, -2, 13.5], 3.8, 3.3, coal);
  limb([14, -2, 13.5], [17.5, -2, 9.5], 3.3, 3.6, coal);
  // Fist.
  color(coal) translate([18, -2.5, 9.5]) scale([4.8, 4.6, 4.3]) sphere(1, $fn = 24);
  // Lava patches on the knuckles and the back of the hand.
  color(glowOrange) translate([19.5, -5.5, 11]) rotate([0, 0, -30]) scale([2.6, 1.0, 1.8]) sphere(1, $fn = 12);
  color(yellow) translate([20.2, -5.8, 11]) rotate([0, 0, -30]) scale([1.4, 0.7, 1.0]) sphere(1, $fn = 10);
  color(lava) translate([21.5, -1.5, 12]) rotate([0, 20, 0]) scale([1.4, 2.4, 0.9]) sphere(1, $fn = 10);
  color(glowOrange) translate([17, 1.5, 12.5]) rotate([0, 0, 40]) scale([2.2, 0.9, 1.6]) sphere(1, $fn = 12);
  color(lava) translate([13.5, -4.5, 16]) rotate([0, 40, 0]) scale([0.5, 1.2, 2.4]) sphere(1, $fn = 8);
  // Claws: four, pointing down and out, orange with glowing yellow tips.
  for (a = [-45, -15, 15, 45]) {
    c = [18.5 + sin(a) * 3.8, -3.5 + cos(a) * 3.6 - 3.6, 7.5];
    d = [sin(a) * 2.2 + 1.2, cos(a) * 1.2 - 1.2, -5.5];
    color(flameOrange) hull() { translate(c) sphere(1.3, $fn = 10); translate(c + d * 0.55) sphere(0.9, $fn = 8); }
    color(yellow) hull() { translate(c + d * 0.55) sphere(0.9, $fn = 8); translate(c + d) sphere(0.15, $fn = 6); }
  }
}

// ---- legs: a wide crouch, thick thighs out from the hips to flat feet with lava toes; white heel claws behind.
mirror_x() {
  limb([5, 0.5, 9], [10.5, 2, 4.5], 4.0, 3.6, coal);
  color(coal) hull() {
    translate([11, 2.5, 2.8]) scale([4.0, 3.6, 2.8]) sphere(1, $fn = 24);
    translate([11.5, -3.5, 2.0]) scale([3.4, 2.8, 2.0]) sphere(1, $fn = 20);
  }
  color(glowOrange) translate([11.5, -4.5, 2.6]) scale([2.8, 2.0, 1.4]) sphere(1, $fn = 12);
  for (a = [-30, 0, 30]) {
    c = [11.5 + sin(a) * 2.2, -6, 1.3];
    color(flameOrange) hull() { translate(c) sphere(0.9, $fn = 8); translate(c + [sin(a) * 1.2, -2.2, -0.7]) sphere(0.2, $fn = 6); }
  }
  color(white) translate([11.5, 6.2, 1.4]) scale([1.4, 1.0, 0.8]) sphere(1, $fn = 10);
}

// ---- back: the sprite's back is mid grey (M1 #363439) shaggy fur over the dark body: a grey back surface with
// darker and lighter streaks.
module backHalf(y = 1.5) { translate([-60, y, -10]) cube([120, 120, 80]); }
color([0.21, 0.20, 0.22]) intersection() { torso(0.3); backHalf(1.5); }
for (m = [[0, 7.9, 20, 1.4, 4.5, -10, coal], [-5, 7.5, 16, 1.2, 4, 15, coal], [5.5, 7.3, 15, 1.2, 4.5, -20, coal], [-2, 7.7, 11, 1.3, 3.5, 10, coal],
          [3, 7.6, 9, 1.1, 3, -15, coal], [-8, 6.2, 19, 1.2, 3, 25, coal], [8.5, 6.0, 20, 1.2, 3, -25, coal],
          [2, 8.0, 17, 1.0, 3.5, -5, coalLt], [-3.5, 8.0, 14, 0.9, 3, 12, coalLt], [-7, 7.0, 10, 1.0, 2.5, 20, coalLt], [6.5, 7.0, 11, 1.0, 2.5, -20, coalLt]])
  color(m[6]) translate([m[0], m[1], m[2]]) rotate([0, m[5], 0]) scale([m[3], 0.8, m[4]]) sphere(1, $fn = 10);
