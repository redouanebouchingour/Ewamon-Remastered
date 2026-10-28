// Ravatar (fire relic): Ravatar in spiky black obsidian armour with glowing ember cracks, a burning red-orange arrow
// and eyes, both fists ablaze, its tail darkened and sheathed in flame, fire licking round its feet.
include <lib.scad>

fur = [0.9, 0.76, 0.55];
furHi = [0.98, 0.88, 0.7];
furDark = [0.7, 0.55, 0.38];
mane = [0.3, 0.28, 0.26];
maneHi = [0.42, 0.4, 0.37];
mark = [1, 0.35, 0.08];
tattoo = [0.42, 0.34, 0.26];
antler = [0.5, 0.36, 0.22];
rock = [0.18, 0.16, 0.16];
rockDark = [0.1, 0.09, 0.1];
tailGrey = [0.36, 0.26, 0.2];
tailCream = [0.95, 0.5, 0.12];
claw = [0.95, 0.92, 0.82];
nose = [0.18, 0.12, 0.1];
eyeIris = [1, 0.55, 0.1];
obsidian = [0.16, 0.14, 0.15];
ember = [1, 0.45, 0.08];
flameRed = [0.92, 0.22, 0.06];
flameOrange = [1, 0.55, 0.1];
flameCore = [1, 0.88, 0.4];

module stroke(pts, r, c = mark) { chain(pts, [for (p = pts) r], c); }
// Swirl tattoo facing direction yaw (0 = -Y), radius R.
module tswirl(p, R, yaw = 0, c = tattoo) {
  n = 14;
  translate(p) rotate([0, 0, yaw])
    chain([for (i = [0 : n]) let(t = i / n, a = t * 540, rr = R * (0.2 + 0.8 * t)) [rr * cos(a), 0, rr * sin(a)]],
          [for (i = [0 : n]) 0.3], c, $fn = 6);
}
// Rough rock chunk.
module chunk(p, r, rot = [0, 0, 0], c = rock) { color(c) translate(p) rotate(rot) scale([1.2, 0.9, 1]) sphere(r, $fn = 7); }

// ---- Legs: thick thighs, rocky greaves, clawed feet.
mirror_x() {
  limb([3.6, 0, 16], [5, -0.6, 9], 3, 2.6, fur);
  limb([5, -0.6, 9], [5.4, 0.4, 3], 2.4, 2, fur);
  ell([3, 3, 3.6], [5.3, -0.2, 6], rockDark);
  for (r = [[0, 4, 1.7], [72, 5, 1.6], [144, 4, 1.5], [216, 5.5, 1.6], [288, 4.2, 1.6],
            [20, 8.2, 1.6], [110, 8.6, 1.4], [200, 8, 1.5], [300, 8.4, 1.4]])
    chunk([5.3 + 2.8 * sin(r[0]), -0.2 - 2.8 * cos(r[0]), r[1]], r[2], [r[0] / 3, 20, r[0]], (r[0] % 120 == 0) ? rockDark : rock);
  spike([5.8, -2.6, 9.5], [0.6, -1.2, 2.4], 1, 0.05, rock);
  blob([[[2.6, 3.4, 1.4], [5.6, -1.6, 1.4]], [[2.2, 2, 1.4], [5.6, 0.8, 1.6]]], furDark);
  for (a = [-28, 0, 28]) spike([5.6 + sin(a) * 1.5, -4.8, 1], [sin(a) * 0.5, -1.4, -0.4], 0.55, 0.05, claw);
}

// ---- Hips and the plated rocky loincloth.
ell([6, 4.2, 3.4], [0, 0, 16.5], furDark);
for (x = [-4, -1.4, 1.4, 4]) spike([x, -3.6, 17.5], [x * 0.15, -0.6, -5.5], 1.6, 0.1, (abs(x) < 2) ? rockDark : rock);
for (x = [-3, 0, 3]) spike([x, 3.6, 17.5], [x * 0.15, 0.6, -4.5], 1.5, 0.1, rock);
color(rockDark) translate([0, 0, 17.6]) scale([6.3, 4.5, 1]) cylinder(h = 1.2, r = 1, $fn = 24);

// ---- Torso: V-shaped, muscled chest.
blob([[[4.8, 3.6, 3.6], [0, 0, 20]], [[7.4, 4.6, 4.4], [0, 0, 27]]], fur);
mirror_x() color(furHi) translate([2.4, -3.95, 28.2]) scale([3.2, 0.6, 1.4]) sphere(1, $fn = 14);
for (z = [20.5, 22.5]) mirror_x() color(furHi) translate([1.3, -3.4, z]) scale([1.3, 0.7, 0.8]) sphere(1, $fn = 10);
// Swirl tattoos: chest, shoulders, back.
mirror_x() {
  tswirl([3, -5.1, 27.2], 1.2);
  tswirl([6.4, 3.6, 28], 1.2, 180);
  tswirl([3, 4.6, 25], 1.4, 180);
}
// Shaggy ruff on the chest and shoulders.
for (a = [-70 : 20 : 70]) spike([sin(a) * 5.2, -3 + abs(sin(a)) * 1.2, 30.5], [sin(a) * 1.4, -1.2, -4], 1.3, 0.05, furHi);
for (a = [0 : 30 : 359]) spike([cos(a) * 5, sin(a) * 3.8, 31], [cos(a) * 2.2, sin(a) * 2.2, -2], 1.6, 0.05, fur);
// Spine marking.
stroke([[0, 4.8, 30], [0.8, 4.9, 26.5], [-0.6, 4.5, 23], [0.2, 3.8, 19.5]], 0.75);

// ---- Arms: long, hanging, a little out from the body, clawed hands; stripe tattoos on the forearms.
mirror_x() {
  ell([3, 3, 2.8], [7.2, 0, 28.5], fur);
  limb([7.6, 0, 28], [9.4, -0.6, 21], 2.5, 2.1, fur);
  limb([9.4, -0.6, 21], [10.4, -1.6, 14.5], 2.1, 1.7, fur);
  for (z = [16.5, 18.5]) stroke([[11.3, -1.3, z], [10.6, -2.6, z + 0.6]], 0.3, tattoo);
  ell([1.9, 1.7, 2], [10.6, -1.8, 13], fur);
  for (a = [-30, 0, 30]) spike([10.6 + sin(a) * 1.2, -3, 11.6], [sin(a) * 0.4, -0.8, -1.4], 0.45, 0.05, claw);
}

// ---- Bushy tail: sweeps back and out to the viewer's right, then up; grey over a cream underside.
// A tapering chain of hulled ellipsoids: [radius, point] pairs.
module tailpath(pts, rs, c) { for (i = [0 : len(pts) - 2]) blob([[rs[i], pts[i]], [rs[i + 1], pts[i + 1]]], c); }
tailpath([[2, 4, 15], [7, 6, 9], [12.5, 4.5, 7], [16.5, 2, 10], [18, 0.5, 15], [17.6, 0, 20.5]],
         [[1.8, 1.8, 1.8], [3, 3, 3], [3.6, 3.4, 3.4], [3.4, 3.2, 3.4], [2.6, 2.4, 3], [0.8, 0.8, 1.4]], tailGrey);
tailpath([[7, 4.4, 7.8], [12.5, 2.4, 5.6], [16, -0.2, 8.6], [17, -1.2, 13.5]],
         [[2.6, 2.2, 2.2], [3, 2.4, 2.4], [2.8, 2.2, 2.6], [1.6, 1.4, 2]], tailCream);
for (t = [[10, 7.6, 8.5], [14.5, 5.8, 9], [18.4, 3, 15]]) spike(t, [1.4, 1, 1], 1.2, 0.05, tailGrey);
for (t = [[10, 3.4, 4.6], [14.5, 0.8, 5.2], [18.5, -1.4, 10]]) spike(t, [1.2, -0.6, -1.4], 1.1, 0.05, tailCream);

// ---- Obsidian armour with ember gems.
module tongue(p, d, r, c) { color(c) hull() { translate(p) sphere(r * 1.6, $fn = 10); translate(p + d * 0.5 + [0, 0, r * 0.6]) sphere(r * 0.9, $fn = 8); translate(p + d * 1.1) sphere(0.15, $fn = 6); } }
module emberGem(p, r, yaw = 0) {
  translate(p) rotate([0, 0, yaw]) { color(ember) scale([1, 0.5, 0.7]) sphere(r, $fn = 8); color(flameCore) translate([0, -r * 0.35, 0]) scale([0.5, 0.3, 0.35]) sphere(r, $fn = 6); }
}
mirror_x() {
  color(obsidian) translate([7.6, 0, 29.6]) scale([4.2, 4.2, 3]) sphere(1, $fn = 9);
  for (a = [[0, 0, 3.6], [1.6, -1.6, 2.6], [1.6, 1.6, 2.6], [2.8, 0, 1.8]]) spike([7.6 + a[0], a[1], 31], [a[0] * 0.6, a[1] * 0.6, a[2]], 1.1, 0.05, obsidian);
  emberGem([7.4, -4, 29.8], 1);
  emberGem([7.4, 4, 29.8], 1, 180);
  // Bracers and flaming fists.
  limb([9.7, -0.8, 19.5], [10.3, -1.3, 15.5], 2.3, 2.1, obsidian, $fn = 12);
  spike([11.6, -0.8, 18], [1.8, 0.4, 1.4], 0.8, 0.05, obsidian);
  for (t = [[[10.6, -2, 12.5], [1.5, -0.5, 6.5], 2.2, flameRed], [[11.4, -1, 13], [3.2, 0.5, 4.5], 1.8, flameRed],
            [[10, -2.4, 13.5], [-1.4, -1, 5.5], 1.6, flameOrange], [[11.2, -2.6, 12], [2.4, -1.4, 3], 1.4, flameOrange],
            [[10.6, -1.4, 11], [1, 0, -3], 1.4, flameRed]])
    tongue(t[0], t[1], t[2], t[3]);
  ell([2.2, 2.2, 2.6], [10.9, -3.4, 14], flameCore);
}
// Chest plate with three ember gems, and the back plate with more.
color(obsidian) translate([0, 0.4, 27]) scale([7.6, 5.8, 4.4]) difference() { sphere(1, $fn = 16); translate([0, 1.25, 0]) cube(2, center = true); }
mirror_x() emberGem([2.8, -5.3, 27.6], 1.4, -15);
emberGem([0, -5.0, 23.8], 0.9);
color(obsidian) translate([0, -0.4, 26.5]) scale([7.8, 6.2, 5.6]) difference() { sphere(1, $fn = 16); translate([0, -1.25, 0]) cube(2, center = true); }
for (g = [[0, 6, 28.5, 1.4], [-3.4, 5.4, 29.5, 1], [3.4, 5.4, 29.5, 1], [-2.4, 5.6, 24.5, 1], [2.4, 5.6, 24.5, 1]])
  emberGem([g[0], g[1], g[2]], g[3], 180);
for (x = [-4, 0, 4]) spike([x, 5, 31], [x * 0.2, 1.6, 2.4], 1, 0.05, obsidian);
// Flaming tail: tongues streaming up from the tail.
for (t = [[[12.5, 4.5, 9], [-1, 0.5, 9], 2.6, flameRed], [[16.5, 2, 11], [1, 0, 11], 2.4, flameRed], [[18, 0.5, 15], [-0.5, 0, 9], 2, flameOrange],
          [[8, 6, 10], [-1.5, 1, 7], 2, flameRed], [[15, 3, 12], [-2, -1, 7], 1.6, flameOrange], [[17.5, 1, 18], [0.5, -0.5, 6], 1.2, flameCore]])
  tongue(t[0], t[1], t[2], t[3]);
// Fire at the feet.
for (t = [[[-10, -3, 0.5], [-1, 0, 4.5], 1.3, flameOrange], [[-12, 0, 0.5], [0, 0, 3.5], 1.1, flameRed], [[10, -4, 0.5], [1, 0, 4], 1.2, flameOrange],
          [[2, 9, 0.5], [0, 0, 4], 1.4, flameRed], [[-6, 6, 0.5], [0, 0, 3], 1.1, flameOrange]])
  tongue(t[0], t[1], t[2], t[3]);

// ---- Head: lion-hound with a short muzzle.
blob([[[4.6, 4.2, 4.2], [0, -0.8, 35]], [[3.6, 3.4, 3], [0, -1.6, 32.6]]], fur);
ell([2.6, 2, 1.8], [0, -4.6, 32.6], furHi);
ell([0.9, 0.6, 0.6], [0, -6.4, 33.4], nose);
color(nose) translate([0, -6, 31.6]) scale([1.2, 0.3, 0.3]) sphere(1, $fn = 10);
// Cheek ruff.
mirror_x() for (z = [31, 33]) spike([3.4, -2.6, z], [2, 0.4, -1], 1.2, 0.05, furHi);
// Eyes: narrow and fierce under heavy brows.
mirror_x() {
  eye([2, -4.4, 35], 1, iris = eyeIris, pupil = [0.1, 0.12, 0.16], yaw = -20);
  color(furDark) translate([2.1, -4.9, 36.2]) rotate([0, -18, -20]) scale([1.6, 0.5, 0.45]) sphere(1, $fn = 12);
}
// Arrow marking: point on the brow, band over the crown into the mane.
color(mark) translate([0, -4.95, 36.6]) rotate([-60, 0, 0]) linear_extrude(0.8, center = true)
  polygon([[0, -1.6], [-1.6, 0.6], [-0.8, 0.6], [-0.8, 1.2], [0.8, 1.2], [0.8, 0.6], [1.6, 0.6]]);
stroke([[0, -4, 38], [0, -2.2, 39.2]], 0.8);
// Ears.
mirror_x() spike([3.6, -0.6, 37.6], [1.8, 0.4, 2.2], 1.2, 0.1, fur);
// Short antlers.
mirror_x() {
  chain([[2, -1.2, 38.6], [3, -1, 41], [4.2, -0.8, 43], [5.4, -0.6, 44]], [0.7, 0.6, 0.45, 0.2], antler);
  limb([3.1, -1, 41], [1.8, -1.4, 42.6], 0.45, 0.15, antler);
}
// Wild mane: a big swept mass of spikes behind and above the head, streaming back.
blob([[[5, 4.6, 4], [0, 2, 37.5]], [[4, 3.6, 3], [0, 4.6, 33]]], mane);
for (s = [[-4, 0, 41, -2, 1.4, 3], [-1.5, 0.5, 42, -0.6, 1.6, 4], [1.5, 0.6, 42, 1, 2, 3.8], [4, 0.4, 40.5, 2.6, 2, 2.4],
          [-5, 2, 38, -3.4, 2.4, 1], [5, 2, 38, 3.4, 2.4, 1.2], [0, 3, 40.5, 0, 5, 2.6], [-3, 4, 38, -1.4, 5, 0.6],
          [3, 4, 38, 1.6, 5, 0.6], [0, 5.5, 35, 0, 4, -2], [-3, 5, 33, -1.4, 3, -3], [3, 5, 33, 1.4, 3, -3]])
  spike([s[0], s[1], s[2]], [s[3], s[4], s[5]], 2.1, 0.1, ((s[0] + s[2]) % 2 == 0) ? maneHi : mane);
// Mane-crossing marking down the back of the head.
stroke([[0, 1.5, 42.2], [0, 5, 39.8], [0, 7.4, 35.5], [0, 6.8, 31.5]], 0.75);
