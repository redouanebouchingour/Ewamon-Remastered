// Gemknight (Tenjin form): the crystal knight turned holy. The same knight, pose and build as gemknight.scad (copied
// from it), in ivory plate with gold seams and trim, a dark visor with no eye glints, a thin gold halo standing behind
// the helm, a golden glowing blade, an ivory kite shield with a gold rim, gold cut lines and a pearl boss, and a long
// cream cape with an iridescent edge. No rainbow burst: a few motes of light float round it instead.
//
// Checklist (front sheet; the soles stand on z ~0.4, no ground shadow):
//   - the knight's body is the base model's, 3 % larger (the tenjin art draws it a little bigger): helm x -2.3..4.3,
//     z 30.3..37.5, dark visor slit z ~33.4 with a dark nasal drop, two dark slots on the face guard, gold crest
//   - halo: a thin gold ring standing behind the helm, centre (1.3, 35.7), rx 4.8, rz 4.2, 0.6 wide, pale gold, glows
//   - shield: kite top (12.4, 32.9), upper corners (5.4, 26.3) / (17.0, 26.0), lower corners (6.4, 16.4) / (17.0, 17.0),
//     bottom (12.1, 10.0); gold rim band, ivory face, gold cut lines from the boss (13.4, 21.8) to the corners, a gold
//     ring round a pearl gem
//   - blade: golden, from the guard (-8.4, 18.4) to the tip (-20.6, 4.0), 1.8 wide; gold crossguard
//   - cape: cream with mauve fold shading; left lobe out to x -20.5 (z 16.8..23.5), its top edge an iridescent pale
//     green band; hem down through (-12, 10.5), (-6, 6.5), (1, 5.2), under the shield (8.5, 6.4), (16.5, 4.8), up the
//     right edge (21, 9) behind the shield. Back: a cream cowl hanging in a V between the shoulders (z 22..28)
//   - motes: small pale yellow dots round the knight
// Colours: ivory M0 [0.89, 0.83, 0.78], light [0.97, 0.93, 0.84] / [0.99, 0.98, 0.93], shade M2 [0.71, 0.64, 0.62],
// gold [0.77, 0.65, 0.38] / light gold [0.93, 0.84, 0.54], dark gold M3 [0.52, 0.40, 0.24], visor [0.31, 0.27, 0.21],
// iridescent edge M4 [0.84, 0.96, 0.82]. Glows: the halo, the blade and the motes (pale gold); the rest NOGLOW.
include <lib.scad>

G = 2.8;    // the base art's sole line: the body below is the base's, lowered by it and scaled by S about the feet
S = 1.03;
GT = 0.4;   // this art's sole line: the parts traced off the tenjin sheet (halo, shield, blade, cape) are lowered by it

armour = [0.89, 0.83, 0.78, NOGLOW];
armourLight = [0.99, 0.98, 0.93, NOGLOW];
armourCyan = [0.97, 0.93, 0.84, NOGLOW];
armourDark = [0.71, 0.64, 0.62];
gold = [0.77, 0.65, 0.38, NOGLOW];
goldLight = [0.93, 0.84, 0.54, NOGLOW];
goldDark = [0.52, 0.40, 0.24];
joint = gold;                    // the base's dark seams, belt and gorget are gold here
visor = [0.31, 0.27, 0.21];
steel = [0.55, 0.50, 0.46];
iris = [0.84, 0.96, 0.82, NOGLOW];   // the cape's iridescent edge
cream = [0.97, 0.93, 0.84, NOGLOW];
pearlWhite = [0.99, 0.98, 0.93, NOGLOW];
foldShade = [0.86, 0.80, 0.76, NOGLOW];
pearl = [0.90, 0.94, 0.93, NOGLOW];
holy = [0.98, 0.94, 0.68, GLOW];     // halo, blade, motes
holyEdge = [1.0, 0.98, 0.86, GLOW];
rainbow = [goldLight, gold, goldLight, gold, goldLight, gold, goldLight];   // the base's glints, in gold
capeCols = [cream, pearlWhite, foldShade, cream, pearlWhite, cream, foldShade];

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
module helm(eyeC = undef) {
  translate(H) rotate([0, 0, HELM_TURN]) translate(-H) helmFace(eyeC);
}
module helmFace(eyeC) {
  color(armour) helmShell();
  // Pale front of the dome and the face guard (the light faces of the sprite).
  color(armourLight) intersection() { helmShell(0.12); translate([H[0] - 2.4, H[1] - 6, 35.0]) cube([4.6, 5.0, 2.8]); }
  color(armourLight) intersection() { helmShell(0.12); translate([H[0] - 1.9, H[1] - 6, 31.0]) cube([3.6, 4.4, 3.0]); }
  // Visor slit across the face, eye glints in it.
  color(visor) intersection() { helmShell(0.2); translate([H[0] - 2.8, H[1] - 6, 34.0]) cube([5.6, 5.2, 0.85]); }
  // The nasal drop under the slit (the dark T of the art).
  color(visor) intersection() { helmShell(0.2); translate([H[0] - 0.35, H[1] - 6, 32.6]) cube([0.7, 5.2, 1.6]); }
  // Breathing slots on the face guard.
  for (x = [-0.9, 0.9]) color(goldDark) intersection() { helmShell(0.22); translate([H[0] + x - 0.17, H[1] - 6, 31.7]) cube([0.34, 4.5, 1.8]); }
  // Chin edge and a crest line over the dome.
  color(joint) intersection() { helmShell(0.18); translate([H[0] - 3, H[1] - 6, 31.0]) cube([6, 6.2, 0.35]); }
  color(gold) translate(H + [0, 0.2, 3.35]) scale([0.5, 2.8, 0.5]) sphere(1, $fn = 8);
}

// ---------------------------------------------------------------- legs
kneeCopC = goldLight;
ankleC = gold;
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

// ---------------------------------------------------------------- sword arm (far, -X); the blade is traced on this sheet
module swordArm() {
  sh = [-5.3, 0.5, 30.2];
  el = [-7.4, -0.6, 25.6];
  hd = [-7.7, -2.2, 20.3];
  limb(sh, el, 2.0, 1.85, armour, $fn = 18);
  facet([1.5, 0.8, 1.9], (sh + el) / 2 + [-0.5, -1.55, 0], armourLight, 14);
  facet([1.95, 1.85, 1.6], el, goldLight, 14);                                    // elbow cop
  limb(el, hd + [0, 0, 1.3], 1.85, 2.1, armour, $fn = 18);
  facet([2.25, 1.85, 1.4], hd + [0, 0, 1.7], armourLight, 14);                     // gauntlet cuff
  color(gold) translate(hd + [0, 0, 2.8]) scale([2.15, 1.8, 0.4]) sphere(1, $fn = 14);   // gold cuff edge
  facet([1.75, 1.65, 1.5], hd, armourDark, 12);                                    // fist
  pp(1.6) {
    // Grip and pommel up the arm.
    color(goldDark) hull() { translate([-7.5, 0, 21.1]) sphere(0.45, $fn = 8); translate([-6.7, 0, 22.0]) sphere(0.45, $fn = 8); }
    color(gold) translate([-6.5, 0, 22.2]) sphere(0.75, $fn = 10);
  }
}
// Traced off the tenjin sheet (lowered by GT): a golden blade from the guard to the tip, the gold crossguard across it.
bladePts = [[-9.1, 19.0], [-7.6, 17.7], [-17.8, 6.2], [-20.8, 3.9], [-19.3, 7.3]];
module blade() {
  pp(1.6) {
    for (i = [0 : 3]) color(gold) translate([-9.9 + i * 0.85, -0.1, 19.7 - i * 0.95]) scale([0.7, 0.6, 0.6]) sphere(1, $fn = 8);
    translate([0, 0.2, 0]) plate(bladePts, 0.5, 0.2, holy, grow = 0.25);
    color(holyEdge) translate([0, -0.1, 0]) rotate([90, 0, 0]) linear_extrude(height = 0.2, center = true)
      polygon([[-8.6, 18.5], [-8.2, 18.2], [-18.9, 6.4], [-19.3, 6.6]]);
  }
}

// ---------------------------------------------------------------- shield arm (near, +X); the shield is traced on this sheet
module shieldArm() {
  sh = [5.3, 0.5, 30.2];
  el = [8.6, -0.2, 26.4];
  hd = [11.4, 0.6, 23.4];
  limb(sh, el, 2.0, 1.85, armour, $fn = 18);
  facet([1.95, 1.85, 1.6], el, goldLight, 14);
  limb(el, hd, 1.85, 2.0, armour, $fn = 18);
}
kite = [[12.4, 32.9], [17.0, 26.0], [17.0, 17.0], [12.1, 10.0], [6.4, 16.4], [5.4, 26.3]];
kc = [13.4, 21.8];
SD = -6.3;
kiteIn = [[12.4, 31.0], [15.9, 25.4], [15.9, 17.6], [12.1, 12.1], [7.6, 17.0], [6.7, 25.6]];
module shieldFace(d = 0) {
  hull() {
    translate([0, -0.55 - d, 0]) rotate([90, 0, 0]) linear_extrude(height = 0.2, center = true) polygon(kiteIn);
    translate([kc[0], -1.3 - d, kc[1]]) sphere(0.15, $fn = 6);
  }
}
module shield() {
  pp(SD) {
    plate(kite, 1.1, 0.45, gold);
    color(armourLight) shieldFace();
    // The gold cut lines from the boss to each corner of the face.
    for (q = kiteIn) color(gold) hull() { translate([kc[0], -1.3, kc[1]]) sphere(0.18, $fn = 6); translate([q[0], -0.6, q[1]]) sphere(0.18, $fn = 6); }
    // The boss: a gold ring round a pearl gem.
    color(gold) translate([kc[0], -1.1, kc[1]]) rotate([90, 0, 0]) rotate_extrude($fn = 24) translate([1.75, 0]) scale([0.45, 0.6]) circle(1, $fn = 8);
    color(goldLight) translate([kc[0], -1.35, kc[1]]) rotate([90, 0, 0]) cylinder(h = 0.5, r = 1.45, $fn = 22, center = true);
    color(pearl) translate([kc[0], -1.6, kc[1]]) scale([1, 0.6, 1]) sphere(1.05, $fn = 16);
  }
}

// The cape hangs from the shoulders BEHIND the knight as a curved cloth (as in gemknight.scad): a shallow arc behind
// the back, falling to just under the knees, its far (-X) edge blown out into the lobe on the viewer's left, its near
// (+X) edge flaring a little behind the shield. Columns -X to +X, each [collar, billow, hem] as scad [x, y, z] in this
// sheet's frame (before the drop by GT).
capeKeys = [
  [[-5.7, 2.5, 29.3], [-24.0, 4.2, 22.5], [-24.5, 4.8, 16.5]],
  [[-4.5, 3.1, 29.8], [-18.5, 4.9, 21.5], [-18.5, 5.3, 13.5]],
  [[-3.1, 3.5, 30.0], [-12.5, 5.3, 19.0], [-12.5, 5.6, 10.5]],
  [[-1.0, 3.7, 30.2], [-6.0, 5.7, 17.5], [-6.5, 6.1, 8.8]],
  [[1.0, 3.7, 30.2], [0.5, 5.9, 17.0], [0.5, 6.3, 8.3]],
  [[3.1, 3.5, 30.0], [5.5, 5.7, 17.5], [6.5, 6.1, 8.8]],
  [[4.5, 3.1, 29.8], [10.0, 5.1, 18.0], [11.5, 5.5, 9.0]],
  [[5.7, 2.5, 29.3], [13.5, 4.1, 19.0], [15.5, 4.5, 10.0]]
];
SUB = 4;
FOLD = [0, 0.7, 1.1];
function capePt(i, row) =
  let(k = floor(i / SUB), u = (i % SUB) / SUB,
      a = capeKeys[min(k, len(capeKeys) - 1)][row], b = capeKeys[min(k + 1, len(capeKeys) - 1)][row],
      s = a + (b - a) * u)
  [s[0], s[1] + FOLD[row] * sin(i * 90), s[2]];
module cape(cols = capeCols) {
  n = (len(capeKeys) - 1) * SUB;
  // Cream cloth with fold shading; the two outer quads are the iridescent edge.
  for (i = [0 : n - 1]) for (row = [0 : 1]) color(i == 0 || i == n - 1 ? iris : cols[floor(i / 2) % len(cols)]) hull() {
    for (j = [i, i + 1]) for (r = [row, row + 1]) translate(capePt(j, r)) sphere(0.4, $fn = 6);
  }
  // The iridescent band along the lobe's top edge.
  chain([[-6.5, 2.6, 29.2], [-12.5, 3.2, 27.0], [-18.5, 3.7, 24.6], [-24.0, 4.2, 22.5]], [0.6, 0.75, 0.8, 0.7], iris);
}
// The collar and the cowl hang off the body (its frame).
module collar() {
  color(cream) hull() {
    for (x = [-4.8, 4.8]) translate([x, 3.8, 29.6]) scale([0.9, 0.5, 0.6]) sphere(1, $fn = 8);
    for (x = [-1.6, 1.6]) translate([x, 5.9, 23.6]) scale([0.9, 0.5, 0.7]) sphere(1, $fn = 8);
  }
  color(gold) hull() for (x = [-4.6, 4.6]) translate([x, 2.6, 30.9]) scale([1.2, 1.0, 0.7]) sphere(1, $fn = 10);
}

// ---------------------------------------------------------------- halo and motes (traced on this sheet)
module halo() {
  pp(2.2) color(holy) translate([1.3, 0, 35.7]) scale([1, 1, 0.88]) rotate([90, 0, 0]) rotate_extrude($fn = 40)
    translate([4.75, 0]) scale([0.32, 0.25]) circle(1, $fn = 8);
}
motes = [[-11.5, 30.5, 1], [-14.0, 11.5, 0], [6.5, 36.0, 1], [18.5, 21.0, 0], [-4.5, 33.0, 2], [19.0, 30.0, -1]];
module moteDots() { for (m = motes) pp(m[2]) color(holy) translate([m[0], 0, m[1]]) sphere(0.4, $fn = 8); }

translate([0, 0, -G * S]) scale(S) {
  torso();
  helm();
  leg(fromSheet(-1.6, 16.5, 0.4), fromSheet(-3.9, 12.6, -0.4), fromSheet(-6.0, 6.6, -0.4), fromSheet(-9.0, 3.4, -2.6));
  leg(fromSheet(2.6, 16.5, -0.2), fromSheet(4.7, 12.8, -1.0), fromSheet(7.2, 6.6, -1.0), fromSheet(9.4, 3.4, -2.2));
  swordArm();
  shieldArm();
  collar();
}
translate([0, 0, -GT]) {
  blade();
  shield();
  cape();
  halo();
  moteDots();
}
