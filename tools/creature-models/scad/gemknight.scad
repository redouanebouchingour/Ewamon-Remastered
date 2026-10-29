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
//   - light burst: a ragged corona of pink / orange / yellow flames behind the helm and pauldrons (x -8.5..10,
//     z 28..39.5); thin coloured streaks radiating, the thickest bundle behind the blade (x -20..-9, z 6.5..15)
//   - back: the cape covers the whole back (vertical stripes, a dark collar), the helm's round back, the shield's
//     edge on the +X side, the blade on the -X side
// Colours: armour #96bada [0.59, 0.73, 0.86] with pale facets #dcf3f7 [0.86, 0.95, 0.97] and cyan #a9e0e5 [0.66, 0.88,
// 0.90], darker plates #8795c3 [0.53, 0.58, 0.77], seams / joints M8 [0.17, 0.23, 0.31], sabaton shade M1 [0.38, 0.41,
// 0.46]. Cape / burst: pink M3, orange M7 (GLOWS in the sprite: GLOW), yellow M5, green M6, lavender M4, cyan M2, blue
// M0. Only the orange glows; every other bright colour is NOGLOW.
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
blue = [0.53, 0.58, 0.77];
rainbow = [pink, orange, yellow, green, cyan, blue, lavender];

module facet(r, p, c, fn = 8, rot = [0, 0, 0]) { color(c) translate(p) rotate(rot) scale(r) sphere(1, $fn = fn); }

// ---------------------------------------------------------------- torso
module torso() {
  // Chest and waist, a little deeper at the top.
  blob([[[3.5, 2.5, 3.0], [0, 0.2, 28.4]], [[3.0, 2.2, 2.0], [0, 0, 24.0]]], armour);
  // Breastplate: two pale facets either side of a dark centre seam, a pale upper plate, two abdominal lames.
  mirror_x() facet([1.8, 1.0, 2.9], [1.45, -1.75, 27.6], armourLight, 7, [0, 0, -18]);
  color(joint) translate([0, -2.45, 27.4]) scale([0.22, 0.4, 3.0]) sphere(1, $fn = 6);
  facet([3.0, 1.3, 1.1], [0, -1.4, 30.0], armourCyan, 8);
  for (z = [24.4, 22.9]) {
    facet([2.8, 1.5, 0.75], [0, -1.15, z], armourLight, 8);
    color(joint) translate([0, -0.5, z - 0.75]) scale([2.85, 2.0, 0.22]) sphere(1, $fn = 14);
  }
  // Rainbow glints on the plate.
  for (g = [[-1.6, 29.2, 1], [1.7, 28.4, 0], [-1.0, 26.0, 3], [2.0, 25.6, 6], [0.8, 30.3, 2], [-2.2, 27.2, 0]])
    color(rainbow[g[2]]) translate([g[0], -2.55 + abs(g[0]) * 0.25, g[1]]) scale([0.55, 0.3, 0.32]) sphere(1, $fn = 6);
  // Dark belt and the tassets: a skirt of plates, pale fronts, a pointed centre plate.
  color(joint) translate([0, 0, 21.6]) scale([3.1, 2.4, 0.7]) sphere(1, $fn = 16);
  blob([[[3.4, 2.5, 1.4], [0, 0, 20.4]], [[3.6, 2.6, 1.2], [0, 0.1, 17.6]]], armour);
  facet([1.0, 0.6, 2.9], [0, -2.3, 18.2], armourLight, 6);
  mirror_x() {
    facet([1.5, 0.7, 2.3], [2.15, -1.75, 18.3], armourLight, 6, [0, 0, -30]);
    facet([1.1, 1.6, 2.1], [3.4, 0.2, 18.2], armourCyan, 6);
  }
  // Pauldrons: a big faceted dome, a pale cap, a darker lower lame; the dark gorget under the helm.
  mirror_x() {
    facet([2.9, 2.7, 2.4], [5.3, 0.5, 31.4], armour, 8);
    facet([2.4, 2.1, 1.3], [5.4, 0.1, 32.9], armourLight, 7);
    facet([1.9, 1.0, 1.4], [5.6, -1.8, 31.0], armourCyan, 6);
    facet([2.7, 2.5, 0.9], [5.7, 0.5, 29.3], armourDark, 9);
  }
  color(joint) translate([0.3, 0, 31.3]) scale([2.5, 2.3, 1.1]) sphere(1, $fn = 14);
}

// ---------------------------------------------------------------- helm
H = [0.6, -0.3, 35.4];
module helmShell(g = 0) {
  hull() {
    translate(H) scale([1, 1, 1.07]) sphere(3.0 + g, $fn = 30);
    translate([H[0], H[1], 31.9]) scale([2.75 + g, 2.75 + g, 1.0]) sphere(1, $fn = 30);
  }
}
module helm(eyeC = cyan) {
  color(armour) helmShell();
  // Pale front of the dome and the face guard (the light faces of the sprite).
  color(armourLight) intersection() { helmShell(0.12); translate([H[0] - 2.4, H[1] - 6, 35.0]) cube([4.6, 5.0, 2.8]); }
  color(armourLight) intersection() { helmShell(0.12); translate([H[0] - 1.9, H[1] - 6, 31.0]) cube([3.6, 4.4, 3.0]); }
  // Visor slit across the face, eye glints in it.
  color(joint) intersection() { helmShell(0.2); translate([H[0] - 2.8, H[1] - 6, 34.0]) cube([5.6, 5.2, 0.85]); }
  mirror_x() color(eyeC) translate([H[0] * 0 + 0.85, H[1] - 3.05, 34.45]) scale([0.55, 0.25, 0.3]) sphere(1, $fn = 8);
  // Breathing slots on the face guard and the nasal bar between them.
  for (x = [-1.1, 0, 1.1]) color(joint) intersection() { helmShell(0.22); translate([H[0] + x - 0.17, H[1] - 6, 31.7]) cube([0.34, 4.5, 1.8]); }
  // Chin edge and a crest line over the dome.
  color(joint) intersection() { helmShell(0.18); translate([H[0] - 3, H[1] - 6, 31.0]) cube([6, 6.2, 0.35]); }
  color(armourDark) translate(H + [0, 0.2, 3.05]) scale([0.45, 2.6, 0.45]) sphere(1, $fn = 8);
}

// ---------------------------------------------------------------- legs
module leg(hip, knee, ankle, toe) {
  color(joint) translate(hip) sphere(1.5, $fn = 12);
  limb(hip, knee, 2.0, 1.75, armour);
  facet([1.3, 0.8, 1.9], (hip + knee) / 2 + [0, -1.5, 0], armourLight, 6);
  facet([1.6, 1.5, 1.5], knee + [0, -0.7, 0], armourLight, 7);          // knee cop
  limb(knee, ankle, 1.7, 1.45, armour);
  facet([1.15, 0.7, 2.2], (knee + ankle) / 2 + [0, -1.25, 0], armourLight, 6);
  // Sabaton: a pointed plated shoe, its dark sole on the ground line.
  blob([[[1.6, 1.6, 1.2], ankle + [0, 0, -2.0]], [[1.0, 0.9, 0.7], toe + [0, 0, 0.3]]], armourCyan);
  facet([1.3, 1.2, 0.8], ankle + [0, -0.3, -1.4], armourLight, 7);
  color(steel) hull() { translate(ankle + [0, 0, -3.2]) scale([1.5, 1.5, 0.3]) sphere(1, $fn = 10); translate(toe + [0, 0, -0.6]) scale([0.9, 0.8, 0.3]) sphere(1, $fn = 8); }
}

// ---------------------------------------------------------------- sword arm (far, -X) and the blade
// The blade is traced flat in the picture plane so its outline is the art's (a long tapering crystal slab).
bladePts = [[-9.05, 20.45], [-7.75, 19.35], [-17.6, 8.7], [-20.4, 6.8], [-18.9, 9.8]];
module swordArm(bladeC = cyan, edgeC = armourLight, guardC = [orange, yellow, green], glints = true) {
  sh = [-5.3, 0.5, 30.2];
  el = [-7.4, -0.6, 25.6];
  hd = [-7.7, -2.2, 20.3];
  limb(sh, el, 1.6, 1.5, armour);
  facet([1.2, 0.8, 1.7], (sh + el) / 2 + [-0.4, -1.1, 0], armourLight, 6);
  facet([1.5, 1.4, 1.3], el, armourCyan, 8);                                       // elbow cop
  limb(el, hd + [0, 0, 1.3], 1.5, 1.75, armour);
  facet([1.85, 1.5, 1.2], hd + [0, 0, 1.6], armourLight, 7);                       // gauntlet cuff
  facet([1.5, 1.4, 1.3], hd, armourDark, 8);                                       // fist
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
// Facet tints per triangle (boss to each rim edge): pale, with the art's rainbow patches.
module shieldArm(rimC = armourDark, faceC = armourLight, tints = [pink, armourCyan, yellow, armour, lavender, green], boss = false,
                 bossC = undef, bossRimC = undef) {
  sh = [5.3, 0.5, 30.2];
  el = [8.6, -0.2, 26.4];
  hd = [11.4, 0.6, 23.4];
  limb(sh, el, 1.6, 1.5, armour);
  facet([1.5, 1.4, 1.3], el, armourCyan, 8);
  limb(el, hd, 1.5, 1.6, armour);
  pp(SD) {
    plate(kite, 1.2, 0.5, rimC);
    translate([0, -0.45, 0]) color(faceC) rotate([90, 0, 0]) linear_extrude(height = 0.5, center = true) offset(delta = -0.9) polygon(kite);
    for (i = [0 : 5]) {
      a = kite[i]; b = kite[(i + 1) % 6];
      color(tints[i]) translate([0, -0.75, 0]) rotate([90, 0, 0]) linear_extrude(height = 0.3, center = true)
        offset(delta = -0.4) polygon([kc + (a - kc) * 0.2, a * 0.84 + kc * 0.16, (a + b) / 2 * 0.84 + kc * 0.16]);
      // The cut lines from the centre to each corner (dark seams).
      color(rimC) translate([0, -0.8, 0]) rotate([90, 0, 0]) linear_extrude(height = 0.3, center = true)
        hull() { translate(kc) circle(0.16, $fn = 6); translate(a * 0.9 + kc * 0.1) circle(0.16, $fn = 6); }
    }
    if (boss) {
      color(bossRimC) translate([kc[0], -0.7, kc[1]]) rotate([90, 0, 0]) cylinder(h = 0.8, r = 2.6, $fn = 24);
      color(faceC) translate([kc[0], -1.0, kc[1]]) rotate([90, 0, 0]) cylinder(h = 0.8, r = 1.9, $fn = 22);
      color(bossRimC) translate([kc[0], -1.3, kc[1]]) rotate([90, 0, 0]) cylinder(h = 0.8, r = 1.45, $fn = 20);
      color(bossC) translate([kc[0], -1.6, kc[1]]) scale([1, 0.6, 1]) sphere(1.05, $fn = 16);
    }
  }
}

// ---------------------------------------------------------------- cape
// One continuous sheet: columns from the left edge (t = 0) to the right edge (t = 1), each [collar, billow, hem]
// read off the front sheet as [sheet x, z, scad depth y]; neighbouring columns are hulled into quads so the sheet
// has no gaps, and each quad takes the next stripe colour.
capeKeys = [
  [[-5.8, 30.3, 1.4], [-19.6, 28.4, 1.0], [-20.3, 18.6, 1.2]],
  [[-4.6, 30.8, 2.4], [-16.0, 24.5, 2.6], [-17.0, 17.6, 2.6]],
  [[-3.0, 31.0, 3.2], [-11.5, 20.5, 4.0], [-12.6, 13.0, 4.0]],
  [[-1.0, 31.2, 3.6], [-6.0, 18.5, 5.0], [-6.0, 9.8, 5.0]],
  [[1.0, 31.2, 3.6], [1.0, 17.5, 5.6], [1.4, 7.7, 5.6]],
  [[3.0, 31.0, 3.2], [7.0, 18.5, 5.6], [9.0, 9.4, 5.6]],
  [[4.6, 30.8, 2.4], [13.0, 19.5, 5.0], [16.0, 7.4, 4.6]],
  [[5.8, 30.3, 1.4], [18.6, 20.0, 3.4], [19.4, 9.0, 3.0]]
];
SUB = 4;
function capePt(i, row) =
  let(k = floor(i / SUB), u = (i % SUB) / SUB,
      a = capeKeys[min(k, len(capeKeys) - 1)][row], b = capeKeys[min(k + 1, len(capeKeys) - 1)][row],
      s = a + (b - a) * u)
  fromSheet(s[0], s[1], s[2]);
module cape(cols = rainbow, lining = armourDark, curl = true) {
  n = (len(capeKeys) - 1) * SUB;
  for (i = [0 : n - 1]) for (row = [0 : 1]) color(cols[i % len(cols)]) hull() {
    for (j = [i, i + 1]) for (r = [row, row + 1]) translate(capePt(j, r)) sphere(0.28, $fn = 6);
  }
  // The steel-blue lining rolls over along the left lobe's top edge.
  if (curl) {
    chain([fromSheet(-6.5, 30.2, 1.6), fromSheet(-12.5, 29.2, 1.2), fromSheet(-17.0, 28.9, 0.8), fromSheet(-19.9, 27.6, 0.8)],
          [0.7, 0.9, 1.0, 0.8], lining);
    color(armourCyan) hull() { translate(fromSheet(-19.6, 25.0, 0.6)) sphere(0.6, $fn = 8); translate(fromSheet(-19.8, 20.0, 0.6)) sphere(0.5, $fn = 8);
      translate(fromSheet(-16.0, 23.2, 2.0)) sphere(0.5, $fn = 8); }
  }
  // Dark collar across the shoulders behind the helm.
  color(joint) hull() for (x = [-4.6, 4.6]) translate([x, 1.8, 30.9]) scale([1.2, 1.0, 0.7]) sphere(1, $fn = 10);
}

// ---------------------------------------------------------------- light burst
// A ragged corona of flames behind the helm (three layers, outer pink, orange, inner yellow) and thin streaks.
function star(c, rs, a0, a1, n) = [for (i = [0 : n]) let(a = a0 + (a1 - a0) * i / n, r = rs[i % len(rs)]) c + r * [cos(a), sin(a)]];
coronaR = [9.0, 5.6, 8.0, 5.0, 9.6, 5.4, 7.4, 5.2, 8.6, 5.0, 7.8, 5.6];
module burst(layers = [pink, orange, yellow], streakCols = rainbow) {
  for (l = [0 : 2]) pp(8 - l * 0.4) color(layers[l]) rotate([90, 0, 0]) linear_extrude(height = 0.4, center = true)
    polygon(concat([[1.0, 27.5]], star([1.0, 28.8], coronaR * (1 - l * 0.2), -8, 188, 24)));
  // Streaks: [angle (deg, 0 = right), from radius, length] round a centre behind the chest; many low-left.
  spec = [[198, 10.5, 9], [203, 12, 8], [208, 9.5, 10], [213, 13, 7], [218, 11, 9], [223, 14, 6], [196, 15, 6],
          [228, 12, 6], [160, 14, 5], [150, 15, 4], [118, 15, 4], [100, 15.5, 3], [62, 15.5, 3.5], [40, 15, 4],
          [20, 16, 4], [-12, 17, 3], [-30, 16, 4]];
  for (i = [0 : len(spec) - 1]) {
    a = spec[i][0]; r0 = spec[i][1]; L = spec[i][2];
    pp(9) color(streakCols[i % len(streakCols)]) translate([0.5, 0, 22]) rotate([0, -a, 0])
      translate([r0, 0, 0]) rotate([90, 0, 0]) linear_extrude(height = 0.3, center = true) polygon([[0, -0.3], [L, -0.12], [L, 0.12], [0, 0.3]]);
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
