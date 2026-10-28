// Cindercap: a charcoal-grey lizard under a glowing ember-spotted mushroom cap, a flame on its fat tail tip.
// Modelled straight off .cache/measure/cindercap (front 42 x 40 units, feet z = 0, art centre x = 0).
//
// Checklist (sheet x, z; art colours):
//   body plan: a big-headed biped lizard, body facing -Y, the camera at its front-right. The mushroom cap is a hat
//     over the whole head; the fat tail sweeps out to +X (viewer's right) and up, its tip on fire.
//   cap        x -20.3..14.1, z 24.5..39.1   red-orange dome (M1 #cf3709), darker red rim band, a tan gill band
//              under the rim (z 27..30 left, 24.5..27 right: the cap tilts down to +X and up at the front), yellow
//              spots with paler cores (M2) all over the dome, front and back.
//   head       x -17..5, z 17..30            charcoal (M0), huge, straight under the cap; snout to the front-left
//              (-17..-11, z 19..24.5) with a light grey top; chin at z 17.
//   eyes       near x -3.8..1.6, z 19.5..24.5; far x -13..-10, z 20..24.5   orange (GLOW) with dark pupils, angry:
//              the brow's lower edge slants down to the nose.
//   torso      x -15..12, z 4..20            charcoal pear, widest at the hips.
//   belly      x -8.2..2.4, z 5.1..15.3      orange oval (GLOW) with a pale yellow core x -7.6..0.6, z 5.7..14.5.
//   arms       far x -15..-10 z 9..17 (hangs beside the chest, white claws at (-14, 10)); near x 3..10, z 7..20 with
//              a light grey forearm patch (3..7, 7..12) and white claws at (3.5, 9), (5.5, 8.5).
//   legs/feet  far foot x -13..-4, z 0..6; near foot x 2..10, z 0..4.5: flat feet, toes forward, three white claws.
//   tail       from the hips at (9, 5) out to (17, 10.5)..(15.8, 13.8), 6 units thick, charcoal.
//   flame      x 11.4..21, z 11.6..25.3      red-orange tongue (plate), yellow core x 13..18.3, z 13..19.3 (GLOW).
//   back       cap top with spots, the dark body with lighter grey patches, the tail + flame on the viewer's left
//              (the creature's +X), the feet.
//   glow       sprite: #fd8902 orange glows (belly, flame, eyes). Cap spots and the cap NOGLOW.
include <lib.scad>

body = [0.17, 0.17, 0.19];              // M0 (the big region's mean; the mid shade #36343c reads too pale)
bodyHi = [0.40, 0.36, 0.34];            // M0 light shade: forearm patch, snout top, back patches
capRed = [0.86, 0.24, 0.04, NOGLOW];    // M1 cap
capRim = [0.72, 0.05, 0.04, NOGLOW];    // M1 dark shade: the rim band
gill = [0.66, 0.49, 0.30];              // tan underside (sampled from the art; the palette merged it into M0)
spot = [0.99, 0.83, 0.26, NOGLOW];      // M2 spots
spotCore = [1.00, 0.93, 0.49, NOGLOW];
bellyOrange = [0.96, 0.38, 0.01, GLOW];
bellyCore = [0.99, 0.87, 0.53, GLOW];
flameRed = [0.82, 0.13, 0.04, NOGLOW];
flameOrange = [0.98, 0.50, 0.02, GLOW];
flameCore = [0.99, 0.87, 0.43, GLOW];
eyeOrange = [0.98, 0.52, 0.02, GLOW];
eyeDark = [0.60, 0.05, 0.04];
claw = [0.94, 0.93, 0.80];
ink = [0.05, 0.04, 0.06];

// The half-space in front of the torso's mid-plane: markings laid on with prism() only land on the front.
module frontHalf(y = 0) { translate([-60, y - 120, -10]) cube([120, 120, 80]); }
// A plate grown by g (a ring round a traced outline).
module plateGrow(pts, t, g, c) { color(c) rotate([90, 0, 0]) linear_extrude(height = t, center = true) offset(r = g) polygon(pts); }

// ---- torso: a charcoal pear, hips wide, chest narrower, centred a little forward (sheet x of its centre -1.5).
module torso(g = 0) {
  hull() {
    translate([0, -3, 9.5]) scale([9 + g, 8.3 + g, 6.5 + g]) sphere(1, $fn = 32);
    translate([0, -3.5, 16]) scale([7.2 + g, 6.6 + g, 5.2 + g]) sphere(1, $fn = 32);
  }
}
color(body) torso();
// Belly: the orange oval with its pale core, laid flush on the torso's front with the sheet outlines.
bellyPts = [[-6.1, 15.3], [-3.8, 15.3], [-3.4, 14.1], [-3.8, 13.9], [-4, 14.7], [-5.7, 14.7], [-7.6, 12.2], [-7.8, 8.9], [-7, 7.4], [-5.7, 7.2], [-4.5, 6.3], [-4, 6.4], [-3, 5.5], [-2, 5.9], [-2, 6.8], [-1.1, 6.4], [-0.5, 7.2], [-0.3, 6.4], [-0.1, 7.4], [0.5, 7.2], [0.8, 8], [1.8, 8.2], [1.8, 5.9], [1, 5.5], [2.4, 5.1], [-5.3, 5.3], [-4.9, 5.7], [-5.7, 6.1], [-5.5, 7], [-7, 6.6], [-8.2, 8.6], [-7.8, 10.5], [-8.2, 13], [-7.4, 13.2], [-7.4, 14.5], [-6.5, 14.3], [-6.1, 15.1]];
bellyOval = [[-6, 15.2], [-3.4, 14.4], [-1.6, 12.4], [0, 10.6], [1.9, 8.4], [2.2, 6], [0.5, 5.1], [-3, 5.3], [-6.5, 6.4], [-8.2, 8.6], [-8.2, 12.8], [-7.4, 14.6]];
corePts = [[-5.7, 14.5], [-4, 14.5], [-3.4, 13.2], [-2.4, 12.8], [-2, 10], [-1.2, 8.4], [0.4, 8.2], [0.5, 7.4], [-0.5, 6.6], [-2, 6.6], [-3, 5.7], [-4, 6.6], [-6.9, 7.4], [-7.6, 8.9], [-7.6, 11.8], [-5.7, 14.3]];
color(bellyOrange) intersection() { torso(0.35); prism(bellyOval); frontHalf(-2); }
color(bellyCore) intersection() { torso(0.7); prism(corePts); frontHalf(-2); }

// ---- head: huge, straight under the cap, turned 10 degrees towards the camera; snout to the front.
module headShape(g = 0) {
  hull() {
    translate([0, -13, 23.5]) scale([11.3 + g, 9.3 + g, 6.5 + g]) sphere(1, $fn = 36);
    translate([0, -16, 22.5]) scale([8 + g, 8 + g, 4.5 + g]) sphere(1, $fn = 28);
  }
}
translate([0, -13, 0]) rotate([0, 0, 10]) translate([0, 13, 0]) {
  color(body) headShape();
  // Snout: a blunt wedge forward with a light grey top.
  color(body) hull() {
    translate([0, -19, 21.5]) scale([5.2, 4.2, 3.2]) sphere(1, $fn = 24);
    translate([0, -15, 23]) scale([6.5, 3, 3.8]) sphere(1, $fn = 24);
  }
  color(bodyHi) translate([-0.5, -19.5, 24]) scale([3.2, 2.6, 0.7]) sphere(1, $fn = 16);
  // Angry orange eyes: dark red inner iris, black slit pupil, a brow of skin hooding the top.
  mirror_x() {
    eye([7.4, -19.3, 22.4], 2.9, iris = eyeOrange, sclera = eyeOrange, pupil = ink, yaw = 30, lid = 0.36, lid_tilt = 28, lid_c = body, slit = 0.45, shine = true);
  }
}

// ---- cap: a wide dome, tipped up at the front and down to +X, with a dark red rim band, a tan gill under it and
// yellow spots. Dome centre on the sheet at x -3.1 (scad y -6.2).
capC = [0, -6.2, 27.5];
module dome(rx, ry, rz, fn = 48) { scale([rx, ry, rz]) intersection() { sphere(1, $fn = fn); translate([-2, -2, 0]) cube(4); } }
translate(capC) rotate([-8, 6, 0]) {
  color(capRed) dome(18, 15, 11.5);
  // Rim band: the lower 2.2 units of a slightly larger dome.
  color(capRim) intersection() { dome(18.3, 15.3, 11.6, 44); translate([-30, -30, -1]) cube([60, 60, 3.2]); }
  // Gill: the tan underside, a flat lens that shows under the rim.
  color(gill) translate([0, 0, -0.9]) scale([17.6, 14.6, 1.5]) sphere(1, $fn = 44);
  // Spots: [azimuth from +X, elevation, radius]; the front ones placed where the sheet has them.
  spots = [[-102, 51, 2.8], [-33, 46, 2.6], [-71, 37, 2.0], [-62, 80, 1.9], [-112, 22, 1.6], [-16, 12, 1.7], [-57, 15, 1.3],
           [0, 7, 1.3], [-140, 40, 1.5], [100, 30, 2.3], [150, 42, 2.1], [60, 28, 2.0], [175, 15, 1.5], [125, 65, 1.9], [25, 20, 1.4], [-160, 65, 1.4]];
  for (s = spots) {
    az = s[0]; el = s[1]; r = s[2];
    n = [cos(el) * cos(az), cos(el) * sin(az), sin(el)];
    p = [18 * n[0], 15 * n[1], 11.5 * n[2]];
    color(spot) translate(p) rotate(_dir_rot(n)) scale([r, r, 0.3 * r]) sphere(1, $fn = 14);
    color(spotCore) translate(p + n * 0.25) rotate(_dir_rot(n)) scale([r * 0.55, r * 0.55, 0.3 * r]) sphere(1, $fn = 10);
  }
}

// ---- arms: hang beside the chest, hands forward with white claws; the near forearm has a light grey patch.
mirror_x() {
  limb([7.5, -7, 17], [11, -11.5, 10.5], 2.3, 1.9, body);
  ell([2.4, 2.7, 1.9], [11, -12.5, 10], body);
  for (a = [-30, 0, 30]) spike([11 + sin(a) * 1.3, -14.2, 9.6], [sin(a) * 0.6, -1.4, -0.5], 0.45, 0.05, claw);
}
color(bodyHi) translate([12.2, -12.8, 10.6]) rotate([0, 0, 25]) scale([1.0, 2.2, 2.0]) sphere(1, $fn = 14);

// ---- legs: thick thighs into flat feet pointing forward, three white claws each.
mirror_x() {
  ell([4.2, 4.3, 4.4], [8.8, -4.5, 5.2], body);
  color(body) hull() {
    translate([8.6, -5, 2.4]) scale([3.5, 3.2, 2.4]) sphere(1, $fn = 24);
    translate([8.6, -10, 1.6]) scale([3, 2.4, 1.6]) sphere(1, $fn = 20);
  }
  for (a = [-30, 0, 30]) spike([8.5 + sin(a) * 1.7, -12, 1.2], [sin(a) * 0.6, -1.4, -0.5], 0.5, 0.05, claw);
}

// ---- tail: fat, from the hips out to +X and up; the flame on its tip.
chain([[3, 2, 5.2], [10, 2.5, 4.6], [15, 2, 6.8], [18, 1.5, 11]], [3.6, 3.3, 2.8, 2.1], body);
flamePts = [[17.8, 25.3], [18.9, 24.5], [18.9, 22.8], [18.3, 22.6], [18.3, 21.4], [17.8, 21.4], [17, 20.3], [18.3, 20.1], [18.3, 18.9], [18.9, 18.8], [20.3, 20.7], [21, 20.7], [21, 18.2], [20.1, 18], [20.1, 15.3], [18.9, 13.2], [17.8, 13.2], [16.8, 11.6], [16, 13.8], [13.1, 15.1], [12.8, 14.5], [12.2, 14.7], [11.8, 16.1], [11.6, 15.5], [11.4, 17.2], [12.2, 17.4], [12.2, 18.8], [13.3, 18.9], [13.9, 20.7], [14.9, 20.9], [14.9, 22], [15.8, 22], [17.8, 24.1]];
flameMid = [[17.4, 22.5], [18.5, 20], [19.2, 17.5], [18.6, 14.6], [16.9, 12.7], [15.2, 14.1], [13.5, 15.5], [12.8, 17.5], [13.5, 19.8], [15.5, 21.5]];
flameCorePts = [[16, 19.3], [17.8, 18], [17.8, 15.3], [18.3, 14.9], [16.8, 13], [16, 14.5], [14.9, 14.5], [14.3, 13.8], [13, 14.5], [13.3, 15.9], [14.1, 16.1], [13.3, 16.6], [14.7, 17], [14.9, 18], [15.3, 17.8], [16, 19.1]];
pp(-7.2) {
  plate(flamePts, 2.2, 0.5, flameRed);
  plate(flameMid, 2.6, 0.6, flameOrange);
  plate(flameCorePts, 3.0, 0.5, flameCore);
}

// ---- back: lighter grey patches on the shoulder blades and hips (the sprite's back shading).
for (m = [[2, 5.5, 15, 2.6, 1.6], [-5, 4.5, 11, 2.2, 1.4], [6, 3.5, 7.5, 2.0, 1.3]])
  color(bodyHi) translate([m[0], m[1], m[2]]) scale([m[3], 0.6, m[4]]) sphere(1, $fn = 12);
