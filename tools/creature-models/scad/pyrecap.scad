// Pyrecap: Cindercap grown up. A squat red fire-toad under a two-tier spotted mushroom cap, charcoal shoulder masses
// billowing smoke, soot-black hands and feet with white claws, a fire in its belly and a flame on its tail.
//
// Checklist (front sheet, x = sheet x, z):
// - cap: upper tier x -14..7 z 34..40 red, tan gills under it z 32..35; lower tier x -17..9 z 27..33.5 red, tan gills
//   z 26..28; both puffy domes with rounded rims, peach-orange irregular spots (about 6 per tier in view). The cap sits
//   over the face (centre x -4), so it is set forward on the head.
// - face (x -11..3, z 19.5..27, under the brim): broad red head, two tall yellow-orange eyes close together right
//   under the brim (near one x -4..-2 with a big white highlight, far one x -7), a dark grin line rising to the right
//   with a white fang poking up from the lower jaw (x -4..-2.5, z 21.5..23.5), a darker lower jaw.
// - charcoal masses beside / behind the head (x -17..-8 and 2..13, z 17..28) with a glowing yellow ember each
//   (x -14 and 8.3, z 24); soft grey smoke billowing up and out above them (x -21..-12 and 9..21, z 25..34).
// - arms: red upper arms, black forearms / hands with three big white claws; the viewer's left hand is flung out
//   (x -21..-16, z 10..17), the right one held in front (x 6..14, z 9..16).
// - legs: big red thighs (x -14..-5 and 4..13, z 6..13) with orange patches, black feet with white claws, wide stance.
// - belly: a fire, yellow core (x -7.6..2, z 8.7..18.6) inside orange, tongues to the chin, red only at the tips.
// - tail: out to the right and up (x 12..17, z 7..15) into a flame tip (x 16..22, z 14..24).
// - back: orange-red body, a dark soot collar under the cap, the tail's pale yellow underside, the cap spots.
include <lib.scad>

body = [0.8, 0.15, 0.1];
jawRed = [0.64, 0.1, 0.08];
patchOr = [0.95, 0.34, 0.07, NOGLOW];
soot = [0.17, 0.17, 0.18];
coal = [0.22, 0.22, 0.23];
smokeDk = [0.3, 0.3, 0.31];
smokeMd = [0.45, 0.44, 0.43];
smokeLt = [0.6, 0.59, 0.57];
capRed = [0.86, 0.13, 0.1];
spot = [0.99, 0.66, 0.3, NOGLOW];
gill = [0.8, 0.68, 0.52];
cream = [0.96, 0.86, 0.5, NOGLOW];
flameTip = [0.93, 0.2, 0.05];
flameOut = [0.98, 0.4, 0.05, NOGLOW];
flameMid = [1, 0.6, 0.08, NOGLOW];
flameCore = [1, 0.86, 0.28, GLOW];
ember = [1, 0.82, 0.3, GLOW];
eyeY = [1, 0.84, 0.25, NOGLOW];
eyeO = [1, 0.55, 0.06, NOGLOW];
claw = [0.94, 0.94, 0.92];
dark = [0.08, 0.05, 0.05];

// Flat colour patch lying on the ellipsoid (radii r, centre c) at azimuth az (0 = straight back, +Y) and elevation el.
module patchOn(r, c, az, el, s, col) {
  color(col) translate(c + [r[0] * sin(az) * cos(el), r[1] * cos(az) * cos(el), r[2] * sin(el)])
    rotate([0, 0, -az]) rotate([el, 0, 0]) scale([s, s * 0.3, s * 0.8]) sphere(1, $fn = 10);
}

// A soft tapered flame tongue from p along d: a bright orange body narrowing in two steps, red only at the rounded tip.
module tongue(p, d, r, c = flameMid) {
  color(c) hull() {
    translate(p) sphere(r, $fn = 14);
    translate(p + d * 0.45) sphere(r * 0.62, $fn = 12);
  }
  color(flameOut) hull() {
    translate(p + d * 0.44) sphere(r * 0.58, $fn = 12);
    translate(p + d * 0.76) sphere(r * 0.32, $fn = 10);
  }
  color(flameTip) hull() {
    translate(p + d * 0.74) sphere(r * 0.3, $fn = 10);
    translate(p + d) sphere(r * 0.12, $fn = 8);
  }
}

// ---- Torso (squat, wide) with the belly fire painted flush on its front.
TORSO = [[[8, 7, 6.5], [0, 0, 10]], [[7, 6, 5], [0, -0.5, 16]]];
module torso(g = 0) hull() for (e = TORSO) translate(e[1]) scale(e[0] + [g, g, g]) sphere(1, $fn = 24);
color(body) torso();
// Belly fire outline in the scad's own frame (x, z), projected along -Y onto the belly.
FIRE = [[-6, 11], [-5.6, 8.6], [-3.6, 6.9], [0, 6.3], [3.6, 6.9], [5.6, 8.6], [6, 11], [6.2, 13], [7, 16.4], [5, 14.8],
        [4.2, 17.4], [4.6, 19.6], [2.4, 17.1], [1.1, 18.4], [0.4, 21], [-1, 18.3], [-2.6, 17.3], [-3.8, 19.8],
        [-4.4, 16.5], [-5.6, 15.1], [-7, 17], [-6.4, 13.4]];
function shrink(pts, s, c = [0, 9.5]) = [for (p = pts) [c[0] + (p[0] - c[0]) * s, c[1] + (p[1] - c[1]) * s]];
module fireLayer(pts, g, c) color(c) intersection() {
  torso(g);
  translate([0, -10, 0]) rotate([90, 0, 0]) linear_extrude(height = 20, center = true) polygon(pts);
}
fireLayer(FIRE, 0.25, flameOut);
fireLayer(shrink(FIRE, 0.8), 0.45, flameMid);
fireLayer(shrink([[-5.5, 10], [-4.6, 8], [-2.6, 7], [0, 6.8], [2.6, 7], [4.6, 8], [5.5, 10], [5.6, 12.5], [4.2, 15],
                  [3.6, 13.6], [2.2, 16.4], [0.6, 15], [-0.4, 18], [-1.8, 15.2], [-3.2, 16.6], [-4, 14], [-5.2, 13]], 0.78), 0.65, flameCore);

// ---- Head: broad, set forward under the cap, a darker lower jaw, a grin with two fangs.
HEAD = [[[7.4, 5.6, 4.4], [0, -5, 23.5]], [[6, 4.6, 3.2], [0, -7.5, 22.2]]];
blob(HEAD, body);
ell([5, 3.6, 2.2], [0, -8.6, 21], jawRed);
// Grin: a dark band laid on the snout's surface, rising to the corners.
color(dark) intersection() {
  translate([0, -7.5, 22.2]) scale([6.25, 4.85, 3.45]) sphere(1, $fn = 28);
  union() for (k = [-1, 1]) translate([0, 0, 21.7]) rotate([0, k * -14, 0]) translate([k > 0 ? -0.3 : -7.7, -20, -0.28]) cube([8, 20, 0.56]);
}
mirror_x() spike([2.2, -11.3, 21.1], [0, -0.3, 1.9], 0.7, 0.08, claw);
// Eyes: tall yellow-orange, close together right under the brim, a fierce lid and a big highlight.
mirror_x() eye([2.7, -9.7, 24.2], 2.0, iris = eyeO, sclera = eyeY, pupil = dark, yaw = 10, lid = 0.28, lid_tilt = 26,
               lid_c = body, slit = 0.35, shine = true);

// ---- Two-tier mushroom cap, set forward over the face and tipped back a little.
CAP = [0, -4.5, 28.4];
CAP_TILT = -11;
module dome(r) scale(r) difference() {
  sphere(1, $fn = 30);
  translate([0, 0, -1.2]) cube(2.4, center = true);
}
// Irregular spot: two overlapping flat discs lying on the dome (radii R, R, H) at azimuth az, elevation el.
module spots(R, H, list) for (s = list) {
  az = s[0]; el = s[1]; r = s[2];
  p = [R * cos(el) * cos(az), R * cos(el) * sin(az), H * sin(el)];
  color(spot) translate(p) rotate([0, 0, az]) rotate([0, 90 - atan2(sin(el) * R / H, cos(el)), 0]) {
    scale([1, 1, 0.3]) sphere(r, $fn = 10);
    translate([r * 0.5, r * 0.45, 0]) scale([0.75, 0.7, 0.28]) sphere(r, $fn = 8);
  }
}
translate(CAP) rotate([CAP_TILT, 0, 0]) {
  // lower tier: rounded red rim over tan gills
  color(gill) translate([0, 0, -0.8]) scale([11.8, 11.8, 1.9]) sphere(1, $fn = 30);
  color(capRed) scale([13, 13, 1.5]) sphere(1, $fn = 30);
  color(capRed) dome([13, 13, 4.6]);
  spots(13, 4.6, [[-150, 14, 1.9], [-120, 24, 1.7], [-90, 12, 1.9], [-60, 22, 1.7], [-30, 12, 1.8], [0, 20, 1.7],
                  [40, 14, 1.8], [80, 20, 1.7], [120, 12, 1.8], [160, 22, 1.7], [-178, 26, 1.5]]);
  // upper tier
  translate([0, 0, 4.9]) {
    color(gill) translate([0, 0, -0.6]) scale([9.6, 9.6, 1.7]) sphere(1, $fn = 28);
    color(capRed) scale([10.5, 10.5, 1.4]) sphere(1, $fn = 28);
    color(capRed) dome([10.5, 10.5, 6.2]);
    spots(10.5, 6.2, [[-140, 18, 1.6], [-100, 24, 1.6], [-60, 20, 1.6], [-20, 24, 1.5], [30, 20, 1.5], [90, 24, 1.5],
                      [150, 20, 1.5], [-120, 55, 1.4], [-50, 52, 1.4], [40, 55, 1.3], [140, 55, 1.3], [0, 85, 1.3]]);
  }
}

// ---- Charcoal masses round the shoulders and neck, each with a glowing ember, and the smoke billowing off them.
color(coal) hull() {
  translate([0, 3, 23]) scale([7, 4, 3.4]) sphere(1, $fn = 24);
  translate([0, 1.5, 20]) scale([7, 4.5, 3]) sphere(1, $fn = 24);
}
mirror_x() {
  blob([[[5, 4.5, 4.6], [10.5, -1.5, 22]], [[4, 4, 3.6], [7, 0.8, 24]]], coal);
  // lumps on the charcoal so it reads as a soft heap, not a ball
  for (b = [[12.5, -3.8, 20.2, 2.4], [9, -4.6, 21.5, 2], [13.8, -1, 24.6, 2.5]]) color(soot) translate([b[0], b[1], b[2]]) scale([1, 0.85, 0.9]) sphere(b[3], $fn = 14);
  // ember: an upward tongue of glow on the front of the charcoal
  color(ember) hull() {
    translate([11.3, -5.6, 23]) scale([1.2, 0.5, 0.7]) sphere(1, $fn = 12);
    translate([11.1, -5.4, 25.2]) sphere(0.15, $fn = 6);
  }
  // smoke: a soft core with big overlapping lobes, dark low, pale high
  color(smokeDk) {
    hull() {
      translate([15, -0.8, 26]) scale([3.6, 3, 2.8]) sphere(1, $fn = 15);
      translate([18, -0.4, 28]) scale([3.2, 2.8, 2.6]) sphere(1, $fn = 15);
    }
    for (b = [[14, -1.4, 24.6, 3], [17.6, -0.6, 25.6, 2.8]]) translate([b[0], b[1], b[2]]) scale([1, 0.85, 0.9]) sphere(b[3], $fn = 14);
  }
  color(smokeMd) {
    hull() {
      translate([16, -0.3, 29.2]) scale([3.4, 2.8, 2.4]) sphere(1, $fn = 15);
      translate([19.5, 0, 29.6]) scale([2.6, 2.4, 2.2]) sphere(1, $fn = 15);
    }
    for (b = [[13, -0.2, 28.8, 2.8], [21.2, 0.2, 28.4, 2]]) translate([b[0], b[1], b[2]]) scale([1, 0.85, 0.9]) sphere(b[3], $fn = 14);
  }
  color(smokeLt) {
    hull() {
      translate([15.8, 0.1, 30.6]) scale([3, 2.5, 2.1]) sphere(1, $fn = 16);
      translate([19.6, 0.3, 30.7]) scale([2.1, 2, 1.8]) sphere(1, $fn = 16);
    }
    translate([13.4, 0.2, 30.3]) scale([2, 1.8, 1.7]) sphere(1, $fn = 14);
  }
}

// ---- Arms: red upper arms, soot forearms and hands with three big white claws.
// The creature's right (-X, the viewer's left) is flung out and down; its left is held in front, claws up.
limb([-8, -1, 18], [-15.6, -2.4, 14.6], 2.4, 2.1, body);
limb([-15.6, -2.4, 14.6], [-18, -4, 12.6], 2.2, 2.4, soot);
ell([2.5, 2.3, 2.7], [-18.6, -4.4, 12], soot);
for (a = [-1, 0, 1]) spike([-19.6 + a * 0.5, -5.2 - a * 1.3, 10.4 - a * 0.9], [-1.4, -0.9 - a * 0.5, -1.9], 0.72, 0.06, claw);
limb([8, -1, 18], [14.5, -2.5, 15.5], 2.4, 2.1, body);
limb([14.5, -2.5, 15.5], [15.5, -6.2, 12.8], 2.2, 2.4, soot);
ell([2.5, 2.4, 2.6], [15.4, -7, 12.4], soot);
for (a = [-1, 0, 1]) spike([14.8 + a * 1.2, -8.6, 13.4 + a * 0.4], [-1.1, -1, 1.9], 0.72, 0.06, claw);
// orange patches on the upper arms
patchOn([2.2, 2.2, 2.2], [11.5, -2, 17], -150, 20, 1.5, patchOr);
patchOn([2.2, 2.2, 2.2], [-11.5, -1.6, 16.8], 150, 20, 1.4, patchOr);

// ---- Legs: big red thighs with orange patches, soot feet with white claws, a wide stance.
mirror_x() {
  ell([4.2, 4.6, 4.3], [9.3, -1.5, 8.5], body);
  patchOn([4.2, 4.6, 4.3], [9.3, -1.5, 8.5], 205, 5, 2, patchOr);
  patchOn([4.2, 4.6, 4.3], [9.3, -1.5, 8.5], 120, 25, 1.5, patchOr);
  blob([[[3.2, 4.6, 2.5], [11, -3.6, 2.5]], [[2.6, 2.6, 2.2], [10.4, 0, 2.6]]], soot);
  for (a = [-1, 0, 1]) spike([11 + a * 1.6, -7.6, 1.3], [a * 0.5, -1.7, -0.6], 0.62, 0.06, claw);
}

// ---- Tail: out to the right and back, curling up into a flame; a pale yellow underside.
TAIL = [[4, 4.5, 8], [10, 7.5, 6.2], [15, 6.6, 7.2], [17.8, 4.4, 10.4], [18.5, 3, 14]];
chain(TAIL, [3.3, 2.8, 2.3, 1.9, 1.6], body);
chain([[10, 8, 4.4], [15, 7.1, 5.4], [18.2, 4.9, 9.4]], [1.9, 1.6, 1.2], cream);
// Tail flame: a soft teardrop of orange with a yellow heart, licking up into a few tongues, red only at the tips.
color(flameOut) hull() {
  translate([18.5, 3, 15.8]) scale([3, 2.7, 2.6]) sphere(1, $fn = 15);
  translate([18.4, 2.9, 19.6]) sphere(2.1, $fn = 14);
}
tongue([18.3, 2.9, 19.4], [0.3, -0.2, 5.4], 2.0);
tongue([20, 3, 18.6], [2.2, 0.3, 3.4], 1.5);
tongue([16.8, 3, 18.6], [-2.2, 0.3, 3.2], 1.5);
tongue([18.6, 1.4, 18.8], [0.5, -1.4, 2.8], 1.3);
color(flameMid) translate([18.5, 1.6, 16.6]) scale([2.3, 1.5, 2.8]) sphere(1, $fn = 14);
color(flameCore) hull() {
  translate([18.5, 0.9, 15.6]) scale([1.6, 0.9, 1.5]) sphere(1, $fn = 12);
  translate([18.6, 1.1, 18.8]) sphere(0.4, $fn = 8);
}
