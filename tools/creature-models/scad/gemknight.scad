// Gemknight: a slim knight in blue-silver crystal plate with a round great helm, a kite shield of cut crystal with a
// rainbow sheen on its left arm, a long crystal blade held low on its right, and a huge pastel-rainbow cape fanning
// out behind it in a burst of coloured rays.
//
// Checklist (front sheet, x = sheet x, z = sheet z; the soles stand on z ~2.8, the grey ground shadow is not
// modelled):
//   - helm: round great helm x -2.9..3.9, z 31.2..37.9, a dark visor slit z 33.4..34.6 with two cyan eye glints at
//     (-1.2, 34) and (0.9, 34), a nasal ridge, a dark chin line at z 32
//   - pauldrons: faceted domes, the left (behind the helm) x -5.9..-2.7, z 30.4..33.9, the right x 3.4..8.6,
//     z 28.9..33.9; a dark blue cape collar behind them
//   - torso: breastplate x -2.9..4.1, z 21.9..31.2 with rainbow glints; waist z 18.4..21.9; tassets z 13.4..18.9
//   - legs: wide stance; thighs z 9..15.4, greaves z 3.4..10.4, sabatons z 2.4..5.4 at x -8.9..-3.4 and 3.1..9.4
//   - sword arm (creature's -X): upper arm (-6.7..-3.9, 26..30.4), gauntlet (-7.4..-4.2, 21.4..26), hand at
//     (-8, 20.9); rainbow crossguard 3.5 wide at (-8.4, 20.6); crystal blade to the tip at (-19.6, 7.6)
//   - shield (creature's +X arm, in front of the right pauldron): kite top (10.6, 33.6), right (16, 27)/(15.6, 20),
//     bottom (10.6, 12.9), left (6, 19.6)/(5, 27.2); pale crystal face with rainbow facets round a boss
//   - cape: from the collar (z ~31) out to a curl at the top left (-19, 28), the left tip (-19, 19.5), hem back in
//     through (-12.4, 13.4), (-9.4, 10.9), (-2, 9.5), (4, 8.5) and out to the right tip (19.5, 8.5) under the
//     shield; right wing up to (20, 24); vertical rainbow stripes (pink, orange, yellow, green, cyan, lavender, blue)
//   - rays: thin coloured sparks radiating behind the knight (top left, top right, both sides, lower left)
//   - back: the cape covers the whole back (its lining striped the same), the collar, the helm's round back, the
//     shield's rim on the +X side, the blade on the -X side
// Colours: armour M0 [0.53, 0.58, 0.77] (light #96bada, dark #7077a2), joints M8 [0.17, 0.23, 0.31], crystal M2
// [0.66, 0.88, 0.90] (light #dcf3f7), cape / rays: pink M3, orange M7 (GLOWS), yellow M5, green M6, lavender M4,
// cyan M2, blue M0. Only the orange glows; every other bright colour is NOGLOW.
include <lib.scad>

armour = [0.53, 0.58, 0.77];
armourLight = [0.59, 0.73, 0.86];
armourDark = [0.44, 0.47, 0.64];
joint = [0.17, 0.23, 0.31];
crystal = [0.66, 0.88, 0.90, NOGLOW];
crystalLight = [0.86, 0.95, 0.97, NOGLOW];
pink = [0.96, 0.55, 0.54, NOGLOW];
orange = [0.98, 0.79, 0.50, GLOW];
yellow = [0.98, 0.97, 0.58, NOGLOW];
green = [0.65, 0.96, 0.64, NOGLOW];
lavender = [0.82, 0.59, 0.91, NOGLOW];
blue = [0.53, 0.58, 0.77];
rainbow = [pink, orange, yellow, green, crystal, lavender, blue];
// Palette hooks the Tenjin form overrides.
capeCols = rainbow;
rayCols = rainbow;
shieldFace = crystal;
shieldRim = crystalLight;
bladeCol = crystal;
guardCols = [orange, yellow, green];
visorEye = crystalLight;

module facet(r, p, c, fn = 8, rot = [0, 0, 0]) { color(c) translate(p) rotate(rot) scale(r) sphere(1, $fn = fn); }

// ---- Torso: breastplate, waist, tassets; rainbow glints on the plate.
blob([[[3.6, 3.1, 3.6], [0, 0, 27.6]], [[3.3, 2.9, 2.4], [0, 0, 23.2]]], armour);
facet([2.8, 1.2, 3.2], [0, -2.6, 27.2], armourLight, 7);
color(armourDark) translate([0, -3.4, 27]) scale([0.3, 0.6, 3.6]) sphere(1, $fn = 8);
for (g = [[-1.6, 29.4, 0], [1.9, 28.6, 3], [-0.8, 25.8, 5], [2.1, 25.2, 1], [0.6, 30.4, 2], [-2.2, 27.2, 4]])
  color(rainbow[g[2]]) translate([g[0], -3.5 - (abs(g[0]) < 1.5 ? 0.4 : 0), g[1]]) rotate([0, 0, g[0] * 10]) scale([0.7, 0.35, 0.45]) sphere(1, $fn = 6);
ell([2.9, 2.6, 2.2], [0, 0, 20.3], armourDark);                                   // waist
blob([[[3.9, 3.2, 1.9], [0, 0, 17.8]], [[3.5, 3.0, 1.8], [0, -0.3, 14.6]]], armour);   // tassets
color(armourLight) translate([0, -3.0, 15.4]) scale([1.5, 0.6, 2.2]) sphere(1, $fn = 8);  // centre tasset
color(joint) translate([0, 0, 13.2]) scale([3.2, 2.6, 1.2]) sphere(1, $fn = 14);

// ---- Pauldrons and the cape's dark collar behind them.
mirror_x() {
  facet([3.1, 2.9, 2.5], [6.4, 1.4, 31.3], armour, 8);
  facet([2.2, 2.0, 1.2], [6.6, 0.4, 32.6], armourLight, 7);
  facet([3.0, 2.8, 0.8], [6.5, 1.4, 29.2], armourDark, 10);
}
color(armourDark) translate([0, 2.6, 31.2]) scale([7.2, 2.0, 1.5]) sphere(1, $fn = 16);

// ---- Helm: a round great helm with a dark visor slit, cyan eye glints, a nasal ridge and a chin line.
H = [0.2, -0.6, 34.6];
color(armour) hull() { translate(H) sphere(3.4, $fn = 32); translate(H + [0, 0, -1.6]) scale([3.3, 3.3, 1.4]) sphere(1, $fn = 32); }
color(armourLight) intersection() { translate(H) sphere(3.5, $fn = 32); translate([-6, -6, 36.4]) cube([12, 12, 4]); }
color(joint) intersection() { translate(H) sphere(3.55, $fn = 32); translate(H + [-3, -6, -1.2]) cube([6, 6, 1.3]); }
mirror_x() color(visorEye) translate(H + [1.1, -3.2, -0.55]) rotate([0, -15, 0]) scale([0.7, 0.4, 0.42]) sphere(1, $fn = 10);
color(armour) translate(H + [0, -3.1, -1.0]) scale([0.45, 0.6, 1.9]) sphere(1, $fn = 8);          // nasal
color(joint) intersection() { translate(H) sphere(3.5, $fn = 32); translate(H + [-2.4, -6, -2.9]) cube([4.8, 6, 0.4]); }
color(armourDark) translate(H + [0, 0, 3.2]) scale([0.5, 2.2, 0.6]) sphere(1, $fn = 8);          // crest line

// ---- Legs: wide stance, plated thighs and greaves, knee cops, sabatons, dark joints.
mirror_x() {
  color(joint) translate([2.4, 0, 17.6]) sphere(1.6, $fn = 12);
  limb([2.6, -0.4, 17.6], [5.6, -1.2, 10.6], 2.1, 1.9, armour);
  facet([1.6, 1.0, 2.2], [4.3, -2.4, 14.4], armourLight, 7);
  facet([2.0, 1.8, 1.9], [5.8, -1.6, 10.3], armourLight, 8);
  color(joint) translate([5.7, -0.4, 10.2]) sphere(1.7, $fn = 12);
  limb([5.7, -1.2, 10.0], [6.3, -1.2, 4.6], 1.9, 1.7, armour);
  facet([1.3, 0.8, 2.4], [6.1, -2.6, 7.4], armourLight, 7);
  blob([[[2.1, 2.2, 1.4], [6.4, -1.2, 3.8]], [[1.9, 1.6, 1.1], [6.6, -4.4, 3.5]]], armourDark);
  facet([1.6, 1.2, 0.8], [6.5, -4.8, 3.9], armourLight, 7);
}

// ---- Sword arm (creature's -X): held down and out, the long crystal blade pointing to the ground.
module swordArm(blade = bladeCol, guard = guardCols, glint = rainbow) {
  sh = [-6.2, 0.4, 30.0];
  el = [-7.2, -1.6, 25.6];
  hd = [-7.6, -3.2, 20.9];
  limb(sh, el, 1.7, 1.6, armour);
  color(joint) translate(el) sphere(1.5, $fn = 12);
  limb(el, hd + [0, 0, 1.2], 1.6, 1.8, armour);
  facet([1.8, 1.4, 1.2], hd + [0, -0.3, 1.4], armourLight, 7);                    // gauntlet cuff
  facet([1.6, 1.5, 1.4], hd, armourDark, 8);                                     // fist
  tip = [-19.2, -6.2, 7.6];
  d = tip - hd;
  translate(hd) rotate(_dir_rot(d)) {
    color(joint) translate([0, 0, -2.4]) cylinder(h = 3.4, r = 0.45, $fn = 8);                   // grip and pommel
    color(armourDark) translate([0, 0, -2.6]) sphere(0.7, $fn = 10);
    for (i = [0 : 2]) color(guard[i]) translate([(i - 1) * 1.3, 0, 1.0]) scale([0.75, 0.45, 0.42]) sphere(1, $fn = 8);
    color(blade) hull() {
      translate([0, 0, 1.6]) scale([1.3, 0.38, 0.2]) sphere(1, $fn = 8);
      translate([0, 0, 12.5]) scale([1.05, 0.32, 0.2]) sphere(1, $fn = 8);
      translate([0, 0, norm(d)]) sphere(0.18, $fn = 6);
    }
    color(crystalLight) hull() { translate([0, -0.1, 1.8]) scale([0.3, 0.36, 0.2]) sphere(1, $fn = 6); translate([0, -0.1, 14.5]) scale([0.22, 0.3, 0.2]) sphere(1, $fn = 6); }
    for (s = [[0.55, 5, 0], [-0.5, 8, 3], [0.45, 11, 5]]) color(glint[s[2]]) translate([s[0], -0.3, s[1]]) scale([0.22, 0.14, 1.3]) sphere(1, $fn = 6);
  }
}

// ---- Shield arm (creature's +X): the forearm behind a kite of cut crystal that faces the viewer (traced in pp()).
kite = [[10.6, 33.6], [16.0, 27.0], [15.6, 20.0], [10.6, 12.9], [6.0, 19.6], [5.0, 27.2]];
kc = [10.6, 24.2];
module shield(face = shieldFace, rim = shieldRim, boss = undef, bossRim = undef) {
  sh = [6.2, 0.4, 30.0];
  el = [8.4, -0.8, 25.2];
  limb(sh, el, 1.7, 1.6, armour);
  color(joint) translate(el) sphere(1.5, $fn = 12);
  limb(el, [9.8, -2.4, 21.2], 1.6, 1.7, armour);
  pp(-5) {
    plate(kite, 1.1, 0.5, rim);
    translate([0, -0.4, 0]) color(face) rotate([90, 0, 0]) linear_extrude(height = 0.5, center = true) offset(delta = -1.1) polygon(kite);
    // Facets: triangles from the boss to each rim edge, each with its own rainbow tint, a hair proud of the face.
    for (i = [0 : 5]) {
      a = kite[i]; b = kite[(i + 1) % 6];
      c = boss == undef ? face * 0.6 + rainbow[(i + 2) % 6] * 0.4 : face;
      color(c) translate([0, -0.9, 0]) rotate([90, 0, 0]) linear_extrude(height = 0.3, center = true)
        offset(delta = -0.45) polygon([kc, a * 0.86 + kc * 0.14, b * 0.86 + kc * 0.14]);
    }
    if (boss != undef) {
      color(bossRim) translate([kc[0], -1.0, kc[1]]) rotate([90, 0, 0]) cylinder(h = 0.9, r = 2.7, $fn = 24);
      color(boss) translate([kc[0], -1.6, kc[1]]) scale([1, 0.6, 1]) sphere(1.9, $fn = 16);
    }
  }
}

// ---- Cape: vertical strips from the collar fanning out behind the knight to both sheet edges.
// Profiles per strip share t (0 = the leftmost, 1 = the rightmost): [top, mid, hem] scad points.
function lerp(a, b, u) = a + (b - a) * u;
function capeKey(t) =
  t < 0.25 ? let(u = t / 0.25) [lerp([-6.0, 2.2, 30.8], [-3.2, 2.8, 31.0], u), lerp([-21.5, 2.5, 27.0], [-15.0, 4.0, 22.5], u), lerp([-23.4, 3.0, 19.5], [-17.0, 5.0, 13.4], u)] :
  t < 0.5  ? let(u = (t - 0.25) / 0.25) [lerp([-3.2, 2.8, 31.0], [0.0, 3.2, 31.0], u), lerp([-15.0, 4.0, 22.5], [-7.5, 6.0, 20.5], u), lerp([-17.0, 5.0, 13.4], [-6.3, 7.0, 9.5], u)] :
  t < 0.75 ? let(u = (t - 0.5) / 0.25) [lerp([0.0, 3.2, 31.0], [3.4, 2.8, 31.0], u), lerp([-7.5, 6.0, 20.5], [5.0, 6.4, 21.0], u), lerp([-6.3, 7.0, 9.5], [9.8, 7.0, 8.5], u)] :
             let(u = (t - 0.75) / 0.25) [lerp([3.4, 2.8, 31.0], [6.2, 2.2, 30.8], u), lerp([5.0, 6.4, 21.0], [19.0, 4.5, 23.5], u), lerp([9.8, 7.0, 8.5], [19.6, 5.5, 8.8], u)];
module cape(cols = capeCols) {
  n = 16;
  for (i = [0 : n - 1]) {
    t = i / (n - 1);
    k = capeKey(t);
    c = cols[i % len(cols)];
    color(c) hull() { translate(k[0]) sphere(0.75, $fn = 8); translate(k[1]) sphere(1.25, $fn = 8); }
    color(c) hull() { translate(k[1]) sphere(1.25, $fn = 8); translate(k[2]) sphere(1.4, $fn = 8); }
  }
  // The curl at the top left: the cape's steel-blue lining folds over.
  color(armourDark) hull() { translate([-21.5, 2.5, 27.0]) sphere(1.3, $fn = 8); translate([-16.5, 2.8, 29.0]) sphere(1.1, $fn = 8); translate([-13.0, 2.6, 27.6]) sphere(1.0, $fn = 8); }
}

// ---- Rays: thin coloured sparks radiating behind the knight (in the picture plane, 9 units behind).
module rays(cols = rayCols) {
  spec = [[-62, 13, 6.5], [-52, 15, 4], [-40, 12, 5.5], [-28, 13, 3.5], [-12, 14, 4.5], [8, 13, 5], [24, 12, 4],
          [40, 14, 5.5], [55, 13, 3.5], [70, 12, 6], [88, 14, 4], [105, 13, 5], [118, 12, 3.5], [-100, 13, 5], [-118, 12, 4], [-80, 15, 3.5]];
  for (i = [0 : len(spec) - 1]) {
    a = spec[i][0]; r0 = spec[i][1]; L = spec[i][2];
    pp(9) translate([0, 0, 23]) rotate([0, -a, 0]) translate([0, 0, r0]) color(cols[i % len(cols)])
      rotate([90, 0, 0]) linear_extrude(height = 0.5, center = true) polygon([[-0.55, 0], [0.55, 0], [0, L]]);
  }
}

swordArm();
shield();
cape();
rays();
