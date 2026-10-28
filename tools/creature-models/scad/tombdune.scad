// Tombdune: a sandstone sarcophagus on stubby feet, its arched lid swung open behind, gold spiral glyphs on its faces.
// A glossy purple ooze spirit wearing a gold mask with glowing pink eyes spills out over the broken rim, dripping
// arms reaching to both sides.
include <lib.scad>

stone = [0.8, 0.66, 0.42];
stoneDark = [0.62, 0.48, 0.3];
stoneHi = [0.88, 0.76, 0.52];
gold = [0.95, 0.75, 0.2];
ooze = [0.45, 0.22, 0.65];
oozeHi = [0.65, 0.45, 0.85];
oozeDark = [0.3, 0.12, 0.45];
eyePink = [1, 0.75, 0.95];
voidC = [0.12, 0.08, 0.14];

// Square spiral glyph, drawn flat in the XZ plane facing -Y (size s).
module glyph(s) {
  color(gold) {
    w = s * 0.14;
    // Outer diamond frame.
    rotate([0, 45, 0]) difference() {
      cube([s, w * 1.4, s], center = true);
      cube([s - 2 * w, w * 3, s - 2 * w], center = true);
    }
    // Inner spiral hook.
    rotate([0, 45, 0]) {
      translate([-s * 0.18, 0, 0]) cube([w, w * 1.4, s * 0.45], center = true);
      translate([0, 0, s * 0.18]) cube([s * 0.4, w * 1.4, w], center = true);
      translate([s * 0.12, 0, 0]) cube([w, w * 1.4, s * 0.3], center = true);
    }
  }
}

// Feet: four stone blocks.
for (p = [[-5, -4], [5, -4], [-5, 4], [5, 4]]) color(stoneDark) translate([p[0], p[1], 1.6]) cube([3.6, 3.6, 3.2], center = true);

// Coffin: a hexagonal tapered vessel, vertex to the front, hollow with a jagged broken rim.
H0 = 3; H1 = 22;
color(stone) difference() {
  translate([0, 0, H0]) rotate([0, 0, 30]) cylinder(h = H1 - H0, r1 = 7.5, r2 = 10, $fn = 6);
  translate([0, 0, H0 + 2]) rotate([0, 0, 30]) cylinder(h = H1, r1 = 6, r2 = 8.6, $fn = 6);
  // Broken notches in the rim.
  for (a = [250, 330, 60, 150]) translate([10 * cos(a), 10 * sin(a), H1]) rotate([0, 0, a]) rotate([0, 45, 0]) cube(3.4, center = true);
}
// Base plinth band and a gold line under the rim.
color(stoneDark) translate([0, 0, H0]) rotate([0, 0, 30]) cylinder(h = 1.4, r = 8, $fn = 6);
color(gold) translate([0, 0, H1 - 3]) rotate([0, 0, 30]) cylinder(h = 0.6, r = 9.75, $fn = 6);
// Glyphs on the four side-front and side-back faces.
for (a = [240, 300, 60, 120]) {
  rf = 8.9 * cos(30);   // face apothem at mid height
  translate([rf * cos(a), rf * sin(a), 11.5]) rotate([0, 0, a + 90]) rotate([-7, 0, 0]) glyph(5);
}
// Tall glyph bars on the side faces.
for (a = [0, 180]) translate([8.1 * cos(a), 0, 11.5]) rotate([0, 0, a + 90]) for (dx = [-1.2, 1.2]) color(gold) translate([dx, 0, 0]) cube([0.6, 0.6, 5], center = true);

// Lid: a tall arched slab swung back and leaning, gold glyph on its outer face.
translate([1.5, 9.5, 21]) rotate([-18, 0, 8]) {
  color(stone) hull() {
    translate([0, 0, 0]) cube([12, 2.4, 1], center = true);
    translate([0, 0, 13]) rotate([90, 0, 0]) cylinder(h = 2.4, r = 6, center = true, $fn = 28);
  }
  color(stoneHi) translate([0, -1.3, 12.8]) rotate([90, 0, 0]) cylinder(h = 0.4, r = 4.6, center = true, $fn = 24);
  translate([0, 1.4, 9]) rotate([0, 0, 180]) glyph(5.5);
  color(voidC) translate([0, -1.0, 6]) cube([9, 0.6, 8], center = true);
}

// Ooze spirit: body welling up from inside, a glossy highlight.
color(ooze) hull() {
  translate([0, 0, 19]) scale([7, 6.4, 3]) sphere(1, $fn = 24);
  translate([0, 0.5, 26]) scale([5, 4.8, 4]) sphere(1, $fn = 24);
}
color(oozeHi) translate([-2, -4.6, 23]) scale([1.6, 0.8, 2]) sphere(1, $fn = 12);
translate([0, -1, 29]) scale(1.3) translate([0, 1, -29]) {
// Head under the mask.
color(ooze) translate([0, -0.5, 30]) scale([5.2, 4.8, 5]) sphere(1, $fn = 24);
// Ooze tendril behind the head, running up to the lid.
chain([[1, 3, 31], [2, 6, 33], [3, 8, 31]], [2.6, 1.8, 1], oozeDark);

// Gold mask: a rounded face plate with a crest point, diamond on the brow, eye holes glowing pink.
color(gold) hull() {
  translate([0, -4.2, 31.4]) scale([4.8, 1.6, 3.4]) sphere(1, $fn = 20);
  translate([0, -3.6, 36.4]) sphere(0.8, $fn = 10);
}
color(gold) mirror_x() translate([3.6, -4, 33.6]) rotate([0, 30, 0]) scale([2, 1.2, 0.8]) sphere(1, $fn = 12);
color(stoneHi) translate([0, -5.6, 34]) rotate([0, 45, 0]) cube([1.6, 0.6, 1.6], center = true);
mirror_x() {
  color(voidC) translate([2, -5.4, 31.2]) rotate([0, -15, 0]) scale([1.5, 0.6, 1.1]) sphere(1, $fn = 14);
  color(eyePink) translate([2, -5.8, 31.2]) rotate([0, -15, 0]) scale([1.0, 0.5, 0.7]) sphere(1, $fn = 12);
}
}
// Ooze drool under the mask.
for (x = [-1.6, 0.4, 2]) limb([x, -4.4, 28.4], [x, -4.6, 26.4 - abs(x) * 0.4], 0.7, 0.5, ooze);

// Arms: ooze reaching out over the rim to both sides, dripping, with blobby fingers.
mirror_x() {
  chain([[5, -1, 25], [10, -2, 25], [14, -2.4, 23.4]], [2.6, 2.2, 1.8], ooze);
  for (f = [[-1, 0], [0.4, 0.6], [1.6, -0.6]]) limb([14, -2.4, 23], [14.8 + f[1], -2.8 + f[0], 19.6], 0.9, 0.6, ooze);
  color(oozeHi) translate([10, -3.4, 26]) scale([1.6, 0.6, 0.8]) sphere(1, $fn = 10);
  ell([0.6, 0.6, 0.8], [15.4, -2.4, 16.8], ooze);
  limb([9, -1.6, 23.4], [9, -1.8, 21], 0.6, 0.4, ooze);
}
