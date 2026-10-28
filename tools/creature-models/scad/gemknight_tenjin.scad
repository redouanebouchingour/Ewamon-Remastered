// Gemknight (Tenjin form): the crystal knight turned holy, ivory plate edged in gold, a golden halo over the great helm,
// an ivory kite shield with a gold rim and a pearl boss, a glowing golden blade and a long pearl-white cape.
// Built from a copy of gemknight.scad; only the palette, halo, shield boss and the cape/aura colours change.
include <lib.scad>

silver = [0.95, 0.92, 0.84];
silverLight = [1, 0.98, 0.93];
silverDark = [0.82, 0.76, 0.64];
visor = [0.25, 0.2, 0.14];
rainbow = [[1, 0.55, 0.55], [1, 0.75, 0.45], [1, 0.93, 0.55], [0.6, 0.92, 0.6], [0.55, 0.8, 1], [0.72, 0.62, 1]];
// Palette hooks the Tenjin form overrides.
gold = [0.92, 0.74, 0.3];
trim = gold;
pearl = [0.97, 0.95, 0.9];
capeCols = [pearl, [0.93, 0.9, 0.84], pearl, [0.9, 0.95, 0.94], pearl, [0.95, 0.9, 0.96]];
shieldFace = [0.97, 0.94, 0.86];

module facet(r, p, c, fn = 8, rot = [0, 0, 0]) { color(c) translate(p) rotate(rot) scale(r) sphere(1, $fn = fn); }

// --- Legs: greaves and sabatons, slightly apart.
module legs() {
  mirror_x() {
    facet([2.8, 3, 4.6], [3.6, 0, 15], silver, 8);
    facet([2, 1.6, 2], [3.8, -2.6, 10.5], silverLight, 6);
    color(trim) translate([3.8, 0, 12.6]) scale([2.8, 2.8, 0.6]) sphere(1, $fn = 12);
    facet([2.4, 2.6, 4.6], [4, 0, 6], silver, 8);
    facet([2.6, 4.4, 1.6], [4.2, -1.2, 1.6], silverDark, 8);
  }
}
// --- Torso: breastplate, faulds, pauldrons.
module torso() {
  facet([7.4, 5, 6.4], [0, 0, 26.5], silver, 10);
  facet([5.6, 2, 4.8], [0, -3.8, 27], silverLight, 6);
  color(trim) translate([0, -4.6, 26]) scale([0.5, 0.8, 4.4]) sphere(1, $fn = 8);
  facet([5.4, 4, 2.6], [0, 0, 20.5], silverDark, 10);
  color(silver) hull() { translate([0, -2.6, 19.5]) scale([4.6, 1.4, 1]) sphere(1, $fn = 8); translate([0, -3.4, 15.6]) scale([3, 1, 0.8]) sphere(1, $fn = 8); }
  // Iridescent glints on the breastplate.
  for (g = [[-2.5, 29, 0], [2.8, 28, 2], [-1.5, 25, 4], [3, 24.5, 1], [0.5, 30.5, 5], [-3.5, 26.5, 3]])
    color(gold) translate([g[0], -4.6 - (abs(g[0]) < 2 ? 0.8 : 0), g[1]]) rotate([0, 0, g[0] * 8]) cube([1.2, 0.6, 0.6], center = true);
  mirror_x() {
    facet([4, 4, 3.2], [7.4, 0, 31], silver, 8);
    facet([4.2, 4.2, 0.9], [7.6, 0, 29.4], trim, 10);
    facet([3.4, 3.6, 2.4], [8, 0, 28], silverLight, 8);
  }
}
// --- Helmet: a rounded great helm with a dark visor slot and a ridge.
module helm() {
  H = [0, -0.6, 36];
  facet([3.6, 3.8, 4.2], H, silver, 12);
  color(visor) translate(H + [0, -3.3, 0.2]) cube([5, 1.6, 1.1], center = true);
  color(visor) translate(H + [0, -3.4, -1.6]) cube([1, 1.4, 1.8], center = true);
  for (z = [-1.2, -2.2]) for (x = [-1.8, 1.8]) color(visor) translate(H + [x, -3.4, z]) sphere(0.3, $fn = 6);
  color(trim) translate(H + [0, 0, 0.6]) scale([0.5, 4, 4]) sphere(1, $fn = 14);
  facet([3, 3, 1.2], H + [0, 0, -4], silverDark, 10);
}
// --- Sword arm (viewer's left): held down and out, prism blade pointing to the ground.
module swordArm(blade = [0.82, 0.9, 1], glow = rainbow) {
  facet([2, 2, 3.6], [-9.2, -0.6, 25], silverDark, 8);
  facet([2, 2, 3.4], [-10.6, -2, 19.5], silver, 8);
  facet([2, 2.2, 2], [-11, -3, 16.5], silverLight, 8);
  translate([-11, -3, 16.5]) rotate([0, -150, 0]) {
    color(trim) translate([0, 0, 1.6]) scale([3.6, 0.8, 0.6]) sphere(1, $fn = 8);
    color(silverDark) translate([0, 0, -1.6]) cylinder(h = 3, r = 0.5, $fn = 8);
    color(blade) hull() { translate([0, 0, 2]) scale([1.5, 0.4, 0.1]) sphere(1, $fn = 6); translate([0, 0, 14]) scale([1.2, 0.35, 0.1]) sphere(1, $fn = 6); translate([0, 0, 17.5]) sphere(0.15, $fn = 6); }
    color(glow[4]) translate([0, -0.25, 9]) scale([0.4, 0.2, 6]) sphere(1, $fn = 6);
    color(glow[0]) translate([0, 0.25, 9]) scale([0.4, 0.2, 6]) sphere(1, $fn = 6);
  }
}
// --- Shield arm (viewer's right): a kite shield of faceted crystal in front of the forearm.
module shield(face = shieldFace, rim = silverLight, boss = undef) {
  facet([2, 2, 3.4], [9.6, -0.6, 25.5], silverDark, 8);
  facet([2, 2.4, 3], [10.4, -2.4, 20.5], silver, 8);
  translate([11.5, -6, 21]) rotate([0, 0, -25]) rotate([90, 0, 0]) {
    kite = [[0, 10], [5.4, 7], [4.6, -3], [0, -11], [-4.6, -3], [-5.4, 7]];
    color(rim) linear_extrude(height = 1, center = true) polygon(kite);
    // Crystal facets: triangles from the centre to each rim edge, each its own shade.
    for (i = [0 : 5]) {
      a = kite[i]; b = kite[(i + 1) % 6];
      color(boss == undef ? rainbow[(i + 3) % 6] * 0.55 + face * 0.45 : face)
        hull() {
          translate([0, 0, 0.9]) cylinder(h = 0.3, r = 0.4, $fn = 6);
          translate([a[0] * 0.85, a[1] * 0.85, 0.5]) cylinder(h = 0.2, r = 0.2, $fn = 4);
          translate([b[0] * 0.85, b[1] * 0.85, 0.5]) cylinder(h = 0.2, r = 0.2, $fn = 4);
        }
    }
    if (boss != undef) {
      color(trim) translate([0, 1, 1]) cylinder(h = 0.8, r = 2.6, $fn = 24);
      color(boss) translate([0, 1, 1.6]) scale([1, 1, 0.6]) sphere(1.8, $fn = 16);
    }
  }
}
// --- Cape: strips flowing from the shoulders down the back, flaring wide near the ground.
module cape(cols = capeCols) {
  n = 12;
  for (i = [0 : n - 1]) {
    t = i / (n - 1) - 0.5;
    top = [t * 12, 4.2, 31];
    mid = [t * 18, 7 + abs(t) * 2, 16];
    bot = [t * 26 + (t > 0 ? 2 : -2), 9 + abs(t) * 4, 2.5 + abs(t) * 3];
    c = cols[floor(i / 2) % len(cols)];
    color(c) hull() { translate(top) scale([0.8, 0.5, 0.6]) sphere(1, $fn = 6); translate(mid) scale([1.1, 0.5, 0.6]) sphere(1, $fn = 6); }
    color(c) hull() { translate(mid) scale([1.1, 0.5, 0.6]) sphere(1, $fn = 6); translate(bot) scale([1.4, 0.5, 0.6]) sphere(1, $fn = 6); }
  }
  // Collar draped over the shoulders.
  color(cols[5 % len(cols)]) translate([0, 3.2, 31.6]) scale([8, 2.4, 1.6]) sphere(1, $fn = 16);
}
// --- Aura: a burst of rainbow rays behind the knight.
module aura(cols = rainbow) {
  for (i = [0 : 15]) {
    a = -110 + i * 14.6;
    L = 3 + (i % 3) * 1.6;
    color(cols[i % len(cols)]) translate([0, 6, 24] + [9 * sin(a), 0, 12 * cos(a)]) rotate([0, a, 0]) rotate([90, 0, 0])
      linear_extrude(height = 0.5) polygon([[-1.2, 0], [1.2, 0], [0, L]]);
  }
}

// Golden halo ring above and behind the helm.
module halo() {
  color(gold) translate([0, 1.5, 38.5]) rotate([80, 0, 0]) rotate_extrude($fn = 40) translate([5.2, 0]) circle(0.45, $fn = 8);
}

legs();
torso();
helm();
halo();
swordArm(blade = [1, 0.9, 0.55], glow = [[1, 0.97, 0.75], 0, 0, 0, [1, 0.97, 0.75]]);
shield(rim = gold, boss = pearl);
cape();
// Gold seams on the cape's lining edge, and drifting motes of light instead of the rainbow burst.
for (p = [[-9, 2, 34], [10, 1, 30], [-12, -2, 20], [13, -3, 12], [-6, -4, 38], [7, 3, 40]]) color([1, 0.92, 0.6]) translate(p) sphere(0.45, $fn = 8);
