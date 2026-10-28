// Kygra: a lean blue penguin-knight. A crest of four tall finger plumes, a gold trident mask over the face, a grey
// chest, two long blade wings held out wide and thin bird legs with white talons.
include <lib.scad>

blue = [0.2, 0.36, 0.7];
blueDk = [0.08, 0.14, 0.32];
blueHi = [0.4, 0.58, 0.9];
gold = [0.95, 0.78, 0.3];
goldDk = [0.72, 0.52, 0.15];
chest = [0.7, 0.68, 0.64];
talon = [0.93, 0.93, 0.9];

// Flat plate as a hull of small spheres (blades, fins): pts, half-thickness t.
module plate(pts, t, c) {
  color(c) hull() for (p = pts) translate(p) sphere(t, $fn = 8);
}

// Blade wing from shoulder s along direction d (unit-ish), length l, width vector w: dark face, light edge.
module blade(s, d, l, w) {
  plate([s + w * 0.6, s - w * 0.4, s + d * l * 0.55 + w, s + d * l * 0.55 - w * 0.6, s + d * l], 0.7, blueDk);
  plate([s + w * 0.75, s + d * l * 0.55 + w * 1.15, s + d * l + w * 0.1], 0.75, blueHi);
}

// Torso: a narrow egg leaning forward, grey chest.
blob([[[5, 4.6, 6], [0, 0.5, 17]], [[4, 4, 4.4], [0, -0.5, 22]]], blue);
blob([[[3, 2, 3.6], [0, -3.3, 18.5]], [[2.6, 1.8, 2.4], [0, -3.4, 22.5]]], chest);
color(blueDk) translate([0, -4.9, 19]) scale([0.3, 0.3, 3]) sphere(1, $fn = 8);

// Head: big and rounded, leaning forward, wearing the gold trident mask; scaled up as one piece.
translate([0, -1, 28]) scale(1.35) translate([0, 0.5, -28]) {
  blob([[[4.2, 4.2, 4], [0, -0.5, 28]], [[2.8, 3, 2.4], [0, -3.6, 26.8]]], blue);
  // Gold trident mask: a shield over the face, a blue inset, and a gold centre blade with two side prongs.
  plate([[-3.2, -4.1, 31.5], [3.2, -4.1, 31.5], [-3.4, -4.8, 26.5], [3.4, -4.8, 26.5], [0, -6.6, 23.6]], 0.5, gold);
  plate([[-2.1, -4.9, 30.6], [2.1, -4.9, 30.6], [-2.2, -5.5, 26.6], [2.2, -5.5, 26.6], [0, -6.6, 24.8]], 0.45, blue);
  plate([[0, -5.6, 31.5], [0, -6.6, 27], [0, -7, 24], [-0.7, -6.3, 28], [0.7, -6.3, 28]], 0.5, gold);
  mirror_x() plate([[1.6, -5.4, 30.8], [1.7, -6, 27.5], [1.3, -6.3, 26]], 0.45, gold);
  mirror_x() eye([3.5, -3.4, 28.6], 0.8, iris = [0.95, 0.75, 0.1], pupil = [0.15, 0.1, 0.05], sclera = [1, 0.92, 0.7], yaw = -55);
  // Crest: four tall flat finger plumes rising from the crown, slightly fanned, tips bent back.
  for (i = [0 : 3]) {
    x = -3.3 + i * 2.2;
    h = 38 - abs(i - 1.5) * 0.8;
    plate([[x * 0.6 - 0.6, 0, 30], [x * 0.6 + 0.6, 0, 30], [x - 0.5, 1, h - 3], [x + 0.6, 1, h - 3]], 0.55, blue);
    plate([[x - 0.5, 1, h - 3], [x + 0.6, 1, h - 3], [x, 1.8, h]], 0.55, blueHi);
  }
}

// Blade wings: the viewer's left one sweeps down and out, the right one out and up.
blade([-4.5, 0, 22], [-0.75, -0.2, -0.6], 17, [-2.2, 0.8, 3]);
blade([4.5, 0, 22], [0.88, 0.15, 0.4], 15, [-1.3, 0.8, 3]);
mirror_x() ell([2.4, 2.4, 2.2], [4.4, 0, 22.5], blue);

// Thin legs: dark thighs, long shins, white talons.
mirror_x() {
  ell([2.6, 3, 3], [3, 0.5, 12.5], blue);
  chain([[3.2, 0.5, 11], [5, -1.6, 7], [4.6, 0, 2.2]], [1.6, 1, 0.9], blue);
  ell([1.2, 1.2, 1], [4.6, -0.4, 1.4], blueDk);
  for (a = [-35, 0, 35]) spike([4.6 + sin(a) * 0.8, -1, 0.9], [sin(a) * 1.8, -2.8, -0.4], 0.6, 0.08, talon);
  spike([4.6, 0.6, 0.9], [0, 1.8, -0.4], 0.4, 0.08, talon);
}
// Short tail feathers behind.
for (a = [-25, 0, 25]) plate([[0, 4, 14], [sin(a) * 4, 8, 9], [sin(a) * 4.5, 7.5, 10.5]], 0.5, blueDk);
