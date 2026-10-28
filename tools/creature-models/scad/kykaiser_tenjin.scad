// Kykaiser (Tenjin): the heavenly form. Same build as Kykaiser, recoloured to polished silver-blue armour traced
// with gold, a white belly plate, a pale cyan-and-white mane and tail, and a thin gold halo with a pearl behind its head.
include <lib.scad>

blue = [0.72, 0.8, 0.9];
blueDk = [0.52, 0.62, 0.76];
blueHi = [0.95, 0.97, 1];
armour = [0.66, 0.74, 0.86];
bladeC = [0.88, 0.92, 0.98];
bladeDk = [0.6, 0.68, 0.82];
gold = [0.95, 0.78, 0.3];
goldDk = [0.72, 0.52, 0.15];
belly = [0.96, 0.96, 0.95];
bellyLine = [0.85, 0.72, 0.4];
talon = [0.93, 0.93, 0.9];
eyeC = [1, 0.85, 0.1, GLOW];
mane = [0.62, 0.86, 0.94];
maneHi = [0.97, 0.98, 0.95];
maneDk = [0.42, 0.68, 0.8];

// Flat plate as a hull of small spheres (blades, fins, plumes): pts, half-thickness t.
module plate(pts, t, c) {
  color(c) hull() for (p = pts) translate(p) sphere(t, $fn = 8);
}

// Flowing plume: a chain of flattened lobes along pts with widths ws (vertical blade, thin in x).
module plume(pts, ws, c, cHi) {
  for (i = [0 : len(pts) - 2]) color(c) hull() {
    translate(pts[i]) scale([0.45, 1, 1]) sphere(ws[i], $fn = 12);
    translate(pts[i + 1]) scale([0.45, 1, 1]) sphere(ws[i + 1], $fn = 12);
  }
  chain([for (i = [0 : len(pts) - 1]) pts[i] + [0, 0, ws[i] * 0.55]], [for (w = ws) w * 0.32], cHi);
}

// Blade wing from shoulder s along d, length l, width vector w: dark core and a light cutting edge.
module blade(s, d, l, w) {
  plate([s + w * 0.5, s - w * 0.5, s + d * l * 0.5 + w, s + d * l * 0.5 - w * 0.4, s + d * l], 0.7, bladeDk);
  plate([s + w * 0.7, s + d * l * 0.5 + w * 1.15, s + d * l + w * 0.05], 0.75, bladeC);
  plate([s + w * 0.6, s - w * 0.6], 1.2, gold);
}

// Body: a stout egg, turtle-plate belly with seams.
blob([[[7.5, 6.5, 7.5], [0, 0.5, 15]], [[6.5, 6, 5.5], [0, 0, 22]]], blue);
blob([[[5, 2.5, 6], [0, -4.6, 14.5]], [[4, 2.2, 3], [0, -4.4, 20]]], belly);
for (z = [11, 14.5, 18]) color(bellyLine) translate([0, -6.95, z]) scale([3.6, 0.3, 0.22]) sphere(1, $fn = 12);
color(bellyLine) translate([0, -7, 15]) scale([0.22, 0.3, 4.5]) sphere(1, $fn = 8);

// Chest armour plate with gold trim and a gold emblem, and big pauldrons.
blob([[[6.6, 5.5, 2.6], [0, 0, 24.5]]], armour);
color(gold) translate([0, 0, 22.4]) scale([1, 0.86, 1]) cylinder(h = 0.8, r = 6.9, $fn = 30);
color(gold) translate([0, -5.6, 24.2]) scale([1.6, 0.6, 1]) sphere(1, $fn = 14);
// Gold scrollwork curls either side of the emblem.
mirror_x() color(gold) translate([2.2, -5.25, 24.3]) rotate([75, 0, 15]) rotate_extrude(angle = 280, $fn = 14) translate([0.9, 0]) circle(0.25, $fn = 6);
mirror_x() {
  ell([4, 4.2, 3.4], [6.6, 0, 24.8], armour);
  color(gold) translate([6.6, 0, 22.2]) scale([4.1, 4.3, 1]) cylinder(h = 0.8, r = 1, $fn = 20);
  ell([1.6, 0.8, 0.8], [7.8, -3.4, 26.4], blueHi);
}

// Head with the gold trident crown/visor.
translate([0, -1.5, 29.5]) scale(1.2) {
  blob([[[4.4, 4.4, 4.2], [0, 0.5, 0]], [[3, 3.2, 2.4], [0, -3, -1.4]]], blue);
  color(belly) translate([0, -2.8, -2.6]) scale([2.6, 2.4, 1.3]) sphere(1, $fn = 16);
  // Visor shield, blue inset and the trident blade rising above the brow.
  plate([[-3.6, -3.2, 2.5], [3.6, -3.2, 2.5], [-3.8, -4.2, -0.8], [3.8, -4.2, -0.8], [0, -5.6, -2.4]], 0.5, gold);
  plate([[-2.4, -3.9, 1.8], [2.4, -3.9, 1.8], [-2.4, -4.6, -0.6], [2.4, -4.6, -0.6], [0, -5.6, -1.6]], 0.45, blue);
  plate([[0, -4.6, 9], [0, -5.4, 2], [0, -6, -1.8], [-0.9, -5.2, 2], [0.9, -5.2, 2]], 0.55, gold);
  mirror_x() plate([[2.2, -3.6, 7], [2.6, -4.6, 2.4], [1.8, -4.8, 1.2], [3.6, -3.4, 2.5]], 0.5, gold);
  // Glaring eyes in a dark slit under the visor's brow edge.
  mirror_x() {
    color([0.03, 0.05, 0.12]) translate([2.2, -4.55, 0.4]) rotate([0, -22, -22]) scale([1.6, 0.4, 0.95]) sphere(1, $fn = 14);
    eye([2.2, -4.6, 0.35], 1.05, iris = eyeC, pupil = [0.1, 0.05, 0], sclera = [0.1, 0.12, 0.25], yaw = -22,
        lid = 0.5, lid_tilt = 32, lid_c = goldDk, slit = 0.35, squint = 0.2);
  }
  // Swept-back mane: big flowing lobes rising up and curling back.
  plume([[0, 1, 3], [0, 3, 8], [-0.5, 7, 11], [0, 11, 11]], [2.6, 2.4, 2, 1], mane, maneHi);
  for (s = [-1, 1]) {
    plume([[s * 2, 1, 2.5], [s * 2.8, 4, 7], [s * 3, 8, 9], [s * 3.5, 12, 8.5], [s * 3.8, 14, 10]], [2.2, 2.2, 1.8, 1.2, 0.5], mane, maneHi);
    plume([[s * 3, 2, 0], [s * 4, 6, 2.5], [s * 4.5, 10, 3], [s * 5, 13, 5]], [2, 1.8, 1.3, 0.5], maneDk, mane);
  }
}

// Blade wings held down along the sides, tips toward the ground and slightly forward.
blade([-7, -0.5, 23], [-0.6, -0.35, -0.72], 21, [-1.8, 0.6, 1.6] * 1.4);
blade([7, -0.5, 23], [0.5, -0.4, -0.77], 20, [1.8, 0.6, 1.4] * 1.4);

// Back: a gold-trimmed back plate between the shoulders and rows of scalloped feathers down the egg, so the back
// is not a plain blob; feather scallops on the thighs.
blob([[[5.2, 1.6, 3.2], [0, 5.6, 21.5]], [[2.5, 1.4, 2], [0, 6.2, 18]]], armour);
color(gold) hull() { translate([-4.6, 6.6, 23.2]) sphere(0.35, $fn = 6); translate([4.6, 6.6, 23.2]) sphere(0.35, $fn = 6); }
mirror_x() color(gold) hull() { translate([4.6, 6.6, 23.2]) sphere(0.3, $fn = 6); translate([0, 7.4, 16.6]) sphere(0.3, $fn = 6); }
// downward-pointing feathers
for (row = [0 : 2]) for (k = [-2 : 2]) let(a = k * 22 + (row % 2) * 11, z = 15.5 - row * 3.2, r = 7.2 - row * 0.15)
  color(row % 2 == 0 ? blueDk : armour) hull() {
    translate([r * sin(a), 0.5 + r * cos(a) * 0.9, z]) rotate([0, 0, -a]) scale([1.3, 0.35, 0.6]) sphere(1, $fn = 10);
    translate([r * sin(a) * 1.01, 0.5 + r * cos(a) * 0.92, z - 2]) sphere(0.25, $fn = 6);
  }
mirror_x() for (k = [0 : 1]) color(blueDk) translate([6.4, -1.5 + k * 2.5, 9.6]) rotate([0, 0, 20 - k * 40]) scale([1.4, 0.4, 1.2]) sphere(1, $fn = 10);

// Legs: armoured shins, white talons.
mirror_x() {
  ell([3.2, 3.4, 3.4], [4.2, 0.5, 9], blue);
  chain([[4.4, 0, 8], [5.4, -1.4, 4.5], [5.2, -0.4, 2]], [2.2, 1.6, 1.4], armour);
  color(gold) translate([5.4, -1.4, 4.5]) scale([1, 1, 0.4]) sphere(1.9, $fn = 14);
  ell([1.6, 1.8, 1.1], [5.2, -0.8, 1.2], blue);
  for (a = [-35, 0, 35]) spike([5.2 + sin(a) * 1, -2, 0.9], [sin(a) * 1.8, -2.8, -0.4], 0.6, 0.08, talon);
}

// Great plumed tail sweeping back and to the viewer's right.
plume([[4, 3, 12], [10, 4, 15], [14, 4, 20], [16, 3, 26], [14, 2, 29]], [3.6, 3.6, 3.2, 2.4, 1], mane, maneHi);
plume([[4, 3.5, 10], [11, 5, 11], [17, 4.5, 15], [20, 3, 20], [21, 2, 23]], [3.2, 3.2, 2.8, 2, 0.8], maneDk, mane);
plume([[4, 4, 8], [10, 6, 6], [15, 6, 6], [19, 5, 8.5]], [2.8, 2.6, 2, 0.8], mane, maneHi);

// Gold halo ring behind the head with a pearl on top.
translate([0, 4.5, 33]) rotate([-12, 0, 0]) {
  color(gold) rotate([90, 0, 0]) rotate_extrude($fn = 40) translate([8.5, 0]) circle(0.35, $fn = 8);
  ell([0.9, 0.9, 0.9], [0, 0, 8.5], [0.85, 0.95, 1]);
}
// Gold tracery lines on the armour and blades.
mirror_x() {
  chain([[4, -5, 23], [6, -3.8, 22.8], [8, -2.6, 24]], [0.2, 0.2, 0.2], gold);
  chain([[2.5, -6.4, 20], [3.5, -6, 17], [2.5, -6.6, 13]], [0.18, 0.18, 0.18], gold);
}
