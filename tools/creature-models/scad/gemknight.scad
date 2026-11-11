// Gemknight: a knight in pale silver-blue crystal plate with a round great helm, a kite shield of cut crystal on its
// near (+X) arm, a long crystal blade held low and out on its far (-X) arm, a pastel-rainbow cape billowing out to
// both sides behind it and a burst of rainbow light behind the helm and the blade.
//
// Checklist (front sheet, x = sheet x, z = sheet z; the soles stand on z ~2.8 over a grey ground shadow, which is not
// modelled: everything is built in the sheet's frame and lowered by G at the end, compare with --ground 2.8):
//   - helm: round great helm x -2.4..3.5, z 31..38.6; a dark visor slit at z ~34.3 with two cyan eye glints
//     (x -1.5..0.8), a face guard with dark vertical slots below (z 31.5..33.7), a crest line over the dome
//   - pauldrons: stacked faceted plates, the far one x -6.2..-1.7, z 29.4..34.3, the near one x 2.1..8.2,
//     z 27.6..34.3 (its lower half behind the shield); a dark gorget under the helm
//   - torso: breastplate x -3.5..4.4, z 22..31.4, pale facets split by dark seams, small rainbow glints;
//     dark belt at z 21.7; tassets x -3.7..5.5 down to z 16.2 with a pointed centre plate to z 15.3
//   - legs: wide stance. Far leg: hip (-1.5, 16.5), knee (-3.9, 12.4), ankle (-6, 6.5), sabaton toe (-8.9, 4).
//     Near leg: hip (2.6, 16.5), knee (4.6, 12.8), ankle (7.2, 6.5), sabaton x 5.7..9.5, z 3.1..7
//   - sword arm (far, -X): shoulder, elbow (-6.6, 25.6), gauntlet (-7.6, 19.8); rainbow crossguard; a flat crystal
//     blade 1.7 wide from (-8.4, 19.9) to the tip (-20.3, 7)
//   - shield (near, +X arm, faces the viewer): kite top (10.6, 33.6), right (16, 27) / (15.6, 20), bottom (10.6, 12.9),
//     left (6, 19.6) / (5, 27.2); pale crystal face cut into facets, some tinted pink / yellow / green / lavender
//   - cape: ONE sheet from the collar behind the pauldrons. Left lobe out to x -20.3 (z 18.6..28.5) with a dark
//     steel-blue curl along its top edge; hem in through (-17, 17.8), (-12.6, 13), (-6, 9.8), between the legs
//     (1.4, 7.7), out under the shield (9, 9.5), (16, 7.5) to the right tip (17.5, 6.8); right edge up (19.5, 9..14)
//     to (17, 22) behind the shield. Vertical pastel stripes: pink, orange, yellow, green, cyan, blue, lavender
//     Modelled as a cloth hanging BEHIND the knight (lead's note): its hem stops just under the knees and the near
//     side only flares a little behind the shield, so the legs stay clear in front of and below it.
//   - light burst: a ragged corona of pink / orange / yellow flames behind the helm and pauldrons (x -8.5..10,
//     z 28..39.5); thin coloured streaks radiating, the thickest bundle behind the blade (x -20..-9, z 6.5..15)
//   - back: the cape covers the whole back (vertical stripes, a dark collar), the helm's round back, the shield's
//     edge on the +X side, the blade on the -X side
// Colours: armour #96bada [0.59, 0.73, 0.86] with pale facets #dcf3f7 [0.86, 0.95, 0.97] and cyan #a9e0e5 [0.66, 0.88,
// 0.90], darker plates #8795c3 [0.53, 0.58, 0.77], seams / joints M8 [0.17, 0.23, 0.31], sabaton shade M1 [0.38, 0.41,
// 0.46]. Cape / burst: pink M3, orange M7 (GLOWS in the sprite: GLOW), yellow M5, green M6, lavender M4, cyan M2, blue
// M0. Only the corona's orange glows (the cape's does not); every other bright colour is NOGLOW.
include <lib.scad>

G = 2.8;   // the art's sole line; the model is lowered by it so the feet stand on z = 0

armour = [0.59, 0.73, 0.86, NOGLOW];
armourLight = [0.86, 0.95, 0.97, NOGLOW];
armourCyan = [0.66, 0.88, 0.90, NOGLOW];
armourDark = [0.53, 0.58, 0.77];
joint = [0.17, 0.23, 0.31];
steel = [0.38, 0.41, 0.46];
pink = [0.96, 0.55, 0.54, NOGLOW];
orange = [0.98, 0.79, 0.50, GLOW];
yellow = [0.98, 0.97, 0.58, NOGLOW];
green = [0.65, 0.96, 0.64, NOGLOW];
lavender = [0.82, 0.59, 0.91, NOGLOW];
cyan = [0.66, 0.88, 0.90, NOGLOW];
eyeCyan = [0.35, 0.82, 0.96, NOGLOW];
spark = [0.95, 1.0, 1.0, NOGLOW];
blue = [0.53, 0.58, 0.77];
rainbow = [pink, orange, yellow, green, cyan, blue, lavender];
// The cape's orange does not glow (a glowing stripe washes to cream in game); only the corona's orange does.
capeOrange = [0.98, 0.79, 0.50, NOGLOW];
capeCols = [pink, capeOrange, yellow, green, cyan, blue, lavender];

module facet(r, p, c, fn = 8, rot = [0, 0, 0]) { color(c) translate(p) rotate(rot) scale(r) sphere(1, $fn = fn); }

// ---------------------------------------------------------------- torso
module torso() {
  // Chest and waist: a broad, deep breastplate over a narrower waist.
  blob([[[4.4, 3.2, 3.4], [0, 0.2, 28.2]], [[3.7, 2.8, 2.3], [0, 0, 23.8]]], armour, $fn = 28);
  // Breastplate: two pale facets either side of a dark centre seam, a pale upper plate, two abdominal lames.
  mirror_x() facet([2.2, 1.1, 3.1], [1.75, -2.35, 27.6], armourLight, 14, [0, 0, -18]);
  color(joint) translate([0, -3.05, 27.4]) scale([0.24, 0.4, 3.1]) sphere(1, $fn = 8);
  facet([3.6, 1.5, 1.2], [0, -2.0, 30.0], armourCyan, 14);
  for (z = [24.2, 22.7]) {
    facet([3.4, 1.7, 0.8], [0, -1.6, z], armourLight, 14);
    color(joint) translate([0, -0.4, z - 0.8]) scale([3.5, 2.75, 0.24]) sphere(1, $fn = 18);
  }
  // Glints on the plate.
  for (g = [[-1.9, 29.2, 1], [2.0, 28.4, 0], [-1.2, 26.0, 3], [2.4, 25.6, 6], [0.9, 30.4, 2], [-2.6, 27.2, 0]])
    color(rainbow[g[2]]) translate([g[0], -3.2 + abs(g[0]) * 0.25, g[1]]) scale([0.6, 0.3, 0.35]) sphere(1, $fn = 6);
  // Belt and the tassets: a skirt of overlapping plates, pale fronts, a pointed centre plate.
  color(joint) translate([0, 0, 21.4]) scale([3.85, 3.0, 0.8]) sphere(1, $fn = 20);
  blob([[[4.0, 3.0, 1.5], [0, 0, 20.2]], [[4.3, 3.1, 1.3], [0, 0.1, 17.6]]], armour, $fn = 24);
  facet([1.2, 0.7, 3.0], [0, -2.9, 18.2], armourLight, 12);
  mirror_x() {
    facet([1.8, 0.8, 2.4], [2.6, -2.3, 18.3], armourLight, 12, [0, 0, -30]);
    facet([1.3, 1.9, 2.2], [4.1, 0.2, 18.2], armourCyan, 12);
  }
  // Pauldrons: a big round dome, a pale cap and two lames under it; the gorget under the helm.
  mirror_x() {
    facet([3.6, 3.4, 3.0], [6.2, 0.5, 31.6], armour, 18);
    facet([2.9, 2.7, 1.6], [6.2, 0.1, 33.3], armourLight, 16);
    facet([2.2, 1.1, 1.6], [6.4, -2.6, 31.0], armourCyan, 12);
    facet([3.3, 3.1, 1.0], [6.5, 0.5, 29.0], armourDark, 16);
    facet([3.0, 2.9, 0.9], [6.8, 0.5, 27.8], armour, 16);
  }
  color(joint) translate([0.3, 0, 31.4]) scale([3.0, 2.8, 1.2]) sphere(1, $fn = 16);
}

// ---------------------------------------------------------------- helm
H = [0.6, -0.3, 35.4];
module helmShell(g = 0) {
  hull() {
    translate(H) scale([1, 1, 1.07]) sphere(3.25 + g, $fn = 36);
    translate([H[0], H[1], 32.0]) scale([2.7 + g, 2.7 + g, 1.0]) sphere(1, $fn = 32);
  }
}
// The art turns the face a little towards the viewer (the creature's +X): the whole helm turns 22 deg round its axis.
HELM_TURN = 22;
module helm(eyeC = eyeCyan) {
  translate(H) rotate([0, 0, HELM_TURN]) translate(-H) helmFace(eyeC);
}
module helmFace(eyeC) {
  color(armour) helmShell();
  // Pale front of the dome and the face guard (the light faces of the sprite).
  color(armourLight) intersection() { helmShell(0.12); translate([H[0] - 2.4, H[1] - 6, 35.0]) cube([4.6, 5.0, 2.8]); }
  color(armourLight) intersection() { helmShell(0.12); translate([H[0] - 1.9, H[1] - 6, 31.0]) cube([3.6, 4.4, 3.0]); }
  // Visor slit across the face, eye glints in it.
  color(joint) intersection() { helmShell(0.2); translate([H[0] - 2.8, H[1] - 6, 34.0]) cube([5.6, 5.2, 0.85]); }
  // Eye glints in the slit: the near (+X) one a little bigger, as drawn; a white spark in each.
  for (e = [[0.95, 0.62], [-0.95, 0.5]]) {
    color(eyeC) translate([H[0] + e[0], H[1] - 3.2 + abs(e[0]) * 0.12, 34.45]) scale([e[1], 0.3, 0.34]) sphere(1, $fn = 10);
    color(spark) translate([H[0] + e[0] + 0.12, H[1] - 3.45 + abs(e[0]) * 0.12, 34.55]) scale([0.18, 0.12, 0.14]) sphere(1, $fn = 6);
  }
  // Breathing slots on the face guard.
  for (x = [-0.5, 0.5]) color(joint) intersection() { helmShell(0.22); translate([H[0] + x - 0.17, H[1] - 6, 31.7]) cube([0.34, 4.5, 1.8]); }
  // Chin edge and a crest line over the dome.
  color(joint) intersection() { helmShell(0.18); translate([H[0] - 3, H[1] - 6, 31.0]) cube([6, 6.2, 0.35]); }
  color(armourDark) translate(H + [0, 0.2, 3.35]) scale([0.5, 2.8, 0.5]) sphere(1, $fn = 8);
}

// ---------------------------------------------------------------- legs
kneeCopC = armourLight;
ankleC = armourLight;
module leg(hip, knee, ankle, toe) {
  color(joint) translate(hip) sphere(1.8, $fn = 14);
  limb(hip, knee, 2.6, 2.3, armour, $fn = 20);
  facet([1.9, 0.7, 2.2], (hip + knee) / 2 + [0, -2.2, 0], armourLight, 14);       // cuisse plate
  facet([2.3, 2.0, 2.0], knee + [0, -0.9, 0], kneeCopC, 16);                       // knee cop
  limb(knee, ankle, 2.2, 1.9, armour, $fn = 18);
  facet([1.6, 0.65, 2.6], (knee + ankle) / 2 + [0, -1.85, 0], armourLight, 14);   // greave plate
  // Sabaton: a pointed plated shoe, its dark sole on the ground line.
  blob([[[2.0, 2.0, 1.4], ankle + [0, 0, -2.0]], [[1.2, 1.1, 0.85], toe + [0, 0, 0.35]]], armour);
  facet([1.5, 1.4, 0.9], ankle + [0, -0.3, -1.3], ankleC, 12);
  color(steel) hull() { translate(ankle + [0, 0, -3.2]) scale([1.7, 1.7, 0.3]) sphere(1, $fn = 12); translate(toe + [0, 0, -0.6]) scale([1.0, 0.9, 0.3]) sphere(1, $fn = 8); }
}

// ---------------------------------------------------------------- sword arm (far, -X) and the blade
// The blade is traced flat in the picture plane so its outline is the art's (a long tapering crystal slab).
bladePts = [[-9.05, 20.45], [-7.75, 19.35], [-17.6, 8.7], [-20.4, 6.8], [-18.9, 9.8]];
module swordArm(bladeC = cyan, edgeC = armourLight, guardC = [orange, yellow, green], glints = true) {
  sh = [-5.3, 0.5, 30.2];
  el = [-7.4, -0.6, 25.6];
  hd = [-7.7, -2.2, 20.3];
  limb(sh, el, 2.0, 1.85, armour, $fn = 18);
  facet([1.5, 0.8, 1.9], (sh + el) / 2 + [-0.5, -1.55, 0], armourLight, 14);
  facet([1.95, 1.85, 1.6], el, armourCyan, 14);                                   // elbow cop
  limb(el, hd + [0, 0, 1.3], 1.85, 2.1, armour, $fn = 18);
  facet([2.25, 1.85, 1.4], hd + [0, 0, 1.7], armourLight, 14);                     // gauntlet cuff
  facet([1.75, 1.65, 1.5], hd, armourDark, 12);                                    // fist
  pp(1.6) {
    // Grip and pommel up the arm, the crossguard across the blade's root.
    color(joint) hull() { translate([-7.5, 0, 21.1]) sphere(0.45, $fn = 8); translate([-6.7, 0, 22.0]) sphere(0.45, $fn = 8); }
    color(armourDark) translate([-6.5, 0, 22.2]) sphere(0.75, $fn = 10);
    for (i = [0 : 2]) color(guardC[i]) translate([-9.1 + i * 0.95, -0.2, 21.2 - i * 0.9]) scale([0.7, 0.55, 0.55]) sphere(1, $fn = 8);
    translate([0, 0.2, 0]) plate(bladePts, 0.45, 0.2, bladeC, grow = 0.25);
    // Pale ridge down the blade's middle.
    color(edgeC) translate([0, -0.25, 0]) rotate([90, 0, 0]) linear_extrude(height = 0.2, center = true)
      polygon([[-8.6, 19.95], [-8.25, 19.75], [-18.6, 8.6], [-19.0, 8.75]]);
    if (glints) for (s = [[-11.2, 16.8, 0], [-13.8, 13.9, 2], [-16.4, 11.1, 6]])
      color(rainbow[s[2]]) translate([s[0], -0.35, s[1]]) rotate([0, 42, 0]) scale([0.3, 0.12, 1.1]) sphere(1, $fn = 6);
  }
}

// ---------------------------------------------------------------- shield arm (near, +X) and the kite shield
kite = [[10.6, 33.6], [16.0, 27.0], [15.6, 20.0], [10.6, 12.9], [6.0, 19.6], [5.0, 27.2]];
kc = [10.6, 24.2];
SD = -6.3;    // the shield's depth in front of the picture plane
// The shield is a cut crystal: a silver rim band round a raised face, the face a low pyramid on a vertical centre
// ridge (a lit left half, a shaded right half, as drawn), with bands of rainbow light lying on its facets.
kiteIn = [[10.6, 31.6], [14.2, 26.6], [13.8, 20.2], [10.6, 15.0], [7.0, 20.0], [6.5, 26.8]];
ridge = [[10.8, 30.8, -0.9], [10.8, 24.2, -1.15], [10.8, 16.2, -0.9]];   // [x, z, depth]
module shieldFace(d = 0) {
  hull() {
    translate([0, -0.55 - d, 0]) rotate([90, 0, 0]) linear_extrude(height = 0.2, center = true) polygon(kiteIn);
    for (r = ridge) translate([r[0], r[2] - d, r[1]]) sphere(0.15, $fn = 6);
  }
}
// Rainbow bands: [centre x, z, angle, length, band width, first colour, count]
shieldBands = [[9.4, 27.4, -40, 4.0, 0.62, 0, 5], [8.6, 22.4, -30, 3.6, 0.66, 0, 5], [12.0, 24.4, -60, 3.0, 0.6, 3, 3],
               [11.2, 18.4, -55, 3.8, 0.62, 0, 5], [14.5, 23.5, 80, 4.2, 0.5, 6, 3]];
module shieldArm(rimC = armourCyan, faceC = armourLight, bandCols = rainbow, seamC = joint, boss = false, bossC = undef, bossRimC = undef) {
  sh = [5.3, 0.5, 30.2];
  el = [8.6, -0.2, 26.4];
  hd = [11.4, 0.6, 23.4];
  limb(sh, el, 2.0, 1.85, armour, $fn = 18);
  facet([1.95, 1.85, 1.6], el, armourCyan, 14);
  limb(el, hd, 1.85, 2.0, armour, $fn = 18);
  pp(SD) {
    plate(kite, 1.1, 0.45, rimC);
    // The rim band's outer bevel on the right, in shade (the side the art turns away).
    color(armourDark) translate([0, -0.5, 0]) rotate([90, 0, 0]) linear_extrude(height = 0.3, center = true)
      polygon([[10.6, 33.2], [15.7, 27.0], [15.3, 20.0], [10.6, 13.4], [10.6, 15.0], [13.8, 20.2], [14.2, 26.6], [10.6, 31.6]]);
    color(faceC) shieldFace();
    // The seams: the face's edge and the centre ridge.
    color(seamC) translate([0, -0.62, 0]) rotate([90, 0, 0]) linear_extrude(height = 0.2, center = true)
      difference() { offset(delta = 0.22) polygon(kiteIn); polygon(kiteIn); }
    color(seamC) hull() for (r = [ridge[0], ridge[2]]) translate([r[0], r[2] - 0.05, r[1]]) sphere(0.14, $fn = 6);
    color(seamC) hull() for (r = [ridge[0], ridge[1]]) translate([r[0], r[2] - 0.05, r[1]]) sphere(0.14, $fn = 6);
    color(seamC) hull() for (r = [ridge[1], ridge[2]]) translate([r[0], r[2] - 0.05, r[1]]) sphere(0.14, $fn = 6);
    if (len(bandCols) > 0) for (b = shieldBands) for (k = [0 : b[6] - 1]) color(bandCols[(b[5] + k) % len(bandCols)]) intersection() {
      shieldFace(0.1);
      rotate([90, 0, 0]) linear_extrude(height = 20, center = true)
        translate([b[0], b[1]]) rotate(b[2]) translate([-b[3] / 2, (k - (b[6] - 1) / 2) * b[4] - b[4] * 0.47]) square([b[3], b[4] * 0.94]);
    }
    if (boss) {
      color(bossRimC) translate([10.8, -2.0, 24.2]) rotate([90, 0, 0]) cylinder(h = 0.6, r = 2.1, $fn = 24);
      color(faceC) translate([10.8, -2.4, 24.2]) rotate([90, 0, 0]) cylinder(h = 0.5, r = 1.55, $fn = 22);
      color(bossC) translate([10.8, -2.6, 24.2]) scale([1, 0.6, 1]) sphere(1.15, $fn = 16);
    }
  }
}

// The cape hangs from the shoulders BEHIND the knight as a curved cloth: a shallow arc behind the back (the middle
// furthest back), falling to just under the knees in the middle, its far (-X) edge blown out sideways into the lobe the
// front art draws high on the viewer's left, its near (+X) edge flaring a little behind the shield. Columns from the -X
// edge to the +X edge, each [collar, billow, hem] as scad [x, y, z] (z on the sheet, before the drop by G).
capeKeys = [
  [[-5.5, 2.4, 30.3], [-24.0, 4.0, 28.0], [-24.5, 4.6, 18.6]],
  [[-4.4, 3.0, 30.8], [-18.5, 4.8, 24.5], [-18.5, 5.2, 16.0]],
  [[-3.0, 3.4, 31.0], [-12.5, 5.2, 20.5], [-12.5, 5.5, 13.0]],
  [[-1.0, 3.6, 31.2], [-6.0, 5.6, 18.5], [-6.5, 6.0, 11.0]],
  [[1.0, 3.6, 31.2], [0.5, 5.8, 18.0], [0.5, 6.2, 10.5]],
  [[3.0, 3.4, 31.0], [5.5, 5.6, 18.5], [6.5, 6.0, 11.0]],
  [[4.4, 3.0, 30.8], [9.5, 5.0, 19.5], [11.0, 5.4, 11.0]],
  [[5.5, 2.4, 30.3], [12.5, 4.0, 21.0], [14.0, 4.4, 12.0]]
];
SUB = 4;
// Soft folds: the billow and the hem ripple in depth (one fold per key column), the collar does not.
FOLD = [0, 0.7, 1.1];
function capePt(i, row) =
  let(k = floor(i / SUB), u = (i % SUB) / SUB,
      a = capeKeys[min(k, len(capeKeys) - 1)][row], b = capeKeys[min(k + 1, len(capeKeys) - 1)][row],
      s = a + (b - a) * u)
  [s[0], s[1] + FOLD[row] * sin(i * 90), s[2]];
module cape(cols = capeCols, lining = armourDark, curl = true, cowlC = lavender) {
  n = (len(capeKeys) - 1) * SUB;
  // Broad stripes: each colour two quads wide, so the rainbow runs twice across the cape.
  for (i = [0 : n - 1]) for (row = [0 : 1]) color(cols[floor(i / 2) % len(cols)]) hull() {
    for (j = [i, i + 1]) for (r = [row, row + 1]) translate(capePt(j, r)) sphere(0.4, $fn = 6);
  }
  // The cowl: a lavender drape hanging in a V between the shoulder blades (the back art's collar fold).
  color(cowlC) hull() {
    for (x = [-4.4, 4.4]) translate([x, 3.8, 29.6]) scale([0.9, 0.5, 0.6]) sphere(1, $fn = 8);
    translate([0, 5.9, 23.4]) scale([0.8, 0.5, 0.6]) sphere(1, $fn = 8);
  }
  // The steel-blue lining rolls over along the left lobe's top edge.
  if (curl) {
    chain([[-6.5, 2.6, 30.2], [-12.5, 3.2, 29.6], [-18.5, 3.7, 28.9], [-24.0, 4.0, 28.0]], [0.7, 0.9, 1.0, 0.8], lining);
    color(armourCyan) hull() { translate([-23.6, 3.6, 25.0]) sphere(0.6, $fn = 8); translate([-23.9, 4.0, 20.0]) sphere(0.5, $fn = 8);
      translate([-19.0, 4.0, 23.2]) sphere(0.5, $fn = 8); }
  }
  // Dark collar across the shoulders behind the helm.
  color(joint) hull() for (x = [-4.6, 4.6]) translate([x, 2.6, 30.9]) scale([1.2, 1.0, 0.7]) sphere(1, $fn = 10);
}

// ---------------------------------------------------------------- light burst
// A ragged corona of flames behind the helm (three layers, outer pink, orange, inner yellow) and thin streaks.
function star(c, rs, a0, a1, n) = [for (i = [0 : n]) let(a = a0 + (a1 - a0) * i / n, r = rs[i % len(rs)]) c + r * [cos(a), sin(a)]];
coronaR = [10.2, 6.4, 9.2, 5.8, 11.0, 6.2, 8.5, 6.0, 9.9, 5.8, 9.0, 6.4];
module burst(layers = [pink, orange, yellow], streakCols = rainbow) {
  for (l = [0 : 2]) pp(8) color(layers[l]) rotate([90, 0, 0]) linear_extrude(height = 0.4 + l * 0.4, center = true)
    polygon(concat([[1.0, 27.5]], star([1.0, 28.8], coronaR * (1 - l * 0.17), -8, 188, 24)));
  // Streaks: [angle (deg, 0 = right), from radius, length] round a centre behind the chest; many low-left.
  spec = [[198, 10.5, 9], [203, 12, 8], [208, 9.5, 10], [213, 13, 7], [218, 11, 9], [223, 14, 6], [196, 15, 6],
          [228, 12, 6], [160, 14, 5], [150, 15, 4], [118, 15, 4], [100, 15.5, 3], [62, 15.5, 3.5], [40, 15, 4],
          [20, 16, 4], [-12, 17, 3], [-30, 16, 4]];
  for (i = [0 : len(spec) - 1]) {
    a = spec[i][0]; r0 = spec[i][1]; L = spec[i][2];
    w = (a > 190 && a < 235) ? 0.6 : 0.38;   // the bundle behind the blade is the broadest
    pp(9) color(streakCols[i % len(streakCols)]) translate([0.5, 0, 22]) rotate([0, -a, 0])
      translate([r0, 0, 0]) rotate([90, 0, 0]) linear_extrude(height = 0.3, center = true) polygon([[0, -w], [L, -0.14], [L, 0.14], [0, w]]);
  }
}

translate([0, 0, -G]) {
  torso();
  helm();
  leg(fromSheet(-1.6, 16.5, 0.4), fromSheet(-3.9, 12.6, -0.4), fromSheet(-6.0, 6.6, -0.4), fromSheet(-9.0, 3.4, -2.6));
  leg(fromSheet(2.6, 16.5, -0.2), fromSheet(4.7, 12.8, -1.0), fromSheet(7.2, 6.6, -1.0), fromSheet(9.4, 3.4, -2.2));
  swordArm();
  shieldArm();
  cape();
  burst();
}
